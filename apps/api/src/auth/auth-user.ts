import { AccountStatus, UserRole } from "@medshift/shared-types";

export interface AuthUser {
  sub: string;
  sid: string;
  email: string;
  role: UserRole;
  status?: AccountStatus;
}
