import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseSchemasModule } from "../database/database-schemas.module";
import { ReviewsController } from "./reviews.controller";
import { ReviewsService } from "./reviews.service";

@Module({
  imports: [AuthModule, DatabaseSchemasModule],
  controllers: [ReviewsController],
  providers: [ReviewsService]
})
export class ReviewsModule {}
