export const UserRole = {
  Worker: "WORKER",
  Facility: "FACILITY",
  Admin: "ADMIN"
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const AccountStatus = {
  Pending: "PENDING",
  Active: "ACTIVE",
  Suspended: "SUSPENDED"
} as const;

export type AccountStatus = (typeof AccountStatus)[keyof typeof AccountStatus];

export const ClinicalRole = {
  Hca: "HCA",
  Rn: "RN",
  Lpn: "LPN",
  Psw: "PSW"
} as const;

export type ClinicalRole = (typeof ClinicalRole)[keyof typeof ClinicalRole];

export const WaitlistProfessionalRole = {
  HealthcareAide: "HEALTHCARE_AIDE",
  PersonalSupportWorker: "PERSONAL_SUPPORT_WORKER",
  Other: "OTHER"
} as const;

export type WaitlistProfessionalRole = (typeof WaitlistProfessionalRole)[keyof typeof WaitlistProfessionalRole];

export const FacilityType = {
  LongTermCare: "LONG_TERM_CARE",
  Hospital: "HOSPITAL",
  Clinic: "CLINIC",
  HomeCare: "HOME_CARE",
  SupportiveLiving: "SUPPORTIVE_LIVING",
  RetirementResidence: "RETIREMENT_RESIDENCE",
  Other: "OTHER"
} as const;

export type FacilityType = (typeof FacilityType)[keyof typeof FacilityType];

export const WaitlistAvailability = {
  Days: "DAYS",
  Evenings: "EVENINGS",
  Nights: "NIGHTS",
  Weekends: "WEEKENDS",
  Casual: "CASUAL",
  Flexible: "FLEXIBLE"
} as const;

export type WaitlistAvailability = (typeof WaitlistAvailability)[keyof typeof WaitlistAvailability];

export const WaitlistStaffingNeed = {
  UrgentCoverage: "URGENT_COVERAGE",
  PlannedCoverage: "PLANNED_COVERAGE",
  OngoingPool: "ONGOING_POOL",
  Exploring: "EXPLORING"
} as const;

export type WaitlistStaffingNeed = (typeof WaitlistStaffingNeed)[keyof typeof WaitlistStaffingNeed];

export const BackgroundCheckStatus = {
  Pending: "PENDING",
  Passed: "PASSED",
  Failed: "FAILED"
} as const;

export type BackgroundCheckStatus = (typeof BackgroundCheckStatus)[keyof typeof BackgroundCheckStatus];

export const OnboardingStatus = {
  Incomplete: "INCOMPLETE",
  PendingReview: "PENDING_REVIEW",
  Approved: "APPROVED",
  Rejected: "REJECTED"
} as const;

export type OnboardingStatus = (typeof OnboardingStatus)[keyof typeof OnboardingStatus];

export const ShiftStatus = {
  Open: "OPEN",
  Matched: "MATCHED",
  InProgress: "IN_PROGRESS",
  Completed: "COMPLETED",
  Cancelled: "CANCELLED"
} as const;

export type ShiftStatus = (typeof ShiftStatus)[keyof typeof ShiftStatus];

export const NotificationType = {
  ShiftCreated: "SHIFT_CREATED",
  ShiftAccepted: "SHIFT_ACCEPTED",
  OnboardingApproved: "ONBOARDING_APPROVED",
  OnboardingRejected: "ONBOARDING_REJECTED",
  ReviewAvailable: "REVIEW_AVAILABLE"
} as const;

export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export interface GeoPoint {
  type: "Point";
  coordinates: [longitude: number, latitude: number];
}

export interface Address {
  street?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country: string;
}

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: UserRole;
    status: AccountStatus;
    emailVerified: boolean;
  };
}

export interface ShiftSummary {
  id: string;
  facilityId: string;
  roleRequired: ClinicalRole;
  startTime: string;
  endTime: string;
  hourlyRate: number;
  status: ShiftStatus;
  location: GeoPoint;
  description?: string;
}

export interface MatchedShiftSummary extends ShiftSummary {
  matchedWorkerId?: string | null;
  distanceKm?: number;
  facility?: {
    id: string;
    name: string;
    facilityType?: FacilityType;
    address?: Partial<Address>;
    stats?: {
      averageRating: number;
    };
  };
}

export interface ShiftCreatedEvent {
  shift: MatchedShiftSummary;
}

export interface ShiftAcceptedEvent {
  shift: MatchedShiftSummary;
}

export interface ShiftMetrics {
  activeShifts: number;
  upcomingShifts: number;
  completedShifts: number;
  averageFillTimeMinutes: number | null;
}

export interface ReviewSummary {
  id: string;
  shiftId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  comment?: string;
  createdAt?: string;
}

export interface OnboardingState {
  completedAt?: string | Date;
  verificationStatus: OnboardingStatus;
  rejectedReason?: string;
}

export interface NotificationSummary {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  href?: string;
  metadata?: Record<string, string>;
  readAt?: string | null;
  createdAt?: string;
}
