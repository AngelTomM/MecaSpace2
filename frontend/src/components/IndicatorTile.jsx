import React from "react";

function Sparkline({ values, color }) {
  if (!values || values.length < 2) return null;
  const recent = values.slice(-18);
  const min = Math.min(...recent);
  const max = Math.max(...recent);
  const span = max - min || 1;
  const w = 88;
  const h = 24;
  const pts = recent
    .map((v, i) => {
      const x = (i / (recent.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ flexShrink: 0 }}>
      <polyline fill="none" stroke={color} strokeWidth="2" points={pts} strokeLinejoin="round" />
    </svg>
  );
}

export function evalVariableState(varKey, val, umbrales, isStale = false) {
  if (isStale) {
    return { status: "Stale", color: "#06b6d4", badge: "OBSOLETO", arrow: "⏱" };
  }
  const cfg = umbrales?.biomarkers?.[varKey];
  if (!cfg) return { status: "Nominal", color: "#10b981", badge: "NORMAL", arrow: "•" };

  const cb = cfg.critico_bajo;
  const ca = cfg.critico_alto;
  const [nMin, nMax] = cfg.normal;

  if (cb !== undefined && cb !== null && val < Number(cb)) {
    return { status: "Critical", color: "#ef4444", badge: "CRÍTICO ↓", arrow: "↓" };
  }
  if (ca !== undefined && ca !== null && val > Number(ca)) {
    return { status: "Critical", color: "#ef4444", badge: "CRÍTICO ↑", arrow: "↑" };
  }
  if (val >= Number(nMin) && val <= Number(nMax)) {
    return { status: "Nominal", color: "#10b981", badge: "NORMAL", arrow: "•" };
  }
  const arrow = val < Number(nMin) ? "↓" : "↑";
  return { status: "Caution", color: "#f59e0b", badge: `PRECAUCIÓN ${arrow}`, arrow };
}

export default function IndicatorTile({
  varKey,
  label,
  value,
  unit,
  historyValues,
  umbrales,
  isStale,
  subText,
  onQuickEdit,
}) {
  const est = evalVariableState(varKey, value, umbrales, isStale);

  return (
    <div className={`kpi-tile ${est.status}`}>
      <div className="kpi-top">
        <span>{label}</span>
        <span style={{ color: est.color }}>{est.badge}</span>
      </div>

      <div className="kpi-value-row">
        <div className="kpi-value tabular">
          {value}
          <span className="kpi-unit">{unit}</span>
          <span style={{ fontSize: "0.95rem", marginLeft: "5px", color: est.color }}>{est.arrow}</span>
        </div>
        <Sparkline values={historyValues} color={est.color} />
      </div>

      <div className="kpi-sub">
        <span>{subText}</span>
        {onQuickEdit && (
          <button className="btn btn-sm" onClick={onQuickEdit}>
            + Medir
          </button>
        )}
      </div>
    </div>
  );
}
