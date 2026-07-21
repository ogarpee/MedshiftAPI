import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseSchemasModule } from "../database/database-schemas.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

@Module({
  imports: [AuthModule, DatabaseSchemasModule, RealtimeModule],
  controllers: [AdminController],
  providers: [AdminService]
})
export class AdminModule {}
