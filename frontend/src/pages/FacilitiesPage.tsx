import { useState } from "react";
import { Plus, X } from "lucide-react";

import { apiRequest } from "../api/client";
import { useApp } from "../hooks/useApp";

export default function FacilitiesPage() {
  const { data, currentUser, refreshDirectory } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  if (!currentUser) return null;

  async function createFacility(): Promise<void> {
    setError("");
    setMessage("");

    if (!name.trim()) {
      setError("Enter a facility name.");
      return;
    }

    setBusy(true);

    try {
      await apiRequest("/api/facilities", {
        method: "POST",
        json: { name: name.trim() },
      });

      setShowForm(false);
      setMessage(`Facility "${name.trim()}" created.`);
      setName("");
      await refreshDirectory();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create facility.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Facilities</h1>
          <p className="mt-2 text-sm text-lunar-muted">
            Facilities you're assigned to manage.
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
          Add facility
        </button>
      </div>

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

      <section className="mt-6 overflow-hidden rounded-xl border border-lunar-border bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-lunar-background text-xs text-lunar-muted">
            <tr>
              <th className="px-5 py-4">Name</th>
            </tr>
          </thead>
          <tbody>
            {data.hospitals.map((hospital) => (
              <tr key={hospital.id} className="border-t border-lunar-border">
                <td className="px-5 py-4 font-medium">{hospital.name}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {data.hospitals.length === 0 && (
          <p className="p-8 text-center text-sm text-lunar-muted">
            No facilities yet.
          </p>
        )}
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="facility-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-raised"
          >
            <div className="flex items-center justify-between">
              <h2 id="facility-title" className="text-xl font-semibold">
                Add facility
              </h2>
              <button type="button" aria-label="Close" onClick={() => setShowForm(false)}>
                <X size={20} />
              </button>
            </div>

            <form
              className="mt-6 space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                void createFacility();
              }}
            >
              <label className="block text-sm font-medium">
                Facility name
                <input
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Kano Teaching Hospital"
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
                  Create facility
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
