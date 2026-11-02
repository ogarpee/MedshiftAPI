import { Type } from "class-transformer";
import { IsBoolean, ValidateNested } from "class-validator";

export class NotificationChannelPreferenceDto {
  @IsBoolean() inApp!: boolean;
  @IsBoolean() email!: boolean;
}

export class UpdateNotificationPreferencesDto {
  @ValidateNested() @Type(() => NotificationChannelPreferenceDto) shiftOpportunities!: NotificationChannelPreferenceDto;
  @ValidateNested() @Type(() => NotificationChannelPreferenceDto) shiftUpdates!: NotificationChannelPreferenceDto;
  @ValidateNested() @Type(() => NotificationChannelPreferenceDto) scheduleAndTimesheets!: NotificationChannelPreferenceDto;
  @ValidateNested() @Type(() => NotificationChannelPreferenceDto) reviewsAndDisputes!: NotificationChannelPreferenceDto;
}
