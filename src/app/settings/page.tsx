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
import { ArchiveOrganizationModal } from "@/components/workspace/ArchiveOrganizationModal";
import {
  fetchWorkspaceMembers,
  fetchWorkspaceInvitations,
  updateMemberRole,
  removeWorkspaceMember,
  revokeWorkspaceInvitation,
  fetchWorkspaceDetails,
  fetchWorkspaces,
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
  Archive,
  Lock,
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

  // Active workspace & Danger Zone lifecycle state
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [workspaceName, setWorkspaceName] = useState<string>("Workspace");
  const [workspaceSlug, setWorkspaceSlug] = useState<string>("");
  const [userRole, setUserRole] = useState<ReviewerRole>("viewer");
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);

  // Team management state
  const [members, setMembers] = useState<WorkspaceMemberItem[]>(DEFAULT_MEMBERS);
  const [invitations, setInvitations] = useState<WorkspaceInvitationItem[]>(DEFAULT_INVITATIONS);
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);
  const [teamNotification, setTeamNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Organization Join Code state
  const [joinCodeStatus, setJoinCodeStatus] = useState<{
    hasActiveCode: boolean;
    enabled: boolean;
    updatedAt: string | null;
  } | null>(null);
  const [activeJoinCode, setActiveJoinCode] = useState<string | null>(null);
  const [isRotatingJoinCode, setIsRotatingJoinCode] = useState(false);
  const [isRevokingJoinCode, setIsRevokingJoinCode] = useState(false);
  const [joinCodeCopied, setJoinCodeCopied] = useState(false);

  // Join Requests state
  interface JoinRequestItem {
    id: string;
    workspaceId: string;
    userId: string;
    userEmail: string;
    userName: string;
    status: "pending" | "approved" | "rejected" | "canceled";
    reviewedBy: string | null;
    reviewedAt: string | null;
    assignedRole: string | null;
    rejectionReason: string | null;
    createdAt: string;
  }
  const [joinRequests, setJoinRequests] = useState<JoinRequestItem[]>([]);
  const [isLoadingJoinRequests, setIsLoadingJoinRequests] = useState(false);
  const [requestToApprove, setRequestToApprove] = useState<JoinRequestItem | null>(null);
  const [approvalRole, setApprovalRole] = useState<ReviewerRole>("compliance_reviewer");
  const [isApproving, setIsApproving] = useState(false);
  const [requestToReject, setRequestToReject] = useState<JoinRequestItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  // Email Diagnostic Test state
  const [testEmailRecipient, setTestEmailRecipient] = useState("brandshield11@gmail.com");
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    provider?: string;
    timestamp?: string;
  } | null>(null);

  // Remove confirmation modal
  const [memberToRemove, setMemberToRemove] = useState<WorkspaceMemberItem | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // Sync workspace and role from server session / localStorage
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          if (data.user.workspaceId) setWorkspaceId(data.user.workspaceId);
          if (data.user.workspaceSlug) {
            setWorkspaceSlug(data.user.workspaceSlug);
            setWorkspaceName(data.user.workspaceSlug.charAt(0).toUpperCase() + data.user.workspaceSlug.slice(1));
          }
          if (data.user.role) {
            setUserRole(data.user.role as ReviewerRole);
          }
        } else if (typeof window !== "undefined") {
          const storedId = localStorage.getItem("active_workspace_id");
          const storedSlug = localStorage.getItem("active_workspace_slug");
          if (storedId) setWorkspaceId(storedId);
          if (storedSlug) {
            setWorkspaceSlug(storedSlug);
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
            setWorkspaceSlug(storedSlug);
            setWorkspaceName(storedSlug.charAt(0).toUpperCase() + storedSlug.slice(1));
          }
        }
      });
  }, []);

  // Fetch full workspace metadata when workspaceId is available
  useEffect(() => {
    if (workspaceId) {
      fetchWorkspaceDetails(workspaceId)
        .then((ws) => {
          if (ws?.name) setWorkspaceName(ws.name);
          if (ws?.slug) setWorkspaceSlug(ws.slug);
        })
        .catch(() => {});
    }
  }, [workspaceId]);

  const loadJoinCodeStatus = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/join-code`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setJoinCodeStatus({
            hasActiveCode: data.hasActiveCode,
            enabled: data.enabled,
            updatedAt: data.updatedAt,
          });
        }
      }
    } catch {
      // ignore
    }
  }, [workspaceId]);

  const loadJoinRequests = useCallback(async () => {
    if (!workspaceId) return;
    setIsLoadingJoinRequests(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/join-requests`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.requests)) {
          setJoinRequests(data.requests);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingJoinRequests(false);
    }
  }, [workspaceId]);

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
      await Promise.all([loadJoinCodeStatus(), loadJoinRequests()]);
    } catch {
      // Use fallback
      setMembers(DEFAULT_MEMBERS);
      setInvitations(DEFAULT_INVITATIONS);
    } finally {
      setIsLoadingTeam(false);
    }
  }, [workspaceId, loadJoinCodeStatus, loadJoinRequests]);

  const handleGenerateJoinCode = async () => {
    if (!workspaceId) return;
    setIsRotatingJoinCode(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/join-code`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to generate join code");
      }
      setActiveJoinCode(data.joinCode);
      setJoinCodeStatus({
        hasActiveCode: true,
        enabled: true,
        updatedAt: data.updatedAt,
      });
      setTeamNotification({
        type: "success",
        message: "Organization join code generated! Share this code with members seeking to request access.",
      });
      setTimeout(() => setTeamNotification(null), 6000);
    } catch (err) {
      setTeamNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to generate join code",
      });
      setTimeout(() => setTeamNotification(null), 4000);
    } finally {
      setIsRotatingJoinCode(false);
    }
  };

  const handleRevokeJoinCode = async () => {
    if (!workspaceId) return;
    setIsRevokingJoinCode(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/join-code`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to revoke join code");
      }
      setActiveJoinCode(null);
      setJoinCodeStatus((prev) => (prev ? { ...prev, enabled: false } : null));
      setTeamNotification({
        type: "success",
        message: "Organization join code revoked. No new applicants can use this code.",
      });
      setTimeout(() => setTeamNotification(null), 4000);
    } catch (err) {
      setTeamNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to revoke join code",
      });
      setTimeout(() => setTeamNotification(null), 4000);
    } finally {
      setIsRevokingJoinCode(false);
    }
  };

  const handleApproveRequest = async () => {
    if (!workspaceId || !requestToApprove) return;
    setIsApproving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/join-requests/${requestToApprove.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: approvalRole }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to approve join request");
      }
      setTeamNotification({
        type: "success",
        message: `Approved ${requestToApprove.userEmail} as ${ROLE_LABELS[approvalRole]?.label || approvalRole}. Membership active!`,
      });
      setTimeout(() => setTeamNotification(null), 5000);
      setRequestToApprove(null);
      await loadTeamData();
    } catch (err) {
      setTeamNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to approve join request",
      });
      setTimeout(() => setTeamNotification(null), 4000);
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectRequest = async () => {
    if (!workspaceId || !requestToReject) return;
    setIsRejecting(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/join-requests/${requestToReject.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectionReason.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to reject join request");
      }
      setTeamNotification({
        type: "success",
        message: `Membership request from ${requestToReject.userEmail} declined.`,
      });
      setTimeout(() => setTeamNotification(null), 4000);
      setRequestToReject(null);
      setRejectionReason("");
      await loadTeamData();
    } catch (err) {
      setTeamNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to reject join request",
      });
      setTimeout(() => setTeamNotification(null), 4000);
    } finally {
      setIsRejecting(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!workspaceId || !testEmailRecipient.trim()) return;
    setIsSendingTestEmail(true);
    setTestEmailResult(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/email/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientEmail: testEmailRecipient.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setTestEmailResult({
          success: false,
          error: data.error || "Failed to deliver test email",
        });
      } else {
        setTestEmailResult({
          success: true,
          message: data.message,
          provider: data.provider,
          timestamp: data.timestamp,
        });
      }
    } catch (err) {
      setTestEmailResult({
        success: false,
        error: err instanceof Error ? err.message : "Network error triggering test email",
      });
    } finally {
      setIsSendingTestEmail(false);
    }
  };

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

  const handleWorkspaceArchived = async (archivedWs: { id: string; name: string; slug: string }) => {
    setTeamNotification({
      type: "success",
      message: `Organization "${archivedWs.name}" has been successfully archived. All active memberships have been suspended.`,
    });

    if (typeof window !== "undefined") {
      localStorage.removeItem("active_workspace_id");
      localStorage.removeItem("active_workspace_slug");
    }

    try {
      const remainingWorkspaces = await fetchWorkspaces();
      if (remainingWorkspaces && remainingWorkspaces.length > 0) {
        const nextWs = remainingWorkspaces[0];
        if (typeof window !== "undefined") {
          localStorage.setItem("active_workspace_id", nextWs.id);
          localStorage.setItem("active_workspace_slug", nextWs.slug);
        }
        setWorkspaceId(nextWs.id);
        setWorkspaceName(nextWs.name);
        setWorkspaceSlug(nextWs.slug);
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        setTimeout(() => {
          window.location.href = "/workspaces";
        }, 1500);
      }
    } catch {
      setTimeout(() => {
        window.location.reload();
      }, 1500);
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

          {/* Organization Lifecycle — Danger Zone */}
          <div className="rounded-xl border border-rose-900/60 bg-gradient-to-b from-rose-950/20 via-slate-900/80 to-slate-900/90 backdrop-blur-md p-6 shadow-xl space-y-5">
            <div className="pb-3 border-b border-rose-900/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-950/80 border border-rose-800/60 text-rose-400 rounded-lg">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    <span>Danger Zone — Organization Lifecycle</span>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800/60">
                      Admin Access Only
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Lifecycle management and compliance retention for <strong className="text-slate-200">{workspaceName}</strong> ({workspaceSlug || workspaceId || "active workspace"})
                  </p>
                </div>
              </div>
            </div>

            {userRole !== "admin" ? (
              <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center gap-3 text-xs text-slate-400">
                <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                <span>
                  Organization lifecycle operations are restricted to Workspace Administrators. Your current role is{" "}
                  <strong className="text-white capitalize">{userRole.replace("_", " ")}</strong>.
                </span>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Action 1: Archive Organization */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl border border-rose-900/40 bg-slate-950/70 hover:border-rose-800/60 transition-colors">
                  <div className="space-y-1">
                    <div className="font-semibold text-white text-xs flex items-center gap-2">
                      <Archive className="w-3.5 h-3.5 text-rose-400" />
                      <span>Archive Organization</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-950/60 border border-amber-800/50 text-amber-300">
                        Retention Standard
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 max-w-xl">
                      Transitions <strong className="text-slate-200">{workspaceName}</strong> ({workspaceSlug || "active"}) into read-only retention. Suspends all active team memberships and cancels pending invitations while preserving all clinical evidence, verified claims, and immutable audit logs required for FDA 21 CFR Part 11 and FTC substantiation.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsArchiveModalOpen(true)}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 hover:border-rose-600 text-rose-200 font-semibold text-xs transition-colors shadow-sm shrink-0 cursor-pointer"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Archive Organization</span>
                  </button>
                </div>

                {/* Action 2: Permanent Deletion (Strictly Disabled for Regulatory Compliance) */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl border border-slate-800/80 bg-slate-950/40 opacity-75">
                  <div className="space-y-1">
                    <div className="font-semibold text-slate-300 text-xs flex items-center gap-2">
                      <Trash2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Permanently Delete Organization</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-slate-400">
                        Disabled by Policy
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 max-w-xl">
                      Physical deletion is prohibited under compliance regulations (FDA 21 CFR Part 11, FTC Marketing Substantiation, ISO 22716). Cascade deletion causes spoliation of evidence and destroys required audit histories. Use archival to retire this organization.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled
                    title="Permanent deletion is prohibited by compliance retention policies"
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-500 font-medium text-xs cursor-not-allowed shrink-0"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Delete Organization</span>
                  </button>
                </div>
              </div>
            )}
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

          {/* Organization Join Code Card */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md p-6 shadow-xl space-y-4">
            <div className="pb-3 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-950/80 border border-indigo-800/60 text-indigo-400 rounded-lg">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">Organization Join Code</h3>
                  <p className="text-xs text-slate-400">
                    Allow authenticated users to request access to this workspace using an authorized join code
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateJoinCode}
                  disabled={isRotatingJoinCode}
                  className="flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRotatingJoinCode ? "animate-spin" : ""}`} />
                  <span>{joinCodeStatus?.hasActiveCode ? "Rotate Join Code" : "Generate Join Code"}</span>
                </Button>
                {joinCodeStatus?.hasActiveCode && joinCodeStatus.enabled && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRevokeJoinCode}
                    disabled={isRevokingJoinCode}
                    className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
                  >
                    <span>Revoke Code</span>
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 text-xs">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="text-slate-400 font-medium">Join Code Status</div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      joinCodeStatus?.hasActiveCode && joinCodeStatus.enabled
                        ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/60"
                        : "bg-slate-800 text-slate-400 border border-slate-700"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        joinCodeStatus?.hasActiveCode && joinCodeStatus.enabled
                          ? "bg-emerald-400 animate-pulse"
                          : "bg-slate-500"
                      }`}
                    />
                    {joinCodeStatus?.hasActiveCode && joinCodeStatus.enabled ? "Active & Accepting Requests" : "Disabled / Inactive"}
                  </span>
                  {joinCodeStatus?.updatedAt && (
                    <span className="text-[11px] text-slate-500 font-mono">
                      Last rotated {new Date(joinCodeStatus.updatedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              {activeJoinCode ? (
                <div className="p-4 rounded-xl bg-violet-950/30 border border-violet-500/40 space-y-2">
                  <div className="flex items-center justify-between text-violet-300 font-semibold">
                    <span>Generated Code (Copy Now):</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(activeJoinCode);
                        setJoinCodeCopied(true);
                        setTimeout(() => setJoinCodeCopied(false), 2000);
                      }}
                      className="text-xs text-violet-400 hover:text-violet-200 underline flex items-center gap-1"
                    >
                      {joinCodeCopied ? "Copied!" : "Copy Code"}
                    </button>
                  </div>
                  <div className="text-lg font-mono font-bold tracking-widest text-white bg-slate-950/80 px-3 py-1.5 rounded-lg border border-violet-500/30">
                    {activeJoinCode}
                  </div>
                  <p className="text-[11px] text-violet-300/80">
                    Only SHA-256 hash is saved. Share this code with new team members to enter at /join-organization.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/60 flex items-center justify-center text-slate-500 text-center">
                  <span>Generate a new join code to distribute to prospective team members.</span>
                </div>
              )}
            </div>
          </div>

          {/* Membership Requests Section */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Membership Requests ({joinRequests.length})</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Access requests submitted via organization join code awaiting administrator approval
                </p>
              </div>
              {isLoadingJoinRequests && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                  <span>Loading...</span>
                </div>
              )}
            </div>

            {joinRequests.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No membership requests submitted for this organization.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800/80 bg-slate-950/40 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-6">Applicant</th>
                      <th className="py-3 px-6">Requested Date</th>
                      <th className="py-3 px-6">Status</th>
                      <th className="py-3 px-6">Assigned Role</th>
                      <th className="py-3 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 text-slate-200">
                    {joinRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-6">
                          <div className="font-semibold text-white">{req.userName}</div>
                          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-500" />
                            {req.userEmail}
                          </div>
                        </td>

                        <td className="py-3.5 px-6 text-slate-400 font-mono text-[11px]">
                          {new Date(req.createdAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>

                        <td className="py-3.5 px-6">
                          {req.status === "pending" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30">
                              <Clock className="w-3 h-3" />
                              Pending Review
                            </span>
                          )}
                          {req.status === "approved" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" />
                              Approved
                            </span>
                          )}
                          {req.status === "rejected" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/10 text-rose-300 border border-rose-500/30">
                              Declined
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-6">
                          {req.assignedRole ? (
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border ${
                                ROLE_LABELS[req.assignedRole as ReviewerRole]?.badgeClass || "bg-slate-800 text-slate-300"
                              }`}
                            >
                              {ROLE_LABELS[req.assignedRole as ReviewerRole]?.label || req.assignedRole}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-6 text-right">
                          {req.status === "pending" ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setRequestToApprove(req);
                                  setApprovalRole("compliance_reviewer");
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRequestToReject(req);
                                  setRejectionReason("");
                                }}
                                className="px-2.5 py-1 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 text-xs border border-transparent hover:border-rose-900/50 transition-all cursor-pointer"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-500 italic">Reviewed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Approve Join Request Modal */}
      {requestToApprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#0e1424] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white tracking-tight">Approve Membership Request</h3>
            <p className="text-xs text-slate-300">
              Grant <strong>{requestToApprove.userName}</strong> ({requestToApprove.userEmail}) access to {workspaceName}. Select their regulatory role:
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">Assigned Workspace Role</label>
              <select
                value={approvalRole}
                onChange={(e) => setApprovalRole(e.target.value as ReviewerRole)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="compliance_reviewer">Compliance Reviewer</option>
                <option value="creator">Creator</option>
                <option value="legal_reviewer">Legal Reviewer</option>
                <option value="admin">Administrator</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRequestToApprove(null)}
                disabled={isApproving}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleApproveRequest}
                disabled={isApproving}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {isApproving ? "Approving..." : "Confirm & Grant Access"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Join Request Modal */}
      {requestToReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#0e1424] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white tracking-tight">Decline Membership Request</h3>
            <p className="text-xs text-slate-300">
              Decline access for <strong>{requestToReject.userName}</strong> ({requestToReject.userEmail}). No workspace membership will be created.
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">Optional Reason for Declining</label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Please use your official corporate domain email address."
                rows={3}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRequestToReject(null)}
                disabled={isRejecting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleRejectRequest}
                disabled={isRejecting}
              >
                {isRejecting ? "Declining..." : "Decline Request"}
              </Button>
            </div>
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

          {/* Outbound Email Diagnostics Tool */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md p-6 shadow-xl space-y-4">
            <div className="pb-3 border-b border-slate-800/80 flex items-center gap-2.5">
              <div className="p-2 bg-violet-950/80 border border-violet-800/60 text-violet-400 rounded-lg">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">Outbound Email Diagnostic Tool</h2>
                <p className="text-xs text-slate-400">
                  Verify active transactional email provider delivery (Gmail SMTP / Resend) to an explicit recipient.
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-1 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  Test Recipient Corporate / QA Email Address
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="email"
                    value={testEmailRecipient}
                    onChange={(e) => setTestEmailRecipient(e.target.value)}
                    placeholder="recipient@example.com"
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-violet-500"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSendTestEmail}
                    disabled={isSendingTestEmail || !testEmailRecipient.trim()}
                    className="flex items-center gap-1.5 shrink-0"
                  >
                    {isSendingTestEmail ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending Diagnostic Test...</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-3.5 h-3.5" />
                        <span>Send Test Email</span>
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Sends a real test email through the active provider (e.g. Gmail SMTP `brandshield11@gmail.com`).
                </p>
              </div>

              {testEmailResult && (
                <div
                  className={`p-4 rounded-xl border text-xs space-y-1 ${
                    testEmailResult.success
                      ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300"
                      : "bg-rose-950/40 border-rose-800/60 text-rose-300"
                  }`}
                >
                  <div className="font-semibold flex items-center gap-2">
                    {testEmailResult.success ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Test Email Dispatched Successfully</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                        <span>Diagnostic Test Failed</span>
                      </>
                    )}
                  </div>
                  <div className="text-[11px] opacity-90">
                    {testEmailResult.success ? testEmailResult.message : testEmailResult.error}
                  </div>
                  {testEmailResult.provider && (
                    <div className="text-[10px] font-mono text-slate-400 pt-1">
                      Provider: {testEmailResult.provider.toUpperCase()} · Sent at: {testEmailResult.timestamp}
                    </div>
                  )}
                </div>
              )}
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

      {/* Archive Organization Modal */}
      {workspaceId && (
        <ArchiveOrganizationModal
          isOpen={isArchiveModalOpen}
          workspace={{
            id: workspaceId,
            name: workspaceName,
            slug: workspaceSlug || workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          }}
          onClose={() => setIsArchiveModalOpen(false)}
          onArchived={handleWorkspaceArchived}
        />
      )}

      <SystemHealthModal isOpen={healthModalOpen} onClose={() => setHealthModalOpen(false)} />
      <PresenterViewModal isOpen={presenterModalOpen} onClose={() => setPresenterModalOpen(false)} />
      <GuidedDemoModal isOpen={guideModalOpen} onClose={() => setGuideModalOpen(false)} />
    </AppLayout>
  );
}
