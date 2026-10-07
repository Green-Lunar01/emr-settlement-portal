import { useState } from "react";
import { Plus, Search, X } from "lucide-react";

import { useApp } from "../hooks/useApp";
import type { EmrRecord, Review, ReviewStatus } from "../types";

import {
  canCashierEditEmr,
  compareEmrRecord,
  formatMoney,
  getToday,
} from "../utils/accounting";

import {
  canAccessEmr,
  reviewEmrRecord,
  saveEmrResolution,
  submitEmrRecord,
} from "../utils/emr";

interface EmrForm {
  date: string;
  emrTransactions: string;
  emrAmount: string;
  tapTransactions: string;
  tapAmount: string;
}

function emptyForm(): EmrForm {
  return {
    date: getToday(),
    emrTransactions: "",
    emrAmount: "",
    tapTransactions: "",
    tapAmount: "",
  };
}

function StatusBadge({ value }: { value: string }) {
  const colour =
    ["Good", "Confirmed"].includes(value)
      ? "bg-emerald-50 text-emerald-700"
      : ["Check Record", "Not Confirmed"].includes(value)
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

export default function EmrPage() {
  const { data, currentUser, updateData } = useApp();

  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<EmrForm>(emptyForm);

  const [decision, setDecision] =
    useState<Exclude<ReviewStatus, "Pending">>("Confirmed");

  const [managerComment, setManagerComment] = useState("");
  const [resolution, setResolution] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  if (!currentUser) return null;

  const actor = currentUser;
  const isCashier = actor.role === "cashier";
  const isFinance = actor.role === "finance";
  const isManager = actor.role === "facility_manager";

  const selectedRecord = data.emrRecords.find(
    (record) => record.id === selectedId,
  );

  const mayEditFigures =
    isCashier &&
    (!selectedRecord || canCashierEditEmr(selectedRecord));

  function userName(id: string | null): string {
    return id
      ? data.users.find((user) => user.id === id)?.name ??
          "Unknown user"
      : "—";
  }

  function hospitalName(id: string): string {
    return (
      data.hospitals.find((hospital) => hospital.id === id)?.name ??
      "Unknown hospital"
    );
  }

  function reviewDetails(review: Review): string {
    return review.reviewedAt
      ? `${userName(review.reviewedBy)} · ${new Date(
          review.reviewedAt,
        ).toLocaleString("en-NG", {
          timeZone: "Africa/Lagos",
        })}`
      : "Awaiting review";
  }

  const records = data.emrRecords
    .filter((record) => canAccessEmr(actor, record, data))
    .filter((record) => {
      const remark = compareEmrRecord(record).tallies
        ? "Good"
        : "Check Record";

      return (
        userName(record.cashierId)
          .toLowerCase()
          .includes(search.trim().toLowerCase()) &&
        (!dateFilter || record.date === dateFilter) &&
        (!statusFilter || remark === statusFilter)
      );
    })
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        b.createdAt.localeCompare(a.createdAt),
    );

  const countsValid = [
    form.emrTransactions,
    form.tapTransactions,
  ].every(
    (value) =>
      value.trim() !== "" &&
      Number.isSafeInteger(Number(value)) &&
      Number(value) >= 0,
  );

  const amountsValid = [form.emrAmount, form.tapAmount].every(
    (value) =>
      value.trim() !== "" &&
      Number.isFinite(Number(value)) &&
      Number(value) >= 0 &&
      Math.abs(
        Number(value) * 100 - Math.round(Number(value) * 100),
      ) < 0.000001,
  );

  const enteredValuesValid = countsValid && amountsValid;

  const automaticRemark = !enteredValuesValid
    ? null
    : Number(form.emrTransactions) === Number(form.tapTransactions) &&
        Math.round(Number(form.emrAmount) * 100) ===
          Math.round(Number(form.tapAmount) * 100)
      ? "Good"
      : "Check Record";

  function openNewRecord() {
    setSelectedId(null);
    setForm(emptyForm());
    setManagerComment("");
    setResolution("");
    setError("");
    setMessage("");
    setModalOpen(true);
  }

  function openRecord(record: EmrRecord) {
    setSelectedId(record.id);

    setForm({
      date: record.date,
      emrTransactions: String(record.emr.numberOfTransactions),
      emrAmount: String(record.emr.amountForDay),
      tapTransactions: String(record.tap.numberOfTransactions),
      tapAmount: String(record.tap.amountForDay),
    });

    const previousStatus = isFinance
      ? record.financeReview.status
      : record.facilityManagerReview.status;

    setDecision(
      previousStatus === "Pending"
        ? compareEmrRecord(record).tallies
          ? "Confirmed"
          : "Not Confirmed"
        : previousStatus,
    );

    setManagerComment(record.facilityManagerReview.comment ?? "");
    setResolution(record.resolution);
    setError("");
    setMessage("");
    setModalOpen(true);
  }

  function submitFigures() {
    setError("");

    if (!enteredValuesValid) {
      setError("Enter valid counts and amounts in all four fields.");
      return;
    }

    try {
      updateData((current) =>
        submitEmrRecord(
          current,
          actor,
          {
            date: form.date,
            emrTransactions: Number(form.emrTransactions),
            emrAmount: Number(form.emrAmount),
            tapTransactions: Number(form.tapTransactions),
            tapAmount: Number(form.tapAmount),
          },
          selectedId ?? undefined,
        ),
      );

      setModalOpen(false);
      setMessage("EMR record submitted for review.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to submit.",
      );
    }
  }

  function saveReview() {
    if (!selectedRecord) return;
    setError("");

    try {
      updateData((current) =>
        reviewEmrRecord(
          current,
          actor,
          selectedRecord.id,
          decision,
          isManager ? managerComment : "",
        ),
      );

      setModalOpen(false);
      setMessage(`Review saved: ${decision}.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save review.",
      );
    }
  }

  function saveResolution() {
    if (!selectedRecord) return;
    setError("");

    try {
      updateData((current) =>
        saveEmrResolution(
          current,
          actor,
          selectedRecord.id,
          resolution,
        ),
      );

      setModalOpen(false);
      setMessage("Resolution saved.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save resolution.",
      );
    }
  }

  const inputClass =
    "mt-2 w-full rounded-lg border border-lunar-border bg-white px-3 py-2.5 text-sm disabled:bg-slate-50 disabled:text-slate-600";

  function valuesTable(
    title: string,
    countKey: "emrTransactions" | "tapTransactions",
    amountKey: "emrAmount" | "tapAmount",
  ) {
    return (
      <section className="overflow-hidden rounded-lg border border-lunar-border">
        <h3 className="bg-lunar-background px-4 py-3 font-semibold">
          {title}
        </h3>

        <div className="overflow-x-auto p-4">
          <table className="w-full table-fixed">
            <thead>
              <tr>
                <th className="pr-2 text-left text-xs font-medium">
                  Number of Transactions
                </th>
                <th className="pl-2 text-left text-xs font-medium">
                  Amount for the Day (₦)
                </th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td className="pr-2">
                  <input
                    aria-label={`${title} transaction count`}
                    type="number"
                    required
                    min="0"
                    step="1"
                    value={form[countKey]}
                    disabled={!mayEditFigures}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        [countKey]: event.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </td>

                <td className="pl-2">
                  <input
                    aria-label={`${title} amount for the day`}
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={form[amountKey]}
                    disabled={!mayEditFigures}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        [amountKey]: event.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">EMR Accounting</h1>
          <p className="mt-2 text-sm text-lunar-muted">
            Compare EMR and TAP figures, then review the record.
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
                <tr
                  key={record.id}
                  className="border-t border-lunar-border"
                >
                  <td className="px-4 py-4">
                    <p className="font-medium">
                      {userName(record.cashierId)}
                    </p>
                    <p className="mt-1 text-xs text-lunar-muted">
                      {record.date}
                    </p>
                    <p className="mt-1 text-xs text-lunar-muted">
                      {hospitalName(record.hospitalId)}
                    </p>
                  </td>

                  <td className="px-4 py-4">
                    {record.emr.numberOfTransactions}
                  </td>
                  <td className="px-4 py-4">
                    {formatMoney(record.emr.amountForDay)}
                  </td>
                  <td className="px-4 py-4">
                    {record.tap.numberOfTransactions}
                  </td>
                  <td className="px-4 py-4">
                    {formatMoney(record.tap.amountForDay)}
                  </td>

                  <td className="px-4 py-4">
                    <StatusBadge
                      value={
                        compareEmrRecord(record).tallies
                          ? "Good"
                          : "Check Record"
                      }
                    />
                  </td>

                  <td className="px-4 py-4">
                    <StatusBadge
                      value={record.facilityManagerReview.status}
                    />
                  </td>

                  <td className="min-w-48 max-w-72 whitespace-pre-wrap break-words px-4 py-4 text-xs">
                    {record.facilityManagerReview.comment || "—"}
                  </td>

                  <td className="px-4 py-4">
                    <StatusBadge value={record.financeReview.status} />
                  </td>

                  {isFinance && (
                    <td className="min-w-48 max-w-72 whitespace-pre-wrap break-words px-4 py-4 text-xs">
                      {record.resolution || "—"}
                    </td>
                  )}

                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => openRecord(record)}
                      className="font-medium text-lunar-primary"
                    >
                      {isCashier
                        ? canCashierEditEmr(record)
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
                {userName(selectedRecord.cashierId)} ·{" "}
                {hospitalName(selectedRecord.hospitalId)}
              </p>
            )}

            <form
              className="mt-6 space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (mayEditFigures) submitFigures();
              }}
            >
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

              <div className="grid gap-4 md:grid-cols-2">
                {valuesTable("EMR", "emrTransactions", "emrAmount")}
                {valuesTable("TAP", "tapTransactions", "tapAmount")}
              </div>

              <div className="rounded-lg bg-lunar-background p-4">
                <p className="mb-2 text-sm font-medium">
                  Automatic remark
                </p>

                {automaticRemark ? (
                  <StatusBadge value={automaticRemark} />
                ) : (
                  <p className="text-sm text-lunar-muted">
                    Enter valid figures in all four fields.
                  </p>
                )}

                <p className="mt-3 text-xs text-lunar-muted">
                  Calculated by the system; not selected by the cashier.
                </p>
              </div>

              {isCashier && selectedRecord && !mayEditFigures && (
                <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  This record is locked. A Not Confirmed decision
                  reopens it for correction.
                </p>
              )}

              {mayEditFigures && (
                <button
                  type="submit"
                  className="rounded-lg bg-lunar-primary px-4 py-3 text-sm font-medium text-white"
                >
                  {selectedRecord
                    ? "Resubmit corrected record"
                    : "Submit record"}
                </button>
              )}
            </form>

            {selectedRecord && (
              <section className="mt-6 grid gap-4 border-t border-lunar-border pt-5 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-medium">
                    Facility Manager review
                  </p>
                  <StatusBadge
                    value={selectedRecord.facilityManagerReview.status}
                  />
                  <p className="mt-2 text-xs text-lunar-muted">
                    {reviewDetails(selectedRecord.facilityManagerReview)}
                  </p>

                  {selectedRecord.facilityManagerReview.comment && (
                    <p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-lunar-background p-3 text-sm">
                      <strong>Manager comment: </strong>
                      {selectedRecord.facilityManagerReview.comment}
                    </p>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium">
                    Finance review
                  </p>
                  <StatusBadge value={selectedRecord.financeReview.status} />
                  <p className="mt-2 text-xs text-lunar-muted">
                    {reviewDetails(selectedRecord.financeReview)}
                  </p>
                </div>
              </section>
            )}

            {!isCashier && selectedRecord && (
              <form
                className="mt-6 space-y-4 border-t border-lunar-border pt-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  saveReview();
                }}
              >
                <label className="block text-sm font-medium">
                  Your review decision
                  <select
                    value={decision}
                    onChange={(event) =>
                      setDecision(
                        event.target.value as Exclude<
                          ReviewStatus,
                          "Pending"
                        >,
                      )
                    }
                    className={inputClass}
                  >
                    <option value="Confirmed">Confirmed</option>
                    <option value="Not Confirmed">Not Confirmed</option>
                  </select>
                </label>

                {isManager && (
                  <label className="block text-sm font-medium">
                    Review comment
                    <textarea
                      rows={4}
                      value={managerComment}
                      onChange={(event) =>
                        setManagerComment(event.target.value)
                      }
                      placeholder="Enter observations or explain what needs to be checked."
                      className={inputClass}
                    />
                  </label>
                )}

                <p className="text-xs text-lunar-muted">
                  Not Confirmed returns the record for correction.
                  Finance confirmation requires Manager confirmation.
                </p>

                <button
                  type="submit"
                  className="rounded-lg bg-lunar-primary px-4 py-2.5 text-sm text-white"
                >
                  Save review
                </button>
              </form>
            )}

            {isFinance && selectedRecord && (
              <form
                className="mt-6 space-y-4 border-t border-lunar-border pt-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  saveResolution();
                }}
              >
                <label className="block text-sm font-medium">
                  Resolution
                  <textarea
                    required
                    rows={4}
                    value={resolution}
                    onChange={(event) => setResolution(event.target.value)}
                    placeholder="Explain how the inconsistency was resolved."
                    className={inputClass}
                  />
                </label>

                {selectedRecord.resolutionAt && (
                  <p className="text-xs text-lunar-muted">
                    Last saved by {userName(selectedRecord.resolutionBy)} ·{" "}
                    {new Date(selectedRecord.resolutionAt).toLocaleString(
                      "en-NG",
                      { timeZone: "Africa/Lagos" },
                    )}
                  </p>
                )}

                <button
                  type="submit"
                  className="rounded-lg border border-lunar-primary px-4 py-2.5 text-sm font-medium text-lunar-primary"
                >
                  Save resolution
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