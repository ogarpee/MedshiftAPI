import { CanActivate, ExecutionContext, ForbiddenException, HttpException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AccountStatus, AuthTokenPayload } from "@medshift/shared-types";
import { Session, SessionDocument } from "../../database/schemas/session.schema";
import { User, UserDocument } from "../../database/schemas/user.schema";
import type { AuthRequest } from "../auth-request";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(Session.name) private readonly sessions: Model<SessionDocument>
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const bearerToken = this.extractBearerToken(request);
    const cookieToken = this.extractCookie(request, "medshift_access");
    const token = bearerToken ?? cookieToken;

    if (!token) {
      throw new UnauthorizedException("Missing bearer token");
    }

    try {
      const payload = await this.jwtService.verifyAsync<AuthTokenPayload>(token);
      if (!payload.sid) throw new UnauthorizedException("Session is missing");
      const [session, user] = await Promise.all([
        this.sessions.findById(payload.sid).lean().exec(),
        this.users.findById(payload.sub).lean().exec()
      ]);
      if (!session || session.revokedAt || session.refreshExpiresAt.getTime() <= Date.now() || session.userId.toString() !== payload.sub) {
        throw new UnauthorizedException("Session is no longer active");
      }
      if (!user || user.status === AccountStatus.Suspended || !user.emailVerified) {
        throw new UnauthorizedException("Account is unavailable");
      }
      if (user.passwordChangedAt && payload.iat && user.passwordChangedAt.getTime() >= payload.iat * 1000) {
        throw new UnauthorizedException("Session predates the latest password change");
      }
      request.user = { sub: payload.sub, sid: payload.sid, email: user.email, role: user.role, status: user.status };
      request.authSource = bearerToken ? "BEARER" : "COOKIE";
      if (request.authSource === "COOKIE" && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
        const csrfHeader = request.headers["x-csrf-token"];
        const csrfCookie = this.extractCookie(request, "medshift_csrf");
        const origin = request.headers.origin?.replace(/\/$/, "");
        const trustedOrigins = [this.config.get<string>("WEB_ORIGIN"), this.config.get<string>("ADMIN_ORIGIN")].filter(Boolean).map((value) => value!.replace(/\/$/, ""));
        const hasValidDoubleSubmit = typeof csrfHeader === "string" && Boolean(csrfCookie) && csrfHeader === csrfCookie;
        if (!hasValidDoubleSubmit && (!origin || !trustedOrigins.includes(origin))) {
          throw new ForbiddenException("CSRF token is missing or invalid");
        }
      }
      return true;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new UnauthorizedException("Invalid or expired token");
    }
  }

  private extractBearerToken(request: AuthRequest): string | undefined {
    const authorization = request.headers.authorization;

    if (!authorization) {
      return undefined;
    }

    const [scheme, token] = authorization.split(" ");

    return scheme === "Bearer" ? token : undefined;
  }

  private extractCookie(request: AuthRequest, name: string): string | undefined {
    const cookie = request.headers.cookie?.split(";").map((entry) => entry.trim()).find((entry) => entry.startsWith(`${name}=`));
    return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : undefined;
  }
}
