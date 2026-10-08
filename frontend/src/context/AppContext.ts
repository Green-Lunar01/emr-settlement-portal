import { createContext } from "react";
import type { ApiEmr } from "../api/client";
import type { AppData, User } from "../types";

export interface AppContextValue {
  sessionReady: boolean;
  data: AppData;
  currentUser: User | null;
  emrRecords: ApiEmr[];

  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  updateData: (updater: (current: AppData) => AppData) => void;
  refreshDirectory: () => Promise<void>;
  upsertEmr: (record: ApiEmr) => void;
}

export const AppContext = createContext<AppContextValue | undefined>(
  undefined,
);
