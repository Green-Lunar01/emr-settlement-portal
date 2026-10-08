import { MongoClient, type Collection, type Db } from "mongodb";
import type {
  AuditDoc,
  EmrDoc,
  FacilityDoc,
  SessionDoc,
  TapDoc,
  UserDoc,
} from "../entity";

const mongoUri =
  process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/emr_settlement";

let client: MongoClient | null = null;
let database: Db | null = null;

function describeUri(uri: string): string {
  try {
    const url = new URL(uri);

    if (url.username) {
      url.username = "";
    }

    if (url.password) {
      url.password = "";
    }

    return url.toString();
  } catch {
    return "the configured MongoDB URI";
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function connectDatabase(): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 15; attempt += 1) {
    const next = new MongoClient(mongoUri, {
      serverSelectionTimeoutMS: 2000,
    });

    try {
      await next.connect();
      const nextDb = next.db();
      await nextDb.command({ ping: 1 });
      client = next;
      database = nextDb;
      return;
    } catch (error) {
      lastError = error;
      await next.close().catch(() => undefined);
      await delay(500);
    }
  }

  const detail =
    lastError instanceof Error ? lastError.message : "Unknown error";

  throw new Error(
    `Could not connect to MongoDB (${describeUri(mongoUri)}). ${detail}`,
  );
}

export async function closeDatabase(): Promise<void> {
  await client?.close();
  client = null;
  database = null;
}

export async function pingDatabase(): Promise<void> {
  await db().command({ ping: 1 });
}

export function db(): Db {
  if (!database) {
    throw new Error("Database is not connected.");
  }

  return database;
}

export function facilities(): Collection<FacilityDoc> {
  return db().collection<FacilityDoc>("facilities");
}

export function users(): Collection<UserDoc> {
  return db().collection<UserDoc>("users");
}

export function sessions(): Collection<SessionDoc> {
  return db().collection<SessionDoc>("sessions");
}

export function tapRecords(): Collection<TapDoc> {
  return db().collection<TapDoc>("tap_records");
}

export function emrRecords(): Collection<EmrDoc> {
  return db().collection<EmrDoc>("emr_records");
}

export function auditLogs(): Collection<AuditDoc> {
  return db().collection<AuditDoc>("audit_logs");
}

export async function ensureIndexes(): Promise<void> {
  await users().createIndex({ email: 1 }, { unique: true });
  await users().createIndex({ supervisorIds: 1 });
  await sessions().createIndex({ expiresAt: 1 });
  await tapRecords().createIndex(
    { facilityId: 1, date: 1 },
    { unique: true },
  );
  await emrRecords().createIndex(
    { cashierId: 1, facilityId: 1, date: 1 },
    { unique: true },
  );
  await auditLogs().createIndex({ entityType: 1, entityId: 1, createdAt: 1 });
}
