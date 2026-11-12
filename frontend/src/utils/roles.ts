import type { UserRole } from "../types";

export const ROLE_LABELS: Record<UserRole, string> = {
  finance: "Finance (Auditor)",
  facility_manager: "Facility Manager",
  cashier: "Cashier (Operations)",
  front_office: "Admin",
  service_staff: "Service Staff",
};

export const ROLE_HOME: Record<UserRole, string> = {
  finance: "/finance",
  facility_manager: "/facility-manager",
  cashier: "/cashier",
  front_office: "/front-office",
  service_staff: "/service-staff",
};
