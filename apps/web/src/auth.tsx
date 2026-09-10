import type { PublicUser } from "@boltbounty/shared";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";

interface AuthState {
  me: PublicUser | null;
  githubConfigured: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState>({ me: null, githubConfigured: false, loading: true, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState({ me: null as PublicUser | null, githubConfigured: false, loading: true });

  const refresh = useCallback(async () => {
    try {
      const r = await api.me();
      setState({ me: r.user, githubConfigured: r.githubConfigured, loading: false });
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await api.logout();
    await refresh();
  }, [refresh]);

  return <Ctx.Provider value={{ ...state, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
