import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { UserRole } from "@medshift/shared-types";
import { AuthRequest } from "../auth/auth-request";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CreateReviewDto } from "./dto/create-review.dto";
import { ReviewsService } from "./reviews.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("reviews")
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Roles(UserRole.Worker, UserRole.Facility)
  @Post("shifts/:shiftId")
  create(@Req() request: AuthRequest, @Param("shiftId") shiftId: string, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(request.user, shiftId, dto);
  }

  @Roles(UserRole.Worker, UserRole.Facility, UserRole.Admin)
  @Get("shifts/:shiftId")
  findForShift(@Req() request: AuthRequest, @Param("shiftId") shiftId: string) {
    return this.reviewsService.findForShift(request.user, shiftId);
  }

  @Roles(UserRole.Worker, UserRole.Facility, UserRole.Admin)
  @Get("me")
  findMine(@Req() request: AuthRequest) {
    return this.reviewsService.findMine(request.user);
  }
}
