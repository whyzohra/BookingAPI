import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';
import { SlotResponseDto } from '../../slots/dto/slot-response.dto';

export class BookingResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the booking',
    example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  })
  id: string;

  @ApiProperty({
    description: 'Identifier of the booked slot',
    example: 'slot-1',
  })
  slotId: string;

  @ApiProperty({
    description: 'Name of the customer',
    example: 'Zohra',
  })
  customerName: string;

  @ApiProperty({
    description: 'Current status of the booking',
    enum: BookingStatus,
    example: BookingStatus.CONFIRMED,
  })
  status: BookingStatus;

  @ApiProperty({
    description: 'Timestamp when the booking was created',
    example: '2026-09-25T14:35:00.000Z',
  })
  createdAt: Date;

  @ApiPropertyOptional({
    description: 'Timestamp when the booking was cancelled (null if active)',
    example: null,
    nullable: true,
  })
  cancelledAt: Date | null;

  @ApiPropertyOptional({
    description: 'Associated slot details',
    type: () => SlotResponseDto,
  })
  slot?: SlotResponseDto;
}

export class CancelBookingResponseDto {
  @ApiProperty({
    description: 'Cancellation confirmation message',
    example: 'Booking cancelled successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Updated booking details with CANCELLED status',
    type: BookingResponseDto,
  })
  booking: BookingResponseDto;
}
