import type {
  AppData,
  DailyAccount,
  TopUp,
  User,
} from "../types";

import {
  calculateWalletSummary,
  createPendingWalletReview,
  getCarryForwardBalance,
  getToday,
  roundMoney,
} from "./accounting";

export function canAccessTopUp(
  user: User,
  topUp: TopUp,
): boolean {
  if (user.status !== "active") {
    return false;
  }

  if (user.role === "cashier") {
    return topUp.cashierId === user.id;
  }

  return user.hospitalIds.includes(topUp.hospitalId);
}

export function createDailyAccount(
  data: AppData,
  cashier: User,
): DailyAccount {
  const date = getToday();
  const hospitalId = cashier.hospitalIds[0];

  if (!hospitalId) {
    throw new Error(
      "The cashier needs a hospital assignment.",
    );
  }

  const existing = data.dailyAccounts.find(
    (account) =>
      account.cashierId === cashier.id &&
      account.hospitalId === hospitalId &&
      account.date === date,
  );

  if (existing) {
    return existing;
  }

  const openingBalance = getCarryForwardBalance(
    cashier.id,
    hospitalId,
    date,
    data.dailyAccounts,
    data.topUps,
  );

  const now = new Date().toISOString();

  const account: DailyAccount = {
    id: crypto.randomUUID(),
    hospitalId,
    cashierId: cashier.id,
    date,

    openingBalance,
    bankTransfers: 0,
    cashCollected: 0,
    cardPayments: 0,
    actualClosingBalance: null,

    status: "Draft",
    submittedAt: null,

    facilityManagerReview: createPendingWalletReview(),
    financeReview: createPendingWalletReview(),

    cashReceipt: {
      confirmed: false,
      confirmedBy: null,
      confirmedAt: null,
    },

    createdAt: now,
    updatedAt: now,
  };

  data.dailyAccounts.unshift(account);

  return account;
}

export function issueTopUp(
  data: AppData,
  actor: User,
  cashierId: string,
  amount: number,
): AppData {
  if (
    actor.status !== "active" ||
    !["finance", "facility_manager"].includes(actor.role)
  ) {
    throw new Error(
      "Only Finance and Facility Managers can issue top-ups.",
    );
  }

  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    Math.abs(amount * 100 - Math.round(amount * 100)) >
      0.000001
  ) {
    throw new Error(
      "Enter an amount greater than zero with no more than two decimal places.",
    );
  }

  const cashier = data.users.find(
    (user) =>
      user.id === cashierId &&
      user.role === "cashier" &&
      user.status === "active",
  );

  if (!cashier) {
    throw new Error("Select an active cashier.");
  }

  const hospitalId = cashier.hospitalIds[0];

  if (
    !hospitalId ||
    !actor.hospitalIds.includes(hospitalId)
  ) {
    throw new Error(
      "This cashier is outside your assigned hospitals.",
    );
  }

  const account = createDailyAccount(data, cashier);

  if (account.status === "Submitted") {
    throw new Error(
      "Today's account has already been submitted. It must be returned for correction before another top-up can be issued.",
    );
  }

  const now = new Date().toISOString();
  const roundedAmount = roundMoney(amount);

  const topUp: TopUp = {
    id: crypto.randomUUID(),
    hospitalId,
    cashierId,
    date: getToday(),
    amount: roundedAmount,

    issuedBy: actor.id,
    issuedAt: now,

    acknowledged: false,
    acknowledgedAt: null,
  };

  data.topUps.unshift(topUp);
  account.updatedAt = now;

  data.activityLogs.unshift({
    id: crypto.randomUUID(),
    actorId: actor.id,
    hospitalId,
    action: `Issued a top-up of ₦${roundedAmount.toLocaleString(
      "en-NG",
    )} to ${cashier.name}.`,
    entityType: "top_up",
    entityId: topUp.id,
    createdAt: now,
  });

  return data;
}

export function acknowledgeTopUp(
  data: AppData,
  actor: User,
  topUpId: string,
): AppData {
  const topUp = data.topUps.find(
    (item) => item.id === topUpId,
  );

  if (!topUp) {
    throw new Error("The top-up was not found.");
  }

  if (
    actor.role !== "cashier" ||
    !canAccessTopUp(actor, topUp)
  ) {
    throw new Error(
      "Only the receiving cashier can acknowledge this top-up.",
    );
  }

  if (topUp.acknowledged) {
    throw new Error(
      "You have already acknowledged this top-up.",
    );
  }

  const now = new Date().toISOString();

  topUp.acknowledged = true;
  topUp.acknowledgedAt = now;

  data.activityLogs.unshift({
    id: crypto.randomUUID(),
    actorId: actor.id,
    hospitalId: topUp.hospitalId,
    action: `Acknowledged receipt of top-up ₦${topUp.amount.toLocaleString(
      "en-NG",
    )}.`,
    entityType: "top_up",
    entityId: topUp.id,
    createdAt: now,
  });

  return data;
}

export function getTodayWallet(
  data: AppData,
  cashier: User,
) {
  const date = getToday();
  const hospitalId = cashier.hospitalIds[0];

  if (!hospitalId) {
    throw new Error(
      "The cashier needs a hospital assignment.",
    );
  }

  const account = data.dailyAccounts.find(
    (item) =>
      item.cashierId === cashier.id &&
      item.hospitalId === hospitalId &&
      item.date === date,
  );

  if (account) {
    return calculateWalletSummary(account, data.topUps);
  }

  const openingBalance = getCarryForwardBalance(
    cashier.id,
    hospitalId,
    date,
    data.dailyAccounts,
    data.topUps,
  );

  const totalTopUps = roundMoney(
    data.topUps
      .filter(
        (topUp) =>
          topUp.cashierId === cashier.id &&
          topUp.hospitalId === hospitalId &&
          topUp.date === date,
      )
      .reduce(
        (total, topUp) => total + topUp.amount,
        0,
      ),
  );

  return {
    openingBalance,
    totalTopUps,
    totalAvailable: roundMoney(
      openingBalance + totalTopUps,
    ),
    bankTransfers: 0,
    cashCollected: 0,
    cardPayments: 0,
    totalSpent: 0,
    expectedClosingBalance: roundMoney(
      openingBalance + totalTopUps,
    ),
    actualClosingBalance: null,
    variance: null,
    tallies: null,
  };
}