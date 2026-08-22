import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { FacilityType, UserRole, WaitlistAvailability, WaitlistProfessionalRole } from "@medshift/shared-types";
import { WaitlistSignup } from "../database/schemas/waitlist-signup.schema";
import { NotificationService } from "./notification.service";

type JoinWaitlistPayload = {
  email: string;
  role: UserRole;
  workerDetails?: {
    fullName?: string;
    clinicalRole?: WaitlistProfessionalRole;
    phone?: string;
    city?: string;
    availability?: WaitlistAvailability;
  };
  facilityDetails?: {
    facilityName?: string;
    phone?: string;
    facilityType?: FacilityType;
    city?: string;
    province?: string;
  };
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
    const roleDetails =
      payload.role === UserRole.Worker
        ? {
            set: { workerDetails: cleanWorkerDetails(payload.workerDetails) },
            unset: { facilityDetails: "" }
          }
        : {
            set: { facilityDetails: cleanFacilityDetails(payload.facilityDetails) },
            unset: { workerDetails: "" }
          };

    const signup = await this.waitlistSignupModel.findOneAndUpdate(
      { email, role: payload.role },
      {
        $setOnInsert: { email, role: payload.role },
        $set: { lastRequestedAt: now, ...roleDetails.set },
        $unset: roleDetails.unset
      },
      { new: true, upsert: true }
    );

    const [delivery, contactSync] = await Promise.all([
      this.notificationService.sendWaitlistWelcome(email, payload.role),
      this.notificationService.syncWaitlistContact({
        email,
        role: payload.role,
        workerDetails: signup.workerDetails,
        facilityDetails: signup.facilityDetails
      })
    ]);

    if (!delivery.delivered) {
      return {
        joined: true,
        email,
        role: payload.role,
        contactSynced: contactSync.synced,
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
      workerDetails: signup.workerDetails,
      facilityDetails: signup.facilityDetails,
      contactSynced: contactSync.synced,
      emailDelivered: true
    };
  }
}

function cleanWorkerDetails(details: JoinWaitlistPayload["workerDetails"]) {
  return {
    fullName: cleanText(details?.fullName),
    clinicalRole: details?.clinicalRole,
    phone: cleanText(details?.phone),
    city: cleanText(details?.city),
    availability: details?.availability
  };
}

function cleanFacilityDetails(details: JoinWaitlistPayload["facilityDetails"]) {
  return {
    facilityName: cleanText(details?.facilityName),
    phone: cleanText(details?.phone),
    facilityType: details?.facilityType,
    city: cleanText(details?.city),
    province: cleanText(details?.province)
  };
}

function cleanText(value?: string) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : undefined;
}
