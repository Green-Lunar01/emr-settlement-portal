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
  const { currentUser } = useApp();

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