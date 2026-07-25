import { Body, Controller, Get, Param, ParseIntPipe, Patch, UseGuards } from "@nestjs/common";
import { UserRole } from "@medshift/shared-types";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AdminService } from "./admin.service";
import { ReviewCredentialDto } from "./dto/review-credential.dto";
import { ReviewOnboardingDto } from "./dto/review-onboarding.dto";
import { UpdateShiftStatusDto } from "./dto/update-shift-status.dto";
import { UpdateUserStatusDto } from "./dto/update-user-status.dto";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin)
@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("overview")
  overview() {
    return this.adminService.overview();
  }

  @Get("users")
  users() {
    return this.adminService.usersList();
  }

  @Get("facilities")
  facilities() {
    return this.adminService.facilitiesList();
  }

  @Get("shifts")
  shifts() {
    return this.adminService.shiftsList();
  }

  @Get("verification-queue")
  verificationQueue() {
    return this.adminService.verificationQueue();
  }

  @Patch("users/:userId/status")
  updateUserStatus(@Param("userId") userId: string, @Body() dto: UpdateUserStatusDto) {
    return this.adminService.updateUserStatus(userId, dto.status);
  }

  @Patch("shifts/:shiftId/status")
  updateShiftStatus(@Param("shiftId") shiftId: string, @Body() dto: UpdateShiftStatusDto) {
    return this.adminService.updateShiftStatus(shiftId, dto.status);
  }

  @Patch("worker-profiles/:workerId/credentials/:credentialIndex")
  reviewCredential(
    @Param("workerId") workerId: string,
    @Param("credentialIndex", ParseIntPipe) credentialIndex: number,
    @Body() dto: ReviewCredentialDto
  ) {
    return this.adminService.reviewCredential(workerId, credentialIndex, dto.approved);
  }

  @Patch("worker-profiles/:workerId/onboarding")
  reviewWorkerOnboarding(@Param("workerId") workerId: string, @Body() dto: ReviewOnboardingDto) {
    return this.adminService.reviewWorkerOnboarding(workerId, dto);
  }

  @Patch("facility-profiles/:facilityId/onboarding")
  reviewFacilityOnboarding(@Param("facilityId") facilityId: string, @Body() dto: ReviewOnboardingDto) {
    return this.adminService.reviewFacilityOnboarding(facilityId, dto);
  }
}
