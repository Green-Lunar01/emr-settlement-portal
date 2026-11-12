import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { AppProvider } from "./context/AppProvider";
import { useApp } from "./hooks/useApp";

import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./layouts/DashboardLayout";

import BillingPage from "./pages/BillingPage";
import CashiersPage from "./pages/CashiersPage";
import DailyAccountsPage from "./pages/DailyAccountsPage";
import DashboardPage from "./pages/DashboardPage";
import DepartmentsPage from "./pages/DepartmentsPage";
import EmrPage from "./pages/EmrPage";
import FacilitiesPage from "./pages/FacilitiesPage";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import ServicesPage from "./pages/ServicesPage";
import SignupPage from "./pages/SignupPage";
import StaffPage from "./pages/StaffPage";
import TopUpPage from "./pages/TopUpPage";
import VerifyPage from "./pages/VerifyPage";

import { ROLE_HOME } from "./utils/roles";

function HomeRedirect() {
  const { currentUser, sessionReady } = useApp();

  if (!sessionReady) {
    return <p className="p-8 text-sm text-lunar-muted">Loading…</p>;
  }

  return (
    <Navigate
      to={
        currentUser
          ? ROLE_HOME[currentUser.role]
          : "/"
      }
      replace
    />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route
            path="/"
            element={<LandingPage />}
          />

          <Route
            path="/login"
            element={<LoginPage />}
          />

          <Route
            path="/signup"
            element={<SignupPage />}
          />

          <Route
            path="/verify/:id"
            element={<VerifyPage />}
          />

          {/* Finance portal */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={["finance"]}
              />
            }
          >
            <Route
              path="/finance"
              element={<DashboardLayout />}
            >
              <Route
                index
                element={<DashboardPage />}
              />

              <Route
                path="cashiers"
                element={<CashiersPage />}
              />

              <Route
                path="emr"
                element={<EmrPage />}
              />

              <Route
                path="top-up"
                element={<TopUpPage />}
              />

              <Route
                path="daily-accounts"
                element={<DailyAccountsPage />}
              />
            </Route>
          </Route>

          {/* Facility Manager portal */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={["facility_manager"]}
              />
            }
          >
            <Route
              path="/facility-manager"
              element={<DashboardLayout />}
            >
              <Route
                index
                element={<DashboardPage />}
              />

              <Route
                path="cashiers"
                element={<CashiersPage />}
              />

              <Route
                path="emr"
                element={<EmrPage />}
              />

              <Route
                path="top-up"
                element={<TopUpPage />}
              />

              <Route
                path="daily-accounts"
                element={<DailyAccountsPage />}
              />
            </Route>
          </Route>

          {/* Front Office portal */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={["front_office"]}
              />
            }
          >
            <Route
              path="/front-office"
              element={<DashboardLayout />}
            >
              <Route
                index
                element={<StaffPage />}
              />

              <Route
                path="staff"
                element={<StaffPage />}
              />

              <Route
                path="departments"
                element={<DepartmentsPage />}
              />

              <Route
                path="services"
                element={<ServicesPage />}
              />

              <Route
                path="facilities"
                element={<FacilitiesPage />}
              />
            </Route>
          </Route>

          {/* Service Staff portal */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={["service_staff"]}
              />
            }
          >
            <Route
              path="/service-staff"
              element={<DashboardLayout />}
            >
              <Route
                index
                element={<BillingPage />}
              />
            </Route>
          </Route>

          {/* Cashier portal */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={["cashier"]}
              />
            }
          >
            <Route
              path="/cashier"
              element={<DashboardLayout />}
            >
              <Route
                index
                element={<DashboardPage />}
              />

              <Route
                path="emr"
                element={<EmrPage />}
              />

              <Route
                path="top-up"
                element={<TopUpPage />}
              />

              <Route
                path="daily-accounts"
                element={<DailyAccountsPage />}
              />

              <Route
                path="billing"
                element={<BillingPage />}
              />
            </Route>
          </Route>

          {/* Default and unknown URLs */}
          <Route
            path="*"
            element={<HomeRedirect />}
          />
        </Routes>
      </AppProvider>
    </BrowserRouter>
  );
}