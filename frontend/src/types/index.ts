export type UserRole =
  | "finance"
  | "facility_manager"
  | "cashier"
  | "front_office";

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
  createdBy: string | null;
  createdAt: string;
}

export interface AppData {
  hospitals: Hospital[];
  users: User[];
}