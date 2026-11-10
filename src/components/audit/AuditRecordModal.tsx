"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AuditLogItem } from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils/formatters";
import { AuditMetadataRenderer, CopyableUuid } from "./AuditMetadataRenderer";
import { AuditCodeViewer } from "./AuditCodeViewer";
import {
  X,
  Lock,
  User,
  Shield,
  Layers,
  Calendar,
  ExternalLink,
  ChevronRight,
  FileCheck2,
} from "lucide-react";

interface AuditRecordModalProps {
  event: AuditLogItem | null;
  onClose: () => void;
  getActionBadgeColor: (action: string) => string;
}

export function AuditRecordModal({
  event,
  onClose,
  getActionBadgeColor,
}: AuditRecordModalProps) {
  const [activeTab, setActiveTab] = useState<"after" | "before">("after");

  if (!event) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#090D16]/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="bg-[#0B0F19] rounded-2xl border border-slate-700/80 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden text-slate-100">
        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-slate-800 flex items-start justify-between bg-slate-900/40">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-2.5 py-0.5 rounded text-xs font-semibold border ${getActionBadgeColor(
                  event.action
                )}`}
              >
                {event.action.replace(/_/g, " ").toUpperCase()}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Event ID:
              </span>
              <CopyableUuid uuid={event.id} label="Event ID" />
            </div>

            <h3 id="audit-modal-title" className="text-lg font-bold text-white mt-1.5 tracking-tight flex items-center gap-2">
              <span>Audit Record Details</span>
              <span className="text-[11px] font-normal text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Immutable Ledger Record
              </span>
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-5 text-xs">
          {/* Provenance Context Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
            <div>
              <span className="text-slate-400 block text-[11px] uppercase tracking-wider font-semibold">
                Actor Identity
              </span>
              <div className="font-semibold text-white mt-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                <span className="break-all">{event.actor_id}</span>
              </div>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px] uppercase tracking-wider font-semibold">
                Actor Role
              </span>
              <div className="font-semibold text-white mt-1 capitalize flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>
                  {String(
                    event.actor_role ||
                      event.after_state?.reviewer_role ||
                      event.after_state?.actor_role ||
                      "System / Reviewer"
                  )}
                </span>
              </div>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px] uppercase tracking-wider font-semibold">
                Target Entity Type
              </span>
              <div className="font-semibold text-white mt-1 capitalize flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{event.entity_type.replace(/_/g, " ")}</span>
              </div>
            </div>

            <div className="sm:col-span-2">
              <span className="text-slate-400 block text-[11px] uppercase tracking-wider font-semibold">
                Target Entity ID
              </span>
              <div className="mt-1">
                <CopyableUuid uuid={event.entity_id} label="Entity ID" />
              </div>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px] uppercase tracking-wider font-semibold">
                Exact Timestamp (UTC)
              </span>
              <div className="font-semibold text-slate-200 mt-1 flex items-center gap-1.5 font-mono">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{formatDateTime(event.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Pre-Change vs Recorded State Selector (if before_state exists) */}
          {event.before_state && (
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTab("after")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    activeTab === "after"
                      ? "bg-violet-600 text-white shadow-sm"
                      : "bg-slate-900 text-slate-400 hover:text-white"
                  }`}
                >
                  Recorded State (After)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("before")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    activeTab === "before"
                      ? "bg-violet-600 text-white shadow-sm"
                      : "bg-slate-900 text-slate-400 hover:text-white"
                  }`}
                >
                  Pre-Change State (Before)
                </button>
              </div>

              <span className="text-[11px] text-slate-500 italic">
                Showing {activeTab === "after" ? "resulting" : "prior"} state
              </span>
            </div>
          )}

          {/* Structured Human-Readable Metadata Presentation */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <FileCheck2 className="w-4 h-4 text-violet-400" />
                <span>
                  {activeTab === "after"
                    ? "Structured Audit Metadata"
                    : "Prior State Metadata"}
                </span>
              </h4>
            </div>

            <AuditMetadataRenderer
              metadata={
                activeTab === "after" ? event.after_state : event.before_state
              }
              emptyMessage={
                activeTab === "after"
                  ? "No post-action metadata recorded for this event."
                  : "No pre-action state captured for this event."
              }
            />
          </div>

          {/* Expandable Technical Metadata (Raw JSON Viewer with Copy action) */}
          <AuditCodeViewer
            data={event.after_state}
            beforeData={event.before_state}
            title="Technical Metadata (Raw JSON)"
            defaultExpanded={false}
          />
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-900/60 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-500" />
            Append-only sealed in PostgreSQL. Modification blocked by database trigger.
          </span>

          <div className="flex items-center gap-2">
            {event.entity_type === "claim" && (
              <Link
                href="/reviews"
                className="px-3 py-1.5 bg-violet-950/80 hover:bg-violet-900 border border-violet-800/60 text-violet-300 font-semibold rounded-xl text-xs transition-colors"
              >
                View in Review Queue
              </Link>
            )}

            {event.entity_type === "submission" && (
              <Link
                href="/submissions"
                className="px-3 py-1.5 bg-violet-950/80 hover:bg-violet-900 border border-violet-800/60 text-violet-300 font-semibold rounded-xl text-xs transition-colors"
              >
                View Submissions
              </Link>
            )}

            {(event.entity_type === "document" ||
              event.entity_type === "source_document") && (
              <Link
                href="/sources"
                className="px-3 py-1.5 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800/60 text-cyan-300 font-semibold rounded-xl text-xs transition-colors"
              >
                View Evidence Library
              </Link>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl text-xs cursor-pointer border border-slate-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
