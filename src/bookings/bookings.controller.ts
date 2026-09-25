import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import {
  BookingResponseDto,
  CancelBookingResponseDto,
} from './dto/booking-response.dto';

@ApiTags('Bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Book an appointment slot',
    description:
      'Creates a booking for an available appointment slot. Concurrency protection ensures that simultaneous requests for the same slot result in exactly one successful booking and one 409 Conflict.',
  })
  @ApiBody({ type: CreateBookingDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The booking was successfully created.',
    type: BookingResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation failed (e.g. missing or invalid slotId / customerName).',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The requested slot does not exist.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'The slot is already booked or a concurrent booking conflict occurred.',
  })
  async createBooking(
    @Body() createBookingDto: CreateBookingDto,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.createBooking(createBookingDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel an appointment booking',
    description:
      'Cancels an active booking, setting its status to CANCELLED and freeing the slot for new bookings.',
  })
  @ApiParam({
    name: 'id',
    description: 'The unique ID of the booking to cancel',
    example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The booking was successfully cancelled.',
    type: CancelBookingResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The booking with the specified ID was not found.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'The booking has already been cancelled.',
  })
  async cancelBooking(
    @Param('id') id: string,
  ): Promise<CancelBookingResponseDto> {
    return this.bookingsService.cancelBooking(id);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get booking details by ID',
    description: 'Retrieves current information for a specific booking.',
  })
  @ApiParam({
    name: 'id',
    description: 'The unique ID of the booking',
    example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Booking details retrieved successfully.',
    type: BookingResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The booking with the specified ID was not found.',
  })
  async getBookingById(
    @Param('id') id: string,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.findBookingById(id);
  }
}
