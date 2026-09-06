import React, { createContext, useContext, useEffect, useState } from "react";
import { api, setToken, clearToken, getToken } from "@/src/api";

export type User = { id: string; email: string; name: string; role: string };

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role: string, accessCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
};

const AuthContext = createContext<AuthState>({} as AuthState);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (token) {
        try {
          const res = await api.get("/auth/me");
          setUser(res.user);
        } catch {
          await clearToken();
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    await setToken(res.token);
    setUser(res.user);
  };

  const register = async (email: string, password: string, name: string, role: string, accessCode?: string) => {
    const res = await api.post("/auth/register", { email, password, name, role, access_code: accessCode ?? "" });
    await setToken(res.token);
    setUser(res.user);
  };

  const logout = async () => {
    await clearToken();
    setUser(null);
  };

  const forgotPassword = async (email: string) => {
    await api.post("/auth/forgot-password", { email });
  };

  const resetPassword = async (email: string, code: string, newPassword: string) => {
    const res = await api.post("/auth/reset-password", { email, code, new_password: newPassword });
    await setToken(res.token);
    setUser(res.user);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, forgotPassword, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
