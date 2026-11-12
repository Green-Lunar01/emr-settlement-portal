import { useEffect, useState } from "react";
import { Moon } from "lucide-react";
import { Link } from "react-router-dom";
import { apiRequest, type ApiDepartment } from "../api/client";
import type { UserRole } from "../types";

interface ApiPublicFacility {
  id: string;
  name: string;
}

interface SignupForm {
  name: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
  facilityId: string;
  departmentId: string;
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "cashier", label: "Cashier (Operations)" },
  { value: "service_staff", label: "Service Staff" },
  { value: "facility_manager", label: "Facility Manager" },
  { value: "finance", label: "Finance (Auditor)" },
  { value: "front_office", label: "Admin" },
];

function emptyForm(): SignupForm {
  return {
    name: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "cashier",
    facilityId: "",
    departmentId: "",
  };
}

export default function SignupPage() {
  const [facilities, setFacilities] = useState<ApiPublicFacility[]>([]);
  const [departments, setDepartments] = useState<ApiDepartment[]>([]);
  const [form, setForm] = useState<SignupForm>(emptyForm());
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const result = await apiRequest<{ facilities: ApiPublicFacility[] }>(
          "/api/facilities/public",
        );

        if (!cancelled) {
          setFacilities(result.facilities);
          setForm((current) => ({
            ...current,
            facilityId: result.facilities[0]?.id ?? "",
          }));
        }
      } catch {
        // facility list failing to load just leaves the select empty
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (form.role !== "service_staff" || !form.facilityId) {
      setDepartments([]);
      return;
    }

    let cancelled = false;

    async function loadDepartments(): Promise<void> {
      try {
        const result = await apiRequest<{ departments: ApiDepartment[] }>(
          `/api/departments/public?facilityId=${encodeURIComponent(form.facilityId)}`,
        );

        if (!cancelled) {
          setDepartments(result.departments);
        }
      } catch {
        // leave the select empty if this fails
      }
    }

    void loadDepartments();

    return () => {
      cancelled = true;
    };
  }, [form.role, form.facilityId]);

  async function submit(): Promise<void> {
    setError("");

    if (
      !form.name.trim() ||
      !form.phone.trim() ||
      !form.email.trim() ||
      !form.facilityId
    ) {
      setError("Fill in all fields.");
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
      setError("Select which department you work at.");
      return;
    }

    setBusy(true);

    try {
      await apiRequest("/api/onboarding", {
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

      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to submit your request.",
      );
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "mt-2 w-full rounded-xl border border-lunar-border bg-white px-3 py-3 text-sm shadow-card focus:border-lunar-primary";

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-lunar-sidebar p-14 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(45,212,191,0.25), transparent 45%), radial-gradient(circle at 80% 70%, rgba(15,157,120,0.3), transparent 50%)",
          }}
        />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-lunar-primary to-lunar-accent shadow-raised">
            <Moon size={22} className="text-white" />
          </div>
          <div>
            <p className="text-xl font-bold leading-tight">Lunar</p>
            <p className="text-[11px] font-medium tracking-widest text-white/50">
              HOSPITAL REVENUE PLATFORM
            </p>
          </div>
        </div>

        <div className="relative my-12 max-w-lg">
          <h1 className="text-4xl font-semibold leading-tight lg:text-5xl">
            Request access.
          </h1>
          <p className="mt-6 leading-relaxed text-white/70">
            Submit your details below. An admin reviews every request
            before an account is created.
          </p>
        </div>

        <p className="relative text-sm text-white/50">
          <Link to="/login" className="underline hover:text-white">
            Back to sign in
          </Link>
        </p>
      </section>

      <section className="flex items-center justify-center bg-lunar-background p-6 lg:bg-white lg:p-12">
        <div className="w-full max-w-md">
          {submitted ? (
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">Request submitted</h2>
              <p className="mt-4 text-sm text-lunar-muted">
                An admin will review your request. You'll be able to
                sign in once it's approved.
              </p>
              <Link
                to="/login"
                className="mt-6 inline-block text-sm font-medium text-lunar-primary"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-3xl font-semibold tracking-tight">Request access</h2>
              <p className="mt-3 text-sm text-lunar-muted">
                Tell us who you are and which facility you work at.
              </p>

              <form
                className="mt-8 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit();
                }}
              >
                <label className="block text-sm font-medium">
                  Full name
                  <input
                    required
                    value={form.name}
                    onChange={(event) =>
                      setForm({ ...form, name: event.target.value })
                    }
                    className={inputClass}
                  />
                </label>

                <label className="block text-sm font-medium">
                  Phone number
                  <input
                    required
                    type="tel"
                    value={form.phone}
                    onChange={(event) =>
                      setForm({ ...form, phone: event.target.value })
                    }
                    className={inputClass}
                  />
                </label>

                <label className="block text-sm font-medium">
                  Email address
                  <input
                    required
                    type="email"
                    autoComplete="username"
                    value={form.email}
                    onChange={(event) =>
                      setForm({ ...form, email: event.target.value })
                    }
                    className={inputClass}
                  />
                </label>

                <label className="block text-sm font-medium">
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
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-medium">
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
                    {facilities.map((facility) => (
                      <option key={facility.id} value={facility.id}>
                        {facility.name}
                      </option>
                    ))}
                  </select>
                </label>

                {form.role === "service_staff" && (
                  <label className="block text-sm font-medium">
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

                <label className="block text-sm font-medium">
                  Password
                  <input
                    required
                    type="password"
                    minLength={8}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(event) =>
                      setForm({ ...form, password: event.target.value })
                    }
                    className={inputClass}
                  />
                </label>

                <label className="block text-sm font-medium">
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
                  <p
                    role="alert"
                    className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-xl bg-lunar-primary px-4 py-3 font-medium text-white shadow-raised hover:bg-lunar-primary-dark disabled:opacity-60"
                >
                  Submit request
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
