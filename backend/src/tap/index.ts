import { randomUUID } from "node:crypto";
import { AppError, isDuplicateKey } from "../errors";
import {
  asObject,
  nowIso,
  parseAmountKobo,
  parseCount,
  parseDate,
  publicFigures,
  requiredId,
  toPublicTap,
  type Figures,
  type PublicTap,
  type TapDoc,
  type UserDoc,
} from "../entity";
import {
  findFacility,
  findTap,
  insertAudit,
  insertTap,
  listTap,
  updateTap,
} from "../repository";

function assertFacilityAccess(actor: UserDoc, facilityId: string): void {
  if (!actor.facilityIds.includes(facilityId)) {
    throw new AppError(403, "You cannot access this facility.");
  }
}

async function requireFacility(facilityId: string): Promise<void> {
  const facility = await findFacility(facilityId);

  if (!facility) {
    throw new AppError(404, "The facility was not found.");
  }
}

function readFigures(body: Record<string, unknown>): Figures {
  return {
    transactionCount: parseCount(body.transactionCount),
    transactionAmountKobo: parseAmountKobo(body.transactionAmount),
  };
}

export async function saveTapRecord(
  actor: UserDoc,
  input: unknown,
): Promise<PublicTap> {
  if (actor.role !== "finance") {
    throw new AppError(403, "Only finance can save TAP records.");
  }

  const body = asObject(input);
  const facilityId = requiredId(body.facilityId, "Choose a facility.");
  const date = parseDate(body.date, { allowFuture: true });
  const figures = readFigures(body);

  await requireFacility(facilityId);
  assertFacilityAccess(actor, facilityId);

  const existing = await findTap(facilityId, date);
  const at = nowIso();
  const tap: TapDoc = {
    _id: existing?._id ?? randomUUID(),
    facilityId,
    date,
    transactionCount: figures.transactionCount,
    transactionAmountKobo: figures.transactionAmountKobo,
    createdAt: existing?.createdAt ?? at,
    updatedAt: at,
  };

  try {
    if (existing) {
      await updateTap(tap);
    } else {
      await insertTap(tap);
    }
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw new AppError(409, "This TAP record changed. Try again.");
    }

    throw error;
  }

  await insertAudit({
    _id: randomUUID(),
    actorId: actor._id,
    actorName: actor.name,
    actorRole: actor.role,
    facilityId,
    entityType: "tap",
    entityId: tap._id,
    iteration: null,
    action: "tap.saved",
    oldValue: existing
      ? publicFigures({
          transactionCount: existing.transactionCount,
          transactionAmountKobo: existing.transactionAmountKobo,
        })
      : null,
    newValue: {
      date,
      ...publicFigures(figures),
    },
    reason: null,
    createdAt: at,
  });

  return toPublicTap(tap);
}

export async function listTapRecords(
  actor: UserDoc,
  query: { facilityId: string | null; date: string | null },
): Promise<PublicTap[]> {
  const facilityId = query.facilityId?.trim() ?? "";

  if (!facilityId) {
    throw new AppError(400, "Choose a facility.");
  }

  await requireFacility(facilityId);
  assertFacilityAccess(actor, facilityId);

  const date = query.date
    ? parseDate(query.date, { allowFuture: true })
    : undefined;
  const records = await listTap(facilityId, date);
  return records.map(toPublicTap);
}
