import type { PublicUser, UserRole } from "@boltbounty/shared";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";

interface AuthState {
  me: PublicUser | null;
  role: UserRole | null;      // shorthand for me?.role
  githubConfigured: boolean;
  loading: boolean;
  setRole: (role: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState>({
  me: null, role: null, githubConfigured: false, loading: true, setRole: async () => {}, signOut: async () => {},
});

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

  const setRole = useCallback(async (role: UserRole) => {
    const me = await api.setRole(role);
    setState((s) => ({ ...s, me }));
  }, []);

  const signOut = useCallback(async () => {
    await api.logout();
    await refresh();
  }, [refresh]);

  return <Ctx.Provider value={{ ...state, role: state.me?.role ?? null, setRole, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
