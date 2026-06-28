import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentStatus, BookingStatus } from '@prisma/client';
import * as crypto from 'crypto';
import Razorpay = require('razorpay');

@Injectable()
export class PaymentsService {
  private razorpay: Razorpay;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private notifications: NotificationsService,
  ) {
    const keyId = this.configService.get<string>('RAZORPAY_KEY_ID');
    if (keyId) {
      this.razorpay = new Razorpay({
        key_id: keyId,
        key_secret: this.configService.get('RAZORPAY_KEY_SECRET', ''),
      });
    }
  }

  async createOrder(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, userId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== BookingStatus.PENDING) throw new BadRequestException('Booking is not in pending state');

    const amount = Math.round(Number(booking.finalAmount) * 100); // paise
    const order = await this.razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: booking.bookingNumber,
      notes: { bookingId, userId },
    });

    const payment = await this.prisma.payment.upsert({
      where: { bookingId },
      create: { bookingId, razorpayOrderId: order.id, amount: booking.finalAmount, currency: 'INR' },
      update: { razorpayOrderId: order.id },
    });

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: this.configService.get('RAZORPAY_KEY_ID'),
      bookingNumber: booking.bookingNumber,
    };
  }

  async verifyPayment(body: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
    const secret = this.configService.get('RAZORPAY_KEY_SECRET', '');
    const generated = crypto.createHmac('sha256', secret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');

    if (generated !== razorpay_signature) throw new BadRequestException('Invalid payment signature');

    const paymentDetails = await this.razorpay.payments.fetch(razorpay_payment_id) as any;
    const payment = await this.prisma.payment.findFirst({ where: { razorpayOrderId: razorpay_order_id } });
    if (!payment) throw new NotFoundException('Payment record not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          status: PaymentStatus.SUCCESS,
          method: paymentDetails.method,
          bank: paymentDetails.bank,
          wallet: paymentDetails.wallet,
          vpa: paymentDetails.vpa,
          paidAt: new Date(),
        },
      });
      await tx.booking.update({ where: { id: payment.bookingId }, data: { status: BookingStatus.CONFIRMED } });
    });

    // Send payment success notification (fire & forget)
    const booking = await this.prisma.booking.findUnique({
      where: { id: payment.bookingId },
      select: { userId: true, bookingNumber: true, finalAmount: true },
    });
    if (booking) {
      this.notifications.sendPaymentSuccess(booking.userId, {
        bookingNumber: booking.bookingNumber,
        amount: booking.finalAmount,
      }).catch(console.error);
    }

    return { success: true, message: 'Payment verified successfully' };
  }

  async handleWebhook(payload: any, signature: string) {
    const secret = this.configService.get('RAZORPAY_WEBHOOK_SECRET', '');
    const generated = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
    if (generated !== signature) throw new BadRequestException('Invalid webhook signature');

    const event = payload.event;

    if (event === 'payment.captured') {
      const entity = payload.payload.payment.entity;
      const payment = await this.prisma.payment.findFirst({ where: { razorpayOrderId: entity.order_id } });
      if (payment && payment.status !== PaymentStatus.SUCCESS) {
        await this.prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: PaymentStatus.SUCCESS, razorpayPaymentId: entity.id, paidAt: new Date() },
          });
          await tx.booking.update({ where: { id: payment.bookingId }, data: { status: BookingStatus.CONFIRMED } });
        });
      }
    }

    if (event === 'payment.failed') {
      const orderId = payload.payload.payment.entity.order_id;
      const payment = await this.prisma.payment.findFirst({ where: { razorpayOrderId: orderId } });
      if (payment) {
        await this.prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.FAILED } });
      }
    }

    if (event === 'refund.processed') {
      const entity = payload.payload.refund.entity;
      const payment = await this.prisma.payment.findFirst({ where: { razorpayPaymentId: entity.payment_id } });
      if (payment) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { refundStatus: 'processed', refundId: entity.id },
        });
      }
    }

    return { received: true };
  }

  async processRefund(bookingId: string, amount: number) {
    if (amount <= 0) return;
    const payment = await this.prisma.payment.findUnique({ where: { bookingId } });
    if (!payment || payment.status !== PaymentStatus.SUCCESS || !payment.razorpayPaymentId) return;

    const refund = await this.razorpay.payments.refund(payment.razorpayPaymentId, {
      amount: Math.round(amount * 100),
    }) as any;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.REFUNDED,
        refundId: refund.id,
        refundAmount: amount,
        refundStatus: refund.status,
        refundedAt: new Date(),
      },
    });
  }

  async getUserPayments(userId: string) {
    return this.prisma.payment.findMany({
      where: { booking: { userId } },
      include: { booking: { select: { bookingNumber: true, travelDate: true, package: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPaymentById(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { booking: { include: { user: { select: { name: true, email: true } }, package: { select: { name: true } } } } },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }
}
