"use client";

import React, { useState, useEffect, useRef } from "react";
import { Building2, ChevronDown, Check, Plus, Shield } from "lucide-react";
import { fetchWorkspaces, WorkspaceItem } from "@/lib/api-client";
import { CreateOrganizationModal } from "./CreateOrganizationModal";

interface WorkspaceSwitcherProps {
  currentSlug?: string;
  onWorkspaceChange?: (workspace: WorkspaceItem) => void;
}

export function WorkspaceSwitcher({
  currentSlug = "dermaglow",
  onWorkspaceChange,
}: WorkspaceSwitcherProps) {
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceItem | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadWorkspaces = async () => {
    try {
      const data = await fetchWorkspaces();
      setWorkspaces(data);
      const active = data.find((w) => w.slug === currentSlug) || data[0] || null;
      setActiveWorkspace(active);
    } catch {
      // Fallback workspace
      const fallback: WorkspaceItem = {
        id: "00000000-0000-0000-0000-000000000001",
        name: "DermaGlow",
        slug: "dermaglow",
        role: "compliance_reviewer",
        status: "active",
        createdAt: new Date().toISOString(),
        memberCount: 3,
      };
      setWorkspaces([fallback]);
      setActiveWorkspace(fallback);
    }
  };

  useEffect(() => {
    loadWorkspaces();
  }, [currentSlug]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectWorkspace = (ws: WorkspaceItem) => {
    setActiveWorkspace(ws);
    setIsOpen(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("active_workspace_slug", ws.slug);
      localStorage.setItem("active_workspace_id", ws.id);
    }
    if (onWorkspaceChange) {
      onWorkspaceChange(ws);
    }
  };

  const handleWorkspaceCreated = (newWs: { id: string; name: string; slug: string }) => {
    loadWorkspaces();
    const item: WorkspaceItem = {
      id: newWs.id,
      name: newWs.name,
      slug: newWs.slug,
      role: "admin",
      status: "active",
      createdAt: new Date().toISOString(),
      memberCount: 1,
    };
    handleSelectWorkspace(item);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1 bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-lg text-slate-300 transition-all cursor-pointer group"
        aria-label="Switch organization workspace"
      >
        <Building2 className="w-3.5 h-3.5 text-violet-400 group-hover:text-violet-300 transition-colors" />
        <span className="text-[11px] text-slate-400 hidden sm:inline">Workspace:</span>
        <strong className="text-xs text-white font-semibold tracking-tight">
          {activeWorkspace?.name || "DermaGlow"}
        </strong>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-violet-400" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-64 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2.5 py-1.5 border-b border-slate-800 text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center justify-between">
            <span>Your Organizations</span>
            <span className="text-[9px] font-mono text-cyan-400">
              {workspaces.length} active
            </span>
          </div>

          <div className="py-1 max-h-56 overflow-y-auto space-y-1">
            {workspaces.map((ws) => {
              const isSelected = activeWorkspace?.id === ws.id;
              return (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => handleSelectWorkspace(ws)}
                  className={`w-full p-2 rounded-lg text-left transition-all flex items-center justify-between group cursor-pointer ${
                    isSelected
                      ? "bg-violet-950/40 border border-violet-800/60"
                      : "hover:bg-slate-800/60 border border-transparent"
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-white group-hover:text-violet-300 transition-colors truncate">
                        {ws.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                      <span className="capitalize text-slate-400">
                        {ws.role.replace(/_/g, " ")}
                      </span>
                      <span>·</span>
                      <span>{ws.memberCount} member{ws.memberCount === 1 ? "" : "s"}</span>
                    </div>
                  </div>

                  {isSelected && (
                    <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-1.5 mt-1 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsCreateModalOpen(true);
              }}
              className="w-full py-1.5 px-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 hover:border-violet-500/50 text-[11px] font-semibold text-violet-300 hover:text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New Organization</span>
            </button>
          </div>
        </div>
      )}

      <CreateOrganizationModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={handleWorkspaceCreated}
      />
    </div>
  );
}
