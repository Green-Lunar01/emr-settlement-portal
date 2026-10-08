import { Navigate, Outlet } from "react-router-dom";
import type { UserRole } from "../types";
import { useApp } from "../hooks/useApp";
import { ROLE_HOME } from "../utils/roles";

interface ProtectedRouteProps {
  allowedRoles: UserRole[];
}

export default function ProtectedRoute({
  allowedRoles,
}: ProtectedRouteProps) {
  const { currentUser, sessionReady } = useApp();

  if (!sessionReady) {
    return <p className="p-8 text-sm text-lunar-muted">Loading…</p>;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(currentUser.role)) {
    return (
      <Navigate to={ROLE_HOME[currentUser.role]} replace />
    );
  }

  return <Outlet />;
}