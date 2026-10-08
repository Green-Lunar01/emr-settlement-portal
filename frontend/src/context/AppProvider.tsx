import { useEffect, useRef, useState } from "react";
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
import { loadAppData, saveAppData } from "../utils/storage";
import { AppContext } from "./AppContext";

interface AppProviderProps {
  children: ReactNode;
}

interface WalletData {
  topUps: AppData["topUps"];
  dailyAccounts: AppData["dailyAccounts"];
  activityLogs: AppData["activityLogs"];
}

function loadWallet(): WalletData {
  try {
    const saved = loadAppData();

    return {
      topUps: saved.topUps,
      dailyAccounts: saved.dailyAccounts,
      activityLogs: saved.activityLogs,
    };
  } catch {
    return {
      topUps: [],
      dailyAccounts: [],
      activityLogs: [],
    };
  }
}

function buildData(
  hospitals: Hospital[],
  users: User[],
  wallet: WalletData,
): AppData {
  return {
    hospitals,
    users,
    emrRecords: [],
    topUps: wallet.topUps,
    dailyAccounts: wallet.dailyAccounts,
    activityLogs: wallet.activityLogs,
  };
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
  const walletRef = useRef(loadWallet());
  const [data, setData] = useState<AppData>(() =>
    buildData([], [], walletRef.current),
  );
  const dataRef = useRef(data);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [emrRecords, setEmrRecords] = useState<ApiEmr[]>([]);
  const [sessionReady, setSessionReady] = useState(false);

  function applyData(next: AppData): void {
    dataRef.current = next;
    setData(next);
  }

  async function loadDirectory(actor: User): Promise<void> {
    const facilityResponse = await apiRequest<{ facilities: ApiFacility[] }>(
      "/api/facilities",
    );
    const hospitals = facilityResponse.facilities.map((facility) => ({
      id: facility.id,
      name: facility.name,
    }));

    let cashiers: User[] = [];

    if (actor.role !== "cashier") {
      const listed = await apiRequest<{ users: ApiUser[] }>("/api/users");
      cashiers = listed.users.map(toLocalUser);
    }

    const emr = await apiRequest<{ records: ApiEmr[] }>("/api/emr");

    setCurrentUser(actor);
    setEmrRecords(emr.records);
    applyData(
      buildData(
        hospitals,
        mergeUsers(actor, cashiers),
        {
          topUps: dataRef.current.topUps,
          dailyAccounts: dataRef.current.dailyAccounts,
          activityLogs: dataRef.current.activityLogs,
        },
      ),
    );
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
    applyData(
      buildData([], [], {
        topUps: dataRef.current.topUps,
        dailyAccounts: dataRef.current.dailyAccounts,
        activityLogs: dataRef.current.activityLogs,
      }),
    );
  }

  function updateData(updater: (current: AppData) => AppData): void {
    const nextData = updater(structuredClone(dataRef.current));
    saveAppData(nextData);
    walletRef.current = {
      topUps: nextData.topUps,
      dailyAccounts: nextData.dailyAccounts,
      activityLogs: nextData.activityLogs,
    };
    applyData(nextData);
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
        updateData,
        refreshDirectory,
        upsertEmr,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
