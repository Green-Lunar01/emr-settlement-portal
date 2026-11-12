import { useEffect, useState } from "react";
import { Plus, Printer, Search, X } from "lucide-react";

import {
  apiRequest,
  type ApiBill,
  type ApiDepartment,
  type PaymentMethod,
} from "../api/client";
import { useApp } from "../hooks/useApp";
import { formatMoney } from "../utils/accounting";

interface BillForm {
  facilityId: string;
  departmentId: string;
  payerName: string;
  description: string;
  amount: string;
}

function emptyForm(facilityId: string): BillForm {
  return { facilityId, departmentId: "", payerName: "", description: "", amount: "" };
}

function StatusBadge({ value }: { value: string }) {
  const colour =
    value === "Paid"
      ? "bg-emerald-50 text-emerald-700"
      : value === "Draft"
        ? "bg-slate-100 text-slate-600"
        : "bg-amber-50 text-amber-700";

  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs ${colour}`}>
      {value}
    </span>
  );
}

export default function BillingPage() {
  const { data, currentUser } = useApp();
  const actor = currentUser;

  const [bills, setBills] = useState<ApiBill[]>([]);
  const [departments, setDepartments] = useState<ApiDepartment[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<BillForm>(emptyForm(""));
  const [method, setMethod] = useState<PaymentMethod>("Transfer");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const facilityId = actor?.hospitalIds[0] ?? "";

  async function load(): Promise<void> {
    if (!actor) return;
    setLoading(true);

    try {
      const [billResult, departmentResult] = await Promise.all([
        apiRequest<{ bills: ApiBill[] }>("/api/bills"),
        facilityId
          ? apiRequest<{ departments: ApiDepartment[] }>(
              `/api/departments?facilityId=${encodeURIComponent(facilityId)}`,
            )
          : Promise.resolve({ departments: [] }),
      ]);

      setBills(billResult.bills);
      setDepartments(departmentResult.departments.filter((d) => d.active));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load bills.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor?.id]);

  if (!actor) return null;

  const selectedBill = bills.find((bill) => bill.id === selectedId) ?? null;

  const records = bills
    .filter(
      (bill) =>
        bill.payerName.toLowerCase().includes(search.trim().toLowerCase()) &&
        (!statusFilter || bill.status === statusFilter),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function upsertBill(bill: ApiBill): void {
    setBills((current) => {
      const without = current.filter((item) => item.id !== bill.id);
      return [bill, ...without];
    });
  }

  function openNewBill() {
    setSelectedId(null);
    setForm(emptyForm(facilityId));
    setMethod("Transfer");
    setError("");
    setMessage("");
    setModalOpen(true);
  }

  function openBill(bill: ApiBill) {
    setSelectedId(bill.id);
    setMethod(bill.paymentMethod ?? "Transfer");
    setError("");
    setMessage("");
    setModalOpen(true);
  }

  async function raiseBill(): Promise<void> {
    setError("");
    const amount = Number(form.amount);

    if (
      !form.departmentId ||
      !form.payerName.trim() ||
      !form.description.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setError("Fill in all fields with a valid amount.");
      return;
    }

    setBusy(true);

    try {
      const bill = await apiRequest<ApiBill>("/api/bills", {
        method: "POST",
        json: {
          facilityId: form.facilityId,
          departmentId: form.departmentId,
          payerName: form.payerName.trim(),
          description: form.description.trim(),
          amount,
        },
      });

      upsertBill(bill);
      setSelectedId(bill.id);
      setMessage("Bill raised. Choose how the payer will pay.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to raise the bill.");
    } finally {
      setBusy(false);
    }
  }

  async function choosePaymentMethod(): Promise<void> {
    if (!selectedBill) return;
    setError("");
    setBusy(true);

    try {
      const bill = await apiRequest<ApiBill>(
        `/api/bills/${selectedBill.id}/payment-method`,
        { method: "POST", json: { method } },
      );

      upsertBill(bill);
      setMessage(
        method === "Transfer"
          ? "Virtual account generated. Share it with the payer."
          : "Awaiting confirmation that money has been collected.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to select payment method.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmPayment(): Promise<void> {
    if (!selectedBill) return;
    setError("");
    setBusy(true);

    try {
      const bill = await apiRequest<ApiBill>(
        `/api/bills/${selectedBill.id}/confirm-payment`,
        { method: "POST", json: {} },
      );

      upsertBill(bill);
      setMessage("Payment confirmed. Receipt is ready to print.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to confirm payment.",
      );
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "mt-2 w-full rounded-lg border border-lunar-border bg-white px-3 py-2.5 text-sm disabled:bg-slate-50";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Billing</h1>
          <p className="mt-2 text-sm text-lunar-muted">
            Raise bills, collect payment, and print receipts.
          </p>
        </div>

        <button
          type="button"
          onClick={openNewBill}
          disabled={departments.length === 0}
          className="flex items-center gap-2 rounded-lg bg-lunar-primary px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          <Plus size={18} />
          Raise bill
        </button>
      </div>

      {departments.length === 0 && (
        <p className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
          No departments have been set up yet. Ask Front Office to add one
          before raising a bill.
        </p>
      )}

      {message && (
        <p role="status" className="mt-5 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
          {message}
        </p>
      )}

      {error && !modalOpen && (
        <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="mt-6 overflow-hidden rounded-xl border border-lunar-border bg-white">
        <div className="flex flex-wrap gap-3 border-b border-lunar-border p-4">
          <div className="relative min-w-48 flex-1">
            <Search size={17} className="absolute left-3 top-3 text-lunar-muted" />
            <input
              aria-label="Search payer name"
              placeholder="Search payer name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-lg border border-lunar-border py-2.5 pl-10 pr-3 text-sm"
            />
          </div>

          <select
            aria-label="Filter bill status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-lunar-border px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="Draft">Draft</option>
            <option value="Awaiting Transfer">Awaiting Transfer</option>
            <option value="Awaiting Confirmation">Awaiting Confirmation</option>
            <option value="Paid">Paid</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="bg-lunar-background text-xs text-lunar-muted">
              <tr>
                <th className="px-4 py-4">Payer</th>
                <th className="px-4 py-4">Department</th>
                <th className="px-4 py-4">Amount</th>
                <th className="px-4 py-4">Method</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Receipt</th>
                <th className="px-4 py-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {records.map((bill) => (
                <tr key={bill.id} className="border-t border-lunar-border">
                  <td className="px-4 py-4">
                    <p className="font-medium">{bill.payerName}</p>
                    <p className="mt-1 text-xs text-lunar-muted">{bill.description}</p>
                  </td>
                  <td className="px-4 py-4">{bill.departmentName}</td>
                  <td className="px-4 py-4 font-medium">{formatMoney(bill.amount)}</td>
                  <td className="px-4 py-4">{bill.paymentMethod ?? "—"}</td>
                  <td className="px-4 py-4">
                    <StatusBadge value={bill.status} />
                  </td>
                  <td className="px-4 py-4">{bill.receiptNumber ?? "—"}</td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => openBill(bill)}
                      className="font-medium text-lunar-primary"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && records.length === 0 && (
            <p className="p-8 text-center text-sm text-lunar-muted">
              No bills match your filters.
            </p>
          )}
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="bill-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 id="bill-title" className="text-xl font-semibold">
                {selectedBill ? "Bill" : "Raise a bill"}
              </h2>
              <button type="button" aria-label="Close" onClick={() => setModalOpen(false)}>
                <X size={21} />
              </button>
            </div>

            {!selectedBill && (
              <form
                className="mt-6 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void raiseBill();
                }}
              >
                <label className="block text-sm font-medium">
                  Department
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

                <label className="block text-sm font-medium">
                  Payer name
                  <input
                    required
                    value={form.payerName}
                    onChange={(event) => setForm({ ...form, payerName: event.target.value })}
                    className={inputClass}
                  />
                </label>

                <label className="block text-sm font-medium">
                  Description
                  <input
                    required
                    value={form.description}
                    onChange={(event) =>
                      setForm({ ...form, description: event.target.value })
                    }
                    placeholder="e.g. Consultation fee"
                    className={inputClass}
                  />
                </label>

                <label className="block text-sm font-medium">
                  Amount (₦)
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={(event) => setForm({ ...form, amount: event.target.value })}
                    className={inputClass}
                  />
                </label>

                {error && (
                  <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-lunar-primary px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  Raise bill
                </button>
              </form>
            )}

            {selectedBill && (
              <div className="mt-5 space-y-5">
                <div className="rounded-lg bg-lunar-background p-4">
                  <p className="font-medium">{selectedBill.payerName}</p>
                  <p className="mt-1 text-sm text-lunar-muted">
                    {selectedBill.description} · {selectedBill.departmentName}
                  </p>
                  <p className="mt-3 text-2xl font-semibold">
                    {formatMoney(selectedBill.amount)}
                  </p>
                  <div className="mt-3">
                    <StatusBadge value={selectedBill.status} />
                  </div>
                </div>

                {selectedBill.status === "Draft" && (
                  <div className="space-y-4">
                    <p className="text-sm font-medium">How will the payer pay?</p>
                    <div className="flex gap-3">
                      {(["Transfer", "POS", "Cash"] as PaymentMethod[]).map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setMethod(option)}
                          className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium ${
                            method === option
                              ? "border-lunar-primary bg-lunar-primary/10 text-lunar-primary"
                              : "border-lunar-border"
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void choosePaymentMethod()}
                      className="rounded-lg bg-lunar-primary px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                    >
                      Continue
                    </button>
                  </div>
                )}

                {selectedBill.status === "Awaiting Transfer" && selectedBill.transfer && (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-lunar-border p-4">
                      <p className="text-sm font-medium">Pay to this account</p>
                      <p className="mt-3 text-lg font-semibold tracking-wide">
                        {selectedBill.transfer.accountNumber}
                      </p>
                      <p className="mt-1 text-sm text-lunar-muted">
                        {selectedBill.transfer.bankName}
                      </p>
                      <p className="mt-3 text-xs text-lunar-muted">
                        Reference: {selectedBill.transfer.reference}
                      </p>
                    </div>
                    <p className="text-xs text-lunar-muted">
                      Generated by TAP for this bill. Once the transfer
                      reflects, confirm it below to print the receipt.
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void confirmPayment()}
                      className="rounded-lg bg-lunar-primary px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                    >
                      Confirm transfer received
                    </button>
                  </div>
                )}

                {selectedBill.status === "Awaiting Confirmation" && (
                  <div className="space-y-4">
                    <p className="text-sm text-lunar-muted">
                      Confirm that {selectedBill.paymentMethod?.toLowerCase()} payment
                      has been collected before printing the receipt.
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void confirmPayment()}
                      className="rounded-lg bg-lunar-primary px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                    >
                      Confirm money collected
                    </button>
                  </div>
                )}

                {selectedBill.status === "Paid" && (
                  <div className="space-y-4 rounded-lg border border-lunar-border p-5">
                    <p className="text-sm font-medium">Receipt</p>
                    <p className="text-lg font-semibold">{selectedBill.receiptNumber}</p>
                    <dl className="space-y-1 text-sm text-lunar-muted">
                      <div className="flex justify-between">
                        <dt>Payer</dt>
                        <dd>{selectedBill.payerName}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Amount</dt>
                        <dd>{formatMoney(selectedBill.amount)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Method</dt>
                        <dd>{selectedBill.paymentMethod}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Paid at</dt>
                        <dd>
                          {selectedBill.paidAt
                            ? new Date(selectedBill.paidAt).toLocaleString("en-NG", {
                                timeZone: "Africa/Lagos",
                              })
                            : "—"}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Collected by</dt>
                        <dd>{selectedBill.confirmedByName ?? "—"}</dd>
                      </div>
                    </dl>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="flex items-center gap-2 rounded-lg bg-lunar-primary px-4 py-2.5 text-sm font-medium text-white"
                    >
                      <Printer size={16} />
                      Print receipt
                    </button>
                  </div>
                )}

                {error && (
                  <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {data.hospitals.length === 0 && null}
    </div>
  );
}
