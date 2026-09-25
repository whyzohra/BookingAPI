import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingStatus, Prisma } from '@prisma/client';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  /**
   * Creates a new booking for an available appointment slot.
   *
   * Concurrency Protection Strategy:
   * 1. Uses an interactive Prisma database transaction.
   * 2. Executes `SELECT id FROM "Slot" WHERE id = $slotId FOR UPDATE` in PostgreSQL.
   *    This locks the target Slot row exclusively for the duration of the transaction.
   *    Any concurrent request attempting to book the same slot must wait.
   * 3. Checks if an active (CONFIRMED) booking already exists for the slot.
   * 4. If an active booking exists, immediately rolls back and throws HTTP 409 Conflict.
   * 5. If available, creates the new booking with status CONFIRMED.
   * 6. Database Defense-in-Depth: A PostgreSQL partial unique index
   *    ("unique_active_booking_per_slot") on Booking(slotId) WHERE status = 'CONFIRMED'
   *    guarantees at the database engine level that two active bookings can never coexist.
   *    Any P2002 unique constraint violation is caught and translated to HTTP 409 Conflict.
   * 7. Upon successful transaction commit, emits a `booking.created` Socket.IO event.
   */
  async createBooking(createBookingDto: CreateBookingDto) {
    const { slotId, customerName } = createBookingDto;

    try {
      const newBooking = await this.prisma.$transaction(
        async (tx) => {
          // 1. Lock the slot row in PostgreSQL to serialize concurrent booking attempts
          const lockedSlots: Array<{ id: string }> = await tx.$queryRaw`
            SELECT id FROM "Slot" WHERE id = ${slotId} FOR UPDATE
          `;

          if (!lockedSlots || lockedSlots.length === 0) {
            throw new NotFoundException(`Slot with ID '${slotId}' not found`);
          }

          // 2. Check for existing active booking on this slot
          const existingActiveBooking = await tx.booking.findFirst({
            where: {
              slotId,
              status: BookingStatus.CONFIRMED,
            },
          });

          if (existingActiveBooking) {
            throw new ConflictException(
              `Slot with ID '${slotId}' is already booked`,
            );
          }

          // 3. Create the active booking
          return await tx.booking.create({
            data: {
              slotId,
              customerName: customerName.trim(),
              status: BookingStatus.CONFIRMED,
            },
            include: {
              slot: true,
            },
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          timeout: 10000,
        },
      );

      // 4. Emit real-time Socket.IO event after successful transaction commit
      try {
        this.realtimeGateway.emitBookingCreated({
          bookingId: newBooking.id,
          slotId: newBooking.slotId,
          customerName: newBooking.customerName,
          status: newBooking.status,
          createdAt: newBooking.createdAt,
        });
      } catch (wsError) {
        this.logger.warn(`Failed to emit booking.created event: ${wsError.message}`);
      }

      return newBooking;
    } catch (error) {
      // If error is already an HTTP exception (e.g. NotFoundException, ConflictException), rethrow
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }

      // Handle PostgreSQL unique constraint violation (Prisma P2002) as double-booking conflict
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Slot with ID '${slotId}' is already booked`,
        );
      }

      this.logger.error(`Error creating booking: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to create booking');
    }
  }

  /**
   * Cancels an existing booking.
   *
   * Behavior:
   * 1. If booking does not exist: throws HTTP 404 Not Found.
   * 2. If booking is already cancelled: throws HTTP 409 Conflict with clear message.
   * 3. Updates status to CANCELLED and records cancelledAt timestamp.
   * 4. Makes the associated slot immediately available for future bookings.
   * 5. Emits `booking.cancelled` Socket.IO event.
   */
  async cancelBooking(id: string) {
    const existing = await this.prisma.booking.findUnique({
      where: { id },
      include: { slot: true },
    });

    if (!existing) {
      throw new NotFoundException(`Booking with ID '${id}' not found`);
    }

    if (existing.status === BookingStatus.CANCELLED) {
      throw new ConflictException(
        `Booking with ID '${id}' has already been cancelled`,
      );
    }

    const cancelledBooking = await this.prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
      },
      include: {
        slot: true,
      },
    });

    // Emit real-time Socket.IO event
    try {
      this.realtimeGateway.emitBookingCancelled({
        bookingId: cancelledBooking.id,
        slotId: cancelledBooking.slotId,
        status: cancelledBooking.status,
        cancelledAt: cancelledBooking.cancelledAt,
      });
    } catch (wsError) {
      this.logger.warn(`Failed to emit booking.cancelled event: ${wsError.message}`);
    }

    return {
      message: 'Booking cancelled successfully',
      booking: cancelledBooking,
    };
  }

  /**
   * Helper method to find a booking by ID (useful for tests/verification).
   */
  async findBookingById(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { slot: true },
    });
    if (!booking) {
      throw new NotFoundException(`Booking with ID '${id}' not found`);
    }
    return booking;
  }
}
