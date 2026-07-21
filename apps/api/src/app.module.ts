import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { validateConfig } from "./config/validate-config";
import { DatabaseSchemasModule } from "./database/database-schemas.module";
import { HealthController } from "./health/health.controller";
import { AdminModule } from "./admin/admin.module";
import { AuthModule } from "./auth/auth.module";
import { ProfilesModule } from "./profiles/profiles.module";
import { MatchingModule } from "./matching/matching.module";
import { NotificationModule } from "./notifications/notification.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { ReviewsModule } from "./reviews/reviews.module";
import { ShiftsModule } from "./shifts/shifts.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [".env", "../../.env", "../../../.env"],
      isGlobal: true,
      validate: validateConfig
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>("MONGODB_URI")
      })
    }),
    DatabaseSchemasModule,
    AdminModule,
    AuthModule,
    ProfilesModule,
    RealtimeModule,
    NotificationModule,
    MatchingModule,
    ReviewsModule,
    ShiftsModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
