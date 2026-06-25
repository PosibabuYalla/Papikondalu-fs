import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType, NotificationChannel } from '@prisma/client';
import { Resend } from 'resend';

@Injectable()
export class NotificationsService {
  private resend: Resend;

  constructor(private prisma: PrismaService, private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (apiKey) {
      this.resend = new Resend(apiKey);
    }
  }

  async create(data: {
    userId: string;
    type: NotificationType;
    channel: NotificationChannel;
    title: string;
    message: string;
    extraData?: any;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        channel: data.channel,
        title: data.title,
        message: data.message,
        data: data.extraData,
      },
    });

    // Fire & forget sends
    const user = await this.prisma.user.findUnique({ where: { id: data.userId }, select: { email: true, phone: true, name: true } });
    if (!user) return notification;

    if (data.channel === NotificationChannel.EMAIL || data.channel === NotificationChannel.BOTH) {
      this.sendEmail(user.email, data.title, data.message).catch(console.error);
    }
    if (data.channel === NotificationChannel.WHATSAPP || data.channel === NotificationChannel.BOTH) {
      if (user.phone) this.sendWhatsApp(user.phone, data.message).catch(console.error);
    }

    return notification;
  }

  async sendEmail(to: string, subject: string, html: string) {
    if (!this.resend) return;
    try {
      await this.resend.emails.send({
        from: this.configService.get('FROM_EMAIL', 'noreply@papikondalu.com'),
        to,
        subject,
        html,
      });
    } catch (err) {
      console.error('Email send failed:', err);
    }
  }

  async sendWhatsApp(phone: string, message: string) {
    const token = this.configService.get('WHATSAPP_API_TOKEN', '');
    const phoneNumberId = this.configService.get('WHATSAPP_PHONE_NUMBER_ID', '');
    if (!token || !phoneNumberId) return;

    try {
      const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone.replace('+', ''),
          type: 'text',
          text: { body: message },
        }),
      });
      if (!response.ok) console.error('WhatsApp send failed:', await response.text());
    } catch (err) {
      console.error('WhatsApp error:', err);
    }
  }

  async getUserNotifications(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total, unread] = await Promise.all([
      this.prisma.notification.findMany({ where: { userId }, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);
    return { data, total, unread, page, limit };
  }

  async markAsRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true, readAt: new Date() } });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true, readAt: new Date() } });
  }

  async sendBookingConfirmation(userId: string, bookingDetails: any) {
    return this.create({
      userId,
      type: NotificationType.BOOKING_CONFIRMATION,
      channel: NotificationChannel.BOTH,
      title: 'Booking Confirmed!',
      message: `Your booking ${bookingDetails.bookingNumber} for ${bookingDetails.packageName} on ${bookingDetails.travelDate} has been confirmed. Thank you for choosing Papikondalu Tourism!`,
      extraData: bookingDetails,
    });
  }

  async sendPaymentSuccess(userId: string, paymentDetails: any) {
    return this.create({
      userId,
      type: NotificationType.PAYMENT_SUCCESS,
      channel: NotificationChannel.BOTH,
      title: 'Payment Successful!',
      message: `Payment of ₹${paymentDetails.amount} received successfully for booking ${paymentDetails.bookingNumber}.`,
      extraData: paymentDetails,
    });
  }
}
