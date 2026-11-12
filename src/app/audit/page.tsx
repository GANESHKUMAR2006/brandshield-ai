"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { fetchAuditEvents, AuditLogItem } from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils/formatters";
import { AuditEventSummary } from "@/components/audit/AuditEventSummary";
import { AuditRecordModal } from "@/components/audit/AuditRecordModal";
import {
  History,
  CheckCircle2,
  ShieldAlert,
  Search,
  Filter,
  X,
  FileCheck2,
  Lock,
  ArrowRight,
  Download,
} from "lucide-react";

export default function AuditPage() {
  const [events, setEvents] = useState<AuditLogItem[]>([]);
  const [stats, setStats] = useState<{
    total_events: number;
    human_signoffs: number;
    policy_overrides?: number;
    publication_events?: number;
  }>({
    total_events: 0,
    human_signoffs: 0,
    policy_overrides: 0,
    publication_events: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [actorFilter, setActorFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Event Detail Modal State
  const [selectedEvent, setSelectedEvent] = useState<AuditLogItem | null>(null);

  useEffect(() => {
    let isMounted = true;

    fetchAuditEvents({
      search: search.trim() ? search.trim() : undefined,
      entityType: entityFilter !== "all" ? entityFilter : undefined,
      action: actionFilter !== "all" ? actionFilter : undefined,
      actorId: actorFilter.trim() ? actorFilter.trim() : undefined,
      startDate: startDate ? startDate : undefined,
      endDate: endDate ? endDate : undefined,
    })
      .then((res) => {
        if (isMounted) {
          setEvents(res.data);
          setStats(res.stats);
          setError(null);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load audit trail");
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [search, entityFilter, actionFilter, actorFilter, startDate, endDate]);

  const resetFilters = () => {
    setSearch("");
    setEntityFilter("all");
    setActionFilter("all");
    setActorFilter("");
    setStartDate("");
    setEndDate("");
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes("approved") || action.includes("published")) {
      return "bg-emerald-950/80 text-emerald-300 border-emerald-800/60 shadow-[0_0_6px_rgba(52,211,153,0.25)]";
    }
    if (action.includes("overridden") || action.includes("escalated")) {
      return "bg-amber-950/80 text-amber-300 border-amber-800/60";
    }
    if (action.includes("rejected") || action.includes("modified")) {
      return "bg-rose-950/80 text-rose-300 border-rose-800/60";
    }
    if (action.includes("evidence") || action.includes("chunk")) {
      return "bg-cyan-950/80 text-cyan-300 border-cyan-800/60";
    }
    return "bg-slate-800 text-slate-300 border-slate-700";
  };

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Governance & Tamper-Evident Audit History
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 shadow-[0_0_8px_rgba(52,211,153,0.3)] flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-emerald-400" />
              Append-Only Immutability
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Immutable log of all claim verifications, reviewer sign-offs, policy overrides, and publication transitions.
          </p>
        </div>
        <button
          data-tour="audit-export-btn"
          onClick={() => {
            const blob = new Blob([JSON.stringify(events, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `brandshield-audit-export-${new Date().toISOString().split("T")[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white transition-all shadow-md cursor-pointer self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5 text-cyan-400" />
          <span>Export Audit Ledger</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-lg">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Audit Events</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1.5 tracking-tight">
            {isLoading ? "..." : stats.total_events} Records
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Append-only database triggers active</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-lg">
          <div className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">Human Governance Sign-offs</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-300 mt-1.5 tracking-tight">
            {isLoading ? "..." : stats.human_signoffs} Decisions
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Audited compliance reviews & overrides</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-lg">
          <div className="text-xs font-semibold text-amber-300 uppercase tracking-wider">Documented Policy Overrides</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-300 mt-1.5 tracking-tight">
            {isLoading ? "..." : stats.policy_overrides || 0} Events
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Documented regulatory justifications</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-lg">
          <div className="text-xs font-semibold text-violet-300 uppercase tracking-wider">Ledger Security</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-violet-300 mt-1.5 tracking-tight">Enforced</div>
          <div className="text-[11px] text-slate-400 mt-1">UPDATE & DELETE queries blocked at engine level</div>
        </div>
      </div>

      {/* Search & Comprehensive Filters Bar */}
      <div data-tour="audit-filters" className="p-4 bg-slate-900/60 backdrop-blur-md rounded-xl border border-slate-800/80 shadow-lg space-y-3">
        {/* Search input */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search audit trail by keyword, actor, action, or metadata..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs border border-slate-700 rounded-xl bg-slate-950 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 shadow-inner"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Filter by actor..."
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              className="w-36 px-3 py-2 text-xs border border-slate-700 rounded-xl bg-slate-950 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 shadow-inner"
            />

            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              title="Start Date"
              className="px-2.5 py-2 text-xs border border-slate-700 rounded-xl bg-slate-950 text-slate-200 focus:outline-none focus:border-violet-500 shadow-inner"
            />
            <span className="text-slate-500 text-xs">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              title="End Date"
              className="px-2.5 py-2 text-xs border border-slate-700 rounded-xl bg-slate-950 text-slate-200 focus:outline-none focus:border-violet-500 shadow-inner"
            />

            {(search || entityFilter !== "all" || actionFilter !== "all" || actorFilter || startDate || endDate) && (
              <button
                onClick={resetFilters}
                className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer border border-slate-700"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Entity & Action Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-slate-800 text-xs">
          <span className="text-slate-400 font-semibold uppercase text-[10px]">Entity:</span>
          {["all", "claim", "submission", "document", "source_document"].map((ent) => (
            <button
              key={ent}
              onClick={() => setEntityFilter(ent)}
              className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-all capitalize text-xs ${
                entityFilter === ent
                  ? "bg-violet-600 text-white shadow-md shadow-violet-950/60"
                  : "bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {ent.replace(/_/g, " ")}
            </button>
          ))}

          <span className="text-slate-700 mx-1">|</span>

          <span className="text-slate-400 font-semibold uppercase text-[10px]">Action:</span>
          {[
            "all",
            "claim_reviewed",
            "claim_approved",
            "claim_rejected",
            "claim_modified",
            "claim_escalated",
            "claim_overridden",
            "claim_evidence_linked",
            "document_chunks_ingested",
            "publication_status_updated",
          ].map((act) => (
            <button
              key={act}
              onClick={() => setActionFilter(act)}
              className={`px-2 py-0.5 rounded-md font-medium cursor-pointer transition-all text-xs ${
                actionFilter === act
                  ? "bg-violet-600 text-white shadow-md shadow-violet-950/60"
                  : "bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {act.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Event Stream Card */}
      <div data-tour="audit-events-table" className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-xl overflow-hidden">
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Detailed Audit Event Stream</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Chronological log of changes, verifications, and approvals for workspace DermaGlow. Click any row for complete event metadata.
            </p>
          </div>
          <span className="text-[11px] font-semibold text-violet-300 bg-violet-950/60 border border-violet-800/60 px-2.5 py-0.5 rounded-full">
            Showing {events.length} event(s)
          </span>
        </div>

        <div className="p-5">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading live audit events...
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-950/40 text-rose-300 text-xs rounded-xl border border-rose-800/60">{error}</div>
          ) : events.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <p className="font-semibold text-white mb-1">No audit events match the selected criteria.</p>
              <p className="text-slate-400">Try adjusting your search keywords, action pills, or date range.</p>
              <button
                onClick={resetFilters}
                className="mt-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-xl transition-colors cursor-pointer border border-slate-700"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {events.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => setSelectedEvent(ev)}
                  className="py-3.5 first:pt-0 last:pb-0 flex items-start gap-3.5 text-xs hover:bg-slate-800/40 p-2.5 rounded-xl cursor-pointer transition-colors group"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400 shrink-0 mt-0.5 shadow-inner">
                    {ev.action.includes("approved") || ev.action.includes("published") ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : ev.action.includes("escalated") || ev.action.includes("overridden") ? (
                      <ShieldAlert className="w-4 h-4 text-amber-400" />
                    ) : (
                      <History className="w-4 h-4 text-violet-400" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getActionBadgeColor(ev.action)}`}>
                          {ev.action.replace(/_/g, " ").toUpperCase()}
                        </span>
                        <span className="text-slate-400 font-medium">
                          Entity: <strong className="text-white capitalize">{ev.entity_type}</strong> (
                          <span className="font-mono text-cyan-300">{ev.entity_id.slice(0, 8)}...</span>)
                        </span>
                      </div>

                      <span className="text-[11px] text-slate-500 whitespace-nowrap">
                        {formatDateTime(ev.created_at)}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-2 text-slate-400">
                      <span>Actor:</span>
                      <strong className="text-slate-200">{ev.actor_id}</strong>
                      {Boolean(ev.after_state?.reviewer_role) && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-slate-300 border border-slate-700 rounded">
                          Role: {String(ev.after_state?.reviewer_role)}
                        </span>
                      )}
                    </div>

                    <AuditEventSummary
                      action={ev.action}
                      metadata={ev.after_state}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <AuditRecordModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          getActionBadgeColor={getActionBadgeColor}
        />
      )}
    </AppLayout>
  );
}
