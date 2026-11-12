import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";

import { apiRequest, type ApiDepartment } from "../api/client";
import { useApp } from "../hooks/useApp";

export default function DepartmentsPage() {
  const { currentUser } = useApp();
  const [departments, setDepartments] = useState<ApiDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const actor = currentUser;
  const facilityId = actor?.hospitalIds[0] ?? "";

  async function load(): Promise<void> {
    if (!facilityId) return;
    setLoading(true);

    try {
      const result = await apiRequest<{ departments: ApiDepartment[] }>(
        `/api/departments?facilityId=${encodeURIComponent(facilityId)}`,
      );
      setDepartments(result.departments);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load departments.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId]);

  if (!actor) return null;

  async function createDepartment(): Promise<void> {
    setError("");
    setMessage("");

    if (!name.trim()) {
      setError("Enter a department name.");
      return;
    }

    setBusy(true);

    try {
      await apiRequest("/api/departments", {
        method: "POST",
        json: { facilityId, name: name.trim() },
      });
      setShowForm(false);
      setName("");
      setMessage(`Department "${name.trim()}" created.`);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create department.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(department: ApiDepartment): Promise<void> {
    setError("");

    try {
      await apiRequest(`/api/departments/${department.id}`, {
        method: "PATCH",
        json: { active: !department.active },
      });
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update department.",
      );
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Departments</h1>
          <p className="mt-2 text-sm text-lunar-muted">
            Set up the departments cashiers can raise bills against.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setName("");
            setError("");
            setMessage("");
            setShowForm(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-lunar-primary px-4 py-3 text-sm font-medium text-white shadow-raised hover:bg-lunar-primary-dark"
        >
          <Plus size={18} />
          Add department
        </button>
      </div>

      {message && (
        <p
          role="status"
          className="mt-5 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {message}
        </p>
      )}

      {error && !showForm && (
        <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="mt-6 overflow-hidden rounded-xl border border-lunar-border bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-lunar-background text-xs text-lunar-muted">
            <tr>
              <th className="px-5 py-4">Name</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((department) => (
              <tr key={department.id} className="border-t border-lunar-border">
                <td className="px-5 py-4 font-medium">{department.name}</td>
                <td className="px-5 py-4">
                  <span
                    className={
                      department.active
                        ? "rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700"
                        : "rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
                    }
                  >
                    {department.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <button
                    type="button"
                    onClick={() => void toggleActive(department)}
                    className="text-sm font-medium text-lunar-primary"
                  >
                    {department.active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && departments.length === 0 && (
          <p className="p-8 text-center text-sm text-lunar-muted">
            No departments yet.
          </p>
        )}
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="department-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-raised"
          >
            <div className="flex items-center justify-between">
              <h2 id="department-title" className="text-xl font-semibold">
                Add department
              </h2>
              <button type="button" aria-label="Close" onClick={() => setShowForm(false)}>
                <X size={20} />
              </button>
            </div>

            <form
              className="mt-6 space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                void createDepartment();
              }}
            >
              <label className="block text-sm font-medium">
                Department name
                <input
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Radiology"
                  className="mt-2 w-full rounded-lg border border-lunar-border px-3 py-3 text-sm"
                />
              </label>

              {error && (
                <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3">
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
                  className="rounded-xl bg-lunar-primary px-4 py-2 text-sm font-medium text-white shadow-raised hover:bg-lunar-primary-dark disabled:opacity-60"
                >
                  Create department
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
