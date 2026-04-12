"use client";

import { useCallback, useEffect, useState } from "react";
import type { AlertRule, AlertsPayload, TriggeredAlert } from "@/lib/types";

type Tab = "active" | "rules" | "history";

function getSeverityStyle(severity: string) {
  if (severity === "critical") return "bg-rose-50 text-rose-700 border-rose-200";
  if (severity === "warning") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-sky-50 text-sky-700 border-sky-200";
}

function getSeverityDot(severity: string) {
  if (severity === "critical") return "bg-rose-500";
  if (severity === "warning") return "bg-amber-500";
  return "bg-sky-500";
}

function getStateStyle(state: string) {
  if (state === "firing") return "bg-rose-50 text-rose-700 border-rose-200";
  if (state === "acknowledged") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

function getRuleTypeLabel(ruleType: string) {
  const labels: Record<string, string> = {
    service_down: "Service Down",
    high_latency: "High Latency",
    consecutive_failures: "Consecutive Failures",
    health_rate_drop: "Health Rate Drop",
    error_rate_spike: "Error Rate Spike",
  };
  return labels[ruleType] ?? ruleType;
}

function getRuleTypeIcon(ruleType: string) {
  if (ruleType === "service_down") {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    );
  }
  if (ruleType === "high_latency") {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    );
  }
  if (ruleType === "consecutive_failures") {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }
  if (ruleType === "health_rate_drop") {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function AlertsPage() {
  const [data, setData] = useState<AlertsPayload | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("active");
  const [loading, setLoading] = useState(true);

  const loadAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load alerts");
      const payload = (await res.json()) as AlertsPayload;
      setData(payload);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAlerts();
    const interval = setInterval(() => void loadAlerts(), 10000);
    return () => clearInterval(interval);
  }, [loadAlerts]);

  async function toggleRule(ruleId: number, enabled: boolean) {
    await fetch(`/api/alerts/${ruleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", enabled }),
    });
    await loadAlerts();
  }

  async function acknowledgeAlertAction(alertId: number) {
    await fetch(`/api/alerts/${alertId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "acknowledge" }),
    });
    await loadAlerts();
  }

  async function resolveAlertAction(alertId: number) {
    await fetch(`/api/alerts/${alertId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve" }),
    });
    await loadAlerts();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f3f7fb]">
        <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8">
          <div className="flex h-64 items-center justify-center text-slate-400">Loading alerts...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f7fb]">
      <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500 text-white shadow-lg shadow-rose-200">
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-800">Alert Center</h1>
              <p className="mt-1 text-base text-slate-500">Dynatrace-style alerting and incident management</p>
            </div>
          </div>

          {/* Stats cards */}
          <div className="flex gap-3">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center shadow-sm">
              <p className="text-2xl font-bold text-slate-800">{data?.stats.activeAlerts ?? 0}</p>
              <p className="text-xs text-slate-500">Active</p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-center shadow-sm">
              <p className="text-2xl font-bold text-rose-700">{data?.stats.criticalAlerts ?? 0}</p>
              <p className="text-xs text-rose-600">Critical</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center shadow-sm">
              <p className="text-2xl font-bold text-amber-700">{data?.stats.warningAlerts ?? 0}</p>
              <p className="text-xs text-amber-600">Warning</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center shadow-sm">
              <p className="text-2xl font-bold text-slate-800">{data?.stats.enabledRules ?? 0}/{data?.stats.totalRules ?? 0}</p>
              <p className="text-xs text-slate-500">Rules</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-700">{error}</div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {(["active", "rules", "history"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                tab === t
                  ? "bg-[#3b82f6] text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              {t === "active" && `Active Alerts (${data?.activeAlerts.length ?? 0})`}
              {t === "rules" && `Alert Rules (${data?.rules.length ?? 0})`}
              {t === "history" && "Alert History"}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "active" && (
          <ActiveAlertsTab
            alerts={data?.activeAlerts ?? []}
            onAcknowledge={acknowledgeAlertAction}
            onResolve={resolveAlertAction}
          />
        )}
        {tab === "rules" && (
          <AlertRulesTab rules={data?.rules ?? []} onToggle={toggleRule} />
        )}
        {tab === "history" && (
          <AlertHistoryTab alerts={data?.alertHistory ?? []} />
        )}
      </div>
    </div>
  );
}

function ActiveAlertsTab({
  alerts,
  onAcknowledge,
  onResolve,
}: {
  alerts: TriggeredAlert[];
  onAcknowledge: (id: number) => void;
  onResolve: (id: number) => void;
}) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <svg className="mb-3 h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-lg font-semibold text-slate-600">All clear!</p>
          <p className="mt-1 text-sm">No active alerts at this time</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`rounded-2xl border bg-white shadow-sm overflow-hidden ${
            alert.severity === "critical" ? "border-l-4 border-l-rose-500 border-y-slate-200 border-r-slate-200" : "border-l-4 border-l-amber-500 border-y-slate-200 border-r-slate-200"
          }`}
        >
          <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                alert.severity === "critical" ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"
              }`}>
                {getRuleTypeIcon(alert.ruleType)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-800">{alert.title}</h3>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${getSeverityStyle(alert.severity)}`}>
                    {alert.severity}
                  </span>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${getStateStyle(alert.state)}`}>
                    {alert.state}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{alert.message}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
                  {alert.endpointName && (
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-600">{alert.endpointName}</span>
                  )}
                  <span>Fired {timeAgo(alert.firedAt)}</span>
                  {alert.metricValue !== null && (
                    <span>Value: <strong className="text-slate-600">{alert.metricValue}</strong> (threshold: {alert.thresholdValue})</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 gap-2">
              {alert.state === "firing" && (
                <button
                  type="button"
                  onClick={() => onAcknowledge(alert.id)}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                >
                  Acknowledge
                </button>
              )}
              <button
                type="button"
                onClick={() => onResolve(alert.id)}
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
              >
                Resolve
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AlertRulesTab({
  rules,
  onToggle,
}: {
  rules: AlertRule[];
  onToggle: (id: number, enabled: boolean) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full">
        <thead className="bg-slate-50">
          <tr className="text-left text-[11px] uppercase tracking-widest text-slate-500">
            <th className="px-5 py-3 font-semibold">Status</th>
            <th className="px-5 py-3 font-semibold">Rule Name</th>
            <th className="px-5 py-3 font-semibold">Type</th>
            <th className="px-5 py-3 font-semibold">Severity</th>
            <th className="px-5 py-3 font-semibold">Threshold</th>
            <th className="px-5 py-3 font-semibold">Cooldown</th>
            <th className="px-5 py-3 font-semibold">Scope</th>
            <th className="px-5 py-3 font-semibold">Action</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr key={rule.id} className={`border-t border-slate-100 text-sm ${!rule.enabled ? "opacity-50" : ""}`}>
              <td className="px-5 py-4">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${rule.enabled ? "bg-emerald-500" : "bg-slate-300"}`} />
              </td>
              <td className="px-5 py-4">
                <div className="font-semibold text-slate-700">{rule.name}</div>
                <div className="mt-0.5 text-xs text-slate-400">{rule.description}</div>
              </td>
              <td className="px-5 py-4">
                <div className="flex items-center gap-1.5 text-slate-600">
                  {getRuleTypeIcon(rule.ruleType)}
                  <span className="text-xs font-medium">{getRuleTypeLabel(rule.ruleType)}</span>
                </div>
              </td>
              <td className="px-5 py-4">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${getSeverityStyle(rule.severity)}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${getSeverityDot(rule.severity)}`} />
                  {rule.severity}
                </span>
              </td>
              <td className="px-5 py-4 font-mono text-xs text-slate-600">
                {rule.thresholdValue} {rule.thresholdUnit}
              </td>
              <td className="px-5 py-4 text-xs text-slate-500">{rule.cooldownMinutes}m</td>
              <td className="px-5 py-4 text-xs text-slate-500">
                {rule.surfaceFilter ? (
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-600">{rule.surfaceFilter}</span>
                ) : (
                  "All"
                )}
              </td>
              <td className="px-5 py-4">
                <button
                  type="button"
                  onClick={() => onToggle(rule.id, !rule.enabled)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    rule.enabled
                      ? "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      : "border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                  }`}
                >
                  {rule.enabled ? "Disable" : "Enable"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AlertHistoryTab({ alerts }: { alerts: TriggeredAlert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <p className="text-lg font-semibold text-slate-600">No alert history</p>
          <p className="mt-1 text-sm">Resolved and acknowledged alerts will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full">
        <thead className="bg-slate-50">
          <tr className="text-left text-[11px] uppercase tracking-widest text-slate-500">
            <th className="px-5 py-3 font-semibold">Alert</th>
            <th className="px-5 py-3 font-semibold">Severity</th>
            <th className="px-5 py-3 font-semibold">State</th>
            <th className="px-5 py-3 font-semibold">Endpoint</th>
            <th className="px-5 py-3 font-semibold">Fired</th>
            <th className="px-5 py-3 font-semibold">Resolved</th>
            <th className="px-5 py-3 font-semibold">Duration</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((alert) => {
            const duration = alert.resolvedAt
              ? Math.round((new Date(alert.resolvedAt).getTime() - new Date(alert.firedAt).getTime()) / 60000)
              : null;

            return (
              <tr key={alert.id} className="border-t border-slate-100 text-sm text-slate-600">
                <td className="px-5 py-4">
                  <div className="font-semibold text-slate-700">{alert.title}</div>
                  <div className="mt-0.5 text-xs text-slate-400">{alert.message}</div>
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${getSeverityStyle(alert.severity)}`}>
                    {alert.severity}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${getStateStyle(alert.state)}`}>
                    {alert.state}
                  </span>
                </td>
                <td className="px-5 py-4 text-xs">
                  {alert.endpointName ?? "—"}
                </td>
                <td className="px-5 py-4 text-xs">
                  {new Date(alert.firedAt).toLocaleString("en-IN", {
                    month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
                  })}
                </td>
                <td className="px-5 py-4 text-xs">
                  {alert.resolvedAt
                    ? new Date(alert.resolvedAt).toLocaleString("en-IN", {
                        month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
                      })
                    : "—"}
                </td>
                <td className="px-5 py-4 text-xs font-medium">
                  {duration !== null ? (duration < 1 ? "<1m" : `${duration}m`) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
