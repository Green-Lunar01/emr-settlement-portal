import { useEffect, useState } from "react";
import { Plus, Search, X } from "lucide-react";

import { apiRequest, type ApiDailyAccount, type WalletReviewStatus } from "../api/client";
import { useApp } from "../hooks/useApp";
import { formatMoney, roundMoney } from "../utils/accounting";

interface AccountForm {
  bankTransfers: string;
  cashCollected: string;
  cardPayments: string;
  actualClosingBalance: string;
}

function emptyForm(): AccountForm {
  return {
    bankTransfers: "",
    cashCollected: "",
    cardPayments: "",
    actualClosingBalance: "",
  };
}

function Badge({ value }: { value: string }) {
  const colour = ["Good", "Okay", "Received"].includes(value)
    ? "bg-emerald-50 text-emerald-700"
    : value === "Check Record"
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

export default function DailyAccountsPage() {
  const { currentUser } = useApp();

  const [accounts, setAccounts] = useState<ApiDailyAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<AccountForm>(emptyForm);

  const [decision, setDecision] = useState<Exclude<WalletReviewStatus, "Pending">>(
    "Okay",
  );

  const [managerComment, setManagerComment] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const actor = currentUser;
  const isCashier = actor?.role === "cashier";
  const isFinance = actor?.role === "finance";
  const isManager = actor?.role === "facility_manager";

  async function load(): Promise<void> {
    if (!actor) return;
    setLoading(true);

    try {
      const result = await apiRequest<{ dailyAccounts: ApiDailyAccount[] }>(
        "/api/daily-accounts",
      );
      setAccounts(result.dailyAccounts);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load daily accounts.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor?.id]);

  if (!actor) return null;

  const selectedAccount = accounts.find((account) => account.id === selectedId);
  const canEdit = selectedAccount ? selectedAccount.editable : isCashier;

  function reviewTime(value: string | null): string {
    return value
      ? new Date(value).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })
      : "Awaiting review";
  }

  const records = accounts
    .filter(
      (account) =>
        account.cashierName
          .toLowerCase()
          .includes(search.trim().toLowerCase()) &&
        (!dateFilter || account.date === dateFilter),
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  const validFigures = Object.values(form).every(
    (value) =>
      value.trim() !== "" &&
      Number.isFinite(Number(value)) &&
      Number(value) >= 0 &&
      Math.abs(Number(value) * 100 - Math.round(Number(value) * 100)) < 0.000001,
  );

  const previewSpent = validFigures
    ? roundMoney(
        Number(form.bankTransfers) +
          Number(form.cashCollected) +
          Number(form.cardPayments),
      )
    : null;

  const previewClosing =
    selectedAccount && previewSpent !== null
      ? roundMoney(selectedAccount.summary.totalAvailable - previewSpent)
      : null;

  const previewVariance =
    previewClosing !== null && form.actualClosingBalance.trim() !== ""
      ? roundMoney(Number(form.actualClosingBalance) - previewClosing)
      : null;

  async function openToday(): Promise<void> {
    setError("");
    setMessage("");

    try {
      const account = await apiRequest<ApiDailyAccount>(
        "/api/daily-accounts/today",
      );
      upsertAccount(account);
      openAccount(account);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to open today's account.",
      );
    }
  }

  function upsertAccount(account: ApiDailyAccount): void {
    setAccounts((current) => {
      const without = current.filter((item) => item.id !== account.id);
      return [account, ...without].sort((a, b) => b.date.localeCompare(a.date));
    });
  }

  function openAccount(account: ApiDailyAccount) {
    setSelectedId(account.id);

    setForm({
      bankTransfers: String(account.summary.bankTransfers),
      cashCollected: String(account.summary.cashCollected),
      cardPayments: String(account.summary.cardPayments),
      actualClosingBalance:
        account.summary.actualClosingBalance === null
          ? ""
          : String(account.summary.actualClosingBalance),
    });

    const existingStatus = isFinance
      ? account.financeReview.status
      : account.managerReview.status;

    setDecision(
      existingStatus === "Pending"
        ? account.summary.tallies === true
          ? "Okay"
          : "Check Record"
        : existingStatus,
    );

    setManagerComment(account.managerReview.comment ?? "");
    setError("");
    setMessage("");
    setModalOpen(true);
  }

  async function submitFigures(): Promise<void> {
    if (!selectedAccount) return;
    setError("");

    if (!validFigures) {
      setError("Enter valid amounts in all four fields.");
      return;
    }

    setBusy(true);

    try {
      const updated = await apiRequest<ApiDailyAccount>(
        `/api/daily-accounts/${selectedAccount.id}`,
        {
          method: "PATCH",
          json: {
            bankTransfers: Number(form.bankTransfers),
            cashCollected: Number(form.cashCollected),
            cardPayments: Number(form.cardPayments),
            actualClosingBalance: Number(form.actualClosingBalance),
          },
        },
      );

      upsertAccount(updated);
      setModalOpen(false);
      setMessage("Daily account submitted for review.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit.");
    } finally {
      setBusy(false);
    }
  }

  async function saveReview(): Promise<void> {
    if (!selectedAccount) return;
    setError("");
    setBusy(true);

    try {
      const updated = await apiRequest<ApiDailyAccount>(
        `/api/daily-accounts/${selectedAccount.id}/review`,
        {
          method: "POST",
          json: {
            status: decision,
            comment: isManager ? managerComment : undefined,
          },
        },
      );

      upsertAccount(updated);
      setModalOpen(false);
      setMessage(`Review saved: ${decision}.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save review.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function receiveCash(): Promise<void> {
    if (!selectedAccount) return;
    setError("");
    setBusy(true);

    try {
      const updated = await apiRequest<ApiDailyAccount>(
        `/api/daily-accounts/${selectedAccount.id}/cash-receipt`,
        { method: "POST" },
      );

      upsertAccount(updated);
      setModalOpen(false);
      setMessage("Cash receipt confirmed by Finance.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to confirm cash receipt.",
      );
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "mt-2 w-full rounded-lg border border-lunar-border bg-white px-3 py-3 text-sm disabled:bg-slate-50";

  function amountField(label: string, key: keyof AccountForm) {
    return (
      <label className="block text-sm font-medium">
        {label}
        <input
          required
          type="number"
          min="0"
          step="0.01"
          value={form[key]}
          disabled={!canEdit}
          onChange={(event) => setForm({ ...form, [key]: event.target.value })}
          className={inputClass}
        />
      </label>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Daily Wallet Accounts</h1>
          <p className="mt-2 text-sm text-lunar-muted">
            Account for collections and compare expected and actual balances.
          </p>
        </div>

        {isCashier && (
          <button
            type="button"
            onClick={() => void openToday()}
            className="flex items-center gap-2 rounded-lg bg-lunar-primary px-4 py-3 text-sm font-medium text-white"
          >
            <Plus size={18} />
            Today's account
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

      <section className="mt-6 overflow-hidden rounded-xl border border-lunar-border bg-white">
        <div className="flex flex-wrap gap-3 border-b border-lunar-border p-4">
          <div className="relative min-w-48 flex-1">
            <Search size={17} className="absolute left-3 top-3 text-lunar-muted" />
            <input
              aria-label="Search cashier name"
              placeholder="Search cashier name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-lg border border-lunar-border py-2.5 pl-10 pr-3 text-sm"
            />
          </div>

          <input
            type="date"
            aria-label="Filter account date"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
            className="rounded-lg border border-lunar-border px-3 py-2 text-sm"
          />

          <button
            type="button"
            onClick={() => {
              setSearch("");
              setDateFilter("");
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
                  "Previous balance",
                  "Top-ups",
                  "Total available",
                  "Bank transfers",
                  "Cash collected",
                  "Card payments",
                  "Total spent",
                  "Expected wallet",
                  "Actual wallet",
                  "Automatic remark",
                  "Submission",
                  "Manager",
                  "Manager comment",
                  "Finance",
                  "Cash receipt",
                  "Action",
                ].map((heading) => (
                  <th key={heading} className="px-4 py-4">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {records.map((account) => (
                <tr key={account.id} className="border-t border-lunar-border">
                  <td className="px-4 py-4">
                    <p className="font-medium">{account.cashierName}</p>
                    <p className="mt-1 text-xs text-lunar-muted">{account.date}</p>
                  </td>

                  {[
                    account.summary.openingBalance,
                    account.summary.totalTopUps,
                    account.summary.totalAvailable,
                    account.summary.bankTransfers,
                    account.summary.cashCollected,
                    account.summary.cardPayments,
                    account.summary.totalSpent,
                    account.summary.expectedClosingBalance,
                  ].map((value, index) => (
                    <td key={index} className="px-4 py-4">
                      {formatMoney(value)}
                    </td>
                  ))}

                  <td className="px-4 py-4">
                    {account.summary.actualClosingBalance === null
                      ? "Not entered"
                      : formatMoney(account.summary.actualClosingBalance)}
                  </td>

                  <td className="px-4 py-4">
                    <Badge
                      value={
                        account.summary.tallies === null
                          ? "Awaiting figures"
                          : account.summary.tallies
                            ? "Good"
                            : "Check Record"
                      }
                    />
                  </td>

                  <td className="px-4 py-4">{account.status}</td>

                  <td className="px-4 py-4">
                    <Badge value={account.managerReview.status} />
                  </td>

                  <td className="min-w-48 max-w-72 whitespace-pre-wrap break-words px-4 py-4 text-xs">
                    {account.managerReview.comment || "—"}
                  </td>

                  <td className="px-4 py-4">
                    <Badge value={account.financeReview.status} />
                  </td>

                  <td className="px-4 py-4">
                    {account.summary.cashCollected === 0 ? (
                      "No cash collected"
                    ) : (
                      <Badge
                        value={
                          account.cashReceipt.confirmed ? "Received" : "Pending"
                        }
                      />
                    )}
                  </td>

                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => openAccount(account)}
                      className="font-medium text-lunar-primary"
                    >
                      {isCashier ? "Open" : "Review"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && records.length === 0 && (
            <p className="p-8 text-center text-sm text-lunar-muted">
              No daily accounts match your filters.
            </p>
          )}
        </div>
      </section>

      {modalOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="daily-account-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 id="daily-account-title" className="text-xl font-semibold">
                Daily wallet account
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setModalOpen(false)}
              >
                <X size={21} />
              </button>
            </div>

            <p className="mt-2 text-sm text-lunar-muted">
              {selectedAccount.cashierName}
              {" · "}
              {selectedAccount.date}
            </p>

            <div className="mt-5 grid gap-3 rounded-lg bg-lunar-background p-4 sm:grid-cols-3">
              {[
                ["Previous balance", selectedAccount.summary.openingBalance],
                ["Today's top-ups", selectedAccount.summary.totalTopUps],
                ["Total available", selectedAccount.summary.totalAvailable],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <p className="text-xs text-lunar-muted">{label}</p>
                  <p className="mt-2 font-semibold">
                    {formatMoney(Number(value))}
                  </p>
                </div>
              ))}
            </div>

            <form
              className="mt-5 space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (canEdit) void submitFigures();
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                {amountField("Bank Transfers (₦)", "bankTransfers")}
                {amountField("Cash Collected (₦)", "cashCollected")}
                {amountField("Card Payments (₦)", "cardPayments")}
                {amountField(
                  "Actual remaining wallet balance (₦)",
                  "actualClosingBalance",
                )}
              </div>

              <div className="rounded-lg border border-lunar-border p-4">
                <p className="text-sm">
                  Total spent:{" "}
                  <strong>
                    {previewSpent === null ? "—" : formatMoney(previewSpent)}
                  </strong>
                </p>

                <p className="mt-2 text-sm">
                  Expected wallet balance:{" "}
                  <strong>
                    {previewClosing === null ? "—" : formatMoney(previewClosing)}
                  </strong>
                </p>

                <p className="mt-2 text-sm">
                  Difference, actual minus expected:{" "}
                  <strong>
                    {previewVariance === null
                      ? "—"
                      : formatMoney(previewVariance)}
                  </strong>
                </p>

                <div className="mt-3">
                  <Badge
                    value={
                      previewVariance === null
                        ? "Awaiting figures"
                        : previewVariance === 0
                          ? "Good"
                          : "Check Record"
                    }
                  />
                </div>

                <p className="mt-3 text-xs text-lunar-muted">
                  Calculated automatically, not chosen by the cashier.
                </p>
              </div>

              {canEdit && (
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-lunar-primary px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  Submit daily account
                </button>
              )}

              {isCashier && !canEdit && (
                <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  {selectedAccount.hasLaterAccount
                    ? "A later wallet day exists, so these figures are fixed."
                    : "Submitted figures are locked until a reviewer returns the account with Check Record."}
                </p>
              )}
            </form>

            <section className="mt-6 grid gap-4 border-t border-lunar-border pt-5 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-medium">Facility Manager</p>
                <Badge value={selectedAccount.managerReview.status} />
                <p className="mt-2 text-xs text-lunar-muted">
                  {selectedAccount.managerReview.reviewedByName ?? "—"}
                </p>
                <p className="mt-1 text-xs text-lunar-muted">
                  {reviewTime(selectedAccount.managerReview.reviewedAt)}
                </p>

                {selectedAccount.managerReview.comment && (
                  <p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-lunar-background p-3 text-sm">
                    <strong>Manager comment: </strong>
                    {selectedAccount.managerReview.comment}
                  </p>
                )}
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Finance</p>
                <Badge value={selectedAccount.financeReview.status} />
                <p className="mt-2 text-xs text-lunar-muted">
                  {selectedAccount.financeReview.reviewedByName ?? "—"}
                </p>
                <p className="mt-1 text-xs text-lunar-muted">
                  {reviewTime(selectedAccount.financeReview.reviewedAt)}
                </p>
              </div>
            </section>

            {!isCashier && (
              <form
                className="mt-6 space-y-4 border-t border-lunar-border pt-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveReview();
                }}
              >
                <label className="block text-sm font-medium">
                  Your review remark
                  <select
                    value={decision}
                    onChange={(event) =>
                      setDecision(
                        event.target.value as Exclude<WalletReviewStatus, "Pending">,
                      )
                    }
                    className={inputClass}
                  >
                    <option value="Okay">Okay</option>
                    <option value="Check Record">Check Record</option>
                  </select>
                </label>

                {isManager && (
                  <label className="block text-sm font-medium">
                    Review comment
                    <textarea
                      rows={4}
                      value={managerComment}
                      onChange={(event) => setManagerComment(event.target.value)}
                      placeholder="Enter observations about collections, balances, or discrepancies."
                      className={inputClass}
                    />
                  </label>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-lunar-primary px-4 py-2.5 text-sm text-white disabled:opacity-60"
                >
                  Save review
                </button>
              </form>
            )}

            {isFinance && (
              <section className="mt-6 border-t border-lunar-border pt-5">
                <h3 className="font-semibold">Cash receipt</h3>
                <p className="mt-2 text-sm">
                  Cash collected: {formatMoney(selectedAccount.summary.cashCollected)}
                </p>

                {selectedAccount.cashReceipt.confirmed ? (
                  <div className="mt-3">
                    <Badge value="Received" />
                    <p className="mt-2 text-xs text-lunar-muted">
                      Confirmed by{" "}
                      {selectedAccount.cashReceipt.confirmedByName ?? "—"}
                      {" · "}
                      {reviewTime(selectedAccount.cashReceipt.confirmedAt)}
                    </p>
                  </div>
                ) : selectedAccount.summary.cashCollected > 0 ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void receiveCash()}
                    className="mt-3 rounded-lg border border-lunar-primary px-4 py-2.5 text-sm font-medium text-lunar-primary disabled:opacity-60"
                  >
                    Confirm cash received
                  </button>
                ) : (
                  <p className="mt-3 text-sm text-lunar-muted">
                    No cash collected for this account.
                  </p>
                )}
              </section>
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
