import { useState } from "react";
import { Plus, Search, X } from "lucide-react";

import { useApp } from "../hooks/useApp";
import { formatMoney, getToday } from "../utils/accounting";
import {
  acknowledgeTopUp,
  canAccessTopUp,
  getTodayWallet,
  issueTopUp,
} from "../utils/topUp";

export default function TopUpPage() {
  const { data, currentUser, updateData } = useApp();

  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [receiptFilter, setReceiptFilter] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [cashierId, setCashierId] = useState("");
  const [amount, setAmount] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  if (!currentUser) {
    return null;
  }

  const actor = currentUser;
  const isCashier = actor.role === "cashier";

  const cashiers = data.users.filter(
    (user) =>
      user.role === "cashier" &&
      user.status === "active" &&
      user.hospitalIds.some((hospitalId) =>
        actor.hospitalIds.includes(hospitalId),
      ),
  );

  function userName(id: string): string {
    return (
      data.users.find((user) => user.id === id)?.name ??
      "Unknown user"
    );
  }

  function hospitalName(id: string): string {
    return (
      data.hospitals.find(
        (hospital) => hospital.id === id,
      )?.name ?? "Unknown hospital"
    );
  }

  function displayTime(value: string): string {
    return new Date(value).toLocaleString("en-NG", {
      timeZone: "Africa/Lagos",
    });
  }

  const visibleTopUps = data.topUps.filter(
    (topUp) => canAccessTopUp(actor, topUp),
  );

  const records = visibleTopUps
    .filter((topUp) => {
      const matchesSearch = userName(topUp.cashierId)
        .toLowerCase()
        .includes(search.trim().toLowerCase());

      const matchesDate =
        !dateFilter || topUp.date === dateFilter;

      const matchesReceipt =
        !receiptFilter ||
        (receiptFilter === "acknowledged"
          ? topUp.acknowledged
          : !topUp.acknowledged);

      return (
        matchesSearch &&
        matchesDate &&
        matchesReceipt
      );
    })
    .sort((a, b) =>
      b.issuedAt.localeCompare(a.issuedAt),
    );

  const todayTopUps = visibleTopUps.filter(
    (topUp) => topUp.date === getToday(),
  );

  const totalIssuedToday = todayTopUps.reduce(
    (total, topUp) => total + topUp.amount,
    0,
  );

  const latestTopUp = [...todayTopUps].sort(
    (a, b) => b.issuedAt.localeCompare(a.issuedAt),
  )[0];

  let walletError = "";
  let wallet: ReturnType<typeof getTodayWallet> | null =
    null;

  if (isCashier) {
    try {
      wallet = getTodayWallet(data, actor);
    } catch (err) {
      walletError =
        err instanceof Error
          ? err.message
          : "Unable to calculate your wallet balance.";
    }
  }

  const cards =
    isCashier && wallet
      ? [
          {
            label: "Previous balance",
            value: formatMoney(wallet.openingBalance),
          },
          {
            label: "Latest top-up today",
            value: formatMoney(latestTopUp?.amount ?? 0),
          },
          {
            label: "Total top-ups today",
            value: formatMoney(wallet.totalTopUps),
          },
          {
            label: "Total available",
            value: formatMoney(wallet.totalAvailable),
          },
          {
            label: "Total spent",
            value: formatMoney(wallet.totalSpent),
          },
          {
            label: "Expected wallet balance",
            value: formatMoney(
              wallet.expectedClosingBalance,
            ),
          },
        ]
      : isCashier
        ? []
        : [
            {
              label: "Active cashiers",
              value: String(cashiers.length),
            },
            {
              label: "Top-ups issued today",
              value: formatMoney(totalIssuedToday),
            },
            {
              label: "Awaiting receipt confirmation",
              value: String(
                visibleTopUps.filter(
                  (topUp) => !topUp.acknowledged,
                ).length,
              ),
            },
          ];

  function openForm(selectedCashierId?: string) {
    setCashierId(
      selectedCashierId ?? cashiers[0]?.id ?? "",
    );
    setAmount("");
    setError("");
    setMessage("");
    setShowForm(true);
  }

  function submitTopUp() {
    setError("");
    setMessage("");

    if (!cashierId || amount.trim() === "") {
      setError("Select a cashier and enter an amount.");
      return;
    }

    try {
      updateData((current) =>
        issueTopUp(
          current,
          actor,
          cashierId,
          Number(amount),
        ),
      );

      setShowForm(false);
      setMessage(
        `Top-up issued to ${userName(cashierId)}. Awaiting cashier receipt confirmation.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to issue the top-up.",
      );
    }
  }

  function confirmReceipt(topUpId: string) {
    setError("");
    setMessage("");

    try {
      updateData((current) =>
        acknowledgeTopUp(current, actor, topUpId),
      );

      setMessage("Top-up receipt confirmed.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to confirm receipt.",
      );
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            Top Up
          </h1>

          <p className="mt-2 text-sm text-lunar-muted">
            {isCashier
              ? "View your wallet and acknowledge incoming top-ups."
              : "Issue funds to cashier accounts and track receipt confirmations."}
          </p>
        </div>

        {!isCashier && (
          <button
            type="button"
            disabled={cashiers.length === 0}
            onClick={() => openForm()}
            className="flex items-center gap-2 rounded-lg bg-lunar-primary px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            <Plus size={18} />
            Issue top-up
          </button>
        )}
      </div>

      {walletError && (
        <p
          role="alert"
          className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-800"
        >
          {walletError}
        </p>
      )}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <article
            key={card.label}
            className="rounded-xl border border-lunar-border bg-white p-5"
          >
            <p className="text-sm text-lunar-muted">
              {card.label}
            </p>

            <p className="mt-4 text-2xl font-semibold">
              {card.value}
            </p>
          </article>
        ))}
      </section>

      {message && (
        <p
          role="status"
          className="mt-5 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {message}
        </p>
      )}

      {error && !showForm && (
        <p
          role="alert"
          className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {!isCashier && (
        <section className="mt-6 rounded-xl border border-lunar-border bg-white p-5">
          <h2 className="text-lg font-semibold">
            Cashier accounts
          </h2>

          <p className="mt-2 text-sm text-lunar-muted">
            Select a cashier to issue a top-up.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {cashiers.map((cashier) => (
              <div
                key={cashier.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-lunar-border p-4"
              >
                <div>
                  <p className="text-sm font-medium">
                    {cashier.name}
                  </p>

                  <p className="mt-1 text-xs text-lunar-muted">
                    {hospitalName(cashier.hospitalIds[0])}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openForm(cashier.id)}
                  className="whitespace-nowrap text-sm font-medium text-lunar-primary"
                >
                  Top up
                </button>
              </div>
            ))}
          </div>

          {cashiers.length === 0 && (
            <p className="mt-4 text-sm text-lunar-muted">
              No active cashiers in your assigned hospitals.
            </p>
          )}
        </section>
      )}

      <section className="mt-6 overflow-hidden rounded-xl border border-lunar-border bg-white">
        <div className="border-b border-lunar-border p-5">
          <h2 className="text-lg font-semibold">
            Disbursement ledger
          </h2>

          <p className="mt-2 text-sm text-lunar-muted">
            Each top-up is recorded separately.
          </p>
        </div>

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
              onChange={(event) =>
                setSearch(event.target.value)
              }
              className="w-full rounded-lg border border-lunar-border py-2.5 pl-10 pr-3 text-sm"
            />
          </div>

          <input
            type="date"
            aria-label="Filter top-up date"
            value={dateFilter}
            onChange={(event) =>
              setDateFilter(event.target.value)
            }
            className="rounded-lg border border-lunar-border px-3 py-2 text-sm"
          />

          <select
            aria-label="Filter receipt confirmation"
            value={receiptFilter}
            onChange={(event) =>
              setReceiptFilter(event.target.value)
            }
            className="rounded-lg border border-lunar-border px-3 py-2 text-sm"
          >
            <option value="">All receipts</option>
            <option value="pending">
              Awaiting confirmation
            </option>
            <option value="acknowledged">
              Receipt confirmed
            </option>
          </select>

          <button
            type="button"
            onClick={() => {
              setSearch("");
              setDateFilter("");
              setReceiptFilter("");
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
                <th className="px-4 py-4">Cashier</th>
                <th className="px-4 py-4">Date</th>
                <th className="px-4 py-4">Amount</th>
                <th className="px-4 py-4">Issued by</th>
                <th className="px-4 py-4">Receipt</th>
                {isCashier && (
                  <th className="px-4 py-4">Action</th>
                )}
              </tr>
            </thead>

            <tbody>
              {records.map((topUp) => (
                <tr
                  key={topUp.id}
                  className="border-t border-lunar-border"
                >
                  <td className="px-4 py-4">
                    <p className="font-medium">
                      {userName(topUp.cashierId)}
                    </p>

                    <p className="mt-1 text-xs text-lunar-muted">
                      {hospitalName(topUp.hospitalId)}
                    </p>
                  </td>

                  <td className="px-4 py-4">
                    <p>{topUp.date}</p>
                    <p className="mt-1 text-xs text-lunar-muted">
                      {displayTime(topUp.issuedAt)}
                    </p>
                  </td>

                  <td className="px-4 py-4 font-medium">
                    {formatMoney(topUp.amount)}
                  </td>

                  <td className="px-4 py-4">
                    {userName(topUp.issuedBy)}
                  </td>

                  <td className="px-4 py-4">
                    <span
                      className={
                        topUp.acknowledged
                          ? "rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700"
                          : "rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700"
                      }
                    >
                      {topUp.acknowledged
                        ? "Confirmed"
                        : "Pending"}
                    </span>

                    {topUp.acknowledgedAt && (
                      <p className="mt-2 text-xs text-lunar-muted">
                        {displayTime(topUp.acknowledgedAt)}
                      </p>
                    )}
                  </td>

                  {isCashier && (
                    <td className="px-4 py-4">
                      {!topUp.acknowledged ? (
                        <button
                          type="button"
                          onClick={() =>
                            confirmReceipt(topUp.id)
                          }
                          className="rounded-lg bg-lunar-primary px-3 py-2 text-xs font-medium text-white"
                        >
                          Confirm receipt
                        </button>
                      ) : (
                        <span className="text-xs text-lunar-muted">
                          Acknowledged
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {records.length === 0 && (
            <p className="p-8 text-center text-sm text-lunar-muted">
              No top-ups match your filters.
            </p>
          )}
        </div>
      </section>

      {showForm && !isCashier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="top-up-title"
            className="w-full max-w-md rounded-xl bg-white p-6"
          >
            <div className="flex items-center justify-between">
              <h2
                id="top-up-title"
                className="text-xl font-semibold"
              >
                Issue top-up
              </h2>

              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowForm(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form
              className="mt-6 space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                submitTopUp();
              }}
            >
              <label className="block text-sm font-medium">
                Cashier
                <select
                  required
                  value={cashierId}
                  onChange={(event) =>
                    setCashierId(event.target.value)
                  }
                  className="mt-2 w-full rounded-lg border border-lunar-border px-3 py-3 text-sm"
                >
                  <option value="">Select cashier</option>

                  {cashiers.map((cashier) => (
                    <option
                      key={cashier.id}
                      value={cashier.id}
                    >
                      {cashier.name} —{" "}
                      {hospitalName(cashier.hospitalIds[0])}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium">
                Amount (₦)
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(event) =>
                    setAmount(event.target.value)
                  }
                  placeholder="e.g. 100000"
                  className="mt-2 w-full rounded-lg border border-lunar-border px-3 py-3 text-sm"
                />
              </label>

              <p className="text-xs leading-relaxed text-lunar-muted">
                This top-up adds to the cashier's existing
                wallet balance today, {getToday()}. The
                cashier must confirm receipt.
              </p>

              {error && (
                <p
                  role="alert"
                  className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
                >
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
                  className="rounded-lg bg-lunar-primary px-4 py-2 text-sm font-medium text-white"
                >
                  Issue top-up
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}