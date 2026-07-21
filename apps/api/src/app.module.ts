import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { validateConfig } from "./config/validate-config";
import { DatabaseSchemasModule } from "./database/database-schemas.module";
import { HealthController } from "./health/health.controller";
import { AuthModule } from "./auth/auth.module";
import { ProfilesModule } from "./profiles/profiles.module";
import { ShiftsModule } from "./shifts/shifts.module";

@Module({
  imports: [
    ConfigModule.forRoot({
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
    AuthModule,
    ProfilesModule,
    ShiftsModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
