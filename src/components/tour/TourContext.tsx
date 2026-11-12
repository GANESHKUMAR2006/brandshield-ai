"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ReviewerRole } from "@/types";
import { TourStep, UserTourState } from "@/types/tour";
import { ROLE_TOUR_CONFIGS, PAGE_TOURS } from "@/lib/tour/tour-config";

interface ActiveTourSession {
  tourId: string;
  stepIndex: number;
  title: string;
  steps: TourStep[];
}

interface TourContextType {
  isTourActive: boolean;
  isWelcomeOpen: boolean;
  currentStepIndex: number;
  currentStep: TourStep | null;
  totalSteps: number;
  activeTourTitle: string;
  isRouteTransitioning: boolean;
  userRole: ReviewerRole;
  userName: string;
  userEmail: string;
  workspaceSlug: string;
  startRoleTour: (roleOverride?: ReviewerRole) => void;
  startPageTour: (routeOverride?: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  closeTour: () => void;
  closeWelcome: () => void;
  openWelcome: () => void;
  resetAllTours: () => void;
  executeInteractiveAction: (actionId: string) => void;
}

const TourContext = createContext<TourContextType | null>(null);

const STORAGE_PREFIX = "brandshield_tour_state_v1";
const ACTIVE_SESSION_KEY = "brandshield_active_tour_session_v1";

function getStorageKey(userId: string, workspaceSlug: string): string {
  const u = userId || "anonymous";
  const w = workspaceSlug || "default";
  return `${STORAGE_PREFIX}_${u}_${w}`;
}

function saveActiveSession(session: ActiveTourSession | null) {
  if (typeof window === "undefined") return;
  try {
    if (!session) {
      sessionStorage.removeItem(ACTIVE_SESSION_KEY);
    } else {
      sessionStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
    }
  } catch {}
}

function getActiveSession(): ActiveTourSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ACTIVE_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return null;
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // User identity state
  const [userId, setUserId] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [userRole, setUserRole] = useState<ReviewerRole>("viewer");
  const [workspaceSlug, setWorkspaceSlug] = useState<string>("dermaglow");

  // Tour active state
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);
  const [isTourActive, setIsTourActive] = useState(false);
  const [activeTourId, setActiveTourId] = useState<string>("");
  const [activeTourTitle, setActiveTourTitle] = useState<string>("");
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Restore active tour session on client mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check cached session profile first
    try {
      const cachedProfile = sessionStorage.getItem("brandshield_session_profile");
      if (cachedProfile) {
        const parsed = JSON.parse(cachedProfile);
        if (parsed?.name) setUserName(parsed.name);
        if (parsed?.email) setUserEmail(parsed.email);
        const r = (parsed?.role || "").replace(/ /g, "_").toLowerCase();
        if (["admin", "compliance_reviewer", "legal_reviewer", "creator", "viewer"].includes(r)) {
          setUserRole(r as ReviewerRole);
        }
        if (parsed?.workspaceSlug) setWorkspaceSlug(parsed.workspaceSlug);
      }
    } catch {}

    // Restore any active tour session across route transitions/mounts
    const activeSession = getActiveSession();
    if (activeSession) {
      setActiveTourId(activeSession.tourId);
      setActiveTourTitle(activeSession.title);
      setSteps(activeSession.steps);
      setCurrentStepIndex(activeSession.stepIndex || 0);
      setIsTourActive(true);
    }
  }, []);

  // Check first login experience
  const checkFirstLoginExperience = useCallback((uid: string, wSlug: string) => {
    if (typeof window === "undefined") return;
    if (pathname === "/login" || pathname === "/invite") return;
    if (getActiveSession()) return; // Don't pop welcome modal if tour is actively running

    try {
      const storageKey = getStorageKey(uid, wSlug);
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        setIsWelcomeOpen(true);
      } else {
        const parsed: UserTourState = JSON.parse(raw);
        if (!parsed.hasSeenWelcome && !parsed.skipped) {
          setIsWelcomeOpen(true);
        }
      }
    } catch {}
  }, [pathname]);

  // Verify authoritative session from server
  useEffect(() => {
    let isMounted = true;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data?.user) return;
        const u = data.user;
        setUserId(u.userId || "");
        setUserName(u.userName || "Team Member");
        setUserEmail(u.userEmail || "");
        if (u.role && ["admin", "compliance_reviewer", "legal_reviewer", "creator", "viewer"].includes(u.role)) {
          setUserRole(u.role as ReviewerRole);
        }
        if (u.workspaceSlug) setWorkspaceSlug(u.workspaceSlug);

        checkFirstLoginExperience(u.userId || "", u.workspaceSlug || "dermaglow");
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [checkFirstLoginExperience]);

  const saveTourState = useCallback(
    (updates: Partial<UserTourState>) => {
      if (typeof window === "undefined") return;
      try {
        const storageKey = getStorageKey(userId, workspaceSlug);
        const existingRaw = localStorage.getItem(storageKey);
        const existing: UserTourState = existingRaw
          ? JSON.parse(existingRaw)
          : {
              userId,
              workspaceSlug,
              hasSeenWelcome: false,
              completedTours: [],
              skipped: false,
              updatedAt: new Date().toISOString(),
            };

        const merged: UserTourState = {
          ...existing,
          ...updates,
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(storageKey, JSON.stringify(merged));
      } catch {}
    },
    [userId, workspaceSlug]
  );

  // Close welcome screen
  const closeWelcome = useCallback(() => {
    setIsWelcomeOpen(false);
    saveTourState({ hasSeenWelcome: true });
  }, [saveTourState]);

  // Start comprehensive role-aware walkthrough
  const startRoleTour = useCallback(
    (roleOverride?: ReviewerRole) => {
      const targetRole = roleOverride || userRole;
      const roleConfig = ROLE_TOUR_CONFIGS[targetRole] || ROLE_TOUR_CONFIGS.viewer;

      closeWelcome();
      const tourId = `role-${targetRole}`;
      const title = `${roleConfig.roleDisplayName} Walkthrough`;
      setActiveTourId(tourId);
      setActiveTourTitle(title);
      setSteps(roleConfig.steps);
      setCurrentStepIndex(0);
      setIsTourActive(true);

      saveActiveSession({
        tourId,
        title,
        stepIndex: 0,
        steps: roleConfig.steps,
      });

      // Navigate to first step's route if different from current
      const firstStep = roleConfig.steps[0];
      if (firstStep?.pageRoute && pathname !== firstStep.pageRoute) {
        router.push(firstStep.pageRoute);
      }
    },
    [userRole, closeWelcome, pathname, router]
  );

  // Start page-specific walkthrough
  const startPageTour = useCallback(
    (routeOverride?: string) => {
      const targetRoute = routeOverride || pathname || "/dashboard";
      const pageConfig = PAGE_TOURS[targetRoute] || PAGE_TOURS["/dashboard"];

      closeWelcome();
      const tourId = `page-${targetRoute}`;
      const title = pageConfig.pageTitle;
      setActiveTourId(tourId);
      setActiveTourTitle(title);
      setSteps(pageConfig.steps);
      setCurrentStepIndex(0);
      setIsTourActive(true);

      saveActiveSession({
        tourId,
        title,
        stepIndex: 0,
        steps: pageConfig.steps,
      });
    },
    [pathname, closeWelcome]
  );

  // Close tour
  const closeTour = useCallback(() => {
    setIsTourActive(false);
    setSteps([]);
    setCurrentStepIndex(0);
    saveActiveSession(null);
  }, []);

  // Skip tour
  const skipTour = useCallback(() => {
    closeTour();
    saveTourState({ skipped: true });
  }, [closeTour, saveTourState]);

  // Complete tour
  const completeTour = useCallback(() => {
    const tourId = activeTourId;
    closeTour();
    if (typeof window !== "undefined") {
      try {
        const storageKey = getStorageKey(userId, workspaceSlug);
        const existingRaw = localStorage.getItem(storageKey);
        const existing: UserTourState = existingRaw
          ? JSON.parse(existingRaw)
          : {
              userId,
              workspaceSlug,
              hasSeenWelcome: true,
              completedTours: [],
              skipped: false,
              updatedAt: new Date().toISOString(),
            };
        if (!existing.completedTours.includes(tourId)) {
          existing.completedTours.push(tourId);
        }
        existing.hasSeenWelcome = true;
        existing.updatedAt = new Date().toISOString();
        localStorage.setItem(storageKey, JSON.stringify(existing));
      } catch {}
    }
  }, [activeTourId, closeTour, userId, workspaceSlug]);

  // Next step navigation with cross-page support
  const nextStep = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      const nextIndex = currentStepIndex + 1;
      const targetStep = steps[nextIndex];

      setCurrentStepIndex(nextIndex);
      saveActiveSession({
        tourId: activeTourId,
        title: activeTourTitle,
        stepIndex: nextIndex,
        steps,
      });

      if (targetStep.pageRoute && pathname !== targetStep.pageRoute) {
        router.push(targetStep.pageRoute);
      }
    } else {
      // Finished all steps
      completeTour();
    }
  }, [currentStepIndex, steps, pathname, router, completeTour, activeTourId, activeTourTitle]);

  // Prev step navigation with cross-page support
  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      const prevIndex = currentStepIndex - 1;
      const targetStep = steps[prevIndex];

      setCurrentStepIndex(prevIndex);
      saveActiveSession({
        tourId: activeTourId,
        title: activeTourTitle,
        stepIndex: prevIndex,
        steps,
      });

      if (targetStep.pageRoute && pathname !== targetStep.pageRoute) {
        router.push(targetStep.pageRoute);
      }
    }
  }, [currentStepIndex, steps, pathname, router, activeTourId, activeTourTitle]);

  // Reset all tour states (allows testing and re-playing)
  const resetAllTours = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        const storageKey = getStorageKey(userId, workspaceSlug);
        localStorage.removeItem(storageKey);
      } catch {}
    }
    closeTour();
    setIsWelcomeOpen(true);
  }, [userId, workspaceSlug, closeTour]);

  // Execute interactive try-it action safely
  const executeInteractiveAction = useCallback((actionId: string) => {
    if (actionId === "open-submission-modal") {
      const checkBtn = document.querySelector('[data-tour="check-content-btn"]') as HTMLButtonElement | null;
      const createBtn = document.querySelector('[data-tour="create-submission-btn"]') as HTMLButtonElement | null;
      if (checkBtn) checkBtn.click();
      else if (createBtn) createBtn.click();
    }
  }, []);

  const currentStep = useMemo(() => steps[currentStepIndex] || null, [steps, currentStepIndex]);
  const isRouteTransitioning = useMemo(() => {
    if (!currentStep?.pageRoute) return false;
    return currentStep.pageRoute !== pathname;
  }, [currentStep, pathname]);

  return (
    <TourContext.Provider
      value={{
        isTourActive,
        isWelcomeOpen,
        currentStepIndex,
        currentStep,
        totalSteps: steps.length,
        activeTourTitle,
        isRouteTransitioning,
        userRole,
        userName,
        userEmail,
        workspaceSlug,
        startRoleTour,
        startPageTour,
        nextStep,
        prevStep,
        skipTour,
        closeTour,
        closeWelcome,
        openWelcome: () => setIsWelcomeOpen(true),
        resetAllTours,
        executeInteractiveAction,
      }}
    >
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error("useTour must be used within a TourProvider");
  }
  return context;
}
