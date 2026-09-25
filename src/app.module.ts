import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { SlotsModule } from './slots/slots.module';
import { BookingsModule } from './bookings/bookings.module';
import { RealtimeModule } from './realtime/realtime.module';

@Module({
  imports: [PrismaModule, RealtimeModule, SlotsModule, BookingsModule],
})
export class AppModule {}
