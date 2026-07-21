import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { UserRole } from "@medshift/shared-types";
import { AuthRequest } from "../auth/auth-request";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CreateWorkerProfileDto } from "./dto/create-worker-profile.dto";
import { UpdateWorkerProfileDto } from "./dto/update-worker-profile.dto";
import { WorkerProfilesService } from "./worker-profiles.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("worker-profiles")
export class WorkerProfilesController {
  constructor(private readonly workerProfilesService: WorkerProfilesService) {}

  @Roles(UserRole.Worker, UserRole.Admin)
  @Post()
  create(@Req() request: AuthRequest, @Body() dto: CreateWorkerProfileDto) {
    return this.workerProfilesService.create(request.user, dto);
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
