import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../services/api";
import { User } from "../types";

type AuthState = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pathname.startsWith("/app") && !user) {
      setLoading(true);
      void refreshUser();
    } else {
      setLoading(false);
    }
  }, [pathname, user?.id]);

  const value: AuthState = {
    user,
    loading,
    refreshUser,
    signIn: async (email, password) => {
      const { data } = await api.post("/auth/login", { email, password });
      setUser(data.user);
    },
    signUp: async (name, email, password) => {
      const { data } = await api.post("/auth/register", { name, email, password });
      setUser(data.user);
    },
    signOut: async () => {
      await api.post("/auth/logout");
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
