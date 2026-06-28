import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { CreateAgentDto, UpdateAgentDto } from './dto/agent.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get system statistics' })
  getStats() {
    return this.adminService.getSystemStats();
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Get audit logs' })
  getAuditLogs(@Query('page') page: number, @Query('limit') limit: number) {
    return this.adminService.getAuditLogs(page, limit);
  }

  @Patch('users/:id/role')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Promote/demote user role (super admin)' })
  promoteUser(@Param('id') id: string, @Body('role') role: Role) {
    return this.adminService.promoteUser(id, role);
  }

  // ─── Agent Management ──────────────────────────────────────────────────────

  @Post('agents')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new agent account (super admin)' })
  createAgent(@Body() dto: CreateAgentDto) {
    return this.adminService.createAgent(dto);
  }

  @Get('agents')
  @ApiOperation({ summary: 'List all agents with booking stats' })
  listAgents(@Query('page') page: number, @Query('limit') limit: number) {
    return this.adminService.listAgents(page, limit);
  }

  @Get('agents/stats')
  @ApiOperation({ summary: 'Get booking stats broken down by agent' })
  getAgentStats() {
    return this.adminService.getAgentStats();
  }

  @Get('agents/:id/bookings')
  @ApiOperation({ summary: 'Get bookings made by a specific agent' })
  getAgentBookings(
    @Param('id') id: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.adminService.getAgentBookings(id, page, limit);
  }

  @Patch('agents/:id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update agent info or reset password (super admin)' })
  updateAgent(@Param('id') id: string, @Body() dto: UpdateAgentDto) {
    return this.adminService.updateAgent(id, dto);
  }

  @Delete('agents/:id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Deactivate an agent (super admin)' })
  deactivateAgent(@Param('id') id: string) {
    return this.adminService.deactivateAgent(id);
  }
}
