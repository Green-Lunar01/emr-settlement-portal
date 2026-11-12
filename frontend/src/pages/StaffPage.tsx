import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";

import {
  apiRequest,
  type ApiDepartment,
  type ApiOnboardingRequest,
  type ApiUser,
} from "../api/client";
import { useApp } from "../hooks/useApp";
import { ROLE_LABELS } from "../utils/roles";
import type { UserRole } from "../types";

interface CreateForm {
  name: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
  facilityId: string;
  departmentId: string;
}

function emptyForm(facilityId: string): CreateForm {
  return {
    name: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "cashier",
    facilityId,
    departmentId: "",
  };
}

export default function StaffPage() {
  const { currentUser, data } = useApp();
  const actor = currentUser;
  const facilityId = actor?.hospitalIds[0] ?? "";

  const [requests, setRequests] = useState<ApiOnboardingRequest[]>([]);
  const [staff, setStaff] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateForm>(emptyForm(""));
  const [departments, setDepartments] = useState<ApiDepartment[]>([]);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  async function load(): Promise<void> {
    setLoading(true);

    try {
      const [requestResult, staffResult] = await Promise.all([
        apiRequest<{ requests: ApiOnboardingRequest[] }>(
          "/api/onboarding?status=Pending",
        ),
        apiRequest<{ users: ApiUser[] }>("/api/users"),
      ]);

      setRequests(requestResult.requests);
      setStaff(staffResult.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load staff.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor?.id]);

  useEffect(() => {
    if (!facilityId) return;
    let cancelled = false;

    async function loadDepartments(): Promise<void> {
      try {
        const result = await apiRequest<{ departments: ApiDepartment[] }>(
          `/api/departments?facilityId=${encodeURIComponent(facilityId)}`,
        );

        if (!cancelled) {
          setDepartments(result.departments.filter((d) => d.active));
        }
      } catch {
        // department list is only needed for the service_staff role field
      }
    }

    void loadDepartments();

    return () => {
      cancelled = true;
    };
  }, [facilityId]);

  if (!actor) return null;

  async function approve(id: string): Promise<void> {
    setError("");
    setMessage("");
    setBusy(true);

    try {
      await apiRequest(`/api/onboarding/${id}/approve`, { method: "POST" });
      setMessage("Request approved. The account is now active.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to approve request.");
    } finally {
      setBusy(false);
    }
  }

  async function reject(id: string): Promise<void> {
    setError("");
    setMessage("");
    setBusy(true);

    try {
      await apiRequest(`/api/onboarding/${id}/reject`, {
        method: "POST",
        json: { reason: rejectReason.trim() || undefined },
      });
      setMessage("Request rejected.");
      setRejectingId(null);
      setRejectReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reject request.");
    } finally {
      setBusy(false);
    }
  }

  async function createStaff(): Promise<void> {
    setError("");
    setMessage("");

    if (
      !form.name.trim() ||
      !form.phone.trim() ||
      !form.email.trim() ||
      !form.facilityId
    ) {
      setError("Complete all required fields.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (form.role === "service_staff" && !form.departmentId) {
      setError("Select a department for service staff.");
      return;
    }

    setBusy(true);

    try {
      await apiRequest("/api/users", {
        method: "POST",
        json: {
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          facilityId: form.facilityId,
          departmentId: form.role === "service_staff" ? form.departmentId : undefined,
        },
      });

      setShowForm(false);
      setMessage(`Account created for ${form.name.trim()}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create account.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(member: ApiUser): Promise<void> {
    setError("");
    setMessage("");

    try {
      await apiRequest(`/api/users/${member.id}/status`, {
        method: "PATCH",
        json: { active: member.status !== "active" },
      });
      setMessage(
        member.status === "active"
          ? `${member.name} removed.`
          : `${member.name} restored.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update account.");
    }
  }

  const inputClass =
    "mt-2 w-full rounded-lg border border-lunar-border bg-white px-3 py-2.5 text-sm";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Staff</h1>
          <p className="mt-2 text-sm text-lunar-muted">
            Approve onboarding requests, or add an account directly.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setForm(emptyForm(facilityId));
            setError("");
            setMessage("");
            setShowForm(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-lunar-primary px-4 py-3 text-sm font-medium text-white"
        >
          <Plus size={18} />
          Add account directly
        </button>
      </div>

      {message && (
        <p role="status" className="mt-5 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
          {message}
        </p>
      )}

      {error && !showForm && !rejectingId && (
        <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="mt-6 overflow-hidden rounded-xl border border-lunar-border bg-white">
        <div className="border-b border-lunar-border p-5">
          <h2 className="text-lg font-semibold">Pending requests</h2>
          <p className="mt-1 text-sm text-lunar-muted">
            People who have asked to join the platform.
          </p>
        </div>

        <table className="w-full text-left text-sm">
          <thead className="bg-lunar-background text-xs text-lunar-muted">
            <tr>
              <th className="px-5 py-4">Name</th>
              <th className="px-5 py-4">Contact</th>
              <th className="px-5 py-4">Role</th>
              <th className="px-5 py-4">Facility</th>
              <th className="px-5 py-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id} className="border-t border-lunar-border">
                <td className="px-5 py-4 font-medium">{request.name}</td>
                <td className="px-5 py-4">
                  <p>{request.email}</p>
                  <p className="mt-1 text-xs text-lunar-muted">{request.phone}</p>
                </td>
                <td className="px-5 py-4">{ROLE_LABELS[request.role]}</td>
                <td className="px-5 py-4">{request.facilityName}</td>
                <td className="px-5 py-4">
                  {rejectingId === request.id ? (
                    <div className="space-y-2">
                      <input
                        placeholder="Reason (optional)"
                        value={rejectReason}
                        onChange={(event) => setRejectReason(event.target.value)}
                        className="w-full rounded-lg border border-lunar-border px-2 py-1.5 text-xs"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void reject(request.id)}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                        >
                          Confirm reject
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectingId(null)}
                          className="rounded-lg border border-lunar-border px-3 py-1.5 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void approve(request.id)}
                        className="text-sm font-medium text-emerald-700 disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setRejectingId(request.id);
                          setRejectReason("");
                        }}
                        className="text-sm font-medium text-red-700 disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && requests.length === 0 && (
          <p className="p-8 text-center text-sm text-lunar-muted">
            No pending requests.
          </p>
        )}
      </section>

      <section className="mt-6 overflow-hidden rounded-xl border border-lunar-border bg-white">
        <div className="border-b border-lunar-border p-5">
          <h2 className="text-lg font-semibold">All staff</h2>
        </div>

        <table className="w-full text-left text-sm">
          <thead className="bg-lunar-background text-xs text-lunar-muted">
            <tr>
              <th className="px-5 py-4">Name</th>
              <th className="px-5 py-4">Contact</th>
              <th className="px-5 py-4">Role</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((member) => (
              <tr key={member.id} className="border-t border-lunar-border">
                <td className="px-5 py-4 font-medium">{member.name}</td>
                <td className="px-5 py-4">
                  <p>{member.email}</p>
                  <p className="mt-1 text-xs text-lunar-muted">{member.phone}</p>
                </td>
                <td className="px-5 py-4">{ROLE_LABELS[member.role]}</td>
                <td className="px-5 py-4">
                  <span
                    className={
                      member.status === "active"
                        ? "rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700"
                        : "rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
                    }
                  >
                    {member.status}
                  </span>
                </td>
                <td className="px-5 py-4">
                  {member.id !== actor.id && (
                    <button
                      type="button"
                      onClick={() => void toggleStatus(member)}
                      className={
                        member.status === "active"
                          ? "text-sm font-medium text-red-700"
                          : "text-sm font-medium text-emerald-700"
                      }
                    >
                      {member.status === "active" ? "Remove" : "Restore"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && staff.length === 0 && (
          <p className="p-8 text-center text-sm text-lunar-muted">No staff yet.</p>
        )}
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-staff-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6"
          >
            <div className="flex items-center justify-between">
              <h2 id="create-staff-title" className="text-xl font-semibold">
                Add account directly
              </h2>
              <button type="button" aria-label="Close" onClick={() => setShowForm(false)}>
                <X size={20} />
              </button>
            </div>

            <form
              className="mt-6 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void createStaff();
              }}
            >
              <label className="block text-sm">
                Full name
                <input
                  required
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  className={inputClass}
                />
              </label>
              <label className="block text-sm">
                Phone number
                <input
                  required
                  type="tel"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  className={inputClass}
                />
              </label>
              <label className="block text-sm">
                Email address
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  className={inputClass}
                />
              </label>
              <label className="block text-sm">
                Role
                <select
                  value={form.role}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      role: event.target.value as UserRole,
                      departmentId: "",
                    })
                  }
                  className={inputClass}
                >
                  <option value="cashier">Cashier (Operations)</option>
                  <option value="service_staff">Service Staff</option>
                  <option value="facility_manager">Facility Manager</option>
                  <option value="finance">Finance (Auditor)</option>
                  <option value="front_office">Admin</option>
                </select>
              </label>
              {form.role === "service_staff" && (
                <label className="block text-sm">
                  Department (service point)
                  <select
                    required
                    value={form.departmentId}
                    onChange={(event) =>
                      setForm({ ...form, departmentId: event.target.value })
                    }
                    className={inputClass}
                  >
                    <option value="">Select department</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block text-sm">
                Facility
                <select
                  required
                  value={form.facilityId}
                  onChange={(event) =>
                    setForm({ ...form, facilityId: event.target.value })
                  }
                  className={inputClass}
                >
                  <option value="">Select facility</option>
                  {data.hospitals.map((hospital) => (
                    <option key={hospital.id} value={hospital.id}>
                      {hospital.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Password
                <input
                  required
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  className={inputClass}
                />
              </label>
              <label className="block text-sm">
                Confirm password
                <input
                  required
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={(event) =>
                    setForm({ ...form, confirmPassword: event.target.value })
                  }
                  className={inputClass}
                />
              </label>

              {error && (
                <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-lunar-border px-4 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-lunar-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  Create account
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
