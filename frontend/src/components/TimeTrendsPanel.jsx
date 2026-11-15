import React from "react";

function MiniTrendChart({ title, unit, values, normRange, color }) {
  const w = 320;
  const h = 88;
  const recent = values.slice(-40);
  const [nMin, nMax] = normRange;
  const allVals = [...recent, nMin, nMax];
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const span = max - min || 1;

  const yPos = (val) => h - 8 - ((val - min) / span) * (h - 16);
  const bandTop = yPos(nMax);
  const bandH = Math.max(2, yPos(nMin) - bandTop);

  const pts = recent
    .map((v, i) => {
      const x = recent.length > 1 ? (i / (recent.length - 1)) * (w - 12) + 6 : w / 2;
      return `${x.toFixed(1)},${yPos(v).toFixed(1)}`;
    })
    .join(" ");

  const lastVal = recent.length ? recent[recent.length - 1] : 0;

  return (
    <div
      style={{
        background: "#FAF7F2",
        border: "1px solid #DFD8CA",
        borderRadius: "16px",
        padding: "10px 12px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "5px" }}>
        <strong style={{ color: "#0F172A" }}>{title}</strong>
        <span className="mono" style={{ color, fontWeight: 800 }}>
          {lastVal} {unit}
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ background: "#0F172A", borderRadius: "10px" }}>
        <rect x="0" y={bandTop} width={w} height={bandH} fill="rgba(16, 185, 129, 0.18)" />
        {recent.length > 1 && (
          <polyline fill="none" stroke={color} strokeWidth="2.2" points={pts} strokeLinejoin="round" />
        )}
      </svg>
    </div>
  );
}

const TREND_COLORS = ["#38BDF8", "#FB7185", "#EAB308", "#F472B6", "#A78BFA", "#10B981"];

export default function TimeTrendsPanel({ data }) {
  const historico = data?.historico || [];
  const umbrales = data?.umbrales || { biomarkers: {} };
  const indicadores = data?.indicadores_centrales || [];
  const etiquetas = data?.etiquetas || {};

  return (
    <div className="white-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
        <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>
          Time Trends · 6 Core Indicators (Green Band = Nominal)
        </h2>
        <span className="mono" style={{ fontSize: "11px", color: "#475569" }}>
          Last {historico.length} samples
        </span>
      </div>

      <div className="charts-grid-6">
        {indicadores.map((varKey, idx) => {
          const cfg = umbrales.biomarkers?.[varKey];
          if (!cfg) return null;
          const vals = historico.map((row) => Number(row[varKey]));
          return (
            <MiniTrendChart
              key={varKey}
              title={(etiquetas[varKey] || varKey).split("(")[0].trim()}
              unit={cfg.unit}
              values={vals}
              normRange={cfg.normal}
              color={TREND_COLORS[idx % TREND_COLORS.length]}
            />
          );
        })}
      </div>
    </div>
  );
}

