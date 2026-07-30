import { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  refreshOnce,
  clearSession,
  getMe,
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
} from "../services/api";
import { clearStagedSecret, stageJournalSecret } from "./JournalKeyContext";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authed, setAuthed] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Silent login on boot: the access token is gone from memory after a reload,
  // but the httpOnly refresh cookie survives. Try one /refresh; if it succeeds we
  // have an access token and can load the user. If it 401s, there's no valid
  // session → show login. [authCookieContract.md §Frontend behaviour]
  const loadUser = useCallback(async () => {
    setLoading(true);
    try {
      await refreshOnce();
      const userData = await getMe();
      if (userData) {
        setUser(userData);
        setAuthed(true);
      } else {
        clearSession();
        setAuthed(false);
        setUser(null);
      }
    } catch {
      // No valid cookie / refresh failed — an unauthenticated first load, not an
      // error to surface.
      clearSession();
      setAuthed(false);
      setUser(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (email, password) => {
    // login response carries the user, so no extra /me round-trip needed.
    const data = await apiLogin(email, password);
    // The journal's data key is wrapped under a key derived from this password,
    // and this is the only moment the app has it. Hand it off in memory (single
    // use, 30s leash) so JournalKeyProvider can unwrap on mount; the alternative
    // is asking for the same password again a minute later. Never stored.
    stageJournalSecret(password);
    if (data.user) setUser(data.user);
    setAuthed(true);
    return data;
  };

  const register = async (email, username, password, displayName) => {
    // register auto-logs-in (same shape as login).
    const data = await apiRegister(email, username, password, displayName);
    if (data.user) {
      setUser(data.user);
      setAuthed(true);
    }
    return data;
  };

  const logout = async () => {
    clearStagedSecret();
    await apiLogout();
    setAuthed(false);
    setUser(null);
  };

  const refreshUser = async () => {
    const userData = await getMe();
    if (userData) setUser(userData);
  };

  return (
    <AuthContext.Provider
      value={{
        authed,
        user,
        loading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}