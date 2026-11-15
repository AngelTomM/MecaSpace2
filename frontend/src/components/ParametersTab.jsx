import React, { useEffect, useRef, useState } from "react";
import { handleExportDownload } from "../engine/localApi";
import {
  METRIC_META,
  PARAM_ORDER,
  PROTOCOL_DICTIONARY,
  SYMPTOM_PROTOCOLS,
  extractUiMetrics,
  getTrendArrow,
} from "../data/nasaProtocols";
import { MetricIcon } from "./Icons";
import TimeTrendsPanel from "./TimeTrendsPanel";

export default function ParametersTab({
  data,
  alertSystem,
  focusedMetric,
  onAdjustMetric,
  onAdvanceDay,
  onToggleInhibit,
  onIntervention,
  onClearStale,
  onOpenPvt,
  onGoToTests,
  onToggleStaleDemo,
}) {
  const [filter, setFilter] = useState("all");
  const [selectedSymptom, setSelectedSymptom] = useState(() => Object.keys(SYMPTOM_PROTOCOLS)[0] || "Headache");
  const [freeSymptom, setFreeSymptom] = useState("");
  const [completedSteps, setCompletedSteps] = useState({});
  const [cvAnswer, setCvAnswer] = useState(null);

  // Guided breathing 4-4-6
  const [breathRunning, setBreathRunning] = useState(false);
  const [breathState, setBreathState] = useState({
    label: "Ready",
    secs: "4-4-6",
    scale: 0.88,
    bg: "rgba(16, 185, 129, 0.25)",
    border: "#10B981",
  });
  const breathTimerRef = useRef(null);

  useEffect(() => {
    if (!focusedMetric) return;
    const el = document.getElementById(`param-box-${focusedMetric}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.remove("card-highlight-pulse");
      void el.offsetWidth;
      el.classList.add("card-highlight-pulse");
    }
  }, [focusedMetric]);

  useEffect(() => {
    return () => {
      if (breathTimerRef.current) clearInterval(breathTimerRef.current);
    };
  }, []);

  const toggleBreathing = () => {
    if (breathRunning) {
      clearInterval(breathTimerRef.current);
      setBreathRunning(false);
      setBreathState({
        label: "Ready",
        secs: "4-4-6",
        scale: 0.88,
        bg: "rgba(16, 185, 129, 0.25)",
        border: "#10B981",
      });
      return;
    }

    setBreathRunning(true);
    const cycle = [
      { label: "Inhale", sec: 4, scale: 1.16, bg: "rgba(16, 185, 129, 0.35)", border: "#10B981" },
      { label: "Hold", sec: 4, scale: 1.16, bg: "rgba(234, 179, 8, 0.35)", border: "#EAB308" },
      { label: "Exhale", sec: 6, scale: 0.82, bg: "rgba(37, 99, 235, 0.35)", border: "#60A5FA" },
    ];
    let idx = 0;
    let rem = cycle[0].sec;

    const paint = () => {
      const c = cycle[idx];
      setBreathState({
        label: c.label,
        secs: `${rem}s`,
        scale: c.scale,
        bg: c.bg,
        border: c.border,
      });
    };
    paint();

    breathTimerRef.current = setInterval(() => {
      rem -= 1;
      if (rem <= 0) {
        idx = (idx + 1) % cycle.length;
        rem = cycle[idx].sec;
      }
      paint();
    }, 1000);
  };

  const m = extractUiMetrics(data);
  const lec = data.lectura || {};
  const cabin = data.cabin_env || {};
  const res = data.resultado || {};
  const ui = data.ui_state || {};
  const roster = data.crew_roster || [];
  const activeCrew = roster.find((c) => c.id === data.active_crew_id) || { name: "Spec. Christina Koch" };

  const { items, overallState, states, primaryBanner } = alertSystem;
  const abnormalCount = PARAM_ORDER.filter((k) => states[k].severity > 0).length;

  const filteredItems = items.filter((item) => {
    if (filter === "all") return true;
    if (filter === "protocol") return item.category === "alert";
    return item.category === filter;
  });

  const activeSymptomTitle = freeSymptom.trim() || selectedSymptom;
  const symptomSteps = SYMPTOM_PROTOCOLS[activeSymptomTitle] || [
    { sistema: false, texto: "Stop demanding activity and adopt a neutral posture in the cabin." },
    { sistema: false, texto: "Hydrate with 300 ml of water and check vital signs in Summary." },
    { sistema: true, texto: "[SYSTEM] Log symptom in encrypted medical record and perform 4-4-6 breathing." },
  ];

  const doneCount = Object.values(completedSteps).filter(Boolean).length;

  const arrowColor = (st) => {
    if (st.severity >= 3) return "#EF4444";
    if (st.severity === 2) return "#EAB308";
    if (st.key === "stale") return "#06B6D4";
    return "#2563EB";
  };

  const top3 = res.top3_shap || [];
  const maxAbsShap = Math.max(...top3.map((t) => Math.abs(t.shap_valor)), 0.1);
  const activeProto = res.protocolo_codigo || primaryBanner.protoCode || "PROTO-NOM-00";
  const protoProc = res.procedimiento_electronico || PROTOCOL_DICTIONARY[activeProto];

  return (
    <section className="screen-section">
      {/* Header */}
      <header className="screen-header screen-header-bordered">
        <div>
          <h1 className="screen-title">All Parameters &amp; Protocols</h1>
          <p className="screen-subtitle">
            NASA-STD-3001 Vol. 1/2 Verification · <strong>{activeCrew.name}</strong> · Day {data.mission_day}
          </p>
        </div>

        <div className="header-controls">
          <button
            type="button"
            className={`pill-btn sm ${ui.datos_manuales_obsoletos ? "blue" : ""}`}
            onClick={onToggleStaleDemo}
            title="Simulate stale manual data in Cyan"
          >
            {ui.datos_manuales_obsoletos ? "⏱ Stale Data ON" : "⏱ Simulate Stale Data"}
          </button>
          <span
            className="mono status-pill"
            style={{
              backgroundColor: abnormalCount > 0 ? "#DC2626" : "#0F172A",
              color: "#FFFFFF",
            }}
          >
            {abnormalCount} / 8 abnormal
          </span>
          <span
            className={`status-pill ${overallState.blink ? "nasa-emergency-blink" : ""}`}
            style={{
              backgroundColor: overallState.pillBg,
              color: overallState.pillText,
              border: `1.5px solid ${overallState.pillBorder}`,
            }}
          >
            {overallState.label}
          </span>
        </div>
      </header>

      {/* Grilla de los 8 parámetros principales AHBM */}
      <div className="params-grid">
        {PARAM_ORDER.map((key) => {
          const meta = METRIC_META[key];
          const st = states[key];
          const val = meta.format(m);
          const dir = getTrendArrow(key, m);

          return (
            <article
              key={key}
              id={`param-box-${key}`}
              className="big-metric-box"
              style={{
                backgroundColor: st.cardBg,
                borderColor: st.cardBorder,
                minHeight: "154px",
                padding: "14px 16px",
                cursor: "default",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                  <span className="metric-icon-box" style={{ width: "32px", height: "32px" }}>
                    <MetricIcon metricKey={key} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <h2 style={{ margin: 0, fontSize: "13.5px", fontWeight: 800, color: "#0F172A" }}>
                      {meta.fullLabel}
                    </h2>
                  </div>
                </div>

                {meta.step != null ? (
                  <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                    <button
                      type="button"
                      className="pill-btn sm"
                      style={{ padding: "3px 9px", fontWeight: 800 }}
                      aria-label={`Decrease ${meta.fullLabel}`}
                      onClick={() => onAdjustMetric(meta.backendVar, -meta.step)}
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="pill-btn sm"
                      style={{ padding: "3px 9px", fontWeight: 800 }}
                      aria-label={`Increase ${meta.fullLabel}`}
                      onClick={() => onAdjustMetric(meta.backendVar, meta.step)}
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="pill-btn sm dark"
                    onClick={() => (key === "pvt" ? onOpenPvt() : onGoToTests())}
                  >
                    {key === "pvt" ? "Start" : "Test"}
                  </button>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "8px", marginTop: "10px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                  <span className="mono" style={{ fontSize: "28px", fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>
                    {val}
                  </span>
                  {dir && st.severity > 0 && (
                    <span style={{ fontSize: "14px", fontWeight: 800, color: arrowColor(st) }}>
                      {dir === "up" ? "↑" : "↓"}
                    </span>
                  )}
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>{meta.unit}</span>
                </div>

                <span
                  className={st.blink ? "nasa-emergency-blink" : ""}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "9px",
                    fontSize: "10px",
                    fontWeight: 800,
                    backgroundColor: st.badgeBg,
                    color: st.badgeText,
                  }}
                >
                  {st.label}
                </span>
              </div>
            </article>
          );
        })}
      </div>

      {/* Time Trends · 6 Core Indicators */}
      <TimeTrendsPanel data={data} />

      {/* Dos columnas operativas: Avisos + SHAP (izq) y Contramedidas + Síntomas + 4-4-6 (der) */}
      <div className="two-col-ops">
          {/* Log Symptom + Step-by-Step Guide + 4-4-6 Orb */}
          <div className="white-panel">
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>Log Symptom</h2>
            <div className="symptom-grid">
              {Object.keys(SYMPTOM_PROTOCOLS).map((sym) => {
                const isActive = !freeSymptom.trim() && selectedSymptom === sym;
                return (
                  <button
                    key={sym}
                    type="button"
                    className={`sym-pill ${isActive ? "active" : ""}`}
                    onClick={() => {
                      setFreeSymptom("");
                      setSelectedSymptom(sym);
                      setCompletedSteps({});
                    }}
                  >
                    • {sym}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={freeSymptom}
              onChange={(e) => {
                setFreeSymptom(e.target.value);
                setCompletedSteps({});
              }}
              placeholder="Enter another symptom..."
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "12px",
                background: "#FAF7F2",
                border: "1px solid #D6CFC2",
                fontSize: "12px",
                outline: "none",
              }}
            />
          </div>

          <div className="human-stage" style={{ padding: "18px", color: "#FFFFFF", display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
              <span
                className="mono"
                style={{
                  padding: "3px 9px",
                  borderRadius: "8px",
                  background: "#D946EF",
                  color: "#FFFFFF",
                  fontSize: "10px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                }}
              >
                Step-by-Step Guide · Table F.5-2
              </span>
              <span className="mono" style={{ fontSize: "12px", color: "#F0ABFC", fontWeight: 700 }}>
                {doneCount} / {symptomSteps.length}
              </span>
            </div>

            <h3 style={{ margin: 0, fontSize: "15.5px", fontWeight: 800 }}>
              Protocol: {activeSymptomTitle}
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {symptomSteps.map((step, i) => {
                const isDone = Boolean(completedSteps[i]);
                return (
                  <button
                    key={i}
                    type="button"
                    className={`guide-step-btn ${isDone ? "done" : ""}`}
                    style={
                      !isDone && !step.sistema
                        ? { borderColor: "#38BDF8", background: "rgba(15, 23, 42, 0.72)" }
                        : undefined
                    }
                    onClick={() => setCompletedSteps((prev) => ({ ...prev, [i]: !prev[i] }))}
                  >
                    <span
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "6px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        fontWeight: 800,
                        flexShrink: 0,
                        backgroundColor: isDone ? "#10B981" : step.sistema ? "#D946EF" : "#38BDF8",
                        color: isDone || !step.sistema ? "#052E16" : "#FFFFFF",
                      }}
                    >
                      {isDone ? "✓" : i + 1}
                    </span>
                    <span style={{ fontSize: "12px", fontWeight: 700, textDecoration: isDone ? "line-through" : "none" }}>
                      {step.texto}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Orbe Respiración Guiada 4-4-6 */}
            <div
              style={{
                borderRadius: "16px",
                background: "rgba(30, 41, 59, 0.85)",
                border: "1px solid #334155",
                padding: "14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <div>
                <span className="mono" style={{ fontSize: "10px", fontWeight: 800, color: "#34D399", textTransform: "uppercase" }}>
                  Self-Regulation
                </span>
                <h4 style={{ margin: "2px 0", fontSize: "14px", fontWeight: 800 }}>Guided Breathing 4-4-6</h4>
                <p style={{ margin: "0 0 8px", fontSize: "11px", color: "#CBD5E1" }}>
                  Inhale 4s · Hold 4s · Exhale 6s
                </p>
                <button
                  type="button"
                  className={`pill-btn sm ${breathRunning ? "dark" : "green"}`}
                  onClick={toggleBreathing}
                >
                  {breathRunning ? "Stop" : "Start 4-4-6"}
                </button>
              </div>

              <div
                className="breathing-orb"
                style={{
                  transform: `scale(${breathState.scale})`,
                  backgroundColor: breathState.bg,
                  borderColor: breathState.border,
                }}
              >
                <span style={{ fontSize: "11px", fontWeight: 800, color: "#FFFFFF" }}>{breathState.label}</span>
                <span className="mono" style={{ fontSize: "11px", color: "#6EE7B7" }}>{breathState.secs}</span>
              </div>
            </div>
          </div>
      </div>
    </section>
  );
}
