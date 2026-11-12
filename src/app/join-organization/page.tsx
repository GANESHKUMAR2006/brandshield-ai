"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Shield,
  KeyRound,
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  AlertTriangle,
  Loader2,
  UserCheck,
  RefreshCw,
  LogOut,
} from "lucide-react";

interface UserJoinRequest {
  id: string;
  workspaceId: string;
  organizationName: string;
  organizationSlug: string;
  status: "pending" | "approved" | "rejected" | "canceled";
  assignedRole: string | null;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

interface CurrentUser {
  id: string;
  email?: string;
  name?: string;
  emailConfirmed?: boolean;
}

export default function JoinOrganizationPage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [fetchingStatus, setFetchingStatus] = useState(false);
  const [existingRequests, setExistingRequests] = useState<UserJoinRequest[]>([]);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load existing membership requests safely without ever logging out or redirecting the user
  const fetchMyRequests = useCallback(async () => {
    setFetchingStatus(true);
    setRequestsError(null);
    try {
      const res = await fetch("/api/workspaces/join-requests/status", {
        cache: "no-store",
        headers: { Pragma: "no-cache" },
      });

      if (!res.ok) {
        // A failure of this auxiliary listing API must NEVER log out the user or trigger a full page redirect
        if (res.status === 401) {
          setRequestsError("Unable to load prior requests. Your session may need to be refreshed.");
        } else {
          setRequestsError("Unable to load past membership requests at this time.");
        }
        return;
      }

      const data = await res.json();
      if (data.success && Array.isArray(data.requests)) {
        setExistingRequests(data.requests);
      }
    } catch {
      setRequestsError("Unable to connect to service to load past requests.");
    } finally {
      setFetchingStatus(false);
    }
  }, []);

  // Primary authentication check: verify session via /api/auth/user
  useEffect(() => {
    let isMounted = true;

    async function verifyAuthAndInitialize() {
      setAuthChecking(true);
      try {
        const res = await fetch("/api/auth/user", {
          cache: "no-store",
          headers: { Pragma: "no-cache" },
        });
        const data = await res.json();

        if (!isMounted) return;

        if (data.success && data.authenticated && data.user) {
          setCurrentUser(data.user);
          setAuthChecking(false);
          // Once authenticated identity is confirmed, load past requests
          fetchMyRequests();
        } else {
          // Unauthenticated visitor: redirect to login preserving destination target
          router.replace("/login?redirect=/join-organization");
        }
      } catch {
        if (!isMounted) return;
        router.replace("/login?redirect=/join-organization");
      }
    }

    verifyAuthAndInitialize();

    return () => {
      isMounted = false;
    };
  }, [router, fetchMyRequests]);

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!joinCode.trim()) {
      setError("Please enter an organization join code");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/workspaces/join-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinCode: joinCode.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (res.status === 401) {
          throw new Error("Your session has expired. Please sign in again to submit your join request.");
        }
        throw new Error(data.error || "Failed to submit join request");
      }

      setSuccess(data.message || "Join request submitted! An administrator must approve your request.");
      setJoinCode("");
      await fetchMyRequests();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to join organization");
    } finally {
      setLoading(false);
    }
  };

  // 1. Initial Authentication Verification Loading State (prevents layout flashing)
  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#060913] text-slate-100 flex flex-col justify-center items-center py-12 px-4 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col items-center gap-3 text-center relative z-10">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-violet-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/30 animate-pulse">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400 mt-2">
            <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
            <span>Verifying authenticated session...</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Authenticated Join Organization Experience
  return (
    <div className="min-h-screen bg-[#060913] text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-xl relative z-10">
        <div className="flex justify-center items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-violet-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              BrandShield <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 font-semibold">AI</span>
            </h1>
            <p className="text-xs text-slate-400">Claims Governance & Substantiation</p>
          </div>
        </div>
        <h2 className="mt-6 text-center text-2xl font-bold tracking-tight text-white">
          Join an Organization
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          Enter the secure join code provided by your workspace administrator to request access.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl relative z-10 px-4">
        <div className="bg-slate-900/80 backdrop-blur-xl py-8 px-6 shadow-2xl rounded-2xl border border-slate-800/80 sm:px-10">
          {/* Authenticated User Session Chip */}
          {currentUser && (
            <div className="mb-6 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-violet-950/80 border border-violet-700/60 flex items-center justify-center text-violet-300 font-bold text-xs shrink-0">
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Signed in as</div>
                  <div className="text-xs font-semibold text-white truncate">
                    {currentUser.name || currentUser.email}
                  </div>
                  {currentUser.email && (
                    <div className="text-[10px] text-slate-400 font-mono truncate">
                      {currentUser.email}
                    </div>
                  )}
                </div>
              </div>

              <Link
                href="/login?redirect=/join-organization&switched=true"
                className="text-[11px] font-medium text-violet-400 hover:text-violet-300 hover:underline shrink-0 flex items-center gap-1 cursor-pointer"
                title="Sign in with a different corporate account"
              >
                <LogOut className="w-3 h-3" />
                <span>Switch Account</span>
              </Link>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-rose-200">{error}</div>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-emerald-200">{success}</div>
            </div>
          )}

          <form onSubmit={handleJoinSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Organization Join Code
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <KeyRound className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. BS-9X4K2P"
                  className="block w-full pl-10 pr-3 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-white font-mono tracking-widest placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 text-sm uppercase transition-all"
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                Join codes are generated by organization administrators from Settings &rarr; Team & Members.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || !joinCode.trim()}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-violet-500/30 rounded-xl shadow-lg shadow-violet-600/20 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 disabled:opacity-50 transition-all cursor-pointer"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Submitting Request...</span>
                  </span>
                ) : (
                  <>
                    <span>Submit Join Request</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Existing Access Requests Ledger */}
          <div className="mt-8 pt-6 border-t border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Your Membership Requests
              </h3>
              <button
                type="button"
                onClick={fetchMyRequests}
                disabled={fetchingStatus}
                className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
                title="Refresh requests status"
              >
                <RefreshCw className={`w-3 h-3 ${fetchingStatus ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>

            {fetchingStatus ? (
              <div className="py-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
                <span>Checking request status...</span>
              </div>
            ) : requestsError ? (
              <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-300 text-xs flex items-center justify-between">
                <span>{requestsError}</span>
                <button
                  type="button"
                  onClick={fetchMyRequests}
                  className="text-[11px] font-semibold underline hover:text-amber-200 cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : existingRequests.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/60 text-center text-xs text-slate-400">
                You haven&apos;t submitted any join requests yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {existingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-slate-800/60 text-slate-300">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{req.organizationName}</div>
                        <div className="text-[11px] text-slate-400">
                          Submitted on {new Date(req.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      {req.status === "pending" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30">
                          <Clock className="w-3.5 h-3.5 animate-pulse" />
                          Pending Review
                        </span>
                      )}
                      {req.status === "approved" && (
                        <div className="flex flex-col items-end gap-1">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Approved
                          </span>
                          <Link
                            href="/dashboard"
                            className="text-[11px] text-violet-400 hover:text-violet-300 underline font-medium"
                          >
                            Open Workspace &rarr;
                          </Link>
                        </div>
                      )}
                      {req.status === "rejected" && (
                        <div className="flex flex-col items-end">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/30">
                            <XCircle className="w-3.5 h-3.5" />
                            Declined
                          </span>
                          {req.rejectionReason && (
                            <span className="text-[10px] text-slate-400 mt-0.5 max-w-[150px] truncate" title={req.rejectionReason}>
                              {req.rejectionReason}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
            <Link href="/dashboard" className="text-violet-400 hover:underline">
              &larr; Back to Dashboard
            </Link>
            <Link href="/invite" className="text-slate-400 hover:text-slate-200">
              Have an invitation token?
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
