import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString } from 'class-validator';

export class GetSlotsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter available slots by date (YYYY-MM-DD)',
    example: '2026-10-01',
  })
  @IsOptional()
  @IsDateString({}, { message: 'date must be a valid ISO date string (YYYY-MM-DD)' })
  date?: string;
}
