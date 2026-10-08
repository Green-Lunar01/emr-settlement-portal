import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");

  if (!salt || !hash) {
    return false;
  }

  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}
