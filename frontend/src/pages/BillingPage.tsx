import { useEffect, useState } from "react";
import { CheckCircle2, Plus, Printer, Search, X } from "lucide-react";

import {
  apiRequest,
  type ApiBill,
  type ApiDepartment,
  type ApiPatient,
  type ApiServiceItem,
  type PaymentMethod,
} from "../api/client";
import { useApp } from "../hooks/useApp";
import { formatMoney } from "../utils/accounting";

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

interface NewPatientForm {
  name: string;
  phone: string;
  email: string;
}

function emptyPatientForm(): NewPatientForm {
  return { name: "", phone: "", email: "" };
}

export default function BillingPage() {
  const { currentUser } = useApp();
  const actor = currentUser;
  const isServiceStaff = actor?.role === "service_staff";

  const [bills, setBills] = useState<ApiBill[]>([]);
  const [departments, setDepartments] = useState<ApiDepartment[]>([]);
  const [services, setServices] = useState<ApiServiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // New-bill wizard state
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<ApiPatient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<ApiPatient | null>(null);
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [patientForm, setPatientForm] = useState<NewPatientForm>(emptyPatientForm());
  const [departmentId, setDepartmentId] = useState("");
  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [method, setMethod] = useState<PaymentMethod>("Transfer");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const facilityId = actor?.hospitalIds[0] ?? "";

  async function load(): Promise<void> {
    if (!actor) return;
    setLoading(true);

    try {
      const [billResult, departmentResult, serviceResult] = await Promise.all([
        apiRequest<{ bills: ApiBill[] }>("/api/bills"),
        facilityId
          ? apiRequest<{ departments: ApiDepartment[] }>(
              `/api/departments?facilityId=${encodeURIComponent(facilityId)}`,
            )
          : Promise.resolve({ departments: [] }),
        facilityId
          ? apiRequest<{ services: ApiServiceItem[] }>(
              `/api/services?facilityId=${encodeURIComponent(facilityId)}`,
            )
          : Promise.resolve({ services: [] }),
      ]);

      setBills(billResult.bills);
      setDepartments(departmentResult.departments.filter((d) => d.active));
      setServices(serviceResult.services.filter((s) => s.active));
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
        bill.patientName.toLowerCase().includes(search.trim().toLowerCase()) &&
        (!statusFilter || bill.status === statusFilter),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const effectiveDepartmentId = isServiceStaff
    ? actor.departmentId ?? ""
    : departmentId;

  const availableItems = services.filter(
    (item) => item.departmentId === effectiveDepartmentId,
  );

  const cartLines = Array.from(cart.entries())
    .map(([serviceItemId, quantity]) => {
      const item = services.find((s) => s.id === serviceItemId);
      return item ? { item, quantity } : null;
    })
    .filter((line): line is { item: ApiServiceItem; quantity: number } => !!line);

  const cartTotal = cartLines.reduce(
    (total, line) => total + line.item.price * line.quantity,
    0,
  );

  function upsertBill(bill: ApiBill): void {
    setBills((current) => {
      const without = current.filter((item) => item.id !== bill.id);
      return [bill, ...without];
    });
  }

  function openNewBill() {
    setSelectedId(null);
    setPatientSearch("");
    setPatientResults([]);
    setSelectedPatient(null);
    setShowPatientForm(false);
    setPatientForm(emptyPatientForm());
    setDepartmentId(isServiceStaff ? actor.departmentId ?? "" : "");
    setCart(new Map());
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

  async function searchPatient(): Promise<void> {
    setError("");

    if (!patientSearch.trim()) {
      return;
    }

    try {
      const result = await apiRequest<{ patients: ApiPatient[] }>(
        `/api/patients?search=${encodeURIComponent(patientSearch.trim())}`,
      );
      setPatientResults(result.patients);

      if (result.patients.length === 0) {
        setShowPatientForm(true);
        setPatientForm({ ...emptyPatientForm(), phone: patientSearch.trim() });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to search patients.");
    }
  }

  async function registerPatient(): Promise<void> {
    setError("");

    if (!patientForm.name.trim() || !patientForm.phone.trim() || !patientForm.email.trim()) {
      setError("Fill in the patient's name, phone, and email.");
      return;
    }

    setBusy(true);

    try {
      const patient = await apiRequest<ApiPatient>("/api/patients", {
        method: "POST",
        json: {
          name: patientForm.name.trim(),
          phone: patientForm.phone.trim(),
          email: patientForm.email.trim(),
        },
      });

      setSelectedPatient(patient);
      setShowPatientForm(false);
      setMessage(`Registered ${patient.name} (${patient.uniqueId}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to register patient.");
    } finally {
      setBusy(false);
    }
  }

  function setQuantity(serviceItemId: string, quantity: number): void {
    setCart((current) => {
      const next = new Map(current);

      if (quantity <= 0) {
        next.delete(serviceItemId);
      } else {
        next.set(serviceItemId, quantity);
      }

      return next;
    });
  }

  async function raiseBill(): Promise<void> {
    setError("");

    if (!selectedPatient) {
      setError("Search for or register a patient first.");
      return;
    }

    if (cartLines.length === 0) {
      setError("Add at least one item to the bill.");
      return;
    }

    setBusy(true);

    try {
      const bill = await apiRequest<ApiBill>("/api/bills", {
        method: "POST",
        json: {
          facilityId,
          patientId: selectedPatient.id,
          items: cartLines.map((line) => ({
            serviceItemId: line.item.id,
            quantity: line.quantity,
          })),
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
          ? "Virtual account generated. The patient has also been emailed."
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
      setMessage("Payment confirmed. Receipt emailed and ready to print.");
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
          <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
          <p className="mt-2 text-sm text-lunar-muted">
            Register patients, raise bills, collect payment, and print receipts.
          </p>
        </div>

        <button
          type="button"
          onClick={openNewBill}
          disabled={services.length === 0}
          className="flex items-center gap-2 rounded-xl bg-lunar-primary px-4 py-3 text-sm font-medium text-white shadow-raised hover:bg-lunar-primary-dark disabled:opacity-50"
        >
          <Plus size={18} />
          Raise bill
        </button>
      </div>

      {services.length === 0 && (
        <p className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
          No priced services have been set up yet. Ask an admin to register
          drugs and services before raising a bill.
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

      <section className="mt-6 overflow-hidden rounded-xl border border-lunar-border bg-white shadow-card">
        <div className="flex flex-wrap gap-3 border-b border-lunar-border p-4">
          <div className="relative min-w-48 flex-1">
            <Search size={17} className="absolute left-3 top-3 text-lunar-muted" />
            <input
              aria-label="Search patient name"
              placeholder="Search patient name"
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
                <th className="px-4 py-4">Patient</th>
                <th className="px-4 py-4">Department</th>
                <th className="px-4 py-4">Raised by</th>
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
                    <p className="font-medium">{bill.patientName}</p>
                    <p className="mt-1 text-xs text-lunar-muted">{bill.patientUniqueId}</p>
                  </td>
                  <td className="px-4 py-4">{bill.departmentName}</td>
                  <td className="px-4 py-4">
                    <p>{bill.raisedByName}</p>
                    <p className="mt-1 text-xs text-lunar-muted">
                      {bill.raisedByRole === "service_staff" ? "Service point" : "Cashier"}
                    </p>
                  </td>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="bill-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-raised"
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
              <div className="mt-6 space-y-5">
                {!selectedPatient ? (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium">
                      Find patient by phone, unique ID, or name
                      <div className="mt-2 flex gap-2">
                        <input
                          value={patientSearch}
                          onChange={(event) => setPatientSearch(event.target.value)}
                          placeholder="e.g. 08030000001 or PT-000001"
                          className="w-full rounded-lg border border-lunar-border px-3 py-2.5 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => void searchPatient()}
                          className="whitespace-nowrap rounded-lg border border-lunar-border px-4 py-2.5 text-sm font-medium"
                        >
                          Search
                        </button>
                      </div>
                    </label>

                    {patientResults.length > 0 && (
                      <div className="space-y-2">
                        {patientResults.map((patient) => (
                          <button
                            key={patient.id}
                            type="button"
                            onClick={() => setSelectedPatient(patient)}
                            className="w-full rounded-lg border border-lunar-border p-3 text-left text-sm hover:border-lunar-primary"
                          >
                            <p className="font-medium">{patient.name}</p>
                            <p className="mt-1 text-xs text-lunar-muted">
                              {patient.uniqueId} · {patient.phone}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}

                    {!showPatientForm && (
                      <button
                        type="button"
                        onClick={() => setShowPatientForm(true)}
                        className="text-sm font-medium text-lunar-primary"
                      >
                        Register a new patient
                      </button>
                    )}

                    {showPatientForm && (
                      <div className="space-y-3 rounded-lg border border-lunar-border p-4">
                        <label className="block text-sm">
                          Full name
                          <input
                            value={patientForm.name}
                            onChange={(event) =>
                              setPatientForm({ ...patientForm, name: event.target.value })
                            }
                            className={inputClass}
                          />
                        </label>
                        <label className="block text-sm">
                          Phone number
                          <input
                            value={patientForm.phone}
                            onChange={(event) =>
                              setPatientForm({ ...patientForm, phone: event.target.value })
                            }
                            className={inputClass}
                          />
                        </label>
                        <label className="block text-sm">
                          Email address
                          <input
                            type="email"
                            value={patientForm.email}
                            onChange={(event) =>
                              setPatientForm({ ...patientForm, email: event.target.value })
                            }
                            className={inputClass}
                          />
                        </label>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void registerPatient()}
                          className="rounded-lg bg-lunar-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                        >
                          Register patient
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between rounded-lg bg-lunar-background p-4">
                      <div>
                        <p className="font-medium">{selectedPatient.name}</p>
                        <p className="mt-1 text-xs text-lunar-muted">
                          {selectedPatient.uniqueId} · {selectedPatient.phone}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedPatient(null)}
                        className="text-xs font-medium text-lunar-primary"
                      >
                        Change
                      </button>
                    </div>

                    {!isServiceStaff && (
                      <label className="block text-sm font-medium">
                        Department
                        <select
                          value={departmentId}
                          onChange={(event) => {
                            setDepartmentId(event.target.value);
                            setCart(new Map());
                          }}
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

                    {effectiveDepartmentId && (
                      <div className="rounded-lg border border-lunar-border">
                        <h3 className="border-b border-lunar-border bg-lunar-background px-4 py-3 text-sm font-semibold">
                          Items
                        </h3>
                        <div className="divide-y divide-lunar-border">
                          {availableItems.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-3 px-4 py-3"
                            >
                              <div>
                                <p className="text-sm font-medium">{item.name}</p>
                                <p className="text-xs text-lunar-muted">
                                  {formatMoney(item.price)}
                                </p>
                              </div>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={cart.get(item.id) ?? 0}
                                onChange={(event) =>
                                  setQuantity(item.id, Number(event.target.value))
                                }
                                className="w-20 rounded-lg border border-lunar-border px-2 py-1.5 text-sm"
                              />
                            </div>
                          ))}

                          {availableItems.length === 0 && (
                            <p className="p-4 text-sm text-lunar-muted">
                              No priced items for this department yet.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {cartLines.length > 0 && (
                      <div className="rounded-lg bg-lunar-background p-4">
                        <p className="text-sm font-medium">Total: {formatMoney(cartTotal)}</p>
                      </div>
                    )}

                    {error && (
                      <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                        {error}
                      </p>
                    )}

                    <button
                      type="button"
                      disabled={busy || cartLines.length === 0}
                      onClick={() => void raiseBill()}
                      className="rounded-xl bg-lunar-primary px-4 py-3 text-sm font-medium text-white shadow-raised hover:bg-lunar-primary-dark disabled:opacity-60"
                    >
                      Raise bill
                    </button>
                  </>
                )}

                {error && !selectedPatient && (
                  <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </p>
                )}
              </div>
            )}

            {selectedBill && (
              <div className="mt-5 space-y-5">
                {selectedBill.status !== "Paid" && (
                  <div className="rounded-xl bg-lunar-background p-4">
                    <p className="font-medium">{selectedBill.patientName}</p>
                    <p className="mt-1 text-xs text-lunar-muted">
                      {selectedBill.patientUniqueId} · {selectedBill.departmentName}
                    </p>
                    <ul className="mt-3 space-y-1 text-sm text-lunar-muted">
                      {selectedBill.items.map((item) => (
                        <li key={item.serviceItemId} className="flex justify-between">
                          <span>
                            {item.name} x{item.quantity}
                          </span>
                          <span>{formatMoney(item.unitPrice * item.quantity)}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-2xl font-semibold tracking-tight">
                      {formatMoney(selectedBill.amount)}
                    </p>
                    <div className="mt-3">
                      <StatusBadge value={selectedBill.status} />
                    </div>
                  </div>
                )}

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
                      className="rounded-xl bg-lunar-primary px-4 py-3 text-sm font-medium text-white shadow-raised hover:bg-lunar-primary-dark disabled:opacity-60"
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
                      Generated by TAP for this bill, and emailed to the
                      patient. Once the transfer reflects, confirm it below
                      to print the receipt.
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void confirmPayment()}
                      className="rounded-xl bg-lunar-primary px-4 py-3 text-sm font-medium text-white shadow-raised hover:bg-lunar-primary-dark disabled:opacity-60"
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
                      className="rounded-xl bg-lunar-primary px-4 py-3 text-sm font-medium text-white shadow-raised hover:bg-lunar-primary-dark disabled:opacity-60"
                    >
                      Confirm money collected
                    </button>
                  </div>
                )}

                {selectedBill.status === "Paid" && (
                  <div
                    id="receipt"
                    className="overflow-hidden rounded-2xl border border-lunar-border shadow-card"
                  >
                    <div className="bg-gradient-to-br from-lunar-sidebar to-lunar-sidebar-light px-6 py-5 text-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-widest text-white/50">
                            {selectedBill.facilityName}
                          </p>
                          <p className="mt-1 text-lg font-semibold">
                            {selectedBill.departmentName}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                          <CheckCircle2 size={14} />
                          Paid
                        </div>
                      </div>
                    </div>

                    <div className="space-y-5 bg-white p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold">{selectedBill.patientName}</p>
                          <p className="mt-1 text-xs text-lunar-muted">
                            {selectedBill.patientUniqueId}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-lunar-muted">Receipt No.</p>
                          <p className="font-mono text-sm font-semibold">
                            {selectedBill.receiptNumber}
                          </p>
                        </div>
                      </div>

                      <ul className="divide-y divide-dashed divide-lunar-border text-sm">
                        {selectedBill.items.map((item) => (
                          <li
                            key={item.serviceItemId}
                            className="flex justify-between py-2.5"
                          >
                            <span className="text-lunar-muted">
                              {item.name}{" "}
                              <span className="text-lunar-muted/70">
                                &times;{item.quantity}
                              </span>
                            </span>
                            <span className="font-medium">
                              {formatMoney(item.unitPrice * item.quantity)}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <div className="flex items-center justify-between rounded-xl bg-lunar-background px-4 py-3">
                        <span className="text-sm font-medium">Total paid</span>
                        <span className="text-xl font-bold tracking-tight">
                          {formatMoney(selectedBill.amount)}
                        </span>
                      </div>

                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <dt className="text-lunar-muted">Method</dt>
                        <dd className="text-right font-medium">
                          {selectedBill.paymentMethod}
                        </dd>
                        <dt className="text-lunar-muted">Paid at</dt>
                        <dd className="text-right font-medium">
                          {selectedBill.paidAt
                            ? new Date(selectedBill.paidAt).toLocaleString("en-NG", {
                                timeZone: "Africa/Lagos",
                                dateStyle: "medium",
                                timeStyle: "short",
                              })
                            : "—"}
                        </dd>
                        <dt className="text-lunar-muted">Cleared by</dt>
                        <dd className="text-right font-medium">
                          {selectedBill.confirmedByName ?? "—"}
                        </dd>
                      </dl>

                      {selectedBill.qrDataUrl && (
                        <div className="flex flex-col items-center gap-2 border-t border-dashed border-lunar-border pt-5">
                          <img
                            src={selectedBill.qrDataUrl}
                            alt="Receipt verification QR code"
                            width={140}
                            height={140}
                            className="rounded-lg border border-lunar-border p-2"
                          />
                          <p className="text-center text-xs text-lunar-muted">
                            Scan to verify this receipt. Also emailed to the patient.
                          </p>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-lunar-primary px-4 py-3 text-sm font-medium text-white shadow-raised hover:bg-lunar-primary-dark print:hidden"
                      >
                        <Printer size={16} />
                        Print receipt
                      </button>
                    </div>
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
    </div>
  );
}
