import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { UserRole } from "@medshift/shared-types";
import { AuthRequest } from "../auth/auth-request";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CreateFacilityProfileDto } from "./dto/create-facility-profile.dto";
import { UpdateFacilityProfileDto } from "./dto/update-facility-profile.dto";
import { FacilityProfilesService } from "./facility-profiles.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("facility-profiles")
export class FacilityProfilesController {
  constructor(private readonly facilityProfilesService: FacilityProfilesService) {}

  @Roles(UserRole.Facility, UserRole.Admin)
  @Post()
  create(@Req() request: AuthRequest, @Body() dto: CreateFacilityProfileDto) {
    return this.facilityProfilesService.create(request.user, dto);
  }

  @Roles(UserRole.Admin)
  @Get()
  findAll() {
    return this.facilityProfilesService.findAll();
  }

  @Roles(UserRole.Facility, UserRole.Admin)
  @Get("me")
  findMe(@Req() request: AuthRequest) {
    return this.facilityProfilesService.findMe(request.user);
  }

  @Roles(UserRole.Facility, UserRole.Admin)
  @Get(":id")
  findOne(@Req() request: AuthRequest, @Param("id") id: string) {
    return this.facilityProfilesService.findOne(request.user, id);
  }

  @Roles(UserRole.Facility, UserRole.Admin)
  @Patch(":id")
  update(@Req() request: AuthRequest, @Param("id") id: string, @Body() dto: UpdateFacilityProfileDto) {
    return this.facilityProfilesService.update(request.user, id, dto);
  }

  @Roles(UserRole.Facility, UserRole.Admin)
  @Delete(":id")
  remove(@Req() request: AuthRequest, @Param("id") id: string) {
    return this.facilityProfilesService.remove(request.user, id);
  }
}
