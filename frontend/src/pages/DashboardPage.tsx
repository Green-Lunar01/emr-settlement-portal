import { useApp } from "../hooks/useApp";
import {
  calculateWalletSummary,
  formatMoney,
  getCarryForwardBalance,
  getToday,
} from "../utils/accounting";
import { ROLE_LABELS } from "../utils/roles";

export default function DashboardPage() {
 const { data, currentUser } = useApp();

  if (!currentUser) {
    return null;
  }

  const hospitalNames = data.hospitals
    .filter((hospital) =>
      currentUser.hospitalIds.includes(hospital.id),
    )
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

  const todaysTopUps = data.topUps.filter(
    (topUp) =>
      topUp.date === today &&
      currentUser.hospitalIds.includes(topUp.hospitalId) &&
      (currentUser.role !== "cashier" ||
        topUp.cashierId === currentUser.id),
  );

  const totalTopUps = todaysTopUps.reduce(
    (total, topUp) => total + topUp.amount,
    0,
  );

  const todaysAccounts = data.dailyAccounts.filter(
    (account) =>
      account.date === today &&
      currentUser.hospitalIds.includes(account.hospitalId),
  );

  let openingBalance = 0;
  let walletBalance = 0;
  let balanceError = "";

  if (currentUser.role === "cashier") {
    const hospitalId = currentUser.hospitalIds[0];

    const account = data.dailyAccounts.find(
      (item) =>
        item.cashierId === currentUser.id &&
        item.hospitalId === hospitalId &&
        item.date === today,
    );

    if (account) {
      const summary = calculateWalletSummary(
        account,
        data.topUps,
      );

      openingBalance = summary.openingBalance;
      walletBalance = summary.expectedClosingBalance;
    } else if (hospitalId) {
      try {
        openingBalance = getCarryForwardBalance(
          currentUser.id,
          hospitalId,
          today,
          data.dailyAccounts,
          data.topUps,
        );

        walletBalance = openingBalance + totalTopUps;
      } catch (err) {
        balanceError =
          err instanceof Error
            ? err.message
            : "Unable to calculate your opening balance.";
      }
    } else {
      balanceError = "Your account needs a hospital assignment.";
    }
  }

  const cashierCards = [
    {
      label: "Previous balance",
      value: formatMoney(openingBalance),
    },
    {
      label: "Latest top-up today",
      value: formatMoney(
        [...todaysTopUps]
          .sort((a, b) =>
            b.issuedAt.localeCompare(a.issuedAt),
          )[0]?.amount ?? 0,
      ),
    },
    {
      label: "Total top-ups today",
      value: formatMoney(totalTopUps),
    },
    {
      label: "Total available today",
      value: formatMoney(openingBalance + totalTopUps),
    },
    {
      label: "Expected wallet balance",
      value: formatMoney(walletBalance),
    },
  ];

  const staffCards = [
    {
      label: "Active cashiers",
      value: String(visibleCashiers.length),
    },
    {
      label: "Top-ups issued today",
      value: formatMoney(totalTopUps),
    },
    {
      label: "Daily accounts submitted today",
      value: String(
        todaysAccounts.filter(
          (account) => account.status === "Submitted",
        ).length,
      ),
    },
  ];

  const cards =
    currentUser.role === "cashier"
      ? cashierCards
      : staffCards;

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

      {balanceError ? (
        <p
          role="alert"
          className="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-800"
        >
          {balanceError}
        </p>
      ) : (
        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <article
              key={card.label}
              className="rounded-xl border border-lunar-border bg-white p-6"
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
      )}

      <section className="mt-8 rounded-xl border border-lunar-border bg-white p-6">
        <h2 className="text-lg font-semibold">
          Your workspace
        </h2>

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