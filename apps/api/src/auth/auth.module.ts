import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { DatabaseSchemasModule } from "../database/database-schemas.module";
import { NotificationModule } from "../notifications/notification.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { PasswordService } from "./password.service";

@Module({
  imports: [
    DatabaseSchemasModule,
    NotificationModule,
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
  controllers: [AuthController],
  providers: [AuthService, PasswordService, JwtAuthGuard, RolesGuard],
  exports: [JwtModule, JwtAuthGuard, RolesGuard]
})
export class AuthModule {}
