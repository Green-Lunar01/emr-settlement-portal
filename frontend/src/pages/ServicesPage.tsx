import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";

import { apiRequest, type ApiDepartment, type ApiServiceItem } from "../api/client";
import { useApp } from "../hooks/useApp";
import { formatMoney } from "../utils/accounting";

interface ItemForm {
  departmentId: string;
  name: string;
  price: string;
}

function emptyForm(departmentId: string): ItemForm {
  return { departmentId, name: "", price: "" };
}

export default function ServicesPage() {
  const { currentUser } = useApp();
  const facilityId = currentUser?.hospitalIds[0] ?? "";

  const [items, setItems] = useState<ApiServiceItem[]>([]);
  const [departments, setDepartments] = useState<ApiDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ItemForm>(emptyForm(""));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(): Promise<void> {
    if (!facilityId) return;
    setLoading(true);

    try {
      const [itemResult, departmentResult] = await Promise.all([
        apiRequest<{ services: ApiServiceItem[] }>(
          `/api/services?facilityId=${encodeURIComponent(facilityId)}`,
        ),
        apiRequest<{ departments: ApiDepartment[] }>(
          `/api/departments?facilityId=${encodeURIComponent(facilityId)}`,
        ),
      ]);

      setItems(itemResult.services);
      setDepartments(departmentResult.departments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load services.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId]);

  if (!currentUser) return null;

  async function createItem(): Promise<void> {
    setError("");
    setMessage("");

    const price = Number(form.price);

    if (!form.departmentId || !form.name.trim() || !Number.isFinite(price) || price <= 0) {
      setError("Fill in all fields with a valid price.");
      return;
    }

    setBusy(true);

    try {
      await apiRequest("/api/services", {
        method: "POST",
        json: {
          facilityId,
          departmentId: form.departmentId,
          name: form.name.trim(),
          price,
        },
      });

      setShowForm(false);
      setMessage(`"${form.name.trim()}" added.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create item.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(item: ApiServiceItem): Promise<void> {
    setError("");

    try {
      await apiRequest(`/api/services/${item.id}`, {
        method: "PATCH",
        json: { active: !item.active },
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update item.");
    }
  }

  const inputClass =
    "mt-2 w-full rounded-lg border border-lunar-border bg-white px-3 py-2.5 text-sm";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Drugs & Services</h1>
          <p className="mt-2 text-sm text-lunar-muted">
            Set the fixed price for everything cashiers and service staff bill for.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setForm(emptyForm(departments[0]?.id ?? ""));
            setError("");
            setMessage("");
            setShowForm(true);
          }}
          disabled={departments.length === 0}
          className="flex items-center gap-2 rounded-lg bg-lunar-primary px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          <Plus size={18} />
          Add item
        </button>
      </div>

      {departments.length === 0 && (
        <p className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
          Set up at least one department before adding priced items.
        </p>
      )}

      {message && (
        <p role="status" className="mt-5 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
          {message}
        </p>
      )}

      {error && !showForm && (
        <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="mt-6 overflow-hidden rounded-xl border border-lunar-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-lunar-background text-xs text-lunar-muted">
            <tr>
              <th className="px-5 py-4">Name</th>
              <th className="px-5 py-4">Department</th>
              <th className="px-5 py-4">Price</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-lunar-border">
                <td className="px-5 py-4 font-medium">{item.name}</td>
                <td className="px-5 py-4">{item.departmentName}</td>
                <td className="px-5 py-4">{formatMoney(item.price)}</td>
                <td className="px-5 py-4">
                  <span
                    className={
                      item.active
                        ? "rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700"
                        : "rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
                    }
                  >
                    {item.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <button
                    type="button"
                    onClick={() => void toggleActive(item)}
                    className="text-sm font-medium text-lunar-primary"
                  >
                    {item.active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && items.length === 0 && (
          <p className="p-8 text-center text-sm text-lunar-muted">
            No drugs or services registered yet.
          </p>
        )}
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="service-title"
            className="w-full max-w-md rounded-xl bg-white p-6"
          >
            <div className="flex items-center justify-between">
              <h2 id="service-title" className="text-xl font-semibold">
                Add item
              </h2>
              <button type="button" aria-label="Close" onClick={() => setShowForm(false)}>
                <X size={20} />
              </button>
            </div>

            <form
              className="mt-6 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void createItem();
              }}
            >
              <label className="block text-sm font-medium">
                Department
                <select
                  required
                  value={form.departmentId}
                  onChange={(event) => setForm({ ...form, departmentId: event.target.value })}
                  className={inputClass}
                >
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium">
                Name
                <input
                  required
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="e.g. Malaria test"
                  className={inputClass}
                />
              </label>

              <label className="block text-sm font-medium">
                Price (₦)
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.price}
                  onChange={(event) => setForm({ ...form, price: event.target.value })}
                  className={inputClass}
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
                  className="rounded-lg bg-lunar-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  Add item
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
