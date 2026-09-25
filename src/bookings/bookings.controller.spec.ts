import { Test, TestingModule } from '@nestjs/testing';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingStatus } from '@prisma/client';

describe('BookingsController', () => {
  let controller: BookingsController;
  let service: BookingsService;

  const mockBooking = {
    id: 'booking-1',
    slotId: 'slot-1',
    customerName: 'Zohra',
    status: BookingStatus.CONFIRMED,
    createdAt: new Date(),
    cancelledAt: null,
  };

  const mockBookingsService = {
    createBooking: jest.fn(),
    cancelBooking: jest.fn(),
    findBookingById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [
        {
          provide: BookingsService,
          useValue: mockBookingsService,
        },
      ],
    }).compile();

    controller = module.get<BookingsController>(BookingsController);
    service = module.get<BookingsService>(BookingsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a booking', async () => {
    mockBookingsService.createBooking.mockResolvedValue(mockBooking);

    const dto = { slotId: 'slot-1', customerName: 'Zohra' };
    const result = await controller.createBooking(dto);

    expect(result).toEqual(mockBooking);
    expect(mockBookingsService.createBooking).toHaveBeenCalledWith(dto);
  });

  it('should cancel a booking', async () => {
    const cancelResponse = {
      message: 'Booking cancelled successfully',
      booking: {
        ...mockBooking,
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    };
    mockBookingsService.cancelBooking.mockResolvedValue(cancelResponse);

    const result = await controller.cancelBooking('booking-1');

    expect(result).toEqual(cancelResponse);
    expect(mockBookingsService.cancelBooking).toHaveBeenCalledWith('booking-1');
  });

  it('should get booking by ID', async () => {
    mockBookingsService.findBookingById.mockResolvedValue(mockBooking);

    const result = await controller.getBookingById('booking-1');

    expect(result).toEqual(mockBooking);
    expect(mockBookingsService.findBookingById).toHaveBeenCalledWith('booking-1');
  });
});
