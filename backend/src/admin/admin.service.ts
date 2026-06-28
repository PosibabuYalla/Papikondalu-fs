import { Injectable, NotFoundException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async promoteUser(userId: string, role: Role) {
    return this.prisma.user.update({ where: { id: userId }, data: { role } });
  }

  async getAuditLogs(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({ skip, take: limit, include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: 'desc' } }),
      this.prisma.auditLog.count(),
    ]);
    return { data, total, page, limit };
  }

  async createAuditLog(data: { userId?: string; action: string; entity: string; entityId?: string; oldData?: any; newData?: any; ipAddress?: string }) {
    return this.prisma.auditLog.create({ data });
  }

  async getSystemStats() {
    const [users, packages, bookings, reviews, payments] = await Promise.all([
      this.prisma.user.groupBy({ by: ['role'], _count: true }),
      this.prisma.package.groupBy({ by: ['status'], _count: true }),
      this.prisma.booking.groupBy({ by: ['status'], _count: true }),
      this.prisma.review.groupBy({ by: ['status'], _count: true }),
      this.prisma.payment.groupBy({ by: ['status'], _sum: { amount: true }, _count: true }),
    ]);
    return { users, packages, bookings, reviews, payments };
  }

  // ─── Agent Management ───────────────────────────────────────────────────────

  async createAgent(dto: { name: string; email: string; phone?: string; password: string }) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    try {
      const agent = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          phone: dto.phone ?? null,
          passwordHash,
          role: 'AGENT' as Role,
          isEmailVerified: true,
        },
        select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, createdAt: true },
      });
      return agent;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Phone number is already in use');
      }
      throw new InternalServerErrorException('Failed to create agent: ' + (e as Error).message);
    }
  }

  async updateAgent(id: string, dto: { name?: string; phone?: string; isActive?: boolean; password?: string }) {
    const agent = await this.prisma.user.findUnique({ where: { id } });
    if (!agent || agent.role !== ('AGENT' as Role)) throw new NotFoundException('Agent not found');

    const updateData: any = {};
    if (dto.name) updateData.name = dto.name;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.password) updateData.passwordHash = await bcrypt.hash(dto.password, 12);

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, createdAt: true },
    });
  }

  async deactivateAgent(id: string) {
    const agent = await this.prisma.user.findUnique({ where: { id } });
    if (!agent || agent.role !== ('AGENT' as Role)) throw new NotFoundException('Agent not found');
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, name: true, email: true, isActive: true },
    });
  }

  async listAgents(page: number | string = 1, limit: number | string = 20) {
    const p = Math.max(1, parseInt(String(page), 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
    const skip = (p - 1) * l;
    const [agents, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: 'AGENT' as Role },
        skip,
        take: l,
        select: { id: true, name: true, email: true, phone: true, isActive: true, createdAt: true, lastLogin: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where: { role: 'AGENT' as Role } }),
    ]);

    // Attach booking counts per agent
    const agentIds = agents.map(a => a.id);
    const bookingCounts = await this.prisma.booking.groupBy({
      by: ['bookedByAgentId'],
      where: { bookedByAgentId: { in: agentIds } },
      _count: { id: true },
      _sum: { finalAmount: true },
    });

    const countMap = new Map(bookingCounts.map(b => [b.bookedByAgentId, { count: b._count.id, revenue: b._sum.finalAmount }]));
    const data = agents.map(a => ({
      ...a,
      totalBookings: countMap.get(a.id)?.count ?? 0,
      totalRevenue: countMap.get(a.id)?.revenue ?? 0,
    }));

    return { data, total, page, limit };
  }

  async getAgentStats() {
    const agents = await this.prisma.user.findMany({
      where: { role: 'AGENT' as Role },
      select: { id: true, name: true, email: true, isActive: true },
    });

    const bookingStats = await this.prisma.booking.groupBy({
      by: ['bookedByAgentId', 'status'],
      where: { bookedByAgentId: { not: null } },
      _count: { id: true },
      _sum: { finalAmount: true },
    });

    const statsMap: Record<string, any> = {};
    for (const s of bookingStats) {
      const aid = s.bookedByAgentId!;
      if (!statsMap[aid]) statsMap[aid] = { total: 0, revenue: 0, byStatus: {} };
      statsMap[aid].total += s._count.id;
      statsMap[aid].revenue += Number(s._sum.finalAmount ?? 0);
      statsMap[aid].byStatus[s.status] = s._count.id;
    }

    return agents.map(a => ({
      ...a,
      stats: statsMap[a.id] ?? { total: 0, revenue: 0, byStatus: {} },
    }));
  }

  async getAgentBookings(agentId: string, page: number | string = 1, limit: number | string = 10) {
    const agent = await this.prisma.user.findUnique({ where: { id: agentId } });
    if (!agent || agent.role !== ('AGENT' as Role)) throw new NotFoundException('Agent not found');

    const p = Math.max(1, parseInt(String(page), 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 10));
    const skip = (p - 1) * l;
    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where: { bookedByAgentId: agentId },
        skip,
        take: l,
        include: {
          user: { select: { name: true, email: true, phone: true } },
          package: { select: { name: true } },
          passengers: true,
          payment: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.booking.count({ where: { bookedByAgentId: agentId } }),
    ]);
    return { data, total, page, limit, agent: { name: agent.name, email: agent.email } };
  }
}
