import { createContext } from "react";
import type { AppData, User } from "../types";

export interface AppContextValue {
  data: AppData;
  currentUser: User | null;

  login: (email: string, password: string) => User;
  logout: () => void;

  updateData: (updater: (current: AppData) => AppData) => void;
}

export const AppContext = createContext<AppContextValue | undefined>(
  undefined,
);