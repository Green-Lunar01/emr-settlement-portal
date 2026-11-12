import { randomInt, randomUUID } from "node:crypto";
import { AppError, isDuplicateKey } from "../errors";
import {
  asObject,
  nowIso,
  parseEmail,
  requiredId,
  requiredText,
  toPublicPatient,
  type PatientDoc,
  type PublicPatient,
  type UserDoc,
} from "../entity";
import {
  findPatientByPhone,
  findPatientById,
  insertAudit,
  insertPatient,
  searchPatientsByFacility,
} from "../repository";

function canRegisterPatients(actor: UserDoc): boolean {
  return actor.role === "cashier" || actor.role === "service_staff";
}

function generatePatientUniqueId(): string {
  const digits = Array.from({ length: 6 }, () => randomInt(0, 10)).join("");
  return `PT-${digits}`;
}

export async function registerPatient(
  actor: UserDoc,
  input: unknown,
): Promise<PublicPatient> {
  if (!canRegisterPatients(actor)) {
    throw new AppError(403, "Only cashiers and service staff can register patients.");
  }

  const body = asObject(input);
  const name = requiredText(body.name, "Name", 120);
  const phone = requiredText(body.phone, "Phone", 30);
  const email = parseEmail(body.email);
  const facilityId = actor.facilityIds[0];

  if (!facilityId) {
    throw new AppError(409, "Your account needs a facility assignment.");
  }

  const existing = await findPatientByPhone(facilityId, phone);

  if (existing) {
    throw new AppError(
      409,
      "A patient with this phone number is already registered.",
    );
  }

  const at = nowIso();
  const patient: PatientDoc = {
    _id: randomUUID(),
    uniqueId: generatePatientUniqueId(),
    facilityId,
    name,
    phone,
    email,
    createdBy: actor._id,
    createdAt: at,
  };

  try {
    await insertPatient(patient);
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw new AppError(
        409,
        "A patient with this phone number or ID already exists.",
      );
    }

    throw error;
  }

  await insertAudit({
    _id: randomUUID(),
    actorId: actor._id,
    actorName: actor.name,
    actorRole: actor.role,
    facilityId,
    entityType: "patient",
    entityId: patient._id,
    iteration: null,
    action: "patient.registered",
    oldValue: null,
    newValue: { name, phone, uniqueId: patient.uniqueId },
    reason: null,
    createdAt: at,
  });

  return toPublicPatient(patient);
}

export async function searchPatients(
  actor: UserDoc,
  query: { term: string | null },
): Promise<PublicPatient[]> {
  const facilityId = actor.facilityIds[0];
  const term = query.term?.trim();

  if (!facilityId || !term) {
    return [];
  }

  const patients = await searchPatientsByFacility(facilityId, term);
  return patients.map(toPublicPatient);
}

export async function getPatient(
  actor: UserDoc,
  patientId: string,
): Promise<PublicPatient> {
  const patient = await findPatientById(requiredId(patientId, "Select a patient."));

  if (!patient || !actor.facilityIds.includes(patient.facilityId)) {
    throw new AppError(404, "The patient was not found.");
  }

  return toPublicPatient(patient);
}
