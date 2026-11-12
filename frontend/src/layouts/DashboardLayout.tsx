import {
  ArrowLeftRight,
  Building2,
  LayoutDashboard,
  LogOut,
  Moon,
  Pill,
  Receipt,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import {
  NavLink,
  Outlet,
  useNavigate,
} from "react-router-dom";
import { useApp } from "../hooks/useApp";
import { ROLE_HOME, ROLE_LABELS } from "../utils/roles";

interface NavItem {
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
  end: boolean;
}

export default function DashboardLayout() {
  const { currentUser, data, logout } = useApp();
  const navigate = useNavigate();

  if (!currentUser) {
    return null;
  }

  const home = ROLE_HOME[currentUser.role];

  const hospitalNames = data.hospitals
    .filter((hospital) =>
      currentUser.hospitalIds.includes(hospital.id),
    )
    .map((hospital) => hospital.name);

  let navigation: NavItem[];

  if (currentUser.role === "front_office") {
    navigation = [
      { label: "Staff", path: home, icon: UserCheck, end: true },
      { label: "Departments", path: `${home}/departments`, icon: Building2, end: false },
      { label: "Drugs & Services", path: `${home}/services`, icon: Pill, end: false },
      { label: "Facilities", path: `${home}/facilities`, icon: Building2, end: false },
    ];
  } else if (currentUser.role === "service_staff") {
    navigation = [
      { label: "Billing", path: home, icon: Receipt, end: true },
    ];
  } else {
    navigation = [
      { label: "Dashboard", path: home, icon: LayoutDashboard, end: true },
      { label: "EMR Accounting", path: `${home}/emr`, icon: ArrowLeftRight, end: false },
      ...(currentUser.role === "cashier"
        ? [{ label: "Billing", path: `${home}/billing`, icon: Receipt, end: false }]
        : []),
      { label: "Top Up", path: `${home}/top-up`, icon: Wallet, end: false },
      { label: "Daily Wallet Accounts", path: `${home}/daily-accounts`, icon: Wallet, end: false },
      ...(currentUser.role !== "cashier"
        ? [{ label: "Cashiers", path: `${home}/cashiers`, icon: Users, end: false }]
        : []),
    ];
  }

  function signOut() {
    logout();
    navigate("/login", { replace: true });
  }

  const initials = currentUser.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen lg:flex">
      <aside className="flex flex-col bg-lunar-sidebar text-white lg:fixed lg:inset-y-0 lg:left-0 lg:w-72">
        <div className="flex items-center gap-3 px-6 py-7">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-lunar-primary to-lunar-accent shadow-raised">
            <Moon size={20} className="text-white" />
          </div>

          <div>
            <p className="text-xl font-bold leading-tight">Lunar</p>
            <p className="text-[10px] font-medium tracking-widest text-white/50">
              REVENUE PLATFORM
            </p>
          </div>
        </div>

        <div className="mx-4 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lunar-primary/30 text-xs font-semibold text-emerald-200">
              {initials || "?"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{currentUser.name}</p>
              <p className="text-xs text-white/50">{ROLE_LABELS[currentUser.role]}</p>
            </div>
          </div>

          <p className="mt-3 truncate text-xs leading-relaxed text-white/40">
            {hospitalNames.join(" · ") || "No facility assigned"}
          </p>
        </div>

        <nav
          aria-label="Workspace navigation"
          className="mt-2 flex gap-1 overflow-x-auto px-3 py-4 lg:flex-col"
        >
          {navigation.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-lunar-primary text-white shadow-sm"
                    : "text-white/60 hover:bg-white/10 hover:text-white",
                ].join(" ")
              }
            >
              <item.icon size={17} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t border-white/10 p-4">
          <p className="truncate text-xs text-white/40">{currentUser.email}</p>

          <button
            type="button"
            onClick={signOut}
            className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 lg:ml-72">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-lunar-border bg-white/80 px-6 py-4 backdrop-blur-sm">
          <p className="text-sm font-semibold text-lunar-text">
            {ROLE_LABELS[currentUser.role]} workspace
          </p>

          <span className="rounded-full bg-lunar-primary-light px-3 py-1 text-xs font-medium text-lunar-primary-dark">
            {hospitalNames[0] ?? "No facility"}
          </span>
        </header>

        <main className="mx-auto max-w-7xl p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
