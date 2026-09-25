import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

export interface BookingCreatedPayload {
  bookingId: string;
  slotId: string;
  customerName: string;
  status: string;
  createdAt: Date;
}

export interface BookingCancelledPayload {
  bookingId: string;
  slotId: string;
  status: string;
  cancelledAt: Date;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  afterInit() {
    this.logger.log('Socket.IO Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  emitBookingCreated(payload: BookingCreatedPayload): void {
    if (this.server) {
      this.server.emit('booking.created', payload);
      this.logger.log(`Emitted booking.created: ${payload.bookingId}`);
    }
  }

  emitBookingCancelled(payload: BookingCancelledPayload): void {
    if (this.server) {
      this.server.emit('booking.cancelled', payload);
      this.logger.log(`Emitted booking.cancelled: ${payload.bookingId}`);
    }
  }
}
