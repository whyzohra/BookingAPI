import { ApiProperty } from '@nestjs/swagger';

export class SlotResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the slot',
    example: 'slot-1',
  })
  id: string;

  @ApiProperty({
    description: 'Start time of the appointment slot in ISO 8601 format',
    example: '2026-10-01T09:00:00.000Z',
  })
  startTime: Date;

  @ApiProperty({
    description: 'End time of the appointment slot in ISO 8601 format',
    example: '2026-10-01T09:30:00.000Z',
  })
  endTime: Date;

  @ApiProperty({
    description: 'Timestamp when the slot was created',
    example: '2026-09-25T14:30:00.000Z',
  })
  createdAt: Date;
}
