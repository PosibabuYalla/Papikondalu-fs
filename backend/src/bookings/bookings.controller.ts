import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CreateBookingDto, AgentCreateBookingDto, CancelBookingDto } from './dto/booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role, BookingStatus } from '@prisma/client';

@ApiTags('bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new booking' })
  create(@CurrentUser() user: any, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(user.id, dto);
  }

  // Agent routes
  @Post('agent')
  @UseGuards(RolesGuard)
  @Roles(Role.AGENT)
  @ApiOperation({ summary: 'Agent books a ticket for an offline passenger' })
  agentCreate(@CurrentUser() user: any, @Body() dto: AgentCreateBookingDto) {
    return this.bookingsService.createAgentBooking(user.id, dto);
  }

  @Get('agent/my')
  @UseGuards(RolesGuard)
  @Roles(Role.AGENT)
  @ApiOperation({ summary: 'Agent views their own bookings' })
  getAgentBookings(
    @CurrentUser() user: any,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.bookingsService.findAgentBookings(user.id, page, limit);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my bookings' })
  getMyBookings(
    @CurrentUser() user: any,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.bookingsService.findUserBookings(user.id, page, limit);
  }

  @Get('my/:id')
  @ApiOperation({ summary: 'Get my booking detail' })
  getMyBooking(@CurrentUser() user: any, @Param('id') id: string) {
    return this.bookingsService.findOne(id, user.id);
  }

  @Patch('my/:id/cancel')
  @ApiOperation({ summary: 'Cancel my booking' })
  cancelBooking(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CancelBookingDto) {
    return this.bookingsService.cancel(id, user.id, dto);
  }

  // Admin routes
  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all bookings (admin)' })
  findAll(@Query('page') page: number, @Query('limit') limit: number, @Query('status') status: BookingStatus) {
    return this.bookingsService.findAll(page, limit, status);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get booking by ID (admin)' })
  findOne(@Param('id') id: string) {
    return this.bookingsService.findOne(id);
  }
}
