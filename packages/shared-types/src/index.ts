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

export const FacilityType = {
  LongTermCare: "LONG_TERM_CARE",
  Hospital: "HOSPITAL",
  Clinic: "CLINIC",
  HomeCare: "HOME_CARE"
} as const;

export type FacilityType = (typeof FacilityType)[keyof typeof FacilityType];

export const BackgroundCheckStatus = {
  Pending: "PENDING",
  Passed: "PASSED",
  Failed: "FAILED"
} as const;

export type BackgroundCheckStatus = (typeof BackgroundCheckStatus)[keyof typeof BackgroundCheckStatus];

export const ShiftStatus = {
  Open: "OPEN",
  Matched: "MATCHED",
  InProgress: "IN_PROGRESS",
  Completed: "COMPLETED",
  Cancelled: "CANCELLED"
} as const;

export type ShiftStatus = (typeof ShiftStatus)[keyof typeof ShiftStatus];

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
