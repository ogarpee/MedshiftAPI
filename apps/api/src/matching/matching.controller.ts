import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { UserRole } from "@medshift/shared-types";
import { AuthRequest } from "../auth/auth-request";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { BrowseOpenShiftsDto } from "./dto/browse-open-shifts.dto";
import { MatchingService } from "./matching.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("matching")
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Roles(UserRole.Worker)
  @Get("open-shifts")
  browseOpenShifts(@Req() request: AuthRequest, @Query() query: BrowseOpenShiftsDto) {
    return this.matchingService.browseOpenShifts(request.user, query);
  }
}
