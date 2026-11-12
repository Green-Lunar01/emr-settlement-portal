import { randomUUID } from "node:crypto";
import { AppError } from "../errors";
import {
  asObject,
  nowIso,
  requiredId,
  requiredText,
  toPublicDepartment,
  type DepartmentDoc,
  type PublicDepartment,
  type UserDoc,
} from "../entity";
import {
  findDepartment,
  findFacility,
  insertDepartment,
  listDepartmentsByFacility,
  setDepartmentActive,
} from "../repository";

export async function createDepartment(
  actor: UserDoc,
  input: unknown,
): Promise<PublicDepartment> {
  if (actor.role !== "front_office") {
    throw new AppError(403, "Only front office can set up departments.");
  }

  const body = asObject(input);
  const facilityId = requiredId(body.facilityId, "Choose a facility.");
  const name = requiredText(body.name, "Department name", 120);

  if (!actor.facilityIds.includes(facilityId)) {
    throw new AppError(
      403,
      "You cannot create a department for this facility.",
    );
  }

  const facility = await findFacility(facilityId);

  if (!facility) {
    throw new AppError(404, "The facility was not found.");
  }

  const at = nowIso();
  const department: DepartmentDoc = {
    _id: randomUUID(),
    facilityId,
    name,
    active: true,
    createdBy: actor._id,
    createdAt: at,
    updatedAt: at,
  };

  await insertDepartment(department);

  return toPublicDepartment(department);
}

export async function listDepartments(
  actor: UserDoc,
  query: { facilityId: string | null },
): Promise<PublicDepartment[]> {
  const facilityId = query.facilityId?.trim();

  if (!facilityId) {
    throw new AppError(400, "Choose a facility.");
  }

  if (!actor.facilityIds.includes(facilityId)) {
    throw new AppError(403, "You cannot access this facility.");
  }

  const departments = await listDepartmentsByFacility(facilityId);
  return departments.map(toPublicDepartment);
}

export async function setDepartmentStatus(
  actor: UserDoc,
  departmentId: string,
  active: boolean,
): Promise<PublicDepartment> {
  if (actor.role !== "front_office") {
    throw new AppError(403, "Only front office can manage departments.");
  }

  const department = await findDepartment(departmentId);

  if (!department || !actor.facilityIds.includes(department.facilityId)) {
    throw new AppError(404, "The department was not found.");
  }

  const at = nowIso();
  const ok = await setDepartmentActive(departmentId, active, at);

  if (!ok) {
    throw new AppError(409, "The department could not be updated.");
  }

  return toPublicDepartment({ ...department, active, updatedAt: at });
}
