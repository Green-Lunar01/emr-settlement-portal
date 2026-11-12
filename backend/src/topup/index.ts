import { randomUUID } from "node:crypto";
import { AppError } from "../errors";
import {
  asObject,
  getToday,
  koboToNaira,
  nowIso,
  parseAmountKobo,
  requiredId,
  toPublicTopUp,
  type PublicTopUp,
  type TopUpDoc,
  type UserDoc,
} from "../entity";
import {
  findDailyAccount,
  findFacility,
  findTopUpById,
  findUserById,
  insertAudit,
  insertTopUp,
  listSupervisedCashiers,
  listTopUpsQuery,
  markTopUpAcknowledged,
} from "../repository";

async function canAccessTopUp(
  actor: UserDoc,
  topUp: TopUpDoc,
): Promise<boolean> {
  if (actor.status !== "active") {
    return false;
  }

  if (actor.role === "cashier") {
    return topUp.cashierId === actor._id;
  }

  if (actor.role === "facility_manager") {
    return actor.facilityIds.includes(topUp.facilityId);
  }

  const cashier = await findUserById(topUp.cashierId);
  return !!cashier && cashier.supervisorIds.includes(actor._id);
}

async function presentTopUp(topUp: TopUpDoc): Promise<PublicTopUp> {
  const [cashier, issuer, facility] = await Promise.all([
    findUserById(topUp.cashierId),
    findUserById(topUp.issuedBy),
    findFacility(topUp.facilityId),
  ]);

  return toPublicTopUp(
    topUp,
    cashier?.name ?? "Unknown cashier",
    issuer?.name ?? "Unknown user",
    facility?.name ?? "Unknown facility",
  );
}

export async function issueTopUp(
  actor: UserDoc,
  input: unknown,
): Promise<PublicTopUp> {
  if (
    actor.status !== "active" ||
    (actor.role !== "finance" && actor.role !== "facility_manager")
  ) {
    throw new AppError(
      403,
      "Only finance and facility managers can issue top-ups.",
    );
  }

  const body = asObject(input);
  const cashierId = requiredId(body.cashierId, "Select a cashier.");
  const amountKobo = parseAmountKobo(body.amount);

  if (amountKobo <= 0) {
    throw new AppError(400, "Enter an amount greater than zero.");
  }

  const cashier = await findUserById(cashierId);

  if (
    !cashier ||
    cashier.role !== "cashier" ||
    cashier.status !== "active"
  ) {
    throw new AppError(404, "Select an active cashier.");
  }

  const facilityId = cashier.facilityIds[0];

  if (!facilityId || !actor.facilityIds.includes(facilityId)) {
    throw new AppError(
      403,
      "This cashier is outside your assigned facilities.",
    );
  }

  const date = getToday();
  const existingAccount = await findDailyAccount(cashierId, facilityId, date);

  if (existingAccount && existingAccount.status === "Submitted") {
    throw new AppError(
      409,
      "Today's account has already been submitted. It must be returned for correction before another top-up can be issued.",
    );
  }

  const at = nowIso();
  const topUp: TopUpDoc = {
    _id: randomUUID(),
    facilityId,
    cashierId,
    date,
    amountKobo,
    issuedBy: actor._id,
    issuedAt: at,
    acknowledged: false,
    acknowledgedAt: null,
  };

  await insertTopUp(topUp);

  await insertAudit({
    _id: randomUUID(),
    actorId: actor._id,
    actorName: actor.name,
    actorRole: actor.role,
    facilityId,
    entityType: "top_up",
    entityId: topUp._id,
    iteration: null,
    action: "topup.issued",
    oldValue: null,
    newValue: { cashierId, amount: koboToNaira(amountKobo) },
    reason: null,
    createdAt: at,
  });

  return presentTopUp(topUp);
}

export async function acknowledgeTopUp(
  actor: UserDoc,
  topUpId: string,
): Promise<PublicTopUp> {
  const topUp = await findTopUpById(topUpId);

  if (
    !topUp ||
    actor.role !== "cashier" ||
    !(await canAccessTopUp(actor, topUp))
  ) {
    throw new AppError(404, "The top-up was not found.");
  }

  if (topUp.acknowledged) {
    throw new AppError(
      409,
      "You have already acknowledged this top-up.",
    );
  }

  const at = nowIso();
  const ok = await markTopUpAcknowledged(topUpId, at);

  if (!ok) {
    throw new AppError(409, "This top-up changed. Reload and try again.");
  }

  await insertAudit({
    _id: randomUUID(),
    actorId: actor._id,
    actorName: actor.name,
    actorRole: actor.role,
    facilityId: topUp.facilityId,
    entityType: "top_up",
    entityId: topUp._id,
    iteration: null,
    action: "topup.acknowledged",
    oldValue: null,
    newValue: { acknowledgedAt: at },
    reason: null,
    createdAt: at,
  });

  return presentTopUp({ ...topUp, acknowledged: true, acknowledgedAt: at });
}

export async function listTopUps(
  actor: UserDoc,
  query: { facilityId: string | null; date: string | null },
): Promise<PublicTopUp[]> {
  const date = query.date ?? undefined;
  let facilityId: string | undefined;

  if (query.facilityId?.trim()) {
    facilityId = requiredId(query.facilityId, "Choose a facility.");

    if (!actor.facilityIds.includes(facilityId)) {
      throw new AppError(403, "You cannot access this facility.");
    }
  }

  let docs: TopUpDoc[];

  if (actor.role === "cashier") {
    docs = await listTopUpsQuery({ cashierId: actor._id, facilityId, date });
  } else if (actor.role === "facility_manager") {
    docs = await listTopUpsQuery({
      facilityIds: facilityId ? undefined : actor.facilityIds,
      facilityId,
      date,
    });
  } else {
    const cashiers = await listSupervisedCashiers(actor._id);
    docs = await listTopUpsQuery({
      cashierIds: cashiers.map((cashier) => cashier._id),
      facilityId,
      date,
    });
  }

  return Promise.all(docs.map((doc) => presentTopUp(doc)));
}
