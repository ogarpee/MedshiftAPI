import { Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

type JoinPayload = {
  id?: string;
};

@WebSocketGateway({
  namespace: "/shifts",
  cors: {
    origin: "*"
  }
})
export class ShiftsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(ShiftsGateway.name);
  private readonly activeConnections = new Set<string>();

  handleConnection(client: Socket) {
    this.activeConnections.add(client.id);
    this.logger.debug(`Shift socket connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.activeConnections.delete(client.id);
    this.logger.debug(`Shift socket disconnected: ${client.id}`);
  }

  @SubscribeMessage("join.worker")
  joinWorker(@ConnectedSocket() client: Socket, @MessageBody() payload: JoinPayload) {
    if (payload.id) {
      void client.join(`worker:${payload.id}`);
    }

    void client.join("workers");

    return { joined: true };
  }

  @SubscribeMessage("join.facility")
  joinFacility(@ConnectedSocket() client: Socket, @MessageBody() payload: JoinPayload) {
    if (payload.id) {
      void client.join(`facility:${payload.id}`);
      return { joined: true };
    }

    return { joined: false };
  }

  @SubscribeMessage("worker.status_update")
  updateWorkerStatus(@ConnectedSocket() client: Socket, @MessageBody() payload: { status: string }) {
    client.broadcast.emit("worker.status_update", { socketId: client.id, status: payload.status });
    return { received: true };
  }

  emitShiftCreated(payload: unknown) {
    this.server.to("workers").emit("shift.created", payload);
  }

  emitShiftAccepted(facilityId: string, payload: unknown) {
    this.server.to(`facility:${facilityId}`).emit("shift.accepted", payload);
  }

  emitWorkerShiftAccepted(payload: unknown) {
    this.server.to("workers").emit("shift.accepted", payload);
  }

  getActiveConnectionCount() {
    return this.activeConnections.size;
  }
}
