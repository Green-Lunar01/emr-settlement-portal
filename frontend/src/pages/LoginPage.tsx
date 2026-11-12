import { useState } from "react";
import { ArrowRight, Moon, ShieldCheck } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useApp } from "../hooks/useApp";
import { ROLE_HOME } from "../utils/roles";

export default function LoginPage() {
  const { currentUser, login, sessionReady } = useApp();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!sessionReady) {
    return <p className="p-8 text-sm text-lunar-muted">Loading…</p>;
  }

  if (currentUser) {
    return (
      <Navigate to={ROLE_HOME[currentUser.role]} replace />
    );
  }

  async function signIn(
    selectedEmail: string,
    selectedPassword: string,
  ): Promise<void> {
    setError("");
    setBusy(true);

    try {
      const user = await login(selectedEmail, selectedPassword);

      navigate(ROLE_HOME[user.role], {
        replace: true,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-lunar-sidebar p-14 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(45,212,191,0.25), transparent 45%), radial-gradient(circle at 80% 70%, rgba(15,157,120,0.3), transparent 50%)",
          }}
        />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-lunar-primary to-lunar-accent shadow-raised">
            <Moon size={22} className="text-white" />
          </div>
          <div>
            <p className="text-xl font-bold leading-tight">Lunar</p>
            <p className="text-[11px] font-medium tracking-widest text-white/50">
              HOSPITAL REVENUE PLATFORM
            </p>
          </div>
        </div>

        <div className="relative my-12 max-w-lg">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-200">
            <ShieldCheck size={14} />
            Separation of duties, by design
          </p>

          <h1 className="text-4xl font-semibold leading-tight lg:text-5xl">
            Every bill accounted for.
            <br />
            Every record reviewed.
          </h1>

          <p className="mt-6 leading-relaxed text-white/70">
            Raise bills at the cashier or the point of service, reconcile
            EMR against TAP, manage wallets, and keep a full audit trail —
            end to end.
          </p>
        </div>

        <p className="relative text-sm text-white/50">
          Cashier / Service Staff → Facility Manager → Finance
        </p>
      </section>

      <section className="flex items-center justify-center bg-lunar-background p-6 lg:bg-white lg:p-12">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-lunar-primary to-lunar-accent">
              <Moon size={20} className="text-white" />
            </div>
            <p className="text-lg font-bold">Lunar</p>
          </div>

          <h2 className="text-3xl font-semibold tracking-tight">Welcome back</h2>

          <p className="mt-2 text-sm text-lunar-muted">
            Sign in with the credentials provided for your account.
          </p>

          <form
            className="mt-8 space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void signIn(email, password);
            }}
          >
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-lunar-text"
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
                className="w-full rounded-xl border border-lunar-border bg-white px-4 py-3 text-sm shadow-card focus:border-lunar-primary"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-lunar-text"
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
                className="w-full rounded-xl border border-lunar-border bg-white px-4 py-3 text-sm shadow-card focus:border-lunar-primary"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-lunar-primary px-4 py-3 font-medium text-white shadow-raised hover:bg-lunar-primary-dark disabled:opacity-60"
            >
              {busy ? "Signing in…" : "Sign in"}
              <ArrowRight size={18} />
            </button>
          </form>

          <p className="mt-6 text-sm text-lunar-text">
            New here?{" "}
            <Link to="/signup" className="font-medium text-lunar-primary">
              Request access
            </Link>
          </p>

          <p className="mt-5 text-xs leading-relaxed text-lunar-muted">
            An admin reviews every access request before an account is created.
          </p>
        </div>
      </section>
    </main>
  );
}
