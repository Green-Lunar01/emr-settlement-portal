import type { AppData, User } from "../types";

export function getFinanceSupervisorIds(
  data: AppData,
  cashier: User,
): string[] {
  if (cashier.supervisedByFinanceIds !== undefined) {
    return cashier.supervisedByFinanceIds;
  }

  // Existing accounts inherit Finance supervision
  // from their hospital until explicitly reassigned.
  return data.users
    .filter(
      (user) =>
        user.role === "finance" &&
        user.hospitalIds.some((hospitalId) =>
          cashier.hospitalIds.includes(hospitalId),
        ),
    )
    .map((user) => user.id);
}

export function canFinanceManageCashier(
  data: AppData,
  finance: User,
  cashierId: string,
): boolean {
  if (
    finance.role !== "finance" ||
    finance.status !== "active"
  ) {
    return false;
  }

  const cashier = data.users.find(
    (user) =>
      user.id === cashierId &&
      user.role === "cashier",
  );

  return (
    !!cashier &&
    getFinanceSupervisorIds(data, cashier).includes(
      finance.id,
    )
  );
}

export function changeCashierSupervision(
  data: AppData,
  actor: User,
  cashierId: string,
  add: boolean,
): AppData {
  if (
    actor.role !== "finance" ||
    actor.status !== "active"
  ) {
    throw new Error(
      "Only Finance can change supervision.",
    );
  }

  const cashier = data.users.find(
    (user) =>
      user.id === cashierId &&
      user.role === "cashier",
  );

  if (!cashier) {
    throw new Error(
      "The cashier account was not found.",
    );
  }

  const hospitalId = cashier.hospitalIds[0];

  if (!hospitalId) {
    throw new Error(
      "The cashier needs a hospital assignment.",
    );
  }

  const supervisors = getFinanceSupervisorIds(
    data,
    cashier,
  );

  const alreadyAssigned = supervisors.includes(
    actor.id,
  );

  if (add && alreadyAssigned) {
    throw new Error(
      "This cashier is already under your supervision.",
    );
  }

  if (!add && !alreadyAssigned) {
    throw new Error(
      "This cashier is not under your supervision.",
    );
  }

  if (!add) {
    const hasOutstandingAccounts =
      data.dailyAccounts.some(
        (account) =>
          account.cashierId === cashier.id &&
          (
            account.status !== "Submitted" ||
            account.financeReview.remark !== "Okay" ||
            (
              account.cashCollected > 0 &&
              !account.cashReceipt.confirmed
            )
          ),
      );

    const hasOutstandingEmr = data.emrRecords.some(
      (record) =>
        record.cashierId === cashier.id &&
        record.financeReview.status !== "Confirmed",
    );

    const hasUnreceivedTopUps = data.topUps.some(
      (topUp) =>
        topUp.cashierId === cashier.id &&
        !topUp.acknowledged,
    );

    const anotherActiveSupervisor = supervisors.some(
      (id) =>
        id !== actor.id &&
        data.users.some(
          (user) =>
            user.id === id &&
            user.role === "finance" &&
            user.status === "active",
        ),
    );

    if (
      !anotherActiveSupervisor &&
      (
        hasOutstandingAccounts ||
        hasOutstandingEmr ||
        hasUnreceivedTopUps
      )
    ) {
      throw new Error(
        "Complete the outstanding reviews or assign another active Finance supervisor before removing yourself.",
      );
    }
  }

  cashier.supervisedByFinanceIds = add
    ? [...supervisors, actor.id]
    : supervisors.filter((id) => id !== actor.id);

  data.activityLogs.unshift({
    id: crypto.randomUUID(),
    actorId: actor.id,
    hospitalId,
    action: add
      ? `Added ${cashier.name} to Finance supervision.`
      : `Removed ${cashier.name} from Finance supervision.`,
    entityType: "user",
    entityId: cashier.id,
    createdAt: new Date().toISOString(),
  });

  return data;
}