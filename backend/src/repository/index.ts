import type { Filter } from "mongodb";
import {
  auditLogs,
  emrRecords,
  facilities,
  sessions,
  tapRecords,
  users,
} from "../database";
import { isDuplicateKey } from "../errors";
import type {
  AuditDoc,
  EmrDoc,
  FacilityDoc,
  IterationDoc,
  SessionDoc,
  TapDoc,
  UserDoc,
} from "../entity";

export async function findFacility(id: string): Promise<FacilityDoc | null> {
  return facilities().findOne({ _id: id });
}

export async function listFacilities(ids: string[]): Promise<FacilityDoc[]> {
  if (ids.length === 0) {
    return [];
  }

  return facilities()
    .find({ _id: { $in: ids } })
    .sort({ name: 1 })
    .toArray();
}

export async function findUserById(id: string): Promise<UserDoc | null> {
  return users().findOne({ _id: id });
}

export async function findUserByEmail(email: string): Promise<UserDoc | null> {
  return users().findOne({ email });
}

export async function insertUser(user: UserDoc): Promise<void> {
  await users().insertOne(user);
}

export async function listSupervisedCashiers(
  financeId: string,
): Promise<UserDoc[]> {
  return users()
    .find({ role: "cashier", supervisorIds: financeId })
    .sort({ name: 1 })
    .toArray();
}

export async function listCashiersInFacilities(
  facilityIds: string[],
): Promise<UserDoc[]> {
  if (facilityIds.length === 0) {
    return [];
  }

  return users()
    .find({ role: "cashier", facilityIds: { $in: facilityIds } })
    .sort({ name: 1 })
    .toArray();
}

export async function insertSession(session: SessionDoc): Promise<void> {
  await sessions().insertOne(session);
}

export async function findSession(tokenHash: string): Promise<SessionDoc | null> {
  return sessions().findOne({ _id: tokenHash });
}

export async function deleteSession(tokenHash: string): Promise<void> {
  await sessions().deleteOne({ _id: tokenHash });
}

export async function findTap(
  facilityId: string,
  date: string,
): Promise<TapDoc | null> {
  return tapRecords().findOne({ facilityId, date });
}

export async function listTap(
  facilityId: string,
  date?: string,
): Promise<TapDoc[]> {
  const filter: Filter<TapDoc> = { facilityId };

  if (date) {
    filter.date = date;
  }

  return tapRecords().find(filter).sort({ date: -1 }).toArray();
}

export async function insertTap(tap: TapDoc): Promise<void> {
  await tapRecords().insertOne(tap);
}

export async function updateTap(tap: TapDoc): Promise<void> {
  await tapRecords().updateOne(
    { _id: tap._id },
    {
      $set: {
        transactionCount: tap.transactionCount,
        transactionAmountKobo: tap.transactionAmountKobo,
        updatedAt: tap.updatedAt,
      },
    },
  );
}

export async function findEmrById(id: string): Promise<EmrDoc | null> {
  return emrRecords().findOne({ _id: id });
}

export async function findEmrBySlot(
  cashierId: string,
  facilityId: string,
  date: string,
): Promise<EmrDoc | null> {
  return emrRecords().findOne({ cashierId, facilityId, date });
}

export async function insertEmr(record: EmrDoc): Promise<void> {
  await emrRecords().insertOne(record);
}

export async function saveEmrIterations(
  id: string,
  expectedUpdatedAt: string,
  iterations: IterationDoc[],
  updatedAt: string,
): Promise<boolean> {
  const result = await emrRecords().updateOne(
    { _id: id, updatedAt: expectedUpdatedAt },
    { $set: { iterations, updatedAt } },
  );

  return result.matchedCount === 1;
}

export async function listEmrRecords(input: {
  cashierId?: string;
  cashierIds?: string[];
  facilityId?: string;
  facilityIds?: string[];
  date?: string;
}): Promise<EmrDoc[]> {
  if (input.cashierIds && input.cashierIds.length === 0) {
    return [];
  }

  const filter: Filter<EmrDoc> = {};

  if (input.cashierId) {
    filter.cashierId = input.cashierId;
  }

  if (input.cashierIds) {
    filter.cashierId = { $in: input.cashierIds };
  }

  if (input.facilityId) {
    filter.facilityId = input.facilityId;
  }

  if (input.facilityIds) {
    filter.facilityId = { $in: input.facilityIds };
  }

  if (input.date) {
    filter.date = input.date;
  }

  return emrRecords()
    .find(filter)
    .sort({ date: -1, createdAt: -1 })
    .limit(500)
    .toArray();
}

export async function insertAudit(entry: AuditDoc): Promise<void> {
  await auditLogs().insertOne(entry);
}

export async function listAudit(
  entityType: AuditDoc["entityType"],
  entityId: string,
): Promise<AuditDoc[]> {
  return auditLogs()
    .find({ entityType, entityId })
    .sort({ createdAt: 1 })
    .limit(1000)
    .toArray();
}

export { isDuplicateKey };
