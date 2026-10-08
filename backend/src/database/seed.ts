import { randomUUID } from "node:crypto";
import { hashPassword } from "../auth/password";
import {
  addDays,
  getToday,
  nowIso,
  parseAmountKobo,
  type FacilityDoc,
  type TapDoc,
  type UserDoc,
} from "../entity";
import { facilities, tapRecords, users } from "./index";

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
      supervisorIds: ["user-finance"],
      createdBy: "user-finance",
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

  await facilities().insertMany(facilityDocs);
  await users().insertMany(userDocs);
  await tapRecords().insertMany(tapDocs);

  return true;
}
