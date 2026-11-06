"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { HistoryIcon, CheckCircleIcon, ShieldAlertIcon } from "@/components/ui/Icons";
import { fetchAuditEvents, AuditLogItem } from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils/formatters";

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
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    }
    if (action.includes("overridden") || action.includes("escalated")) {
      return "bg-amber-50 text-amber-800 border-amber-200";
    }
    if (action.includes("rejected") || action.includes("modified")) {
      return "bg-rose-50 text-rose-800 border-rose-200";
    }
    if (action.includes("evidence") || action.includes("chunk")) {
      return "bg-cyan-50 text-cyan-800 border-cyan-200";
    }
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Governance & Tamper-Evident Audit History
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
              Append-Only Immutability
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Immutable log of all claim verifications, reviewer sign-offs, policy overrides, and publication transitions.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-medium text-slate-500">Total Audit Events</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {isLoading ? "..." : stats.total_events} Records
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Append-only database triggers active</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-medium text-slate-500">Human Governance Sign-offs</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">
            {isLoading ? "..." : stats.human_signoffs} Decisions
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Audited compliance reviews & overrides</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-medium text-slate-500">Documented Policy Overrides</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">
            {isLoading ? "..." : stats.policy_overrides || 0} Events
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Documented regulatory justifications</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-medium text-slate-500">Ledger Security</div>
          <div className="text-2xl font-bold text-indigo-700 mt-1">Enforced</div>
          <div className="text-[11px] text-slate-400 mt-1">UPDATE & DELETE queries blocked at engine level</div>
        </div>
      </div>

      {/* Search & Comprehensive Filters Bar */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
        {/* Search input */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search audit trail by keyword, actor, action, or metadata..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Filter by actor..."
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              className="w-36 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />

            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              title="Start Date"
              className="px-2.5 py-2 text-xs border border-slate-200 rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              title="End Date"
              className="px-2.5 py-2 text-xs border border-slate-200 rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />

            {(search || entityFilter !== "all" || actionFilter !== "all" || actorFilter || startDate || endDate) && (
              <button
                onClick={resetFilters}
                className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Entity & Action Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-400 font-medium">Entity:</span>
          {["all", "claim", "submission", "document", "source_document"].map((ent) => (
            <button
              key={ent}
              onClick={() => setEntityFilter(ent)}
              className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors capitalize ${
                entityFilter === ent
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {ent.replace(/_/g, " ")}
            </button>
          ))}

          <span className="text-slate-300 mx-1">|</span>

          <span className="text-slate-400 font-medium">Action:</span>
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
              className={`px-2 py-0.5 rounded-md font-medium cursor-pointer transition-colors ${
                actionFilter === act
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {act.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Event Stream */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Detailed Audit Event Stream</CardTitle>
              <CardDescription>
                Chronological log of changes, verifications, and approvals for workspace DermaGlow. Click any row for complete event metadata.
              </CardDescription>
            </div>
            <div className="text-xs text-slate-400 font-medium">
              Showing {events.length} event(s)
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="py-16 text-center text-slate-400 text-xs">Loading live audit events...</div>
          ) : error ? (
            <div className="p-4 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-200">{error}</div>
          ) : events.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <p className="font-semibold text-slate-600 mb-1">No audit events match the selected criteria.</p>
              <p className="text-slate-400">Try adjusting your search keywords, action pills, or date range.</p>
              <button
                onClick={resetFilters}
                className="mt-3 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded-lg transition-colors cursor-pointer"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {events.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => setSelectedEvent(ev)}
                  className="py-3.5 first:pt-0 last:pb-0 flex items-start gap-3.5 text-xs hover:bg-slate-50/70 p-2 rounded-lg cursor-pointer transition-colors group"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0 mt-0.5">
                    {ev.action.includes("approved") || ev.action.includes("published") ? (
                      <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
                    ) : ev.action.includes("escalated") || ev.action.includes("overridden") ? (
                      <ShieldAlertIcon className="w-4 h-4 text-amber-600" />
                    ) : (
                      <HistoryIcon className="w-4 h-4 text-indigo-600" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getActionBadgeColor(ev.action)}`}>
                          {ev.action.replace(/_/g, " ").toUpperCase()}
                        </span>
                        <span className="text-slate-500 font-medium">
                          Entity: <strong className="text-slate-800 capitalize">{ev.entity_type}</strong> (
                          <span className="font-mono text-slate-600">{ev.entity_id.slice(0, 8)}...</span>)
                        </span>
                      </div>

                      <span className="text-[11px] text-slate-400 whitespace-nowrap">
                        {formatDateTime(ev.created_at)}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-2 text-slate-600">
                      <span>Actor:</span>
                      <strong className="text-slate-900">{ev.actor_id}</strong>
                      {Boolean(ev.after_state?.reviewer_role) && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                          Role: {String(ev.after_state?.reviewer_role)}
                        </span>
                      )}
                    </div>

                    {ev.after_state && (
                      <div className="mt-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-[11px] text-slate-700 overflow-x-auto group-hover:border-slate-300 transition-colors">
                        {JSON.stringify(ev.after_state).slice(0, 160)}
                        {JSON.stringify(ev.after_state).length > 160 ? "..." : ""}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded text-xs font-semibold border ${getActionBadgeColor(selectedEvent.action)}`}>
                    {selectedEvent.action.replace(/_/g, " ").toUpperCase()}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    ID: {selectedEvent.id}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  Audit Record Details
                </h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400">Actor Identity:</span>
                  <div className="font-semibold text-slate-800">{selectedEvent.actor_id}</div>
                </div>
                <div>
                  <span className="text-slate-400">Actor Role:</span>
                  <div className="font-semibold text-slate-800 capitalize">
                    {String(selectedEvent.after_state?.reviewer_role || "System / Reviewer")}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Target Entity Type:</span>
                  <div className="font-semibold text-slate-800 capitalize">{selectedEvent.entity_type}</div>
                </div>
                <div>
                  <span className="text-slate-400">Target Entity UUID:</span>
                  <div className="font-mono text-slate-800 break-all">{selectedEvent.entity_id}</div>
                </div>
                <div>
                  <span className="text-slate-400">Exact Timestamp (UTC):</span>
                  <div className="font-semibold text-slate-800">{formatDateTime(selectedEvent.created_at)}</div>
                </div>
                <div>
                  <span className="text-slate-400">Ledger Immutability:</span>
                  <div className="font-semibold text-emerald-700">Append-Only Verified</div>
                </div>
              </div>

              {selectedEvent.before_state && (
                <div>
                  <span className="font-semibold text-slate-700">Pre-Change State (Before):</span>
                  <pre className="mt-1 p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] overflow-x-auto">
                    {JSON.stringify(selectedEvent.before_state, null, 2)}
                  </pre>
                </div>
              )}

              <div>
                <span className="font-semibold text-slate-700">Recorded State & Metadata (After):</span>
                <pre className="mt-1 p-3 bg-slate-900 text-emerald-300 rounded-xl font-mono text-[11px] overflow-x-auto">
                  {JSON.stringify(selectedEvent.after_state, null, 2)}
                </pre>
              </div>

              {/* Entity Navigation link if claim or submission */}
              <div className="pt-2 flex justify-between items-center border-t border-slate-100">
                <span className="text-[11px] text-slate-400">
                  Tamper-evident record sealed in PostgreSQL.
                </span>

                <div className="flex gap-2">
                  {selectedEvent.entity_type === "claim" && (
                    <Link
                      href="/reviews"
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg text-xs"
                    >
                      View in Review Queue
                    </Link>
                  )}
                  {selectedEvent.entity_type === "submission" && (
                    <Link
                      href="/submissions"
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg text-xs"
                    >
                      View Submissions
                    </Link>
                  )}
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-lg text-xs cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
