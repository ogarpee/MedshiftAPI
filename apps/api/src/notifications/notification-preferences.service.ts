import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { NotificationCategory, NotificationPreferences, NotificationType } from "@medshift/shared-types";
import { NotificationPreference, NotificationPreferenceDocument } from "../database/schemas/notification-preference.schema";
import { UpdateNotificationPreferencesDto } from "./dto/update-notification-preferences.dto";

export const defaultNotificationPreferences: NotificationPreferences = {
  [NotificationCategory.ShiftOpportunities]: { inApp: true, email: true },
  [NotificationCategory.ShiftUpdates]: { inApp: true, email: true },
  [NotificationCategory.ScheduleAndTimesheets]: { inApp: true, email: true },
  [NotificationCategory.ReviewsAndDisputes]: { inApp: true, email: true },
  [NotificationCategory.AccountAndSecurity]: { inApp: true, email: true }
};

const categoryForType: Record<NotificationType, NotificationCategory> = {
  [NotificationType.ShiftCreated]: NotificationCategory.ShiftOpportunities,
  [NotificationType.ShiftAccepted]: NotificationCategory.ShiftUpdates,
  [NotificationType.MarketplaceApplication]: NotificationCategory.ShiftUpdates,
  [NotificationType.MarketplaceInvitation]: NotificationCategory.ShiftUpdates,
  [NotificationType.MarketplaceAssignment]: NotificationCategory.ShiftUpdates,
  [NotificationType.MarketplaceAttendance]: NotificationCategory.ScheduleAndTimesheets,
  [NotificationType.MarketplaceTimesheet]: NotificationCategory.ScheduleAndTimesheets,
  [NotificationType.MarketplaceDispute]: NotificationCategory.ReviewsAndDisputes,
  [NotificationType.ReviewAvailable]: NotificationCategory.ReviewsAndDisputes,
  [NotificationType.OnboardingApproved]: NotificationCategory.AccountAndSecurity,
  [NotificationType.OnboardingRejected]: NotificationCategory.AccountAndSecurity,
  [NotificationType.SecurityAlert]: NotificationCategory.AccountAndSecurity
};

@Injectable()
export class NotificationPreferencesService {
  constructor(@InjectModel(NotificationPreference.name) private readonly preferences: Model<NotificationPreferenceDocument>) {}

  async getForUser(userId: string | Types.ObjectId): Promise<NotificationPreferences> {
    const record = await this.preferences.findOne({ userId: new Types.ObjectId(userId) }).lean().exec();
    return this.mergeDefaults(record?.categories as Partial<NotificationPreferences> | undefined);
  }

  async updateForUser(userId: string, dto: UpdateNotificationPreferencesDto): Promise<NotificationPreferences> {
    const categories: NotificationPreferences = {
      [NotificationCategory.ShiftOpportunities]: dto.shiftOpportunities,
      [NotificationCategory.ShiftUpdates]: dto.shiftUpdates,
      [NotificationCategory.ScheduleAndTimesheets]: dto.scheduleAndTimesheets,
      [NotificationCategory.ReviewsAndDisputes]: dto.reviewsAndDisputes,
      [NotificationCategory.AccountAndSecurity]: { inApp: true, email: true }
    };
    await this.preferences.updateOne(
      { userId: new Types.ObjectId(userId) },
      { $set: { categories } },
      { upsert: true }
    ).exec();
    return categories;
  }

  async permits(userId: string | Types.ObjectId, type: NotificationType, channel: "inApp" | "email") {
    const category = categoryForType[type];
    if (category === NotificationCategory.AccountAndSecurity) return true;
    const preferences = await this.getForUser(userId);
    return preferences[category][channel];
  }

  private mergeDefaults(categories?: Partial<NotificationPreferences>): NotificationPreferences {
    return Object.fromEntries(
      Object.entries(defaultNotificationPreferences).map(([category, fallback]) => [category, { ...fallback, ...(categories?.[category as NotificationCategory] ?? {}) }])
    ) as unknown as NotificationPreferences;
  }
}
