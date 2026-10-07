import { useState } from "react";
import { Plus, Search, X } from "lucide-react";

import { useApp } from "../hooks/useApp";
import type { DailyAccount, WalletReviewRemark } from "../types";

import {
  calculateWalletSummary,
  canCashierEditDailyAccount,
  formatMoney,
  getToday,
  roundMoney,
} from "../utils/accounting";

import {
  canAccessDailyAccount,
  confirmCashReceived,
  getCurrentDailyAccount,
  reviewDailyAccount,
  submitDailyAccount,
} from "../utils/dailyAccount";

import { getTodayWallet } from "../utils/topUp";

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
  const colour =
    ["Good", "Okay", "Received"].includes(value)
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
  const { data, currentUser, updateData } = useApp();

  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<AccountForm>(emptyForm);

  const [decision, setDecision] =
    useState<Exclude<WalletReviewRemark, "Pending">>("Okay");

  const [managerComment, setManagerComment] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  if (!currentUser) return null;

  const actor = currentUser;
  const isCashier = actor.role === "cashier";
  const isFinance = actor.role === "finance";
  const isManager = actor.role === "facility_manager";

  const selectedAccount = data.dailyAccounts.find(
    (account) => account.id === selectedId,
  );

  const hasLaterAccount = selectedAccount
    ? data.dailyAccounts.some(
        (account) =>
          account.cashierId === selectedAccount.cashierId &&
          account.hospitalId === selectedAccount.hospitalId &&
          account.date > selectedAccount.date,
      )
    : false;

  const canEdit =
    isCashier &&
    !hasLaterAccount &&
    (!selectedAccount ||
      canCashierEditDailyAccount(selectedAccount));

  function userName(id: string | null): string {
    return id
      ? data.users.find((user) => user.id === id)?.name ??
          "Unknown user"
      : "—";
  }

  function reviewTime(value: string | null): string {
    return value
      ? new Date(value).toLocaleString("en-NG", {
          timeZone: "Africa/Lagos",
        })
      : "Awaiting review";
  }

  const records = data.dailyAccounts
    .filter((account) =>
      canAccessDailyAccount(actor, account, data),
    )
    .filter(
      (account) =>
        userName(account.cashierId)
          .toLowerCase()
          .includes(search.trim().toLowerCase()) &&
        (!dateFilter || account.date === dateFilter),
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  let previewError = "";
  let wallet: ReturnType<typeof calculateWalletSummary> | null = null;

  if (selectedAccount) {
    wallet = calculateWalletSummary(selectedAccount, data.topUps);
  } else if (isCashier) {
    try {
      wallet = getTodayWallet(data, actor);
    } catch (err) {
      previewError =
        err instanceof Error
          ? err.message
          : "Unable to calculate wallet totals.";
    }
  }

  const validFigures = Object.values(form).every(
    (value) =>
      value.trim() !== "" &&
      Number.isFinite(Number(value)) &&
      Number(value) >= 0 &&
      Math.abs(
        Number(value) * 100 - Math.round(Number(value) * 100),
      ) < 0.000001,
  );

  const previewSpent = validFigures
    ? roundMoney(
        Number(form.bankTransfers) +
          Number(form.cashCollected) +
          Number(form.cardPayments),
      )
    : null;

  const previewClosing =
    wallet && previewSpent !== null
      ? roundMoney(wallet.totalAvailable - previewSpent)
      : null;

  const previewVariance =
    previewClosing !== null
      ? roundMoney(
          Number(form.actualClosingBalance) - previewClosing,
        )
      : null;

  function openAccount(account?: DailyAccount) {
    setSelectedId(account?.id ?? null);

    setForm(
      account
        ? {
            bankTransfers: String(account.bankTransfers),
            cashCollected: String(account.cashCollected),
            cardPayments: String(account.cardPayments),
            actualClosingBalance:
              account.actualClosingBalance === null
                ? ""
                : String(account.actualClosingBalance),
          }
        : emptyForm(),
    );

    const summary = account
      ? calculateWalletSummary(account, data.topUps)
      : null;

    const existingRemark = account
      ? isFinance
        ? account.financeReview.remark
        : account.facilityManagerReview.remark
      : "Pending";

    setDecision(
      existingRemark === "Pending"
        ? summary?.tallies === true
          ? "Okay"
          : "Check Record"
        : existingRemark,
    );

    setManagerComment(account?.facilityManagerReview.comment ?? "");
    setError("");
    setMessage("");
    setModalOpen(true);
  }

  function openToday() {
    openAccount(
      getCurrentDailyAccount(
        data,
        actor.id,
        actor.hospitalIds[0],
      ),
    );
  }

  function submitFigures() {
    setError("");

    if (!validFigures) {
      setError("Enter valid amounts in all four fields.");
      return;
    }

    try {
      updateData((current) =>
        submitDailyAccount(
          current,
          actor,
          {
            bankTransfers: Number(form.bankTransfers),
            cashCollected: Number(form.cashCollected),
            cardPayments: Number(form.cardPayments),
            actualClosingBalance: Number(form.actualClosingBalance),
          },
          selectedId ?? undefined,
        ),
      );

      setModalOpen(false);
      setMessage("Daily account submitted for review.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to submit.",
      );
    }
  }

  function saveReview() {
    if (!selectedAccount) return;
    setError("");

    try {
      updateData((current) =>
        reviewDailyAccount(
          current,
          actor,
          selectedAccount.id,
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

  function receiveCash() {
    if (!selectedAccount) return;
    setError("");

    try {
      updateData((current) =>
        confirmCashReceived(current, actor, selectedAccount.id),
      );

      setModalOpen(false);
      setMessage("Cash receipt confirmed by Finance.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to confirm cash receipt.",
      );
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
          onChange={(event) =>
            setForm({ ...form, [key]: event.target.value })
          }
          className={inputClass}
        />
      </label>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            Daily Wallet Accounts
          </h1>
          <p className="mt-2 text-sm text-lunar-muted">
            Account for collections and compare expected and actual balances.
          </p>
        </div>

        {isCashier && (
          <button
            type="button"
            onClick={openToday}
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
              {records.map((account) => {
                const summary = calculateWalletSummary(
                  account,
                  data.topUps,
                );

                return (
                  <tr
                    key={account.id}
                    className="border-t border-lunar-border"
                  >
                    <td className="px-4 py-4">
                      <p className="font-medium">
                        {userName(account.cashierId)}
                      </p>
                      <p className="mt-1 text-xs text-lunar-muted">
                        {account.date}
                      </p>
                    </td>

                    {[
                      summary.openingBalance,
                      summary.totalTopUps,
                      summary.totalAvailable,
                      account.bankTransfers,
                      account.cashCollected,
                      account.cardPayments,
                      summary.totalSpent,
                      summary.expectedClosingBalance,
                    ].map((value, index) => (
                      <td key={index} className="px-4 py-4">
                        {formatMoney(value)}
                      </td>
                    ))}

                    <td className="px-4 py-4">
                      {summary.actualClosingBalance === null
                        ? "Not entered"
                        : formatMoney(summary.actualClosingBalance)}
                    </td>

                    <td className="px-4 py-4">
                      <Badge
                        value={
                          summary.tallies === null
                            ? "Awaiting figures"
                            : summary.tallies
                              ? "Good"
                              : "Check Record"
                        }
                      />
                    </td>

                    <td className="px-4 py-4">{account.status}</td>

                    <td className="px-4 py-4">
                      <Badge
                        value={account.facilityManagerReview.remark}
                      />
                    </td>

                    <td className="min-w-48 max-w-72 whitespace-pre-wrap break-words px-4 py-4 text-xs">
                      {account.facilityManagerReview.comment || "—"}
                    </td>

                    <td className="px-4 py-4">
                      <Badge value={account.financeReview.remark} />
                    </td>

                    <td className="px-4 py-4">
                      {account.cashCollected === 0 ? (
                        "No cash collected"
                      ) : (
                        <Badge
                          value={
                            account.cashReceipt.confirmed
                              ? "Received"
                              : "Pending"
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
                );
              })}
            </tbody>
          </table>

          {records.length === 0 && (
            <p className="p-8 text-center text-sm text-lunar-muted">
              No daily accounts match your filters.
            </p>
          )}
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="daily-account-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6"
          >
            <div className="flex items-center justify-between gap-4">
              <h2
                id="daily-account-title"
                className="text-xl font-semibold"
              >
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
              {selectedAccount
                ? userName(selectedAccount.cashierId)
                : actor.name}
              {" · "}
              {selectedAccount?.date ?? getToday()}
            </p>

            {previewError && (
              <p
                role="alert"
                className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"
              >
                {previewError}
              </p>
            )}

            {wallet && (
              <div className="mt-5 grid gap-3 rounded-lg bg-lunar-background p-4 sm:grid-cols-3">
                {[
                  ["Previous balance", wallet.openingBalance],
                  ["Today's top-ups", wallet.totalTopUps],
                  ["Total available", wallet.totalAvailable],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <p className="text-xs text-lunar-muted">{label}</p>
                    <p className="mt-2 font-semibold">
                      {formatMoney(Number(value))}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <form
              className="mt-5 space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (canEdit) submitFigures();
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
                    {previewSpent === null
                      ? "—"
                      : formatMoney(previewSpent)}
                  </strong>
                </p>

                <p className="mt-2 text-sm">
                  Expected wallet balance:{" "}
                  <strong>
                    {previewClosing === null
                      ? "—"
                      : formatMoney(previewClosing)}
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
                  disabled={!wallet}
                  className="rounded-lg bg-lunar-primary px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  Submit daily account
                </button>
              )}

              {isCashier && !canEdit && (
                <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  {hasLaterAccount
                    ? "A later wallet day exists, so these figures are fixed."
                    : "Submitted figures are locked until a reviewer returns the account with Check Record."}
                </p>
              )}
            </form>

            {selectedAccount && (
              <section className="mt-6 grid gap-4 border-t border-lunar-border pt-5 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-medium">
                    Facility Manager
                  </p>
                  <Badge
                    value={selectedAccount.facilityManagerReview.remark}
                  />
                  <p className="mt-2 text-xs text-lunar-muted">
                    {userName(
                      selectedAccount.facilityManagerReview.reviewedBy,
                    )}
                  </p>
                  <p className="mt-1 text-xs text-lunar-muted">
                    {reviewTime(
                      selectedAccount.facilityManagerReview.reviewedAt,
                    )}
                  </p>

                  {selectedAccount.facilityManagerReview.comment && (
                    <p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-lunar-background p-3 text-sm">
                      <strong>Manager comment: </strong>
                      {selectedAccount.facilityManagerReview.comment}
                    </p>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium">Finance</p>
                  <Badge value={selectedAccount.financeReview.remark} />
                  <p className="mt-2 text-xs text-lunar-muted">
                    {userName(selectedAccount.financeReview.reviewedBy)}
                  </p>
                  <p className="mt-1 text-xs text-lunar-muted">
                    {reviewTime(selectedAccount.financeReview.reviewedAt)}
                  </p>
                </div>
              </section>
            )}

            {!isCashier && selectedAccount && (
              <form
                className="mt-6 space-y-4 border-t border-lunar-border pt-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  saveReview();
                }}
              >
                <label className="block text-sm font-medium">
                  Your review remark
                  <select
                    value={decision}
                    onChange={(event) =>
                      setDecision(
                        event.target.value as Exclude<
                          WalletReviewRemark,
                          "Pending"
                        >,
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
                      onChange={(event) =>
                        setManagerComment(event.target.value)
                      }
                      placeholder="Enter observations about collections, balances, or discrepancies."
                      className={inputClass}
                    />
                  </label>
                )}

                <button
                  type="submit"
                  className="rounded-lg bg-lunar-primary px-4 py-2.5 text-sm text-white"
                >
                  Save review
                </button>
              </form>
            )}

            {isFinance && selectedAccount && (
              <section className="mt-6 border-t border-lunar-border pt-5">
                <h3 className="font-semibold">Cash receipt</h3>
                <p className="mt-2 text-sm">
                  Cash collected:{" "}
                  {formatMoney(selectedAccount.cashCollected)}
                </p>

                {selectedAccount.cashReceipt.confirmed ? (
                  <div className="mt-3">
                    <Badge value="Received" />
                    <p className="mt-2 text-xs text-lunar-muted">
                      Confirmed by{" "}
                      {userName(selectedAccount.cashReceipt.confirmedBy)}
                      {" · "}
                      {reviewTime(selectedAccount.cashReceipt.confirmedAt)}
                    </p>
                  </div>
                ) : selectedAccount.cashCollected > 0 ? (
                  <button
                    type="button"
                    onClick={receiveCash}
                    className="mt-3 rounded-lg border border-lunar-primary px-4 py-2.5 text-sm font-medium text-lunar-primary"
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