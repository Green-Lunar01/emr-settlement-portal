export type UserRole =
  | "finance"
  | "facility_manager"
  | "cashier"
  | "front_office"
  | "service_staff";

export type AccountStatus = "active" | "inactive";

export interface Hospital {
  id: string;
  name: string;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  email: string;
  password: string;
  role: UserRole;
  status: AccountStatus;
  hospitalIds: string[];
  departmentId: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface AppData {
  hospitals: Hospital[];
  users: User[];
}