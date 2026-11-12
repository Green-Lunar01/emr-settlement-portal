import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  apiRequest,
  getToken,
  setToken,
  toLocalUser,
  type ApiEmr,
  type ApiFacility,
  type ApiUser,
} from "../api/client";
import type { AppData, Hospital, User } from "../types";
import { AppContext } from "./AppContext";

interface AppProviderProps {
  children: ReactNode;
}

function buildData(hospitals: Hospital[], users: User[]): AppData {
  return { hospitals, users };
}

function mergeUsers(actor: User, cashiers: User[]): User[] {
  const byId = new Map<string, User>();
  byId.set(actor.id, actor);

  for (const cashier of cashiers) {
    byId.set(cashier.id, cashier);
  }

  return [...byId.values()];
}

export function AppProvider({ children }: AppProviderProps) {
  const [data, setData] = useState<AppData>(() => buildData([], []));
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [emrRecords, setEmrRecords] = useState<ApiEmr[]>([]);
  const [sessionReady, setSessionReady] = useState(false);

  async function loadDirectory(actor: User): Promise<void> {
    const facilityResponse = await apiRequest<{ facilities: ApiFacility[] }>(
      "/api/facilities",
    );
    const hospitals = facilityResponse.facilities.map((facility) => ({
      id: facility.id,
      name: facility.name,
    }));

    let cashiers: User[] = [];
    let records: ApiEmr[] = [];

    // Only roles that actually manage or review a cashier directory/EMR
    // need these — service_staff never does, and the backend 403s if
    // asked, so don't even make the call.
    if (
      actor.role === "finance" ||
      actor.role === "facility_manager" ||
      actor.role === "front_office"
    ) {
      const listed = await apiRequest<{ users: ApiUser[] }>("/api/users");
      cashiers = listed.users.map(toLocalUser);
    }

    if (actor.role !== "front_office" && actor.role !== "service_staff") {
      const emr = await apiRequest<{ records: ApiEmr[] }>("/api/emr");
      records = emr.records;
    }

    setCurrentUser(actor);
    setEmrRecords(records);
    setData(buildData(hospitals, mergeUsers(actor, cashiers)));
  }

  useEffect(() => {
    let cancelled = false;

    async function restore(): Promise<void> {
      if (!getToken()) {
        if (!cancelled) {
          setSessionReady(true);
        }

        return;
      }

      try {
        const me = await apiRequest<{ user: ApiUser }>("/api/auth/me");

        if (!cancelled) {
          await loadDirectory(toLocalUser(me.user));
        }
      } catch {
        setToken(null);
      } finally {
        if (!cancelled) {
          setSessionReady(true);
        }
      }
    }

    void restore();

    return () => {
      cancelled = true;
    };
  }, []);

  async function login(email: string, password: string): Promise<User> {
    const result = await apiRequest<{ token: string; user: ApiUser }>(
      "/api/auth/login",
      {
        method: "POST",
        json: { email, password },
      },
    );

    setToken(result.token);
    const user = toLocalUser(result.user);
    await loadDirectory(user);
    return user;
  }

  function logout(): void {
    void apiRequest("/api/auth/logout", { method: "POST" }).catch(
      () => undefined,
    );
    setToken(null);
    setCurrentUser(null);
    setEmrRecords([]);
    setData(buildData([], []));
  }

  async function refreshDirectory(): Promise<void> {
    if (!currentUser) {
      return;
    }

    await loadDirectory(currentUser);
  }

  function upsertEmr(record: ApiEmr): void {
    setEmrRecords((current) => {
      const without = current.filter((item) => item.id !== record.id);

      return [record, ...without].sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          b.createdAt.localeCompare(a.createdAt),
      );
    });
  }

  return (
    <AppContext.Provider
      value={{
        sessionReady,
        data,
        currentUser,
        emrRecords,
        login,
        logout,
        refreshDirectory,
        upsertEmr,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
