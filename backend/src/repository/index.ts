import type { Filter } from "mongodb";
import {
  auditLogs,
  bills,
  dailyAccounts,
  departments,
  emrRecords,
  facilities,
  onboardingRequests,
  patients,
  serviceItems,
  sessions,
  tapRecords,
  topUps,
  users,
} from "../database";
import { isDuplicateKey } from "../errors";
import type {
  AuditDoc,
  BillDoc,
  DailyAccountDoc,
  DepartmentDoc,
  EmrDoc,
  FacilityDoc,
  IterationDoc,
  OnboardingRequestDoc,
  PatientDoc,
  ServiceItemDoc,
  SessionDoc,
  TapDoc,
  TopUpDoc,
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

export async function listAllFacilities(): Promise<FacilityDoc[]> {
  return facilities().find({}).sort({ name: 1 }).toArray();
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

export async function setUserStatus(
  userId: string,
  status: UserDoc["status"],
): Promise<boolean> {
  const result = await users().updateOne({ _id: userId }, { $set: { status } });
  return result.matchedCount === 1;
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

export async function listUsersByFacilityAndRole(
  facilityId: string,
  role: UserDoc["role"],
): Promise<UserDoc[]> {
  return users().find({ role, facilityIds: facilityId }).toArray();
}

export async function listStaffInFacilities(
  facilityIds: string[],
): Promise<UserDoc[]> {
  if (facilityIds.length === 0) {
    return [];
  }

  return users()
    .find({ facilityIds: { $in: facilityIds } })
    .sort({ role: 1, name: 1 })
    .toArray();
}

export async function insertFacility(facility: FacilityDoc): Promise<void> {
  await facilities().insertOne(facility);
}

export async function addFacilityToUser(
  userId: string,
  facilityId: string,
): Promise<void> {
  await users().updateOne(
    { _id: userId },
    { $addToSet: { facilityIds: facilityId } },
  );
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

export async function listAuditRecent(input: {
  facilityId?: string;
}): Promise<AuditDoc[]> {
  const filter: Filter<AuditDoc> = {};

  if (input.facilityId) {
    filter.facilityId = input.facilityId;
  }

  return auditLogs()
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(500)
    .toArray();
}

export async function insertTopUp(topUp: TopUpDoc): Promise<void> {
  await topUps().insertOne(topUp);
}

export async function findTopUpById(id: string): Promise<TopUpDoc | null> {
  return topUps().findOne({ _id: id });
}

export async function sumTopUpsKobo(
  cashierId: string,
  facilityId: string,
  date: string,
): Promise<number> {
  const docs = await topUps().find({ cashierId, facilityId, date }).toArray();
  return docs.reduce((total, doc) => total + doc.amountKobo, 0);
}

export async function hasUnacknowledgedTopUps(
  cashierId: string,
  facilityId: string,
  date: string,
): Promise<boolean> {
  const found = await topUps().findOne({
    cashierId,
    facilityId,
    date,
    acknowledged: false,
  });

  return !!found;
}

export async function markTopUpAcknowledged(
  id: string,
  at: string,
): Promise<boolean> {
  const result = await topUps().updateOne(
    { _id: id, acknowledged: false },
    { $set: { acknowledged: true, acknowledgedAt: at } },
  );

  return result.matchedCount === 1;
}

export async function listTopUpsQuery(input: {
  cashierId?: string;
  cashierIds?: string[];
  facilityId?: string;
  facilityIds?: string[];
  date?: string;
}): Promise<TopUpDoc[]> {
  if (input.cashierIds && input.cashierIds.length === 0) {
    return [];
  }

  const filter: Filter<TopUpDoc> = {};

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

  return topUps()
    .find(filter)
    .sort({ issuedAt: -1 })
    .limit(500)
    .toArray();
}

export async function findDailyAccount(
  cashierId: string,
  facilityId: string,
  date: string,
): Promise<DailyAccountDoc | null> {
  return dailyAccounts().findOne({ cashierId, facilityId, date });
}

export async function findDailyAccountById(
  id: string,
): Promise<DailyAccountDoc | null> {
  return dailyAccounts().findOne({ _id: id });
}

export async function findLatestDailyAccountBefore(
  cashierId: string,
  facilityId: string,
  date: string,
): Promise<DailyAccountDoc | null> {
  return dailyAccounts()
    .find({ cashierId, facilityId, date: { $lt: date } })
    .sort({ date: -1 })
    .limit(1)
    .next();
}

export async function hasLaterDailyAccount(
  cashierId: string,
  facilityId: string,
  date: string,
): Promise<boolean> {
  const found = await dailyAccounts().findOne({
    cashierId,
    facilityId,
    date: { $gt: date },
  });

  return !!found;
}

export async function insertDailyAccount(
  account: DailyAccountDoc,
): Promise<void> {
  await dailyAccounts().insertOne(account);
}

export async function saveDailyAccount(
  id: string,
  expectedUpdatedAt: string,
  update: Partial<DailyAccountDoc>,
  updatedAt: string,
): Promise<boolean> {
  const result = await dailyAccounts().updateOne(
    { _id: id, updatedAt: expectedUpdatedAt },
    { $set: { ...update, updatedAt } },
  );

  return result.matchedCount === 1;
}

export async function listDailyAccountsQuery(input: {
  cashierId?: string;
  cashierIds?: string[];
  facilityId?: string;
  facilityIds?: string[];
  date?: string;
}): Promise<DailyAccountDoc[]> {
  if (input.cashierIds && input.cashierIds.length === 0) {
    return [];
  }

  const filter: Filter<DailyAccountDoc> = {};

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

  return dailyAccounts()
    .find(filter)
    .sort({ date: -1, createdAt: -1 })
    .limit(500)
    .toArray();
}

export async function insertDepartment(department: DepartmentDoc): Promise<void> {
  await departments().insertOne(department);
}

export async function findDepartment(id: string): Promise<DepartmentDoc | null> {
  return departments().findOne({ _id: id });
}

export async function listDepartmentsByFacility(
  facilityId: string,
): Promise<DepartmentDoc[]> {
  return departments()
    .find({ facilityId })
    .sort({ name: 1 })
    .toArray();
}

export async function setDepartmentActive(
  id: string,
  active: boolean,
  updatedAt: string,
): Promise<boolean> {
  const result = await departments().updateOne(
    { _id: id },
    { $set: { active, updatedAt } },
  );

  return result.matchedCount === 1;
}

export async function insertBill(bill: BillDoc): Promise<void> {
  await bills().insertOne(bill);
}

export async function findBillById(id: string): Promise<BillDoc | null> {
  return bills().findOne({ _id: id });
}

export async function findBillByReceiptNumber(
  receiptNumber: string,
): Promise<BillDoc | null> {
  return bills().findOne({ receiptNumber });
}

export async function saveBill(
  id: string,
  expectedUpdatedAt: string,
  update: Partial<BillDoc>,
  updatedAt: string,
): Promise<boolean> {
  const result = await bills().updateOne(
    { _id: id, updatedAt: expectedUpdatedAt },
    { $set: { ...update, updatedAt } },
  );

  return result.matchedCount === 1;
}

export async function listBillsQuery(input: {
  facilityId?: string;
  facilityIds?: string[];
  departmentId?: string;
  patientId?: string;
}): Promise<BillDoc[]> {
  const filter: Filter<BillDoc> = {};

  if (input.facilityId) {
    filter.facilityId = input.facilityId;
  }

  if (input.facilityIds) {
    filter.facilityId = { $in: input.facilityIds };
  }

  if (input.departmentId) {
    filter.departmentId = input.departmentId;
  }

  if (input.patientId) {
    filter.patientId = input.patientId;
  }

  return bills()
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(500)
    .toArray();
}

export async function insertOnboardingRequest(
  request: OnboardingRequestDoc,
): Promise<void> {
  await onboardingRequests().insertOne(request);
}

export async function findOnboardingRequestById(
  id: string,
): Promise<OnboardingRequestDoc | null> {
  return onboardingRequests().findOne({ _id: id });
}

export async function findPendingOnboardingRequestByEmail(
  email: string,
): Promise<OnboardingRequestDoc | null> {
  return onboardingRequests().findOne({ email, status: "Pending" });
}

export async function listOnboardingRequestsByFacilities(
  facilityIds: string[],
  status?: OnboardingRequestDoc["status"],
): Promise<OnboardingRequestDoc[]> {
  if (facilityIds.length === 0) {
    return [];
  }

  const filter: Filter<OnboardingRequestDoc> = {
    facilityId: { $in: facilityIds },
  };

  if (status) {
    filter.status = status;
  }

  return onboardingRequests()
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(500)
    .toArray();
}

export async function saveOnboardingRequest(
  id: string,
  expectedUpdatedAt: string,
  update: Partial<OnboardingRequestDoc>,
  updatedAt: string,
): Promise<boolean> {
  const result = await onboardingRequests().updateOne(
    { _id: id, updatedAt: expectedUpdatedAt },
    { $set: { ...update, updatedAt } },
  );

  return result.matchedCount === 1;
}

export async function insertPatient(patient: PatientDoc): Promise<void> {
  await patients().insertOne(patient);
}

export async function findPatientById(id: string): Promise<PatientDoc | null> {
  return patients().findOne({ _id: id });
}

export async function findPatientByPhone(
  facilityId: string,
  phone: string,
): Promise<PatientDoc | null> {
  return patients().findOne({ facilityId, phone });
}

export async function findPatientByUniqueId(
  uniqueId: string,
): Promise<PatientDoc | null> {
  return patients().findOne({ uniqueId });
}

export async function searchPatientsByFacility(
  facilityId: string,
  term: string,
): Promise<PatientDoc[]> {
  return patients()
    .find({
      facilityId,
      $or: [
        { phone: term },
        { uniqueId: term.toUpperCase() },
        { name: { $regex: term, $options: "i" } },
      ],
    })
    .limit(20)
    .toArray();
}

export async function insertServiceItem(item: ServiceItemDoc): Promise<void> {
  await serviceItems().insertOne(item);
}

export async function findServiceItemById(
  id: string,
): Promise<ServiceItemDoc | null> {
  return serviceItems().findOne({ _id: id });
}

export async function listServiceItemsByFacility(
  facilityId: string,
): Promise<ServiceItemDoc[]> {
  return serviceItems()
    .find({ facilityId })
    .sort({ name: 1 })
    .toArray();
}

export async function setServiceItemActive(
  id: string,
  active: boolean,
  updatedAt: string,
): Promise<boolean> {
  const result = await serviceItems().updateOne(
    { _id: id },
    { $set: { active, updatedAt } },
  );

  return result.matchedCount === 1;
}

export { isDuplicateKey };
