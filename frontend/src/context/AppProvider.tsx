import { useRef, useState } from "react";
import type { ReactNode } from "react";
import type { AppData, User } from "../types";
import { AppContext } from "./AppContext";
import {
  clearSession,
  loadAppData,
  loadSession,
  saveAppData,
  saveSession,
} from "../utils/storage";

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [data, setData] = useState<AppData>(loadAppData);
  const dataRef = useRef(data);

  const [currentUserId, setCurrentUserId] = useState<string | null>(
    loadSession,
  );

  const currentUser =
    data.users.find(
      (user) =>
        user.id === currentUserId && user.status === "active",
    ) ?? null;

  function login(email: string, password: string): User {
    const normalisedEmail = email.trim().toLowerCase();

    const user = dataRef.current.users.find(
      (account) =>
        account.status === "active" &&
        account.email.toLowerCase() === normalisedEmail &&
        account.password === password,
    );

    if (!user) {
      throw new Error("Email or password is incorrect.");
    }

    // Save successfully before changing the visible session.
    saveSession(user.id);
    setCurrentUserId(user.id);

    return user;
  }

  function logout(): void {
    clearSession();
    setCurrentUserId(null);
  }

  function updateData(
    updater: (current: AppData) => AppData,
  ): void {
    const editableCopy = structuredClone(dataRef.current);
    const nextData = updater(editableCopy);

    // If saving fails, keep the current visible data unchanged.
    saveAppData(nextData);

    dataRef.current = nextData;
    setData(nextData);
  }

  return (
    <AppContext.Provider
      value={{
        data,
        currentUser,
        login,
        logout,
        updateData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}