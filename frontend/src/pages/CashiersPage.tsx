import { useState } from "react";
import { Search } from "lucide-react";
import { useApp } from "../hooks/useApp";

export default function CashiersPage() {
  const { data, currentUser } = useApp();
  const [search, setSearch] = useState("");
  const [hospitalFilter, setHospitalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  if (!currentUser || currentUser.role === "cashier") {
    return null;
  }

  const actor = currentUser;
  const availableHospitals = data.hospitals.filter((hospital) =>
    actor.hospitalIds.includes(hospital.id),
  );
  const visibleCashiers = data.users.filter(
    (user) =>
      user.role === "cashier" &&
      user.hospitalIds.some((hospitalId) =>
        actor.hospitalIds.includes(hospitalId),
      ),
  );
  const filteredCashiers = visibleCashiers.filter((cashier) => {
    const matchesSearch = cashier.name
      .toLowerCase()
      .includes(search.trim().toLowerCase());
    const matchesHospital =
      !hospitalFilter || cashier.hospitalIds.includes(hospitalFilter);
    const matchesStatus = !statusFilter || cashier.status === statusFilter;

    return matchesSearch && matchesHospital && matchesStatus;
  });

  function hospitalName(id: string): string {
    return (
      data.hospitals.find((hospital) => hospital.id === id)?.name ??
      "Unknown hospital"
    );
  }

  const inputClass =
    "w-full rounded-lg border border-lunar-border bg-white px-3 py-2.5 text-sm";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Cashiers</h1>
          <p className="mt-2 text-sm text-lunar-muted">
            View cashiers assigned to your facility. Front Office creates and
            approves new accounts.
          </p>
        </div>
      </div>

      <section className="mt-6 overflow-hidden rounded-xl border border-lunar-border bg-white">
        <div className="flex flex-wrap gap-3 border-b border-lunar-border p-4">
          <div className="relative min-w-48 flex-1">
            <Search size={17} className="absolute left-3 top-3 text-lunar-muted" />
            <input
              aria-label="Search cashier name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search cashier name"
              className={`${inputClass} pl-10`}
            />
          </div>
          <select
            aria-label="Filter hospital"
            value={hospitalFilter}
            onChange={(event) => setHospitalFilter(event.target.value)}
            className="rounded-lg border border-lunar-border px-3 py-2 text-sm"
          >
            <option value="">All assigned hospitals</option>
            {availableHospitals.map((hospital) => (
              <option key={hospital.id} value={hospital.id}>
                {hospital.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter account status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-lunar-border px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-lunar-background text-xs text-lunar-muted">
              <tr>
                <th className="px-5 py-4">Name</th>
                <th className="px-5 py-4">Contact</th>
                <th className="px-5 py-4">Hospital</th>
                <th className="px-5 py-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredCashiers.map((cashier) => (
                <tr key={cashier.id} className="border-t border-lunar-border">
                  <td className="whitespace-nowrap px-5 py-4 font-medium">
                    {cashier.name}
                  </td>
                  <td className="px-5 py-4">
                    <p>{cashier.email}</p>
                    <p className="mt-1 text-xs text-lunar-muted">{cashier.phone}</p>
                  </td>
                  <td className="px-5 py-4">
                    {cashier.hospitalIds.map(hospitalName).join(", ")}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={
                        cashier.status === "active"
                          ? "rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700"
                          : "rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
                      }
                    >
                      {cashier.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredCashiers.length === 0 && (
            <p className="p-8 text-center text-sm text-lunar-muted">
              No cashiers match your filters.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
