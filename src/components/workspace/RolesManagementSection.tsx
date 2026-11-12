"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Plus,
  Copy,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Users,
  Lock,
  Layers,
  Sparkles,
  Info,
  Check,
  X,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  fetchWorkspaceRoles,
  createCustomRole,
  updateCustomRole,
  deleteCustomRole,
  duplicateRole,
  RoleItem,
  PermissionItem,
  WorkspaceRolesResponse,
} from "@/lib/api-client";
import { ReviewerRole } from "@/types";

interface RolesManagementSectionProps {
  workspaceId: string;
  workspaceName: string;
  userRole: ReviewerRole;
  onRolesUpdated?: () => void;
}

export function RolesManagementSection({
  workspaceId,
  workspaceName,
  userRole,
  onRolesUpdated,
}: RolesManagementSectionProps) {
  const isAdmin = userRole === "admin";

  const [isLoading, setIsLoading] = useState(true);
  const [builtInRoles, setBuiltInRoles] = useState<RoleItem[]>([]);
  const [customRoles, setCustomRoles] = useState<RoleItem[]>([]);
  const [allPermissions, setAllPermissions] = useState<PermissionItem[]>([]);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Expanded permissions cards in lists
  const [expandedRoles, setExpandedRoles] = useState<Record<string, boolean>>({});

  // Modal state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null); // null = creating new
  const [roleFormName, setRoleFormName] = useState("");
  const [roleFormDesc, setRoleFormDesc] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete modal state
  const [roleToDelete, setRoleToDelete] = useState<RoleItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Category collapse in editor
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [permSearch, setPermSearch] = useState("");

  const loadRoles = useCallback(async () => {
    if (!workspaceId) return;
    setIsLoading(true);
    try {
      const data: WorkspaceRolesResponse = await fetchWorkspaceRoles(workspaceId);
      setBuiltInRoles(data.builtInRoles || []);
      setCustomRoles(data.customRoles || []);
      setAllPermissions(data.allPermissions || []);
    } catch (err) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to load roles and permissions",
      });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  // Group permissions by category
  const permissionsByCategory = useMemo(() => {
    const map: Record<string, PermissionItem[]> = {};
    for (const p of allPermissions) {
      if (!map[p.category]) map[p.category] = [];
      map[p.category].push(p);
    }
    return map;
  }, [allPermissions]);

  const categories = useMemo(() => Object.keys(permissionsByCategory), [permissionsByCategory]);

  const toggleRoleExpanded = (roleId: string) => {
    setExpandedRoles((prev) => ({ ...prev, [roleId]: !prev[roleId] }));
  };

  const handleOpenCreateModal = () => {
    setEditingRole(null);
    setRoleFormName("");
    setRoleFormDesc("");
    setSelectedPerms(new Set(["workspace.view", "submissions.view"]));
    setFormError(null);
    setCollapsedCategories({});
    setPermSearch("");
    setIsEditorOpen(true);
  };

  const handleOpenEditModal = (role: RoleItem) => {
    setEditingRole(role);
    setRoleFormName(role.name);
    setRoleFormDesc(role.description);
    setSelectedPerms(new Set(role.permissions));
    setFormError(null);
    setCollapsedCategories({});
    setPermSearch("");
    setIsEditorOpen(true);
  };

  const handleTogglePerm = (permId: string) => {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
  };

  const handleSelectAllInCategory = (category: string) => {
    const catPerms = permissionsByCategory[category] || [];
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      catPerms.forEach((p) => next.add(p.id));
      return next;
    });
  };

  const handleDeselectAllInCategory = (category: string) => {
    const catPerms = permissionsByCategory[category] || [];
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      catPerms.forEach((p) => next.delete(p.id));
      return next;
    });
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleFormName.trim()) {
      setFormError("Role name is required");
      return;
    }
    if (selectedPerms.size === 0) {
      setFormError("Select at least one permission for this role");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      if (editingRole) {
        await updateCustomRole(workspaceId, editingRole.id, {
          name: roleFormName.trim(),
          description: roleFormDesc.trim(),
          permissions: Array.from(selectedPerms),
        });
        setNotification({
          type: "success",
          message: `Custom role "${roleFormName.trim()}" updated successfully!`,
        });
      } else {
        await createCustomRole(workspaceId, {
          name: roleFormName.trim(),
          description: roleFormDesc.trim(),
          permissions: Array.from(selectedPerms),
        });
        setNotification({
          type: "success",
          message: `Custom role "${roleFormName.trim()}" created successfully!`,
        });
      }
      setIsEditorOpen(false);
      await loadRoles();
      onRolesUpdated?.();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save role");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDuplicate = async (role: RoleItem) => {
    try {
      const duplicated = await duplicateRole(workspaceId, role.id);
      setNotification({
        type: "success",
        message: `Role duplicated as "${duplicated.name}"!`,
      });
      await loadRoles();
      onRolesUpdated?.();
    } catch (err) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to duplicate role",
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!roleToDelete) return;
    setIsDeleting(true);
    try {
      await deleteCustomRole(workspaceId, roleToDelete.id);
      setNotification({
        type: "success",
        message: `Role "${roleToDelete.name}" was successfully deleted.`,
      });
      setRoleToDelete(null);
      await loadRoles();
      onRolesUpdated?.();
    } catch (err) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to delete role",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-amber-900/60 bg-amber-950/20 p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-amber-900/40 border border-amber-700/60 flex items-center justify-center mx-auto text-amber-300">
          <Lock className="w-6 h-6" />
        </div>
        <div className="max-w-md mx-auto">
          <h3 className="text-base font-bold text-white">Administrator Access Required</h3>
          <p className="text-xs text-slate-400 mt-1">
            Custom roles and permission configurations are restricted to workspace administrators. Contact your organization administrator to request permission changes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-purple-950/30 border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-violet-400" />
            <h2 className="text-lg font-bold text-white tracking-tight">Roles & Permissions</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-violet-950/80 text-violet-300 border border-violet-800/60">
              Workspace-Scoped RBAC
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Configure access control for <strong className="text-slate-200">{workspaceName}</strong>. Manage built-in enterprise tiers or create granular custom roles with tailored verification and review privileges.
          </p>
        </div>

        <Button
          onClick={handleOpenCreateModal}
          className="bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-950/50 cursor-pointer self-start sm:self-auto shrink-0"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          <span>Create Custom Role</span>
        </Button>
      </div>

      {/* Notifications */}
      {notification && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-medium transition-all ${
            notification.type === "success"
              ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300"
              : "bg-rose-950/40 border-rose-800/60 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-white cursor-pointer ml-4"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* SECTION 1: CUSTOM ROLES */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Workspace Custom Roles</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
                {customRoles.length}
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Custom authorization tiers scoped exclusively to this organization.
            </p>
          </div>
        </div>

        {customRoles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/20 p-8 text-center space-y-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center mx-auto text-slate-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-300">No Custom Roles Created</p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                Create tailored roles with selective verification, review, and evidence permissions or clone a built-in role below.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenCreateModal}
              className="text-xs cursor-pointer border-slate-700 hover:border-cyan-500 text-slate-300 hover:text-white"
            >
              <Plus className="w-3.5 h-3.5 mr-1 text-cyan-400" />
              Create First Custom Role
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {customRoles.map((role) => {
              const isExpanded = Boolean(expandedRoles[role.id]);
              return (
                <div
                  key={role.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 transition-all overflow-hidden"
                >
                  <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-white">{role.name}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
                          Custom
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800/80 text-slate-300 border border-slate-700/60">
                          <Users className="w-3 h-3 text-slate-400" />
                          <span>{role.memberCount} {role.memberCount === 1 ? "member" : "members"}</span>
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-violet-950/60 text-violet-300 border border-violet-800/50">
                          {role.permissions.length} permissions
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2">
                        {role.description || "No description provided."}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => toggleRoleExpanded(role.id)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-800/40 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
                        title="View Permissions"
                      >
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        <span>{isExpanded ? "Hide" : "Permissions"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicate(role)}
                        className="p-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-800/40 text-slate-300 hover:text-white text-xs cursor-pointer transition-colors"
                        title="Duplicate Role"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(role)}
                        className="p-1.5 rounded-lg border border-slate-800 hover:border-cyan-800/80 bg-slate-800/40 text-cyan-300 hover:text-cyan-200 text-xs cursor-pointer transition-colors"
                        title="Edit Role"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setRoleToDelete(role)}
                        className="p-1.5 rounded-lg border border-slate-800 hover:border-rose-900/60 bg-slate-800/40 text-rose-400 hover:text-rose-300 text-xs cursor-pointer transition-colors"
                        title="Delete Role"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded permissions matrix */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 border-t border-slate-800/70 bg-slate-950/40 space-y-3 animate-in fade-in duration-200">
                      <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                        Assigned Permissions ({role.permissions.length})
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {role.permissions.map((permId) => {
                          const pDef = allPermissions.find((p) => p.id === permId);
                          return (
                            <span
                              key={permId}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono border ${
                                pDef?.isDangerous
                                  ? "bg-amber-950/50 text-amber-300 border-amber-800/60"
                                  : "bg-slate-800/80 text-slate-200 border-slate-700/60"
                              }`}
                              title={pDef?.description || permId}
                            >
                              {pDef?.isDangerous && <AlertTriangle className="w-3 h-3 text-amber-400" />}
                              <span>{pDef?.name || permId}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: BUILT-IN ENTERPRISE ROLES */}
      <div className="space-y-4 pt-4 border-t border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-violet-400" />
            <span>Built-in Enterprise Roles</span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              5 System Tiers
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Preconfigured roles governed by BrandShield regulatory architecture. Protected against accidental deletion.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {builtInRoles.map((role) => {
            const isExpanded = Boolean(expandedRoles[role.id]);
            return (
              <div
                key={role.id}
                className="rounded-xl border border-slate-800/80 bg-slate-900/40 hover:border-slate-700/80 transition-all overflow-hidden"
              >
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-white">{role.name}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-violet-950/80 text-violet-300 border border-violet-800/60">
                        Built-in
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800/80 text-slate-300 border border-slate-700/60">
                        <Users className="w-3 h-3 text-slate-400" />
                        <span>{role.memberCount} {role.memberCount === 1 ? "member" : "members"}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800/50 text-slate-400 border border-slate-700/40">
                        {role.permissions.length} permissions
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2">{role.description}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => toggleRoleExpanded(role.id)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-800/40 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      <span>{isExpanded ? "Hide" : "Permissions"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDuplicate(role)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-800 hover:border-cyan-800/80 bg-slate-800/40 text-cyan-300 hover:text-cyan-200 text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
                      title="Clone as Custom Role"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Clone as Custom</span>
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 sm:p-5 border-t border-slate-800/70 bg-slate-950/40 space-y-3 animate-in fade-in duration-200">
                    <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                      Granted Permissions ({role.permissions.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {role.permissions.map((permId) => {
                        const pDef = allPermissions.find((p) => p.id === permId);
                        return (
                          <span
                            key={permId}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono border ${
                              pDef?.isDangerous
                                ? "bg-amber-950/50 text-amber-300 border-amber-800/60"
                                : "bg-slate-800/80 text-slate-200 border-slate-700/60"
                            }`}
                            title={pDef?.description || permId}
                          >
                            {pDef?.isDangerous && <AlertTriangle className="w-3 h-3 text-amber-400" />}
                            <span>{pDef?.name || permId}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL 1: CREATE / EDIT CUSTOM ROLE MODAL */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-violet-950/80 border border-violet-800/60 flex items-center justify-center text-violet-300">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingRole ? `Edit Role: ${editingRole.name}` : "Create Custom Role"}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Define granular privileges for workspace team members.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveRole} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
                {formError && (
                  <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Role Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-200 block">
                      Role Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Clinical Evidence Auditor"
                      value={roleFormName}
                      onChange={(e) => setRoleFormName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
                    />
                    <p className="text-[10px] text-slate-500">
                      Unique title for this role. Cannot duplicate existing roles or use reserved names.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-200 block">
                      Description <span className="text-slate-500 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Brief summary of duties and authority"
                      value={roleFormDesc}
                      onChange={(e) => setRoleFormDesc(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Permissions Selector Header */}
                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                          Categorized Permissions
                        </h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-violet-950/80 text-violet-300 border border-violet-800/60">
                          {selectedPerms.size} of {allPermissions.length} selected
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        High-risk permissions are highlighted with danger tags.
                      </p>
                    </div>

                    {/* Filter search */}
                    <div className="relative w-full sm:w-60">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search permissions..."
                        value={permSearch}
                        onChange={(e) => setPermSearch(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                      />
                    </div>
                  </div>

                  {/* Categories Accordions */}
                  <div className="space-y-3">
                    {categories.map((category) => {
                      const allCatPerms = permissionsByCategory[category] || [];
                      const filteredPerms = permSearch.trim()
                        ? allCatPerms.filter(
                            (p) =>
                              p.name.toLowerCase().includes(permSearch.toLowerCase()) ||
                              p.description.toLowerCase().includes(permSearch.toLowerCase()) ||
                              p.id.toLowerCase().includes(permSearch.toLowerCase())
                          )
                        : allCatPerms;

                      if (filteredPerms.length === 0) return null;

                      const selectedInCat = allCatPerms.filter((p) => selectedPerms.has(p.id)).length;
                      const isCollapsed = Boolean(collapsedCategories[category]);

                      return (
                        <div
                          key={category}
                          className="rounded-xl border border-slate-800/80 bg-slate-950/60 overflow-hidden"
                        >
                          <div className="p-3 bg-slate-900/60 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() =>
                                setCollapsedCategories((prev) => ({
                                  ...prev,
                                  [category]: !prev[category],
                                }))
                              }
                              className="flex items-center gap-2 text-xs font-bold text-slate-200 hover:text-white cursor-pointer"
                            >
                              {isCollapsed ? (
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-violet-400" />
                              )}
                              <span>{category}</span>
                              <span className="text-[10px] font-mono text-slate-400">
                                ({selectedInCat}/{allCatPerms.length})
                              </span>
                            </button>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleSelectAllInCategory(category)}
                                className="text-[11px] text-violet-400 hover:text-violet-300 font-medium cursor-pointer"
                              >
                                Select all
                              </button>
                              <span className="text-slate-600">·</span>
                              <button
                                type="button"
                                onClick={() => handleDeselectAllInCategory(category)}
                                className="text-[11px] text-slate-400 hover:text-slate-300 font-medium cursor-pointer"
                              >
                                Deselect all
                              </button>
                            </div>
                          </div>

                          {!isCollapsed && (
                            <div className="p-3.5 grid grid-cols-1 md:grid-cols-2 gap-2.5 divide-y md:divide-y-0 divide-slate-800/50">
                              {filteredPerms.map((perm) => {
                                const isChecked = selectedPerms.has(perm.id);
                                return (
                                  <label
                                    key={perm.id}
                                    className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors border ${
                                      isChecked
                                        ? "bg-violet-950/30 border-violet-800/40"
                                        : "hover:bg-slate-900/50 border-transparent"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleTogglePerm(perm.id)}
                                      className="mt-0.5 rounded border-slate-700 text-violet-600 focus:ring-violet-500 bg-slate-950 cursor-pointer"
                                    />
                                    <div className="space-y-0.5 min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-xs font-semibold text-white">
                                          {perm.name}
                                        </span>
                                        {perm.isDangerous && (
                                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-950/80 text-amber-300 border border-amber-800/60">
                                            <AlertTriangle className="w-2.5 h-2.5" />
                                            Dangerous
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[11px] text-slate-400 leading-relaxed">
                                        {perm.description}
                                      </p>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-end gap-2.5 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditorOpen(false)}
                  disabled={isSubmitting}
                  className="cursor-pointer border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-violet-600 hover:bg-violet-500 text-white cursor-pointer shadow-lg shadow-violet-950/50"
                >
                  {isSubmitting ? "Saving..." : editingRole ? "Save Changes" : "Create Role"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DELETE CONFIRMATION MODAL */}
      {roleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-800/60 flex items-center justify-center text-rose-300 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Custom Role</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Are you sure you want to delete role <strong className="text-white">"{roleToDelete.name}"</strong>?
                </p>
              </div>
            </div>

            {roleToDelete.memberCount > 0 ? (
              <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <span className="font-bold">Cannot delete assigned role:</span> {roleToDelete.memberCount} active member(s) are currently assigned to this role. You must reassign their roles in the <strong>Team & Members</strong> tab before deleting this role definition.
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-300 text-xs">
                This will permanently delete the role and its associated permission assignments. This action will be recorded in the immutable audit log.
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                onClick={() => setRoleToDelete(null)}
                disabled={isDeleting}
                className="cursor-pointer border-slate-700 text-slate-300 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteConfirm}
                disabled={isDeleting || roleToDelete.memberCount > 0}
                className="bg-rose-600 hover:bg-rose-500 text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? "Deleting..." : "Delete Role"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
