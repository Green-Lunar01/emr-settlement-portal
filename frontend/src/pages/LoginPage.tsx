import { useState } from "react";
import { ArrowRight, Moon } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { useApp } from "../hooks/useApp";
import { ROLE_HOME } from "../utils/roles";

const demoAccounts = [
  {
    label: "Finance",
    email: "finance@lunar.demo",
  },
  {
    label: "Facility Manager",
    email: "manager@lunar.demo",
  },
  {
    label: "Cashier",
    email: "cashier@lunar.demo",
  },
];

export default function LoginPage() {
  const { currentUser, login } = useApp();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (currentUser) {
    return (
      <Navigate to={ROLE_HOME[currentUser.role]} replace />
    );
  }

  function signIn(
    selectedEmail: string,
    selectedPassword: string,
  ): void {
    setError("");

    try {
      const user = login(selectedEmail, selectedPassword);

      navigate(ROLE_HOME[user.role], {
        replace: true,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in. Please try again.",
      );
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="flex flex-col justify-between bg-lunar-sidebar p-8 text-white lg:p-14">
        <div className="flex items-center gap-3">
          <Moon size={32} className="text-emerald-300" />

          <div>
            <p className="text-xl font-bold">Lunar</p>
            <p className="text-xs tracking-widest text-emerald-200">
              ACCOUNTING SYSTEM
            </p>
          </div>
        </div>

        <div className="my-12 max-w-lg">
          <p className="mb-4 text-xs font-semibold tracking-widest text-emerald-300">
            HOSPITAL ACCOUNTING
          </p>

          <h1 className="text-4xl font-semibold leading-tight lg:text-5xl">
            Clear records.
            <br />
            Accountable teams.
          </h1>

          <p className="mt-6 leading-relaxed text-emerald-100">
            Reconcile EMR and TAP records, manage cashier
            top-ups, and review daily wallet accounts.
          </p>
        </div>

        <p className="text-sm text-emerald-200">
          Cashier → Facility Manager → Finance
        </p>
      </section>

      <section className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <h2 className="text-3xl font-semibold">Sign in</h2>

          <p className="mt-3 text-sm text-lunar-muted">
            Enter the credentials provided for your account.
          </p>

          <form
            className="mt-8 space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              signIn(email, password);
            }}
          >
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium"
              >
                Email address
              </label>

              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="you@hospital.com"
                className="w-full rounded-lg border border-lunar-border bg-white px-4 py-3"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                className="w-full rounded-lg border border-lunar-border bg-white px-4 py-3"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-lunar-primary px-4 py-3 font-medium text-white hover:bg-lunar-primary-dark"
            >
              Sign in
              <ArrowRight size={18} />
            </button>
          </form>

          <div className="mt-8 rounded-xl border border-lunar-border bg-white p-5">
            <h3 className="font-semibold">
              Explore the demo portals
            </h3>

            <p className="mt-2 text-sm text-lunar-muted">
              Each portal uses the same data in this browser.
            </p>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {demoAccounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() =>
                    signIn(account.email, "Lunar123!")
                  }
                  className="rounded-lg border border-lunar-border px-3 py-3 text-xs font-medium text-lunar-primary hover:bg-emerald-50"
                >
                  {account.label}
                </button>
              ))}
            </div>

            <p className="mt-4 text-xs text-lunar-muted">
              Demo password: Lunar123!
            </p>
          </div>

          <p className="mt-5 text-xs leading-relaxed text-lunar-muted">
            Cashier accounts are created by Finance. This
            prototype uses browser-local data and demo login
            credentials.
          </p>
        </div>
      </section>
    </main>
  );
}