import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseSchemasModule } from "../database/database-schemas.module";
import { MatchingController } from "./matching.controller";
import { MatchingService } from "./matching.service";

@Module({
  imports: [AuthModule, DatabaseSchemasModule],
  controllers: [MatchingController],
  providers: [MatchingService]
})
export class MatchingModule {}
