"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  Shield,
  Building2,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  UserCheck,
  Lock,
  LogOut,
  UserPlus,
  LogIn,
  AlertCircle,
  Mail,
} from "lucide-react";

interface InvitationPreview {
  id: string;
  organizationName: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  isExpired: boolean;
}

interface CurrentUser {
  id: string;
  email: string;
  name: string;
  emailConfirmed?: boolean;
}

function InviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";

  const [invitation, setInvitation] = useState<InvitationPreview | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [manualToken, setManualToken] = useState(token);

  const activeToken = (token || manualToken).trim();

  // Load current user session
  const checkAuth = async () => {
    try {
      const res = await fetch("/api/auth/user");
      const data = await res.json();
      if (data.success && data.authenticated && data.user) {
        setCurrentUser(data.user);
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    } finally {
      setAuthChecked(true);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (token) {
      verifyToken(token);
    } else {
      setLoading(false);
    }
  }, [token]);

  const verifyToken = async (tok: string) => {
    if (!tok.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/invitations/verify?token=${encodeURIComponent(tok.trim())}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Invalid invitation token.");
      }
      setInvitation(data.invitation);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to verify invitation");
      setInvitation(null);
    } finally {
      setLoading(false);
    }
  };

  // Safe Sign-Out & Account Switch
  const handleSwitchAccount = async (targetAction: "login" | "register") => {
    setSwitching(true);
    setError(null);
    try {
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
      setCurrentUser(null);

      if (typeof window !== "undefined") {
        sessionStorage.removeItem("brandshield_session_profile");
        localStorage.removeItem("active_workspace_id");
        localStorage.removeItem("active_workspace_slug");
      }

      const targetEmail = invitation?.email || "";
      if (targetAction === "register") {
        window.location.href = `/register?email=${encodeURIComponent(targetEmail)}&token=${encodeURIComponent(activeToken)}`;
      } else {
        window.location.href = `/login?redirect=${encodeURIComponent(`/invite?token=${activeToken}`)}&email=${encodeURIComponent(targetEmail)}&signedOut=true`;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to sign out");
      setSwitching(false);
    }
  };

  const handleAccept = async () => {
    if (!activeToken) return;

    // Check if user is signed in
    if (!currentUser) {
      const targetEmail = invitation?.email || "";
      router.push(
        `/login?redirect=${encodeURIComponent(`/invite?token=${activeToken}`)}&email=${encodeURIComponent(targetEmail)}`
      );
      return;
    }

    // Client-side check before API call
    if (invitation) {
      const normalizedUserEmail = currentUser.email.toLowerCase().trim();
      const normalizedInviteEmail = invitation.email.toLowerCase().trim();
      if (normalizedUserEmail !== normalizedInviteEmail) {
        setError(
          `This invitation was issued to ${invitation.email}. You are currently signed in as ${currentUser.email}. Please switch accounts to accept.`
        );
        return;
      }
    }

    setAccepting(true);
    setError(null);
    try {
      const res = await fetch("/api/workspaces/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: activeToken }),
      });

      const data = await res.json();

      if (res.status === 401) {
        // Redirect to login preserving the invite token
        router.push(
          `/login?redirect=${encodeURIComponent(`/invite?token=${activeToken}`)}&email=${encodeURIComponent(invitation?.email || "")}`
        );
        return;
      }

      if (res.status === 403 && data.mismatch) {
        setError(data.error);
        return;
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to accept invitation");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to accept invitation");
    } finally {
      setAccepting(false);
    }
  };

  // Evaluate matching status
  const normalizedUserEmail = currentUser?.email ? currentUser.email.toLowerCase().trim() : "";
  const normalizedInviteEmail = invitation?.email ? invitation.email.toLowerCase().trim() : "";
  const isEmailMatch = currentUser && invitation && normalizedUserEmail === normalizedInviteEmail;
  const isEmailMismatch = currentUser && invitation && normalizedUserEmail !== normalizedInviteEmail;

  return (
    <div className="min-h-screen bg-[#060913] text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
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
          Workspace Invitation
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        <div className="bg-slate-900/80 backdrop-blur-xl py-8 px-6 shadow-2xl rounded-2xl border border-slate-800/80 sm:px-10">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-rose-200">{error}</div>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-emerald-200">
                Invitation accepted! Welcome to your new workspace. Redirecting to dashboard...
              </div>
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
              <div className="w-8 h-8 border-2 border-violet-500/20 border-t-violet-500 rounded-full animate-spin mb-3" />
              <p className="text-sm">Verifying invitation token...</p>
            </div>
          ) : invitation ? (
            <div className="space-y-6">
              {/* Organization and Role Details */}
              <div className="p-4 rounded-xl bg-violet-950/20 border border-violet-500/30">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-violet-500/20 text-violet-300">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{invitation.organizationName}</h3>
                    <p className="text-xs text-slate-400">Organization Workspace</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs border-t border-slate-800 pt-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Recipient Email:</span>
                    <span className="font-medium text-slate-200">{invitation.email}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Assigned Role:</span>
                    <span className="px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30 font-semibold uppercase tracking-wider text-[10px]">
                      {invitation.role.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Valid Until:</span>
                    <span className="text-slate-300">{new Date(invitation.expiresAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Status Checks: Expired or Revoked or Accepted */}
              {invitation.isExpired || invitation.status === "expired" ? (
                <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs">
                  This invitation link has expired. Please contact your organization administrator to request a new invitation.
                </div>
              ) : invitation.status === "accepted" ? (
                <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-500/30 text-blue-200 text-xs">
                  This invitation has already been accepted. You can log in directly to access the workspace.
                </div>
              ) : invitation.status === "revoked" ? (
                <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs">
                  This invitation has been revoked by an administrator. Please contact your organization for a new link.
                </div>
              ) : isEmailMismatch ? (
                /* WRONG SESSION DETECTED: Authenticated user email does not match invitation email */
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 space-y-3">
                    <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs uppercase tracking-wide">
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                      <span>Account Mismatch Detected</span>
                    </div>
                    <div className="text-xs text-slate-300 space-y-1.5">
                      <p>
                        This invitation is specifically addressed to:
                        <span className="font-semibold text-white block mt-0.5">{invitation.email}</span>
                      </p>
                      <p>
                        You are currently signed in as:
                        <span className="font-semibold text-amber-200 block mt-0.5">{currentUser.email}</span>
                      </p>
                    </div>
                    <p className="text-[11px] text-slate-400 border-t border-amber-500/20 pt-2">
                      To protect workspace privacy and compliance, invitations can only be accepted by the intended recipient.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => handleSwitchAccount("login")}
                      disabled={switching}
                      className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 text-slate-400" />
                      <span>Sign Out & Switch to {invitation.email}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSwitchAccount("register")}
                      disabled={switching}
                      className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-violet-300 bg-violet-950/40 hover:bg-violet-900/50 border border-violet-500/30 transition-all cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-violet-400" />
                      <span>Register Account for {invitation.email}</span>
                    </button>
                  </div>

                  <button
                    disabled
                    className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-slate-500 bg-slate-900 border border-slate-800 cursor-not-allowed opacity-60"
                  >
                    Accept Blocked (Wrong Account)
                  </button>
                </div>
              ) : currentUser && isEmailMatch && currentUser.emailConfirmed === false ? (
                /* UNCONFIRMED EMAIL: Prompt user to verify before accepting */
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-amber-300 font-semibold">
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                      <span>Email Confirmation Required</span>
                    </div>
                    <p className="text-slate-300">
                      A verification email was dispatched to <span className="text-white font-medium">{currentUser.email}</span>. Please click the confirmation link in your email to activate your account before accepting.
                    </p>
                    <p className="text-[11px] text-slate-400 pt-1 border-t border-amber-500/20">
                      Once confirmed, refresh this page to complete workspace joining.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      checkAuth();
                      if (activeToken) verifyToken(activeToken);
                    }}
                    className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
                  >
                    Refresh Verification Status
                  </button>
                </div>
              ) : currentUser && isEmailMatch ? (
                /* MATCHING ACTIVE SESSION: Ready to accept */
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-emerald-300">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <span>Signed in as verified recipient</span>
                    </div>
                    <span className="font-semibold text-slate-200">{currentUser.email}</span>
                  </div>

                  <button
                    onClick={handleAccept}
                    disabled={accepting || success}
                    className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-violet-500/30 rounded-xl shadow-lg shadow-violet-600/20 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {accepting ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        Joining Workspace...
                      </span>
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4" />
                        <span>Accept Invitation & Join</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                /* UNAUTHENTICATED USER: Show Sign In or Register Options */
                <div className="space-y-4">
                  <p className="text-xs text-slate-400 text-center">
                    Please sign in or create an account with <span className="text-white font-medium">{invitation.email}</span> to join this workspace.
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <Link
                      href={`/login?redirect=${encodeURIComponent(`/invite?token=${activeToken}`)}&email=${encodeURIComponent(invitation.email)}`}
                      className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-center transition-all group"
                    >
                      <LogIn className="w-5 h-5 text-violet-400 mb-1 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-semibold text-white">Sign In</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">Existing Account</span>
                    </Link>

                    <Link
                      href={`/register?email=${encodeURIComponent(invitation.email)}&token=${encodeURIComponent(activeToken)}`}
                      className="flex flex-col items-center justify-center p-3 rounded-xl bg-violet-950/40 hover:bg-violet-900/50 border border-violet-500/30 text-center transition-all group"
                    >
                      <UserPlus className="w-5 h-5 text-cyan-400 mb-1 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-semibold text-white">Create Account</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">New Account</span>
                    </Link>
                  </div>

                  <button
                    onClick={handleAccept}
                    className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-slate-800 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-950 hover:bg-slate-900 transition-all cursor-pointer"
                  >
                    <span>Proceed to Sign In to Accept</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-slate-400 text-center">
                Paste your secure single-use invitation token below to verify and accept your workspace invitation.
              </p>
              <div>
                <input
                  type="text"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="Paste invitation token here"
                  className="block w-full px-3 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm"
                />
              </div>
              <button
                onClick={() => verifyToken(manualToken)}
                disabled={!manualToken.trim()}
                className="w-full py-2.5 px-4 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50 cursor-pointer"
              >
                Verify Token
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#060913] text-slate-100 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
        </div>
      }
    >
      <InviteContent />
    </Suspense>
  );
}
