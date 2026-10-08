import { randomUUID } from "node:crypto";
import { hashPassword } from "../auth/password";
import { AppError, isDuplicateKey } from "../errors";
import {
  asObject,
  nowIso,
  parseEmail,
  parsePassword,
  requiredId,
  requiredText,
  toPublicUser,
  type PublicUser,
  type UserDoc,
} from "../entity";
import {
  findFacility,
  insertAudit,
  insertUser,
  listCashiersInFacilities,
  listSupervisedCashiers,
} from "../repository";

async function recordAudit(
  actor: UserDoc,
  facilityId: string,
  entityId: string,
  action: string,
  newValue: unknown,
): Promise<void> {
  await insertAudit({
    _id: randomUUID(),
    actorId: actor._id,
    actorName: actor.name,
    actorRole: actor.role,
    facilityId,
    entityType: "user",
    entityId,
    iteration: null,
    action,
    oldValue: null,
    newValue,
    reason: null,
    createdAt: nowIso(),
  });
}

export async function createCashier(
  actor: UserDoc,
  input: unknown,
): Promise<PublicUser> {
  if (actor.role !== "finance") {
    throw new AppError(403, "Only finance can create cashier accounts.");
  }

  const body = asObject(input);
  const name = requiredText(body.name, "Name", 120);
  const phone = requiredText(body.phone, "Phone", 30);
  const email = parseEmail(body.email);
  const password = parsePassword(body.password);
  const facilityId = requiredId(body.facilityId, "Choose a facility.");

  if (!actor.facilityIds.includes(facilityId)) {
    throw new AppError(403, "You cannot create a cashier for this facility.");
  }

  const facility = await findFacility(facilityId);

  if (!facility) {
    throw new AppError(404, "The facility was not found.");
  }

  const cashier: UserDoc = {
    _id: randomUUID(),
    name,
    phone,
    email,
    passwordHash: hashPassword(password),
    role: "cashier",
    status: "active",
    facilityIds: [facilityId],
    supervisorIds: [actor._id],
    createdBy: actor._id,
    createdAt: nowIso(),
  };

  try {
    await insertUser(cashier);
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw new AppError(409, "An account with this email already exists.");
    }

    throw error;
  }

  await recordAudit(actor, facilityId, cashier._id, "cashier.created", {
    name,
    email,
    facilityId,
  });

  return toPublicUser(cashier);
}

export async function listCashiers(actor: UserDoc): Promise<PublicUser[]> {
  if (actor.role === "finance") {
    const cashiers = await listSupervisedCashiers(actor._id);
    return cashiers.map(toPublicUser);
  }

  if (actor.role === "facility_manager") {
    const cashiers = await listCashiersInFacilities(actor.facilityIds);
    return cashiers.map(toPublicUser);
  }

  throw new AppError(403, "You cannot list cashier accounts.");
}
