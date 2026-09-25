import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus, Prisma } from '@prisma/client';
import { GetSlotsQueryDto } from './dto/get-slots-query.dto';

@Injectable()
export class SlotsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns all appointment slots that are currently available.
   * A slot is available if it has no active (CONFIRMED) booking.
   * Cancelled bookings do not block slot availability.
   */
  async getAvailableSlots(query?: GetSlotsQueryDto) {
    const where: Prisma.SlotWhereInput = {
      bookings: {
        none: {
          status: BookingStatus.CONFIRMED,
        },
      },
    };

    if (query?.date) {
      const startOfDay = new Date(`${query.date}T00:00:00.000Z`);
      const endOfDay = new Date(`${query.date}T23:59:59.999Z`);
      where.startTime = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    return this.prisma.slot.findMany({
      where,
      orderBy: {
        startTime: 'asc',
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        createdAt: true,
      },
    });
  }
}
