import { Controller, Get, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SlotsService } from './slots.service';
import { GetSlotsQueryDto } from './dto/get-slots-query.dto';
import { SlotResponseDto } from './dto/slot-response.dto';

@ApiTags('Slots')
@Controller('slots')
export class SlotsController {
  constructor(private readonly slotsService: SlotsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List available appointment slots',
    description:
      'Returns a list of slots that do not currently have an active (CONFIRMED) booking. Cancelled slots re-appear as available.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of available appointment slots retrieved successfully.',
    type: [SlotResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid query parameters provided.',
  })
  async getAvailableSlots(@Query() query: GetSlotsQueryDto): Promise<SlotResponseDto[]> {
    return this.slotsService.getAvailableSlots(query);
  }
}
