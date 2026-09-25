import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { BookingStatus } from '@prisma/client';

describe('Appointment Booking API (E2E Integration & Concurrency Tests)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let socketClient: Socket;
  let serverPort: number;

  const testSlot1 = {
    id: 'test-slot-1',
    startTime: new Date('2026-10-01T09:00:00.000Z'),
    endTime: new Date('2026-10-01T09:30:00.000Z'),
  };

  const testSlot2 = {
    id: 'test-slot-2',
    startTime: new Date('2026-10-01T09:30:00.000Z'),
    endTime: new Date('2026-10-01T10:00:00.000Z'),
  };

  const testSlot3 = {
    id: 'test-slot-3',
    startTime: new Date('2026-10-02T10:00:00.000Z'),
    endTime: new Date('2026-10-02T10:30:00.000Z'),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Replicate global ValidationPipe as in main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        stopAtFirstError: false,
      }),
    );

    // Listen on random free port for WebSocket and HTTP testing
    await app.listen(0);
    const address = app.getHttpServer().address();
    serverPort = typeof address === 'string' ? 3000 : address.port;

    prisma = app.get<PrismaService>(PrismaService);

    // Clean up test slots and bookings
    await prisma.booking.deleteMany({
      where: {
        slotId: { in: [testSlot1.id, testSlot2.id, testSlot3.id] },
      },
    });
    await prisma.slot.deleteMany({
      where: {
        id: { in: [testSlot1.id, testSlot2.id, testSlot3.id] },
      },
    });

    // Seed test slots
    await prisma.slot.createMany({
      data: [testSlot1, testSlot2, testSlot3],
    });

    // Connect Socket.IO test client
    socketClient = io(`http://localhost:${serverPort}`, {
      transports: ['websocket'],
      autoConnect: true,
    });

    await new Promise<void>((resolve) => {
      socketClient.on('connect', () => {
        resolve();
      });
    });
  }, 30000);

  afterAll(async () => {
    if (socketClient && socketClient.connected) {
      socketClient.disconnect();
    }

    // Clean up test data
    if (prisma) {
      await prisma.booking.deleteMany({
        where: {
          slotId: { in: [testSlot1.id, testSlot2.id, testSlot3.id] },
        },
      });
      await prisma.slot.deleteMany({
        where: {
          id: { in: [testSlot1.id, testSlot2.id, testSlot3.id] },
        },
      });
    }

    await app.close();
  });

  describe('1. GET /slots - Availability and Filtering', () => {
    it('should return seeded available slots', async () => {
      const response = await request(app.getHttpServer())
        .get('/slots')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      const slotIds = response.body.map((s: any) => s.id);
      expect(slotIds).toContain(testSlot1.id);
      expect(slotIds).toContain(testSlot2.id);
      expect(slotIds).toContain(testSlot3.id);
    });

    it('should filter slots by date parameter', async () => {
      const response = await request(app.getHttpServer())
        .get('/slots?date=2026-10-02')
        .expect(200);

      const slotIds = response.body.map((s: any) => s.id);
      expect(slotIds).toContain(testSlot3.id);
      expect(slotIds).not.toContain(testSlot1.id);
      expect(slotIds).not.toContain(testSlot2.id);
    });

    it('should return 400 Bad Request for invalid date query parameter', async () => {
      await request(app.getHttpServer())
        .get('/slots?date=invalid-date')
        .expect(400);
    });
  });

  describe('2. POST /bookings - Input Validation', () => {
    it('should return 400 Bad Request when slotId is missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/bookings')
        .send({ customerName: 'Zohra' })
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('slotId is required')]),
      );
    });

    it('should return 400 Bad Request when customerName is missing or too short', async () => {
      const response = await request(app.getHttpServer())
        .post('/bookings')
        .send({ slotId: testSlot1.id, customerName: 'A' })
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining('customerName must be at least 2 characters long'),
        ]),
      );
    });

    it('should return 404 Not Found when booking a non-existent slot', async () => {
      const response = await request(app.getHttpServer())
        .post('/bookings')
        .send({ slotId: 'non-existent-slot-uuid', customerName: 'Zohra' })
        .expect(404);

      expect(response.body.message).toContain('not found');
    });
  });

  describe('3. POST /bookings - Single Successful Booking & Real-time Event', () => {
    it('should successfully book an available slot and emit booking.created event', async () => {
      const socketPromise = new Promise<any>((resolve) => {
        socketClient.once('booking.created', (data) => {
          resolve(data);
        });
      });

      const response = await request(app.getHttpServer())
        .post('/bookings')
        .send({ slotId: testSlot1.id, customerName: 'Zohra' })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.slotId).toBe(testSlot1.id);
      expect(response.body.customerName).toBe('Zohra');
      expect(response.body.status).toBe(BookingStatus.CONFIRMED);

      // Verify real-time Socket.IO event payload
      const eventPayload = await socketPromise;
      expect(eventPayload.bookingId).toBe(response.body.id);
      expect(eventPayload.slotId).toBe(testSlot1.id);
      expect(eventPayload.customerName).toBe('Zohra');
      expect(eventPayload.status).toBe('CONFIRMED');

      // Verify slot is now excluded from GET /slots
      const slotsResponse = await request(app.getHttpServer())
        .get('/slots')
        .expect(200);

      const slotIds = slotsResponse.body.map((s: any) => s.id);
      expect(slotIds).not.toContain(testSlot1.id);
    });

    it('should return 409 Conflict when attempting to book the same slot sequentially', async () => {
      const response = await request(app.getHttpServer())
        .post('/bookings')
        .send({ slotId: testSlot1.id, customerName: 'Second Booker' })
        .expect(409);

      expect(response.body.message).toContain('already booked');
    });
  });

  describe('4. CONCURRENCY TEST - Simultaneous Booking Attempts', () => {
    it('should handle two concurrent booking requests for the same slot with EXACTLY one 201 and one 409', async () => {
      // testSlot2 is currently available
      const concurrentRequest1 = request(app.getHttpServer())
        .post('/bookings')
        .send({ slotId: testSlot2.id, customerName: 'Concurrent User A' });

      const concurrentRequest2 = request(app.getHttpServer())
        .post('/bookings')
        .send({ slotId: testSlot2.id, customerName: 'Concurrent User B' });

      // Fire both requests concurrently using Promise.all
      const [res1, res2] = await Promise.all([
        concurrentRequest1,
        concurrentRequest2,
      ]);

      const statuses = [res1.status, res2.status].sort();

      // Exactly one must be 201 Created and exactly one must be 409 Conflict
      expect(statuses).toEqual([201, 409]);

      const successResponse = res1.status === 201 ? res1 : res2;
      const conflictResponse = res1.status === 409 ? res1 : res2;

      expect(successResponse.body.status).toBe(BookingStatus.CONFIRMED);
      expect(conflictResponse.body.message).toContain('already booked');

      // CRITICAL VERIFICATION: Check the database directly to ensure
      // exactly ONE active (CONFIRMED) booking exists for testSlot2
      const activeBookingsInDb = await prisma.booking.findMany({
        where: {
          slotId: testSlot2.id,
          status: BookingStatus.CONFIRMED,
        },
      });

      expect(activeBookingsInDb.length).toBe(1);
      expect(activeBookingsInDb[0].id).toBe(successResponse.body.id);
    });
  });

  describe('5. CANCELLATION FLOW - Cancel Booking, Verify Availability, and Rebook', () => {
    let bookingToCancelId: string;

    it('should book testSlot3 first', async () => {
      const response = await request(app.getHttpServer())
        .post('/bookings')
        .send({ slotId: testSlot3.id, customerName: 'Initial Booker' })
        .expect(201);

      bookingToCancelId = response.body.id;

      // Verify slot is NOT available
      const slotsResponse = await request(app.getHttpServer())
        .get('/slots')
        .expect(200);

      const slotIds = slotsResponse.body.map((s: any) => s.id);
      expect(slotIds).not.toContain(testSlot3.id);
    });

    it('should cancel the booking, set status to CANCELLED, and emit booking.cancelled event', async () => {
      const socketPromise = new Promise<any>((resolve) => {
        socketClient.once('booking.cancelled', (data) => {
          resolve(data);
        });
      });

      const response = await request(app.getHttpServer())
        .delete(`/bookings/${bookingToCancelId}`)
        .expect(200);

      expect(response.body.message).toBe('Booking cancelled successfully');
      expect(response.body.booking.status).toBe(BookingStatus.CANCELLED);
      expect(response.body.booking.cancelledAt).toBeDefined();

      // Verify real-time Socket.IO event payload
      const eventPayload = await socketPromise;
      expect(eventPayload.bookingId).toBe(bookingToCancelId);
      expect(eventPayload.slotId).toBe(testSlot3.id);
      expect(eventPayload.status).toBe(BookingStatus.CANCELLED);
      expect(eventPayload.cancelledAt).toBeDefined();
    });

    it('should verify testSlot3 is available again in GET /slots after cancellation', async () => {
      const slotsResponse = await request(app.getHttpServer())
        .get('/slots')
        .expect(200);

      const slotIds = slotsResponse.body.map((s: any) => s.id);
      expect(slotIds).toContain(testSlot3.id);
    });

    it('should allow booking the same cancelled slot again successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/bookings')
        .send({ slotId: testSlot3.id, customerName: 'Rebooker' })
        .expect(201);

      expect(response.body.slotId).toBe(testSlot3.id);
      expect(response.body.customerName).toBe('Rebooker');
      expect(response.body.status).toBe(BookingStatus.CONFIRMED);

      // Verify slot is now excluded again
      const slotsResponse = await request(app.getHttpServer())
        .get('/slots')
        .expect(200);

      const slotIds = slotsResponse.body.map((s: any) => s.id);
      expect(slotIds).not.toContain(testSlot3.id);
    });

    it('should return 409 Conflict when attempting to cancel an already-cancelled booking', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/bookings/${bookingToCancelId}`)
        .expect(409);

      expect(response.body.message).toContain('already been cancelled');
    });

    it('should return 404 Not Found when attempting to cancel a non-existent booking', async () => {
      const response = await request(app.getHttpServer())
        .delete('/bookings/non-existent-booking-id')
        .expect(404);

      expect(response.body.message).toContain('not found');
    });
  });
});
