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
  Draft: "DRAFT",
  Published: "PUBLISHED",
  Matching: "MATCHING",
  Open: "OPEN",
  Assigned: "ASSIGNED",
  Upcoming: "UPCOMING",
  Matched: "MATCHED",
  InProgress: "IN_PROGRESS",
  Completed: "COMPLETED",
  TimesheetSubmitted: "TIMESHEET_SUBMITTED",
  FacilityApproved: "FACILITY_APPROVED",
  PaymentProcessing: "PAYMENT_PROCESSING",
  Paid: "PAID",
  Cancelled: "CANCELLED",
  Expired: "EXPIRED",
  NoShow: "NO_SHOW",
  Disputed: "DISPUTED"
} as const;

export type ShiftStatus = (typeof ShiftStatus)[keyof typeof ShiftStatus];

export const ShiftVisibility = {
  Open: "OPEN",
  Recommended: "RECOMMENDED",
  Both: "BOTH"
} as const;

export type ShiftVisibility = (typeof ShiftVisibility)[keyof typeof ShiftVisibility];

export const PayType = {
  Hourly: "HOURLY",
  PerShift: "PER_SHIFT"
} as const;

export type PayType = (typeof PayType)[keyof typeof PayType];

export const VerificationDocumentStatus = {
  Pending: "PENDING",
  Verified: "VERIFIED",
  Rejected: "REJECTED",
  Expired: "EXPIRED"
} as const;

export type VerificationDocumentStatus = (typeof VerificationDocumentStatus)[keyof typeof VerificationDocumentStatus];

export const ShiftApplicationStatus = {
  Applied: "APPLIED",
  UnderReview: "UNDER_REVIEW",
  Selected: "SELECTED",
  Confirmed: "CONFIRMED",
  Declined: "DECLINED",
  Withdrawn: "WITHDRAWN"
} as const;

export type ShiftApplicationStatus = (typeof ShiftApplicationStatus)[keyof typeof ShiftApplicationStatus];

export const ShiftInvitationStatus = {
  Pending: "PENDING",
  Accepted: "ACCEPTED",
  Declined: "DECLINED",
  Cancelled: "CANCELLED",
  Expired: "EXPIRED"
} as const;

export type ShiftInvitationStatus = (typeof ShiftInvitationStatus)[keyof typeof ShiftInvitationStatus];

export const ShiftAssignmentStatus = {
  Confirmed: "CONFIRMED",
  InProgress: "IN_PROGRESS",
  Completed: "COMPLETED",
  Cancelled: "CANCELLED",
  NoShow: "NO_SHOW"
} as const;

export type ShiftAssignmentStatus = (typeof ShiftAssignmentStatus)[keyof typeof ShiftAssignmentStatus];

export const AttendanceEventType = {
  ClockIn: "CLOCK_IN",
  BreakStart: "BREAK_START",
  BreakEnd: "BREAK_END",
  ClockOut: "CLOCK_OUT",
  ManualAdjustment: "MANUAL_ADJUSTMENT"
} as const;

export type AttendanceEventType = (typeof AttendanceEventType)[keyof typeof AttendanceEventType];

export const TimesheetStatus = {
  Draft: "DRAFT",
  Submitted: "SUBMITTED",
  Approved: "APPROVED",
  Rejected: "REJECTED",
  CorrectionRequested: "CORRECTION_REQUESTED",
  Disputed: "DISPUTED"
} as const;

export type TimesheetStatus = (typeof TimesheetStatus)[keyof typeof TimesheetStatus];

export const DisputeStatus = {
  Open: "OPEN",
  UnderReview: "UNDER_REVIEW",
  Resolved: "RESOLVED",
  Rejected: "REJECTED",
  Cancelled: "CANCELLED"
} as const;

export type DisputeStatus = (typeof DisputeStatus)[keyof typeof DisputeStatus];

export const NotificationType = {
  ShiftCreated: "SHIFT_CREATED",
  ShiftAccepted: "SHIFT_ACCEPTED",
  MarketplaceApplication: "MARKETPLACE_APPLICATION",
  MarketplaceInvitation: "MARKETPLACE_INVITATION",
  MarketplaceAssignment: "MARKETPLACE_ASSIGNMENT",
  MarketplaceAttendance: "MARKETPLACE_ATTENDANCE",
  MarketplaceTimesheet: "MARKETPLACE_TIMESHEET",
  MarketplaceDispute: "MARKETPLACE_DISPUTE",
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
  filledAt?: string | null;
  title?: string;
  breakMinutes?: number;
  caregiversRequired?: number;
  payAmount?: number;
  currency?: string;
  payType?: PayType;
  visibility?: ShiftVisibility;
  requirements?: ShiftRequirementSummary;
}

export interface ShiftRequirementSummary {
  caregiverType?: string;
  requiredQualifications?: string[];
  requiredSkills?: string[];
  requiredCertifications?: string[];
  minimumExperienceYears?: number;
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

export interface ShiftApplicationSummary {
  id: string;
  shiftId: string;
  workerId: string;
  status: ShiftApplicationStatus;
  matchScore?: number;
  message?: string;
  appliedAt?: string;
  reviewedAt?: string;
  selectedAt?: string;
}

export interface ShiftInvitationSummary {
  id: string;
  shiftId: string;
  workerId: string;
  invitedBy: string;
  status: ShiftInvitationStatus;
  message?: string;
  respondedAt?: string;
}

export interface ShiftAssignmentSummary {
  id: string;
  shiftId: string;
  workerId: string;
  applicationId?: string;
  invitationId?: string;
  status: ShiftAssignmentStatus;
  confirmedAt?: string;
}

export interface AttendanceEventSummary {
  id: string;
  idempotencyKey: string;
  shiftId: string;
  workerId: string;
  eventType: AttendanceEventType;
  occurredAt: string;
  location?: GeoPoint;
  notes?: string;
}

export interface TimesheetSummary {
  id: string;
  shiftId: string;
  workerId: string;
  status: TimesheetStatus;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  actualStartTime?: string;
  actualEndTime?: string;
  breakMinutes: number;
  workedMinutes: number;
  notes?: string;
  facilityNotes?: string;
  submittedAt?: string;
  reviewedAt?: string;
}

export interface DisputeSummary {
  id: string;
  shiftId?: string;
  timesheetId?: string;
  reviewId?: string;
  openedBy: string;
  status: DisputeStatus;
  reason: string;
  resolutionNotes?: string;
  resolvedAt?: string;
}

export interface MarketplaceOverviewSummary {
  applications: number;
  pendingApplications: number;
  invitations: number;
  pendingInvitations: number;
  assignments: number;
  activeAssignments: number;
  attendanceEvents: number;
  submittedTimesheets: number;
  openDisputes: number;
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

export type ShiftSearchSort = "DISTANCE" | "START_TIME" | "HOURLY_RATE";

export interface ShiftSearchQuery {
  facilityType?: FacilityType;
  latitude?: number;
  longitude?: number;
  maxShiftHours?: number;
  minHourlyRate?: number;
  radiusKm?: number;
  roleRequired?: ClinicalRole;
  sort?: ShiftSearchSort;
  startAfter?: string;
  startBefore?: string;
}

export interface WorkerSearchQuery {
  availableDay?: string;
  backgroundCheckStatus?: BackgroundCheckStatus;
  clinicalRole?: ClinicalRole;
  latitude?: number;
  limit?: number;
  longitude?: number;
  minRating?: number;
  radiusKm?: number;
  shiftType?: string;
  verificationStatus?: OnboardingStatus;
}

export interface WorkerSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  title: ClinicalRole;
  distanceKm?: number;
  location: GeoPoint;
  availability: {
    availableDays: string[];
    preferredShiftTypes: string[];
    maxDistanceKm: number;
  };
  credentials: {
    total: number;
    verified: number;
  };
  backgroundCheckStatus?: BackgroundCheckStatus;
  onboardingStatus: OnboardingStatus;
  stats: {
    averageRating: number;
    totalShiftsCompleted: number;
  };
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
