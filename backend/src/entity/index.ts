import { AppError } from "../errors";

export type UserRole =
  | "cashier"
  | "facility_manager"
  | "finance"
  | "front_office"
  | "service_staff";

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

export type WalletReviewStatus = "Pending" | "Okay" | "Check Record";

export type WalletDecision = Exclude<WalletReviewStatus, "Pending">;

export type PaymentMethod = "Transfer" | "POS" | "Cash";

export type BillStatus =
  | "Draft"
  | "Awaiting Transfer"
  | "Awaiting Confirmation"
  | "Paid";

export type OnboardingStatus = "Pending" | "Approved" | "Rejected";

export interface FacilityDoc {
  _id: string;
  name: string;
}

export interface OnboardingRequestDoc {
  _id: string;
  name: string;
  phone: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  facilityId: string;
  departmentId: string | null;
  status: OnboardingStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
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
  // Only meaningful for service_staff: the single service point (department)
  // this account raises and clears bills for.
  departmentId: string | null;
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

export interface CashReceiptDoc {
  confirmed: boolean;
  confirmedBy: string | null;
  confirmedAt: string | null;
}

export interface WalletReviewDoc {
  status: WalletReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  comment: string | null;
}

export interface TopUpDoc {
  _id: string;
  facilityId: string;
  cashierId: string;
  date: string;
  amountKobo: number;
  issuedBy: string;
  issuedAt: string;
  acknowledged: boolean;
  acknowledgedAt: string | null;
}

export interface DailyAccountDoc {
  _id: string;
  facilityId: string;
  cashierId: string;
  date: string;
  openingBalanceKobo: number;
  bankTransfersKobo: number;
  cashCollectedKobo: number;
  cardPaymentsKobo: number;
  actualClosingBalanceKobo: number | null;
  status: SubmissionStatus;
  submittedAt: string | null;
  managerReview: WalletReviewDoc;
  financeReview: WalletReviewDoc;
  cashReceipt: CashReceiptDoc;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentDoc {
  _id: string;
  facilityId: string;
  name: string;
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransferDetailsDoc {
  accountNumber: string;
  bankName: string;
  reference: string;
  generatedAt: string;
}

export interface PatientDoc {
  _id: string;
  uniqueId: string;
  facilityId: string;
  name: string;
  phone: string;
  email: string;
  createdBy: string;
  createdAt: string;
}

export interface ServiceItemDoc {
  _id: string;
  facilityId: string;
  departmentId: string;
  name: string;
  priceKobo: number;
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface BillLineItemDoc {
  serviceItemId: string;
  name: string;
  unitPriceKobo: number;
  quantity: number;
}

export interface BillDoc {
  _id: string;
  facilityId: string;
  departmentId: string;
  patientId: string;
  raisedBy: string;
  raisedByRole: UserRole;
  items: BillLineItemDoc[];
  amountKobo: number;
  status: BillStatus;
  paymentMethod: PaymentMethod | null;
  transfer: TransferDetailsDoc | null;
  paidAt: string | null;
  confirmedBy: string | null;
  receiptNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditDoc {
  _id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  facilityId: string;
  entityType:
    | "emr"
    | "user"
    | "tap"
    | "top_up"
    | "daily_account"
    | "department"
    | "bill"
    | "facility"
    | "patient"
    | "service_item";
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
  departmentId: string | null;
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

export interface PublicTopUp {
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

export interface PublicWalletReview {
  status: WalletReviewStatus;
  reviewedBy: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  comment: string | null;
}

export interface PublicCashReceipt {
  confirmed: boolean;
  confirmedBy: string | null;
  confirmedByName: string | null;
  confirmedAt: string | null;
}

export interface PublicWalletSummary {
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

export interface PublicDailyAccount {
  id: string;
  facilityId: string;
  facilityName: string;
  cashierId: string;
  cashierName: string;
  date: string;
  status: SubmissionStatus;
  submittedAt: string | null;
  editable: boolean;
  hasLaterAccount: boolean;
  summary: PublicWalletSummary;
  managerReview: PublicWalletReview;
  financeReview: PublicWalletReview;
  cashReceipt: PublicCashReceipt;
  createdAt: string;
  updatedAt: string;
}

export interface PublicDepartment {
  id: string;
  facilityId: string;
  name: string;
  active: boolean;
  createdAt: string;
}

export interface PublicPatient {
  id: string;
  uniqueId: string;
  facilityId: string;
  name: string;
  phone: string;
  email: string;
  createdAt: string;
}

export interface PublicServiceItem {
  id: string;
  facilityId: string;
  departmentId: string;
  departmentName: string;
  name: string;
  price: number;
  active: boolean;
  createdAt: string;
}

export interface PublicBillLineItem {
  serviceItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface PublicBill {
  id: string;
  facilityId: string;
  facilityName: string;
  departmentId: string;
  departmentName: string;
  patientId: string;
  patientName: string;
  patientUniqueId: string;
  raisedBy: string;
  raisedByName: string;
  raisedByRole: UserRole;
  items: PublicBillLineItem[];
  amount: number;
  status: BillStatus;
  paymentMethod: PaymentMethod | null;
  transfer: TransferDetailsDoc | null;
  paidAt: string | null;
  confirmedByName: string | null;
  receiptNumber: string | null;
  qrDataUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicBillVerification {
  valid: boolean;
  receiptNumber: string | null;
  facilityName: string;
  amount: number;
  paidAt: string | null;
}

export interface PublicOnboardingRequest {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: UserRole;
  facilityId: string;
  facilityName: string;
  departmentId: string | null;
  departmentName: string | null;
  status: OnboardingStatus;
  reviewedByName: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
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

// Plain text (used outside email HTML, e.g. audit log entries).
export function formatNaira(amount: number): string {
  const grouped = new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return `₦ ${grouped}`;
}

// Email HTML: a non-breaking space (not a thin space, which some mail
// clients' font substitution collapses) keeps the Naira sign from
// visually bleeding into the first digit.
export function formatNairaHtml(amount: number): string {
  const grouped = new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return `&#8358;&nbsp;${grouped}`;
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
    departmentId: user.departmentId,
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

export function pendingWalletReview(): WalletReviewDoc {
  return {
    status: "Pending",
    reviewedBy: null,
    reviewedAt: null,
    comment: null,
  };
}

export function parseWalletDecision(value: unknown): WalletDecision {
  if (value !== "Okay" && value !== "Check Record") {
    throw new AppError(400, "Select a valid review decision.");
  }

  return value;
}

// A manager/finance "Check Record" reopens the account for the cashier even
// though its status has already been reset to "Draft" by that review.
export function dailyAccountEditable(account: DailyAccountDoc): boolean {
  if (
    account.managerReview.status === "Check Record" ||
    account.financeReview.status === "Check Record"
  ) {
    return true;
  }

  return account.status === "Draft";
}

export interface WalletTotalsKobo {
  totalAvailableKobo: number;
  totalSpentKobo: number;
  expectedClosingBalanceKobo: number;
  varianceKobo: number | null;
  tallies: boolean | null;
}

export function walletTotals(
  account: DailyAccountDoc,
  topUpsKobo: number,
): WalletTotalsKobo {
  const totalAvailableKobo = account.openingBalanceKobo + topUpsKobo;
  const totalSpentKobo =
    account.bankTransfersKobo +
    account.cashCollectedKobo +
    account.cardPaymentsKobo;
  const expectedClosingBalanceKobo = totalAvailableKobo - totalSpentKobo;
  const varianceKobo =
    account.actualClosingBalanceKobo === null
      ? null
      : account.actualClosingBalanceKobo - expectedClosingBalanceKobo;

  return {
    totalAvailableKobo,
    totalSpentKobo,
    expectedClosingBalanceKobo,
    varianceKobo,
    tallies: varianceKobo === null ? null : varianceKobo === 0,
  };
}

export function toPublicWalletSummary(
  account: DailyAccountDoc,
  topUpsKobo: number,
): PublicWalletSummary {
  const totals = walletTotals(account, topUpsKobo);

  return {
    openingBalance: koboToNaira(account.openingBalanceKobo),
    totalTopUps: koboToNaira(topUpsKobo),
    totalAvailable: koboToNaira(totals.totalAvailableKobo),
    bankTransfers: koboToNaira(account.bankTransfersKobo),
    cashCollected: koboToNaira(account.cashCollectedKobo),
    cardPayments: koboToNaira(account.cardPaymentsKobo),
    totalSpent: koboToNaira(totals.totalSpentKobo),
    expectedClosingBalance: koboToNaira(totals.expectedClosingBalanceKobo),
    actualClosingBalance:
      account.actualClosingBalanceKobo === null
        ? null
        : koboToNaira(account.actualClosingBalanceKobo),
    variance:
      totals.varianceKobo === null ? null : koboToNaira(totals.varianceKobo),
    tallies: totals.tallies,
  };
}

export function parsePaymentMethod(value: unknown): PaymentMethod {
  if (value !== "Transfer" && value !== "POS" && value !== "Cash") {
    throw new AppError(400, "Select a valid payment method.");
  }

  return value;
}

export function toPublicDepartment(
  department: DepartmentDoc,
): PublicDepartment {
  return {
    id: department._id,
    facilityId: department.facilityId,
    name: department.name,
    active: department.active,
    createdAt: department.createdAt,
  };
}

export function parseStaffRole(value: unknown): UserRole {
  if (
    value !== "cashier" &&
    value !== "facility_manager" &&
    value !== "finance" &&
    value !== "front_office" &&
    value !== "service_staff"
  ) {
    throw new AppError(400, "Select a valid role.");
  }

  return value;
}

export function toPublicOnboardingRequest(
  request: OnboardingRequestDoc,
  facilityName: string,
  reviewedByName: string | null,
  departmentName: string | null,
): PublicOnboardingRequest {
  return {
    id: request._id,
    name: request.name,
    phone: request.phone,
    email: request.email,
    role: request.role,
    facilityId: request.facilityId,
    facilityName,
    departmentId: request.departmentId,
    departmentName,
    status: request.status,
    reviewedByName,
    reviewedAt: request.reviewedAt,
    rejectionReason: request.rejectionReason,
    createdAt: request.createdAt,
  };
}

export function toPublicPatient(patient: PatientDoc): PublicPatient {
  return {
    id: patient._id,
    uniqueId: patient.uniqueId,
    facilityId: patient.facilityId,
    name: patient.name,
    phone: patient.phone,
    email: patient.email,
    createdAt: patient.createdAt,
  };
}

export function toPublicServiceItem(
  item: ServiceItemDoc,
  departmentName: string,
): PublicServiceItem {
  return {
    id: item._id,
    facilityId: item.facilityId,
    departmentId: item.departmentId,
    departmentName,
    name: item.name,
    price: koboToNaira(item.priceKobo),
    active: item.active,
    createdAt: item.createdAt,
  };
}

export function billTotalKobo(items: BillLineItemDoc[]): number {
  return items.reduce(
    (total, item) => total + item.unitPriceKobo * item.quantity,
    0,
  );
}

export function toPublicBill(
  bill: BillDoc,
  facilityName: string,
  departmentName: string,
  patientName: string,
  patientUniqueId: string,
  raisedByName: string,
  confirmedByName: string | null,
  qrDataUrl: string | null,
): PublicBill {
  return {
    id: bill._id,
    facilityId: bill.facilityId,
    facilityName,
    departmentId: bill.departmentId,
    departmentName,
    patientId: bill.patientId,
    patientName,
    patientUniqueId,
    raisedBy: bill.raisedBy,
    raisedByName,
    raisedByRole: bill.raisedByRole,
    items: bill.items.map((item) => ({
      serviceItemId: item.serviceItemId,
      name: item.name,
      unitPrice: koboToNaira(item.unitPriceKobo),
      quantity: item.quantity,
    })),
    amount: koboToNaira(bill.amountKobo),
    status: bill.status,
    paymentMethod: bill.paymentMethod,
    transfer: bill.transfer,
    paidAt: bill.paidAt,
    confirmedByName,
    receiptNumber: bill.receiptNumber,
    qrDataUrl,
    createdAt: bill.createdAt,
    updatedAt: bill.updatedAt,
  };
}

export function toPublicTopUp(
  topUp: TopUpDoc,
  cashierName: string,
  issuedByName: string,
  facilityName: string,
): PublicTopUp {
  return {
    id: topUp._id,
    facilityId: topUp.facilityId,
    facilityName,
    cashierId: topUp.cashierId,
    cashierName,
    date: topUp.date,
    amount: koboToNaira(topUp.amountKobo),
    issuedBy: topUp.issuedBy,
    issuedByName,
    issuedAt: topUp.issuedAt,
    acknowledged: topUp.acknowledged,
    acknowledgedAt: topUp.acknowledgedAt,
  };
}
