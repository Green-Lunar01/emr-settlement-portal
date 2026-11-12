import { randomUUID } from "node:crypto";
import { AppError } from "../errors";
import {
  asObject,
  nowIso,
  parseAmountKobo,
  requiredId,
  requiredText,
  toPublicServiceItem,
  type ServiceItemDoc,
  type PublicServiceItem,
  type UserDoc,
} from "../entity";
import {
  findDepartment,
  findServiceItemById,
  insertServiceItem,
  listServiceItemsByFacility,
  setServiceItemActive,
} from "../repository";

export async function createServiceItem(
  actor: UserDoc,
  input: unknown,
): Promise<PublicServiceItem> {
  if (actor.role !== "front_office") {
    throw new AppError(403, "Only an admin can register drugs and services.");
  }

  const body = asObject(input);
  const facilityId = requiredId(body.facilityId, "Choose a facility.");
  const departmentId = requiredId(body.departmentId, "Choose a department.");
  const name = requiredText(body.name, "Name", 150);
  const priceKobo = parseAmountKobo(body.price);

  if (priceKobo <= 0) {
    throw new AppError(400, "Enter a price greater than zero.");
  }

  if (!actor.facilityIds.includes(facilityId)) {
    throw new AppError(403, "You cannot manage this facility.");
  }

  const department = await findDepartment(departmentId);

  if (!department || department.facilityId !== facilityId) {
    throw new AppError(404, "The department was not found.");
  }

  const at = nowIso();
  const item: ServiceItemDoc = {
    _id: randomUUID(),
    facilityId,
    departmentId,
    name,
    priceKobo,
    active: true,
    createdBy: actor._id,
    createdAt: at,
    updatedAt: at,
  };

  await insertServiceItem(item);

  return toPublicServiceItem(item, department.name);
}

export async function listServiceItems(
  actor: UserDoc,
  query: { facilityId: string | null },
): Promise<PublicServiceItem[]> {
  const facilityId = query.facilityId?.trim();

  if (!facilityId) {
    throw new AppError(400, "Choose a facility.");
  }

  if (!actor.facilityIds.includes(facilityId)) {
    throw new AppError(403, "You cannot access this facility.");
  }

  const items = await listServiceItemsByFacility(facilityId);
  const departmentNames = new Map<string, string>();

  const results: PublicServiceItem[] = [];

  for (const item of items) {
    let name = departmentNames.get(item.departmentId);

    if (!name) {
      const department = await findDepartment(item.departmentId);
      name = department?.name ?? "Unknown department";
      departmentNames.set(item.departmentId, name);
    }

    results.push(toPublicServiceItem(item, name));
  }

  return results;
}

export async function setServiceItemStatus(
  actor: UserDoc,
  itemId: string,
  active: boolean,
): Promise<PublicServiceItem> {
  if (actor.role !== "front_office") {
    throw new AppError(403, "Only an admin can manage drugs and services.");
  }

  const item = await findServiceItemById(itemId);

  if (!item || !actor.facilityIds.includes(item.facilityId)) {
    throw new AppError(404, "The item was not found.");
  }

  const at = nowIso();
  const ok = await setServiceItemActive(itemId, active, at);

  if (!ok) {
    throw new AppError(409, "The item could not be updated.");
  }

  const department = await findDepartment(item.departmentId);

  return toPublicServiceItem(
    { ...item, active, updatedAt: at },
    department?.name ?? "Unknown department",
  );
}
