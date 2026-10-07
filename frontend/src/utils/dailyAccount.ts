import type {
  AppData,
  DailyAccount,
  User,
  WalletReviewRemark,
} from "../types";

import {
  calculateWalletSummary,
  canCashierEditDailyAccount,
  createPendingWalletReview,
  getToday,
  hasUnacknowledgedTopUps,
  roundMoney,
} from "./accounting";

import { createDailyAccount } from "./topUp";
import { canFinanceManageCashier } from "./supervision";

export interface DailyAccountInput {
  bankTransfers: number;
  cashCollected: number;
  cardPayments: number;
  actualClosingBalance: number;
}

export function canAccessDailyAccount(
  user: User,
  account: DailyAccount,
  data: AppData,
): boolean {
  if (user.status !== "active") return false;

  if (user.role === "cashier") {
    return account.cashierId === user.id;
  }

  if (user.role === "finance") {
    return canFinanceManageCashier(
      data,
      user,
      account.cashierId,
    );
  }

  return user.hospitalIds.includes(account.hospitalId);
}

function ensureNoLaterAccount(
  data: AppData,
  account: DailyAccount,
): void {
  if (
    data.dailyAccounts.some(
      (item) =>
        item.cashierId === account.cashierId &&
        item.hospitalId === account.hospitalId &&
        item.date > account.date,
    )
  ) {
    throw new Error(
      "A later wallet day already exists. These figures cannot be reopened because they determine the later opening balance.",
    );
  }
}

function addActivity(
  data: AppData,
  actor: User,
  account: DailyAccount,
  action: string,
): void {
  data.activityLogs.unshift({
    id: crypto.randomUUID(),
    actorId: actor.id,
    hospitalId: account.hospitalId,
    action,
    entityType: "daily_account",
    entityId: account.id,
    createdAt: new Date().toISOString(),
  });
}

export function submitDailyAccount(
  data: AppData,
  actor: User,
  input: DailyAccountInput,
  accountId?: string,
): AppData {
  if (
    actor.role !== "cashier" ||
    actor.status !== "active"
  ) {
    throw new Error(
      "Only active cashiers can submit daily collections.",
    );
  }

  const values = [
    input.bankTransfers,
    input.cashCollected,
    input.cardPayments,
    input.actualClosingBalance,
  ];

  if (
    values.some(
      (value) =>
        !Number.isFinite(value) ||
        value < 0 ||
        Math.abs(value * 100 - Math.round(value * 100)) >
          0.000001,
    )
  ) {
    throw new Error(
      "Enter amounts of zero or more, with no more than two decimal places.",
    );
  }

  let account: DailyAccount;

  if (accountId) {
    const existing = data.dailyAccounts.find(
      (item) => item.id === accountId,
    );

    if (!existing) {
      throw new Error("The daily account was not found.");
    }

    account = existing;
  } else {
    account = createDailyAccount(data, actor);
  }

  if (!canAccessDailyAccount(actor, account, data)) {
    throw new Error("You cannot edit this account.");
  }

  if (!canCashierEditDailyAccount(account)) {
    throw new Error(
      "This account is submitted. A reviewer must return it before you can edit it.",
    );
  }

  ensureNoLaterAccount(data, account);

  if (hasUnacknowledgedTopUps(account, data.topUps)) {
    throw new Error(
      "Confirm receipt of every top-up for this day before submitting.",
    );
  }

  const totalSpent = roundMoney(
    input.bankTransfers +
      input.cashCollected +
      input.cardPayments,
  );

  const available = calculateWalletSummary(
    account,
    data.topUps,
  ).totalAvailable;

  if (totalSpent > available) {
    throw new Error(
      "Total spent cannot exceed the available wallet balance.",
    );
  }

  const now = new Date().toISOString();

  account.bankTransfers = roundMoney(input.bankTransfers);
  account.cashCollected = roundMoney(input.cashCollected);
  account.cardPayments = roundMoney(input.cardPayments);

  account.actualClosingBalance = roundMoney(
    input.actualClosingBalance,
  );

  account.status = "Submitted";
  account.submittedAt = now;
  account.facilityManagerReview = createPendingWalletReview();
  account.financeReview = createPendingWalletReview();

  account.cashReceipt = {
    confirmed: false,
    confirmedBy: null,
    confirmedAt: null,
  };

  account.updatedAt = now;

  const summary = calculateWalletSummary(
    account,
    data.topUps,
  );

  addActivity(
    data,
    actor,
    account,
    `Submitted daily account for ${account.date}. Automatic remark: ${
      summary.tallies ? "Good" : "Check Record"
    }.`,
  );

  return data;
}

export function reviewDailyAccount(
  data: AppData,
  actor: User,
  accountId: string,
  remark: Exclude<WalletReviewRemark, "Pending">,
  comment: string = "",
): AppData {
  const account = data.dailyAccounts.find(
    (item) => item.id === accountId,
  );

  if (!account) {
    throw new Error("The daily account was not found.");
  }

  if (
    actor.role === "cashier" ||
    !canAccessDailyAccount(actor, account, data)
  ) {
    throw new Error("You cannot review this account.");
  }

  if (account.status !== "Submitted") {
    throw new Error(
      "The cashier must submit this account before review.",
    );
  }

  if (remark !== "Okay" && remark !== "Check Record") {
    throw new Error("Select a valid review remark.");
  }

  const summary = calculateWalletSummary(
    account,
    data.topUps,
  );

  if (remark === "Okay" && summary.tallies !== true) {
    throw new Error(
      "Expected and actual wallet balances must tally before selecting Okay.",
    );
  }

  if (remark === "Check Record") {
    ensureNoLaterAccount(data, account);
  }

  const now = new Date().toISOString();
  const trimmedComment = comment.trim();

  if (actor.role === "facility_manager") {
    if (account.financeReview.remark !== "Pending") {
      throw new Error(
        "Finance has already reviewed this account.",
      );
    }

    account.facilityManagerReview = {
      remark,
      reviewedBy: actor.id,
      reviewedAt: now,
      comment: trimmedComment,
    };
  } else {
    if (account.facilityManagerReview.remark !== "Okay") {
      throw new Error(
        "The Facility Manager must mark this account Okay before Finance reviews it.",
      );
    }

    account.financeReview = {
      remark,
      reviewedBy: actor.id,
      reviewedAt: now,
    };
  }

  if (remark === "Check Record") {
    account.status = "Draft";

    account.cashReceipt = {
      confirmed: false,
      confirmedBy: null,
      confirmedAt: null,
    };
  }

  account.updatedAt = now;

  addActivity(
    data,
    actor,
    account,
    `${
      actor.role === "finance"
        ? "Finance"
        : "Facility Manager"
    } marked daily account for ${account.date} as ${remark}.${
      actor.role === "facility_manager" && trimmedComment
        ? ` Comment: ${trimmedComment}`
        : ""
    }`,
  );

  return data;
}

export function confirmCashReceived(
  data: AppData,
  actor: User,
  accountId: string,
): AppData {
  const account = data.dailyAccounts.find(
    (item) => item.id === accountId,
  );

  if (!account) {
    throw new Error("The daily account was not found.");
  }

  if (
    actor.role !== "finance" ||
    !canAccessDailyAccount(actor, account, data)
  ) {
    throw new Error(
      "Only Finance can confirm receipt of collected cash.",
    );
  }

  if (
    account.status !== "Submitted" ||
    account.facilityManagerReview.remark !== "Okay"
  ) {
    throw new Error(
      "The account must be submitted and marked Okay by the Facility Manager first.",
    );
  }

  if (account.cashCollected === 0) {
    throw new Error("There is no collected cash to confirm.");
  }

  if (account.cashReceipt.confirmed) {
    throw new Error("Cash receipt is already confirmed.");
  }

  const now = new Date().toISOString();

  account.cashReceipt = {
    confirmed: true,
    confirmedBy: actor.id,
    confirmedAt: now,
  };

  account.updatedAt = now;

  addActivity(
    data,
    actor,
    account,
    `Finance confirmed receipt of ₦${account.cashCollected.toLocaleString(
      "en-NG",
    )} cash for ${account.date}.`,
  );

  return data;
}

export function getCurrentDailyAccount(
  data: AppData,
  cashierId: string,
  hospitalId: string,
): DailyAccount | undefined {
  return data.dailyAccounts.find(
    (account) =>
      account.cashierId === cashierId &&
      account.hospitalId === hospitalId &&
      account.date === getToday(),
  );
}