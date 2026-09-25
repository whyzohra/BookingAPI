import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({
    description: 'Unique identifier of the appointment slot to book',
    example: 'slot-1',
  })
  @IsNotEmpty({ message: 'slotId is required' })
  @IsString({ message: 'slotId must be a string' })
  slotId: string;

  @ApiProperty({
    description: 'Name of the customer booking the appointment',
    example: 'Zohra',
    minLength: 2,
    maxLength: 100,
  })
  @IsNotEmpty({ message: 'customerName is required' })
  @IsString({ message: 'customerName must be a string' })
  @MinLength(2, { message: 'customerName must be at least 2 characters long' })
  @MaxLength(100, { message: 'customerName cannot exceed 100 characters' })
  customerName: string;
}
