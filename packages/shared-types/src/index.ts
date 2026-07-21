export enum UserRole {
  Worker = "WORKER",
  Facility = "FACILITY",
  Admin = "ADMIN"
}

export enum AccountStatus {
  Pending = "PENDING",
  Active = "ACTIVE",
  Suspended = "SUSPENDED"
}

export enum ClinicalRole {
  Hca = "HCA",
  Rn = "RN",
  Lpn = "LPN",
  Psw = "PSW"
}

export enum FacilityType {
  LongTermCare = "LONG_TERM_CARE",
  Hospital = "HOSPITAL",
  Clinic = "CLINIC",
  HomeCare = "HOME_CARE"
}

export enum BackgroundCheckStatus {
  Pending = "PENDING",
  Passed = "PASSED",
  Failed = "FAILED"
}

export enum ShiftStatus {
  Open = "OPEN",
  Matched = "MATCHED",
  InProgress = "IN_PROGRESS",
  Completed = "COMPLETED",
  Cancelled = "CANCELLED"
}

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

export interface ShiftMetrics {
  activeShifts: number;
  upcomingShifts: number;
  completedShifts: number;
  averageFillTimeMinutes: number | null;
}
