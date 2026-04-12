"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HealthSection } from "@/components/health-section";
import { SummaryCards, toGroupKey } from "@/components/summary-cards";
import type { DashboardEndpoint, DashboardPayload } from "@/lib/types";

const POLL_INTERVAL_ACTIVE = 1200;
const POLL_INTERVAL_IDLE = 15000;

async function getDashboard(runId?: string) {
  const url = runId ? `/api/dashboard?runId=${runId}` : "/api/dashboard";
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("Failed to load dashboard data.");
  return (await response.json()) as DashboardPayload;
}

export function DashboardClient() {
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadDashboard = useCallback(async (runId?: string) => {
    try {
      const nextPayload = await getDashboard(runId);
      setPayload(nextPayload);
      setError("");
      return nextPayload;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load health data.");
      return null;
    }
  }, []);

  // Initial load
  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  // Polling
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    const isActive = payload?.run && ["pending", "running"].includes(payload.run.status);
    const interval = isActive ? POLL_INTERVAL_ACTIVE : POLL_INTERVAL_IDLE;
    const runId = isActive ? payload?.run?.id : undefined;

    timerRef.current = setInterval(() => void loadDashboard(runId), interval);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [payload?.run?.id, payload?.run?.status, loadDashboard]);

  // Detect which group is currently being scanned (first group with partial results)
  const activeGroupKey = useMemo(() => {
    if (!payload?.run || !["pending", "running"].includes(payload.run.status)) return null;

    const groups = payload.groups;
    for (const group of groups) {
      const checked = group.endpoints.filter((e) => e.latestStatus !== null).length;
      const total = group.endpoints.length;
      // Group is actively being checked: has some results but not all
      if (checked > 0 && checked < total) return toGroupKey(group.surface, group.component);
      // Group hasn't started yet but previous groups are done: this is next
      if (checked === 0) {
        // Check if any previous group has results — if so, this is the next one to run
        const idx = groups.indexOf(group);
        if (idx > 0) {
          const prevGroup = groups[idx - 1];
          const prevChecked = prevGroup.endpoints.filter((e) => e.latestStatus !== null).length;
          if (prevChecked === prevGroup.endpoints.length && prevChecked > 0) {
            return toGroupKey(group.surface, group.component);
          }
        }
        // It's the very first group and health check just started
        if (idx === 0) return toGroupKey(group.surface, group.component);
        break;
      }
    }
    return null;
  }, [payload]);

  // Auto-select the active group during a run
  useEffect(() => {
    if (activeGroupKey) {
      setSelectedGroupKey(activeGroupKey);
    }
  }, [activeGroupKey]);

  // Clear selection when run completes
  useEffect(() => {
    if (payload?.run?.status === "completed" || payload?.run?.status === "failed") {
      // Don't auto-deselect — user can keep viewing a specific group
    }
  }, [payload?.run?.status]);

  const allEndpoints = useMemo<DashboardEndpoint[]>(() => {
    if (!payload) return [];
    return payload.groups.flatMap((g) => g.endpoints);
  }, [payload]);

  // Filter endpoints based on selected group
  const ledgerEndpoints = useMemo<DashboardEndpoint[]>(() => {
    if (!selectedGroupKey || !payload) return allEndpoints;
    const group = payload.groups.find((g) => toGroupKey(g.surface, g.component) === selectedGroupKey);
    return group ? group.endpoints : allEndpoints;
  }, [payload, selectedGroupKey, allEndpoints]);

  // Selected group name for display
  const selectedGroupName = useMemo(() => {
    if (!selectedGroupKey || !payload) return null;
    const group = payload.groups.find((g) => toGroupKey(g.surface, g.component) === selectedGroupKey);
    return group?.component ?? null;
  }, [payload, selectedGroupKey]);

  const navigationItems = useMemo(() => {
    if (!payload) return [];
    return payload.groups.map((group) => ({
      key: toGroupKey(group.surface, group.component),
      label: group.component,
      href: `#section-${group.component.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
      count: group.endpoints.length,
      healthy: group.endpoints.filter((e) => e.latestStatus === "healthy").length,
    }));
  }, [payload]);

  async function startHealthCheck() {
    try {
      setIsStarting(true);
      setSelectedGroupKey(null);
      const response = await fetch("/api/runs", { method: "POST" });
      if (!response.ok) throw new Error("Failed to initiate health check.");
      const data = (await response.json()) as { runId: string };
      await loadDashboard(data.runId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to start the health check.");
    } finally {
      setIsStarting(false);
    }
  }

  async function sendEmailReport() {
    try {
      setEmailSending(true);
      setEmailStatus(null);
      const response = await fetch("/api/email-report", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to send email");
      setEmailStatus({ type: "success", message: data.message || "Report sent successfully!" });
    } catch (e) {
      setEmailStatus({ type: "error", message: e instanceof Error ? e.message : "Failed to send email report" });
    } finally {
      setEmailSending(false);
      setTimeout(() => setEmailStatus(null), 5000);
    }
  }

  const run = payload?.run;
  const progress = run && run.totalChecks > 0 ? (run.completedChecks / run.totalChecks) * 100 : 0;
  const isRunActive = run && ["pending", "running"].includes(run.status);
  const totalHealthy = run?.healthyCount ?? 0;
  const totalUnhealthy = run?.unhealthyCount ?? 0;
  const totalSkipped = run?.skippedCount ?? 0;
  const overallRate = run && run.completedChecks > 0
    ? ((totalHealthy / run.completedChecks) * 100).toFixed(1)
    : "—";

  return (
    <div className="min-h-screen bg-[#f3f7fb]">
      <div className="mx-auto flex w-full max-w-[1440px] gap-6 px-5 py-8 sm:px-8">
        {/* Sidebar */}
        <aside className="sticky top-24 hidden h-fit w-[260px] shrink-0 xl:block">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Quick Nav</p>
            <nav className="mt-4 flex flex-col gap-1.5">
              {navigationItems.map((item) => {
                const allHealthy = item.healthy === item.count && item.count > 0;
                const isNavActive = item.key === activeGroupKey;
                const isNavSelected = item.key === selectedGroupKey;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSelectedGroupKey(isNavSelected ? null : item.key)}
                    className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      isNavActive
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : isNavSelected
                          ? "bg-slate-100 text-slate-800 font-medium"
                          : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {isNavActive && (
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
                        </span>
                      )}
                      <span>{item.label}</span>
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      allHealthy ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                    }`}>
                      {item.healthy}/{item.count}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setSelectedGroupKey(null)}
                className={`mt-2 flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                  !selectedGroupKey
                    ? "border-blue-400 bg-blue-50 text-blue-700"
                    : "border-blue-200 bg-blue-50/50 text-blue-700 hover:bg-blue-50"
                }`}
              >
                <span>All Endpoints</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-blue-600">
                  {allEndpoints.length}
                </span>
              </button>
            </nav>
          </div>

          {run && run.status === "completed" && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Run Summary</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Health Rate</span>
                  <span className="font-semibold text-emerald-600">{overallRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Healthy</span>
                  <span className="font-semibold text-emerald-600">{totalHealthy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Unhealthy</span>
                  <span className="font-semibold text-rose-600">{totalUnhealthy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Skipped</span>
                  <span className="font-semibold text-amber-600">{totalSkipped}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Duration</span>
                  <span className="font-semibold text-slate-700">
                    {run.completedAt
                      ? `${((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000).toFixed(1)}s`
                      : "—"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col gap-8">
          {/* Header */}
          <section className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#3b82f6] text-white shadow-lg shadow-blue-200">
                <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-800">Health Dashboard</h1>
                <p className="mt-1 text-base text-slate-500">Real-time service health monitoring</p>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className={`inline-block h-2 w-2 rounded-full ${
                      run?.status === "running" ? "bg-blue-500 animate-pulse-dot"
                        : run?.status === "completed" ? "bg-emerald-500"
                          : run?.status === "failed" ? "bg-rose-500" : "bg-slate-300"
                    }`} />
                    Status: <span className="font-semibold text-slate-700">{run ? run.status.toUpperCase() : "IDLE"}</span>
                  </span>
                  <span>Progress: <span className="font-semibold text-slate-700">{Math.round(progress)}%</span></span>
                  <span>Last run: <span className="font-semibold text-slate-700">{run?.startedAt ? new Date(run.startedAt).toLocaleString("en-IN") : "Never"}</span></span>
                </div>
              </div>
            </div>

            {/* Execution panel */}
            <div className="min-w-[340px] rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Execution</p>
                  <p className="mt-2 text-2xl font-bold text-slate-800">
                    {run ? `${run.completedChecks}/${run.totalChecks}` : "0/0"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={startHealthCheck}
                    disabled={isStarting || !!isRunActive}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#3b82f6] px-4 py-3 text-sm font-semibold text-white shadow-md shadow-blue-200 transition hover:bg-[#2563eb] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
                    </svg>
                    {isRunActive ? "Running..." : isStarting ? "Starting..." : "Run Check"}
                  </button>
                  <button
                    type="button"
                    onClick={sendEmailReport}
                    disabled={emailSending || !run || run.status !== "completed"}
                    title="Send health report via email"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                    {emailSending ? "Sending..." : "Email"}
                  </button>
                </div>
              </div>

              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    run?.status === "failed" ? "bg-rose-500"
                      : run?.status === "completed" ? "bg-emerald-500"
                        : "bg-gradient-to-r from-blue-400 to-blue-600"
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>

              {run?.status === "completed" && (
                <div className="mt-3 flex gap-3 text-xs">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">{totalHealthy} healthy</span>
                  <span className="rounded-full bg-rose-50 px-2.5 py-1 font-semibold text-rose-700">{totalUnhealthy} failed</span>
                  {totalSkipped > 0 && (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">{totalSkipped} skipped</span>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Email status toast */}
          {emailStatus && (
            <div className={`flex items-center gap-3 rounded-xl border px-5 py-3 text-sm ${
              emailStatus.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}>
              {emailStatus.type === "success" ? (
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              )}
              {emailStatus.message}
            </div>
          )}

          {/* Summary cards */}
          <SummaryCards
            payload={payload}
            activeGroupKey={activeGroupKey}
            selectedGroupKey={selectedGroupKey}
            onSelectGroup={setSelectedGroupKey}
          />

          {error && (
            <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {error}
            </div>
          )}

          {/* Health ledger */}
          <div id="health-ledger" className="pb-6">
            {/* Filter indicator */}
            {selectedGroupKey && (
              <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
                <span>Showing endpoints for</span>
                <span className="rounded-lg bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">{selectedGroupName}</span>
                <button
                  type="button"
                  onClick={() => setSelectedGroupKey(null)}
                  className="ml-1 rounded-lg border border-slate-200 px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-50"
                >
                  Show all
                </button>
              </div>
            )}
            <HealthSection
              endpoints={ledgerEndpoints}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
