import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { AppError } from "../errors";
import {
  asObject,
  koboToNaira,
  nowIso,
  optionalText,
  parseAmountKobo,
  parsePaymentMethod,
  requiredId,
  requiredText,
  toPublicBill,
  type BillDoc,
  type PublicBill,
  type UserDoc,
} from "../entity";
import {
  findBillById,
  findDepartment,
  findFacility,
  findUserById,
  insertAudit,
  insertBill,
  listBillsQuery,
  listSupervisedCashiers,
  saveBill,
} from "../repository";

// Placeholder for the real TAP virtual-account API. Once TAP exposes an
// endpoint to mint a one-time collection account, replace this with that
// call (passing the bill's reference and amount) instead of generating a
// local mock account number.
function generateTapVirtualAccount(reference: string): {
  accountNumber: string;
  bankName: string;
  reference: string;
} {
  const accountNumber = Array.from({ length: 10 }, () =>
    randomInt(0, 10),
  ).join("");

  return {
    accountNumber,
    bankName: "TAP Settlement Bank",
    reference,
  };
}

function generateReceiptNumber(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = randomBytes(3).toString("hex").toUpperCase();
  return `RCPT-${stamp}-${random}`;
}

async function canAccessBill(actor: UserDoc, bill: BillDoc): Promise<boolean> {
  if (actor.status !== "active") {
    return false;
  }

  if (actor.role === "cashier") {
    return bill.cashierId === actor._id;
  }

  if (actor.role === "facility_manager") {
    return actor.facilityIds.includes(bill.facilityId);
  }

  if (actor.role === "finance") {
    const cashier = await findUserById(bill.cashierId);
    return !!cashier && cashier.supervisorIds.includes(actor._id);
  }

  return false;
}

async function loadVisible(actor: UserDoc, billId: string): Promise<BillDoc> {
  const bill = await findBillById(billId);

  if (!bill || !(await canAccessBill(actor, bill))) {
    throw new AppError(404, "The bill was not found.");
  }

  return bill;
}

function assertCashierOwner(actor: UserDoc, bill: BillDoc): void {
  if (actor.role !== "cashier" || actor._id !== bill.cashierId) {
    throw new AppError(
      403,
      "Only the cashier who raised this bill can change it.",
    );
  }
}

async function presentBill(bill: BillDoc): Promise<PublicBill> {
  const [facility, department, cashier, confirmer] = await Promise.all([
    findFacility(bill.facilityId),
    findDepartment(bill.departmentId),
    findUserById(bill.cashierId),
    bill.confirmedBy ? findUserById(bill.confirmedBy) : Promise.resolve(null),
  ]);

  return toPublicBill(
    bill,
    facility?.name ?? "Unknown facility",
    department?.name ?? "Unknown department",
    cashier?.name ?? "Unknown cashier",
    confirmer?.name ?? null,
  );
}

export async function createBill(
  actor: UserDoc,
  input: unknown,
): Promise<PublicBill> {
  if (actor.role !== "cashier") {
    throw new AppError(403, "Only a cashier can raise a bill.");
  }

  const body = asObject(input);
  const facilityId = requiredId(body.facilityId, "Choose a facility.");
  const departmentId = requiredId(body.departmentId, "Choose a department.");
  const payerName = requiredText(body.payerName, "Payer name", 120);
  const description = requiredText(body.description, "Description", 500);
  const amountKobo = parseAmountKobo(body.amount);

  if (amountKobo <= 0) {
    throw new AppError(400, "Enter a bill amount greater than zero.");
  }

  if (!actor.facilityIds.includes(facilityId)) {
    throw new AppError(403, "You cannot raise a bill for this facility.");
  }

  const department = await findDepartment(departmentId);

  if (!department || department.facilityId !== facilityId) {
    throw new AppError(404, "The department was not found.");
  }

  if (!department.active) {
    throw new AppError(409, "This department is not accepting bills.");
  }

  const at = nowIso();
  const bill: BillDoc = {
    _id: randomUUID(),
    facilityId,
    departmentId,
    cashierId: actor._id,
    payerName,
    description,
    amountKobo,
    status: "Draft",
    paymentMethod: null,
    transfer: null,
    paidAt: null,
    confirmedBy: null,
    receiptNumber: null,
    createdAt: at,
    updatedAt: at,
  };

  await insertBill(bill);

  await insertAudit({
    _id: randomUUID(),
    actorId: actor._id,
    actorName: actor.name,
    actorRole: actor.role,
    facilityId,
    entityType: "bill",
    entityId: bill._id,
    iteration: null,
    action: "bill.created",
    oldValue: null,
    newValue: { payerName, description, amount: koboToNaira(amountKobo) },
    reason: null,
    createdAt: at,
  });

  return presentBill(bill);
}

export async function selectPaymentMethod(
  actor: UserDoc,
  billId: string,
  input: unknown,
): Promise<PublicBill> {
  const bill = await loadVisible(actor, billId);
  assertCashierOwner(actor, bill);

  if (bill.status !== "Draft") {
    throw new AppError(409, "A payment method has already been selected.");
  }

  const body = asObject(input);
  const method = parsePaymentMethod(body.method);
  const at = nowIso();

  let update: Partial<BillDoc>;

  if (method === "Transfer") {
    const transfer = generateTapVirtualAccount(bill._id);
    update = {
      paymentMethod: method,
      status: "Awaiting Transfer",
      transfer: { ...transfer, generatedAt: at },
    };
  } else {
    update = { paymentMethod: method, status: "Awaiting Confirmation" };
  }

  const saved = await saveBill(bill._id, bill.updatedAt, update, at);

  if (!saved) {
    throw new AppError(409, "This bill changed. Reload it and try again.");
  }

  const next: BillDoc = { ...bill, ...update, updatedAt: at };

  await insertAudit({
    _id: randomUUID(),
    actorId: actor._id,
    actorName: actor.name,
    actorRole: actor.role,
    facilityId: bill.facilityId,
    entityType: "bill",
    entityId: bill._id,
    iteration: null,
    action: "bill.payment_method_selected",
    oldValue: null,
    newValue: { method },
    reason: null,
    createdAt: at,
  });

  return presentBill(next);
}

export async function confirmPayment(
  actor: UserDoc,
  billId: string,
  input: unknown,
): Promise<PublicBill> {
  const bill = await loadVisible(actor, billId);
  assertCashierOwner(actor, bill);

  if (bill.status !== "Awaiting Transfer" && bill.status !== "Awaiting Confirmation") {
    throw new AppError(409, "This bill is not awaiting payment confirmation.");
  }

  const body = asObject(input);
  const note = optionalText(body.note, "Note", 500);
  const at = nowIso();
  const update: Partial<BillDoc> = {
    status: "Paid",
    paidAt: at,
    confirmedBy: actor._id,
    receiptNumber: generateReceiptNumber(),
  };

  const saved = await saveBill(bill._id, bill.updatedAt, update, at);

  if (!saved) {
    throw new AppError(409, "This bill changed. Reload it and try again.");
  }

  const next: BillDoc = { ...bill, ...update, updatedAt: at };

  await insertAudit({
    _id: randomUUID(),
    actorId: actor._id,
    actorName: actor.name,
    actorRole: actor.role,
    facilityId: bill.facilityId,
    entityType: "bill",
    entityId: bill._id,
    iteration: null,
    action: "bill.payment_confirmed",
    oldValue: null,
    newValue: {
      method: bill.paymentMethod,
      receiptNumber: update.receiptNumber,
    },
    reason: note,
    createdAt: at,
  });

  return presentBill(next);
}

export async function getBill(
  actor: UserDoc,
  billId: string,
): Promise<PublicBill> {
  const bill = await loadVisible(actor, billId);
  return presentBill(bill);
}

export async function listBills(
  actor: UserDoc,
  query: { facilityId: string | null },
): Promise<PublicBill[]> {
  let facilityId: string | undefined;

  if (query.facilityId?.trim()) {
    facilityId = requiredId(query.facilityId, "Choose a facility.");

    if (!actor.facilityIds.includes(facilityId)) {
      throw new AppError(403, "You cannot access this facility.");
    }
  }

  let docs: BillDoc[];

  if (actor.role === "cashier") {
    docs = await listBillsQuery({ cashierId: actor._id, facilityId });
  } else if (actor.role === "facility_manager") {
    docs = await listBillsQuery({
      facilityIds: facilityId ? undefined : actor.facilityIds,
      facilityId,
    });
  } else if (actor.role === "finance") {
    const cashiers = await listSupervisedCashiers(actor._id);
    docs = await listBillsQuery({
      cashierIds: cashiers.map((cashier) => cashier._id),
      facilityId,
    });
  } else {
    throw new AppError(403, "You cannot list bills.");
  }

  return Promise.all(docs.map((doc) => presentBill(doc)));
}
