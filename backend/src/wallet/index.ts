import { randomUUID } from "node:crypto";
import { AppError, isDuplicateKey } from "../errors";
import {
  asObject,
  dailyAccountEditable,
  getToday,
  koboToNaira,
  nowIso,
  optionalText,
  parseAmountKobo,
  parseWalletDecision,
  pendingWalletReview,
  requiredId,
  toPublicWalletSummary,
  walletTotals,
  type DailyAccountDoc,
  type PublicDailyAccount,
  type PublicWalletReview,
  type UserDoc,
  type WalletReviewDoc,
} from "../entity";
import {
  findDailyAccount,
  findDailyAccountById,
  findFacility,
  findLatestDailyAccountBefore,
  findUserById,
  hasLaterDailyAccount,
  hasUnacknowledgedTopUps,
  insertAudit,
  insertDailyAccount,
  listDailyAccountsQuery,
  listSupervisedCashiers,
  saveDailyAccount,
  sumTopUpsKobo,
} from "../repository";

async function canView(actor: UserDoc, account: DailyAccountDoc): Promise<boolean> {
  if (actor.status !== "active") {
    return false;
  }

  if (actor.role === "cashier") {
    return account.cashierId === actor._id;
  }

  if (actor.role === "facility_manager") {
    return actor.facilityIds.includes(account.facilityId);
  }

  if (actor.role === "finance") {
    const cashier = await findUserById(account.cashierId);
    return !!cashier && cashier.supervisorIds.includes(actor._id);
  }

  return false;
}

async function loadVisible(
  actor: UserDoc,
  accountId: string,
): Promise<DailyAccountDoc> {
  const account = await findDailyAccountById(accountId);

  if (!account || !(await canView(actor, account))) {
    throw new AppError(404, "The daily account was not found.");
  }

  return account;
}

function assertCashierOwner(actor: UserDoc, account: DailyAccountDoc): void {
  if (actor.role !== "cashier" || actor._id !== account.cashierId) {
    throw new AppError(
      403,
      "Only the cashier who owns this account can change it.",
    );
  }
}

function presentReview(review: WalletReviewDoc, name: string | null): PublicWalletReview {
  return {
    status: review.status,
    reviewedBy: review.reviewedBy,
    reviewedByName: name,
    reviewedAt: review.reviewedAt,
    comment: review.comment,
  };
}

async function presentAccount(
  account: DailyAccountDoc,
  actor: UserDoc,
): Promise<PublicDailyAccount> {
  const [
    cashier,
    facility,
    managerReviewer,
    financeReviewer,
    confirmer,
    topUpsKobo,
    hasLater,
  ] = await Promise.all([
    findUserById(account.cashierId),
    findFacility(account.facilityId),
    account.managerReview.reviewedBy
      ? findUserById(account.managerReview.reviewedBy)
      : Promise.resolve(null),
    account.financeReview.reviewedBy
      ? findUserById(account.financeReview.reviewedBy)
      : Promise.resolve(null),
    account.cashReceipt.confirmedBy
      ? findUserById(account.cashReceipt.confirmedBy)
      : Promise.resolve(null),
    sumTopUpsKobo(account.cashierId, account.facilityId, account.date),
    hasLaterDailyAccount(account.cashierId, account.facilityId, account.date),
  ]);

  return {
    id: account._id,
    facilityId: account.facilityId,
    facilityName: facility?.name ?? "Unknown facility",
    cashierId: account.cashierId,
    cashierName: cashier?.name ?? "Unknown cashier",
    date: account.date,
    status: account.status,
    submittedAt: account.submittedAt,
    editable:
      actor.role === "cashier" &&
      actor._id === account.cashierId &&
      !hasLater &&
      dailyAccountEditable(account),
    hasLaterAccount: hasLater,
    summary: toPublicWalletSummary(account, topUpsKobo),
    managerReview: presentReview(
      account.managerReview,
      managerReviewer?.name ?? null,
    ),
    financeReview: presentReview(
      account.financeReview,
      financeReviewer?.name ?? null,
    ),
    cashReceipt: {
      confirmed: account.cashReceipt.confirmed,
      confirmedBy: account.cashReceipt.confirmedBy,
      confirmedByName: confirmer?.name ?? null,
      confirmedAt: account.cashReceipt.confirmedAt,
    },
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

async function carryForwardBalanceKobo(
  cashierId: string,
  facilityId: string,
  date: string,
): Promise<number> {
  const previous = await findLatestDailyAccountBefore(
    cashierId,
    facilityId,
    date,
  );

  if (!previous) {
    return 0;
  }

  if (previous.status !== "Submitted") {
    throw new AppError(
      409,
      "Submit the previous daily account before opening a new day.",
    );
  }

  const topUpsKobo = await sumTopUpsKobo(cashierId, facilityId, previous.date);
  return walletTotals(previous, topUpsKobo).expectedClosingBalanceKobo;
}

export async function getOrCreateToday(
  actor: UserDoc,
): Promise<PublicDailyAccount> {
  if (actor.role !== "cashier") {
    throw new AppError(403, "Only a cashier has a daily wallet account.");
  }

  const facilityId = actor.facilityIds[0];

  if (!facilityId) {
    throw new AppError(409, "Your account needs a facility assignment.");
  }

  const date = getToday();
  let account = await findDailyAccount(actor._id, facilityId, date);

  if (!account) {
    const openingBalanceKobo = await carryForwardBalanceKobo(
      actor._id,
      facilityId,
      date,
    );
    const at = nowIso();
    const created: DailyAccountDoc = {
      _id: randomUUID(),
      facilityId,
      cashierId: actor._id,
      date,
      openingBalanceKobo,
      bankTransfersKobo: 0,
      cashCollectedKobo: 0,
      cardPaymentsKobo: 0,
      actualClosingBalanceKobo: null,
      status: "Draft",
      submittedAt: null,
      managerReview: pendingWalletReview(),
      financeReview: pendingWalletReview(),
      cashReceipt: { confirmed: false, confirmedBy: null, confirmedAt: null },
      createdAt: at,
      updatedAt: at,
    };

    try {
      await insertDailyAccount(created);
      account = created;
    } catch (error) {
      if (!isDuplicateKey(error)) {
        throw error;
      }

      account = await findDailyAccount(actor._id, facilityId, date);

      if (!account) {
        throw error;
      }
    }
  }

  return presentAccount(account, actor);
}

export async function getDailyAccount(
  actor: UserDoc,
  accountId: string,
): Promise<PublicDailyAccount> {
  const account = await loadVisible(actor, accountId);
  return presentAccount(account, actor);
}

export async function submitDailyAccount(
  actor: UserDoc,
  accountId: string,
  input: unknown,
): Promise<PublicDailyAccount> {
  const account = await loadVisible(actor, accountId);
  assertCashierOwner(actor, account);

  if (!dailyAccountEditable(account)) {
    throw new AppError(
      409,
      "This account is submitted. A reviewer must return it before you can edit it.",
    );
  }

  if (
    await hasLaterDailyAccount(account.cashierId, account.facilityId, account.date)
  ) {
    throw new AppError(
      409,
      "A later wallet day already exists. These figures cannot be reopened because they determine the later opening balance.",
    );
  }

  if (
    await hasUnacknowledgedTopUps(
      account.cashierId,
      account.facilityId,
      account.date,
    )
  ) {
    throw new AppError(
      409,
      "Confirm receipt of every top-up for this day before submitting.",
    );
  }

  const body = asObject(input);
  const bankTransfersKobo = parseAmountKobo(body.bankTransfers);
  const cashCollectedKobo = parseAmountKobo(body.cashCollected);
  const cardPaymentsKobo = parseAmountKobo(body.cardPayments);
  const actualClosingBalanceKobo = parseAmountKobo(body.actualClosingBalance);

  const totalSpentKobo = bankTransfersKobo + cashCollectedKobo + cardPaymentsKobo;
  const topUpsKobo = await sumTopUpsKobo(
    account.cashierId,
    account.facilityId,
    account.date,
  );
  const totalAvailableKobo = account.openingBalanceKobo + topUpsKobo;

  if (totalSpentKobo > totalAvailableKobo) {
    throw new AppError(
      400,
      "Total spent cannot exceed the available wallet balance.",
    );
  }

  const at = nowIso();
  const update: Partial<DailyAccountDoc> = {
    bankTransfersKobo,
    cashCollectedKobo,
    cardPaymentsKobo,
    actualClosingBalanceKobo,
    status: "Submitted",
    submittedAt: at,
    managerReview: pendingWalletReview(),
    financeReview: pendingWalletReview(),
    cashReceipt: { confirmed: false, confirmedBy: null, confirmedAt: null },
  };

  const saved = await saveDailyAccount(account._id, account.updatedAt, update, at);

  if (!saved) {
    throw new AppError(409, "This account changed. Reload it and try again.");
  }

  const next: DailyAccountDoc = { ...account, ...update, updatedAt: at };

  await insertAudit({
    _id: randomUUID(),
    actorId: actor._id,
    actorName: actor.name,
    actorRole: actor.role,
    facilityId: account.facilityId,
    entityType: "daily_account",
    entityId: account._id,
    iteration: null,
    action: "daily_account.submitted",
    oldValue: null,
    newValue: {
      bankTransfers: koboToNaira(bankTransfersKobo),
      cashCollected: koboToNaira(cashCollectedKobo),
      cardPayments: koboToNaira(cardPaymentsKobo),
      actualClosingBalance: koboToNaira(actualClosingBalanceKobo),
    },
    reason: null,
    createdAt: at,
  });

  return presentAccount(next, actor);
}

export async function reviewDailyAccount(
  actor: UserDoc,
  accountId: string,
  input: unknown,
): Promise<PublicDailyAccount> {
  if (actor.role !== "facility_manager" && actor.role !== "finance") {
    throw new AppError(
      403,
      "Only a facility manager or finance can review this account.",
    );
  }

  const account = await loadVisible(actor, accountId);

  if (account.status !== "Submitted") {
    throw new AppError(
      409,
      "The cashier must submit this account before review.",
    );
  }

  const body = asObject(input);
  const status = parseWalletDecision(body.status);
  const comment =
    actor.role === "facility_manager"
      ? optionalText(body.comment, "Comment", 2000)
      : null;

  const topUpsKobo = await sumTopUpsKobo(
    account.cashierId,
    account.facilityId,
    account.date,
  );
  const tallies = walletTotals(account, topUpsKobo).tallies;

  if (status === "Okay" && tallies !== true) {
    throw new AppError(
      409,
      "Expected and actual wallet balances must tally before selecting Okay.",
    );
  }

  if (
    status === "Check Record" &&
    (await hasLaterDailyAccount(account.cashierId, account.facilityId, account.date))
  ) {
    throw new AppError(
      409,
      "A later wallet day already exists. These figures cannot be reopened because they determine the later opening balance.",
    );
  }

  const at = nowIso();
  let update: Partial<DailyAccountDoc>;

  if (actor.role === "facility_manager") {
    if (account.financeReview.status !== "Pending") {
      throw new AppError(409, "Finance has already reviewed this account.");
    }

    update = {
      managerReview: { status, reviewedBy: actor._id, reviewedAt: at, comment },
    };
  } else {
    if (account.managerReview.status !== "Okay") {
      throw new AppError(
        409,
        "The facility manager must mark this account Okay before finance reviews it.",
      );
    }

    update = {
      financeReview: {
        status,
        reviewedBy: actor._id,
        reviewedAt: at,
        comment: null,
      },
    };
  }

  if (status === "Check Record") {
    update = {
      ...update,
      status: "Draft",
      cashReceipt: { confirmed: false, confirmedBy: null, confirmedAt: null },
    };
  }

  const saved = await saveDailyAccount(account._id, account.updatedAt, update, at);

  if (!saved) {
    throw new AppError(409, "This account changed. Reload it and try again.");
  }

  const next: DailyAccountDoc = { ...account, ...update, updatedAt: at };

  await insertAudit({
    _id: randomUUID(),
    actorId: actor._id,
    actorName: actor.name,
    actorRole: actor.role,
    facilityId: account.facilityId,
    entityType: "daily_account",
    entityId: account._id,
    iteration: null,
    action: "daily_account.reviewed",
    oldValue: { status: "Pending" },
    newValue: { role: actor.role, status, comment },
    reason: comment,
    createdAt: at,
  });

  return presentAccount(next, actor);
}

export async function confirmCashReceived(
  actor: UserDoc,
  accountId: string,
): Promise<PublicDailyAccount> {
  if (actor.role !== "finance") {
    throw new AppError(
      403,
      "Only finance can confirm receipt of collected cash.",
    );
  }

  const account = await loadVisible(actor, accountId);

  if (account.status !== "Submitted" || account.managerReview.status !== "Okay") {
    throw new AppError(
      409,
      "The account must be submitted and marked Okay by the facility manager first.",
    );
  }

  if (account.cashCollectedKobo === 0) {
    throw new AppError(409, "There is no collected cash to confirm.");
  }

  if (account.cashReceipt.confirmed) {
    throw new AppError(409, "Cash receipt is already confirmed.");
  }

  const at = nowIso();
  const update: Partial<DailyAccountDoc> = {
    cashReceipt: { confirmed: true, confirmedBy: actor._id, confirmedAt: at },
  };

  const saved = await saveDailyAccount(account._id, account.updatedAt, update, at);

  if (!saved) {
    throw new AppError(409, "This account changed. Reload it and try again.");
  }

  const next: DailyAccountDoc = { ...account, ...update, updatedAt: at };

  await insertAudit({
    _id: randomUUID(),
    actorId: actor._id,
    actorName: actor.name,
    actorRole: actor.role,
    facilityId: account.facilityId,
    entityType: "daily_account",
    entityId: account._id,
    iteration: null,
    action: "daily_account.cash_received",
    oldValue: null,
    newValue: { cashCollected: koboToNaira(account.cashCollectedKobo) },
    reason: null,
    createdAt: at,
  });

  return presentAccount(next, actor);
}

export async function listDailyAccounts(
  actor: UserDoc,
  query: { facilityId: string | null; date: string | null },
): Promise<PublicDailyAccount[]> {
  const date = query.date ?? undefined;
  let facilityId: string | undefined;

  if (query.facilityId?.trim()) {
    facilityId = requiredId(query.facilityId, "Choose a facility.");

    if (!actor.facilityIds.includes(facilityId)) {
      throw new AppError(403, "You cannot access this facility.");
    }
  }

  let docs: DailyAccountDoc[];

  if (actor.role === "cashier") {
    docs = await listDailyAccountsQuery({
      cashierId: actor._id,
      facilityId,
      date,
    });
  } else if (actor.role === "facility_manager") {
    docs = await listDailyAccountsQuery({
      facilityIds: facilityId ? undefined : actor.facilityIds,
      facilityId,
      date,
    });
  } else {
    const cashiers = await listSupervisedCashiers(actor._id);
    docs = await listDailyAccountsQuery({
      cashierIds: cashiers.map((cashier) => cashier._id),
      facilityId,
      date,
    });
  }

  return Promise.all(docs.map((doc) => presentAccount(doc, actor)));
}
