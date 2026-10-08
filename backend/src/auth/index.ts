import { createHash, randomBytes } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { AppError } from "../errors";
import {
  asObject,
  nowIso,
  toPublicUser,
  type PublicUser,
  type UserDoc,
} from "../entity";
import {
  deleteSession,
  findSession,
  findUserByEmail,
  findUserById,
  insertSession,
} from "../repository";
import { hashPassword, verifyPassword } from "./password";

const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const dummyHash = hashPassword("not-a-real-password");

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function readBearerToken(req: IncomingMessage): string {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    throw new AppError(401, "Sign in required.");
  }

  const token = header.slice("Bearer ".length).trim();

  if (!token) {
    throw new AppError(401, "Sign in required.");
  }

  return token;
}

export async function login(
  input: unknown,
): Promise<{ token: string; user: PublicUser }> {
  const body = asObject(input);
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const user = email ? await findUserByEmail(email) : null;
  const matches = verifyPassword(password, user?.passwordHash ?? dummyHash);

  if (!user || user.status !== "active" || !matches) {
    throw new AppError(401, "Invalid email or password.");
  }

  const token = randomBytes(32).toString("hex");
  const createdAt = nowIso();

  await insertSession({
    _id: hashToken(token),
    userId: user._id,
    expiresAt: new Date(Date.now() + SESSION_MS).toISOString(),
    createdAt,
  });

  return { token, user: toPublicUser(user) };
}

export async function logout(req: IncomingMessage): Promise<void> {
  await deleteSession(hashToken(readBearerToken(req)));
}

export async function requireUser(req: IncomingMessage): Promise<UserDoc> {
  const session = await findSession(hashToken(readBearerToken(req)));

  if (!session || session.expiresAt <= nowIso()) {
    if (session) {
      await deleteSession(session._id);
    }

    throw new AppError(401, "Sign in required.");
  }

  const user = await findUserById(session.userId);

  if (!user || user.status !== "active") {
    throw new AppError(401, "Sign in required.");
  }

  return user;
}
