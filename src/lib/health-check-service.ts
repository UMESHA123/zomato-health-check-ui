import net from "node:net";
import { query } from "@/lib/db";
import { endpointCatalog } from "@/lib/endpoint-catalog";
import { evaluateAlerts } from "@/lib/alert-service";
import type {
  DashboardEndpoint,
  DashboardPayload,
  DashboardRun,
  HealthStatus,
  RunHistoryItem,
  RunStatus,
} from "@/lib/types";

type EndpointRow = {
  id: number;
  endpoint_key: string;
  name: string;
  component: string;
  surface: DashboardEndpoint["surface"];
  route_path: string;
  target_kind: DashboardEndpoint["targetKind"];
  target_url: string | null;
  method: string;
  expected_status_codes: number[];
  execution_mode: DashboardEndpoint["executionMode"];
  requires_auth: boolean;
  sequence: number;
  notes: string | null;
};

type RunRow = {
  id: string;
  status: RunStatus;
  total_checks: number;
  completed_checks: number;
  healthy_count: number;
  unhealthy_count: number;
  skipped_count: number;
  started_at: string;
  completed_at: string | null;
};

type ResultRow = {
  endpoint_id: number;
  status: HealthStatus;
  http_status: number | null;
  duration_ms: number | null;
  error_message: string | null;
  created_at: string;
};

let bootstrapPromise: Promise<void> | null = null;
const activeRuns = new Set<string>();

function truncatePayload(payload: unknown, maxLength = 1800) {
  const serialized = JSON.stringify(payload);
  if (serialized.length <= maxLength) {
    return serialized;
  }
  return `${serialized.slice(0, maxLength)}...`;
}

async function ensureSchema() {
  await query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS endpoint_registry (
      id SERIAL PRIMARY KEY,
      endpoint_key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      component TEXT NOT NULL,
      surface TEXT NOT NULL,
      route_path TEXT NOT NULL,
      target_kind TEXT NOT NULL DEFAULT 'http',
      target_url TEXT,
      method TEXT NOT NULL DEFAULT 'GET',
      expected_status_codes INTEGER[] NOT NULL DEFAULT ARRAY[200],
      execution_mode TEXT NOT NULL DEFAULT 'live',
      requires_auth BOOLEAN NOT NULL DEFAULT FALSE,
      sequence INTEGER NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      notes TEXT,
      sample_payload JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS health_check_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      status TEXT NOT NULL DEFAULT 'pending',
      total_checks INTEGER NOT NULL DEFAULT 0,
      completed_checks INTEGER NOT NULL DEFAULT 0,
      healthy_count INTEGER NOT NULL DEFAULT 0,
      unhealthy_count INTEGER NOT NULL DEFAULT 0,
      skipped_count INTEGER NOT NULL DEFAULT 0,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      summary JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS health_check_results (
      id BIGSERIAL PRIMARY KEY,
      run_id UUID NOT NULL REFERENCES health_check_runs(id) ON DELETE CASCADE,
      endpoint_id INTEGER NOT NULL REFERENCES endpoint_registry(id) ON DELETE CASCADE,
      endpoint_key TEXT NOT NULL,
      component TEXT NOT NULL,
      surface TEXT NOT NULL,
      status TEXT NOT NULL,
      http_status INTEGER,
      duration_ms INTEGER,
      request_payload JSONB,
      response_payload JSONB,
      response_excerpt TEXT,
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (run_id, endpoint_id)
    );
  `);
}

async function syncEndpointCatalog() {
  for (const item of endpointCatalog) {
    await query(
      `
        INSERT INTO endpoint_registry (
          endpoint_key,
          name,
          component,
          surface,
          route_path,
          target_kind,
          target_url,
          method,
          expected_status_codes,
          execution_mode,
          requires_auth,
          sequence,
          notes,
          sample_payload,
          active,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9::int[], $10, $11, $12, $13, $14::jsonb, true, NOW()
        )
        ON CONFLICT (endpoint_key) DO UPDATE SET
          name = EXCLUDED.name,
          component = EXCLUDED.component,
          surface = EXCLUDED.surface,
          route_path = EXCLUDED.route_path,
          target_kind = EXCLUDED.target_kind,
          target_url = EXCLUDED.target_url,
          method = EXCLUDED.method,
          expected_status_codes = EXCLUDED.expected_status_codes,
          execution_mode = EXCLUDED.execution_mode,
          requires_auth = EXCLUDED.requires_auth,
          sequence = EXCLUDED.sequence,
          notes = EXCLUDED.notes,
          sample_payload = EXCLUDED.sample_payload,
          active = true,
          updated_at = NOW()
      `,
      [
        item.key,
        item.name,
        item.component,
        item.surface,
        item.routePath,
        item.targetKind,
        item.targetUrl || null,
        item.method,
        item.expectedStatusCodes,
        item.executionMode,
        item.requiresAuth,
        item.sequence,
        item.notes || null,
        item.samplePayload ? JSON.stringify(item.samplePayload) : null,
      ],
    );
  }
}

export async function bootstrapHealthModule() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await ensureSchema();
      await syncEndpointCatalog();
    })();
  }

  await bootstrapPromise;
}

function toDashboardRun(row: RunRow): DashboardRun {
  return {
    id: row.id,
    status: row.status,
    totalChecks: row.total_checks,
    completedChecks: row.completed_checks,
    healthyCount: row.healthy_count,
    unhealthyCount: row.unhealthy_count,
    skippedCount: row.skipped_count,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

async function getRun(runId?: string) {
  if (runId) {
    const result = await query<RunRow>(
      `
        SELECT id, status, total_checks, completed_checks, healthy_count, unhealthy_count, skipped_count, started_at, completed_at
        FROM health_check_runs
        WHERE id = $1
      `,
      [runId],
    );
    return result.rows[0] ? toDashboardRun(result.rows[0]) : null;
  }

  const result = await query<RunRow>(`
    SELECT id, status, total_checks, completed_checks, healthy_count, unhealthy_count, skipped_count, started_at, completed_at
    FROM health_check_runs
    ORDER BY started_at DESC
    LIMIT 1
  `);

  return result.rows[0] ? toDashboardRun(result.rows[0]) : null;
}

export async function getDashboardPayload(runId?: string): Promise<DashboardPayload> {
  await bootstrapHealthModule();

  const run = await getRun(runId);

  const endpointsResult = await query<EndpointRow>(`
    SELECT
      id,
      endpoint_key,
      name,
      component,
      surface,
      route_path,
      target_kind,
      target_url,
      method,
      expected_status_codes,
      execution_mode,
      requires_auth,
      sequence,
      notes
    FROM endpoint_registry
    WHERE active = true
    ORDER BY sequence, component, name
  `);

  let resultMap = new Map<number, ResultRow>();

  if (run) {
    const results = await query<ResultRow>(
      `
        SELECT endpoint_id, status, http_status, duration_ms, error_message, created_at
        FROM health_check_results
        WHERE run_id = $1
      `,
      [run.id],
    );
    resultMap = new Map(results.rows.map((row) => [row.endpoint_id, row]));
  }

  const endpoints: DashboardEndpoint[] = endpointsResult.rows.map((row) => {
    const latest = resultMap.get(row.id);
    return {
      id: row.id,
      endpointKey: row.endpoint_key,
      name: row.name,
      component: row.component,
      surface: row.surface,
      routePath: row.route_path,
      targetKind: row.target_kind,
      targetUrl: row.target_url,
      method: row.method,
      expectedStatusCodes: row.expected_status_codes,
      executionMode: row.execution_mode,
      requiresAuth: row.requires_auth,
      notes: row.notes,
      sequence: row.sequence,
      latestStatus: latest?.status || null,
      latestHttpStatus: latest?.http_status ?? null,
      latestDurationMs: latest?.duration_ms ?? null,
      latestErrorMessage: latest?.error_message ?? null,
      latestCreatedAt: latest?.created_at ?? null,
    };
  });

  const groups = Object.values(
    endpoints.reduce<Record<string, DashboardPayload["groups"][number]>>((acc, endpoint) => {
      const key = `${endpoint.surface}:${endpoint.component}`;
      if (!acc[key]) {
        acc[key] = {
          component: endpoint.component,
          surface: endpoint.surface,
          endpoints: [],
        };
      }
      acc[key].endpoints.push(endpoint);
      return acc;
    }, {}),
  );

  return {
    run,
    totals: {
      endpoints: endpoints.length,
      liveEndpoints: endpoints.filter((endpoint) => endpoint.executionMode === "live").length,
      catalogOnlyEndpoints: endpoints.filter((endpoint) => endpoint.executionMode === "catalog_only").length,
    },
    groups,
  };
}

async function performHttpCheck(endpoint: EndpointRow) {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(endpoint.target_url!, {
      method: endpoint.method,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
    });

    const raw = await response.text();
    let payload: unknown = raw;

    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      payload = { raw };
    }

    const healthy =
      endpoint.expected_status_codes.includes(response.status) &&
      !(
        typeof payload === "object" &&
        payload !== null &&
        "status" in payload &&
        ["DOWN", "DEGRADED", "UNHEALTHY"].includes(String(payload.status).toUpperCase())
      );

    return {
      status: healthy ? ("healthy" as const) : ("unhealthy" as const),
      httpStatus: response.status,
      durationMs: Date.now() - started,
      responsePayload: payload,
      errorMessage: healthy ? null : `Unexpected status ${response.status}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown HTTP error";
    return {
      status: "unhealthy" as const,
      httpStatus: null,
      durationMs: Date.now() - started,
      responsePayload: { error: message },
      errorMessage: message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function performTcpCheck(endpoint: EndpointRow) {
  const started = Date.now();
  const target = new URL(endpoint.target_url!);

  return new Promise<{
    status: "healthy" | "unhealthy";
    httpStatus: number | null;
    durationMs: number;
    responsePayload: Record<string, unknown>;
    errorMessage: string | null;
  }>((resolve) => {
    const socket = net.createConnection({
      host: target.hostname,
      port: Number(target.port),
    });

    const cleanup = () => {
      socket.removeAllListeners();
      socket.end();
      socket.destroy();
    };

    socket.setTimeout(5000);

    socket.on("connect", () => {
      const duration = Date.now() - started;
      cleanup();
      resolve({
        status: "healthy",
        httpStatus: 200,
        durationMs: duration,
        responsePayload: { host: target.hostname, port: Number(target.port), protocol: target.protocol },
        errorMessage: null,
      });
    });

    socket.on("timeout", () => {
      const duration = Date.now() - started;
      cleanup();
      resolve({
        status: "unhealthy",
        httpStatus: null,
        durationMs: duration,
        responsePayload: { host: target.hostname, port: Number(target.port), timeout: true },
        errorMessage: "TCP timeout",
      });
    });

    socket.on("error", (error) => {
      const duration = Date.now() - started;
      cleanup();
      resolve({
        status: "unhealthy",
        httpStatus: null,
        durationMs: duration,
        responsePayload: { host: target.hostname, port: Number(target.port) },
        errorMessage: error.message,
      });
    });
  });
}

async function performDatabaseCheck() {
  const started = Date.now();

  try {
    const result = await query<{ database_name: string; endpoint_count: string }>(`
      SELECT
        current_database() AS database_name,
        (SELECT COUNT(*)::text FROM endpoint_registry) AS endpoint_count
    `);

    return {
      status: "healthy" as const,
      httpStatus: 200,
      durationMs: Date.now() - started,
      responsePayload: result.rows[0],
      errorMessage: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database error";
    return {
      status: "unhealthy" as const,
      httpStatus: null,
      durationMs: Date.now() - started,
      responsePayload: { error: message },
      errorMessage: message,
    };
  }
}

async function executeCheck(endpoint: EndpointRow) {
  if (endpoint.execution_mode === "catalog_only") {
    const hasRouteMetadata =
      Boolean(endpoint.route_path?.trim()) &&
      Boolean(endpoint.method?.trim()) &&
      endpoint.expected_status_codes.length > 0;

    return {
      status: hasRouteMetadata ? ("healthy" as const) : ("unhealthy" as const),
      httpStatus: hasRouteMetadata ? 200 : null,
      durationMs: 0,
      responsePayload: {
        mode: "registry-validation",
        verified: hasRouteMetadata,
        reason: endpoint.requires_auth
          ? "Validated endpoint registration for an authenticated route."
          : "Validated endpoint registration for a cataloged route.",
        routePath: endpoint.route_path,
        method: endpoint.method,
        expectedStatusCodes: endpoint.expected_status_codes,
      },
      errorMessage: hasRouteMetadata ? null : "Endpoint registry entry is incomplete",
    };
  }

  if (!endpoint.target_url) {
    return {
      status: "unhealthy" as const,
      httpStatus: null,
      durationMs: 0,
      responsePayload: { error: "Missing target URL" },
      errorMessage: "Missing target URL",
    };
  }

  if (endpoint.target_kind === "http") {
    return performHttpCheck(endpoint);
  }

  if (endpoint.target_kind === "tcp") {
    return performTcpCheck(endpoint);
  }

  return performDatabaseCheck();
}

async function updateRunCounters(runId: string) {
  await query(
    `
      UPDATE health_check_runs AS r
      SET
        completed_checks = counters.completed_count,
        healthy_count = counters.healthy_count,
        unhealthy_count = counters.unhealthy_count,
        skipped_count = counters.skipped_count,
        summary = jsonb_build_object(
          'healthy', counters.healthy_count,
          'unhealthy', counters.unhealthy_count,
          'skipped', counters.skipped_count
        )
      FROM (
        SELECT
          COUNT(*) AS completed_count,
          COUNT(*) FILTER (WHERE status = 'healthy') AS healthy_count,
          COUNT(*) FILTER (WHERE status = 'unhealthy') AS unhealthy_count,
          COUNT(*) FILTER (WHERE status = 'skipped') AS skipped_count
        FROM health_check_results
        WHERE run_id = $1
      ) AS counters
      WHERE r.id = $1
    `,
    [runId],
  );
}

export async function startRun() {
  await bootstrapHealthModule();

  const running = await query<{ id: string }>(
    `SELECT id FROM health_check_runs WHERE status IN ('pending', 'running') ORDER BY started_at DESC LIMIT 1`,
  );

  if (running.rows[0]) {
    return {
      runId: running.rows[0].id,
      alreadyRunning: true,
    };
  }

  const total = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM endpoint_registry WHERE active = true`);
  const totalChecks = Number(total.rows[0]?.count || 0);

  const created = await query<{ id: string }>(
    `
      INSERT INTO health_check_runs (status, total_checks)
      VALUES ('pending', $1)
      RETURNING id
    `,
    [totalChecks],
  );

  const runId = created.rows[0].id;
  void executeRun(runId);

  return {
    runId,
    alreadyRunning: false,
  };
}

async function executeRun(runId: string) {
  if (activeRuns.has(runId)) {
    return;
  }

  activeRuns.add(runId);

  try {
    await query(`UPDATE health_check_runs SET status = 'running', started_at = NOW() WHERE id = $1`, [runId]);

    const endpoints = await query<EndpointRow>(`
      SELECT
        id,
        endpoint_key,
        name,
        component,
        surface,
        route_path,
        target_kind,
        target_url,
        method,
        expected_status_codes,
        execution_mode,
        requires_auth,
        sequence,
        notes
      FROM endpoint_registry
      WHERE active = true
      ORDER BY sequence, component, name
    `);

    for (const endpoint of endpoints.rows) {
      const result = await executeCheck(endpoint);
      await query(
        `
          INSERT INTO health_check_results (
            run_id,
            endpoint_id,
            endpoint_key,
            component,
            surface,
            status,
            http_status,
            duration_ms,
            request_payload,
            response_payload,
            response_excerpt,
            error_message
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12
          )
          ON CONFLICT (run_id, endpoint_id) DO UPDATE SET
            status = EXCLUDED.status,
            http_status = EXCLUDED.http_status,
            duration_ms = EXCLUDED.duration_ms,
            request_payload = EXCLUDED.request_payload,
            response_payload = EXCLUDED.response_payload,
            response_excerpt = EXCLUDED.response_excerpt,
            error_message = EXCLUDED.error_message,
            created_at = NOW()
        `,
        [
          runId,
          endpoint.id,
          endpoint.endpoint_key,
          endpoint.component,
          endpoint.surface,
          result.status,
          result.httpStatus,
          result.durationMs,
          JSON.stringify({
            method: endpoint.method,
            routePath: endpoint.route_path,
            targetUrl: endpoint.target_url,
          }),
          JSON.stringify(result.responsePayload),
          truncatePayload(result.responsePayload),
          result.errorMessage,
        ],
      );

      await updateRunCounters(runId);
    }

    await query(
      `UPDATE health_check_runs SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      [runId],
    );
    await updateRunCounters(runId);

    // Evaluate alert rules after run completes
    try {
      await evaluateAlerts(runId);
    } catch (alertError) {
      console.error("Alert evaluation failed:", alertError);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown health-check failure";
    await query(
      `
        UPDATE health_check_runs
        SET status = 'failed', completed_at = NOW(), summary = jsonb_build_object('error', $2)
        WHERE id = $1
      `,
      [runId, message],
    );
  } finally {
    activeRuns.delete(runId);
  }
}

export async function getRunHistory(limit = 50, offset = 0): Promise<{ runs: RunHistoryItem[]; total: number }> {
  await bootstrapHealthModule();

  const countResult = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM health_check_runs`);
  const total = Number(countResult.rows[0]?.count || 0);

  const result = await query<RunRow>(
    `SELECT id, status, total_checks, completed_checks, healthy_count, unhealthy_count, skipped_count, started_at, completed_at
     FROM health_check_runs
     ORDER BY started_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  );

  const runs: RunHistoryItem[] = result.rows.map((row) => {
    const completedChecks = row.completed_checks;
    const healthRate = completedChecks > 0 ? (row.healthy_count / completedChecks) * 100 : 0;
    const duration = row.completed_at && row.started_at
      ? new Date(row.completed_at).getTime() - new Date(row.started_at).getTime()
      : null;

    return {
      id: row.id,
      status: row.status,
      totalChecks: row.total_checks,
      completedChecks: row.completed_checks,
      healthyCount: row.healthy_count,
      unhealthyCount: row.unhealthy_count,
      skippedCount: row.skipped_count,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      healthRate,
      duration,
    };
  });

  return { runs, total };
}

export async function getRunDetail(runId: string) {
  await bootstrapHealthModule();

  const runResult = await query<RunRow>(
    `SELECT id, status, total_checks, completed_checks, healthy_count, unhealthy_count, skipped_count, started_at, completed_at
     FROM health_check_runs WHERE id = $1`,
    [runId],
  );

  if (!runResult.rows[0]) return null;

  const run = toDashboardRun(runResult.rows[0]);

  const results = await query<{
    endpoint_key: string;
    endpoint_name: string;
    component: string;
    surface: string;
    status: HealthStatus;
    http_status: number | null;
    duration_ms: number | null;
    error_message: string | null;
    created_at: string;
  }>(
    `SELECT r.endpoint_key, e.name AS endpoint_name, r.component, r.surface,
            r.status, r.http_status, r.duration_ms, r.error_message, r.created_at
     FROM health_check_results r
     JOIN endpoint_registry e ON e.id = r.endpoint_id
     WHERE r.run_id = $1
     ORDER BY r.created_at`,
    [runId],
  );

  return {
    run,
    results: results.rows.map((r) => ({
      endpointKey: r.endpoint_key,
      endpointName: r.endpoint_name,
      component: r.component,
      surface: r.surface,
      status: r.status,
      httpStatus: r.http_status,
      durationMs: r.duration_ms,
      errorMessage: r.error_message,
      createdAt: r.created_at,
    })),
  };
}
