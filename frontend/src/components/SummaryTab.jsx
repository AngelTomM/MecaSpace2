import React, { useState } from "react";
import {
  METRIC_META,
  PRIMARY_METRICS,
  extractUiMetrics,
  getQuickMetricPlan,
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
}) {
  const [selectedZone, setSelectedZone] = useState(null);
  const [imgFailed, setImgFailed] = useState(false);

  const m = extractUiMetrics(data);
  const ui = data.ui_state || {};
  const cabin = data.cabin_env || {};
  const res = data.resultado || {};
  const roster = data.crew_roster || [];
  const activeCrew = roster.find((c) => c.id === data.active_crew_id) || {
    id: "koch",
    name: "Esp. Christina Koch",
    blood: "O+",
  };

  const { states, primaryBanner, overallState, activeCount } = alertSystem;
  const plan = getQuickMetricPlan(m, states);

  // Estado por zona anatómica
  const stHead = pickHighestSeverity([states.sleep, states.mood, states.pvt]);
  const stThorax = pickHighestSeverity([states.bp, states.hr]);
  const stAbdomen = pickHighestSeverity([states.glucose, states.temp, states.radiation]);

  const zoneMap = {
    head: {
      title: "Cabeza · Sueño, Ánimo y Reflejos",
      text: `Sueño ${m.sleep.toFixed(1)} h · Ánimo ${m.moodPct}% (${m.moodScore.toFixed(1)}/10) · PVT ${Math.round(m.pvt)} ms`,
    },
    thorax: {
      title: "Tórax · Presión, Pulso y Oxigenación",
      text: `PA ${Math.round(m.bpSys)}/${Math.round(m.bpDia)} mmHg · FC ${Math.round(m.hr)} bpm · SpO₂ ${m.spo2.toFixed(1)}% · ECG ${m.ecg.toFixed(2)}`,
    },
    abdomen: {
      title: "Abdomen · Metabolismo, Temp y Radiación",
      text: `Glucemia ${Math.round(m.glucose)} mg/dL · Piel ${m.temp.toFixed(1)} °C / Central est. ${m.tempCentral.toFixed(2)} °C · Rad ${m.radiationTotal.toFixed(1)} mSv (${m.radiation.toFixed(2)}/d)`,
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
          <h1 className="screen-title">Resumen de Salud</h1>
          <p className="screen-subtitle">
            Tránsito a Marte · &gt;30/60 días · Latencia 20 min/sentido · Codificación NASA-STD-3001 (Día {data.mission_day})
          </p>
        </div>

        <div className="header-controls">
          {/* Selector de Astronauta */}
          <div className="astro-select-wrap">
            <span className="astro-dot" style={{ backgroundColor: overallState.hex }} />
            <select
              aria-label="Seleccionar astronauta"
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

          {/* Audio dual-codificado (Tabla 10.3-1 / V2 10176) */}
          <button
            type="button"
            className={`pill-btn ${audioEnabled ? "blue" : ""}`}
            onClick={onToggleAudio}
            title="Audio dual-codificado con pre-alerta -10 dB (V2 10176)"
          >
            {audioEnabled ? "🔊 Audio ON" : "🔇 Audio OFF"}
          </button>

          {/* Silenciamiento global en 1 acción (V2 10116, F.6.4.k) */}
          {overallState.severity > 0 && (
            <button
              type="button"
              className="pill-btn"
              onClick={() => onAlarmAction("silence")}
              title="Silenciamiento audible global en una acción (V2 10116)"
            >
              {ui.alarma_silenciada ? "🔔 Reactivar" : "🔕 Silenciar"}
            </button>
          )}

          {/* Botón independiente SOS Torácico (V2 10178 + borde hazard V2 10080) */}
          <button
            type="button"
            onClick={() => onToggleEmergency(!ui.emergencia_manual)}
            title="Disparador de emergencia independiente V2 10178"
            className={`sos-btn ${ui.emergencia_manual ? "active-clear" : ""} ${
              ui.emergencia_manual && !ui.parpadeo_detenido ? "nasa-emergency-blink" : ""
            }`}
          >
            <span>{ui.emergencia_manual ? "✓" : "⚡"}</span>
            <span>{ui.emergencia_manual ? "Cerrar SOS" : "SOS Torácico"}</span>
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
                src="/Cuerpo%20Humano.png"
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

            {/* 3 Puntos Interactivos: Cabeza, Tórax, Abdomen */}
            {[
              { id: "head", top: "10%", st: stHead, label: "Zona Cabeza" },
              { id: "thorax", top: "24%", st: stThorax, label: "Zona Tórax" },
              { id: "abdomen", top: "36%", st: stAbdomen, label: "Zona Abdomen" },
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
              { id: "head", name: "Cabeza", st: stHead },
              { id: "thorax", name: "Tórax", st: stThorax },
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
                    padding: "3px 9px",
                    borderRadius: "8px",
                    fontSize: "10.5px",
                    fontWeight: 800,
                    backgroundColor: "#0F172A",
                    color: "#FFFFFF",
                  }}
                >
                  {primaryBanner.protoCode}
                </span>
                {primaryBanner.exceedsScope && (
                  <span
                    className="mono"
                    style={{
                      padding: "3px 9px",
                      borderRadius: "8px",
                      fontSize: "10.5px",
                      fontWeight: 800,
                      backgroundColor: "#A21CAF",
                      color: "#FFFFFF",
                    }}
                  >
                    EXCEDE ALCANCE · V2 10171
                  </span>
                )}
                <span
                  className="mono"
                  style={{
                    fontSize: "10.5px",
                    fontWeight: 700,
                    opacity: 0.85,
                  }}
                >
                  {activeCount > 0 ? `${activeCount} aviso${activeCount > 1 ? "s" : ""} activo${activeCount > 1 ? "s" : ""}` : "Sin alertas activas"}
                </span>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>
                {primaryBanner.overallState.severity > 0 && !ui.alerta_reconocida && (
                  <button
                    type="button"
                    className="pill-btn sm"
                    onClick={() => onAlarmAction("ack")}
                  >
                    ✓ Reconocer
                  </button>
                )}
                {ui.datos_manuales_obsoletos && (
                  <button
                    type="button"
                    className="pill-btn sm"
                    style={{ background: "#0891B2", borderColor: "#0891B2", color: "#FFFFFF" }}
                    onClick={onClearStale}
                  >
                    ⏱ Confirmar Dato Cian
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
                  title="Enlace directo a procedimientos y avisos (Apéndice F.6.4.h)"
                >
                  📋 Guía F.6.4
                </button>
              </div>
            </div>

            {/* 3 Líneas obligatorias del protocolo médico NASA (protocolos_medicos_nasa.md) */}
            <div className="message-lines">
              <div>
                <strong>Identificación / Diagnóstico:</strong> {primaryBanner.line1}
                {primaryBanner.shapSummary && (
                  <span className="mono" style={{ fontSize: "11px", opacity: 0.82 }}>
                    {" "}
                    · SHAP: {primaryBanner.shapSummary}
                  </span>
                )}
              </div>
              <div>
                <strong>Directiva 1 (V2 7045):</strong> {primaryBanner.line2}
              </div>
              <div>
                <strong>Directiva 2 (Escalado / Diferido):</strong> {primaryBanner.line3}
              </div>
            </div>

            {/* Identificación rápida por etiquetas de parámetros alterados */}
            <div className="message-chips-row">
              {primaryBanner.activeAlerts.length > 0 ? (
                primaryBanner.activeAlerts.map((item) => (
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
                ))
              ) : (
                <span className="mono" style={{ fontSize: "11px", fontWeight: 700, color: "#065F46" }}>
                  ✓ Todos los biomarcadores ASTROSKIN/ACTIWATCH y atmósfera de cabina dentro de banda nominal ({primaryBanner.protoRefs}).
                </span>
              )}
            </div>
          </div>

          {/* 4 RECUADROS DINÁMICOS DE VALORES PRINCIPALES */}
          <div className="quick-metrics-grid">
            {plan.slots.map((key, index) => {
              const meta = METRIC_META[key];
              const state = states[key];
              const value = meta.quickFormat ? meta.quickFormat(m) : meta.format(m);
              const unit = meta.quickUnit || meta.unit;
              const replacement = plan.replacements.find((r) => r.index === index);
              const isReplacement = Boolean(replacement) || !PRIMARY_METRICS.includes(key);
              const dir = getTrendArrow(key, m);

              const subParts = [];
              if (key === "radiation") {
                subParts.push(`Tasa ${m.radiation.toFixed(2)} mSv/d`);
                subParts.push(`Día ${data.mission_day}`);
              } else if (key === "temp") {
                subParts.push(`Central est. ${m.tempCentral.toFixed(2)} °C`);
                subParts.push("Piel Astroskin");
              } else if (replacement) {
                subParts.push(`Reemplaza a ${METRIC_META[replacement.from].label}`);
              } else {
                subParts.push("Parámetro principal");
              }

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onFocusMetric(key)}
                  className="big-metric-box"
                  style={{
                    backgroundColor: state.cardBg,
                    borderColor: state.cardBorder,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                      <span className="metric-icon-box">
                        <MetricIcon metricKey={key} />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span
                            className="mono"
                            style={{
                              width: "20px",
                              height: "20px",
                              borderRadius: "999px",
                              background: "#0F172A",
                              color: "#FFFFFF",
                              fontSize: "10px",
                              fontWeight: 800,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {index + 1}
                          </span>
                          <span
                            className="mono"
                            style={{
                              fontSize: "10px",
                              fontWeight: 800,
                              textTransform: "uppercase",
                              letterSpacing: "0.08em",
                              color: "#475569",
                            }}
                          >
                            {isReplacement ? "Alterado" : "Principal"}
                          </span>
                        </div>
                        <h3
                          style={{
                            margin: "3px 0 0",
                            fontSize: "15px",
                            fontWeight: 800,
                            color: "#0F172A",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {meta.label}
                        </h3>
                      </div>
                    </div>

                    <span
                      className={state.blink ? "nasa-emergency-blink" : ""}
                      style={{
                        padding: "4px 9px",
                        borderRadius: "10px",
                        fontSize: "10px",
                        fontWeight: 800,
                        backgroundColor: state.badgeBg,
                        color: state.badgeText,
                        flexShrink: 0,
                      }}
                    >
                      {state.label}
                    </span>
                  </div>

                  <div style={{ marginTop: "14px" }}>
                    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "5px" }}>
                        <span
                          className="mono"
                          style={{
                            fontSize: key === "bp" ? "30px" : "36px",
                            fontWeight: 800,
                            color: "#0F172A",
                            lineHeight: 1,
                          }}
                        >
                          {value}
                        </span>
                        {dir && state.severity > 0 && (
                          <span style={{ fontSize: "15px", fontWeight: 800, color: arrowColor(state) }}>
                            {dir === "up" ? "↑" : "↓"}
                          </span>
                        )}
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#475569" }}>{unit}</span>
                      </div>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Ver →</span>
                    </div>
                    <p
                      className="mono"
                      style={{
                        margin: "7px 0 0",
                        fontSize: "10.5px",
                        color: "#475569",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {subParts.join(" · ")}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Tira compacta de contexto de Cabina (V2 6003-6004) y Telemetría ML */}
          <div className="cabin-context-strip">
            <div className="cabin-chip-card">
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748B" }}>SpO₂</span>
              <strong
                className="mono"
                style={{ fontSize: "13px", color: m.spo2 < 92 ? "#DC2626" : m.spo2 < 96 ? "#B45309" : "#0F172A" }}
              >
                {m.spo2.toFixed(1)} %
              </strong>
            </div>
            <div className="cabin-chip-card">
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748B" }}>P_I O₂ Cabina</span>
              <strong
                className="mono"
                style={{ fontSize: "13px", color: (cabin.pi_o2_mmhg ?? 150) < 127 ? "#DC2626" : "#0F172A" }}
              >
                {Number(cabin.pi_o2_mmhg ?? 150).toFixed(1)} mmHg
              </strong>
            </div>
            <div className="cabin-chip-card">
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748B" }}>ppCO₂ Cabina</span>
              <strong
                className="mono"
                style={{ fontSize: "13px", color: (cabin.ppco2_mmhg ?? 1.8) > 3.0 ? "#B45309" : "#0F172A" }}
              >
                {Number(cabin.ppco2_mmhg ?? 1.8).toFixed(2)} mmHg
              </strong>
            </div>
            <div className="cabin-chip-card">
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748B" }}>Temp. Central Est.</span>
              <strong
                className="mono"
                style={{ fontSize: "13px", color: m.tempCentral < 35.0 ? "#DC2626" : "#0F172A" }}
              >
                {m.tempCentral.toFixed(2)} °C
              </strong>
            </div>
            <div className="cabin-chip-card">
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748B" }}>ECG Astroskin</span>
              <strong
                className="mono"
                style={{ fontSize: "13px", color: m.ecg > 0.35 ? "#DC2626" : m.ecg > 0.15 ? "#B45309" : "#0F172A" }}
              >
                {m.ecg.toFixed(2)} idx
              </strong>
            </div>
            <div className="cabin-chip-card">
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748B" }}>Latencia ML</span>
              <strong className="mono" style={{ fontSize: "13px", color: "#065F46" }}>
                {res.latencia_ml_ms ?? 1.5} ms
              </strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
