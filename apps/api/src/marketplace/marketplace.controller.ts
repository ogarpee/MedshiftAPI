import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { UserRole } from "@medshift/shared-types";
import { AuthRequest } from "../auth/auth-request";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import {
  AssignShiftDto,
  AttendanceEventDto,
  CreateDisputeDto,
  CreateShiftApplicationDto,
  CreateShiftInvitationDto,
  CreateTimesheetDto,
  UpdateDisputeDto,
  UpdateShiftApplicationStatusDto,
  UpdateShiftInvitationStatusDto,
  UpdateTimesheetDto,
  attendanceEventDtoToType
} from "./dto/marketplace.dto";
import { MarketplaceService } from "./marketplace.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Roles(UserRole.Facility, UserRole.Admin)
  @Get("shifts/:id/matches")
  getMatches(@Req() request: AuthRequest, @Param("id") id: string) {
    return this.marketplaceService.getMatches(request.user, id);
  }

  @Roles(UserRole.Worker, UserRole.Facility, UserRole.Admin)
  @Get("shifts/:id/applications")
  listApplications(@Req() request: AuthRequest, @Param("id") id: string) {
    return this.marketplaceService.listApplications(request.user, id);
  }

  @Roles(UserRole.Worker, UserRole.Admin)
  @Get("applications/me")
  listMyApplications(@Req() request: AuthRequest) {
    return this.marketplaceService.listMyApplications(request.user);
  }

  @Roles(UserRole.Worker)
  @Post("shifts/:id/applications")
  applyToShift(@Req() request: AuthRequest, @Param("id") id: string, @Body() dto: CreateShiftApplicationDto) {
    return this.marketplaceService.applyToShift(request.user, id, dto);
  }

  @Roles(UserRole.Facility, UserRole.Admin)
  @Patch("applications/:id/status")
  updateApplicationStatus(@Req() request: AuthRequest, @Param("id") id: string, @Body() dto: UpdateShiftApplicationStatusDto) {
    return this.marketplaceService.updateApplicationStatus(request.user, id, dto);
  }

  @Roles(UserRole.Worker, UserRole.Facility, UserRole.Admin)
  @Get("shifts/:id/invitations")
  listInvitations(@Req() request: AuthRequest, @Param("id") id: string) {
    return this.marketplaceService.listInvitations(request.user, id);
  }

  @Roles(UserRole.Worker, UserRole.Admin)
  @Get("invitations/me")
  listMyInvitations(@Req() request: AuthRequest) {
    return this.marketplaceService.listMyInvitations(request.user);
  }

  @Roles(UserRole.Facility, UserRole.Admin)
  @Post("shifts/:id/invitations")
  inviteWorker(@Req() request: AuthRequest, @Param("id") id: string, @Body() dto: CreateShiftInvitationDto) {
    return this.marketplaceService.inviteWorker(request.user, id, dto);
  }

  @Roles(UserRole.Worker, UserRole.Facility, UserRole.Admin)
  @Patch("invitations/:id/status")
  updateInvitationStatus(@Req() request: AuthRequest, @Param("id") id: string, @Body() dto: UpdateShiftInvitationStatusDto) {
    return this.marketplaceService.updateInvitationStatus(request.user, id, dto);
  }

  @Roles(UserRole.Facility, UserRole.Admin)
  @Post("shifts/:id/assign")
  assignWorker(@Req() request: AuthRequest, @Param("id") id: string, @Body() dto: AssignShiftDto) {
    return this.marketplaceService.assignWorker(request.user, id, dto);
  }

  @Roles(UserRole.Worker, UserRole.Facility, UserRole.Admin)
  @Get("assignments/me")
  listAssignments(@Req() request: AuthRequest) {
    return this.marketplaceService.listAssignments(request.user);
  }

  @Roles(UserRole.Worker, UserRole.Facility, UserRole.Admin)
  @Get("attendance")
  listAttendance(@Req() request: AuthRequest) {
    return this.marketplaceService.listAttendance(request.user);
  }

  @Roles(UserRole.Worker)
  @Post("attendance/clock-in")
  clockIn(@Req() request: AuthRequest, @Body() dto: AttendanceEventDto) {
    return this.marketplaceService.recordAttendance(request.user, attendanceEventDtoToType("clock-in"), dto);
  }

  @Roles(UserRole.Worker)
  @Post("attendance/break/start")
  startBreak(@Req() request: AuthRequest, @Body() dto: AttendanceEventDto) {
    return this.marketplaceService.recordAttendance(request.user, attendanceEventDtoToType("break/start"), dto);
  }

  @Roles(UserRole.Worker)
  @Post("attendance/break/end")
  endBreak(@Req() request: AuthRequest, @Body() dto: AttendanceEventDto) {
    return this.marketplaceService.recordAttendance(request.user, attendanceEventDtoToType("break/end"), dto);
  }

  @Roles(UserRole.Worker)
  @Post("attendance/clock-out")
  clockOut(@Req() request: AuthRequest, @Body() dto: AttendanceEventDto) {
    return this.marketplaceService.recordAttendance(request.user, attendanceEventDtoToType("clock-out"), dto);
  }

  @Roles(UserRole.Worker, UserRole.Facility, UserRole.Admin)
  @Get("timesheets")
  listTimesheets(@Req() request: AuthRequest) {
    return this.marketplaceService.listTimesheets(request.user);
  }

  @Roles(UserRole.Worker)
  @Post("timesheets")
  createTimesheet(@Req() request: AuthRequest, @Body() dto: CreateTimesheetDto) {
    return this.marketplaceService.createTimesheet(request.user, dto);
  }

  @Roles(UserRole.Facility, UserRole.Admin)
  @Patch("timesheets/:id")
  updateTimesheet(@Req() request: AuthRequest, @Param("id") id: string, @Body() dto: UpdateTimesheetDto) {
    return this.marketplaceService.updateTimesheet(request.user, id, dto);
  }

  @Roles(UserRole.Worker, UserRole.Facility, UserRole.Admin)
  @Get("disputes")
  listDisputes(@Req() request: AuthRequest) {
    return this.marketplaceService.listDisputes(request.user);
  }

  @Roles(UserRole.Worker, UserRole.Facility, UserRole.Admin)
  @Post("disputes")
  createDispute(@Req() request: AuthRequest, @Body() dto: CreateDisputeDto) {
    return this.marketplaceService.createDispute(request.user, dto);
  }

  @Roles(UserRole.Worker, UserRole.Facility, UserRole.Admin)
  @Patch("disputes/:id")
  updateDispute(@Req() request: AuthRequest, @Param("id") id: string, @Body() dto: UpdateDisputeDto) {
    return this.marketplaceService.updateDispute(request.user, id, dto);
  }

  @Roles(UserRole.Admin)
  @Get("audit-events")
  listAuditEvents() {
    return this.marketplaceService.listAuditEvents();
  }

  @Roles(UserRole.Admin)
  @Get("audit-logs")
  listAuditLogs() {
    return this.marketplaceService.listAuditEvents();
  }

  @Roles(UserRole.Facility, UserRole.Admin)
  @Get("marketplace/overview")
  getMarketplaceOverview(@Req() request: AuthRequest) {
    return this.marketplaceService.getMarketplaceOverview(request.user);
  }
}
