import { Test, TestingModule } from '@nestjs/testing';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';

describe('BookingsService', () => {
  let service: BookingsService;
  let prisma: PrismaService;
  let realtimeGateway: RealtimeGateway;

  const mockSlot = {
    id: 'slot-1',
    startTime: new Date('2026-10-01T09:00:00.000Z'),
    endTime: new Date('2026-10-01T09:30:00.000Z'),
    createdAt: new Date(),
  };

  const mockBooking = {
    id: 'booking-1',
    slotId: 'slot-1',
    customerName: 'Zohra',
    status: BookingStatus.CONFIRMED,
    createdAt: new Date(),
    cancelledAt: null,
    slot: mockSlot,
  };

  const mockRealtimeGateway = {
    emitBookingCreated: jest.fn(),
    emitBookingCancelled: jest.fn(),
  };

  const mockPrismaService = {
    $transaction: jest.fn(),
    booking: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: RealtimeGateway,
          useValue: mockRealtimeGateway,
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    prisma = module.get<PrismaService>(PrismaService);
    realtimeGateway = module.get<RealtimeGateway>(RealtimeGateway);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createBooking', () => {
    it('should successfully create a booking when slot is available', async () => {
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([{ id: 'slot-1' }]),
          booking: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockBooking),
          },
        };
        return callback(tx);
      });

      const result = await service.createBooking({
        slotId: 'slot-1',
        customerName: 'Zohra',
      });

      expect(result).toEqual(mockBooking);
      expect(mockRealtimeGateway.emitBookingCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: mockBooking.id,
          slotId: mockBooking.slotId,
          customerName: 'Zohra',
          status: BookingStatus.CONFIRMED,
        }),
      );
    });

    it('should throw NotFoundException if slot does not exist', async () => {
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([]),
        };
        return callback(tx);
      });

      await expect(
        service.createBooking({
          slotId: 'non-existent-slot',
          customerName: 'Zohra',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if slot already has an active booking', async () => {
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([{ id: 'slot-1' }]),
          booking: {
            findFirst: jest.fn().mockResolvedValue(mockBooking),
          },
        };
        return callback(tx);
      });

      await expect(
        service.createBooking({
          slotId: 'slot-1',
          customerName: 'Alice',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should translate Prisma P2002 unique constraint violation into ConflictException', async () => {
      mockPrismaService.$transaction.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint violation', {
          code: 'P2002',
          clientVersion: '5.22.0',
        }),
      );

      await expect(
        service.createBooking({
          slotId: 'slot-1',
          customerName: 'Alice',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('cancelBooking', () => {
    it('should successfully cancel an active booking', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(mockBooking);
      const cancelled = {
        ...mockBooking,
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
      };
      mockPrismaService.booking.update.mockResolvedValue(cancelled);

      const result = await service.cancelBooking('booking-1');

      expect(result.message).toBe('Booking cancelled successfully');
      expect(result.booking.status).toBe(BookingStatus.CANCELLED);
      expect(mockRealtimeGateway.emitBookingCancelled).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: 'booking-1',
          slotId: 'slot-1',
          status: BookingStatus.CANCELLED,
        }),
      );
    });

    it('should throw NotFoundException if booking does not exist', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(null);

      await expect(service.cancelBooking('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if booking is already cancelled', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
      });

      await expect(service.cancelBooking('booking-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
