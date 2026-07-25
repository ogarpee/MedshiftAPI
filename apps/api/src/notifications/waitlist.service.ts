import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { UserRole } from "@medshift/shared-types";
import { WaitlistSignup } from "../database/schemas/waitlist-signup.schema";
import { NotificationService } from "./notification.service";

type JoinWaitlistPayload = {
  email: string;
  role: UserRole;
};

@Injectable()
export class WaitlistService {
  constructor(
    @InjectModel(WaitlistSignup.name) private readonly waitlistSignupModel: Model<WaitlistSignup>,
    private readonly notificationService: NotificationService
  ) {}

  async join(payload: JoinWaitlistPayload) {
    const email = payload.email.toLowerCase().trim();
    const now = new Date();

    const signup = await this.waitlistSignupModel.findOneAndUpdate(
      { email, role: payload.role },
      {
        $setOnInsert: { email, role: payload.role },
        $set: { lastRequestedAt: now }
      },
      { new: true, upsert: true }
    );

    const delivery = await this.notificationService.sendWaitlistWelcome(email, payload.role);

    if (!delivery.delivered) {
      return {
        joined: true,
        email,
        role: payload.role,
        emailDelivered: false,
        code: "WAITLIST_EMAIL_NOT_SENT",
        message: "You're on the waitlist. We could not send the confirmation email yet."
      };
    }

    signup.confirmationEmailSentAt = now;
    await signup.save();

    return {
      joined: true,
      email,
      role: payload.role,
      emailDelivered: true
    };
  }
}
