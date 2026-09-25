import { Test, TestingModule } from '@nestjs/testing';
import { SlotsController } from './slots.controller';
import { SlotsService } from './slots.service';

describe('SlotsController', () => {
  let controller: SlotsController;
  let service: SlotsService;

  const mockSlots = [
    {
      id: 'slot-1',
      startTime: new Date('2026-10-01T09:00:00.000Z'),
      endTime: new Date('2026-10-01T09:30:00.000Z'),
      createdAt: new Date(),
    },
  ];

  const mockSlotsService = {
    getAvailableSlots: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SlotsController],
      providers: [
        {
          provide: SlotsService,
          useValue: mockSlotsService,
        },
      ],
    }).compile();

    controller = module.get<SlotsController>(SlotsController);
    service = module.get<SlotsService>(SlotsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return available slots', async () => {
    mockSlotsService.getAvailableSlots.mockResolvedValue(mockSlots);

    const result = await controller.getAvailableSlots({});
    expect(result).toEqual(mockSlots);
    expect(mockSlotsService.getAvailableSlots).toHaveBeenCalledWith({});
  });
});
