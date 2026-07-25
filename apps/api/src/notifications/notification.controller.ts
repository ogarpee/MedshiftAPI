import { Body, Controller, Post } from "@nestjs/common";
import { WaitlistSignupDto } from "./dto/waitlist-signup.dto";
import { WaitlistService } from "./waitlist.service";

@Controller("waitlist")
export class NotificationController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Post()
  async join(@Body() dto: WaitlistSignupDto) {
    return this.waitlistService.join(dto);
  }
}
