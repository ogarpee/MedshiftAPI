import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import { AuthRequest } from "../auth/auth-request";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UpdateNotificationPreferencesDto } from "./dto/update-notification-preferences.dto";
import { NotificationPreferencesService } from "./notification-preferences.service";

@UseGuards(JwtAuthGuard)
@Controller("notification-preferences/me")
export class NotificationPreferencesController {
  constructor(private readonly preferences: NotificationPreferencesService) {}
  @Get() get(@Req() request: AuthRequest) { return this.preferences.getForUser(request.user.sub); }
  @Put() update(@Req() request: AuthRequest, @Body() dto: UpdateNotificationPreferencesDto) { return this.preferences.updateForUser(request.user.sub, dto); }
}
