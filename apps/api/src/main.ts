import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(securityHeaders);
  app.use(authRateLimiter());

  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      if (!origin || allowedOrigins(config).includes(normalizeOrigin(origin))) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true
    })
  );

  await app.listen(config.get<number>("PORT", 4000));
}

function securityHeaders(_request: Request, response: Response, next: NextFunction) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  next();
}

function authRateLimiter() {
  const attempts = new Map<string, { count: number; resetAt: number }>();
  const protectedPaths = new Set([
    "/auth/login",
    "/auth/register/start",
    "/auth/register/verify-otp",
    "/auth/resend-verification",
    "/auth/forgot-password",
    "/auth/forgot-password/verify-otp",
    "/waitlist"
  ]);
  return (request: Request, response: Response, next: NextFunction) => {
    if (request.method !== "POST" || !protectedPaths.has(request.path)) return next();
    const now = Date.now();
    const key = `${request.ip}:${request.path}`;
    const current = attempts.get(key);
    const entry = !current || current.resetAt <= now ? { count: 0, resetAt: now + 15 * 60 * 1000 } : current;
    entry.count += 1;
    attempts.set(key, entry);
    response.setHeader("RateLimit-Limit", "20");
    response.setHeader("RateLimit-Remaining", Math.max(0, 20 - entry.count).toString());
    if (entry.count > 20) {
      response.status(429).json({ code: "RATE_LIMITED", message: "Too many attempts. Try again later." });
      return;
    }
    next();
  };
}

void bootstrap();

function allowedOrigins(config: ConfigService) {
  const configuredOrigins = [
    config.get<string>("WEB_ORIGIN", "http://localhost:3000"),
    config.get<string>("ADMIN_ORIGIN", "http://localhost:3001"),
    config.get<string>("SOCKET_ORIGINS")
  ];

  return configuredOrigins
    .flatMap((value) => value?.split(",") ?? [])
    .map(normalizeOrigin)
    .filter((value, index, origins) => Boolean(value) && origins.indexOf(value) === index);
}

function normalizeOrigin(origin: string) {
  return origin.trim().replace(/\/$/, "");
}
