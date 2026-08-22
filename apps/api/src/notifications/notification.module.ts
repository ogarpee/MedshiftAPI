import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { DatabaseSchemasModule } from "../database/database-schemas.module";
import { NotificationController } from "./notification.controller";
import { NotificationService } from "./notification.service";
import { NotificationsController } from "./notifications.controller";
import { WaitlistService } from "./waitlist.service";

@Module({
  imports: [
    DatabaseSchemasModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_SECRET"),
        signOptions: {
          expiresIn: "12h"
        }
      })
    })
  ],
  controllers: [NotificationController, NotificationsController],
  providers: [NotificationService, WaitlistService],
  exports: [NotificationService]
})
export class NotificationModule {}
