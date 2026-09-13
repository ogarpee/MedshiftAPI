import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseSchemasModule } from "../database/database-schemas.module";
import { ShiftsGateway } from "./shifts.gateway";

@Module({
  imports: [AuthModule, DatabaseSchemasModule],
  providers: [ShiftsGateway],
  exports: [ShiftsGateway]
})
export class RealtimeModule {}
