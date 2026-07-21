import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseSchemasModule } from "../database/database-schemas.module";
import { NotificationModule } from "../notifications/notification.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { ShiftsController } from "./shifts.controller";
import { ShiftsService } from "./shifts.service";

@Module({
  imports: [AuthModule, DatabaseSchemasModule, NotificationModule, RealtimeModule],
  controllers: [ShiftsController],
  providers: [ShiftsService]
})
export class ShiftsModule {}
