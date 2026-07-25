import { Module } from "@nestjs/common";
import { DatabaseSchemasModule } from "../database/database-schemas.module";
import { NotificationController } from "./notification.controller";
import { NotificationService } from "./notification.service";
import { WaitlistService } from "./waitlist.service";

@Module({
  imports: [DatabaseSchemasModule],
  controllers: [NotificationController],
  providers: [NotificationService, WaitlistService],
  exports: [NotificationService]
})
export class NotificationModule {}
