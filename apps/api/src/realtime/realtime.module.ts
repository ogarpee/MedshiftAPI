import { Module } from "@nestjs/common";
import { ShiftsGateway } from "./shifts.gateway";

@Module({
  providers: [ShiftsGateway],
  exports: [ShiftsGateway]
})
export class RealtimeModule {}
