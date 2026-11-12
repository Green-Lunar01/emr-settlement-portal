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

export type WalletReviewStatus = "Pending" | "Okay" | "Check Record";

export interface ApiWalletReview {
  status: WalletReviewStatus;
  reviewedBy: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  comment: string | null;
}

export interface ApiCashReceipt {
  confirmed: boolean;
  confirmedBy: string | null;
  confirmedByName: string | null;
  confirmedAt: string | null;
}

export interface ApiWalletSummary {
  openingBalance: number;
  totalTopUps: number;
  totalAvailable: number;
  bankTransfers: number;
  cashCollected: number;
  cardPayments: number;
  totalSpent: number;
  expectedClosingBalance: number;
  actualClosingBalance: number | null;
  variance: number | null;
  tallies: boolean | null;
}

export interface ApiTopUp {
  id: string;
  facilityId: string;
  facilityName: string;
  cashierId: string;
  cashierName: string;
  date: string;
  amount: number;
  issuedBy: string;
  issuedByName: string;
  issuedAt: string;
  acknowledged: boolean;
  acknowledgedAt: string | null;
}

export interface ApiDailyAccount {
  id: string;
  facilityId: string;
  facilityName: string;
  cashierId: string;
  cashierName: string;
  date: string;
  status: "Draft" | "Submitted";
  submittedAt: string | null;
  editable: boolean;
  hasLaterAccount: boolean;
  summary: ApiWalletSummary;
  managerReview: ApiWalletReview;
  financeReview: ApiWalletReview;
  cashReceipt: ApiCashReceipt;
  createdAt: string;
  updatedAt: string;
}

export interface DailyAccountInput {
  bankTransfers: number;
  cashCollected: number;
  cardPayments: number;
  actualClosingBalance: number;
}

export interface ApiDepartment {
  id: string;
  facilityId: string;
  name: string;
  active: boolean;
  createdAt: string;
}

export type PaymentMethod = "Transfer" | "POS" | "Cash";

export type BillStatus =
  | "Draft"
  | "Awaiting Transfer"
  | "Awaiting Confirmation"
  | "Paid";

export interface ApiTransferDetails {
  accountNumber: string;
  bankName: string;
  reference: string;
  generatedAt: string;
}

export interface ApiBill {
  id: string;
  facilityId: string;
  facilityName: string;
  departmentId: string;
  departmentName: string;
  cashierId: string;
  cashierName: string;
  payerName: string;
  description: string;
  amount: number;
  status: BillStatus;
  paymentMethod: PaymentMethod | null;
  transfer: ApiTransferDetails | null;
  paidAt: string | null;
  confirmedByName: string | null;
  receiptNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

export type OnboardingStatus = "Pending" | "Approved" | "Rejected";

export interface ApiOnboardingRequest {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: UserRole;
  facilityId: string;
  facilityName: string;
  status: OnboardingStatus;
  reviewedByName: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
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

// Empty in dev (Vite proxies /api to the local backend) or when frontend
// and backend share an origin in production. Set VITE_API_BASE_URL to the
// deployed backend's URL (e.g. the Render service) when they don't.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

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
    response = await fetch(`${API_BASE_URL}${path}`, {
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
