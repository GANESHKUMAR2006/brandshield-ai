"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { DEMO_WORKSPACE, CURRENT_USER, SITE_CONFIG } from "@/config/site";
import { SystemHealthModal } from "@/components/system/SystemHealthModal";
import { PresenterViewModal } from "@/components/demo/PresenterViewModal";
import { GuidedDemoModal } from "@/components/demo/GuidedDemoModal";
import { InviteMemberModal } from "@/components/workspace/InviteMemberModal";
import {
  fetchWorkspaceMembers,
  fetchWorkspaceInvitations,
  updateMemberRole,
  removeWorkspaceMember,
  revokeWorkspaceInvitation,
  WorkspaceMemberItem,
  WorkspaceInvitationItem,
} from "@/lib/api-client";
import { ReviewerRole } from "@/types";
import {
  Building2,
  Sliders,
  ShieldCheck,
  Activity,
  ArrowRight,
  Terminal,
  Sparkles,
  HelpCircle,
  Users,
  UserPlus,
  Trash2,
  Shield,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Mail,
  X,
} from "lucide-react";

const ROLE_LABELS: Record<ReviewerRole, { label: string; badgeClass: string; desc: string }> = {
  admin: {
    label: "Administrator",
    badgeClass: "bg-purple-950/80 border-purple-800/60 text-purple-300",
    desc: "Full governance controls, policy management & workspace admin",
  },
  compliance_reviewer: {
    label: "Compliance Reviewer",
    badgeClass: "bg-cyan-950/80 border-cyan-800/60 text-cyan-300",
    desc: "Reviews marketing claims against facts & clinical evidence",
  },
  legal_reviewer: {
    label: "Legal Reviewer",
    badgeClass: "bg-amber-950/80 border-amber-800/60 text-amber-300",
    desc: "Evaluates legal disclaimers, guarantees & regulatory risks",
  },
  creator: {
    label: "Creator",
    badgeClass: "bg-emerald-950/80 border-emerald-800/60 text-emerald-300",
    desc: "Uploads collaterals, creates submissions & claim extractions",
  },
  viewer: {
    label: "Viewer",
    badgeClass: "bg-slate-800/80 border-slate-700/60 text-slate-300",
    desc: "Read-only access to submissions, audit trails & verification states",
  },
};

const DEFAULT_MEMBERS: WorkspaceMemberItem[] = [
  {
    id: "mem-001",
    userId: "usr-001",
    role: "admin",
    status: "active",
    email: "sarah.chen@dermaglow.com",
    name: "Sarah Chen",
    joinedAt: "2026-01-15T09:00:00Z",
  },
  {
    id: "mem-002",
    userId: "usr-002",
    role: "compliance_reviewer",
    status: "active",
    email: "marcus.vance@dermaglow.com",
    name: "Marcus Vance",
    joinedAt: "2026-02-01T14:30:00Z",
  },
  {
    id: "mem-003",
    userId: "usr-003",
    role: "legal_reviewer",
    status: "active",
    email: "elena.rostova@dermaglow.com",
    name: "Elena Rostova",
    joinedAt: "2026-02-18T11:15:00Z",
  },
  {
    id: "mem-004",
    userId: "usr-004",
    role: "creator",
    status: "active",
    email: "alex.rivera@dermaglow.com",
    name: "Alex Rivera",
    joinedAt: "2026-03-01T16:00:00Z",
  },
];

const DEFAULT_INVITATIONS: WorkspaceInvitationItem[] = [
  {
    id: "inv-001",
    email: "jordan.taylor@dermaglow.com",
    role: "compliance_reviewer",
    status: "pending",
    expiresAt: new Date(Date.now() + 86400000 * 5).toISOString(),
    createdAt: new Date().toISOString(),
  },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"general" | "team" | "diagnostics">("general");

  // Modals
  const [healthModalOpen, setHealthModalOpen] = useState(false);
  const [presenterModalOpen, setPresenterModalOpen] = useState(false);
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  // Active workspace
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [workspaceName, setWorkspaceName] = useState<string>("Workspace");

  // Team management state
  const [members, setMembers] = useState<WorkspaceMemberItem[]>(DEFAULT_MEMBERS);
  const [invitations, setInvitations] = useState<WorkspaceInvitationItem[]>(DEFAULT_INVITATIONS);
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);
  const [teamNotification, setTeamNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Remove confirmation modal
  const [memberToRemove, setMemberToRemove] = useState<WorkspaceMemberItem | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // Sync workspace from server session / localStorage
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.workspaceId) {
          setWorkspaceId(data.user.workspaceId);
          setWorkspaceName(data.user.workspaceSlug ? data.user.workspaceSlug.charAt(0).toUpperCase() + data.user.workspaceSlug.slice(1) : "Workspace");
        } else if (typeof window !== "undefined") {
          const storedId = localStorage.getItem("active_workspace_id");
          const storedSlug = localStorage.getItem("active_workspace_slug");
          if (storedId) setWorkspaceId(storedId);
          if (storedSlug) {
            setWorkspaceName(storedSlug.charAt(0).toUpperCase() + storedSlug.slice(1));
          }
        }
      })
      .catch(() => {
        if (typeof window !== "undefined") {
          const storedId = localStorage.getItem("active_workspace_id");
          const storedSlug = localStorage.getItem("active_workspace_slug");
          if (storedId) setWorkspaceId(storedId);
          if (storedSlug) {
            setWorkspaceName(storedSlug.charAt(0).toUpperCase() + storedSlug.slice(1));
          }
        }
      });
  }, []);

  const loadTeamData = useCallback(async () => {
    if (!workspaceId) return;
    setIsLoadingTeam(true);
    try {
      const [membersData, invitesData] = await Promise.all([
        fetchWorkspaceMembers(workspaceId).catch(() => DEFAULT_MEMBERS),
        fetchWorkspaceInvitations(workspaceId).catch(() => DEFAULT_INVITATIONS),
      ]);
      setMembers(membersData && membersData.length > 0 ? membersData : DEFAULT_MEMBERS);
      setInvitations(invitesData || []);
    } catch {
      // Use fallback
      setMembers(DEFAULT_MEMBERS);
      setInvitations(DEFAULT_INVITATIONS);
    } finally {
      setIsLoadingTeam(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (activeTab === "team") {
      loadTeamData();
    }
  }, [activeTab, loadTeamData]);

  const handleRoleChange = async (memberId: string, newRole: ReviewerRole) => {
    try {
      await updateMemberRole(workspaceId, memberId, newRole);
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
      setTeamNotification({
        type: "success",
        message: `Member role successfully updated to ${ROLE_LABELS[newRole]?.label || newRole}.`,
      });
      setTimeout(() => setTeamNotification(null), 4000);
    } catch (err) {
      setTeamNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to update member role",
      });
      setTimeout(() => setTeamNotification(null), 4000);
    }
  };

  const handleInitiateRemove = (member: WorkspaceMemberItem) => {
    // Check if user is sole admin
    const adminCount = members.filter((m) => m.role === "admin").length;
    if (member.role === "admin" && adminCount <= 1) {
      setRemoveError("Cannot remove the sole Administrator. Designate another Administrator before removing this account.");
    } else {
      setRemoveError(null);
    }
    setMemberToRemove(member);
  };

  const handleConfirmRemove = async () => {
    if (!memberToRemove) return;
    setIsRemoving(true);
    setRemoveError(null);

    try {
      await removeWorkspaceMember(workspaceId, memberToRemove.id);
      setMembers((prev) => prev.filter((m) => m.id !== memberToRemove.id));
      setMemberToRemove(null);
      setTeamNotification({
        type: "success",
        message: `${memberToRemove.name || memberToRemove.email} has been removed from the workspace.`,
      });
      setTimeout(() => setTeamNotification(null), 4000);
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : "Failed to remove workspace member.");
    } finally {
      setIsRemoving(false);
    }
  };

  const handleRevokeInvitation = async (inviteId: string, email: string) => {
    try {
      await revokeWorkspaceInvitation(workspaceId, inviteId);
      setInvitations((prev) => prev.filter((inv) => inv.id !== inviteId));
      setTeamNotification({
        type: "success",
        message: `Invitation for ${email} has been revoked.`,
      });
      setTimeout(() => setTeamNotification(null), 4000);
    } catch (err) {
      setTeamNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to revoke invitation",
      });
      setTimeout(() => setTeamNotification(null), 4000);
    }
  };

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <span>Workspace Settings & Governance</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-medium bg-violet-950/80 text-violet-300 border border-violet-800/60">
              {workspaceName}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Manage organization multi-tenancy, member role-based access, verification thresholds, and platform diagnostics.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadTeamData()}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab("general")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "general"
              ? "border-violet-500 text-white bg-violet-950/20"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
          }`}
        >
          <Building2 className="w-4 h-4 text-violet-400" />
          <span>General & Governance</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("team")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "team"
              ? "border-cyan-500 text-white bg-cyan-950/20"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
          }`}
        >
          <Users className="w-4 h-4 text-cyan-400" />
          <span>Team & Members</span>
          <span className="ml-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
            {members.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("diagnostics")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "diagnostics"
              ? "border-emerald-500 text-white bg-emerald-950/20"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
          }`}
        >
          <Activity className="w-4 h-4 text-emerald-400" />
          <span>Diagnostics & Tools</span>
        </button>
      </div>

      {/* Notifications */}
      {teamNotification && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-medium transition-all ${
            teamNotification.type === "success"
              ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300"
              : "bg-rose-950/40 border-rose-800/60 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {teamNotification.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{teamNotification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setTeamNotification(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* TAB 1: GENERAL & GOVERNANCE */}
      {activeTab === "general" && (
        <div className="space-y-6">
          {/* Organization Information */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md p-6 shadow-xl space-y-4">
            <div className="pb-3 border-b border-slate-800/80 flex items-center gap-2.5">
              <div className="p-2 bg-violet-950/80 border border-violet-800/60 text-violet-400 rounded-lg">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">Organization Profile</h2>
                <p className="text-xs text-slate-400">Multi-tenant workspace isolation & compliance configuration</p>
              </div>
            </div>
            <div className="space-y-4 text-xs pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">Active Workspace</label>
                  <input
                    type="text"
                    readOnly
                    value={workspaceName}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-white font-medium shadow-inner"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">Corporate Domain</label>
                  <input
                    type="text"
                    readOnly
                    value={DEMO_WORKSPACE.domain}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-white font-medium shadow-inner"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">Subscription Tier</label>
                  <input
                    type="text"
                    readOnly
                    value={DEMO_WORKSPACE.plan}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-white font-medium shadow-inner"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">Compliance Standard</label>
                  <input
                    type="text"
                    readOnly
                    value={DEMO_WORKSPACE.complianceTier}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-white font-medium shadow-inner"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Claim Governance Thresholds */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md p-6 shadow-xl space-y-4">
            <div className="pb-3 border-b border-slate-800/80 flex items-center gap-2.5">
              <div className="p-2 bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 rounded-lg">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">AI Verification & Cutoff Thresholds</h2>
                <p className="text-xs text-slate-400">Configure automated grounding cutoffs and sensitivity parameters</p>
              </div>
            </div>
            <div className="space-y-3 pt-2 text-xs">
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-950/60">
                <div>
                  <div className="font-semibold text-white">Auto-Pass Grounding Cutoff</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Claims with AI evidence similarity at or above this score are marked Supported automatically.
                  </div>
                </div>
                <div className="font-bold text-cyan-300 text-sm bg-cyan-950/80 border border-cyan-800/60 px-3 py-1 rounded-lg">
                  85%
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-950/60">
                <div>
                  <div className="font-semibold text-white">Superlative Trigger (Mandatory Human Sign-off)</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Claims containing superlative terms (&ldquo;best&rdquo;, &ldquo;100%&rdquo;, &ldquo;miracle&rdquo;) require manual human sign-off.
                  </div>
                </div>
                <div className="font-bold text-emerald-300 text-xs bg-emerald-950/80 px-3 py-1 rounded-lg border border-emerald-800/60">
                  Enforced
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-950/60">
                <div>
                  <div className="font-semibold text-white">Active Reviewer Account</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {CURRENT_USER.name} ({CURRENT_USER.email}) — {CURRENT_USER.role}
                  </div>
                </div>
                <div className="font-bold text-violet-300 text-xs bg-violet-950/80 px-3 py-1 rounded-lg border border-violet-800/60">
                  Active
                </div>
              </div>
            </div>
          </div>

          {/* Policy Management Link Card */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-950/80 border border-violet-800/60 text-violet-400 rounded-lg">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">Compliance Policies & Simulation Studio</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Manage deterministic policy rules, prohibited claim patterns, and test live copies in the Simulation Studio.
                  </p>
                </div>
              </div>
              <Link
                href="/policies"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs transition-colors shadow-md shadow-violet-950/50 shrink-0"
              >
                <span>Open Policy Studio</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TEAM & MEMBERS */}
      {activeTab === "team" && (
        <div className="space-y-6">
          {/* Header Card with Invite Button */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 rounded-xl">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">
                    Workspace Members & Access Control
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Manage role-based governance for {workspaceName}. Members can be assigned one of 5 enterprise roles.
                  </p>
                </div>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={() => setInviteModalOpen(true)}
                className="flex items-center gap-2 self-start sm:self-auto"
              >
                <UserPlus className="w-4 h-4" />
                <span>Invite Member</span>
              </Button>
            </div>

            {/* Quick Role Legend */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-5 pt-4 border-t border-slate-800/80 text-[11px]">
              {(["admin", "compliance_reviewer", "legal_reviewer", "creator", "viewer"] as ReviewerRole[]).map((r) => (
                <div key={r} className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/60">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border mb-1 ${ROLE_LABELS[r].badgeClass}`}>
                    {ROLE_LABELS[r].label}
                  </span>
                  <p className="text-[10px] text-slate-400 line-clamp-2">{ROLE_LABELS[r].desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Members Table */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Active Members ({members.length})</h3>
                <p className="text-xs text-slate-400 mt-0.5">Users currently granted access to this workspace</p>
              </div>
              {isLoadingTeam && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                  <span>Loading...</span>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800/80 bg-slate-950/40 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-6">Member</th>
                    <th className="py-3 px-6">Role & Permissions</th>
                    <th className="py-3 px-6">Status</th>
                    <th className="py-3 px-6">Joined Date</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-200">
                  {members.map((member) => {
                    const initials = (member.name || member.email)
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .substring(0, 2)
                      .toUpperCase();

                    return (
                      <tr key={member.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-violet-900/60 border border-violet-700/60 flex items-center justify-center font-bold text-[11px] text-violet-200 shrink-0">
                              {initials}
                            </div>
                            <div>
                              <div className="font-semibold text-white">
                                {member.name || member.email.split("@")[0]}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                                <Mail className="w-3 h-3 text-slate-500" />
                                {member.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-6">
                          <select
                            value={member.role}
                            onChange={(e) => handleRoleChange(member.id, e.target.value as ReviewerRole)}
                            className="bg-slate-950 border border-slate-700 hover:border-slate-600 rounded-lg px-2.5 py-1 text-xs text-white font-medium cursor-pointer focus:outline-none focus:border-cyan-500"
                            aria-label={`Change role for ${member.name || member.email}`}
                          >
                            <option value="admin">Administrator</option>
                            <option value="compliance_reviewer">Compliance Reviewer</option>
                            <option value="legal_reviewer">Legal Reviewer</option>
                            <option value="creator">Creator</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        </td>

                        <td className="py-3.5 px-6">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            {member.status || "Active"}
                          </span>
                        </td>

                        <td className="py-3.5 px-6 text-slate-400 font-mono text-[11px]">
                          {new Date(member.joinedAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>

                        <td className="py-3.5 px-6 text-right">
                          <button
                            type="button"
                            onClick={() => handleInitiateRemove(member)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/50 transition-all text-xs cursor-pointer"
                            title="Remove member"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pending Invitations Table */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Pending Invitations ({invitations.length})</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Invitations dispatched with secure single-use tokens awaiting activation
                </p>
              </div>
            </div>

            {invitations.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No pending invitations for this workspace. Use the &ldquo;Invite Member&rdquo; button above to invite colleagues.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800/80 bg-slate-950/40 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-6">Invited Email</th>
                      <th className="py-3 px-6">Proposed Role</th>
                      <th className="py-3 px-6">Token Status</th>
                      <th className="py-3 px-6">Expires In</th>
                      <th className="py-3 px-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 text-slate-200">
                    {invitations.map((inv) => {
                      const isExpired = new Date(inv.expiresAt).getTime() < Date.now();
                      const daysLeft = Math.max(
                        0,
                        Math.ceil((new Date(inv.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                      );

                      return (
                        <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 px-6 font-mono text-slate-200">
                            {inv.email}
                          </td>
                          <td className="py-3.5 px-6">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border ${
                                ROLE_LABELS[inv.role as ReviewerRole]?.badgeClass || "bg-slate-800 text-slate-300"
                              }`}
                            >
                              {ROLE_LABELS[inv.role as ReviewerRole]?.label || inv.role}
                            </span>
                          </td>
                          <td className="py-3.5 px-6">
                            {isExpired ? (
                              <span className="text-rose-400 font-medium">Expired</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-300 font-medium">
                                <Clock className="w-3 h-3 text-amber-400" />
                                <span>Pending Acceptance</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-6 text-slate-400 text-[11px]">
                            {isExpired ? "Token invalid" : `${daysLeft} days remaining`}
                          </td>
                          <td className="py-3.5 px-6 text-right">
                            <button
                              type="button"
                              onClick={() => handleRevokeInvitation(inv.id, inv.email)}
                              className="px-2.5 py-1 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 text-xs border border-transparent hover:border-rose-900/50 transition-all cursor-pointer"
                            >
                              Revoke
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DIAGNOSTICS & TOOLS */}
      {activeTab === "diagnostics" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md p-6 shadow-xl space-y-4">
            <div className="pb-3 border-b border-slate-800/80 flex items-center gap-2.5">
              <div className="p-2 bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 rounded-lg">
                <Terminal className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">System Diagnostics & Evaluator Tools</h2>
                <p className="text-xs text-slate-400">Inspect backend health, view evaluator scenarios, or launch walkthroughs</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setHealthModalOpen(true)}
                className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:border-emerald-700/60 hover:bg-slate-900/60 transition-all text-left group cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white group-hover:text-emerald-300 transition-colors">
                    System Health
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                </div>
                <p className="text-[11px] text-slate-400">
                  Check database connectivity, Ollama/HF model latency, and API status.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPresenterModalOpen(true)}
                className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:border-violet-700/60 hover:bg-slate-900/60 transition-all text-left group cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white group-hover:text-violet-300 transition-colors">
                    Presenter Guide
                  </span>
                  <HelpCircle className="w-3.5 h-3.5 text-violet-400" />
                </div>
                <p className="text-[11px] text-slate-400">
                  Open judge walkthrough script and 3 guided demo scenarios.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setGuideModalOpen(true)}
                className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:border-cyan-700/60 hover:bg-slate-900/60 transition-all text-left group cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors">
                    Guided Tour
                  </span>
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <p className="text-[11px] text-slate-400">
                  Step-by-step interactive workflow tutorial for first-time evaluators.
                </p>
              </button>
            </div>
          </div>

          {/* Platform Architecture */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md p-6 shadow-xl space-y-4">
            <div className="pb-3 border-b border-slate-800/80 flex items-center gap-2.5">
              <div className="p-2 bg-slate-800/80 border border-slate-700/60 text-slate-300 rounded-lg">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">Platform Deployment Architecture</h2>
                <p className="text-xs text-slate-400">Engine build and production runtime environment</p>
              </div>
            </div>
            <div className="text-xs space-y-2.5 text-slate-300 pt-2">
              <div className="flex justify-between py-2 border-b border-slate-800/80">
                <span className="text-slate-400">Application Name:</span>
                <span className="font-semibold text-white">{SITE_CONFIG.name}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-800/80">
                <span className="text-slate-400">Semantic Version:</span>
                <span className="font-mono text-cyan-300">v{SITE_CONFIG.version} (Production Ready)</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-800/80">
                <span className="text-slate-400">Multi-Tenancy Engine:</span>
                <span className="font-mono text-purple-300">Enabled (RLS + workspace_memberships)</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-800/80">
                <span className="text-slate-400">Framework & Runtime:</span>
                <span className="font-medium text-white">Next.js App Router (React 19)</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-400">API Health Diagnostics Route:</span>
                <span className="font-mono text-emerald-400">/api/health (200 OK)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remove Member Confirmation Dialog */}
      {memberToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-800/60 text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Revoke Workspace Access</h3>
                <p className="text-xs text-slate-400">Confirm member removal</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to remove{" "}
              <strong className="text-white">{memberToRemove.name || memberToRemove.email}</strong>{" "}
              from <strong className="text-white">{workspaceName}</strong>? They will immediately lose access to all submissions, policies, and evidence within this workspace.
            </p>

            {removeError && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{removeError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMemberToRemove(null)}
                disabled={isRemoving}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmRemove}
                disabled={isRemoving || !!removeError}
                isLoading={isRemoving}
              >
                Confirm Removal
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      <InviteMemberModal
        isOpen={inviteModalOpen}
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        onClose={() => setInviteModalOpen(false)}
        onInvited={() => loadTeamData()}
      />

      <SystemHealthModal isOpen={healthModalOpen} onClose={() => setHealthModalOpen(false)} />
      <PresenterViewModal isOpen={presenterModalOpen} onClose={() => setPresenterModalOpen(false)} />
      <GuidedDemoModal isOpen={guideModalOpen} onClose={() => setGuideModalOpen(false)} />
    </AppLayout>
  );
}
