import type { AppData } from "../types";

export function createDemoData(): AppData {
  const createdAt = new Date().toISOString();

  return {
    hospitals: [
      {
        id: "hospital-lagos",
        name: "Lagos General Hospital",
      },
      {
        id: "hospital-abuja",
        name: "Abuja Central Hospital",
      },
    ],

    users: [
      {
        id: "finance-001",
        name: "Finance Auditor",
        phone: "08010000001",
        email: "finance@lunar.demo",
        password: "Lunar123!",
        role: "finance",
        status: "active",
        hospitalIds: ["hospital-lagos", "hospital-abuja"],
        createdBy: null,
        createdAt,
      },
      {
        id: "manager-001",
        name: "Lagos Facility Manager",
        phone: "08010000002",
        email: "manager@lunar.demo",
        password: "Lunar123!",
        role: "facility_manager",
        status: "active",
        hospitalIds: ["hospital-lagos"],
        createdBy: "finance-001",
        createdAt,
      },
      {
        id: "cashier-001",
        name: "Amara Johnson",
        phone: "08010000003",
        email: "cashier@lunar.demo",
        password: "Lunar123!",
        role: "cashier",
        status: "active",
        hospitalIds: ["hospital-lagos"],
        createdBy: "finance-001",
        createdAt,
      },
    ],

    emrRecords: [],
    topUps: [],
    dailyAccounts: [],
    activityLogs: [],
  };
}