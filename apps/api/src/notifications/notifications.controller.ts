import { Controller, Get, Param, Patch, Query, Req, UseGuards } from "@nestjs/common";
import { AuthRequest } from "../auth/auth-request";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { NotificationService } from "./notification.service";

@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  list(@Req() request: AuthRequest, @Query("limit") limit?: string) {
    return this.notificationService.listForUser(request.user.sub, Number(limit ?? 20));
  }

  @Patch(":id/read")
  markRead(@Req() request: AuthRequest, @Param("id") id: string) {
    return this.notificationService.markRead(request.user.sub, id);
  }

  @Patch("read-all")
  markAllRead(@Req() request: AuthRequest) {
    return this.notificationService.markAllRead(request.user.sub);
  }
}
