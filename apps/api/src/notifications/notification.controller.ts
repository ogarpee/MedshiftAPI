import { Body, Controller, Post } from "@nestjs/common";
import { WaitlistSignupDto } from "./dto/waitlist-signup.dto";
import { NotificationService } from "./notification.service";

@Controller("waitlist")
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post()
  async join(@Body() dto: WaitlistSignupDto) {
    await this.notificationService.sendWaitlistWelcome(dto.email.toLowerCase().trim(), dto.role);

    return { joined: true };
  }
}
