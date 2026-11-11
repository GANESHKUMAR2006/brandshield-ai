"use client";

import React, { useState } from "react";
import { UserPlus, X, Loader2, CheckCircle2, AlertCircle, Copy, Check } from "lucide-react";
import { createWorkspaceInvitation } from "@/lib/api-client";
import { ReviewerRole } from "@/types";

interface InviteMemberModalProps {
  isOpen: boolean;
  workspaceId: string;
  workspaceName?: string;
  onClose: () => void;
  onInvited: () => void;
}

const ROLE_OPTIONS: Array<{ value: ReviewerRole; label: string; description: string }> = [
  {
    value: "compliance_reviewer",
    label: "Compliance Reviewer",
    description: "Evaluates marketing claims against clinical evidence and approved product facts.",
  },
  {
    value: "creator",
    label: "Creator",
    description: "Uploads collaterals, creates submissions, and triggers claim extraction.",
  },
  {
    value: "legal_reviewer",
    label: "Legal Reviewer",
    description: "Mandatory gatekeeper for comparative advertising, guarantees, and escalations.",
  },
  {
    value: "admin",
    label: "Workspace Administrator",
    description: "Full governance controls: policy configuration, member management, and audit exports.",
  },
  {
    value: "viewer",
    label: "Viewer",
    description: "Read-only access to submissions, verification statuses, and approved facts.",
  },
];

export function InviteMemberModal({
  isOpen,
  workspaceId,
  workspaceName = "Workspace",
  onClose,
  onInvited,
}: InviteMemberModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ReviewerRole>("compliance_reviewer");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    email: string;
    inviteToken?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setError(null);
    setIsLoading(true);

    try {
      const res = await createWorkspaceInvitation(workspaceId, {
        email: email.trim(),
        role,
      });

      setSuccessInfo({
        email: res.email,
        inviteToken: res.inviteToken,
      });
      setIsLoading(false);
      onInvited();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invitation");
      setIsLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!successInfo?.inviteToken) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const link = `${origin}/invite?token=${encodeURIComponent(successInfo.inviteToken)}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setEmail("");
    setRole("compliance_reviewer");
    setError(null);
    setSuccessInfo(null);
    setCopied(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#0e1424] border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 relative">
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/60 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-violet-950/80 border border-violet-800/60 flex items-center justify-center text-violet-400">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Invite Team Member</h3>
            <p className="text-xs text-slate-400">Add team members to {workspaceName}</p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 flex items-start gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successInfo ? (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-800/60 flex items-start gap-2.5 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Invitation Dispatched!</span>
                <span className="text-[11px] text-emerald-300/90 block mt-0.5">
                  An invitation has been registered for <strong>{successInfo.email}</strong> with role <strong>{role}</strong>.
                </span>
              </div>
            </div>

            {successInfo.inviteToken && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="font-medium">Invitation Token Link:</span>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300 font-semibold"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800/80 font-mono text-[10px] text-slate-400 break-all select-all">
                  token: {successInfo.inviteToken}
                </div>
                <p className="text-[10px] text-slate-500">
                  Single-use token valid for 7 days. The user can accept this invitation upon signing in.
                </p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Corporate Email Address <span className="text-violet-400">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="w-full h-10 px-3.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all shadow-inner"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Role & Permissions <span className="text-violet-400">*</span>
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as ReviewerRole)}
                className="w-full h-10 px-3.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all cursor-pointer"
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
                {ROLE_OPTIONS.find((opt) => opt.value === role)?.description}
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={handleClose}
                disabled={isLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !email.trim()}
                className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-violet-600/20 flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending Invite...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Send Invitation</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
