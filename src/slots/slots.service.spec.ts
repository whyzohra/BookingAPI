import { Test, TestingModule } from '@nestjs/testing';
import { SlotsService } from './slots.service';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus } from '@prisma/client';

describe('SlotsService', () => {
  let service: SlotsService;
  let prisma: PrismaService;

  const mockSlots = [
    {
      id: 'slot-1',
      startTime: new Date('2026-10-01T09:00:00.000Z'),
      endTime: new Date('2026-10-01T09:30:00.000Z'),
      createdAt: new Date(),
    },
    {
      id: 'slot-2',
      startTime: new Date('2026-10-01T09:30:00.000Z'),
      endTime: new Date('2026-10-01T10:00:00.000Z'),
      createdAt: new Date(),
    },
  ];

  const mockPrismaService = {
    slot: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlotsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<SlotsService>(SlotsService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return available slots excluding those with CONFIRMED bookings', async () => {
    mockPrismaService.slot.findMany.mockResolvedValue(mockSlots);

    const result = await service.getAvailableSlots();

    expect(result).toEqual(mockSlots);
    expect(mockPrismaService.slot.findMany).toHaveBeenCalledWith({
      where: {
        bookings: {
          none: {
            status: BookingStatus.CONFIRMED,
          },
        },
      },
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
  });

  it('should apply date filter when date is provided', async () => {
    mockPrismaService.slot.findMany.mockResolvedValue([mockSlots[0]]);

    const result = await service.getAvailableSlots({ date: '2026-10-01' });

    expect(result).toHaveLength(1);
    expect(mockPrismaService.slot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          startTime: {
            gte: new Date('2026-10-01T00:00:00.000Z'),
            lte: new Date('2026-10-01T23:59:59.999Z'),
          },
        }),
      }),
    );
  });
});
