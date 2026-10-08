import { useEffect, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import {
  apiRequest,
  type ApiEmr,
  type ApiTap,
  type EmrFiguresInput,
} from "../api/client";
import { useApp } from "../hooks/useApp";
import { formatMoney, getToday } from "../utils/accounting";

interface EmrForm {
  facilityId: string;
  date: string;
  transactionCount: string;
  transactionAmount: string;
}

interface TapForm {
  facilityId: string;
  date: string;
  transactionCount: string;
  transactionAmount: string;
}

function emptyForm(facilityId: string): EmrForm {
  return {
    facilityId,
    date: getToday(),
    transactionCount: "",
    transactionAmount: "",
  };
}

function StatusBadge({ value }: { value: string }) {
  const colour =
    ["Good", "Confirmed", "Completed"].includes(value)
      ? "bg-emerald-50 text-emerald-700"
      : ["Check Record", "Not Confirmed", "Returned"].includes(value)
        ? "bg-red-50 text-red-700"
        : "bg-amber-50 text-amber-700";

  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs ${colour}`}
    >
      {value}
    </span>
  );
}

function parseCount(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function parseAmount(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0 ||
    Math.abs(parsed * 100 - Math.round(parsed * 100)) > 0.000001
  ) {
    return null;
  }

  return parsed;
}

function latestManagerComment(record: ApiEmr): string {
  for (let index = record.iterations.length - 1; index >= 0; index -= 1) {
    const comment = record.iterations[index]?.managerReview.comment;

    if (comment) {
      return comment;
    }
  }

  return "";
}

function latestResolution(record: ApiEmr): string {
  for (let index = record.iterations.length - 1; index >= 0; index -= 1) {
    const text = record.iterations[index]?.financeResolution?.text;

    if (text) {
      return text;
    }
  }

  return "";
}

export default function EmrPage() {
  const { data, currentUser, emrRecords, upsertEmr } = useApp();
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<EmrForm>(emptyForm(""));
  const [decision, setDecision] = useState<"Confirmed" | "Not Confirmed">(
    "Confirmed",
  );
  const [managerComment, setManagerComment] = useState("");
  const [resolution, setResolution] = useState("");
  const [tapPreview, setTapPreview] = useState<ApiTap | null>(null);
  const [tapForm, setTapForm] = useState<TapForm>({
    facilityId: "",
    date: getToday(),
    transactionCount: "",
    transactionAmount: "",
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const actor = currentUser;
  const selectedRecord =
    emrRecords.find((record) => record.id === selectedId) ?? null;
  const isCashier = actor?.role === "cashier";
  const isFinance = actor?.role === "finance";
  const isManager = actor?.role === "facility_manager";
  const mayEditFigures = Boolean(
    isCashier && (!selectedRecord || selectedRecord.editable),
  );

  useEffect(() => {
    if (!modalOpen || !mayEditFigures || !form.facilityId || !form.date) {
      return;
    }

    let cancelled = false;

    async function loadTap(): Promise<void> {
      try {
        const result = await apiRequest<{ tapRecords: ApiTap[] }>(
          `/api/tap?facilityId=${encodeURIComponent(form.facilityId)}&date=${encodeURIComponent(form.date)}`,
        );

        if (!cancelled) {
          setTapPreview(result.tapRecords[0] ?? null);
        }
      } catch {
        if (!cancelled) {
          setTapPreview(null);
        }
      }
    }

    void loadTap();

    return () => {
      cancelled = true;
    };
  }, [modalOpen, mayEditFigures, form.facilityId, form.date]);

  if (!actor) return null;

  const facilities = data.hospitals.filter((hospital) =>
    actor.hospitalIds.includes(hospital.id),
  );

  const count = parseCount(form.transactionCount);
  const amount = parseAmount(form.transactionAmount);
  const figuresValid = count !== null && amount !== null;
  const shownTap = selectedRecord?.current.tap ?? tapPreview;
  const shownComparison = selectedRecord?.current.comparison;

  const records = emrRecords.filter((record) => {
    const remark = record.current.comparison?.status ?? "";

    return (
      record.cashierName.toLowerCase().includes(search.trim().toLowerCase()) &&
      (!dateFilter || record.date === dateFilter) &&
      (!statusFilter || remark === statusFilter)
    );
  });

  function openNewRecord() {
    const facilityId = actor?.hospitalIds[0] ?? "";
    setSelectedId(null);
    setForm(emptyForm(facilityId));
    setTapPreview(null);
    setDecision("Confirmed");
    setManagerComment("");
    setResolution("");
    setError("");
    setMessage("");
    setModalOpen(true);
  }

  function openRecord(record: ApiEmr) {
    setSelectedId(record.id);
    setForm({
      facilityId: record.facilityId,
      date: record.date,
      transactionCount: String(record.current.emr.transactionCount),
      transactionAmount: String(record.current.emr.transactionAmount),
    });
    setTapPreview(null);
    setDecision(
      record.current.managerReview.status === "Not Confirmed" ||
        record.current.financeReview.status === "Not Confirmed"
        ? "Not Confirmed"
        : "Confirmed",
    );
    setManagerComment(record.current.managerReview.comment ?? "");
    setResolution(latestResolution(record));
    setError("");
    setMessage("");
    setModalOpen(true);
  }

  async function saveFigures(submit: boolean): Promise<void> {
    if (!actor || count === null || amount === null) {
      setError("Enter a transaction count and an amount.");
      return;
    }

    const wasDraft =
      !selectedRecord || selectedRecord.current.submissionStatus === "Draft";
    setBusy(true);
    setError("");

    try {
      let record = selectedRecord;
      const input: EmrFiguresInput = {
        facilityId: form.facilityId,
        date: form.date,
        transactionCount: count,
        transactionAmount: amount,
      };

      if (!record) {
        record = await apiRequest<ApiEmr>("/api/emr", {
          method: "POST",
          json: input,
        });
        upsertEmr(record);
        setSelectedId(record.id);
      } else if (record.editable) {
        record = await apiRequest<ApiEmr>(`/api/emr/${record.id}`, {
          method: "PATCH",
          json: {
            transactionCount: count,
            transactionAmount: amount,
          },
        });
        upsertEmr(record);
      }

      if (submit && record.current.submissionStatus === "Draft") {
        record = await apiRequest<ApiEmr>(`/api/emr/${record.id}/submit`, {
          method: "POST",
        });
        upsertEmr(record);
      }

      setModalOpen(false);
      setMessage(
        submit && wasDraft
          ? "EMR record submitted for review."
          : submit
            ? "Submission updated."
            : "Draft saved.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save the record.");
    } finally {
      setBusy(false);
    }
  }

  async function saveReview(): Promise<void> {
    if (!selectedRecord || !actor) return;
    setBusy(true);
    setError("");

    try {
      const path =
        actor.role === "finance"
          ? `/api/emr/${selectedRecord.id}/finance-review`
          : `/api/emr/${selectedRecord.id}/manager-review`;
      const record = await apiRequest<ApiEmr>(path, {
        method: "POST",
        json:
          actor.role === "finance"
            ? { status: decision, resolution }
            : { status: decision, comment: managerComment },
      });
      upsertEmr(record);
      setModalOpen(false);
      setMessage(`Review saved: ${decision}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save the review.");
    } finally {
      setBusy(false);
    }
  }

  async function saveTap(): Promise<void> {
    const tapCount = parseCount(tapForm.transactionCount);
    const tapAmount = parseAmount(tapForm.transactionAmount);

    if (tapCount === null || tapAmount === null) {
      setError("Enter a valid TAP count and amount.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      await apiRequest<ApiTap>("/api/tap", {
        method: "PUT",
        json: {
          facilityId: tapForm.facilityId,
          date: tapForm.date,
          transactionCount: tapCount,
          transactionAmount: tapAmount,
        },
      });
      setMessage(`TAP saved for ${tapForm.date}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save TAP.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "mt-2 w-full rounded-lg border border-lunar-border bg-white px-3 py-2.5 text-sm disabled:bg-slate-50 disabled:text-slate-600";
  const managerCanReview =
    isManager &&
    selectedRecord?.current.submissionStatus === "Submitted" &&
    selectedRecord.current.managerReview.status === "Pending";
  const financeCanReview =
    isFinance &&
    selectedRecord?.current.submissionStatus === "Submitted" &&
    selectedRecord.current.managerReview.status !== "Pending" &&
    selectedRecord.current.financeReview.status === "Pending";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">EMR Accounting</h1>
          <p className="mt-2 text-sm text-lunar-muted">
            Enter the facility figures. The server compares them with TAP.
          </p>
        </div>

        {isCashier && (
          <button
            type="button"
            onClick={openNewRecord}
            className="flex items-center gap-2 rounded-lg bg-lunar-primary px-4 py-3 text-sm font-medium text-white"
          >
            <Plus size={18} />
            New record
          </button>
        )}
      </div>

      {message && (
        <p
          role="status"
          className="mt-5 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {message}
        </p>
      )}

      {error && !modalOpen && (
        <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      {isFinance && (
        <form
          className="mt-6 rounded-xl border border-lunar-border bg-white p-5"
          onSubmit={(event) => {
            event.preventDefault();
            void saveTap();
          }}
        >
          <h2 className="font-semibold">TAP source</h2>
          <p className="mt-1 text-sm text-lunar-muted">
            Save the transaction-system figures for a facility and date.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <label className="text-sm md:col-span-2">
              Facility
              <select
                required
                value={tapForm.facilityId}
                onChange={(event) =>
                  setTapForm({ ...tapForm, facilityId: event.target.value })
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
            <label className="text-sm">
              Date
              <input
                type="date"
                required
                value={tapForm.date}
                onChange={(event) =>
                  setTapForm({ ...tapForm, date: event.target.value })
                }
                className={inputClass}
              />
            </label>
            <label className="text-sm">
              Transactions
              <input
                type="number"
                required
                min="0"
                step="1"
                value={tapForm.transactionCount}
                onChange={(event) =>
                  setTapForm({
                    ...tapForm,
                    transactionCount: event.target.value,
                  })
                }
                className={inputClass}
              />
            </label>
            <label className="text-sm">
              Amount (₦)
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={tapForm.transactionAmount}
                onChange={(event) =>
                  setTapForm({
                    ...tapForm,
                    transactionAmount: event.target.value,
                  })
                }
                className={inputClass}
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="mt-4 rounded-lg bg-lunar-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            Save TAP
          </button>
        </form>
      )}

      <section className="mt-6 overflow-hidden rounded-xl border border-lunar-border bg-white">
        <div className="flex flex-wrap gap-3 border-b border-lunar-border p-4">
          <div className="relative min-w-48 flex-1">
            <Search
              size={17}
              className="absolute left-3 top-3 text-lunar-muted"
            />
            <input
              aria-label="Search cashier name"
              placeholder="Search cashier name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-lg border border-lunar-border py-2.5 pl-10 pr-3 text-sm"
            />
          </div>
          <input
            aria-label="Filter record date"
            type="date"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
            className="rounded-lg border border-lunar-border px-3 py-2 text-sm"
          />
          <select
            aria-label="Filter automatic remark"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-lunar-border px-3 py-2 text-sm"
          >
            <option value="">All automatic remarks</option>
            <option value="Good">Good</option>
            <option value="Check Record">Check Record</option>
          </select>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setDateFilter("");
              setStatusFilter("");
            }}
            className="text-sm text-lunar-primary"
          >
            Clear filters
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="bg-lunar-background text-xs text-lunar-muted">
              <tr>
                {[
                  "Cashier / Date",
                  "Stage",
                  "EMR transactions",
                  "EMR amount",
                  "TAP transactions",
                  "TAP amount",
                  "Automatic remark",
                  "Facility Manager",
                  "Manager comment",
                  "Finance",
                  ...(isFinance ? ["Resolution"] : []),
                  "Action",
                ].map((heading) => (
                  <th key={heading} className="px-4 py-4">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-t border-lunar-border">
                  <td className="px-4 py-4">
                    <p className="font-medium">{record.cashierName}</p>
                    <p className="mt-1 text-xs text-lunar-muted">{record.date}</p>
                    <p className="mt-1 text-xs text-lunar-muted">
                      {record.facilityName}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge value={record.stage} />
                  </td>
                  <td className="px-4 py-4">
                    {record.current.emr.transactionCount}
                  </td>
                  <td className="px-4 py-4">
                    {formatMoney(record.current.emr.transactionAmount)}
                  </td>
                  <td className="px-4 py-4">
                    {record.current.tap?.transactionCount ?? "—"}
                  </td>
                  <td className="px-4 py-4">
                    {record.current.tap
                      ? formatMoney(record.current.tap.transactionAmount)
                      : "—"}
                  </td>
                  <td className="px-4 py-4">
                    {record.current.comparison ? (
                      <StatusBadge value={record.current.comparison.status} />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge value={record.current.managerReview.status} />
                  </td>
                  <td className="min-w-48 max-w-72 whitespace-pre-wrap break-words px-4 py-4 text-xs">
                    {latestManagerComment(record) || "—"}
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge value={record.current.financeReview.status} />
                  </td>
                  {isFinance && (
                    <td className="min-w-48 max-w-72 whitespace-pre-wrap break-words px-4 py-4 text-xs">
                      {latestResolution(record) || "—"}
                    </td>
                  )}
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => openRecord(record)}
                      className="font-medium text-lunar-primary"
                    >
                      {isCashier
                        ? record.editable
                          ? "Edit"
                          : "View"
                        : "Review"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {records.length === 0 && (
            <p className="p-8 text-center text-sm text-lunar-muted">
              No EMR records match your filters.
            </p>
          )}
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="emr-dialog-title"
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 id="emr-dialog-title" className="text-xl font-semibold">
                {selectedRecord ? "EMR record" : "New EMR record"}
              </h2>
              <button
                type="button"
                aria-label="Close record"
                onClick={() => setModalOpen(false)}
              >
                <X size={21} />
              </button>
            </div>

            {selectedRecord && (
              <p className="mt-2 text-sm text-lunar-muted">
                {selectedRecord.cashierName} · {selectedRecord.facilityName} ·{" "}
                {selectedRecord.stage}
              </p>
            )}

            <form
              className="mt-6 space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (mayEditFigures) void saveFigures(true);
              }}
            >
              {isCashier && facilities.length > 1 && !selectedRecord && (
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
                    {facilities.map((facility) => (
                      <option key={facility.id} value={facility.id}>
                        {facility.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="block text-sm">
                Record date
                <input
                  type="date"
                  required
                  max={getToday()}
                  value={form.date}
                  disabled={!mayEditFigures || !!selectedRecord}
                  onChange={(event) =>
                    setForm({ ...form, date: event.target.value })
                  }
                  className={inputClass}
                />
              </label>

              <section className="overflow-hidden rounded-lg border border-lunar-border">
                <h3 className="bg-lunar-background px-4 py-3 font-semibold">
                  EMR
                </h3>
                <div className="grid gap-4 p-4 sm:grid-cols-2">
                  <label className="text-sm">
                    Number of transactions
                    <input
                      aria-label="EMR transaction count"
                      type="number"
                      required
                      min="0"
                      step="1"
                      value={form.transactionCount}
                      disabled={!mayEditFigures}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          transactionCount: event.target.value,
                        })
                      }
                      className={inputClass}
                    />
                  </label>
                  <label className="text-sm">
                    Amount for the day (₦)
                    <input
                      aria-label="EMR amount for the day"
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={form.transactionAmount}
                      disabled={!mayEditFigures}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          transactionAmount: event.target.value,
                        })
                      }
                      className={inputClass}
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-lg border border-lunar-border p-4">
                <h3 className="font-semibold">TAP</h3>
                {shownTap ? (
                  <p className="mt-2 text-sm">
                    {shownTap.transactionCount.toLocaleString("en-NG")}{" "}
                    transactions · {formatMoney(shownTap.transactionAmount)}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-lunar-muted">
                    No TAP record for this facility and date yet.
                  </p>
                )}
                <p className="mt-2 text-xs text-lunar-muted">
                  TAP comes from the transaction system. The server compares it
                  when the record is submitted.
                </p>
              </section>

              <div className="rounded-lg bg-lunar-background p-4">
                <p className="mb-2 text-sm font-medium">Automatic remark</p>
                {shownComparison ? (
                  <>
                    <StatusBadge value={shownComparison.status} />
                    <p className="mt-3 text-sm text-lunar-muted">
                      Count difference {shownComparison.countDifference} · Amount
                      difference {formatMoney(shownComparison.amountDifference)}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-lunar-muted">
                    The comparison is saved when you submit.
                  </p>
                )}
              </div>

              {isCashier && selectedRecord && !selectedRecord.editable && (
                <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  This submission is locked. Finance can return it for correction.
                </p>
              )}

              {mayEditFigures && (
                <div className="flex flex-wrap gap-3">
                  {(!selectedRecord ||
                    selectedRecord.current.submissionStatus === "Draft") && (
                    <button
                      type="button"
                      disabled={busy || !figuresValid}
                      onClick={() => void saveFigures(false)}
                      className="rounded-lg border border-lunar-border px-4 py-3 text-sm disabled:opacity-60"
                    >
                      Save draft
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={busy || !figuresValid}
                    className="rounded-lg bg-lunar-primary px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {selectedRecord?.current.submissionStatus === "Submitted"
                      ? "Update submission"
                      : selectedRecord
                        ? "Resubmit corrected record"
                        : "Submit record"}
                  </button>
                </div>
              )}
            </form>

            {selectedRecord && (
              <section className="mt-6 grid gap-4 border-t border-lunar-border pt-5 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-medium">Facility Manager review</p>
                  <StatusBadge value={selectedRecord.current.managerReview.status} />
                  {latestManagerComment(selectedRecord) && (
                    <p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-lunar-background p-3 text-sm">
                      {latestManagerComment(selectedRecord)}
                    </p>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">Finance review</p>
                  <StatusBadge value={selectedRecord.current.financeReview.status} />
                  {latestResolution(selectedRecord) && (
                    <p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-lunar-background p-3 text-sm">
                      {latestResolution(selectedRecord)}
                    </p>
                  )}
                </div>
              </section>
            )}

            {selectedRecord && selectedRecord.iterations.length > 1 && (
              <section className="mt-6 border-t border-lunar-border pt-5">
                <h3 className="text-sm font-medium">Earlier submissions</h3>
                <ul className="mt-3 space-y-3">
                  {selectedRecord.iterations.slice(0, -1).map((iteration) => (
                    <li
                      key={iteration.number}
                      className="rounded-lg bg-lunar-background p-3 text-sm"
                    >
                      <p className="font-medium">Iteration {iteration.number}</p>
                      <p className="mt-1 text-lunar-muted">
                        EMR {iteration.emr.transactionCount.toLocaleString("en-NG")}{" "}
                        · {formatMoney(iteration.emr.transactionAmount)} ·{" "}
                        {iteration.comparison?.status ?? "Not compared"} · Manager{" "}
                        {iteration.managerReview.status} · Finance{" "}
                        {iteration.financeReview.status}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(managerCanReview || financeCanReview) && (
              <form
                className="mt-6 space-y-4 border-t border-lunar-border pt-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveReview();
                }}
              >
                <label className="block text-sm font-medium">
                  Your review decision
                  <select
                    value={decision}
                    onChange={(event) =>
                      setDecision(
                        event.target.value as "Confirmed" | "Not Confirmed",
                      )
                    }
                    className={inputClass}
                  >
                    <option value="Confirmed">Confirmed</option>
                    <option value="Not Confirmed">Not Confirmed</option>
                  </select>
                </label>

                {managerCanReview && (
                  <label className="block text-sm font-medium">
                    Review comment
                    <textarea
                      rows={4}
                      value={managerComment}
                      onChange={(event) => setManagerComment(event.target.value)}
                      placeholder="Enter observations or explain the difference."
                      className={inputClass}
                    />
                  </label>
                )}

                {financeCanReview && (
                  <label className="block text-sm font-medium">
                    Finance resolution
                    <textarea
                      rows={4}
                      required={decision === "Not Confirmed"}
                      value={resolution}
                      onChange={(event) => setResolution(event.target.value)}
                      placeholder="Explain why the record is accepted or returned."
                      className={inputClass}
                    />
                  </label>
                )}

                <p className="text-xs text-lunar-muted">
                  A manager decision sends the record to finance. Finance Not
                  Confirmed returns it to the cashier and starts a new review.
                </p>

                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-lunar-primary px-4 py-2.5 text-sm text-white disabled:opacity-60"
                >
                  Save review
                </button>
              </form>
            )}

            {error && (
              <p
                role="alert"
                className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
