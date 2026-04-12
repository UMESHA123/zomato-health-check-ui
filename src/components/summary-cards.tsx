import type { DashboardPayload, EndpointSurface } from "@/lib/types";

interface SummaryCardsProps {
  payload: DashboardPayload | null;
  activeGroupKey: string | null;
  selectedGroupKey: string | null;
  onSelectGroup: (key: string | null) => void;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function getSurfaceIcon(surface: string) {
  if (surface === "frontend") {
    return (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="18" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    );
  }
  if (surface === "backend") {
    return (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="4" y="5" width="16" height="14" rx="3" />
        <path d="M8 9h8M8 13h8M8 17h5" />
      </svg>
    );
  }
  if (surface === "infrastructure") {
    return (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="2" y="2" width="20" height="8" rx="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" />
        <circle cx="6" cy="6" r="1" fill="currentColor" />
        <circle cx="6" cy="18" r="1" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  );
}

function getSurfaceColors(surface: string) {
  const map: Record<string, { iconBg: string; iconText: string; activeBorder: string; activeGlow: string }> = {
    frontend: { iconBg: "bg-indigo-50", iconText: "text-indigo-500", activeBorder: "border-indigo-400", activeGlow: "shadow-indigo-200" },
    backend: { iconBg: "bg-sky-50", iconText: "text-sky-500", activeBorder: "border-sky-400", activeGlow: "shadow-sky-200" },
    infrastructure: { iconBg: "bg-orange-50", iconText: "text-orange-500", activeBorder: "border-orange-400", activeGlow: "shadow-orange-200" },
    catalog: { iconBg: "bg-slate-50", iconText: "text-slate-400", activeBorder: "border-slate-400", activeGlow: "shadow-slate-200" },
  };
  return map[surface] ?? map.catalog;
}

function toGroupKey(surface: EndpointSurface, component: string) {
  return `${surface}:${component}`;
}

export { toGroupKey };

export function SummaryCards({ payload, activeGroupKey, selectedGroupKey, onSelectGroup }: SummaryCardsProps) {
  const groups = payload?.groups ?? [];

  if (groups.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {groups.map((group) => {
        const groupKey = toGroupKey(group.surface, group.component);
        const total = group.endpoints.length;
        const checked = group.endpoints.filter((e) => e.latestStatus !== null).length;
        const healthy = group.endpoints.filter((e) => e.latestStatus === "healthy").length;
        const failed = group.endpoints.filter((e) => e.latestStatus === "unhealthy").length;
        const successRate = total > 0 ? (healthy / total) * 100 : 0;
        const errorRate = total > 0 ? (failed / total) * 100 : 0;

        const isActive = activeGroupKey === groupKey;
        const isSelected = selectedGroupKey === groupKey;
        const isCompleted = checked === total && total > 0 && checked > 0;
        const isPending = checked === 0;
        const colors = getSurfaceColors(group.surface);

        // Determine card border/glow state
        let cardBorder = "border-slate-200";
        let cardShadow = "shadow-sm";
        let cardRing = "";

        if (isActive) {
          cardBorder = colors.activeBorder;
          cardShadow = `shadow-lg ${colors.activeGlow}`;
          cardRing = "ring-2 ring-offset-2 ring-blue-400";
        } else if (isSelected) {
          cardBorder = "border-blue-400";
          cardShadow = "shadow-md shadow-blue-100";
          cardRing = "ring-2 ring-blue-300";
        } else if (isCompleted && !isPending) {
          cardBorder = failed > 0 ? "border-rose-200" : "border-emerald-200";
        }

        return (
          <article
            key={groupKey}
            id={`section-${group.component.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}
            className={`relative cursor-pointer overflow-hidden rounded-2xl border bg-white p-5 transition-all duration-300 ${cardBorder} ${cardShadow} ${cardRing} hover:shadow-md`}
            onClick={() => onSelectGroup(isSelected ? null : groupKey)}
          >
            {/* Active scanning indicator */}
            {isActive && (
              <div className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-blue-100">
                <div className="h-full w-1/3 animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
              </div>
            )}

            {group.surface === "catalog" && (
              <div className="absolute right-[-32px] top-[14px] rotate-45 bg-slate-100 px-8 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-slate-400">
                Catalog
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors.iconBg} ${colors.iconText} ${isActive ? "animate-pulse" : ""}`}>
                {getSurfaceIcon(group.surface)}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-bold tracking-tight text-slate-800">{group.component}</h2>
                <p className="text-xs text-slate-400 capitalize">{group.surface}</p>
              </div>
              {/* Status dot */}
              {isActive && (
                <span className="flex h-3 w-3 shrink-0">
                  <span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-blue-500" />
                </span>
              )}
              {isSelected && !isActive && (
                <svg className="h-5 w-5 shrink-0 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>

            {/* Progress bar during active check */}
            {isActive && (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-500"
                  style={{ width: `${total > 0 ? (checked / total) * 100 : 0}%` }}
                />
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600">Success</p>
                <p className="mt-1 text-xl font-bold text-emerald-700">{formatPercent(successRate)}</p>
              </div>
              <div className="rounded-xl border border-rose-100 bg-rose-50/50 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-rose-600">Error</p>
                <p className="mt-1 text-xl font-bold text-rose-700">{formatPercent(errorRate)}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
              <div className="text-center">
                <p className="text-xs text-slate-400">Total</p>
                <p className="text-lg font-bold text-slate-700">{total}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-emerald-500">Pass</p>
                <p className="text-lg font-bold text-emerald-600">{healthy}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-rose-500">Fail</p>
                <p className="text-lg font-bold text-rose-600">{failed}</p>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
