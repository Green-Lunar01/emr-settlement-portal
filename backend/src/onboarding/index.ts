import { randomUUID } from "node:crypto";
import { hashPassword } from "../auth/password";
import { AppError, isDuplicateKey } from "../errors";
import {
  asObject,
  nowIso,
  optionalText,
  parseEmail,
  parsePassword,
  parseStaffRole,
  requiredId,
  requiredText,
  toPublicOnboardingRequest,
  type OnboardingRequestDoc,
  type PublicOnboardingRequest,
  type PublicUser,
  toPublicUser,
  type UserDoc,
} from "../entity";
import {
  findFacility,
  findOnboardingRequestById,
  findPendingOnboardingRequestByEmail,
  findUserByEmail,
  findUserById,
  insertAudit,
  insertOnboardingRequest,
  insertUser,
  listOnboardingRequestsByFacilities,
  listUsersByFacilityAndRole,
  saveOnboardingRequest,
} from "../repository";

export async function submitOnboardingRequest(
  input: unknown,
): Promise<PublicOnboardingRequest> {
  const body = asObject(input);
  const name = requiredText(body.name, "Name", 120);
  const phone = requiredText(body.phone, "Phone", 30);
  const email = parseEmail(body.email);
  const password = parsePassword(body.password);
  const role = parseStaffRole(body.role);
  const facilityId = requiredId(body.facilityId, "Choose a facility.");

  const facility = await findFacility(facilityId);

  if (!facility) {
    throw new AppError(404, "The facility was not found.");
  }

  const existingUser = await findUserByEmail(email);

  if (existingUser) {
    throw new AppError(409, "An account with this email already exists.");
  }

  const existingRequest = await findPendingOnboardingRequestByEmail(email);

  if (existingRequest) {
    throw new AppError(
      409,
      "A request with this email is already awaiting approval.",
    );
  }

  const at = nowIso();
  const request: OnboardingRequestDoc = {
    _id: randomUUID(),
    name,
    phone,
    email,
    passwordHash: hashPassword(password),
    role,
    facilityId,
    status: "Pending",
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
    createdAt: at,
    updatedAt: at,
  };

  try {
    await insertOnboardingRequest(request);
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw new AppError(
        409,
        "A request with this email is already awaiting approval.",
      );
    }

    throw error;
  }

  return toPublicOnboardingRequest(request, facility.name, null);
}

async function presentRequest(
  request: OnboardingRequestDoc,
): Promise<PublicOnboardingRequest> {
  const [facility, reviewer] = await Promise.all([
    findFacility(request.facilityId),
    request.reviewedBy ? findUserById(request.reviewedBy) : Promise.resolve(null),
  ]);

  return toPublicOnboardingRequest(
    request,
    facility?.name ?? "Unknown facility",
    reviewer?.name ?? null,
  );
}

export async function listOnboardingRequests(
  actor: UserDoc,
  query: { status: string | null },
): Promise<PublicOnboardingRequest[]> {
  if (actor.role !== "front_office") {
    throw new AppError(
      403,
      "Only front office can view onboarding requests.",
    );
  }

  const status =
    query.status === "Pending" ||
    query.status === "Approved" ||
    query.status === "Rejected"
      ? query.status
      : undefined;

  const requests = await listOnboardingRequestsByFacilities(
    actor.facilityIds,
    status,
  );

  return Promise.all(requests.map((request) => presentRequest(request)));
}

async function loadPendingRequest(
  actor: UserDoc,
  requestId: string,
): Promise<OnboardingRequestDoc> {
  if (actor.role !== "front_office") {
    throw new AppError(
      403,
      "Only front office can review onboarding requests.",
    );
  }

  const request = await findOnboardingRequestById(requestId);

  if (!request || !actor.facilityIds.includes(request.facilityId)) {
    throw new AppError(404, "The request was not found.");
  }

  if (request.status !== "Pending") {
    throw new AppError(409, "This request has already been reviewed.");
  }

  return request;
}

export async function approveOnboardingRequest(
  actor: UserDoc,
  requestId: string,
): Promise<PublicUser> {
  const request = await loadPendingRequest(actor, requestId);

  // Mirrors createStaffAccount's rule: a newly approved cashier is
  // reviewed by whichever finance users already sit in the same facility.
  const supervisorIds =
    request.role === "cashier"
      ? (await listUsersByFacilityAndRole(request.facilityId, "finance")).map(
          (user) => user._id,
        )
      : [];

  const staff: UserDoc = {
    _id: randomUUID(),
    name: request.name,
    phone: request.phone,
    email: request.email,
    passwordHash: request.passwordHash,
    role: request.role,
    status: "active",
    facilityIds: [request.facilityId],
    supervisorIds,
    createdBy: actor._id,
    createdAt: nowIso(),
  };

  try {
    await insertUser(staff);
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw new AppError(409, "An account with this email already exists.");
    }

    throw error;
  }

  const at = nowIso();
  const saved = await saveOnboardingRequest(
    request._id,
    request.updatedAt,
    { status: "Approved", reviewedBy: actor._id, reviewedAt: at },
    at,
  );

  if (!saved) {
    throw new AppError(409, "This request changed. Reload it and try again.");
  }

  await insertAudit({
    _id: randomUUID(),
    actorId: actor._id,
    actorName: actor.name,
    actorRole: actor.role,
    facilityId: request.facilityId,
    entityType: "user",
    entityId: staff._id,
    iteration: null,
    action: `${request.role}.onboarding_approved`,
    oldValue: null,
    newValue: { name: staff.name, email: staff.email },
    reason: null,
    createdAt: at,
  });

  return toPublicUser(staff);
}

export async function rejectOnboardingRequest(
  actor: UserDoc,
  requestId: string,
  input: unknown,
): Promise<PublicOnboardingRequest> {
  const request = await loadPendingRequest(actor, requestId);

  const body = asObject(input);
  const reason = optionalText(body.reason, "Reason", 500);
  const at = nowIso();

  const saved = await saveOnboardingRequest(
    request._id,
    request.updatedAt,
    {
      status: "Rejected",
      reviewedBy: actor._id,
      reviewedAt: at,
      rejectionReason: reason,
    },
    at,
  );

  if (!saved) {
    throw new AppError(409, "This request changed. Reload it and try again.");
  }

  await insertAudit({
    _id: randomUUID(),
    actorId: actor._id,
    actorName: actor.name,
    actorRole: actor.role,
    facilityId: request.facilityId,
    entityType: "user",
    entityId: request._id,
    iteration: null,
    action: `${request.role}.onboarding_rejected`,
    oldValue: null,
    newValue: { email: request.email, reason },
    reason,
    createdAt: at,
  });

  return presentRequest({
    ...request,
    status: "Rejected",
    reviewedBy: actor._id,
    reviewedAt: at,
    rejectionReason: reason,
    updatedAt: at,
  });
}
