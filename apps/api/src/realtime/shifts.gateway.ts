import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectModel } from "@nestjs/mongoose";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import { AccountStatus, AuthTokenPayload, OnboardingStatus, UserRole } from "@medshift/shared-types";
import { Model, Types } from "mongoose";
import { Server, Socket } from "socket.io";
import { FacilityProfile, FacilityProfileDocument } from "../database/schemas/facility-profile.schema";
import { WorkerProfile, WorkerProfileDocument } from "../database/schemas/worker-profile.schema";
import { Session, SessionDocument } from "../database/schemas/session.schema";
import { User, UserDocument } from "../database/schemas/user.schema";

@WebSocketGateway({
  namespace: "/shifts",
  cors: {
    origin: true
  }
})
export class ShiftsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(ShiftsGateway.name);
  private readonly activeConnections = new Set<string>();

  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    @InjectModel(Session.name) private readonly sessions: Model<SessionDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(WorkerProfile.name) private readonly workerProfiles: Model<WorkerProfileDocument>,
    @InjectModel(FacilityProfile.name) private readonly facilityProfiles: Model<FacilityProfileDocument>
  ) {}

  async handleConnection(client: Socket) {
    if (!this.isOriginAllowed(client.handshake.headers.origin)) {
      this.logger.warn(`Rejected shift socket from origin ${client.handshake.headers.origin ?? "unknown"}`);
      client.disconnect(true);
      return;
    }

    const user = await this.authenticate(client);

    if (!user) {
      this.logger.warn(`Rejected unauthenticated shift socket: ${client.id}`);
      client.disconnect(true);
      return;
    }

    client.data.user = user;
    this.activeConnections.add(client.id);
    await this.joinAuthorizedRooms(client, user);
    this.logger.debug(`Shift socket connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.activeConnections.delete(client.id);
    this.logger.debug(`Shift socket disconnected: ${client.id}`);
  }

  @SubscribeMessage("join.worker")
  joinWorker(@ConnectedSocket() client: Socket) {
    return { joined: Boolean(client.data.workerProfileId) };
  }

  @SubscribeMessage("join.facility")
  joinFacility(@ConnectedSocket() client: Socket) {
    return { joined: Boolean(client.data.facilityProfileId) };
  }

  @SubscribeMessage("worker.status_update")
  updateWorkerStatus(@ConnectedSocket() client: Socket, @MessageBody() payload: { status: string }) {
    if (client.data.user?.role !== UserRole.Worker) {
      return { received: false };
    }

    client.broadcast.emit("worker.status_update", { socketId: client.id, status: payload.status });
    return { received: true };
  }

  emitShiftCreatedToWorkers(workerUserIds: string[], payload: unknown) {
    for (const workerUserId of workerUserIds) {
      this.server.to(`worker-user:${workerUserId}`).emit("shift.created", payload);
    }
  }

  emitShiftAccepted(facilityId: string, payload: unknown) {
    this.server.to(`facility:${facilityId}`).emit("shift.accepted", payload);
  }

  emitWorkerShiftAccepted(payload: unknown) {
    this.server.to("workers:approved").emit("shift.accepted", payload);
  }

  getActiveConnectionCount() {
    return this.activeConnections.size;
  }

  private async authenticate(client: Socket): Promise<AuthTokenPayload | null> {
    const token = this.extractToken(client);

    if (!token) {
      return null;
    }

    try {
      const payload = await this.jwtService.verifyAsync<AuthTokenPayload>(token);
      const [session, user] = await Promise.all([
        this.sessions.findById(payload.sid).lean().exec(),
        this.users.findById(payload.sub).lean().exec()
      ]);
      if (!session || session.revokedAt || session.refreshExpiresAt.getTime() <= Date.now()) return null;
      if (!user || !user.emailVerified || user.status === AccountStatus.Suspended) return null;
      return payload;
    } catch {
      return null;
    }
  }

  private extractToken(client: Socket) {
    const authToken = client.handshake.auth?.token;

    if (typeof authToken === "string" && authToken && authToken !== "cookie-session") {
      return authToken;
    }

    const accessCookie = client.handshake.headers.cookie?.split(";").map((entry) => entry.trim()).find((entry) => entry.startsWith("medshift_access="));
    if (accessCookie) return decodeURIComponent(accessCookie.slice("medshift_access=".length));

    const authorization = client.handshake.headers.authorization;

    if (typeof authorization !== "string") {
      return undefined;
    }

    const [scheme, token] = authorization.split(" ");

    return scheme === "Bearer" ? token : undefined;
  }

  private async joinAuthorizedRooms(client: Socket, user: AuthTokenPayload) {
    if (user.role === UserRole.Worker) {
      const worker = await this.workerProfiles.findOne({ userId: new Types.ObjectId(user.sub) }).exec();

      if (worker) {
        client.data.workerProfileId = worker.id;
        await client.join(`worker:${worker.id}`);
        await client.join(`worker-user:${user.sub}`);

        if (worker.onboarding?.verificationStatus === OnboardingStatus.Approved) {
          await client.join("workers:approved");
        }
      }
    }

    if (user.role === UserRole.Facility) {
      const facility = await this.facilityProfiles.findOne({ userId: new Types.ObjectId(user.sub) }).exec();

      if (facility) {
        client.data.facilityProfileId = facility.id;
        await client.join(`facility:${facility.id}`);
      }
    }
  }

  private isOriginAllowed(origin?: string) {
    if (!origin) {
      return true;
    }

    return this.allowedOrigins().includes(origin);
  }

  private allowedOrigins() {
    const configuredOrigins = this.config.get<string>("SOCKET_ORIGINS") ?? this.config.get<string>("WEB_ORIGIN") ?? "http://localhost:3000";
    const adminOrigin = this.config.get<string>("ADMIN_ORIGIN");

    return [...configuredOrigins.split(","), adminOrigin].filter((value): value is string => Boolean(value)).map((value) => value.trim().replace(/\/$/, ""));
  }
}
