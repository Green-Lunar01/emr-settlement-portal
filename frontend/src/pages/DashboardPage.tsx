import { useEffect, useState } from "react";
import { apiRequest, type ApiDailyAccount, type ApiTopUp } from "../api/client";
import { useApp } from "../hooks/useApp";
import { formatMoney, getToday } from "../utils/accounting";
import { ROLE_LABELS } from "../utils/roles";

export default function DashboardPage() {
  const { data, currentUser } = useApp();
  const [wallet, setWallet] = useState<ApiDailyAccount | null>(null);
  const [topUps, setTopUps] = useState<ApiTopUp[]>([]);
  const [accounts, setAccounts] = useState<ApiDailyAccount[]>([]);
  const [error, setError] = useState("");

  const isCashier = currentUser?.role === "cashier";

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const today = getToday();
        const [topUpResult, accountResult, walletResult] = await Promise.all([
          apiRequest<{ topUps: ApiTopUp[] }>(
            `/api/top-ups?date=${encodeURIComponent(today)}`,
          ),
          apiRequest<{ dailyAccounts: ApiDailyAccount[] }>(
            `/api/daily-accounts?date=${encodeURIComponent(today)}`,
          ),
          isCashier
            ? apiRequest<ApiDailyAccount>("/api/daily-accounts/today")
            : Promise.resolve(null),
        ]);

        if (!cancelled) {
          setTopUps(topUpResult.topUps);
          setAccounts(accountResult.dailyAccounts);
          setWallet(walletResult);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load dashboard figures.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [currentUser, isCashier]);

  if (!currentUser) {
    return null;
  }

  const hospitalNames = data.hospitals
    .filter((hospital) => currentUser.hospitalIds.includes(hospital.id))
    .map((hospital) => hospital.name);

  const visibleCashiers = data.users.filter(
    (user) =>
      user.role === "cashier" &&
      user.status === "active" &&
      user.hospitalIds.some((hospitalId) =>
        currentUser.hospitalIds.includes(hospitalId),
      ),
  );

  const today = getToday();
  const totalTopUps = topUps.reduce((total, topUp) => total + topUp.amount, 0);
  const latestTopUp = [...topUps].sort((a, b) =>
    b.issuedAt.localeCompare(a.issuedAt),
  )[0];

  const cashierCards = [
    {
      label: "Previous balance",
      value: formatMoney(wallet?.summary.openingBalance ?? 0),
    },
    {
      label: "Latest top-up today",
      value: formatMoney(latestTopUp?.amount ?? 0),
    },
    { label: "Total top-ups today", value: formatMoney(totalTopUps) },
    {
      label: "Total available today",
      value: formatMoney(wallet?.summary.totalAvailable ?? 0),
    },
    {
      label: "Expected wallet balance",
      value: formatMoney(wallet?.summary.expectedClosingBalance ?? 0),
    },
  ];

  const staffCards = [
    { label: "Active cashiers", value: String(visibleCashiers.length) },
    { label: "Top-ups issued today", value: formatMoney(totalTopUps) },
    {
      label: "Daily accounts submitted today",
      value: String(
        accounts.filter((account) => account.status === "Submitted").length,
      ),
    },
  ];

  const cards = isCashier ? cashierCards : staffCards;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-lunar-primary">
        {ROLE_LABELS[currentUser.role]}
      </p>

      <h1 className="mt-3 text-3xl font-semibold">
        Welcome, {currentUser.name}
      </h1>

      <p className="mt-3 text-sm text-lunar-muted">
        {hospitalNames.join(" · ")} · {today}
      </p>

      {error ? (
        <p
          role="alert"
          className="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-800"
        >
          {error}
        </p>
      ) : (
        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <article
              key={card.label}
              className="rounded-xl border border-lunar-border bg-white shadow-card p-6"
            >
              <p className="text-sm text-lunar-muted">{card.label}</p>
              <p className="mt-4 text-2xl font-semibold">{card.value}</p>
            </article>
          ))}
        </section>
      )}

      <section className="mt-8 rounded-xl border border-lunar-border bg-white shadow-card p-6">
        <h2 className="text-lg font-semibold">Your workspace</h2>

        <p className="mt-3 text-sm leading-relaxed text-lunar-muted">
          {currentUser.role === "finance"
            ? "Create and assign cashier accounts, audit EMR records, review wallet accounts, and confirm cash receipts."
            : currentUser.role === "facility_manager"
              ? "Manage your hospital’s cashier top-ups and review EMR and daily wallet records."
              : "Acknowledge top-ups, submit EMR and TAP records, and account for your daily collections."}
        </p>
      </section>
    </div>
  );
}
