import type { DashboardPayload } from "@/lib/types";

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function getSurfaceLabel(surface: string) {
  const labels: Record<string, string> = {
    frontend: "Frontend",
    backend: "Backend",
    infrastructure: "Infrastructure",
    catalog: "Catalog",
  };
  return labels[surface] ?? surface;
}

function getSurfaceColor(surface: string) {
  const colors: Record<string, { bg: string; text: string; iconBg: string }> = {
    frontend: { bg: "#eef2ff", text: "#6366f1", iconBg: "#e0e7ff" },
    backend: { bg: "#f0f9ff", text: "#0284c7", iconBg: "#e0f2fe" },
    infrastructure: { bg: "#fff7ed", text: "#ea580c", iconBg: "#ffedd5" },
    catalog: { bg: "#f8fafc", text: "#64748b", iconBg: "#f1f5f9" },
  };
  return colors[surface] ?? colors.catalog;
}

function getSurfaceIconSvg(surface: string, color: string) {
  if (surface === "frontend") {
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`;
  }
  if (surface === "backend") {
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="5" width="16" height="14" rx="3"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>`;
  }
  if (surface === "infrastructure") {
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="6" cy="6" r="1" fill="${color}"/><circle cx="6" cy="18" r="1" fill="${color}"/></svg>`;
  }
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" xmlns="http://www.w3.org/2000/svg"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>`;
}

export function generateEmailHtml(payload: DashboardPayload): string {
  const run = payload.run;
  const totalEndpoints = payload.totals.endpoints;
  const totalHealthy = run?.healthyCount ?? 0;
  const totalUnhealthy = run?.unhealthyCount ?? 0;
  const overallRate = run && run.completedChecks > 0
    ? ((totalHealthy / run.completedChecks) * 100).toFixed(1)
    : "0.0";
  const runDate = run?.startedAt
    ? new Date(run.startedAt).toLocaleString("en-IN", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: true,
      })
    : new Date().toLocaleString("en-IN");

  const duration = run?.completedAt && run?.startedAt
    ? ((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000).toFixed(1)
    : "—";

  const groupCards = payload.groups.map((group) => {
    const total = group.endpoints.length;
    const healthy = group.endpoints.filter((e) => e.latestStatus === "healthy").length;
    const failed = group.endpoints.filter((e) => e.latestStatus === "unhealthy").length;
    const successRate = total > 0 ? (healthy / total) * 100 : 0;
    const errorRate = total > 0 ? (failed / total) * 100 : 0;
    const surfaceColors = getSurfaceColor(group.surface);

    return `
      <td style="width:25%;padding:8px;vertical-align:top;">
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:20px;position:relative;${
          group.surface === "catalog" ? "overflow:hidden;" : ""
        }">
          ${group.surface === "catalog" ? `
            <div style="position:absolute;top:12px;right:-30px;transform:rotate(45deg);background:#f1f5f9;padding:2px 32px;font-size:8px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#94a3b8;border:1px solid #e2e8f0;">CATALOG</div>
          ` : ""}
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
            <div style="width:40px;height:40px;border-radius:12px;background:${surfaceColors.iconBg};display:flex;align-items:center;justify-content:center;">
              ${getSurfaceIconSvg(group.surface, surfaceColors.text)}
            </div>
            <div>
              <div style="font-size:16px;font-weight:700;color:#1e293b;line-height:1.3;">${group.component}</div>
              <div style="font-size:11px;color:#94a3b8;text-transform:capitalize;">${getSurfaceLabel(group.surface)}</div>
            </div>
          </div>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
            <tr>
              <td style="width:50%;padding-right:4px;">
                <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:10px 12px;">
                  <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#16a34a;">Success</div>
                  <div style="font-size:20px;font-weight:700;color:#15803d;margin-top:4px;">${formatPercent(successRate)}</div>
                </div>
              </td>
              <td style="width:50%;padding-left:4px;">
                <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:10px 12px;">
                  <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#dc2626;">Error</div>
                  <div style="font-size:20px;font-weight:700;color:#b91c1c;margin-top:4px;">${formatPercent(errorRate)}</div>
                </div>
              </td>
            </tr>
          </table>

          <div style="border-top:1px solid #f1f5f9;padding-top:12px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="text-align:center;width:33%;">
                  <div style="font-size:11px;color:#94a3b8;">Total</div>
                  <div style="font-size:18px;font-weight:700;color:#334155;margin-top:2px;">${total}</div>
                </td>
                <td style="text-align:center;width:33%;">
                  <div style="font-size:11px;color:#10b981;">Pass</div>
                  <div style="font-size:18px;font-weight:700;color:#059669;margin-top:2px;">${healthy}</div>
                </td>
                <td style="text-align:center;width:33%;">
                  <div style="font-size:11px;color:#ef4444;">Fail</div>
                  <div style="font-size:18px;font-weight:700;color:#dc2626;margin-top:2px;">${failed}</div>
                </td>
              </tr>
            </table>
          </div>
        </div>
      </td>
    `;
  });

  // Arrange cards in rows of 4
  let cardRows = "";
  for (let i = 0; i < groupCards.length; i += 4) {
    const rowCards = groupCards.slice(i, i + 4);
    // Pad with empty cells if needed
    while (rowCards.length < 4) {
      rowCards.push(`<td style="width:25%;padding:8px;"></td>`);
    }
    cardRows += `<tr>${rowCards.join("")}</tr>`;
  }

  // Build unhealthy endpoints table
  const unhealthyEndpoints = payload.groups
    .flatMap((g) => g.endpoints)
    .filter((e) => e.latestStatus === "unhealthy");

  let unhealthySection = "";
  if (unhealthyEndpoints.length > 0) {
    const rows = unhealthyEndpoints.map((ep) => `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:600;color:#334155;">${ep.name}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#64748b;">${ep.component}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;">
          <span style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:999px;padding:2px 10px;font-size:10px;font-weight:700;">UNHEALTHY</span>
        </td>
        <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#ef4444;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${ep.latestErrorMessage ?? "—"}</td>
      </tr>
    `).join("");

    unhealthySection = `
      <div style="margin-top:32px;">
        <h2 style="font-size:18px;font-weight:700;color:#1e293b;margin:0 0 16px 0;">Failed Endpoints (${unhealthyEndpoints.length})</h2>
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:10px 16px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#64748b;font-weight:600;">Endpoint</th>
                <th style="padding:10px 16px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#64748b;font-weight:600;">Component</th>
                <th style="padding:10px 16px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#64748b;font-weight:600;">Status</th>
                <th style="padding:10px 16px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#64748b;font-weight:600;">Error</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sentinel Health Report</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f7fb;font-family:'Segoe UI','Helvetica Neue',Helvetica,Arial,sans-serif;color:#1e293b;">
  <div style="max-width:960px;margin:0 auto;padding:32px 16px;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#3b82f6 0%,#2563eb 100%);border-radius:20px;padding:32px;margin-bottom:32px;color:#ffffff;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <div style="font-size:24px;font-weight:700;letter-spacing:-0.5px;">Sentinel Health Report</div>
            <div style="font-size:13px;opacity:0.85;margin-top:6px;">${runDate}</div>
          </td>
          <td style="text-align:right;vertical-align:top;">
            <div style="display:inline-block;background:rgba(255,255,255,0.2);border-radius:12px;padding:12px 20px;text-align:center;">
              <div style="font-size:28px;font-weight:700;">${overallRate}%</div>
              <div style="font-size:11px;opacity:0.9;margin-top:2px;">Health Rate</div>
            </div>
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
        <tr>
          <td style="width:25%;text-align:center;background:rgba(255,255,255,0.15);border-radius:10px;padding:10px;">
            <div style="font-size:20px;font-weight:700;">${totalEndpoints}</div>
            <div style="font-size:10px;opacity:0.8;margin-top:2px;">Endpoints</div>
          </td>
          <td style="width:4px;"></td>
          <td style="width:25%;text-align:center;background:rgba(255,255,255,0.15);border-radius:10px;padding:10px;">
            <div style="font-size:20px;font-weight:700;">${totalHealthy}</div>
            <div style="font-size:10px;opacity:0.8;margin-top:2px;">Healthy</div>
          </td>
          <td style="width:4px;"></td>
          <td style="width:25%;text-align:center;background:rgba(255,255,255,0.15);border-radius:10px;padding:10px;">
            <div style="font-size:20px;font-weight:700;">${totalUnhealthy}</div>
            <div style="font-size:10px;opacity:0.8;margin-top:2px;">Failed</div>
          </td>
          <td style="width:4px;"></td>
          <td style="width:25%;text-align:center;background:rgba(255,255,255,0.15);border-radius:10px;padding:10px;">
            <div style="font-size:20px;font-weight:700;">${duration}s</div>
            <div style="font-size:10px;opacity:0.8;margin-top:2px;">Duration</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Service Health Cards -->
    <h2 style="font-size:18px;font-weight:700;color:#1e293b;margin:0 0 16px 0;">Service Health Overview</h2>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${cardRows}
    </table>

    ${unhealthySection}

    <!-- Footer -->
    <div style="margin-top:40px;text-align:center;padding:20px;border-top:1px solid #e2e8f0;">
      <div style="font-size:12px;color:#94a3b8;">
        Generated by <strong style="color:#3b82f6;">Sentinel Monitor</strong> &mdash; Zomato Clone Health Check System
      </div>
      <div style="font-size:11px;color:#cbd5e1;margin-top:6px;">
        Run ID: ${run?.id ?? "N/A"} &bull; ${new Date().toISOString()}
      </div>
    </div>

  </div>
</body>
</html>
  `.trim();
}
