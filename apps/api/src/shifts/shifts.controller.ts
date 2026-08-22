import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { UserRole } from "@medshift/shared-types";
import { AuthRequest } from "../auth/auth-request";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CreateShiftDto } from "./dto/create-shift.dto";
import { UpdateShiftDto } from "./dto/update-shift.dto";
import { ShiftsService } from "./shifts.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("shifts")
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Roles(UserRole.Facility, UserRole.Admin)
  @Post()
  create(@Req() request: AuthRequest, @Body() dto: CreateShiftDto) {
    return this.shiftsService.create(request.user, dto);
  }

  @Roles(UserRole.Worker)
  @Post(":id/accept")
  accept(@Req() request: AuthRequest, @Param("id") id: string) {
    return this.shiftsService.accept(request.user, id);
  }

  @Roles(UserRole.Facility, UserRole.Admin)
  @Get()
  findAll(@Req() request: AuthRequest) {
    return this.shiftsService.findAll(request.user);
  }

  @Roles(UserRole.Facility, UserRole.Admin)
  @Get("metrics")
  metrics(@Req() request: AuthRequest) {
    return this.shiftsService.metrics(request.user);
  }

  @Roles(UserRole.Worker)
  @Get("worker/me")
  findMineForWorker(@Req() request: AuthRequest) {
    return this.shiftsService.findMineForWorker(request.user);
  }

  @Roles(UserRole.Facility, UserRole.Admin)
  @Get(":id")
  findOne(@Req() request: AuthRequest, @Param("id") id: string) {
    return this.shiftsService.findOne(request.user, id);
  }

  @Roles(UserRole.Facility, UserRole.Admin)
  @Patch(":id")
  update(@Req() request: AuthRequest, @Param("id") id: string, @Body() dto: UpdateShiftDto) {
    return this.shiftsService.update(request.user, id, dto);
  }

  @Roles(UserRole.Facility, UserRole.Admin)
  @Delete(":id")
  remove(@Req() request: AuthRequest, @Param("id") id: string) {
    return this.shiftsService.remove(request.user, id);
  }
}
