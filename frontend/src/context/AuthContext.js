import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../lib/api";

const AuthContext = createContext(null);

const safeParse = (value) => {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

const readStoredAuth = () => {
  const storedToken = localStorage.getItem("token");
  const storedRefreshToken = localStorage.getItem("refreshToken");
  const storedUser = localStorage.getItem("user");

  return {
    token: storedToken || null,
    refreshToken: storedRefreshToken || null,
    user: safeParse(storedUser),
  };
};

export const AuthProvider = ({ children }) => {
  const [{ token, refreshToken, user }, setAuth] = useState(readStoredAuth());
  const [ready, setReady] = useState(false);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    setAuth({ token: null, refreshToken: null, user: null });
  };

  const login = (payload) => {
    const nextToken = payload?.token || null;
    const nextRefreshToken = payload?.refreshToken || null;
    const nextUser = payload?.user || null;

    if (nextToken) localStorage.setItem("token", nextToken);
    if (nextRefreshToken) localStorage.setItem("refreshToken", nextRefreshToken);
    if (nextUser) localStorage.setItem("user", JSON.stringify(nextUser));

    setAuth({ token: nextToken, refreshToken: nextRefreshToken, user: nextUser });
  };

  useEffect(() => {
    const syncSession = async () => {
      try {
        const storedToken = localStorage.getItem("token");
        const storedRefreshToken = localStorage.getItem("refreshToken");
        const storedUser = localStorage.getItem("user");

        if (!storedToken && !storedRefreshToken) {
          setReady(true);
          return;
        }

        const parsedUser = safeParse(storedUser);
        if (parsedUser) {
          setAuth({ token: storedToken, refreshToken: storedRefreshToken, user: parsedUser });
        }

        const res = await api.get("/api/auth/me");
        if (res.data?.user) {
          localStorage.setItem("user", JSON.stringify(res.data.user));
          setAuth({
            token: storedToken,
            refreshToken: storedRefreshToken,
            user: res.data.user,
          });
        }
      } catch (error) {
        logout();
      } finally {
        setReady(true);
      }
    };

    syncSession();
  }, []);

  useEffect(() => {
    const handleLogoutEvent = () => logout();
    window.addEventListener("auth:logout", handleLogoutEvent);
    return () => window.removeEventListener("auth:logout", handleLogoutEvent);
  }, []);

  const value = useMemo(
    () => ({
      token,
      refreshToken,
      user,
      ready,
      isAuthenticated: Boolean(token && user),
      login,
      logout,
    }),
    [token, refreshToken, user, ready]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
