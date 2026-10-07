import type { UserRole } from "../types";

export const ROLE_LABELS: Record<UserRole, string> = {
  finance: "Finance (Auditor)",
  facility_manager: "Facility Manager",
  cashier: "Cashier (Operations)",
};

export const ROLE_HOME: Record<UserRole, string> = {
  finance: "/finance",
  facility_manager: "/facility-manager",
  cashier: "/cashier",
};