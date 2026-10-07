import {
  ArrowLeftRight,
  LayoutDashboard,
  LogOut,
  Moon,
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

 const navigation = [
  {
    label: "Dashboard",
    path: home,
    icon: LayoutDashboard,
    end: true,
  },
  {
    label: "EMR Accounting",
    path: `${home}/emr`,
    icon: ArrowLeftRight,
    end: false,
  },
  {
    label: "Top Up",
    path: `${home}/top-up`,
    icon: Wallet,
    end: false,
  },
  {
  label: "Daily Wallet Accounts",
  path: `${home}/daily-accounts`,
  icon: Wallet,
  end: false,
},
  ...(currentUser.role !== "cashier"
    ? [
        {
          label: "Cashiers",
          path: `${home}/cashiers`,
          icon: Users,
          end: false,
        },
      ]
    : []),
];

  function signOut() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen lg:flex">
      <aside className="flex flex-col bg-lunar-sidebar text-white lg:fixed lg:inset-y-0 lg:left-0 lg:w-64">
        <div className="flex items-center gap-3 px-6 py-7">
          <Moon size={30} className="text-emerald-300" />

          <div>
            <p className="text-2xl font-bold">Lunar</p>
            <p className="text-[10px] tracking-widest text-emerald-200">
              ACCOUNTING SYSTEM
            </p>
          </div>
        </div>

        <div className="mx-4 rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-medium">
            {ROLE_LABELS[currentUser.role]}
          </p>

          <p className="mt-2 text-xs leading-relaxed text-emerald-100">
            {hospitalNames.join(" · ") ||
              "No hospital assigned"}
          </p>
        </div>

        <nav
          aria-label="Workspace navigation"
          className="flex gap-2 overflow-x-auto p-4 lg:flex-col"
        >
          {navigation.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 whitespace-nowrap rounded-lg px-4 py-3 text-sm",
                  isActive
                    ? "bg-white/15 font-semibold text-white"
                    : "text-emerald-100 hover:bg-white/10",
                ].join(" ")
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4 lg:mt-auto">
          <p className="text-sm font-medium">
            {currentUser.name}
          </p>

          <p className="mt-1 break-all text-xs text-emerald-200">
            {currentUser.email}
          </p>

          <button
            type="button"
            onClick={signOut}
            className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-white/10"
          >
            <LogOut size={17} />
            Logout
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 lg:ml-64">
        <header className="flex items-center justify-between gap-4 border-b border-lunar-border bg-white px-6 py-5">
          <p className="text-sm font-medium">
            Hospital accounting workspace
          </p>

          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-lunar-primary">
            {ROLE_LABELS[currentUser.role]}
          </span>
        </header>

        <main className="mx-auto max-w-7xl p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}