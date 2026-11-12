import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  ArrowLeftRight,
  ArrowRight,
  Building2,
  CheckCircle2,
  Mail,
  MapPin,
  Menu,
  Moon,
  Phone,
  Receipt,
  ShieldCheck,
  UserCheck,
  Wallet,
  X,
} from "lucide-react";

import { useApp } from "../hooks/useApp";
import { ROLE_HOME } from "../utils/roles";

const NAV_LINKS = [
  { href: "#home", label: "Home" },
  { href: "#about", label: "About" },
  { href: "#services", label: "Our Services" },
  { href: "#contact", label: "Contact Us" },
];

const SERVICES = [
  {
    icon: ArrowLeftRight,
    title: "EMR Reconciliation",
    description:
      "Cashiers enter daily transaction figures, the server compares them against TAP, and Facility Manager and Finance review and sign off — with every correction tracked.",
  },
  {
    icon: Wallet,
    title: "Wallet & Daily Accounts",
    description:
      "Top-ups, cash collection, bank transfers and card payments reconciled every day, with the carried-forward balance and reviewer sign-off calculated automatically.",
  },
  {
    icon: Receipt,
    title: "Billing & Patients",
    description:
      "Patients are registered once and billed from a priced catalog at the cashier or any service point, with Transfer/POS/Cash payment and emailed, QR-verified receipts.",
  },
  {
    icon: UserCheck,
    title: "Platform Administration",
    description:
      "An admin approves every account request, manages facilities and departments, and keeps a full, platform-wide audit trail — without touching financial approvals.",
  },
];

const CURRENT_YEAR = new Date().getFullYear();

const PRINCIPLES = [
  {
    icon: ShieldCheck,
    title: "Separation of duties",
    description:
      "The person who enters a figure is never the person who approves it. Every workflow enforces this on the server, not just in the UI.",
  },
  {
    icon: CheckCircle2,
    title: "Nothing clears twice",
    description:
      "Whether a bill is raised at the cashier desk or a service point, it can only ever be cleared once — the record's own status is the guard, not who raised it.",
  },
  {
    icon: Building2,
    title: "Built for real facilities",
    description:
      "Multiple facilities, departments and roles, each scoped correctly — a service-point staffer only ever sees their own department's work.",
  },
];

export default function LandingPage() {
  const { currentUser, sessionReady } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);

  if (sessionReady && currentUser) {
    return <Navigate to={ROLE_HOME[currentUser.role]} replace />;
  }

  return (
    <div className="min-h-screen bg-white text-lunar-text">
      <header className="sticky top-0 z-40 border-b border-lunar-border bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <a href="#home" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-lunar-primary to-lunar-accent shadow-raised">
              <Moon size={18} className="text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">Lunar</span>
          </a>

          <nav className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-lunar-muted hover:text-lunar-text"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              to="/signup"
              className="text-sm font-medium text-lunar-muted hover:text-lunar-text"
            >
              Request access
            </Link>
            <Link
              to="/login"
              className="rounded-xl bg-lunar-primary px-4 py-2.5 text-sm font-medium text-white shadow-raised hover:bg-lunar-primary-dark"
            >
              Sign in
            </Link>
          </div>

          <button
            type="button"
            aria-label="Toggle menu"
            onClick={() => setMenuOpen((open) => !open)}
            className="text-lunar-text md:hidden"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-lunar-border bg-white px-6 py-4 md:hidden">
            <nav className="flex flex-col gap-4">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="text-sm font-medium text-lunar-muted"
                >
                  {link.label}
                </a>
              ))}
              <Link
                to="/signup"
                onClick={() => setMenuOpen(false)}
                className="text-sm font-medium text-lunar-muted"
              >
                Request access
              </Link>
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="rounded-xl bg-lunar-primary px-4 py-2.5 text-center text-sm font-medium text-white shadow-raised"
              >
                Sign in
              </Link>
            </nav>
          </div>
        )}
      </header>

      <main>
        <section
          id="home"
          className="relative scroll-mt-20 overflow-hidden bg-lunar-sidebar text-white"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(circle at 15% 20%, rgba(45,212,191,0.25), transparent 45%), radial-gradient(circle at 85% 80%, rgba(15,157,120,0.3), transparent 50%)",
            }}
          />

          <div className="relative mx-auto max-w-7xl px-6 py-24 lg:py-32">
            <div className="mx-auto max-w-3xl text-center">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-emerald-200">
                <ShieldCheck size={14} />
                Hospital Revenue Assurance Platform
              </p>

              <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Every bill accounted for.
                <br />
                Every record reviewed.
              </h1>

              <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/70">
                Lunar digitizes how hospitals collect and reconcile revenue —
                EMR vs TAP, wallets, and patient billing — with
                separation-of-duties built into every workflow.
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  to="/login"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-lunar-primary px-6 py-3.5 text-sm font-semibold text-white shadow-raised hover:bg-lunar-primary-dark sm:w-auto"
                >
                  Sign in
                  <ArrowRight size={18} />
                </Link>
                <a
                  href="#services"
                  className="w-full rounded-xl border border-white/20 px-6 py-3.5 text-center text-sm font-semibold text-white hover:bg-white/10 sm:w-auto"
                >
                  Explore the platform
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="scroll-mt-20 bg-white py-24">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-lunar-primary">
                  About Lunar
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                  A controlled way to collect hospital revenue
                </h2>
                <p className="mt-5 leading-relaxed text-lunar-muted">
                  Many hospitals collect money without a full EMR system —
                  and without one, there's no structured way to reconcile
                  what came in, who approved it, or whether a bill was
                  cleared twice. Lunar exists to close that gap: a focused
                  revenue-assurance layer that any facility can run
                  alongside its existing operations.
                </p>
                <p className="mt-4 leading-relaxed text-lunar-muted">
                  Every workflow — EMR, wallets, billing — follows the same
                  rule: the person entering a figure is never the one who
                  approves it, and the server enforces that, not just the
                  screen in front of you.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-1">
                {PRINCIPLES.map((principle) => (
                  <div
                    key={principle.title}
                    className="flex gap-4 rounded-2xl border border-lunar-border bg-white p-5 shadow-card"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-lunar-primary-light text-lunar-primary-dark">
                      <principle.icon size={20} />
                    </div>
                    <div>
                      <p className="font-semibold">{principle.title}</p>
                      <p className="mt-1 text-sm text-lunar-muted">
                        {principle.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          id="services"
          className="scroll-mt-20 bg-lunar-background py-24"
        >
          <div className="mx-auto max-w-7xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-lunar-primary">
                Our Services
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Four modules, one platform
              </h2>
              <p className="mt-5 leading-relaxed text-lunar-muted">
                Each module stands on its own, and together they give a
                facility a complete, auditable picture of its revenue.
              </p>
            </div>

            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {SERVICES.map((service) => (
                <div
                  key={service.title}
                  className="rounded-2xl border border-lunar-border bg-white p-6 shadow-card transition-shadow hover:shadow-raised"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-lunar-primary to-lunar-accent text-white shadow-raised">
                    <service.icon size={22} />
                  </div>
                  <p className="mt-5 font-semibold">{service.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-lunar-muted">
                    {service.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="scroll-mt-20 bg-white py-24">
          <div className="mx-auto max-w-7xl px-6">
            <div className="overflow-hidden rounded-3xl bg-lunar-sidebar">
              <div className="grid gap-10 p-10 lg:grid-cols-2 lg:p-16">
                <div className="text-white">
                  <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">
                    Contact Us
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                    Bring Lunar to your facility
                  </h2>
                  <p className="mt-5 max-w-md leading-relaxed text-white/70">
                    Reach out to set up a facility, ask about onboarding, or
                    get support with an existing deployment.
                  </p>
                </div>

                <div className="space-y-4">
                  <a
                    href="mailto:hello@lunar.app"
                    className="flex items-center gap-4 rounded-2xl bg-white/5 p-5 hover:bg-white/10"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-emerald-300">
                      <Mail size={20} />
                    </div>
                    <div>
                      <p className="text-xs text-white/50">Email</p>
                      <p className="font-medium text-white">hello@lunar.app</p>
                    </div>
                  </a>

                  <a
                    href="tel:+2348000000000"
                    className="flex items-center gap-4 rounded-2xl bg-white/5 p-5 hover:bg-white/10"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-emerald-300">
                      <Phone size={20} />
                    </div>
                    <div>
                      <p className="text-xs text-white/50">Phone</p>
                      <p className="font-medium text-white">+234 800 000 0000</p>
                    </div>
                  </a>

                  <div className="flex items-center gap-4 rounded-2xl bg-white/5 p-5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-emerald-300">
                      <MapPin size={20} />
                    </div>
                    <div>
                      <p className="text-xs text-white/50">Location</p>
                      <p className="font-medium text-white">Lagos, Nigeria</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-lunar-border bg-white py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-lunar-primary to-lunar-accent">
              <Moon size={15} className="text-white" />
            </div>
            <span className="text-sm font-semibold">Lunar</span>
          </div>
          <p className="text-xs text-lunar-muted">
            © {CURRENT_YEAR} Lunar. Hospital Revenue Assurance Platform.
          </p>
        </div>
      </footer>
    </div>
  );
}
