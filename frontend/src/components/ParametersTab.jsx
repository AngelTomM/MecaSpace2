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
  const [selectedSymptom, setSelectedSymptom] = useState("Cefalea");
  const [freeSymptom, setFreeSymptom] = useState("");
  const [completedSteps, setCompletedSteps] = useState({});
  const [cvAnswer, setCvAnswer] = useState(null);

  // Respiración guiada 4-4-6
  const [breathRunning, setBreathRunning] = useState(false);
  const [breathState, setBreathState] = useState({
    label: "Listo",
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
        label: "Listo",
        secs: "4-4-6",
        scale: 0.88,
        bg: "rgba(16, 185, 129, 0.25)",
        border: "#10B981",
      });
      return;
    }

    setBreathRunning(true);
    const cycle = [
      { label: "Inhalar", sec: 4, scale: 1.16, bg: "rgba(16, 185, 129, 0.35)", border: "#10B981" },
      { label: "Sostener", sec: 4, scale: 1.16, bg: "rgba(234, 179, 8, 0.35)", border: "#EAB308" },
      { label: "Exhalar", sec: 6, scale: 0.82, bg: "rgba(37, 99, 235, 0.35)", border: "#60A5FA" },
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
  const activeCrew = roster.find((c) => c.id === data.active_crew_id) || { name: "Esp. Christina Koch" };

  const { items, overallState, states, primaryBanner } = alertSystem;
  const abnormalCount = PARAM_ORDER.filter((k) => states[k].severity > 0).length;

  const filteredItems = items.filter((item) => {
    if (filter === "all") return true;
    if (filter === "protocol") return item.category === "alert";
    return item.category === filter;
  });

  const activeSymptomTitle = freeSymptom.trim() || selectedSymptom;
  const symptomSteps = SYMPTOM_PROTOCOLS[activeSymptomTitle] || [
    { sistema: false, texto: "Detener actividad exigente y adoptar postura neutra en cabina." },
    { sistema: false, texto: "Hidratar con 300 ml de agua y revisar constantes vitales en Resumen." },
    { sistema: true, texto: "[SISTEMA] Registrar síntoma en historia clínica cifrada (V1 3004.a) y ejecutar respiración 4-4-6." },
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
      {/* Cabecera */}
      <header className="screen-header screen-header-bordered">
        <div>
          <h1 className="screen-title">Todos los Parámetros y Protocolos</h1>
          <p className="screen-subtitle">
            Verificación NASA-STD-3001 Vol. 1/2 · <strong>{activeCrew.name}</strong> · Día {data.mission_day}
          </p>
        </div>

        <div className="header-controls">
          <button
            type="button"
            className={`pill-btn sm ${ui.datos_manuales_obsoletos ? "blue" : ""}`}
            onClick={onToggleStaleDemo}
            title="Simular dato manual vencido en color Cian (Tabla F.5-1, V2 10020)"
          >
            {ui.datos_manuales_obsoletos ? "⏱ Dato Cian ON" : "⏱ Simular Dato Cian"}
          </button>
          <span
            className="mono status-pill"
            style={{
              backgroundColor: abnormalCount > 0 ? "#DC2626" : "#0F172A",
              color: "#FFFFFF",
            }}
          >
            {abnormalCount} / 8 alterados
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
                    <div style={{ fontSize: "10px", color: "#475569" }}>{meta.source}</div>
                  </div>
                </div>

                {meta.step != null ? (
                  <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                    <button
                      type="button"
                      className="pill-btn sm"
                      style={{ padding: "3px 9px", fontWeight: 800 }}
                      aria-label={`Disminuir ${meta.fullLabel}`}
                      onClick={() => onAdjustMetric(meta.backendVar, -meta.step)}
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="pill-btn sm"
                      style={{ padding: "3px 9px", fontWeight: 800 }}
                      aria-label={`Aumentar ${meta.fullLabel}`}
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
                    {key === "pvt" ? "Iniciar" : "Test"}
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

              <div className="mono" style={{ fontSize: "10px", color: "#475569", marginTop: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}>
                {key === "temp" && (
                  <span>
                    Central est.: <strong style={{ color: m.tempCentral < 35 ? "#DC2626" : "#0F172A" }}>{m.tempCentral.toFixed(2)} °C</strong> (Vol. 1 Ap. C)
                  </span>
                )}
                {key === "radiation" && (
                  <>
                    <span>{m.radiationTotal.toFixed(1)} mSv acum. · Día {data.mission_day}</span>
                    <button type="button" className="pill-btn sm" style={{ padding: "2px 7px" }} onClick={onAdvanceDay}>
                      + día
                    </button>
                  </>
                )}
                {key === "mood" && <span>Escala {m.moodScore.toFixed(1)} / 10 · Test en pestaña Tests</span>}
                {key === "pvt" && <span>Prueba 5 estímulos (nominal &lt; 265 ms)</span>}
                {key === "glucose" && <span>Reg: {ui.ultimo_registro_manual_ts}</span>}
                {key === "sleep" && <span>Meta V1 6001: 8,5 h · Efic. {Number(lec.eficiencia_sueno ?? 88).toFixed(0)}%</span>}
                {key === "bp" && <span>Tendencia ASTROSKIN (sin umbral fijo 3001)</span>}
                {key === "hr" && <span>ECG {m.ecg.toFixed(2)} · Actividad {Number(lec.nivel_actividad ?? 0.65).toFixed(2)} g</span>}
              </div>
            </article>
          );
        })}
      </div>

      {/* Variables auxiliares de ASTROSKIN/ACTIWATCH y Cabina Presurizada */}
      <div className="aux-cabin-grid">
        <div className="aux-card">
          <div>
            <div style={{ fontSize: "10.5px", fontWeight: 700, color: "#64748B" }}>SpO₂ (Astroskin)</div>
            <strong className="mono" style={{ fontSize: "15px", color: m.spo2 < 92 ? "#DC2626" : "#0F172A" }}>
              {m.spo2.toFixed(1)} %
            </strong>
          </div>
          <span className="mono" style={{ fontSize: "10px", color: "#475569" }}>≥ 96 %</span>
        </div>
        <div className="aux-card">
          <div>
            <div style={{ fontSize: "10.5px", fontWeight: 700, color: "#64748B" }}>Frec. Respiratoria</div>
            <strong className="mono" style={{ fontSize: "15px" }}>
              {Number(lec.frec_respiratoria ?? 15).toFixed(1)} rpm
            </strong>
          </div>
          <span className="mono" style={{ fontSize: "10px", color: "#475569" }}>12–18</span>
        </div>
        <div className="aux-card">
          <div>
            <div style={{ fontSize: "10.5px", fontWeight: 700, color: "#64748B" }}>P_I O₂ Cabina (V2 6003)</div>
            <strong className="mono" style={{ fontSize: "15px", color: (cabin.pi_o2_mmhg ?? 150) < 127 ? "#DC2626" : "#0F172A" }}>
              {Number(cabin.pi_o2_mmhg ?? 150).toFixed(1)} mmHg
            </strong>
          </div>
          <span className="mono" style={{ fontSize: "10px", color: "#475569" }}>145–155</span>
        </div>
        <div className="aux-card">
          <div>
            <div style={{ fontSize: "10.5px", fontWeight: 700, color: "#64748B" }}>ppCO₂ Cabina (V2 6004)</div>
            <strong className="mono" style={{ fontSize: "15px", color: (cabin.ppco2_mmhg ?? 1.8) > 3.0 ? "#B45309" : "#0F172A" }}>
              {Number(cabin.ppco2_mmhg ?? 1.8).toFixed(2)} mmHg
            </strong>
          </div>
          <span className="mono" style={{ fontSize: "10px", color: "#475569" }}>≤ 3,0</span>
        </div>
        <div className="aux-card">
          <div>
            <div style={{ fontSize: "10.5px", fontWeight: 700, color: "#64748B" }}>Confort Cabina (V2 6012)</div>
            <strong className="mono" style={{ fontSize: "14px" }}>
              {Number(cabin.cabin_temp_c ?? 22.4).toFixed(1)} °C · {Number(cabin.cabin_rh_pct ?? 46).toFixed(0)}%
            </strong>
          </div>
          <span className="mono" style={{ fontSize: "10px", color: "#475569" }}>20–25 °C</span>
        </div>
      </div>

      {/* Dos columnas operativas: Avisos + SHAP (izq) y Contramedidas + Síntomas + 4-4-6 (der) */}
      <div className="two-col-ops">
        {/* Columna Izquierda: Avisos + Auditoría Inhibición + SHAP */}
        <div className="white-panel">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>
                Avisos y Diccionario de Protocolos
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#475569" }}>
                Basado en <code>protocolos_medicos_nasa.md</code> · Control V2 10156 (Inhibir/Habilitar)
              </p>
            </div>
            <span
              className="mono"
              style={{
                padding: "3px 10px",
                borderRadius: "8px",
                background: "#0F172A",
                color: "#FFFFFF",
                fontSize: "12px",
                fontWeight: 800,
              }}
            >
              {filteredItems.length}
            </span>
          </div>

          <div className="filter-tabs-bar">
            {[
              ["all", "Todos"],
              ["alert", "Alertas"],
              ["protocol", "Protocolos"],
              ["reminder", "Recordat."],
              ["suggestion", "Sugerenc."],
            ].map(([k, lbl]) => (
              <button
                key={k}
                type="button"
                className={`filter-tab-btn ${filter === k ? "active" : ""}`}
                onClick={() => setFilter(k)}
              >
                {lbl}
              </button>
            ))}
          </div>

          <div className="alerts-scroll">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                style={{
                  border: `2px solid ${item.inhibited ? "#CBD5E1" : item.state.hex}`,
                  backgroundColor: item.inhibited ? "#F8FAFC" : item.state.cardBg,
                  borderRadius: "16px",
                  padding: "12px 14px",
                  opacity: item.inhibited ? 0.65 : 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "8px",
                        fontSize: "10px",
                        fontWeight: 800,
                        backgroundColor: item.state.badgeBg,
                        color: item.state.badgeText,
                      }}
                    >
                      {item.state.label}
                    </span>
                    <span
                      className="mono"
                      style={{
                        padding: "2px 7px",
                        borderRadius: "7px",
                        fontSize: "10px",
                        fontWeight: 800,
                        background: "#0F172A",
                        color: "#FFFFFF",
                      }}
                    >
                      {item.protoCode}
                    </span>
                    {item.exceedsScope && (
                      <span
                        className="mono"
                        style={{
                          padding: "2px 7px",
                          borderRadius: "7px",
                          fontSize: "10px",
                          fontWeight: 800,
                          background: "#A21CAF",
                          color: "#FFFFFF",
                        }}
                      >
                        EXCEDE ALCANCE
                      </span>
                    )}
                  </div>

                  {item.metricKey && (
                    <button
                      type="button"
                      className="pill-btn sm"
                      onClick={() => onToggleInhibit(item.metricKey)}
                    >
                      {item.inhibited ? "Habilitar" : "Inhibir"}
                    </button>
                  )}
                </div>

                <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 800, color: "#0F172A" }}>{item.title}</h3>
                <p style={{ margin: 0, fontSize: "11.5px", color: "#334155" }}>{item.desc}</p>
                <div style={{ fontSize: "11.5px", color: "#0F172A", background: "rgba(255,255,255,0.7)", padding: "6px 9px", borderRadius: "10px" }}>
                  <div><strong>Acción:</strong> {item.recommendation}</div>
                  <div style={{ marginTop: "2px" }}><strong>Seguimiento:</strong> {item.followUp}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Explicabilidad SHAP Top 3 (V2 10169, V2 10170) */}
          <div style={{ borderTop: "1px solid #E5DFD3", paddingTop: "12px" }}>
            <div style={{ fontSize: "12px", fontWeight: 800, color: "#0F172A", marginBottom: "8px" }}>
              Explicabilidad XAI · Factores SHAP Top 3 (V2 10170)
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {top3.map((item) => {
                const pct = Math.min(100, Math.round((Math.abs(item.shap_valor) / maxAbsShap) * 100));
                const barColor = item.shap_valor >= 0 ? "#EF4444" : "#2563EB";
                return (
                  <div key={item.variable} className="shap-row">
                    <span style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.nombre.split("(")[0].trim()}
                    </span>
                    <div className="shap-track">
                      <div className="shap-fill" style={{ width: `${pct}%`, background: barColor }} />
                    </div>
                    <span className="mono" style={{ textAlign: "right", color: barColor, fontWeight: 800 }}>
                      {item.shap_valor >= 0 ? "+" : ""}
                      {item.shap_valor.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Columna Derecha: Triaje / Contramedidas Ejecutables + Síntoma + Guía F.5-2 + 4-4-6 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Panel de Contramedidas Ejecutables */}
          <div className="white-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>
                Triaje y Contramedidas ({activeProto})
              </h2>
              {ui.datos_manuales_obsoletos && (
                <button type="button" className="pill-btn sm blue" onClick={onClearStale}>
                  ✓ Validar Datos Cian
                </button>
              )}
            </div>

            {activeProto === "PROTO-CV-01" || ui.emergencia_manual ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ fontSize: "12.5px", fontWeight: 700 }}>
                  Paso 1: ¿El tripulante responde y respira con normalidad?
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <button
                    type="button"
                    className={`pill-btn ${cvAnswer === "consciente" ? "blue" : ""}`}
                    onClick={() => setCvAnswer("consciente")}
                  >
                    ✅ Sí, consciente
                  </button>
                  <button
                    type="button"
                    className={`pill-btn ${cvAnswer === "colapso" ? "dark" : ""}`}
                    style={cvAnswer === "colapso" ? { background: "#DC2626", borderColor: "#DC2626" } : undefined}
                    onClick={() => setCvAnswer("colapso")}
                  >
                    🚨 No / Colapso
                  </button>
                </div>
                {cvAnswer === "colapso" ? (
                  <button
                    type="button"
                    className="pill-btn"
                    style={{ background: "#DC2626", borderColor: "#DC2626", color: "#FFFFFF", justifyContent: "center" }}
                    onClick={() => onIntervention("rcp_dea", "RCP / DEA ejecutado")}
                  >
                    ⚡ Ejecutar RCP / DEA y Estabilizar (V1 5001-5002)
                  </button>
                ) : (
                  <button
                    type="button"
                    className="pill-btn"
                    style={{ background: "#FEFCE8", borderColor: "#EAB308", color: "#854D0E", justifyContent: "center" }}
                    onClick={() => onIntervention("reposo_cv", "Reposo cardiovascular + hidratación")}
                  >
                    🛌 Reposo Cardiovascular + Hidratación (V2 7042)
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {activeProto === "PROTO-RESP-02" && (
                  <button
                    type="button"
                    className="pill-btn"
                    style={{ background: "#DC2626", borderColor: "#DC2626", color: "#FFFFFF" }}
                    onClick={() => onIntervention("oxigeno_100", "O₂ 100 % + revisión ECLSS")}
                  >
                    💨 Suministrar O₂ 100 % y Revisar ECLSS
                  </button>
                )}
                {activeProto === "PROTO-MET-03" && (
                  <>
                    <button
                      type="button"
                      className="pill-btn"
                      style={{ background: "#FEFCE8", borderColor: "#EAB308", color: "#854D0E" }}
                      onClick={() => onIntervention("glucosa_oral", "Glucosa oral 15-20 g")}
                    >
                      🍬 Glucosa Oral 15–20 g
                    </button>
                    <button
                      type="button"
                      className="pill-btn blue"
                      onClick={() => onIntervention("iluminacion_descanso", "Luz circadiana + Sueño")}
                    >
                      🌙 Luz Circadiana + Sueño 8,5 h
                    </button>
                  </>
                )}
                {activeProto === "PROTO-TERM-04" && (
                  <>
                    <button
                      type="button"
                      className="pill-btn"
                      style={{ background: "#DC2626", borderColor: "#DC2626", color: "#FFFFFF" }}
                      onClick={() => onIntervention("recalentamiento", "Recalentamiento progresivo")}
                    >
                      🔥 Recalentamiento Progresivo
                    </button>
                    <button
                      type="button"
                      className="pill-btn blue"
                      onClick={() => onIntervention("enfriamiento_lcvg", "Enfriamiento LCVG")}
                    >
                      ❄️ Enfriamiento LCVG
                    </button>
                  </>
                )}
                {(activeProto === "PROTO-COND-05" || activeProto === "PROTO-NOM-00") && (
                  <button
                    type="button"
                    className="pill-btn green"
                    onClick={() => onIntervention("protocolo_conductual", "Protocolo conductual 4-4-6")}
                  >
                    🧘 Protocolo Conductual y Respiración
                  </button>
                )}
              </div>
            )}

            {/* Segundo escalón: ECG / Ecografía a bordo + Store-and-Forward */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <button
                type="button"
                className="pill-btn"
                style={{ justifyContent: "center" }}
                onClick={() => onIntervention("ecg_ecografia_bordo", "ECG 3-deriv. / Ecografía a bordo (V1 3004.i)")}
              >
                🫀 Capturar ECG / Eco (V1 3004.i)
              </button>
              <a
                className="pill-btn dark"
                href="/api/export"
                download="mecaspace_store_and_forward.json"
                onClick={handleExportDownload}
                style={{ justifyContent: "center" }}
              >
                📦 Paquete Store-and-Forward
              </a>
            </div>

            {protoProc?.pasos && (
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <div style={{ fontSize: "11px", fontWeight: 800, color: "#475569" }}>
                  Procedimiento Electrónico Activo (Tabla F.5-2 · Magenta = Paso de Sistema):
                </div>
                {protoProc.pasos.map((p, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: "11.5px",
                      padding: "6px 10px",
                      borderRadius: "10px",
                      borderLeft: `4px solid ${p.sistema ? "#D946EF" : "#2563EB"}`,
                      background: p.sistema ? "#FDF4FF" : "#F8FAFC",
                      color: "#0F172A",
                    }}
                  >
                    <strong>{i + 1}.</strong> {p.texto}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Registrar Síntoma + Guía Paso a Paso + Orbe 4-4-6 */}
          <div className="white-panel">
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>Registrar Síntoma</h2>
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
              placeholder="Escribir otro síntoma..."
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
                Guía Paso a Paso · Tabla F.5-2
              </span>
              <span className="mono" style={{ fontSize: "12px", color: "#F0ABFC", fontWeight: 700 }}>
                {doneCount} / {symptomSteps.length}
              </span>
            </div>

            <h3 style={{ margin: 0, fontSize: "15.5px", fontWeight: 800 }}>
              Protocolo: {activeSymptomTitle}
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
                  Autorregulación
                </span>
                <h4 style={{ margin: "2px 0", fontSize: "14px", fontWeight: 800 }}>Respiración Guiada 4-4-6</h4>
                <p style={{ margin: "0 0 8px", fontSize: "11px", color: "#CBD5E1" }}>
                  Inhalar 4s · Sostener 4s · Exhalar 6s
                </p>
                <button
                  type="button"
                  className={`pill-btn sm ${breathRunning ? "dark" : "green"}`}
                  onClick={toggleBreathing}
                >
                  {breathRunning ? "Detener" : "Iniciar 4-4-6"}
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
      </div>
    </section>
  );
}
