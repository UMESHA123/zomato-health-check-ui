"use client";

import { useEffect, useState } from "react";
import type { DashboardEndpoint, HealthStatus } from "@/lib/types";

interface HealthSectionProps {
  endpoints: DashboardEndpoint[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

const PAGE_SIZE = 15;

function getStatusColor(status: HealthStatus | null) {
  if (status === "healthy") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "unhealthy") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "skipped") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-100 text-slate-500";
}

function getStatusIcon(status: HealthStatus | null) {
  if (status === "healthy") {
    return (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (status === "unhealthy") {
    return (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    );
  }
  if (status === "skipped") {
    return (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    );
  }
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  );
}

function getStatusLabel(status: HealthStatus | null) {
  if (!status) return "PENDING";
  return status.toUpperCase();
}

function getMethodBadge(method: string) {
  const colors: Record<string, string> = {
    GET: "bg-blue-50 text-blue-700 border-blue-200",
    POST: "bg-green-50 text-green-700 border-green-200",
    PUT: "bg-amber-50 text-amber-700 border-amber-200",
    DELETE: "bg-rose-50 text-rose-700 border-rose-200",
    PING: "bg-purple-50 text-purple-700 border-purple-200",
  };
  return colors[method] ?? "bg-slate-50 text-slate-600 border-slate-200";
}

function getSurfaceBadge(surface: string) {
  const colors: Record<string, string> = {
    frontend: "bg-indigo-50 text-indigo-700",
    backend: "bg-sky-50 text-sky-700",
    infrastructure: "bg-orange-50 text-orange-700",
    catalog: "bg-slate-50 text-slate-500",
  };
  return colors[surface] ?? "bg-slate-100 text-slate-500";
}

function formatDuration(ms: number | null) {
  if (ms === null || ms === undefined) return "—";
  if (ms === 0) return "0ms";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function getDurationColor(ms: number | null) {
  if (ms === null || ms === 0) return "text-slate-400";
  if (ms < 200) return "text-emerald-600";
  if (ms < 1000) return "text-amber-600";
  return "text-rose-600";
}

export function HealthSection({ endpoints, searchQuery, onSearchChange }: HealthSectionProps) {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [surfaceFilter, setSurfaceFilter] = useState<string>("all");
  const normalizedQuery = searchQuery.trim().toLowerCase();

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, surfaceFilter]);

  const filteredEndpoints = endpoints.filter((endpoint) => {
    // Status filter
    if (statusFilter !== "all") {
      const endpointStatus = endpoint.latestStatus ?? "pending";
      if (statusFilter !== endpointStatus) return false;
    }

    // Surface filter
    if (surfaceFilter !== "all" && endpoint.surface !== surfaceFilter) return false;

    // Text search
    if (normalizedQuery) {
      return [
        endpoint.component,
        endpoint.name,
        endpoint.routePath,
        endpoint.targetUrl ?? "",
        endpoint.method,
        getStatusLabel(endpoint.latestStatus),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    }

    return true;
  });

  const startIndex = (page - 1) * PAGE_SIZE;
  const rows = filteredEndpoints.slice(startIndex, startIndex + PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filteredEndpoints.length / PAGE_SIZE));

  // Counts for filter badges
  const statusCounts = {
    healthy: endpoints.filter((e) => e.latestStatus === "healthy").length,
    unhealthy: endpoints.filter((e) => e.latestStatus === "unhealthy").length,
    skipped: endpoints.filter((e) => e.latestStatus === "skipped").length,
    pending: endpoints.filter((e) => !e.latestStatus).length,
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-800">Health Ledger</h2>
          <p className="mt-0.5 text-sm text-slate-500">All registered endpoints and their latest check results</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <label className="flex min-w-[240px] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500">
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search endpoints..."
              className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
          </label>

          {/* Surface filter */}
          <select
            value={surfaceFilter}
            onChange={(e) => setSurfaceFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none"
          >
            <option value="all">All Surfaces</option>
            <option value="frontend">Frontend</option>
            <option value="backend">Backend</option>
            <option value="infrastructure">Infrastructure</option>
            <option value="catalog">Catalog</option>
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none"
          >
            <option value="all">All Status</option>
            <option value="healthy">Healthy ({statusCounts.healthy})</option>
            <option value="unhealthy">Unhealthy ({statusCounts.unhealthy})</option>
            <option value="skipped">Skipped ({statusCounts.skipped})</option>
            <option value="pending">Pending ({statusCounts.pending})</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-slate-50">
            <tr className="text-left text-[11px] uppercase tracking-widest text-slate-500">
              <th className="px-4 py-3 font-semibold">#</th>
              <th className="px-4 py-3 font-semibold">Endpoint</th>
              <th className="px-4 py-3 font-semibold">URL / Target</th>
              <th className="px-4 py-3 font-semibold">Method</th>
              <th className="px-4 py-3 font-semibold">Surface</th>
              <th className="px-4 py-3 font-semibold">Response Time</th>
              <th className="px-4 py-3 font-semibold">HTTP Code</th>
              <th className="px-4 py-3 font-semibold">Last Checked</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((endpoint, localIndex) => {
              const globalIndex = startIndex + localIndex;
              return (
                <tr
                  key={endpoint.endpointKey}
                  className="border-t border-slate-100 text-sm text-slate-600 transition hover:bg-slate-50/50"
                >
                  {/* Global ID */}
                  <td className="px-4 py-4 font-mono text-xs text-slate-400">
                    {String(globalIndex + 1).padStart(2, "0")}
                  </td>

                  {/* Endpoint name + component */}
                  <td className="px-4 py-4">
                    <div className="font-semibold text-slate-700">{endpoint.name}</div>
                    <div className="mt-0.5 text-xs text-slate-400">{endpoint.component}</div>
                  </td>

                  {/* URL */}
                  <td className="max-w-[280px] px-4 py-4">
                    <span className="block truncate font-mono text-xs text-slate-500">
                      {endpoint.targetUrl ?? endpoint.routePath}
                    </span>
                  </td>

                  {/* Method */}
                  <td className="px-4 py-4">
                    <span className={`inline-block rounded border px-2 py-0.5 text-[10px] font-bold ${getMethodBadge(endpoint.method)}`}>
                      {endpoint.method}
                    </span>
                  </td>

                  {/* Surface */}
                  <td className="px-4 py-4">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${getSurfaceBadge(endpoint.surface)}`}>
                      {endpoint.surface}
                    </span>
                  </td>

                  {/* Response time */}
                  <td className={`px-4 py-4 font-mono text-xs font-semibold ${getDurationColor(endpoint.latestDurationMs)}`}>
                    {formatDuration(endpoint.latestDurationMs)}
                  </td>

                  {/* HTTP code */}
                  <td className="px-4 py-4 font-mono text-xs text-slate-500">
                    {endpoint.latestHttpStatus ?? "—"}
                  </td>

                  {/* Last checked */}
                  <td className="px-4 py-4 text-xs text-slate-500">
                    {endpoint.latestCreatedAt
                      ? new Date(endpoint.latestCreatedAt).toLocaleString("en-IN", {
                          month: "short",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: false,
                        })
                      : "—"}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusColor(endpoint.latestStatus)}`}
                      title={endpoint.latestErrorMessage ?? undefined}
                    >
                      {getStatusIcon(endpoint.latestStatus)}
                      {getStatusLabel(endpoint.latestStatus)}
                    </span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-sm text-slate-400">
                  No endpoints matched your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
        <p>
          Showing <span className="font-semibold text-slate-700">{startIndex + 1}</span>–
          <span className="font-semibold text-slate-700">{Math.min(startIndex + PAGE_SIZE, filteredEndpoints.length)}</span>{" "}
          of <span className="font-semibold text-slate-700">{filteredEndpoints.length}</span> endpoints
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            First
          </button>
          <button
            type="button"
            onClick={() => setPage((c) => Math.max(1, c - 1))}
            disabled={page === 1}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Prev
          </button>
          <span className="rounded-lg bg-[#3b82f6] px-3 py-1.5 text-xs font-semibold text-white">{page}</span>
          <span className="text-xs text-slate-400">of {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((c) => Math.min(totalPages, c + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
          <button
            type="button"
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Last
          </button>
        </div>
      </div>
    </section>
  );
}
