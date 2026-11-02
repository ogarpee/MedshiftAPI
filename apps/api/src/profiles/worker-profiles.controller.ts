import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, UseGuards } from "@nestjs/common";
import { UserRole } from "@medshift/shared-types";
import { AuthRequest } from "../auth/auth-request";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CreateWorkerProfileDto } from "./dto/create-worker-profile.dto";
import { UpdateWorkerProfileDto } from "./dto/update-worker-profile.dto";
import { WorkerProfilesService } from "./worker-profiles.service";
import { SaveWorkerOnboardingDraftDto } from "./dto/save-worker-onboarding-draft.dto";
import { WorkerOnboardingDraftsService } from "./worker-onboarding-drafts.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("worker-profiles")
export class WorkerProfilesController {
  constructor(
    private readonly workerProfilesService: WorkerProfilesService,
    private readonly workerOnboardingDraftsService: WorkerOnboardingDraftsService
  ) {}

  @Roles(UserRole.Worker)
  @Post()
  create(@Req() request: AuthRequest, @Body() dto: CreateWorkerProfileDto) {
    return this.workerProfilesService.saveMine(request.user, dto);
  }

  @Roles(UserRole.Admin)
  @Get()
  findAll() {
    return this.workerProfilesService.findAll();
  }

  @Roles(UserRole.Worker, UserRole.Admin)
  @Get("me")
  findMe(@Req() request: AuthRequest) {
    return this.workerProfilesService.findMe(request.user);
  }

  @Roles(UserRole.Worker)
  @Get("onboarding-status")
  getOnboardingStatus(@Req() request: AuthRequest) {
    return this.workerProfilesService.getOnboardingStatus(request.user);
  }

  @Roles(UserRole.Worker)
  @Put("me")
  saveMe(@Req() request: AuthRequest, @Body() dto: CreateWorkerProfileDto) {
    return this.workerProfilesService.saveMine(request.user, dto);
  }

  @Roles(UserRole.Worker)
  @Get("onboarding-draft")
  getOnboardingDraft(@Req() request: AuthRequest) {
    return this.workerOnboardingDraftsService.findMine(request.user);
  }

  @Roles(UserRole.Worker)
  @Put("onboarding-draft")
  saveOnboardingDraft(@Req() request: AuthRequest, @Body() dto: SaveWorkerOnboardingDraftDto) {
    return this.workerOnboardingDraftsService.saveMine(request.user, dto);
  }

  @Roles(UserRole.Worker)
  @Delete("onboarding-draft")
  clearOnboardingDraft(@Req() request: AuthRequest) {
    return this.workerOnboardingDraftsService.clearMine(request.user);
  }

  @Roles(UserRole.Worker, UserRole.Admin)
  @Get(":id")
  findOne(@Req() request: AuthRequest, @Param("id") id: string) {
    return this.workerProfilesService.findOne(request.user, id);
  }

  @Roles(UserRole.Worker, UserRole.Admin)
  @Patch(":id")
  update(@Req() request: AuthRequest, @Param("id") id: string, @Body() dto: UpdateWorkerProfileDto) {
    return this.workerProfilesService.update(request.user, id, dto);
  }

  @Roles(UserRole.Worker, UserRole.Admin)
  @Delete(":id")
  remove(@Req() request: AuthRequest, @Param("id") id: string) {
    return this.workerProfilesService.remove(request.user, id);
  }
}
