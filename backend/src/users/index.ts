import { randomUUID } from "node:crypto";
import { hashPassword } from "../auth/password";
import { AppError, isDuplicateKey } from "../errors";
import {
  asObject,
  nowIso,
  parseEmail,
  parsePassword,
  parseStaffRole,
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
  listStaffInFacilities,
  listSupervisedCashiers,
  listUsersByFacilityAndRole,
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

export async function createStaffAccount(
  actor: UserDoc,
  input: unknown,
): Promise<PublicUser> {
  if (actor.role !== "front_office") {
    throw new AppError(403, "Only front office can create staff accounts.");
  }

  const body = asObject(input);
  const role = parseStaffRole(body.role);
  const name = requiredText(body.name, "Name", 120);
  const phone = requiredText(body.phone, "Phone", 30);
  const email = parseEmail(body.email);
  const password = parsePassword(body.password);
  const facilityId = requiredId(body.facilityId, "Choose a facility.");

  if (!actor.facilityIds.includes(facilityId)) {
    throw new AppError(403, "You cannot create an account for this facility.");
  }

  const facility = await findFacility(facilityId);

  if (!facility) {
    throw new AppError(404, "The facility was not found.");
  }

  // A cashier's EMR/wallet/bill submissions are reviewed by whichever
  // finance users are assigned to the same facility, since front office
  // (the account creator) has no financial review role of its own.
  const supervisorIds =
    role === "cashier"
      ? (await listUsersByFacilityAndRole(facilityId, "finance")).map(
          (user) => user._id,
        )
      : [];

  const staff: UserDoc = {
    _id: randomUUID(),
    name,
    phone,
    email,
    passwordHash: hashPassword(password),
    role,
    status: "active",
    facilityIds: [facilityId],
    supervisorIds,
    createdBy: actor._id,
    createdAt: nowIso(),
  };

  try {
    await insertUser(staff);
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw new AppError(409, "An account with this email already exists.");
    }

    throw error;
  }

  await recordAudit(actor, facilityId, staff._id, `${role}.created`, {
    name,
    email,
    facilityId,
  });

  return toPublicUser(staff);
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

  if (actor.role === "front_office") {
    const staff = await listStaffInFacilities(actor.facilityIds);
    return staff.map(toPublicUser);
  }

  throw new AppError(403, "You cannot list staff accounts.");
}
