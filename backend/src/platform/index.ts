import { randomUUID } from "node:crypto";
import { AppError } from "../errors";
import {
  asObject,
  nowIso,
  requiredText,
  toPublicAudit,
  type FacilityDoc,
  type PublicAudit,
  type UserDoc,
} from "../entity";
import {
  addFacilityToUser,
  insertAudit,
  insertFacility,
  listAuditRecent,
} from "../repository";

export async function createFacility(
  actor: UserDoc,
  input: unknown,
): Promise<{ id: string; name: string }> {
  if (actor.role !== "front_office") {
    throw new AppError(403, "Only front office can add facilities.");
  }

  const body = asObject(input);
  const name = requiredText(body.name, "Facility name", 150);

  const facility: FacilityDoc = { _id: randomUUID(), name };
  await insertFacility(facility);
  await addFacilityToUser(actor._id, facility._id);

  const at = nowIso();
  await insertAudit({
    _id: randomUUID(),
    actorId: actor._id,
    actorName: actor.name,
    actorRole: actor.role,
    facilityId: facility._id,
    entityType: "facility",
    entityId: facility._id,
    iteration: null,
    action: "facility.created",
    oldValue: null,
    newValue: { name },
    reason: null,
    createdAt: at,
  });

  return { id: facility._id, name: facility.name };
}

export async function listPlatformAudit(
  actor: UserDoc,
  query: { facilityId: string | null },
): Promise<PublicAudit[]> {
  if (actor.role !== "front_office") {
    throw new AppError(
      403,
      "Only front office can view the platform audit trail.",
    );
  }

  const facilityId = query.facilityId?.trim() || undefined;

  if (facilityId && !actor.facilityIds.includes(facilityId)) {
    throw new AppError(403, "You cannot access this facility.");
  }

  const entries = await listAuditRecent({ facilityId });
  return entries.map(toPublicAudit);
}
