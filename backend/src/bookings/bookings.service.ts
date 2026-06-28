import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { CreateBookingDto, AgentCreateBookingDto, CancelBookingDto } from './dto/booking.dto';
import { paginate, createPaginatedResult } from '../common/utils/pagination.util';
import { BookingStatus } from '@prisma/client';
import * as QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private payments: PaymentsService,
  ) {}

  private generateBookingNumber(): string {
    const date = new Date();
    const prefix = 'PKD';
    const datePart = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `${prefix}${datePart}${random}`;
  }

  private async createBookingRecord(userId: string, dto: CreateBookingDto, agentId?: string) {
    const pkg = await this.prisma.package.findUnique({ where: { id: dto.packageId } });
    if (!pkg) throw new NotFoundException('Package not found');
    if (pkg.status !== 'ACTIVE') throw new BadRequestException('Package is not available');
    if (pkg.availableSeats < dto.passengers.length) throw new BadRequestException('Not enough seats');

    const unitPrice = Number(pkg.discountedPrice || pkg.price);
    const totalAmount = unitPrice * dto.passengers.length;
    const taxAmount = totalAmount * 0.05;
    const finalAmount = totalAmount + taxAmount;

    const qrData = `PKD-BOOKING-${uuidv4()}`;
    const qrCode = await QRCode.toDataURL(qrData);
    const bookingNumber = this.generateBookingNumber();

    const booking = await this.prisma.$transaction(async (tx) => {
      const created = await tx.booking.create({
        data: {
          bookingNumber,
          userId,
          packageId: dto.packageId,
          bookedByAgentId: agentId ?? null,
          paymentMode: dto.paymentMode ?? (agentId ? 'CASH' : 'ONLINE'),
          travelDate: new Date(dto.travelDate),
          numberOfPersons: dto.passengers.length,
          totalAmount,
          taxAmount,
          finalAmount,
          qrCode,
          specialRequests: dto.specialRequests,
          passengers: { create: dto.passengers },
        },
        include: { passengers: true, package: { select: { name: true, startingPoint: true, endingPoint: true } } },
      });
      await tx.package.update({ where: { id: dto.packageId }, data: { availableSeats: { decrement: dto.passengers.length } } });
      return created;
    });

    this.notifications.sendBookingConfirmation(userId, {
      bookingNumber: booking.bookingNumber,
      packageName: booking.package.name,
      travelDate: new Date(dto.travelDate).toLocaleDateString('en-IN'),
      numberOfPersons: booking.numberOfPersons,
      finalAmount: booking.finalAmount,
    }).catch(console.error);

    return booking;
  }

  async create(userId: string, dto: CreateBookingDto) {
    return this.createBookingRecord(userId, dto);
  }

  async createAgentBooking(agentId: string, dto: AgentCreateBookingDto) {
    // Find or create a guest user for the passenger
    let passenger = await this.prisma.user.findUnique({ where: { email: dto.passengerEmail } });
    if (!passenger) {
      const tempPassword = await bcrypt.hash(uuidv4(), 10);
      passenger = await this.prisma.user.create({
        data: {
          email: dto.passengerEmail,
          name: dto.passengerName || dto.passengers[0]?.name || 'Guest',
          phone: dto.passengerPhone,
          passwordHash: tempPassword,
          role: 'USER',
          isEmailVerified: false,
        },
      });
    }
    return this.createBookingRecord(passenger.id, dto, agentId);
  }

  async findAgentBookings(agentId: string, page = 1, limit = 10) {
    const { skip, take } = paginate({ page, limit });
    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where: { bookedByAgentId: agentId },
        skip, take,
        include: {
          package: { include: { images: { where: { isPrimary: true } } } },
          payment: true,
          user: { select: { name: true, email: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.booking.count({ where: { bookedByAgentId: agentId } }),
    ]);
    return createPaginatedResult(data, total, page, limit);
  }

  async findUserBookings(userId: string, page = 1, limit = 10) {
    const { skip, take } = paginate({ page, limit });
    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where: { userId },
        skip, take,
        include: { package: { include: { images: { where: { isPrimary: true } } } }, payment: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.booking.count({ where: { userId } }),
    ]);
    return createPaginatedResult(data, total, page, limit);
  }

  async findOne(id: string, userId?: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { passengers: true, package: { include: { images: true } }, payment: true, user: { select: { name: true, email: true, phone: true } } },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (userId && booking.userId !== userId) throw new ForbiddenException('Not authorized');
    return booking;
  }

  async cancel(id: string, userId: string, dto: CancelBookingDto) {
    const booking = await this.findOne(id, userId);
    if (booking.status === BookingStatus.CANCELLED) throw new BadRequestException('Already cancelled');
    if (booking.status === BookingStatus.COMPLETED) throw new BadRequestException('Completed bookings cannot be cancelled');

    const travelDate = new Date(booking.travelDate);
    const now = new Date();
    const hoursUntilTravel = (travelDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    let refundAmount = 0;
    if (hoursUntilTravel > 48) refundAmount = Number(booking.finalAmount);
    else if (hoursUntilTravel > 24) refundAmount = Number(booking.finalAmount) * 0.5;

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id },
        data: { status: BookingStatus.CANCELLED, cancelledAt: new Date(), cancelReason: dto.reason, refundAmount },
      });
      await tx.package.update({ where: { id: booking.packageId }, data: { availableSeats: { increment: booking.numberOfPersons } } });
    });

    if (refundAmount > 0) {
      this.payments.processRefund(id, refundAmount).catch(console.error);
    }

    return { message: 'Booking cancelled', refundAmount };
  }

  async findAll(page = 1, limit = 10, status?: BookingStatus) {
    const { skip, take } = paginate({ page, limit });
    const where = status ? { status } : {};
    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where, skip, take,
        include: {
          user: { select: { name: true, email: true } },
          agent: { select: { name: true, email: true } },
          package: { select: { name: true } },
          payment: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return createPaginatedResult(data, total, page, limit);
  }
}
