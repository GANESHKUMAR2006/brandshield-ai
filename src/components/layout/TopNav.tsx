"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { SITE_CONFIG } from "@/config/site";
import { BrandShieldLogo } from "@/components/ui/Icons";
import { WorkspaceSwitcher } from "@/components/workspace/WorkspaceSwitcher";
import { HelpTourLauncher } from "@/components/tour/HelpTourLauncher";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  Menu,
  Bell,
  Search,
  Building2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  LogOut,
  User,
  UserCheck,
  Shield,
  ChevronDown,
} from "lucide-react";

interface TopNavProps {
  onOpenMobileMenu: () => void;
}

interface UserSessionInfo {
  name: string;
  email: string;
  role: string;
  initials: string;
  workspaceSlug: string;
}

const DEFAULT_USER_INFO: UserSessionInfo = {
  name: "",
  email: "",
  role: "",
  initials: "",
  workspaceSlug: "",
};

export function TopNav({ onOpenMobileMenu }: TopNavProps) {
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [_isSearchFocused, setIsSearchFocused] = useState(false);
  const [userInfo, setUserInfo] = useState<UserSessionInfo>(DEFAULT_USER_INFO);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Fetch verified user session from server
  useEffect(() => {
    let isMounted = true;

    // Immediately restore cached session profile after client mount (prevents SSR hydration mismatch)
    if (typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem("brandshield_session_profile");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed.name === "string" && parsed.name) {
            setUserInfo({
              name: parsed.name,
              email: parsed.email || "",
              role: parsed.role || "",
              initials: parsed.initials || "U",
              workspaceSlug: parsed.workspaceSlug || "dermaglow",
            });
          }
        }
      } catch {
        // Safe fallback
      }
    }

    fetch("/api/auth/me")
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
        if (!isMounted || !data?.user) return;
        const u = data.user;
        const names = (u.userName || u.userEmail || "Reviewer").split(" ");
        const initials =
          names.length > 1
            ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
            : (u.userName || "R").substring(0, 2).toUpperCase();

        const updated: UserSessionInfo = {
          name: u.userName || "Reviewer",
          email: u.userEmail || "",
          role: u.role ? u.role.replace(/_/g, " ") : "Member",
          initials,
          workspaceSlug: u.workspaceSlug || "dermaglow",
        };

        if (typeof window !== "undefined") {
          sessionStorage.setItem("brandshield_session_profile", JSON.stringify(updated));
        }

        setUserInfo(updated);
      })
      .catch(() => {
        // Fallback safely without exposing incorrect identity
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === "/" || (e.ctrlKey && e.key === "k")) &&
        !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)
      ) {
        e.preventDefault();
        const searchInput = document.getElementById("global-search-input");
        searchInput?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    router.push(`/claims?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  const handleSignOut = async () => {
    try {
      // 1. Client-side Supabase signOut and server-side logout in parallel
      const clientSignOut = (async () => {
        try {
          const supabase = getSupabaseBrowserClient();
          await supabase.auth.signOut();
        } catch {
          // Safe to ignore if browser client is not initialized
        }
      })();

      const serverLogout = fetch("/api/auth/logout", { method: "POST" });

      await Promise.allSettled([clientSignOut, serverLogout]);
    } catch {
      // Proceed with redirection even if network fails
    } finally {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("brandshield_session_profile");
        localStorage.removeItem("active_workspace_id");
        localStorage.removeItem("active_workspace_slug");
      }
      setUserInfo({
        name: "",
        email: "",
        role: "",
        initials: "",
        workspaceSlug: "",
      });
      window.location.href = "/login?signedOut=true&switched=true";
    }
  };

  const handleSwitchAccount = async () => {
    setShowUserMenu(false);
    await handleSignOut();
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 bg-[#0B0F19]/80 backdrop-blur-md border-b border-slate-800/80 text-slate-100">
      {/* Left side: Mobile Toggle & Mobile Logo & Desktop Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 -ml-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors focus:outline-hidden focus:ring-2 focus:ring-violet-500 cursor-pointer"
          aria-label="Open sidebar navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Mobile Logo Brand */}
        <div className="flex lg:hidden items-center gap-2">
          <BrandShieldLogo className="w-6 h-6" />
          <span className="font-bold text-white text-sm tracking-tight">
            {SITE_CONFIG.shortName}
          </span>
        </div>

        {/* Desktop Breadcrumb / Workspace Switcher */}
        <div className="hidden lg:flex items-center gap-2.5 text-xs" data-tour="workspace-indicator">
          <WorkspaceSwitcher
            currentSlug={userInfo.workspaceSlug}
            onWorkspaceChange={(ws) => {
              setUserInfo((prev) => ({
                ...prev,
                workspaceSlug: ws.slug,
              }));
            }}
          />
          <span className="text-slate-600">/</span>
          <span className="text-slate-400 font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
            Evidence-Linked Governance
          </span>
        </div>
      </div>

      {/* Center Search Input */}
      <div className="hidden md:flex flex-1 max-w-md mx-6">
        <form onSubmit={handleSearchSubmit} className="relative w-full">
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              id="global-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              placeholder="Search claims, clinical trials, campaigns..."
              className="w-full pl-9 pr-12 py-1.5 text-xs rounded-xl bg-slate-900/80 border border-slate-700/80 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all shadow-inner"
            />
            <div className="absolute right-2.5 flex items-center gap-1">
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-slate-800 border border-slate-700 rounded shadow-xs">
                /
              </kbd>
            </div>
          </div>
        </form>
      </div>

      {/* Right side: Guided Tour Help, Notifications & User Profile */}
      <div className="flex items-center gap-2.5 sm:gap-3.5">
        {/* Interactive Guided Tour & Walkthroughs Entry */}
        <HelpTourLauncher />

        {/* Notification Bell */}
        <div className="relative" ref={notifRef} data-tour="notifications-bell">
          <button
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors focus:outline-hidden focus:ring-2 focus:ring-violet-500 cursor-pointer"
            aria-label="Notifications"
          >
            <Bell className="w-4.5 h-4.5" />
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
            </span>
          </button>

          {/* Dark Glass Dropdown Popover */}
          {showNotifications && (
            <div
              className="absolute right-0 mt-2 w-80 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-xl shadow-2xl p-3.5 z-50 text-xs"
              role="dialog"
              aria-label="Notifications popover"
            >
              <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-800 font-semibold text-white">
                <span className="flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-violet-400" />
                  Compliance Notifications
                </span>
                <span className="text-[10px] text-violet-300 bg-violet-950/80 border border-violet-800/60 px-1.5 py-0.5 rounded font-medium">
                  3 unread
                </span>
              </div>
              <div className="space-y-2">
                <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-800/40">
                  <div className="flex items-center gap-1.5 text-amber-300 font-semibold text-[11px]">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    <span>Flagged claim in Q3 Radiance Serum</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Discrepancy detected: &ldquo;100% fine lines removed&rdquo; exceeds clinical Dossier DG-CT-2026-08 (88%).
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-800/40">
                  <div className="flex items-center gap-1.5 text-emerald-300 font-semibold text-[11px]">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Dossier Indexed & Grounded</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    DG-CT-2026-08 chunked into pgvector embeddings.
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/60">
                  <div className="flex items-center gap-1.5 text-slate-300 font-semibold text-[11px]">
                    <FileText className="w-3 h-3 text-cyan-400" />
                    <span>Publication Gate Active</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Unverified marketing claims safely blocked from publishing.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Dropdown Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-slate-800 hover:opacity-90 transition-opacity focus:outline-none cursor-pointer"
            aria-label="User profile menu"
          >
            {userInfo.name ? (
              <>
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center text-xs font-bold tracking-wider shadow-[0_0_10px_rgba(139,92,246,0.3)] border border-violet-400/30">
                  {userInfo.initials || "U"}
                </div>
                <div className="hidden md:flex flex-col text-left">
                  <span className="text-xs font-semibold text-white leading-tight">
                    {userInfo.name}
                  </span>
                  <span className="text-[10px] text-slate-400 truncate max-w-[130px] capitalize">
                    {userInfo.role}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 py-0.5">
                <div className="w-8 h-8 rounded-full bg-slate-800/80 animate-pulse border border-slate-700/50" />
                <div className="hidden md:flex flex-col gap-1 text-left">
                  <div className="w-20 h-2.5 bg-slate-800/80 animate-pulse rounded" />
                  <div className="w-14 h-2 bg-slate-800/60 animate-pulse rounded" />
                </div>
              </div>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
          </button>

          {/* User Profile Popover */}
          {showUserMenu && (
            <div
              className="absolute right-0 mt-2 w-64 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-xl shadow-2xl p-3 z-50 text-xs animate-in fade-in zoom-in-95 duration-100"
              role="menu"
            >
              {/* Profile Details */}
              <div className="pb-2.5 mb-2 border-b border-slate-800">
                <p className="font-semibold text-white truncate">{userInfo.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{userInfo.email}</p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-950/80 text-violet-300 border border-violet-800/60 capitalize flex items-center gap-1">
                    <Shield className="w-2.5 h-2.5 text-violet-400" />
                    {userInfo.role}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                    {userInfo.workspaceSlug ? userInfo.workspaceSlug.charAt(0).toUpperCase() + userInfo.workspaceSlug.slice(1) : "Workspace"}
                  </span>
                </div>
              </div>

              {/* Menu Actions */}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    router.push("/settings");
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors text-left cursor-pointer"
                >
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Workspace Settings</span>
                </button>

                <button
                  type="button"
                  onClick={handleSwitchAccount}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors text-left cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Switch Account</span>
                </button>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-300 hover:text-rose-200 hover:bg-rose-950/30 transition-colors text-left cursor-pointer border border-transparent hover:border-rose-900/40"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-400" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
