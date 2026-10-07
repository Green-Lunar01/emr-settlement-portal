import type {
  AppData,
  EmrRecord,
  ReviewStatus,
  User,
} from "../types";

import {
  canCashierEditEmr,
  compareEmrRecord,
  createPendingReview,
  getToday,
  roundMoney,
} from "./accounting";

import { canFinanceManageCashier } from "./supervision";

export interface EmrInput {
  date: string;
  emrTransactions: number;
  emrAmount: number;
  tapTransactions: number;
  tapAmount: number;
}

export function canAccessEmr(
  user: User,
  record: EmrRecord,
  data: AppData,
): boolean {
  if (user.status !== "active") return false;

  if (user.role === "cashier") {
    return record.cashierId === user.id;
  }

  if (user.role === "finance") {
    return canFinanceManageCashier(
      data,
      user,
      record.cashierId,
    );
  }

  return user.hospitalIds.includes(record.hospitalId);
}

function addActivity(
  data: AppData,
  actor: User,
  record: EmrRecord,
  action: string,
): void {
  data.activityLogs.unshift({
    id: crypto.randomUUID(),
    actorId: actor.id,
    hospitalId: record.hospitalId,
    action,
    entityType: "emr",
    entityId: record.id,
    createdAt: new Date().toISOString(),
  });
}

export function submitEmrRecord(
  data: AppData,
  actor: User,
  input: EmrInput,
  recordId?: string,
): AppData {
  if (
    actor.role !== "cashier" ||
    actor.status !== "active"
  ) {
    throw new Error("Only active cashiers can submit EMR data.");
  }

  const parsedDate = new Date(`${input.date}T00:00:00Z`);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.date) ||
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== input.date ||
    input.date > getToday()
  ) {
    throw new Error(
      "Select a valid date that is not in the future.",
    );
  }

  if (
    [input.emrTransactions, input.tapTransactions].some(
      (value) => !Number.isSafeInteger(value) || value < 0,
    )
  ) {
    throw new Error(
      "Transaction counts must be whole numbers of zero or more.",
    );
  }

  if (
    [input.emrAmount, input.tapAmount].some(
      (value) =>
        !Number.isFinite(value) ||
        value < 0 ||
        Math.abs(value * 100 - Math.round(value * 100)) >
          0.000001,
    )
  ) {
    throw new Error(
      "Amounts must be zero or more, with no more than two decimal places.",
    );
  }

  const existing = recordId
    ? data.emrRecords.find((record) => record.id === recordId)
    : undefined;

  if (recordId && !existing) {
    throw new Error("The record was not found.");
  }

  if (existing) {
    if (!canAccessEmr(actor, existing, data)) {
      throw new Error("You cannot edit this record.");
    }

    if (!canCashierEditEmr(existing)) {
      throw new Error(
        "This record is locked after Facility Manager confirmation.",
      );
    }

    if (existing.date !== input.date) {
      throw new Error(
        "An existing record's date cannot be changed.",
      );
    }
  }

  const hospitalId =
    existing?.hospitalId ?? actor.hospitalIds[0];

  if (!hospitalId) {
    throw new Error("Your account needs a hospital assignment.");
  }

  if (
    data.emrRecords.some(
      (record) =>
        record.cashierId === actor.id &&
        record.date === input.date &&
        record.id !== recordId,
    )
  ) {
    throw new Error(
      "An EMR record already exists for this date. Open it to make any permitted correction.",
    );
  }

  const now = new Date().toISOString();

  const record: EmrRecord = {
    id: existing?.id ?? crypto.randomUUID(),
    hospitalId,
    cashierId: actor.id,
    date: input.date,

    emr: {
      numberOfTransactions: input.emrTransactions,
      amountForDay: roundMoney(input.emrAmount),
    },

    tap: {
      numberOfTransactions: input.tapTransactions,
      amountForDay: roundMoney(input.tapAmount),
    },

    cashierRemark: "Good",
    facilityManagerReview: createPendingReview(),
    financeReview: createPendingReview(),

    resolution: existing?.resolution ?? "",
    resolutionBy: existing?.resolutionBy ?? null,
    resolutionAt: existing?.resolutionAt ?? null,

    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  record.cashierRemark = compareEmrRecord(record).tallies
    ? "Good"
    : "Check Record";

  if (existing) {
    const index = data.emrRecords.findIndex(
      (item) => item.id === existing.id,
    );

    data.emrRecords[index] = record;
  } else {
    data.emrRecords.unshift(record);
  }

  addActivity(
    data,
    actor,
    record,
    existing
      ? `Corrected and resubmitted EMR record for ${record.date}. Previous reviews reset to Pending.`
      : `Submitted EMR record for ${record.date}.`,
  );

  return data;
}

export function reviewEmrRecord(
  data: AppData,
  actor: User,
  recordId: string,
  status: Exclude<ReviewStatus, "Pending">,
  comment: string = "",
): AppData {
  const record = data.emrRecords.find(
    (item) => item.id === recordId,
  );

  if (!record) {
    throw new Error("The record was not found.");
  }

  if (
    actor.role === "cashier" ||
    !canAccessEmr(actor, record, data)
  ) {
    throw new Error("You cannot review this record.");
  }

  if (
    status !== "Confirmed" &&
    status !== "Not Confirmed"
  ) {
    throw new Error("Select a valid review decision.");
  }

  if (
    status === "Confirmed" &&
    !compareEmrRecord(record).tallies
  ) {
    throw new Error(
      "EMR and TAP must tally before confirmation.",
    );
  }

  const now = new Date().toISOString();
  const trimmedComment = comment.trim();

  if (actor.role === "facility_manager") {
    if (record.financeReview.status !== "Pending") {
      throw new Error(
        "Finance has reviewed this record. A returned record must be resubmitted by the cashier before another Manager review.",
      );
    }

    record.facilityManagerReview = {
      status,
      reviewedBy: actor.id,
      reviewedAt: now,
      comment: trimmedComment,
    };
  } else {
    if (record.facilityManagerReview.status === "Pending") {
      throw new Error(
        "The Facility Manager must review this record first.",
      );
    }

    if (
      status === "Confirmed" &&
      record.facilityManagerReview.status !== "Confirmed"
    ) {
      throw new Error(
        "Facility Manager confirmation is required first.",
      );
    }

    record.financeReview = {
      status,
      reviewedBy: actor.id,
      reviewedAt: now,
    };
  }

  record.updatedAt = now;

  addActivity(
    data,
    actor,
    record,
    `${
      actor.role === "finance"
        ? "Finance"
        : "Facility Manager"
    } marked EMR record for ${record.date} as ${status}.${
      actor.role === "facility_manager" && trimmedComment
        ? ` Comment: ${trimmedComment}`
        : ""
    }`,
  );

  return data;
}

export function saveEmrResolution(
  data: AppData,
  actor: User,
  recordId: string,
  resolution: string,
): AppData {
  const record = data.emrRecords.find(
    (item) => item.id === recordId,
  );

  if (!record) {
    throw new Error("The record was not found.");
  }

  if (
    actor.role !== "finance" ||
    !canAccessEmr(actor, record, data)
  ) {
    throw new Error("Only Finance can enter a resolution.");
  }

  const text = resolution.trim();

  if (!text) {
    throw new Error("Enter the resolution details.");
  }

  const now = new Date().toISOString();

  record.resolution = text;
  record.resolutionBy = actor.id;
  record.resolutionAt = now;
  record.updatedAt = now;

  addActivity(
    data,
    actor,
    record,
    `Saved resolution for EMR record dated ${record.date}: ${text}`,
  );

  return data;
}