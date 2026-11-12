"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { ReviewerRole } from "@/types";

export interface SessionUser {
  userId: string;
  userName: string;
  userEmail: string;
  role: ReviewerRole | string;
  workspaceId: string;
  workspaceSlug: string;
  isAuthenticated: boolean;
  isDemoFallback: boolean;
}

export interface AuthSessionContextType {
  user: SessionUser | null;
  isLoading: boolean;
  error: string | null;
  refreshSession: () => Promise<SessionUser | null>;
  clearSession: () => void;
}

// Module-level in-flight promise to guarantee that simultaneous fetches
// across any component tree share the exact same HTTP request.
let inFlightSessionPromise: Promise<SessionUser | null> | null = null;

export async function fetchAuthenticatedSession(force: boolean = false): Promise<SessionUser | null> {
  if (!force && inFlightSessionPromise) {
    return inFlightSessionPromise;
  }

  inFlightSessionPromise = fetch("/api/auth/me", { cache: "no-store" })
    .then((res) => {
      if (!res.ok) {
        if (res.status === 401 && typeof window !== "undefined") {
          sessionStorage.removeItem("brandshield_session_profile");
        }
        return null;
      }
      return res.json();
    })
    .then((data) => {
      if (data?.success && data?.user) {
        return data.user as SessionUser;
      }
      return null;
    })
    .catch(() => null)
    .finally(() => {
      inFlightSessionPromise = null;
    });

  return inFlightSessionPromise;
}

const AuthSessionContext = createContext<AuthSessionContextType>({
  user: null,
  isLoading: true,
  error: null,
  refreshSession: async () => null,
  clearSession: () => {},
});

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore cached session profile on mount to eliminate UI layout flash,
  // followed immediately by authoritative server verification.
  useEffect(() => {
    let isMounted = true;

    if (typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem("brandshield_session_profile");
        if (cached) {
          const parsed = JSON.parse(cached);
          const name = parsed.userName || parsed.name || "";
          const email = parsed.userEmail || parsed.email || "";
          if (name || email) {
            setUser({
              userId: parsed.userId || "",
              userName: name || "Reviewer",
              userEmail: email || "",
              role: (parsed.role || "").replace(/ /g, "_").toLowerCase(),
              workspaceId: parsed.workspaceId || "",
              workspaceSlug: parsed.workspaceSlug || "dermaglow",
              isAuthenticated: true,
              isDemoFallback: false,
            });
            setIsLoading(false);
          }
        }
      } catch {
        // Safe fallback
      }
    }

    // Single authoritative session fetch shared across the entire application
    fetchAuthenticatedSession()
      .then((authoritativeUser) => {
        if (!isMounted) return;
        if (authoritativeUser) {
          setUser(authoritativeUser);
          if (typeof window !== "undefined") {
            sessionStorage.setItem(
              "brandshield_session_profile",
              JSON.stringify({
                userId: authoritativeUser.userId,
                name: authoritativeUser.userName,
                userName: authoritativeUser.userName,
                email: authoritativeUser.userEmail,
                userEmail: authoritativeUser.userEmail,
                role: authoritativeUser.role,
                workspaceId: authoritativeUser.workspaceId,
                workspaceSlug: authoritativeUser.workspaceSlug,
              })
            );
          }
        } else {
          setUser(null);
          if (typeof window !== "undefined") {
            sessionStorage.removeItem("brandshield_session_profile");
          }
        }
        setIsLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load session");
        setUser(null);
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const refreshSession = useCallback(async (): Promise<SessionUser | null> => {
    setIsLoading(true);
    try {
      const refreshed = await fetchAuthenticatedSession(true);
      setUser(refreshed);
      if (refreshed && typeof window !== "undefined") {
        sessionStorage.setItem(
          "brandshield_session_profile",
          JSON.stringify({
            userId: refreshed.userId,
            name: refreshed.userName,
            email: refreshed.userEmail,
            role: refreshed.role,
            workspaceId: refreshed.workspaceId,
            workspaceSlug: refreshed.workspaceSlug,
          })
        );
      } else if (!refreshed && typeof window !== "undefined") {
        sessionStorage.removeItem("brandshield_session_profile");
      }
      return refreshed;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Session refresh failed");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearSession = useCallback(() => {
    setUser(null);
    setIsLoading(false);
    setError(null);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("brandshield_session_profile");
      localStorage.removeItem("active_workspace_id");
      localStorage.removeItem("active_workspace_slug");
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      error,
      refreshSession,
      clearSession,
    }),
    [user, isLoading, error, refreshSession, clearSession]
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useSession() {
  return useContext(AuthSessionContext);
}

