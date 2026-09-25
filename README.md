# Appointment Booking API

A robust, production-quality REST API for fixed-slot appointment bookings built with **TypeScript**, **NestJS**, **PostgreSQL**, **Prisma ORM**, **Socket.IO**, and **Swagger/OpenAPI**.

The system features real-time updates and an ironclad concurrency control strategy that prevents double-booking when simultaneous requests attempt to reserve the same slot.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Requirements](#requirements)
- [Environment Variables](#environment-variables)
- [Installation](#installation)
- [Database Setup](#database-setup)
- [Migrations](#migrations)
- [Seed](#seed)
- [Running the Application](#running-the-application)
- [Swagger / OpenAPI Documentation](#swagger--openapi-documentation)
- [API Endpoints](#api-endpoints)
- [Testing](#testing)
- [Concurrency / Double Booking Prevention](#concurrency--double-booking-prevention)
- [Socket.IO Events](#socketio-events)
- [Design Decisions](#design-decisions)
- [Potential Improvements](#potential-improvements)
- [AI Use Disclosure](#ai-use-disclosure)

---

## Overview

This API manages fixed-duration appointment slots and bookings:
1. **Slot Discovery**: Clients query available slots. Booked slots are excluded.
2. **Atomic Booking**: Clients book available slots with full concurrency protection.
3. **Cancellation & Re-availability**: Cancelling a booking immediately frees the slot so it can be booked again.
4. **Real-time Notifications**: Socket.IO broadcasts `booking.created` and `booking.cancelled` events to connected clients.
5. **Strict Input Validation**: Validates all incoming payloads using DTOs, `class-validator`, and NestJS `ValidationPipe`.
6. **OpenAPI / Swagger**: Interactive API docs available at `/api/docs`.

---

## Tech Stack

- **Framework**: [NestJS](https://nestjs.com/) (Node.js framework)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **ORM**: [Prisma ORM](https://www.prisma.io/)
- **Real-time WebSockets**: [Socket.IO](https://socket.io/) (`@nestjs/websockets`, `@nestjs/platform-socket.io`)
- **API Documentation**: [Swagger / OpenAPI](https://swagger.io/) (`@nestjs/swagger`, `swagger-ui-express`)
- **Validation**: `class-validator` & `class-transformer`
- **Testing**: [Jest](https://jestjs.io/) & [Supertest](https://github.com/ladjs/supertest)

---

## Requirements

- **Node.js**: v18.x or higher (tested on Node v24.x)
- **npm**: v9.x or higher
- **PostgreSQL**: v14.x or higher (or use the built-in zero-config database script via `npm run db:start`)

---

## Environment Variables

Copy the provided `.env.example` to `.env`:

```bash
cp .env.example .env
```

### Configuration (`.env`)

| Variable | Description | Default Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/appointment_booking?schema=public` |
| `PORT` | HTTP port for the NestJS server | `3000` |

> **Security Note:** Real database credentials and secret keys must never be committed to source control. `.env` is ignored in `.gitignore`.

---

## Installation

Install all project dependencies:

```bash
npm install
```

---

## Database Setup

You can use either an existing PostgreSQL server or the bundled zero-config local database manager.

### Option A: Using the Bundled Local Database (Recommended for quick evaluation)
```bash
npm run db:start
```
*This starts a local PostgreSQL 18 server on port 5432 in `.pg-data`.*

### Option B: Using an Existing PostgreSQL Instance
Ensure your PostgreSQL instance is running and update `DATABASE_URL` in `.env`:
```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/appointment_booking?schema=public"
```

---

## Migrations

Generate the Prisma client and apply database migrations:

```bash
# Generate Prisma Client
npm run prisma:generate

# Apply migrations to database
npm run prisma:migrate
```

The migration automatically creates:
- The `Slot` and `Booking` tables.
- Foreign key constraints with cascading deletes.
- The PostgreSQL partial unique index:
  ```sql
  CREATE UNIQUE INDEX "unique_active_booking_per_slot"
  ON "Booking"("slotId")
  WHERE "status" = 'CONFIRMED';
  ```

---

## Seed

Seed the database with fixed appointment slots:

```bash
npm run prisma:seed
```

This seeds 8 realistic, deterministic 30-minute appointment slots (e.g., `09:00–09:30`, `09:30–10:00`, `10:00–10:30`, etc.). The script is idempotent and can be safely re-run.

---

## Running the Application

### Development Mode (with hot-reload)
```bash
npm run start:dev
```

### Production Build & Run
```bash
npm run build
npm run start:prod
```

The API will be available at:
`http://localhost:3000`

---

## Swagger / OpenAPI Documentation

Interactive Swagger documentation is served directly by the application:

- **Swagger UI**: [http://localhost:3000/api/docs](http://localhost:3000/api/docs)
- **JSON OpenAPI Specification**: [http://localhost:3000/api/docs-json](http://localhost:3000/api/docs-json)

All endpoints, request DTOs, response schemas, and possible HTTP status codes (`200`, `201`, `400`, `404`, `409`) are fully documented with realistic examples.

---

## API Endpoints

### 1. `GET /slots`
Retrieves currently available appointment slots. Slots with an active (`CONFIRMED`) booking are excluded. When a booking is cancelled, its slot automatically re-appears as available.

- **Query Parameters**:
  - `date` *(optional)*: Filter slots by date (`YYYY-MM-DD`). Example: `GET /slots?date=2026-10-01`
- **Response**: `200 OK`
  ```json
  [
    {
      "id": "slot-1",
      "startTime": "2026-10-01T09:00:00.000Z",
      "endTime": "2026-10-01T09:30:00.000Z",
      "createdAt": "2026-09-25T14:30:00.000Z"
    }
  ]
  ```

---

### 2. `POST /bookings`
Books an appointment slot.

- **Request Body**:
  ```json
  {
    "slotId": "slot-1",
    "customerName": "Zohra"
  }
  ```
- **Validation**:
  - `slotId`: Required, string, non-empty.
  - `customerName`: Required, string, between 2 and 100 characters.
- **Responses**:
  - `201 Created`: Booking successfully created.
    ```json
    {
      "id": "b3e0c0fa-236b-4e12-b138-040dcfca9d19",
      "slotId": "slot-1",
      "customerName": "Zohra",
      "status": "CONFIRMED",
      "createdAt": "2026-09-25T14:35:00.000Z",
      "cancelledAt": null,
      "slot": {
        "id": "slot-1",
        "startTime": "2026-10-01T09:00:00.000Z",
        "endTime": "2026-10-01T09:30:00.000Z",
        "createdAt": "2026-09-25T14:30:00.000Z"
      }
    }
    ```
  - `400 Bad Request`: Input validation failed.
  - `404 Not Found`: Target slot does not exist.
  - `409 Conflict`: Slot is already booked or concurrent booking conflict occurred.

---

### 3. `DELETE /bookings/:id`
Cancels an active booking, setting its status to `CANCELLED` and recording `cancelledAt`. The associated slot becomes immediately available for new bookings.

- **Responses**:
  - `200 OK`: Booking successfully cancelled.
    ```json
    {
      "message": "Booking cancelled successfully",
      "booking": {
        "id": "b3e0c0fa-236b-4e12-b138-040dcfca9d19",
        "slotId": "slot-1",
        "customerName": "Zohra",
        "status": "CANCELLED",
        "createdAt": "2026-09-25T14:35:00.000Z",
        "cancelledAt": "2026-09-25T14:40:00.000Z"
      }
    }
    ```
  - `404 Not Found`: Booking with given ID not found.
  - `409 Conflict`: Booking is already cancelled.

---

### 4. `GET /bookings/:id`
Retrieves information for a specific booking.

- **Responses**:
  - `200 OK`: Booking details retrieved.
  - `404 Not Found`: Booking not found.

---

## Testing

The project includes unit tests for all controllers and services, as well as an end-to-end (E2E) integration test suite verifying real database transactions, actual concurrent requests, and WebSocket event emissions.

### Run All Tests
```bash
npm test
```

### Run Only Unit Tests
```bash
npm run test:unit
```

### Run Only E2E & Concurrency Tests
```bash
npm run test:e2e
```

### Test Coverage Summary
- **17 Unit Tests**: Validate isolated service and controller logic, mock database errors, handle edge cases.
- **15 E2E & Concurrency Tests**:
  - Availability query and date filtering.
  - 400 Bad Request on invalid DTO inputs and malformed dates.
  - 404 Not Found on non-existent slots and bookings.
  - **Real Concurrency Test**: Fires simultaneous `Promise.all([req1, req2])` against the same slot. Verifies **exactly one 201 Created**, **exactly one 409 Conflict**, and queries PostgreSQL to verify that **exactly one active record exists**.
  - **Full Cancellation Lifecycle**: Book slot -> verify unavailable -> cancel booking -> verify available again -> rebook same slot -> cancel already-cancelled booking (409 Conflict).
  - **Socket.IO Event Verification**: Connects a real WebSocket client and confirms receipt of `booking.created` and `booking.cancelled` payloads.

---

## Concurrency / Double Booking Prevention

### 1. Why Check-Then-Insert is Unsafe
A naive implementation follows this sequence:
```
1. SELECT * FROM "Booking" WHERE slotId = :id AND status = 'CONFIRMED';
2. If none found:
3.   INSERT INTO "Booking" (slotId, status) VALUES (:id, 'CONFIRMED');
```
Under concurrent load, two incoming requests (Request A and Request B) can both execute Step 1 simultaneously before either has executed Step 3. Both see zero active bookings, both conclude the slot is available, and both execute `INSERT`. This results in a catastrophic double-booking bug.

### 2. Our Two-Tier Concurrency Strategy

We implement a **two-tier defense-in-depth architecture**:

```
[Incoming Concurrent Requests A & B]
                │
                ▼
┌───────────────────────────────────────────────┐
│ Tier 1: Pessimistic Row Lock (Serialization)  │
│ SELECT id FROM "Slot" WHERE id = $id          │
│ FOR UPDATE                                    │
└───────────────────────────────────────────────┘
                │
       Request A acquires lock first.
       Request B blocks until Request A finishes.
                │
                ▼
┌───────────────────────────────────────────────┐
│ Tier 2: PostgreSQL Partial Unique Index        │
│ CREATE UNIQUE INDEX                           │
│ "unique_active_booking_per_slot"              │
│ ON "Booking"("slotId")                        │
│ WHERE "status" = 'CONFIRMED';                 │
└───────────────────────────────────────────────┘
```

#### Tier 1: Pessimistic Row Locking (`SELECT ... FOR UPDATE`)
Inside an interactive Prisma transaction (`this.prisma.$transaction`):
1. The transaction executes:
   ```sql
   SELECT id FROM "Slot" WHERE id = $slotId FOR UPDATE;
   ```
2. In PostgreSQL, this locks the target `Slot` row for exclusive write access for the duration of the transaction.
3. If Request A and Request B arrive simultaneously for the same slot, PostgreSQL grants the lock to Request A and forces Request B to wait.
4. Request A checks availability (finds none), creates the `CONFIRMED` booking, and commits the transaction, releasing the lock.
5. Request B now unblocks and executes its availability check. Because Request A's booking was already committed, Request B sees the active booking and throws `ConflictException('Slot is already booked')` (HTTP 409).

#### Tier 2: PostgreSQL Engine-Level Partial Unique Index
As a database-level safety net:
```sql
CREATE UNIQUE INDEX "unique_active_booking_per_slot"
ON "Booking"("slotId")
WHERE "status" = 'CONFIRMED';
```
Even if locking were somehow bypassed or degraded, the PostgreSQL storage engine strictly forbids two rows from having the same `slotId` when `status = 'CONFIRMED'`. If a race condition attempted to insert a second active booking, PostgreSQL rejects it immediately with a unique constraint violation (Prisma error `P2002`). Our service catches `P2002` and converts it to a standard HTTP 409 Conflict.

#### Why Cancellation Allows Rebooking
The partial unique index only applies where `status = 'CONFIRMED'`. When a booking is cancelled:
- Its status changes to `CANCELLED`.
- It is immediately excluded from the index.
- Future bookings for that slot can be confirmed without violating the unique constraint.

---

## Socket.IO Events

The application provides real-time notifications over WebSockets using Socket.IO on the same HTTP port.

### Connection
Clients connect to:
`ws://localhost:3000` (or `http://localhost:3000` via Socket.IO client)

### Emitted Events

#### 1. `booking.created`
Emitted immediately after a booking transaction successfully commits.

**Payload:**
```json
{
  "bookingId": "b3e0c0fa-236b-4e12-b138-040dcfca9d19",
  "slotId": "slot-1",
  "customerName": "Zohra",
  "status": "CONFIRMED",
  "createdAt": "2026-09-25T14:35:00.000Z"
}
```

#### 2. `booking.cancelled`
Emitted immediately after a booking cancellation is committed.

**Payload:**
```json
{
  "bookingId": "b3e0c0fa-236b-4e12-b138-040dcfca9d19",
  "slotId": "slot-1",
  "status": "CANCELLED",
  "cancelledAt": "2026-09-25T14:40:00.000Z"
}
```

---

## Design Decisions

1. **NestJS Modular Architecture**: The application is divided into cohesive, single-responsibility modules: `SlotsModule`, `BookingsModule`, `RealtimeModule`, and `PrismaModule`.
2. **Partial Unique Index over Boolean Flags**: Instead of adding mutable flags like `isBooked` to the `Slot` table (which introduces synchronization anomalies), we maintain slot state through the `Booking` relationship and a PostgreSQL partial unique index.
3. **Pessimistic Locking + Partial Index (Defense in Depth)**: Row locks provide clean, serializable execution and avoid unnecessary database exception spikes, while the partial index guarantees engine-level consistency even across multiple instances.
4. **Validation Pipes & DTOs**: Client input is never trusted. All payloads are stripped of unknown properties and strongly validated before reaching service logic.
5. **Clear Error Semantics**:
   - `400`: Malformed requests, missing fields, or validation failures.
   - `404`: Non-existent slots or bookings.
   - `409`: Concurrency conflicts, double-booking attempts, or attempting to cancel an already-cancelled booking.

---

## Potential Improvements

For a large-scale enterprise deployment, the following enhancements could be considered:
1. **User Authentication & Authorization**: Introduce JWT-based auth (e.g. Passport.js) so users can only view or cancel their own bookings.
2. **Dynamic Slot Generation**: Allow administrators to configure recurring weekly availability schedules and generate slots dynamically.
3. **Rate Limiting**: Apply `@nestjs/throttler` to protect booking endpoints from brute-force bot abuse.
4. **Distributed Cache / Message Broker**: If scaled horizontally to dozens of nodes, use Redis pub/sub with the `@socket.io/redis-adapter` for multi-instance WebSocket synchronization.

---

## AI Use Disclosure

AI tools were used during development for code scaffolding, implementation assistance, documentation assistance, and reviewing implementation approaches. The generated code was reviewed, tested, and understood by the author, and the final implementation was verified by running the application and test suite.
