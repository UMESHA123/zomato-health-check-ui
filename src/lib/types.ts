export type EndpointSurface = "frontend" | "backend" | "infrastructure" | "catalog";
export type EndpointTargetKind = "http" | "tcp" | "database";
export type EndpointExecutionMode = "live" | "catalog_only";
export type HealthStatus = "healthy" | "unhealthy" | "skipped";
export type RunStatus = "pending" | "running" | "completed" | "failed";

export type AlertSeverity = "critical" | "warning" | "info";
export type AlertRuleType = "service_down" | "high_latency" | "consecutive_failures" | "health_rate_drop" | "error_rate_spike";
export type AlertState = "firing" | "resolved" | "acknowledged";

export interface EndpointCatalogItem {
  key: string;
  name: string;
  component: string;
  surface: EndpointSurface;
  routePath: string;
  targetKind: EndpointTargetKind;
  targetUrl?: string;
  method: string;
  expectedStatusCodes: number[];
  executionMode: EndpointExecutionMode;
  requiresAuth: boolean;
  sequence: number;
  notes?: string;
  samplePayload?: Record<string, unknown>;
}

export interface DashboardEndpoint {
  id: number;
  endpointKey: string;
  name: string;
  component: string;
  surface: EndpointSurface;
  routePath: string;
  targetKind: EndpointTargetKind;
  targetUrl: string | null;
  method: string;
  expectedStatusCodes: number[];
  executionMode: EndpointExecutionMode;
  requiresAuth: boolean;
  notes: string | null;
  sequence: number;
  latestStatus: HealthStatus | null;
  latestHttpStatus: number | null;
  latestDurationMs: number | null;
  latestErrorMessage: string | null;
  latestCreatedAt: string | null;
}

export interface DashboardRun {
  id: string;
  status: RunStatus;
  totalChecks: number;
  completedChecks: number;
  healthyCount: number;
  unhealthyCount: number;
  skippedCount: number;
  startedAt: string;
  completedAt: string | null;
}

export interface DashboardPayload {
  run: DashboardRun | null;
  totals: {
    endpoints: number;
    liveEndpoints: number;
    catalogOnlyEndpoints: number;
  };
  groups: Array<{
    component: string;
    surface: EndpointSurface;
    endpoints: DashboardEndpoint[];
  }>;
}

export interface AlertRule {
  id: number;
  name: string;
  description: string;
  ruleType: AlertRuleType;
  severity: AlertSeverity;
  enabled: boolean;
  endpointPattern: string | null;
  surfaceFilter: EndpointSurface | null;
  thresholdValue: number;
  thresholdUnit: string;
  consecutiveRuns: number;
  cooldownMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface TriggeredAlert {
  id: number;
  ruleId: number;
  ruleName: string;
  ruleType: AlertRuleType;
  severity: AlertSeverity;
  state: AlertState;
  title: string;
  message: string;
  endpointKey: string | null;
  endpointName: string | null;
  runId: string | null;
  metricValue: number | null;
  thresholdValue: number;
  firedAt: string;
  resolvedAt: string | null;
  acknowledgedAt: string | null;
}

export interface RunHistoryItem {
  id: string;
  status: RunStatus;
  totalChecks: number;
  completedChecks: number;
  healthyCount: number;
  unhealthyCount: number;
  skippedCount: number;
  startedAt: string;
  completedAt: string | null;
  healthRate: number;
  duration: number | null;
}

export interface AlertsPayload {
  rules: AlertRule[];
  activeAlerts: TriggeredAlert[];
  alertHistory: TriggeredAlert[];
  stats: {
    totalRules: number;
    enabledRules: number;
    activeAlerts: number;
    criticalAlerts: number;
    warningAlerts: number;
  };
}
