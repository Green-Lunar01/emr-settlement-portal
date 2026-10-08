import { AppError } from "../errors";

export type UserRole = "cashier" | "facility_manager" | "finance";

export type AccountStatus = "active" | "inactive";

export type SubmissionStatus = "Draft" | "Submitted";

export type ComparisonStatus = "Good" | "Check Record";

export type ReviewStatus = "Pending" | "Confirmed" | "Not Confirmed";

export type DecisionStatus = Exclude<ReviewStatus, "Pending">;

export type CorrectionStatus = "None" | "Returned";

export type RecordStage =
  | "Draft"
  | "Returned"
  | "Manager Review"
  | "Finance Review"
  | "Completed";

export interface FacilityDoc {
  _id: string;
  name: string;
}

export interface UserDoc {
  _id: string;
  name: string;
  phone: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: AccountStatus;
  facilityIds: string[];
  supervisorIds: string[];
  createdBy: string | null;
  createdAt: string;
}

export interface SessionDoc {
  _id: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
}

export interface Figures {
  transactionCount: number;
  transactionAmountKobo: number;
}

export interface ComparisonDoc {
  status: ComparisonStatus;
  countDifference: number;
  amountDifferenceKobo: number;
}

export interface ManagerReviewDoc {
  status: ReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  comment: string | null;
}

export interface FinanceReviewDoc {
  status: ReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export interface FinanceResolutionDoc {
  text: string;
  by: string;
  at: string;
}

export interface IterationDoc {
  number: number;
  submissionStatus: SubmissionStatus;
  emr: Figures;
  tap: Figures | null;
  comparison: ComparisonDoc | null;
  managerReview: ManagerReviewDoc;
  financeReview: FinanceReviewDoc;
  financeResolution: FinanceResolutionDoc | null;
  correctionStatus: CorrectionStatus;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmrDoc {
  _id: string;
  facilityId: string;
  cashierId: string;
  date: string;
  iterations: IterationDoc[];
  createdAt: string;
  updatedAt: string;
}

export interface TapDoc {
  _id: string;
  facilityId: string;
  date: string;
  transactionCount: number;
  transactionAmountKobo: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuditDoc {
  _id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  facilityId: string;
  entityType: "emr" | "user" | "tap";
  entityId: string;
  iteration: number | null;
  action: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string | null;
  createdAt: string;
}

export interface PublicUser {
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

export interface PublicFigures {
  transactionCount: number;
  transactionAmount: number;
}

export interface PublicComparison {
  status: ComparisonStatus;
  countDifference: number;
  amountDifference: number;
}

export interface PublicIteration {
  number: number;
  submissionStatus: SubmissionStatus;
  emr: PublicFigures;
  tap: PublicFigures | null;
  comparison: PublicComparison | null;
  managerReview: ManagerReviewDoc;
  financeReview: FinanceReviewDoc;
  financeResolution: FinanceResolutionDoc | null;
  correctionStatus: CorrectionStatus;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicEmr {
  id: string;
  facilityId: string;
  facilityName: string;
  cashierId: string;
  cashierName: string;
  date: string;
  stage: RecordStage;
  editable: boolean;
  current: PublicIteration;
  iterations: PublicIteration[];
  createdAt: string;
  updatedAt: string;
}

export interface PublicTap {
  id: string;
  facilityId: string;
  date: string;
  transactionCount: number;
  transactionAmount: number;
}

export interface PublicAudit {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  facilityId: string;
  entityType: AuditDoc["entityType"];
  entityId: string;
  iteration: number | null;
  action: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string | null;
  createdAt: string;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function getToday(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const getPart = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function koboToNaira(kobo: number): number {
  return kobo / 100;
}

export function parseCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new AppError(
      400,
      "Transaction counts must be whole numbers of zero or more.",
    );
  }

  return value;
}

export function parseAmountKobo(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    Math.abs(value * 100 - Math.round(value * 100)) > 0.000001
  ) {
    throw new AppError(
      400,
      "Amounts must be zero or more, with no more than two decimal places.",
    );
  }

  const kobo = Math.round((value + Number.EPSILON) * 100);

  if (!Number.isSafeInteger(kobo)) {
    throw new AppError(
      400,
      "Amounts must be zero or more, with no more than two decimal places.",
    );
  }

  return kobo;
}

export function parseDate(
  value: unknown,
  options?: { allowFuture?: boolean },
): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(400, "Enter a valid date.");
  }

  const parsed = new Date(`${value}T00:00:00Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new AppError(400, "Enter a valid date.");
  }

  if (!options?.allowFuture && value > getToday()) {
    throw new AppError(400, "Select a valid date that is not in the future.");
  }

  return value;
}

export function parseEmail(value: unknown): string {
  if (typeof value !== "string") {
    throw new AppError(400, "Enter a valid email address.");
  }

  const email = value.trim().toLowerCase();

  if (
    email.length > 200 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new AppError(400, "Enter a valid email address.");
  }

  return email;
}

export function parsePassword(value: unknown): string {
  if (typeof value !== "string" || value.length < 8 || value.length > 200) {
    throw new AppError(400, "Password must be at least 8 characters.");
  }

  return value;
}

export function parseDecision(value: unknown): DecisionStatus {
  if (value !== "Confirmed" && value !== "Not Confirmed") {
    throw new AppError(400, "Select a valid review decision.");
  }

  return value;
}

export function asObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AppError(400, "Request body must be a JSON object.");
  }

  return value as Record<string, unknown>;
}

export function requiredId(value: unknown, message: string): string {
  if (typeof value !== "string") {
    throw new AppError(400, message);
  }

  const id = value.trim();

  if (!id || id.length > 80) {
    throw new AppError(400, message);
  }

  return id;
}

export function optionalText(
  value: unknown,
  label: string,
  max: number,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new AppError(400, `${label} must be text.`);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.length > max) {
    throw new AppError(400, `${label} must be ${max} characters or fewer.`);
  }

  return trimmed;
}

export function requiredText(
  value: unknown,
  label: string,
  max: number,
): string {
  const text = optionalText(value, label, max);

  if (!text) {
    throw new AppError(400, `${label} is required.`);
  }

  return text;
}

export function pendingManagerReview(): ManagerReviewDoc {
  return {
    status: "Pending",
    reviewedBy: null,
    reviewedAt: null,
    comment: null,
  };
}

export function pendingFinanceReview(): FinanceReviewDoc {
  return {
    status: "Pending",
    reviewedBy: null,
    reviewedAt: null,
  };
}

export function compareFigures(emr: Figures, tap: Figures): ComparisonDoc {
  const countDifference = emr.transactionCount - tap.transactionCount;
  const amountDifferenceKobo =
    emr.transactionAmountKobo - tap.transactionAmountKobo;

  return {
    status:
      countDifference === 0 && amountDifferenceKobo === 0
        ? "Good"
        : "Check Record",
    countDifference,
    amountDifferenceKobo,
  };
}

export function publicFigures(figures: Figures): PublicFigures {
  return {
    transactionCount: figures.transactionCount,
    transactionAmount: koboToNaira(figures.transactionAmountKobo),
  };
}

export function publicComparison(comparison: ComparisonDoc): PublicComparison {
  return {
    status: comparison.status,
    countDifference: comparison.countDifference,
    amountDifference: koboToNaira(comparison.amountDifferenceKobo),
  };
}

export function toPublicUser(user: UserDoc): PublicUser {
  return {
    id: user._id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    role: user.role,
    status: user.status,
    facilityIds: user.facilityIds,
    createdBy: user.createdBy,
    createdAt: user.createdAt,
  };
}

export function toPublicTap(tap: TapDoc): PublicTap {
  return {
    id: tap._id,
    facilityId: tap.facilityId,
    date: tap.date,
    transactionCount: tap.transactionCount,
    transactionAmount: koboToNaira(tap.transactionAmountKobo),
  };
}

export function toPublicIteration(iteration: IterationDoc): PublicIteration {
  return {
    number: iteration.number,
    submissionStatus: iteration.submissionStatus,
    emr: publicFigures(iteration.emr),
    tap: iteration.tap ? publicFigures(iteration.tap) : null,
    comparison: iteration.comparison
      ? publicComparison(iteration.comparison)
      : null,
    managerReview: iteration.managerReview,
    financeReview: iteration.financeReview,
    financeResolution: iteration.financeResolution,
    correctionStatus: iteration.correctionStatus,
    submittedAt: iteration.submittedAt,
    createdAt: iteration.createdAt,
    updatedAt: iteration.updatedAt,
  };
}

export function currentIteration(record: EmrDoc): IterationDoc {
  const iteration = record.iterations[record.iterations.length - 1];

  if (!iteration) {
    throw new AppError(500, "EMR record is missing its review iteration.");
  }

  return iteration;
}

// Drafts stay editable. A submitted record stays editable until the manager
// decides. Finance rejection opens a new draft instead of unlocking the old one.
export function iterationEditable(iteration: IterationDoc): boolean {
  if (iteration.financeReview.status === "Confirmed") {
    return false;
  }

  if (iteration.submissionStatus === "Draft") {
    return true;
  }

  return iteration.managerReview.status === "Pending";
}

export function recordStage(record: EmrDoc): RecordStage {
  const current = currentIteration(record);

  if (current.financeReview.status === "Confirmed") {
    return "Completed";
  }

  if (
    current.submissionStatus === "Draft" &&
    current.correctionStatus === "Returned"
  ) {
    return "Returned";
  }

  if (current.submissionStatus === "Draft") {
    return "Draft";
  }

  if (current.managerReview.status === "Pending") {
    return "Manager Review";
  }

  return "Finance Review";
}

export function toPublicEmr(record: EmrDoc, actor: UserDoc): PublicEmr {
  const current = currentIteration(record);

  return {
    id: record._id,
    facilityId: record.facilityId,
    facilityName: "",
    cashierId: record.cashierId,
    cashierName: "",
    date: record.date,
    stage: recordStage(record),
    editable:
      actor.role === "cashier" &&
      actor._id === record.cashierId &&
      iterationEditable(current),
    current: toPublicIteration(current),
    iterations: record.iterations.map(toPublicIteration),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function toPublicAudit(entry: AuditDoc): PublicAudit {
  return {
    id: entry._id,
    actorId: entry.actorId,
    actorName: entry.actorName,
    actorRole: entry.actorRole,
    facilityId: entry.facilityId,
    entityType: entry.entityType,
    entityId: entry.entityId,
    iteration: entry.iteration,
    action: entry.action,
    oldValue: entry.oldValue,
    newValue: entry.newValue,
    reason: entry.reason,
    createdAt: entry.createdAt,
  };
}

export function lockMessage(iteration: IterationDoc): string {
  if (iteration.financeReview.status === "Confirmed") {
    return "This record is complete and can no longer be changed.";
  }

  return "This record is locked after facility manager review.";
}
