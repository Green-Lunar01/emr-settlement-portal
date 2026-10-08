import { randomUUID } from "node:crypto";
import { AppError, isDuplicateKey } from "../errors";
import {
  asObject,
  compareFigures,
  currentIteration,
  iterationEditable,
  lockMessage,
  nowIso,
  optionalText,
  parseAmountKobo,
  parseCount,
  parseDate,
  parseDecision,
  pendingFinanceReview,
  pendingManagerReview,
  publicComparison,
  publicFigures,
  requiredId,
  toPublicAudit,
  toPublicEmr,
  type AuditDoc,
  type EmrDoc,
  type Figures,
  type IterationDoc,
  type PublicAudit,
  type PublicEmr,
  type UserDoc,
} from "../entity";
import {
  findEmrById,
  findEmrBySlot,
  findFacility,
  findTap,
  findUserById,
  insertAudit,
  insertEmr,
  listAudit,
  listEmrRecords,
  listSupervisedCashiers,
  saveEmrIterations,
} from "../repository";

function readFigures(body: Record<string, unknown>): Figures {
  return {
    transactionCount: parseCount(body.transactionCount),
    transactionAmountKobo: parseAmountKobo(body.transactionAmount),
  };
}

function copyFigures(figures: Figures): Figures {
  return {
    transactionCount: figures.transactionCount,
    transactionAmountKobo: figures.transactionAmountKobo,
  };
}

function newIteration(
  number: number,
  figures: Figures,
  correctionStatus: IterationDoc["correctionStatus"],
  at: string,
): IterationDoc {
  return {
    number,
    submissionStatus: "Draft",
    emr: copyFigures(figures),
    tap: null,
    comparison: null,
    managerReview: pendingManagerReview(),
    financeReview: pendingFinanceReview(),
    financeResolution: null,
    correctionStatus,
    submittedAt: null,
    createdAt: at,
    updatedAt: at,
  };
}

async function canView(actor: UserDoc, record: EmrDoc): Promise<boolean> {
  if (actor.status !== "active") {
    return false;
  }

  if (actor.role === "cashier") {
    return record.cashierId === actor._id;
  }

  if (actor.role === "facility_manager") {
    return actor.facilityIds.includes(record.facilityId);
  }

  if (actor.role === "finance") {
    const cashier = await findUserById(record.cashierId);
    return !!cashier && cashier.supervisorIds.includes(actor._id);
  }

  return false;
}

async function loadVisible(actor: UserDoc, recordId: string): Promise<EmrDoc> {
  const record = await findEmrById(recordId);

  if (!record || !(await canView(actor, record))) {
    throw new AppError(404, "The record was not found.");
  }

  return record;
}

function assertCashierOwner(actor: UserDoc, record: EmrDoc): void {
  if (actor.role !== "cashier" || actor._id !== record.cashierId) {
    throw new AppError(
      403,
      "Only the cashier who created this record can change it.",
    );
  }
}

async function requireTapFigures(
  facilityId: string,
  date: string,
): Promise<Figures> {
  const tap = await findTap(facilityId, date);

  if (!tap) {
    throw new AppError(
      409,
      "No TAP record exists for this facility and date.",
    );
  }

  return {
    transactionCount: tap.transactionCount,
    transactionAmountKobo: tap.transactionAmountKobo,
  };
}

async function persist(
  record: EmrDoc,
  iterations: IterationDoc[],
  updatedAt: string,
): Promise<EmrDoc> {
  const saved = await saveEmrIterations(
    record._id,
    record.updatedAt,
    iterations,
    updatedAt,
  );

  if (!saved) {
    throw new AppError(409, "This record changed. Reload it and try again.");
  }

  return { ...record, iterations, updatedAt };
}

async function recordAudit(
  actor: UserDoc,
  record: EmrDoc,
  iteration: number,
  action: string,
  oldValue: unknown,
  newValue: unknown,
  reason: string | null,
): Promise<void> {
  const entry: AuditDoc = {
    _id: randomUUID(),
    actorId: actor._id,
    actorName: actor.name,
    actorRole: actor.role,
    facilityId: record.facilityId,
    entityType: "emr",
    entityId: record._id,
    iteration,
    action,
    oldValue,
    newValue,
    reason,
    createdAt: nowIso(),
  };

  await insertAudit(entry);
}

function replaceCurrent(record: EmrDoc, next: IterationDoc): IterationDoc[] {
  return [...record.iterations.slice(0, -1), next];
}

async function presentRecord(
  record: EmrDoc,
  actor: UserDoc,
): Promise<PublicEmr> {
  const presented = toPublicEmr(record, actor);
  const [cashier, facility] = await Promise.all([
    findUserById(record.cashierId),
    findFacility(record.facilityId),
  ]);

  return {
    ...presented,
    cashierName: cashier?.name ?? "Unknown cashier",
    facilityName: facility?.name ?? "Unknown facility",
  };
}

async function presentRecords(
  records: EmrDoc[],
  actor: UserDoc,
): Promise<PublicEmr[]> {
  return Promise.all(records.map((record) => presentRecord(record, actor)));
}

export async function createDraft(
  actor: UserDoc,
  input: unknown,
): Promise<PublicEmr> {
  if (actor.role !== "cashier") {
    throw new AppError(403, "Only a cashier can enter EMR figures.");
  }

  const body = asObject(input);
  const facilityId = requiredId(body.facilityId, "Choose a facility.");
  const date = parseDate(body.date);
  const figures = readFigures(body);

  if (!actor.facilityIds.includes(facilityId)) {
    throw new AppError(403, "You cannot enter EMR figures for this facility.");
  }

  const facility = await findFacility(facilityId);

  if (!facility) {
    throw new AppError(404, "The facility was not found.");
  }

  const existing = await findEmrBySlot(actor._id, facilityId, date);

  if (existing) {
    throw new AppError(
      409,
      "An EMR record already exists for this date. Open it to make any permitted correction.",
    );
  }

  const at = nowIso();
  const record: EmrDoc = {
    _id: randomUUID(),
    facilityId,
    cashierId: actor._id,
    date,
    iterations: [newIteration(1, figures, "None", at)],
    createdAt: at,
    updatedAt: at,
  };

  try {
    await insertEmr(record);
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw new AppError(
        409,
        "An EMR record already exists for this date. Open it to make any permitted correction.",
      );
    }

    throw error;
  }

  await recordAudit(
    actor,
    record,
    1,
    "emr.created",
    null,
    publicFigures(figures),
    null,
  );

  return presentRecord(record, actor);
}

export async function updateFigures(
  actor: UserDoc,
  recordId: string,
  input: unknown,
): Promise<PublicEmr> {
  const record = await loadVisible(actor, recordId);
  assertCashierOwner(actor, record);

  const current = currentIteration(record);

  if (!iterationEditable(current)) {
    throw new AppError(409, lockMessage(current));
  }

  const figures = readFigures(asObject(input));
  const at = nowIso();
  let next: IterationDoc = {
    ...current,
    emr: figures,
    updatedAt: at,
  };

  if (current.submissionStatus === "Submitted") {
    const tap = await requireTapFigures(record.facilityId, record.date);
    next = {
      ...next,
      tap,
      comparison: compareFigures(figures, tap),
    };
  }

  const saved = await persist(record, replaceCurrent(record, next), at);

  await recordAudit(
    actor,
    saved,
    next.number,
    "emr.figures_updated",
    {
      ...publicFigures(current.emr),
      comparison: current.comparison
        ? publicComparison(current.comparison)
        : null,
    },
    {
      ...publicFigures(figures),
      comparison: next.comparison ? publicComparison(next.comparison) : null,
    },
    null,
  );

  return presentRecord(saved, actor);
}

export async function submitEmr(
  actor: UserDoc,
  recordId: string,
): Promise<PublicEmr> {
  const record = await loadVisible(actor, recordId);
  assertCashierOwner(actor, record);

  const current = currentIteration(record);

  if (current.submissionStatus !== "Draft") {
    throw new AppError(409, "This record has already been submitted.");
  }

  const tap = await requireTapFigures(record.facilityId, record.date);
  const comparison = compareFigures(current.emr, tap);
  const at = nowIso();
  const next: IterationDoc = {
    ...current,
    submissionStatus: "Submitted",
    tap,
    comparison,
    managerReview: pendingManagerReview(),
    financeReview: pendingFinanceReview(),
    financeResolution: null,
    correctionStatus: "None",
    submittedAt: at,
    updatedAt: at,
  };

  const saved = await persist(record, replaceCurrent(record, next), at);

  await recordAudit(
    actor,
    saved,
    next.number,
    "emr.submitted",
    null,
    {
      ...publicFigures(current.emr),
      tap: publicFigures(tap),
      comparison: publicComparison(comparison),
    },
    null,
  );

  return presentRecord(saved, actor);
}

export async function reviewAsManager(
  actor: UserDoc,
  recordId: string,
  input: unknown,
): Promise<PublicEmr> {
  if (actor.role !== "facility_manager") {
    throw new AppError(403, "Only a facility manager can review this record.");
  }

  const record = await loadVisible(actor, recordId);
  const current = currentIteration(record);

  if (current.submissionStatus !== "Submitted") {
    throw new AppError(409, "Submit the EMR record before review.");
  }

  if (current.managerReview.status !== "Pending") {
    throw new AppError(
      409,
      "The facility manager has already reviewed this record.",
    );
  }

  const body = asObject(input);
  const decision = parseDecision(body.status);
  const comment = optionalText(body.comment, "Comment", 2000);
  const at = nowIso();
  const next: IterationDoc = {
    ...current,
    managerReview: {
      status: decision,
      reviewedBy: actor._id,
      reviewedAt: at,
      comment,
    },
    updatedAt: at,
  };

  const saved = await persist(record, replaceCurrent(record, next), at);

  await recordAudit(
    actor,
    saved,
    next.number,
    "manager.reviewed",
    { status: "Pending" },
    { status: decision, comment },
    comment,
  );

  return presentRecord(saved, actor);
}

export async function reviewAsFinance(
  actor: UserDoc,
  recordId: string,
  input: unknown,
): Promise<PublicEmr> {
  if (actor.role !== "finance") {
    throw new AppError(403, "Only finance can verify this record.");
  }

  const record = await loadVisible(actor, recordId);
  const current = currentIteration(record);

  if (current.submissionStatus !== "Submitted") {
    throw new AppError(409, "Submit the EMR record before review.");
  }

  if (current.managerReview.status === "Pending") {
    throw new AppError(
      409,
      "The facility manager must review this record first.",
    );
  }

  if (current.financeReview.status !== "Pending") {
    throw new AppError(409, "Finance has already reviewed this record.");
  }

  const body = asObject(input);
  const decision = parseDecision(body.status);
  const resolution = optionalText(body.resolution, "Resolution", 4000);

  if (decision === "Not Confirmed" && !resolution) {
    throw new AppError(400, "Enter the resolution details.");
  }

  const at = nowIso();
  const reviewed: IterationDoc = {
    ...current,
    financeReview: {
      status: decision,
      reviewedBy: actor._id,
      reviewedAt: at,
    },
    financeResolution: resolution
      ? { text: resolution, by: actor._id, at }
      : null,
    updatedAt: at,
  };

  let iterations = replaceCurrent(record, reviewed);

  if (decision === "Not Confirmed") {
    iterations = [
      ...iterations,
      newIteration(
        current.number + 1,
        current.emr,
        "Returned",
        at,
      ),
    ];
  }

  const saved = await persist(record, iterations, at);

  await recordAudit(
    actor,
    saved,
    current.number,
    "finance.reviewed",
    { status: "Pending" },
    {
      status: decision,
      resolution,
      nextIteration: decision === "Not Confirmed" ? current.number + 1 : null,
    },
    resolution,
  );

  return presentRecord(saved, actor);
}

export async function getRecord(
  actor: UserDoc,
  recordId: string,
): Promise<PublicEmr> {
  const record = await loadVisible(actor, recordId);
  return presentRecord(record, actor);
}

export async function listRecords(
  actor: UserDoc,
  query: { facilityId: string | null; date: string | null },
): Promise<PublicEmr[]> {
  const date = query.date ? parseDate(query.date, { allowFuture: true }) : undefined;
  let facilityId: string | undefined;

  if (query.facilityId?.trim()) {
    facilityId = requiredId(query.facilityId, "Choose a facility.");
    const facility = await findFacility(facilityId);

    if (!facility) {
      throw new AppError(404, "The facility was not found.");
    }

    if (!actor.facilityIds.includes(facilityId)) {
      throw new AppError(403, "You cannot access this facility.");
    }
  }

  if (actor.role === "cashier") {
    const records = await listEmrRecords({
      cashierId: actor._id,
      facilityId,
      date,
    });
    return presentRecords(records, actor);
  }

  if (actor.role === "facility_manager") {
    const records = await listEmrRecords({
      facilityIds: facilityId ? undefined : actor.facilityIds,
      facilityId,
      date,
    });
    return presentRecords(records, actor);
  }

  const cashiers = await listSupervisedCashiers(actor._id);
  const records = await listEmrRecords({
    cashierIds: cashiers.map((cashier) => cashier._id),
    facilityId,
    date,
  });
  return presentRecords(records, actor);
}

export async function getAudit(
  actor: UserDoc,
  recordId: string,
): Promise<PublicAudit[]> {
  await loadVisible(actor, recordId);
  const entries = await listAudit("emr", recordId);
  return entries.map(toPublicAudit);
}
