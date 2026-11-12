import { randomUUID } from "node:crypto";
import { hashPassword } from "../auth/password";
import {
  addDays,
  getToday,
  nowIso,
  parseAmountKobo,
  type DepartmentDoc,
  type FacilityDoc,
  type PatientDoc,
  type ServiceItemDoc,
  type TapDoc,
  type UserDoc,
} from "../entity";
import {
  departments,
  facilities,
  patients,
  serviceItems,
  tapRecords,
  users,
} from "./index";

const DEMO_PASSWORD = "Lunar123!";

export async function seedIfEmpty(): Promise<boolean> {
  const existing = await facilities().countDocuments();

  if (existing > 0) {
    return false;
  }

  const createdAt = nowIso();
  const today = getToday();

  const facilityDocs: FacilityDoc[] = [
    { _id: "facility-lagos", name: "Lagos General Hospital" },
    { _id: "facility-abuja", name: "Abuja Central Hospital" },
  ];

  const userDocs: UserDoc[] = [
    {
      _id: "user-finance",
      name: "Finance Auditor",
      phone: "08010000001",
      email: "finance@lunar.demo",
      passwordHash: hashPassword(DEMO_PASSWORD),
      role: "finance",
      status: "active",
      facilityIds: ["facility-lagos", "facility-abuja"],
      departmentId: null,
      supervisorIds: [],
      createdBy: null,
      createdAt,
    },
    {
      _id: "user-manager",
      name: "Lagos Facility Manager",
      phone: "08010000002",
      email: "manager@lunar.demo",
      passwordHash: hashPassword(DEMO_PASSWORD),
      role: "facility_manager",
      status: "active",
      facilityIds: ["facility-lagos"],
      departmentId: null,
      supervisorIds: [],
      createdBy: "user-finance",
      createdAt,
    },
    {
      _id: "user-cashier",
      name: "Amara Johnson",
      phone: "08010000003",
      email: "cashier@lunar.demo",
      passwordHash: hashPassword(DEMO_PASSWORD),
      role: "cashier",
      status: "active",
      facilityIds: ["facility-lagos"],
      departmentId: null,
      supervisorIds: ["user-finance"],
      createdBy: "user-finance",
      createdAt,
    },
    {
      _id: "user-front-office",
      name: "Lagos Front Office",
      phone: "08010000004",
      email: "frontoffice@lunar.demo",
      passwordHash: hashPassword(DEMO_PASSWORD),
      role: "front_office",
      status: "active",
      facilityIds: ["facility-lagos"],
      departmentId: null,
      supervisorIds: [],
      createdBy: "user-finance",
      createdAt,
    },
    {
      _id: "user-service-staff",
      name: "Laboratory Staff",
      phone: "08010000005",
      email: "lab@lunar.demo",
      passwordHash: hashPassword(DEMO_PASSWORD),
      role: "service_staff",
      status: "active",
      facilityIds: ["facility-lagos"],
      departmentId: "dept-laboratory",
      supervisorIds: [],
      createdBy: "user-front-office",
      createdAt,
    },
  ];

  // The October 8 row matches the PRD example: TAP is 3 transactions
  // and ₦15,000 short of a 1,250 / ₦4,500,000 facility submission.
  const tapSpecs = [
    {
      facilityId: "facility-lagos",
      date: "2026-10-08",
      transactionCount: 1247,
      transactionAmount: 4_485_000,
    },
    {
      facilityId: "facility-lagos",
      date: today,
      transactionCount: 1247,
      transactionAmount: 4_485_000,
    },
    {
      facilityId: "facility-lagos",
      date: addDays(today, -1),
      transactionCount: 1000,
      transactionAmount: 1_000_000,
    },
    {
      facilityId: "facility-abuja",
      date: today,
      transactionCount: 800,
      transactionAmount: 2_000_000,
    },
  ];

  const seen = new Set<string>();
  const tapDocs: TapDoc[] = [];

  for (const spec of tapSpecs) {
    const key = `${spec.facilityId}:${spec.date}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    tapDocs.push({
      _id: randomUUID(),
      facilityId: spec.facilityId,
      date: spec.date,
      transactionCount: spec.transactionCount,
      transactionAmountKobo: parseAmountKobo(spec.transactionAmount),
      createdAt,
      updatedAt: createdAt,
    });
  }

  const departmentDocs: DepartmentDoc[] = [
    {
      _id: "dept-consultation",
      facilityId: "facility-lagos",
      name: "Consultation",
      active: true,
      createdBy: "user-front-office",
      createdAt,
      updatedAt: createdAt,
    },
    {
      _id: "dept-pharmacy",
      facilityId: "facility-lagos",
      name: "Pharmacy",
      active: true,
      createdBy: "user-front-office",
      createdAt,
      updatedAt: createdAt,
    },
    {
      _id: "dept-laboratory",
      facilityId: "facility-lagos",
      name: "Laboratory",
      active: true,
      createdBy: "user-front-office",
      createdAt,
      updatedAt: createdAt,
    },
  ];

  const serviceItemDocs: ServiceItemDoc[] = [
    {
      _id: randomUUID(),
      facilityId: "facility-lagos",
      departmentId: "dept-consultation",
      name: "General consultation",
      priceKobo: parseAmountKobo(5_000),
      active: true,
      createdBy: "user-front-office",
      createdAt,
      updatedAt: createdAt,
    },
    {
      _id: randomUUID(),
      facilityId: "facility-lagos",
      departmentId: "dept-laboratory",
      name: "Malaria test",
      priceKobo: parseAmountKobo(3_500),
      active: true,
      createdBy: "user-front-office",
      createdAt,
      updatedAt: createdAt,
    },
    {
      _id: randomUUID(),
      facilityId: "facility-lagos",
      departmentId: "dept-laboratory",
      name: "Full blood count",
      priceKobo: parseAmountKobo(6_000),
      active: true,
      createdBy: "user-front-office",
      createdAt,
      updatedAt: createdAt,
    },
    {
      _id: randomUUID(),
      facilityId: "facility-lagos",
      departmentId: "dept-pharmacy",
      name: "Paracetamol (pack)",
      priceKobo: parseAmountKobo(500),
      active: true,
      createdBy: "user-front-office",
      createdAt,
      updatedAt: createdAt,
    },
  ];

  const patientDocs: PatientDoc[] = [
    {
      _id: randomUUID(),
      uniqueId: "PT-000001",
      facilityId: "facility-lagos",
      name: "Chinedu Okafor",
      phone: "08030000001",
      email: "patient@lunar.demo",
      createdBy: "user-cashier",
      createdAt,
    },
  ];

  await facilities().insertMany(facilityDocs);
  await users().insertMany(userDocs);
  await tapRecords().insertMany(tapDocs);
  await departments().insertMany(departmentDocs);
  await serviceItems().insertMany(serviceItemDocs);
  await patients().insertMany(patientDocs);

  return true;
}
