"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { RunHistoryItem } from "@/lib/types";

function getStatusStyle(status: string) {
  if (status === "completed") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "failed") return "bg-rose-50 text-rose-700 border-rose-200";
  if (status === "running") return "bg-blue-50 text-blue-700 border-blue-200";
  return "bg-slate-100 text-slate-500 border-slate-200";
}

function getHealthRateColor(rate: number) {
  if (rate >= 95) return "text-emerald-600";
  if (rate >= 80) return "text-amber-600";
  return "text-rose-600";
}

function formatDuration(ms: number | null) {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function HistoryPage() {
  const [runs, setRuns] = useState<RunHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<Record<string, { endpointKey: string; endpointName: string; component: string; surface: string; status: string; httpStatus: number | null; durationMs: number | null; errorMessage: string | null; createdAt: string }[]>>({});

  const pageSize = 20;

  const loadHistory = useCallback(async () => {
    try {
      const offset = (page - 1) * pageSize;
      const res = await fetch(`/api/runs?limit=${pageSize}&offset=${offset}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load history");
      const data = await res.json();
      setRuns(data.runs);
      setTotal(data.total);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  async function toggleExpand(runId: string) {
    if (expandedRun === runId) {
      setExpandedRun(null);
      return;
    }

    setExpandedRun(runId);

    if (!runDetail[runId]) {
      try {
        const res = await fetch(`/api/runs/${runId}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load run detail");
        const data = await res.json();
        setRunDetail((prev) => ({ ...prev, [runId]: data.results }));
      } catch {
        setRunDetail((prev) => ({ ...prev, [runId]: [] }));
      }
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f3f7fb]">
        <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8">
          <div className="flex h-64 items-center justify-center text-slate-400">Loading history...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f7fb]">
      <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8">
        {/* Header */}
        <div className="mb-8 flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500 text-white shadow-lg shadow-indigo-200">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-800">Run History</h1>
            <p className="mt-1 text-base text-slate-500">
              {total} total health check runs recorded
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-700">{error}</div>
        )}

        {/* Runs table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="text-left text-[11px] uppercase tracking-widest text-slate-500">
                <th className="w-8 px-4 py-3" />
                <th className="px-4 py-3 font-semibold">Run ID</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Health Rate</th>
                <th className="px-4 py-3 font-semibold">Checks</th>
                <th className="px-4 py-3 font-semibold">Healthy</th>
                <th className="px-4 py-3 font-semibold">Failed</th>
                <th className="px-4 py-3 font-semibold">Duration</th>
                <th className="px-4 py-3 font-semibold">Started</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <Fragment key={run.id}>
                  <tr
                    className={`border-t border-slate-100 text-sm text-slate-600 transition cursor-pointer hover:bg-slate-50/50 ${expandedRun === run.id ? "bg-slate-50" : ""}`}
                    onClick={() => toggleExpand(run.id)}
                  >
                    <td className="px-4 py-4 text-slate-400">
                      <svg
                        className={`h-4 w-4 transition-transform ${expandedRun === run.id ? "rotate-90" : ""}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs text-slate-500">{run.id.slice(0, 8)}...</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${getStatusStyle(run.status)}`}>
                        {run.status}
                      </span>
                    </td>
                    <td className={`px-4 py-4 font-semibold ${getHealthRateColor(run.healthRate)}`}>
                      {run.completedChecks > 0 ? `${run.healthRate.toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-4 py-4 text-slate-600">{run.completedChecks}/{run.totalChecks}</td>
                    <td className="px-4 py-4 font-semibold text-emerald-600">{run.healthyCount}</td>
                    <td className="px-4 py-4 font-semibold text-rose-600">{run.unhealthyCount}</td>
                    <td className="px-4 py-4 font-mono text-xs text-slate-500">{formatDuration(run.duration)}</td>
                    <td className="px-4 py-4 text-xs text-slate-500">
                      {new Date(run.startedAt).toLocaleString("en-IN", {
                        month: "short",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: false,
                      })}
                    </td>
                  </tr>

                  {/* Expanded detail */}
                  {expandedRun === run.id && (
                    <tr className="border-t border-slate-100">
                      <td colSpan={9} className="bg-slate-50/50 px-6 py-4">
                        {!runDetail[run.id] ? (
                          <p className="text-sm text-slate-400">Loading details...</p>
                        ) : runDetail[run.id].length === 0 ? (
                          <p className="text-sm text-slate-400">No results available for this run.</p>
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                            <table className="min-w-full text-xs">
                              <thead className="bg-slate-50">
                                <tr className="text-left uppercase tracking-wider text-slate-400">
                                  <th className="px-3 py-2">Endpoint</th>
                                  <th className="px-3 py-2">Component</th>
                                  <th className="px-3 py-2">Surface</th>
                                  <th className="px-3 py-2">Status</th>
                                  <th className="px-3 py-2">HTTP</th>
                                  <th className="px-3 py-2">Duration</th>
                                  <th className="px-3 py-2">Error</th>
                                </tr>
                              </thead>
                              <tbody>
                                {runDetail[run.id].map((r) => (
                                  <tr key={r.endpointKey} className="border-t border-slate-100 text-slate-600">
                                    <td className="px-3 py-2 font-medium text-slate-700">{r.endpointName}</td>
                                    <td className="px-3 py-2 text-slate-500">{r.component}</td>
                                    <td className="px-3 py-2 text-slate-500">{r.surface}</td>
                                    <td className="px-3 py-2">
                                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                                        r.status === "healthy"
                                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                          : r.status === "unhealthy"
                                            ? "bg-rose-50 text-rose-700 border-rose-200"
                                            : "bg-amber-50 text-amber-700 border-amber-200"
                                      }`}>
                                        {r.status}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 font-mono">{r.httpStatus ?? "—"}</td>
                                    <td className="px-3 py-2 font-mono">{r.durationMs !== null ? `${r.durationMs}ms` : "—"}</td>
                                    <td className="max-w-[200px] truncate px-3 py-2 text-rose-600" title={r.errorMessage ?? undefined}>
                                      {r.errorMessage ?? "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {runs.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center text-sm text-slate-400">
                    No health check runs recorded yet. Go to the{" "}
                    <Link href="/" className="text-blue-600 underline">Dashboard</Link> to run your first check.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {total > pageSize && (
            <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 text-sm text-slate-500">
              <p>
                Page <span className="font-semibold text-slate-700">{page}</span> of{" "}
                <span className="font-semibold text-slate-700">{totalPages}</span>{" "}
                ({total} runs)
              </p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage((c) => Math.max(1, c - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((c) => Math.min(totalPages, c + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
