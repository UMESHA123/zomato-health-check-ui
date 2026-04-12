import { query } from "@/lib/db";
import type {
  AlertRule,
  AlertRuleType,
  AlertSeverity,
  AlertState,
  AlertsPayload,
  TriggeredAlert,
} from "@/lib/types";

type AlertRuleRow = {
  id: number;
  name: string;
  description: string;
  rule_type: AlertRuleType;
  severity: AlertSeverity;
  enabled: boolean;
  endpoint_pattern: string | null;
  surface_filter: string | null;
  threshold_value: number;
  threshold_unit: string;
  consecutive_runs: number;
  cooldown_minutes: number;
  created_at: string;
  updated_at: string;
};

type TriggeredAlertRow = {
  id: number;
  rule_id: number;
  rule_name: string;
  rule_type: AlertRuleType;
  severity: AlertSeverity;
  state: AlertState;
  title: string;
  message: string;
  endpoint_key: string | null;
  endpoint_name: string | null;
  run_id: string | null;
  metric_value: number | null;
  threshold_value: number;
  fired_at: string;
  resolved_at: string | null;
  acknowledged_at: string | null;
};

let schemaReady = false;

async function ensureAlertSchema() {
  if (schemaReady) return;

  await query(`
    CREATE TABLE IF NOT EXISTS alert_rules (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      rule_type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'warning',
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      endpoint_pattern TEXT,
      surface_filter TEXT,
      threshold_value NUMERIC NOT NULL DEFAULT 1,
      threshold_unit TEXT NOT NULL DEFAULT 'count',
      consecutive_runs INTEGER NOT NULL DEFAULT 1,
      cooldown_minutes INTEGER NOT NULL DEFAULT 5,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS triggered_alerts (
      id SERIAL PRIMARY KEY,
      rule_id INTEGER NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
      state TEXT NOT NULL DEFAULT 'firing',
      title TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '',
      endpoint_key TEXT,
      endpoint_name TEXT,
      run_id UUID,
      metric_value NUMERIC,
      threshold_value NUMERIC NOT NULL,
      fired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ,
      acknowledged_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_triggered_alerts_state ON triggered_alerts(state);
    CREATE INDEX IF NOT EXISTS idx_triggered_alerts_fired ON triggered_alerts(fired_at DESC);
    CREATE INDEX IF NOT EXISTS idx_triggered_alerts_rule ON triggered_alerts(rule_id);
  `);

  // Seed default alert rules if none exist
  const existing = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM alert_rules`);
  if (Number(existing.rows[0]?.count) === 0) {
    await seedDefaultRules();
  }

  schemaReady = true;
}

async function seedDefaultRules() {
  const defaults: Array<{
    name: string;
    description: string;
    ruleType: AlertRuleType;
    severity: AlertSeverity;
    thresholdValue: number;
    thresholdUnit: string;
    consecutiveRuns: number;
    cooldownMinutes: number;
    surfaceFilter?: string;
  }> = [
    {
      name: "Service Down",
      description: "Fires when any live service endpoint is unreachable",
      ruleType: "service_down",
      severity: "critical",
      thresholdValue: 1,
      thresholdUnit: "count",
      consecutiveRuns: 1,
      cooldownMinutes: 5,
    },
    {
      name: "High Latency",
      description: "Fires when any endpoint response time exceeds threshold",
      ruleType: "high_latency",
      severity: "warning",
      thresholdValue: 3000,
      thresholdUnit: "ms",
      consecutiveRuns: 1,
      cooldownMinutes: 10,
    },
    {
      name: "Consecutive Failures",
      description: "Fires when an endpoint fails multiple consecutive health checks",
      ruleType: "consecutive_failures",
      severity: "critical",
      thresholdValue: 3,
      thresholdUnit: "runs",
      consecutiveRuns: 3,
      cooldownMinutes: 15,
    },
    {
      name: "Health Rate Drop",
      description: "Fires when overall health rate drops below threshold",
      ruleType: "health_rate_drop",
      severity: "warning",
      thresholdValue: 80,
      thresholdUnit: "percent",
      consecutiveRuns: 1,
      cooldownMinutes: 10,
    },
    {
      name: "Backend Error Rate Spike",
      description: "Fires when backend service error rate exceeds threshold",
      ruleType: "error_rate_spike",
      severity: "critical",
      thresholdValue: 30,
      thresholdUnit: "percent",
      consecutiveRuns: 1,
      cooldownMinutes: 10,
      surfaceFilter: "backend",
    },
    {
      name: "Infrastructure Down",
      description: "Fires when any infrastructure component (DB, Redis, RabbitMQ) is down",
      ruleType: "service_down",
      severity: "critical",
      thresholdValue: 1,
      thresholdUnit: "count",
      consecutiveRuns: 1,
      cooldownMinutes: 2,
      surfaceFilter: "infrastructure",
    },
    {
      name: "Frontend Unreachable",
      description: "Fires when any frontend application is not responding",
      ruleType: "service_down",
      severity: "warning",
      thresholdValue: 1,
      thresholdUnit: "count",
      consecutiveRuns: 2,
      cooldownMinutes: 5,
      surfaceFilter: "frontend",
    },
  ];

  for (const rule of defaults) {
    await query(
      `INSERT INTO alert_rules (name, description, rule_type, severity, threshold_value, threshold_unit, consecutive_runs, cooldown_minutes, surface_filter)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        rule.name,
        rule.description,
        rule.ruleType,
        rule.severity,
        rule.thresholdValue,
        rule.thresholdUnit,
        rule.consecutiveRuns,
        rule.cooldownMinutes,
        rule.surfaceFilter ?? null,
      ],
    );
  }
}

function toAlertRule(row: AlertRuleRow): AlertRule {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    ruleType: row.rule_type,
    severity: row.severity,
    enabled: row.enabled,
    endpointPattern: row.endpoint_pattern,
    surfaceFilter: row.surface_filter as AlertRule["surfaceFilter"],
    thresholdValue: Number(row.threshold_value),
    thresholdUnit: row.threshold_unit,
    consecutiveRuns: row.consecutive_runs,
    cooldownMinutes: row.cooldown_minutes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toTriggeredAlert(row: TriggeredAlertRow): TriggeredAlert {
  return {
    id: row.id,
    ruleId: row.rule_id,
    ruleName: row.rule_name,
    ruleType: row.rule_type,
    severity: row.severity,
    state: row.state,
    title: row.title,
    message: row.message,
    endpointKey: row.endpoint_key,
    endpointName: row.endpoint_name,
    runId: row.run_id,
    metricValue: row.metric_value !== null ? Number(row.metric_value) : null,
    thresholdValue: Number(row.threshold_value),
    firedAt: row.fired_at,
    resolvedAt: row.resolved_at,
    acknowledgedAt: row.acknowledged_at,
  };
}

export async function getAlertsPayload(): Promise<AlertsPayload> {
  await ensureAlertSchema();

  const rulesResult = await query<AlertRuleRow>(
    `SELECT * FROM alert_rules ORDER BY severity = 'critical' DESC, severity = 'warning' DESC, name`,
  );

  const activeResult = await query<TriggeredAlertRow>(
    `SELECT ta.*, ar.name AS rule_name, ar.rule_type, ar.severity
     FROM triggered_alerts ta
     JOIN alert_rules ar ON ar.id = ta.rule_id
     WHERE ta.state = 'firing'
     ORDER BY ta.fired_at DESC`,
  );

  const historyResult = await query<TriggeredAlertRow>(
    `SELECT ta.*, ar.name AS rule_name, ar.rule_type, ar.severity
     FROM triggered_alerts ta
     JOIN alert_rules ar ON ar.id = ta.rule_id
     WHERE ta.state IN ('resolved', 'acknowledged')
     ORDER BY ta.fired_at DESC
     LIMIT 100`,
  );

  const rules = rulesResult.rows.map(toAlertRule);
  const activeAlerts = activeResult.rows.map(toTriggeredAlert);
  const alertHistory = historyResult.rows.map(toTriggeredAlert);

  return {
    rules,
    activeAlerts,
    alertHistory,
    stats: {
      totalRules: rules.length,
      enabledRules: rules.filter((r) => r.enabled).length,
      activeAlerts: activeAlerts.length,
      criticalAlerts: activeAlerts.filter((a) => a.severity === "critical").length,
      warningAlerts: activeAlerts.filter((a) => a.severity === "warning").length,
    },
  };
}

export async function toggleAlertRule(ruleId: number, enabled: boolean) {
  await ensureAlertSchema();
  await query(
    `UPDATE alert_rules SET enabled = $2, updated_at = NOW() WHERE id = $1`,
    [ruleId, enabled],
  );
}

export async function acknowledgeAlert(alertId: number) {
  await ensureAlertSchema();
  await query(
    `UPDATE triggered_alerts SET state = 'acknowledged', acknowledged_at = NOW() WHERE id = $1 AND state = 'firing'`,
    [alertId],
  );
}

export async function resolveAlert(alertId: number) {
  await ensureAlertSchema();
  await query(
    `UPDATE triggered_alerts SET state = 'resolved', resolved_at = NOW() WHERE id = $1 AND state IN ('firing', 'acknowledged')`,
    [alertId],
  );
}

export async function evaluateAlerts(runId: string) {
  await ensureAlertSchema();

  const rules = await query<AlertRuleRow>(
    `SELECT * FROM alert_rules WHERE enabled = true`,
  );

  for (const rule of rules.rows) {
    try {
      await evaluateRule(rule, runId);
    } catch (err) {
      console.error(`Failed to evaluate alert rule ${rule.name}:`, err);
    }
  }

  // Auto-resolve alerts for endpoints that are now healthy
  await autoResolveAlerts(runId);
}

async function evaluateRule(rule: AlertRuleRow, runId: string) {
  // Check cooldown — don't fire if recently fired
  const recentAlert = await query<{ id: number }>(
    `SELECT id FROM triggered_alerts
     WHERE rule_id = $1 AND state = 'firing'
       AND fired_at > NOW() - INTERVAL '1 minute' * $2
     LIMIT 1`,
    [rule.id, rule.cooldown_minutes],
  );
  if (recentAlert.rows.length > 0) return;

  switch (rule.rule_type) {
    case "service_down":
      await evaluateServiceDown(rule, runId);
      break;
    case "high_latency":
      await evaluateHighLatency(rule, runId);
      break;
    case "health_rate_drop":
      await evaluateHealthRateDrop(rule, runId);
      break;
    case "error_rate_spike":
      await evaluateErrorRateSpike(rule, runId);
      break;
    case "consecutive_failures":
      await evaluateConsecutiveFailures(rule, runId);
      break;
  }
}

async function evaluateServiceDown(rule: AlertRuleRow, runId: string) {
  let surfaceClause = "";
  const params: unknown[] = [runId];

  if (rule.surface_filter) {
    surfaceClause = "AND r.surface = $2";
    params.push(rule.surface_filter);
  }

  const unhealthy = await query<{ endpoint_key: string; endpoint_name: string; error_message: string | null }>(
    `SELECT r.endpoint_key, e.name AS endpoint_name, r.error_message
     FROM health_check_results r
     JOIN endpoint_registry e ON e.id = r.endpoint_id
     WHERE r.run_id = $1 AND r.status = 'unhealthy'
       AND e.execution_mode = 'live'
       ${surfaceClause}`,
    params,
  );

  for (const ep of unhealthy.rows) {
    // Check if there's already a firing alert for this endpoint + rule
    const existing = await query<{ id: number }>(
      `SELECT id FROM triggered_alerts WHERE rule_id = $1 AND endpoint_key = $2 AND state = 'firing'`,
      [rule.id, ep.endpoint_key],
    );
    if (existing.rows.length > 0) continue;

    await query(
      `INSERT INTO triggered_alerts (rule_id, state, title, message, endpoint_key, endpoint_name, run_id, metric_value, threshold_value)
       VALUES ($1, 'firing', $2, $3, $4, $5, $6::uuid, 0, $7)`,
      [
        rule.id,
        `${ep.endpoint_name} is DOWN`,
        ep.error_message || `Service endpoint ${ep.endpoint_key} is not responding`,
        ep.endpoint_key,
        ep.endpoint_name,
        runId,
        rule.threshold_value,
      ],
    );
  }
}

async function evaluateHighLatency(rule: AlertRuleRow, runId: string) {
  const slow = await query<{ endpoint_key: string; endpoint_name: string; duration_ms: number }>(
    `SELECT r.endpoint_key, e.name AS endpoint_name, r.duration_ms
     FROM health_check_results r
     JOIN endpoint_registry e ON e.id = r.endpoint_id
     WHERE r.run_id = $1 AND r.duration_ms > $2
       AND e.execution_mode = 'live'`,
    [runId, rule.threshold_value],
  );

  for (const ep of slow.rows) {
    const existing = await query<{ id: number }>(
      `SELECT id FROM triggered_alerts WHERE rule_id = $1 AND endpoint_key = $2 AND state = 'firing'`,
      [rule.id, ep.endpoint_key],
    );
    if (existing.rows.length > 0) continue;

    await query(
      `INSERT INTO triggered_alerts (rule_id, state, title, message, endpoint_key, endpoint_name, run_id, metric_value, threshold_value)
       VALUES ($1, 'firing', $2, $3, $4, $5, $6::uuid, $7, $8)`,
      [
        rule.id,
        `High latency on ${ep.endpoint_name}`,
        `Response time ${ep.duration_ms}ms exceeds threshold ${rule.threshold_value}ms`,
        ep.endpoint_key,
        ep.endpoint_name,
        runId,
        ep.duration_ms,
        rule.threshold_value,
      ],
    );
  }
}

async function evaluateHealthRateDrop(rule: AlertRuleRow, runId: string) {
  const stats = await query<{ total: string; healthy: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE e.execution_mode = 'live') AS total,
       COUNT(*) FILTER (WHERE r.status = 'healthy' AND e.execution_mode = 'live') AS healthy
     FROM health_check_results r
     JOIN endpoint_registry e ON e.id = r.endpoint_id
     WHERE r.run_id = $1`,
    [runId],
  );

  const total = Number(stats.rows[0]?.total || 0);
  const healthy = Number(stats.rows[0]?.healthy || 0);
  if (total === 0) return;

  const healthRate = (healthy / total) * 100;

  if (healthRate < rule.threshold_value) {
    const existing = await query<{ id: number }>(
      `SELECT id FROM triggered_alerts WHERE rule_id = $1 AND state = 'firing'`,
      [rule.id],
    );
    if (existing.rows.length > 0) return;

    await query(
      `INSERT INTO triggered_alerts (rule_id, state, title, message, run_id, metric_value, threshold_value)
       VALUES ($1, 'firing', $2, $3, $4::uuid, $5, $6)`,
      [
        rule.id,
        `Health rate dropped to ${healthRate.toFixed(1)}%`,
        `Overall health rate ${healthRate.toFixed(1)}% is below threshold ${rule.threshold_value}%`,
        runId,
        healthRate,
        rule.threshold_value,
      ],
    );
  }
}

async function evaluateErrorRateSpike(rule: AlertRuleRow, runId: string) {
  let surfaceClause = "";
  const params: unknown[] = [runId];

  if (rule.surface_filter) {
    surfaceClause = "AND e.surface = $2";
    params.push(rule.surface_filter);
  }

  const stats = await query<{ total: string; unhealthy: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE e.execution_mode = 'live') AS total,
       COUNT(*) FILTER (WHERE r.status = 'unhealthy' AND e.execution_mode = 'live') AS unhealthy
     FROM health_check_results r
     JOIN endpoint_registry e ON e.id = r.endpoint_id
     WHERE r.run_id = $1 ${surfaceClause}`,
    params,
  );

  const total = Number(stats.rows[0]?.total || 0);
  const unhealthy = Number(stats.rows[0]?.unhealthy || 0);
  if (total === 0) return;

  const errorRate = (unhealthy / total) * 100;

  if (errorRate > rule.threshold_value) {
    const existing = await query<{ id: number }>(
      `SELECT id FROM triggered_alerts WHERE rule_id = $1 AND state = 'firing'`,
      [rule.id],
    );
    if (existing.rows.length > 0) return;

    const surfaceLabel = rule.surface_filter ? ` (${rule.surface_filter})` : "";
    await query(
      `INSERT INTO triggered_alerts (rule_id, state, title, message, run_id, metric_value, threshold_value)
       VALUES ($1, 'firing', $2, $3, $4::uuid, $5, $6)`,
      [
        rule.id,
        `Error rate spike${surfaceLabel}: ${errorRate.toFixed(1)}%`,
        `Error rate${surfaceLabel} ${errorRate.toFixed(1)}% exceeds threshold ${rule.threshold_value}%`,
        runId,
        errorRate,
        rule.threshold_value,
      ],
    );
  }
}

async function evaluateConsecutiveFailures(rule: AlertRuleRow, runId: string) {
  // Get endpoints that failed in the current run
  const failedNow = await query<{ endpoint_key: string; endpoint_name: string; endpoint_id: number }>(
    `SELECT r.endpoint_key, e.name AS endpoint_name, e.id AS endpoint_id
     FROM health_check_results r
     JOIN endpoint_registry e ON e.id = r.endpoint_id
     WHERE r.run_id = $1 AND r.status = 'unhealthy' AND e.execution_mode = 'live'`,
    [runId],
  );

  for (const ep of failedNow.rows) {
    // Count consecutive failures across recent runs
    const consecutive = await query<{ fail_count: string }>(
      `SELECT COUNT(*) AS fail_count FROM (
         SELECT r.status
         FROM health_check_results r
         JOIN health_check_runs hr ON hr.id = r.run_id
         WHERE r.endpoint_id = $1 AND hr.status = 'completed'
         ORDER BY hr.started_at DESC
         LIMIT $2
       ) sub
       WHERE sub.status = 'unhealthy'`,
      [ep.endpoint_id, rule.threshold_value],
    );

    const failCount = Number(consecutive.rows[0]?.fail_count || 0);
    if (failCount >= rule.threshold_value) {
      const existing = await query<{ id: number }>(
        `SELECT id FROM triggered_alerts WHERE rule_id = $1 AND endpoint_key = $2 AND state = 'firing'`,
        [rule.id, ep.endpoint_key],
      );
      if (existing.rows.length > 0) continue;

      await query(
        `INSERT INTO triggered_alerts (rule_id, state, title, message, endpoint_key, endpoint_name, run_id, metric_value, threshold_value)
         VALUES ($1, 'firing', $2, $3, $4, $5, $6::uuid, $7, $8)`,
        [
          rule.id,
          `${ep.endpoint_name} failed ${failCount} consecutive checks`,
          `Endpoint ${ep.endpoint_key} has failed ${failCount} consecutive health checks (threshold: ${rule.threshold_value})`,
          ep.endpoint_key,
          ep.endpoint_name,
          runId,
          failCount,
          rule.threshold_value,
        ],
      );
    }
  }
}

async function autoResolveAlerts(runId: string) {
  // Get all healthy endpoints from this run
  const healthy = await query<{ endpoint_key: string }>(
    `SELECT r.endpoint_key FROM health_check_results r WHERE r.run_id = $1 AND r.status = 'healthy'`,
    [runId],
  );

  const healthyKeys = healthy.rows.map((r) => r.endpoint_key);
  if (healthyKeys.length === 0) return;

  // Auto-resolve firing alerts for endpoints that are now healthy
  // (only for service_down, high_latency, consecutive_failures)
  await query(
    `UPDATE triggered_alerts
     SET state = 'resolved', resolved_at = NOW()
     WHERE state = 'firing'
       AND endpoint_key = ANY($1)
       AND rule_id IN (SELECT id FROM alert_rules WHERE rule_type IN ('service_down', 'high_latency', 'consecutive_failures'))`,
    [healthyKeys],
  );

  // Auto-resolve health_rate_drop if rate is now above threshold
  const liveStats = await query<{ total: string; healthy_count: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE e.execution_mode = 'live') AS total,
       COUNT(*) FILTER (WHERE r.status = 'healthy' AND e.execution_mode = 'live') AS healthy_count
     FROM health_check_results r
     JOIN endpoint_registry e ON e.id = r.endpoint_id
     WHERE r.run_id = $1`,
    [runId],
  );

  const total = Number(liveStats.rows[0]?.total || 0);
  const healthyCount = Number(liveStats.rows[0]?.healthy_count || 0);
  if (total > 0) {
    const currentRate = (healthyCount / total) * 100;

    // Resolve health_rate_drop alerts if rate is now above their threshold
    const firingRateAlerts = await query<{ id: number; threshold_value: number }>(
      `SELECT ta.id, ta.threshold_value
       FROM triggered_alerts ta
       JOIN alert_rules ar ON ar.id = ta.rule_id
       WHERE ta.state = 'firing' AND ar.rule_type = 'health_rate_drop'`,
    );

    for (const alert of firingRateAlerts.rows) {
      if (currentRate >= Number(alert.threshold_value)) {
        await query(
          `UPDATE triggered_alerts SET state = 'resolved', resolved_at = NOW() WHERE id = $1`,
          [alert.id],
        );
      }
    }
  }
}
