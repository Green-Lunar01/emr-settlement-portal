import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { AppError } from "../errors";
import {
  asObject,
  billTotalKobo,
  formatNaira,
  koboToNaira,
  nowIso,
  optionalText,
  parsePaymentMethod,
  requiredId,
  toPublicBill,
  type BillDoc,
  type BillLineItemDoc,
  type PublicBill,
  type PublicBillVerification,
  type ServiceItemDoc,
  type UserDoc,
} from "../entity";
import {
  findBillById,
  findDepartment,
  findFacility,
  findPatientById,
  findServiceItemById,
  findUserById,
  insertAudit,
  insertBill,
  listBillsQuery,
  saveBill,
} from "../repository";
import { sendEmail } from "../mailer";
import { billVerificationUrl, generateQrDataUrl } from "../qr";

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

// Cashiers act facility-wide; service staff are locked to their own
// department (their point of service). Either way, once a bill exists it
// is visible to everyone entitled to clear it, at either channel — the
// bill's own status is what actually prevents a double-clear, not who
// raised it.
function canActOnBill(actor: UserDoc, bill: BillDoc): boolean {
  if (actor.status !== "active" || !actor.facilityIds.includes(bill.facilityId)) {
    return false;
  }

  if (actor.role === "cashier") {
    return true;
  }

  if (actor.role === "service_staff") {
    return actor.departmentId === bill.departmentId;
  }

  return false;
}

async function canViewBill(actor: UserDoc, bill: BillDoc): Promise<boolean> {
  if (canActOnBill(actor, bill)) {
    return true;
  }

  if (actor.status !== "active") {
    return false;
  }

  return (
    (actor.role === "facility_manager" || actor.role === "finance") &&
    actor.facilityIds.includes(bill.facilityId)
  );
}

async function loadVisible(actor: UserDoc, billId: string): Promise<BillDoc> {
  const bill = await findBillById(billId);

  if (!bill || !(await canViewBill(actor, bill))) {
    throw new AppError(404, "The bill was not found.");
  }

  return bill;
}

function assertCanAct(actor: UserDoc, bill: BillDoc): void {
  if (!canActOnBill(actor, bill)) {
    throw new AppError(
      403,
      "You cannot act on this bill from your account.",
    );
  }
}

async function presentBill(bill: BillDoc): Promise<PublicBill> {
  const [facility, department, patient, raiser, confirmer, qrDataUrl] =
    await Promise.all([
      findFacility(bill.facilityId),
      findDepartment(bill.departmentId),
      findPatientById(bill.patientId),
      findUserById(bill.raisedBy),
      bill.confirmedBy ? findUserById(bill.confirmedBy) : Promise.resolve(null),
      bill.status === "Paid"
        ? generateQrDataUrl(billVerificationUrl(bill._id))
        : Promise.resolve(null),
    ]);

  return toPublicBill(
    bill,
    facility?.name ?? "Unknown facility",
    department?.name ?? "Unknown department",
    patient?.name ?? "Unknown patient",
    patient?.uniqueId ?? "",
    raiser?.name ?? "Unknown staff",
    confirmer?.name ?? null,
    qrDataUrl,
  );
}

interface RequestedItem {
  serviceItemId: string;
  quantity: number;
}

function parseRequestedItems(value: unknown): RequestedItem[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AppError(400, "Add at least one item to the bill.");
  }

  return value.map((raw) => {
    const row = asObject(raw);
    const serviceItemId = requiredId(row.serviceItemId, "Select an item.");
    const quantity = row.quantity;

    if (
      typeof quantity !== "number" ||
      !Number.isSafeInteger(quantity) ||
      quantity <= 0 ||
      quantity > 999
    ) {
      throw new AppError(400, "Enter a valid quantity for each item.");
    }

    return { serviceItemId, quantity };
  });
}

export async function createBill(
  actor: UserDoc,
  input: unknown,
): Promise<PublicBill> {
  if (actor.role !== "cashier" && actor.role !== "service_staff") {
    throw new AppError(
      403,
      "Only a cashier or service staff can raise a bill.",
    );
  }

  const body = asObject(input);
  const facilityId = requiredId(body.facilityId, "Choose a facility.");
  const patientId = requiredId(body.patientId, "Select a patient.");
  const requestedItems = parseRequestedItems(body.items);

  if (!actor.facilityIds.includes(facilityId)) {
    throw new AppError(403, "You cannot raise a bill for this facility.");
  }

  const patient = await findPatientById(patientId);

  if (!patient || patient.facilityId !== facilityId) {
    throw new AppError(404, "The patient was not found.");
  }

  const items: BillLineItemDoc[] = [];
  let departmentId: string | null = null;

  for (const requested of requestedItems) {
    const serviceItem: ServiceItemDoc | null = await findServiceItemById(
      requested.serviceItemId,
    );

    if (!serviceItem || serviceItem.facilityId !== facilityId || !serviceItem.active) {
      throw new AppError(404, "One of the selected items is not available.");
    }

    if (departmentId === null) {
      departmentId = serviceItem.departmentId;
    } else if (departmentId !== serviceItem.departmentId) {
      throw new AppError(
        400,
        "All items on a bill must belong to the same department.",
      );
    }

    items.push({
      serviceItemId: serviceItem._id,
      name: serviceItem.name,
      unitPriceKobo: serviceItem.priceKobo,
      quantity: requested.quantity,
    });
  }

  if (!departmentId) {
    throw new AppError(400, "Add at least one item to the bill.");
  }

  if (actor.role === "service_staff" && actor.departmentId !== departmentId) {
    throw new AppError(
      403,
      "You can only raise bills for your own service point.",
    );
  }

  const at = nowIso();
  const bill: BillDoc = {
    _id: randomUUID(),
    facilityId,
    departmentId,
    patientId,
    raisedBy: actor._id,
    raisedByRole: actor.role,
    items,
    amountKobo: billTotalKobo(items),
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
    newValue: {
      patientId,
      items: items.map((item) => `${item.name} x${item.quantity}`),
      amount: koboToNaira(bill.amountKobo),
    },
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
  assertCanAct(actor, bill);

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

  await sendBillNoticeEmail(next);

  return presentBill(next);
}

async function sendBillNoticeEmail(bill: BillDoc): Promise<void> {
  const patient = await findPatientById(bill.patientId);

  if (!patient) {
    return;
  }

  const itemRows = bill.items
    .map(
      (item) =>
        `<tr><td>${item.name} x${item.quantity}</td><td style="text-align:right">${formatNaira(
          koboToNaira(item.unitPriceKobo * item.quantity),
        )}</td></tr>`,
    )
    .join("");

  const transferSection =
    bill.paymentMethod === "Transfer" && bill.transfer
      ? `<p>Pay <strong>${formatNaira(koboToNaira(bill.amountKobo))}</strong> to:</p>
         <p>Account number: <strong>${bill.transfer.accountNumber}</strong><br/>
         Bank: ${bill.transfer.bankName}<br/>
         Reference: ${bill.transfer.reference}</p>`
      : `<p>Total due: <strong>${formatNaira(koboToNaira(bill.amountKobo))}</strong>, payable at the point of service.</p>`;

  await sendEmail({
    to: patient.email,
    subject: "Your bill",
    html: `
      <p>Hello ${patient.name},</p>
      <p>A bill has been raised for you:</p>
      <table>${itemRows}</table>
      ${transferSection}
      <p>Patient ID: ${patient.uniqueId}</p>
    `,
  });
}

async function sendReceiptEmail(bill: BillDoc): Promise<void> {
  const patient = await findPatientById(bill.patientId);

  if (!patient) {
    return;
  }

  const qrDataUrl = await generateQrDataUrl(billVerificationUrl(bill._id));

  await sendEmail({
    to: patient.email,
    subject: "Your payment receipt",
    html: `
      <p>Hello ${patient.name},</p>
      <p>Your payment of <strong>${formatNaira(koboToNaira(bill.amountKobo))}</strong> has been received.</p>
      <p>Receipt number: <strong>${bill.receiptNumber}</strong></p>
      <p>Scan this code to verify your receipt:</p>
      <img src="${qrDataUrl}" alt="Receipt QR code" width="180" height="180" />
    `,
  });
}

export async function confirmPayment(
  actor: UserDoc,
  billId: string,
  input: unknown,
): Promise<PublicBill> {
  const bill = await loadVisible(actor, billId);
  assertCanAct(actor, bill);

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

  await sendReceiptEmail(next);

  return presentBill(next);
}

export async function getBill(
  actor: UserDoc,
  billId: string,
): Promise<PublicBill> {
  const bill = await loadVisible(actor, billId);
  return presentBill(bill);
}

export async function verifyBill(
  billId: string,
): Promise<PublicBillVerification> {
  const bill = await findBillById(billId);

  if (!bill || bill.status !== "Paid") {
    return {
      valid: false,
      receiptNumber: null,
      facilityName: "",
      amount: 0,
      paidAt: null,
    };
  }

  const facility = await findFacility(bill.facilityId);

  return {
    valid: true,
    receiptNumber: bill.receiptNumber,
    facilityName: facility?.name ?? "Unknown facility",
    amount: koboToNaira(bill.amountKobo),
    paidAt: bill.paidAt,
  };
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

  if (actor.role === "service_staff") {
    if (!actor.departmentId) {
      return [];
    }

    docs = await listBillsQuery({ departmentId: actor.departmentId, facilityId });
  } else if (
    actor.role === "cashier" ||
    actor.role === "facility_manager" ||
    actor.role === "finance"
  ) {
    docs = await listBillsQuery({
      facilityIds: facilityId ? undefined : actor.facilityIds,
      facilityId,
    });
  } else {
    throw new AppError(403, "You cannot list bills.");
  }

  return Promise.all(docs.map((doc) => presentBill(doc)));
}
