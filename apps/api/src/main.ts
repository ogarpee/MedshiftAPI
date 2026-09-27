import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

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
