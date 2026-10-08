import type { AccountStatus, User, UserRole } from "../types";

const TOKEN_KEY = "lunar_api_token";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface ApiUser {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  facilityIds: string[];
  createdBy: string | null;
  createdAt: string;
}

export interface ApiFacility {
  id: string;
  name: string;
}

export interface ApiTap {
  id: string;
  facilityId: string;
  date: string;
  transactionCount: number;
  transactionAmount: number;
}

export interface ApiFigures {
  transactionCount: number;
  transactionAmount: number;
}

export interface ApiComparison {
  status: "Good" | "Check Record";
  countDifference: number;
  amountDifference: number;
}

export interface ApiIteration {
  number: number;
  submissionStatus: "Draft" | "Submitted";
  emr: ApiFigures;
  tap: ApiFigures | null;
  comparison: ApiComparison | null;
  managerReview: {
    status: "Pending" | "Confirmed" | "Not Confirmed";
    reviewedBy: string | null;
    reviewedAt: string | null;
    comment: string | null;
  };
  financeReview: {
    status: "Pending" | "Confirmed" | "Not Confirmed";
    reviewedBy: string | null;
    reviewedAt: string | null;
  };
  financeResolution: {
    text: string;
    by: string;
    at: string;
  } | null;
  correctionStatus: "None" | "Returned";
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type EmrStage =
  | "Draft"
  | "Returned"
  | "Manager Review"
  | "Finance Review"
  | "Completed";

export interface ApiEmr {
  id: string;
  facilityId: string;
  facilityName: string;
  cashierId: string;
  cashierName: string;
  date: string;
  stage: EmrStage;
  editable: boolean;
  current: ApiIteration;
  iterations: ApiIteration[];
  createdAt: string;
  updatedAt: string;
}

export interface EmrFiguresInput {
  facilityId: string;
  date: string;
  transactionCount: number;
  transactionAmount: number;
}

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(TOKEN_KEY);
  }
}

export function toLocalUser(user: ApiUser): User {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    password: "",
    role: user.role,
    status: user.status,
    hospitalIds: user.facilityIds,
    createdBy: user.createdBy,
    createdAt: user.createdAt,
  };
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();

  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  if (init.json !== undefined) {
    headers.set("content-type", "application/json");
  }

  let response: Response;

  try {
    response = await fetch(path, {
      ...init,
      headers,
      body:
        init.json !== undefined ? JSON.stringify(init.json) : init.body,
    });
  } catch {
    throw new ApiError("Unable to reach the server.", 0);
  }

  const text = await response.text();
  let payload: { error?: string } | null = null;

  if (text) {
    try {
      payload = JSON.parse(text) as { error?: string };
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    throw new ApiError(
      payload?.error ?? "Request failed.",
      response.status,
    );
  }

  return payload as T;
}
