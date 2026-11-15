import React, { useState } from "react";
import {
  METRIC_META,
  PARAM_ORDER,
  PRIMARY_METRICS,
  SUMMARY_THREE_METRICS,
  extractUiMetrics,
  getQuickMetricPlan,
  getSpecificFirstAidRecommendation,
  getTrendArrow,
  pickHighestSeverity,
} from "../data/nasaProtocols";
import { MetricIcon } from "./Icons";

export default function SummaryTab({
  data,
  alertSystem,
  audioEnabled,
  onToggleAudio,
  onSelectCrew,
  onToggleEmergency,
  onAlarmAction,
  onIntervention,
  onClearStale,
  onFocusMetric,
  onGoToParameters,
  onOpenAssistant,
}) {
  const [selectedZone, setSelectedZone] = useState(null);
  const [showAllThree, setShowAllThree] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const m = extractUiMetrics(data);
  const ui = data.ui_state || {};
  const cabin = data.cabin_env || {};
  const res = data.resultado || {};
  const roster = data.crew_roster || [];
  const activeCrew = roster.find((c) => c.id === data.active_crew_id) || {
    id: "koch",
    name: "Spec. Christina Koch",
    blood: "O+",
  };

  const { states, primaryBanner, overallState, activeCount } = alertSystem;
  const plan = getQuickMetricPlan(m, states);

  // Status by anatomical zone
  const stHead = pickHighestSeverity([states.sleep, states.mood, states.pvt]);
  const stThorax = pickHighestSeverity([states.bp, states.hr, states.spo2]);
  const stAbdomen = pickHighestSeverity([states.glucose, states.temp, states.radiation]);

  const zoneMap = {
    head: {
      title: "Head · Sleep, Mood & Reflexes",
      text: `Sleep ${m.sleep.toFixed(1)} h · Mood ${m.moodPct}% (${m.moodScore.toFixed(1)}/10) · PVT ${Math.round(m.pvt)} ms`,
    },
    thorax: {
      title: "Thorax · BP, Heart Rate & SpO₂",
      text: `BP ${Math.round(m.bpSys)}/${Math.round(m.bpDia)} mmHg · HR ${Math.round(m.hr)} bpm · SpO₂ ${m.spo2.toFixed(1)}% · ECG ${m.ecg.toFixed(2)}`,
    },
    abdomen: {
      title: "Abdomen · Metabolism, Temp & Radiation",
      text: `Glucose ${Math.round(m.glucose)} mg/dL · Skin ${m.temp.toFixed(1)} °C / Est. Core ${m.tempCentral.toFixed(2)} °C · Rad ${m.radiationTotal.toFixed(1)} mSv (${m.radiation.toFixed(2)}/d)`,
    },
  };

  const arrowColor = (st) => {
    if (st.severity >= 3) return "#EF4444";
    if (st.severity === 2) return "#EAB308";
    if (st.key === "stale") return "#06B6D4";
    if (st.severity === 1) return "#2563EB";
    return "#10B981";
  };

  return (
    <section className="screen-section">
      {/* Cabecera limpia AHBM + Controles NASA */}
      <header className="screen-header">
        <div>
          <h1 className="screen-title">Health Summary</h1>
          <p className="screen-subtitle">
            Mars Transit · Day {data.mission_day}
          </p>
        </div>

        <div className="header-controls">
          {/* Crew Selector */}
          <div className="astro-select-wrap">
            <span className="astro-dot" style={{ backgroundColor: overallState.hex }} />
            <select
              aria-label="Select crew member"
              className="astro-select"
              value={data.active_crew_id}
              onChange={(e) => {
                setSelectedZone(null);
                onSelectCrew(e.target.value);
              }}
            >
              {roster.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <svg className="astro-chevron" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* Pill de estado global NASA */}
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

          <button
            type="button"
            className="pill-btn dark"
            onClick={onOpenAssistant}
            title="Open Autonomous Clinical Assistant"
          >
            💬 AI Assistant
          </button>

          <button
            type="button"
            className={`pill-btn ${audioEnabled ? "blue" : ""}`}
            onClick={onToggleAudio}
            title="Dual-coded audio with -10 dB pre-alert"
          >
            {audioEnabled ? "🔊 Audio ON" : "🔇 Audio OFF"}
          </button>

          {overallState.severity > 0 && (
            <button
              type="button"
              className="pill-btn"
              onClick={() => onAlarmAction("silence")}
              title="Single-action global audible silence"
            >
              {ui.alarma_silenciada ? "🔔 Unmute" : "🔕 Silence"}
            </button>
          )}

          <button
            type="button"
            onClick={() => onToggleEmergency(!ui.emergencia_manual)}
            title="Independent emergency trigger V2 10178"
            className={`sos-btn ${ui.emergencia_manual ? "active-clear" : ""} ${
              ui.emergencia_manual && !ui.parpadeo_detenido ? "nasa-emergency-blink" : ""
            }`}
          >
            <span>{ui.emergencia_manual ? "✓" : "⚡"}</span>
            <span>{ui.emergencia_manual ? "Clear SOS" : "Thoracic SOS"}</span>
          </button>
        </div>
      </header>

      {/* Dos Zonas Principales: Izq 38% (Cuerpo) + Der 62% (Mensajes/Protocolos + 4 Valores) */}
      <div className="summary-split">
        {/* ZONA IZQUIERDA (38%): FIGURA HUMANA HOLOGRÁFICA */}
        <div className="human-stage summary-left-stage">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
            <span style={{ fontSize: "14px", fontWeight: 800, color: "#FFFFFF" }}>{activeCrew.name}</span>
            <span
              className="mono"
              style={{
                padding: "2px 10px",
                borderRadius: "8px",
                background: "#1E293B",
                border: "1px solid #334155",
                fontSize: "11px",
                fontWeight: 700,
                color: "#7DD3FC",
              }}
            >
              {activeCrew.blood}
            </span>
          </div>

          <div className="body-frame">
            {!imgFailed ? (
              <img
                src="./Cuerpo%20Humano.png"
                alt="Figura anatómica humana holográfica"
                style={{ width: "100%", height: "100%", objectFit: "contain", userSelect: "none" }}
                onError={() => setImgFailed(true)}
              />
            ) : (
              <svg style={{ width: "100%", height: "100%", padding: "16px" }} viewBox="0 0 240 360" fill="none">
                <defs>
                  <radialGradient id="holoBodyGrad" cx="50%" cy="42%" r="58%">
                    <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.72" />
                    <stop offset="65%" stopColor="#0284C7" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="#091122" stopOpacity="0.05" />
                  </radialGradient>
                </defs>
                <g stroke="#38BDF8" strokeWidth="1.5" fill="url(#holoBodyGrad)">
                  <ellipse cx="120" cy="36" rx="18" ry="22" />
                  <path d="M111 57 L129 57 L133 70 L107 70 Z" />
                  <path d="M82 75 C96 67, 144 67, 158 75 L168 112 L154 184 L86 184 L72 112 Z" />
                  <path d="M80 78 L54 140 L44 190 L56 193 L68 146 L84 102 Z" />
                  <path d="M160 78 L186 140 L196 190 L184 193 L172 146 L156 102 Z" />
                  <path d="M88 184 L117 184 L113 336 L92 336 Z" />
                  <path d="M123 184 L152 184 L148 336 L127 336 Z" />
                </g>
              </svg>
            )}

            {/* 3 Interactive Points: Head, Thorax, Abdomen */}
            {[
              { id: "head", top: "10%", st: stHead, label: "Head Zone" },
              { id: "thorax", top: "24%", st: stThorax, label: "Thorax Zone" },
              { id: "abdomen", top: "36%", st: stAbdomen, label: "Abdomen Zone" },
            ].map((hs) => (
              <button
                key={hs.id}
                type="button"
                aria-label={hs.label}
                className="hotspot-btn"
                style={{ top: hs.top, left: "50%" }}
                onClick={() => setSelectedZone(hs.id)}
              >
                <span
                  className="hotspot-halo"
                  style={{ borderColor: hs.st.hex, backgroundColor: `${hs.st.hex}33` }}
                />
                <span className="hotspot-core" style={{ backgroundColor: hs.st.hex }} />
              </button>
            ))}

            {selectedZone && zoneMap[selectedZone] && (
              <div className="zone-tooltip">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 800, color: "#7DD3FC" }}>
                    {zoneMap[selectedZone].title}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedZone(null)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#94A3B8",
                      fontSize: "12px",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>
                <p className="mono" style={{ fontSize: "11px", color: "#E2E8F0", margin: "5px 0 0" }}>
                  {zoneMap[selectedZone].text}
                </p>
              </div>
            )}
          </div>

          <div className="zone-pills-grid">
            {[
              { id: "head", name: "Head", st: stHead },
              { id: "thorax", name: "Thorax", st: stThorax },
              { id: "abdomen", name: "Abdomen", st: stAbdomen },
            ].map((z) => (
              <button
                key={z.id}
                type="button"
                className="zone-pill-btn"
                onClick={() => setSelectedZone(z.id)}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "999px",
                    backgroundColor: z.st.hex,
                  }}
                />
                <span>{z.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ZONA DERECHA (62%): SISTEMA DE MENSAJES Y ADVERTENCIAS + 4 VALORES PRINCIPALES */}
        <div className="summary-right-col">
          {/* RECUADRO REEMPLAZADO: SISTEMA DE MENSAJES, ADVERTENCIAS Y RECOMENDACIONES (protocolos_medicos_nasa.md) */}
          <div
            className={`message-console-box ${primaryBanner.overallState.blink ? "nasa-emergency-blink" : ""}`}
            style={
              primaryBanner.overallState.blink
                ? undefined
                : {
                    backgroundColor: primaryBanner.overallState.cardBg,
                    borderColor: primaryBanner.overallState.cardBorder,
                    color: "#0F172A",
                  }
            }
          >
            {/* Cabecera identificable: Nivel NASA + Código PROTO + Alcance V2 10171 + Acciones rápidas */}
            <div className="message-console-header">
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>
                <span
                  className="mono"
                  style={{
                    padding: "3px 9px",
                    borderRadius: "8px",
                    fontSize: "10.5px",
                    fontWeight: 800,
                    backgroundColor: primaryBanner.overallState.badgeBg,
                    color: primaryBanner.overallState.badgeText,
                    border: "1px solid rgba(255,255,255,0.25)",
                  }}
                >
                  {primaryBanner.overallState.label}
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: "10.5px",
                    fontWeight: 700,
                    opacity: 0.85,
                  }}
                >
                  {activeCount > 0 ? `${activeCount} active alert${activeCount > 1 ? "s" : ""}` : "No active alerts"}
                </span>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>
                {primaryBanner.overallState.severity > 0 && !ui.alerta_reconocida && (
                  <button
                    type="button"
                    className="pill-btn sm"
                    onClick={() => onAlarmAction("ack")}
                  >
                    ✓ Acknowledge
                  </button>
                )}
                {ui.datos_manuales_obsoletos && (
                  <button
                    type="button"
                    className="pill-btn sm"
                    style={{ background: "#0891B2", borderColor: "#0891B2", color: "#FFFFFF" }}
                    onClick={onClearStale}
                  >
                    ⏱ Confirm Stale Data
                  </button>
                )}
                {primaryBanner.actionType && primaryBanner.overallState.severity > 0 && (
                  <button
                    type="button"
                    className="pill-btn sm dark"
                    onClick={() => onIntervention(primaryBanner.actionType, primaryBanner.actionLabel)}
                  >
                    {primaryBanner.actionLabel}
                  </button>
                )}
                <button
                  type="button"
                  className="pill-btn sm"
                  onClick={onGoToParameters}
                  title="View details and protocols"
                >
                  📋 Protocols
                </button>
              </div>
            </div>

            <div className="message-lines">
              <div>{primaryBanner.line1.replace(/^\[(ALERTA|ALERT):[^\]]+\]\s*/i, "")}</div>
              <div>
                <strong>Action:</strong> {primaryBanner.line2}
              </div>
              {(primaryBanner.overallState.severity >= 2 || primaryBanner.exceedsScope) && (
                <div>
                  <strong>Escalation:</strong> {primaryBanner.line3}
                </div>
              )}
            </div>

            {primaryBanner.activeAlerts.length > 0 && (
              <div className="message-chips-row">
                {primaryBanner.activeAlerts.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="alert-ident-chip"
                    style={{
                      backgroundColor: item.state.badgeBg,
                      color: item.state.badgeText,
                    }}
                    onClick={() =>
                      item.metricKey && item.metricKey !== "spo2"
                        ? onFocusMetric(item.metricKey)
                        : onGoToParameters()
                    }
                    title={`${item.protoCode}: ${item.desc}`}
                  >
                    <span>{item.state.label}</span>
                    <span>·</span>
                    <span>{item.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 3 STACKED HORIZONTAL INDICATOR CARDS (EXPANDS ON CAUTION/WARNING/EMERGENCY FOR ANY PARAMETER) */}
          {(() => {
            const allKeys = [...PARAM_ORDER, "pvt"];
            const alteredList = allKeys
              .filter((k) => (states[k]?.severity ?? 0) >= 2)
              .sort((a, b) => states[b].severity - states[a].severity);
            const expandedKey = !showAllThree && alteredList.length > 0 ? alteredList[0] : null;

            if (expandedKey) {
              const meta = METRIC_META[expandedKey];
              const state = states[expandedKey];
              const value = meta.format(m);
              const dir = getTrendArrow(expandedKey, m);
              const rec = getSpecificFirstAidRecommendation(expandedKey, m);

              return (
                <div
                  className="big-metric-box"
                  style={{
                    flex: 1,
                    backgroundColor: state.cardBg,
                    borderColor: state.cardBorder,
                    padding: "20px 22px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "14px",
                    cursor: "default",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span className="metric-icon-box">
                        <MetricIcon metricKey={expandedKey} />
                      </span>
                      <div>
                        <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#0F172A" }}>
                          {meta.fullLabel}
                        </h3>
                        <span style={{ fontSize: "11px", color: "#475569" }}>{meta.source}</span>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        className={state.blink ? "nasa-emergency-blink" : ""}
                        style={{
                          padding: "5px 11px",
                          borderRadius: "10px",
                          fontSize: "11px",
                          fontWeight: 800,
                          backgroundColor: state.badgeBg,
                          color: state.badgeText,
                        }}
                      >
                        {state.label}
                      </span>
                      <button
                        type="button"
                        className="pill-btn sm"
                        onClick={() => setShowAllThree(true)}
                      >
                        Show all 3
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                    <span
                      className="mono"
                      style={{
                        fontSize: "clamp(44px, 4.5vw, 58px)",
                        fontWeight: 800,
                        color: "#0F172A",
                        lineHeight: 1,
                        letterSpacing: "-0.03em",
                      }}
                    >
                      {value}
                    </span>
                    {dir && (
                      <span style={{ fontSize: "22px", fontWeight: 800, color: arrowColor(state) }}>
                        {dir === "up" ? "↑" : "↓"}
                      </span>
                    )}
                    <span style={{ fontSize: "16px", fontWeight: 700, color: "#475569" }}>{meta.unit}</span>
                  </div>

                  <div
                    style={{
                      background: "rgba(255, 255, 255, 0.85)",
                      borderRadius: "14px",
                      padding: "14px 16px",
                      border: "1px solid rgba(15, 23, 42, 0.1)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      fontSize: "13.5px",
                      lineHeight: 1.45,
                      color: "#0F172A",
                    }}
                  >
                    <div>
                      <strong>Possible Symptom:</strong> {rec.symptom}
                    </div>
                    <div>
                      <strong>Microgravity Cause:</strong> {rec.cause}
                    </div>
                    <div>
                      <strong>First-Aid Recommendation:</strong> {rec.recommendation}
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="pill-btn sm dark"
                      onClick={() => onFocusMetric(expandedKey)}
                    >
                      Inspect in Parameters →
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
                {SUMMARY_THREE_METRICS.map((key) => {
                  const meta = METRIC_META[key];
                  const state = states[key];
                  const value = meta.format(m);
                  const dir = getTrendArrow(key, m);

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        if (state.severity > 0) {
                          setShowAllThree(false);
                        } else {
                          onFocusMetric(key);
                        }
                      }}
                      className="big-metric-box"
                      style={{
                        flex: 1,
                        minHeight: "76px",
                        padding: "14px 20px",
                        backgroundColor: state.cardBg,
                        borderColor: state.cardBorder,
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "14px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "16px", minWidth: 0 }}>
                        <span
                          className="metric-icon-box"
                          style={{ width: "54px", height: "54px", borderRadius: "15px", flexShrink: 0 }}
                        >
                          <span style={{ display: "inline-flex", transform: "scale(1.55)" }}>
                            <MetricIcon metricKey={key} />
                          </span>
                        </span>
                        <div style={{ textAlign: "left", minWidth: 0 }}>
                          <h3
                            style={{
                              margin: 0,
                              fontSize: "21px",
                              fontWeight: 800,
                              color: "#0F172A",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {meta.label}
                          </h3>
                          <div style={{ fontSize: "13px", color: "#475569", marginTop: "2px" }}>{meta.source}</div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "18px", flexShrink: 0 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "7px" }}>
                          <span
                            className="mono"
                            style={{
                              fontSize: key === "bp" ? "clamp(38px, 3.8vw, 50px)" : "clamp(46px, 4.5vw, 60px)",
                              fontWeight: 800,
                              color: "#0F172A",
                              lineHeight: 1,
                              letterSpacing: "-0.02em",
                            }}
                          >
                            {value}
                          </span>
                          {dir && state.severity > 0 && (
                            <span style={{ fontSize: "22px", fontWeight: 800, color: arrowColor(state) }}>
                              {dir === "up" ? "↑" : "↓"}
                            </span>
                          )}
                          <span style={{ fontSize: "17px", fontWeight: 700, color: "#475569" }}>{meta.unit}</span>
                        </div>

                        <span
                          className={state.blink ? "nasa-emergency-blink" : ""}
                          style={{
                            padding: "7px 14px",
                            borderRadius: "11px",
                            fontSize: "12.5px",
                            fontWeight: 800,
                            backgroundColor: state.badgeBg,
                            color: state.badgeText,
                          }}
                        >
                          {state.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>
    </section>
  );
}
