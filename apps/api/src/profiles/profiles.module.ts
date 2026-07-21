import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseSchemasModule } from "../database/database-schemas.module";
import { FacilityProfilesController } from "./facility-profiles.controller";
import { FacilityProfilesService } from "./facility-profiles.service";
import { WorkerProfilesController } from "./worker-profiles.controller";
import { WorkerProfilesService } from "./worker-profiles.service";

@Module({
  imports: [AuthModule, DatabaseSchemasModule],
  controllers: [WorkerProfilesController, FacilityProfilesController],
  providers: [WorkerProfilesService, FacilityProfilesService]
})
export class ProfilesModule {}
