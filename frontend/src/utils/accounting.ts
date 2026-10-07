import type {
  DailyAccount,
  EmrRecord,
  Review,
  TopUp,
  WalletReview,
  WalletSummary,
} from "../types";

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
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

export function createPendingReview(): Review {
  return {
    status: "Pending",
    reviewedBy: null,
    reviewedAt: null,
  };
}

export function createPendingWalletReview(): WalletReview {
  return {
    remark: "Pending",
    reviewedBy: null,
    reviewedAt: null,
  };
}

export function compareEmrRecord(record: EmrRecord) {
  const transactionsMatch =
    record.emr.numberOfTransactions ===
    record.tap.numberOfTransactions;

  const amountsMatch =
    roundMoney(record.emr.amountForDay) ===
    roundMoney(record.tap.amountForDay);

  return {
    transactionsMatch,
    amountsMatch,
    tallies: transactionsMatch && amountsMatch,

    transactionDifference:
      record.emr.numberOfTransactions -
      record.tap.numberOfTransactions,

    amountDifference: roundMoney(
      record.emr.amountForDay - record.tap.amountForDay,
    ),
  };
}

export function canCashierEditEmr(record: EmrRecord): boolean {
  // A Finance rejection must reopen the record,
  // even if the Manager previously confirmed it.
  if (record.financeReview.status === "Not Confirmed") {
    return true;
  }

  return record.facilityManagerReview.status !== "Confirmed";
}

export function calculateWalletSummary(
  account: DailyAccount,
  topUps: TopUp[],
): WalletSummary {
  const matchingTopUps = topUps.filter(
    (topUp) =>
      topUp.cashierId === account.cashierId &&
      topUp.hospitalId === account.hospitalId &&
      topUp.date === account.date,
  );

  const totalTopUps = roundMoney(
    matchingTopUps.reduce(
      (total, topUp) => total + topUp.amount,
      0,
    ),
  );

  const totalAvailable = roundMoney(
    account.openingBalance + totalTopUps,
  );

  const totalSpent = roundMoney(
    account.bankTransfers +
      account.cashCollected +
      account.cardPayments,
  );

  const expectedClosingBalance = roundMoney(
    totalAvailable - totalSpent,
  );

  const actualClosingBalance =
    account.actualClosingBalance === null
      ? null
      : roundMoney(account.actualClosingBalance);

  const variance =
    actualClosingBalance === null
      ? null
      : roundMoney(
          actualClosingBalance - expectedClosingBalance,
        );

  return {
    openingBalance: account.openingBalance,
    totalTopUps,
    totalAvailable,

    bankTransfers: account.bankTransfers,
    cashCollected: account.cashCollected,
    cardPayments: account.cardPayments,

    totalSpent,
    expectedClosingBalance,
    actualClosingBalance,
    variance,

    tallies: variance === null ? null : variance === 0,
  };
}

export function hasUnacknowledgedTopUps(
  account: DailyAccount,
  topUps: TopUp[],
): boolean {
  return topUps.some(
    (topUp) =>
      topUp.cashierId === account.cashierId &&
      topUp.hospitalId === account.hospitalId &&
      topUp.date === account.date &&
      !topUp.acknowledged,
  );
}

export function canCashierEditDailyAccount(
  account: DailyAccount,
): boolean {
  if (
    account.facilityManagerReview.remark === "Check Record" ||
    account.financeReview.remark === "Check Record"
  ) {
    return true;
  }

  return account.status === "Draft";
}

export function getCarryForwardBalance(
  cashierId: string,
  hospitalId: string,
  date: string,
  accounts: DailyAccount[],
  topUps: TopUp[],
): number {
  const previousAccount = accounts
    .filter(
      (account) =>
        account.cashierId === cashierId &&
        account.hospitalId === hospitalId &&
        account.date < date,
    )
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  if (!previousAccount) {
    return 0;
  }

  if (previousAccount.status !== "Submitted") {
    throw new Error(
      "Submit the previous daily account before opening a new day.",
    );
  }

  // Carry the calculated wallet balance forward.
  // Keep an actual-balance discrepancy visible for review.
  return calculateWalletSummary(
    previousAccount,
    topUps,
  ).expectedClosingBalance;
}