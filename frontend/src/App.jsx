import React, { useEffect, useRef, useState } from "react";
import AnatomicalBody from "./components/AnatomicalBody.jsx";
import IndicatorTile, { evalVariableState } from "./components/IndicatorTile.jsx";
import DecisionPanel from "./components/DecisionPanel.jsx";
import TrendsAndAI from "./components/TrendsAndAI.jsx";
import JuryTraceability from "./components/JuryTraceability.jsx";

function playDualAlertTone(nivel) {
  if (nivel === "Nominal" || nivel === "Advisory") return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const map = {
      Emergency: [650, 1500, 0.16, "sine"],
      Warning: [400, 1024, 0.12, "sine"],
      Caution: [512, 512, 0.09, "triangle"],
    };
    const [f1, f2, gain, type] = map[nivel] || map.Caution;

    // Pre-alerta -10 dB (V2 10176)
    const o1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    o1.type = type;
    o1.frequency.setValueAtTime(f1, now);
    g1.gain.setValueAtTime(gain * 0.316, now);
    o1.connect(g1);
    g1.connect(ctx.destination);
    o1.start(now);
    o1.stop(now + 0.13);

    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.type = type;
    o2.frequency.setValueAtTime(f2, now + 0.33);
    g2.gain.setValueAtTime(gain, now + 0.33);
    o2.connect(g2);
    g2.connect(ctx.destination);
    o2.start(now + 0.33);
    o2.stop(now + 0.56);
  } catch {
    // Ignorar si el navegador bloquea audio sin gesto previo
  }
}

function cleanDiag(diag = "") {
  return diag.replace(/^\[ALERTA:[^\]]+\]\s*/, "").trim();
}

export default function App() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("hud");
  const [selectedOrgan, setSelectedOrgan] = useState("cardio");
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [glucInput, setGlucInput] = useState("96");
  const [moodInput, setMoodInput] = useState("8");
  const lastAlertRef = useRef("Nominal");

  async function apiGet(url) {
    const res = await fetch(url);
    const json = await res.json();
    setData(json);
    return json;
  }

  async function apiPost(url, body = {}) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setData(json);
    return json;
  }

  useEffect(() => {
    apiGet("/api/state?tick=0");
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      apiGet("/api/state?tick=1");
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const nivel = data?.resultado?.nivel_nasa;
    const silenced = data?.ui_state?.alarma_silenciada;
    if (audioEnabled && !silenced && nivel && nivel !== "Nominal" && nivel !== lastAlertRef.current) {
      playDualAlertTone(nivel);
    }
    if (nivel) lastAlertRef.current = nivel;
  }, [data, audioEnabled]);

  if (!data) {
    return (
      <div className="cockpit-shell" style={{ justifyContent: "center", alignItems: "center" }}>
        <div className="panel" style={{ padding: "24px", textAlign: "center" }}>
          Conectando con telemetría local MecaSpace...
        </div>
      </div>
    );
  }

  const { lectura, cabin_env, resultado, historico, ui_state, umbrales, nasa_levels } = data;
  const nivel = resultado?.nivel_nasa || "Nominal";
  const nivelMeta = nasa_levels?.[nivel] || nasa_levels?.Nominal;

  const peor = (arr) => {
    if (arr.includes("#ef4444")) return "#ef4444";
    if (arr.includes("#f59e0b")) return "#f59e0b";
    if (arr.includes("#06b6d4")) return "#06b6d4";
    return "#10b981";
  };

  const organColors = {
    cardio: peor([
      evalVariableState("frec_cardiaca", lectura.frec_cardiaca, umbrales).color,
      evalVariableState("presion_sistolica", lectura.presion_sistolica, umbrales).color,
      evalVariableState("anomalia_ecg", lectura.anomalia_ecg, umbrales).color,
      ui_state.emergencia_manual ? "#ef4444" : "#10b981",
    ]),
    resp: peor([
      evalVariableState("spo2", lectura.spo2, umbrales).color,
      evalVariableState("frec_respiratoria", lectura.frec_respiratoria, umbrales).color,
      cabin_env.pi_o2_mmhg < 122 || cabin_env.ppco2_mmhg > 5.3
        ? "#ef4444"
        : cabin_env.pi_o2_mmhg < 145 || cabin_env.ppco2_mmhg > 3.0
        ? "#f59e0b"
        : "#10b981",
    ]),
    metab: evalVariableState("glucemia", lectura.glucemia, umbrales, ui_state.datos_manuales_obsoletos).color,
    term: peor([
      evalVariableState("temp_corporal", lectura.temp_corporal, umbrales).color,
      resultado.temp_central_est < 35.0 ? "#ef4444" : "#10b981",
    ]),
    neuro: peor([
      evalVariableState("horas_sueno", lectura.horas_sueno, umbrales).color,
      evalVariableState("eficiencia_sueno", lectura.eficiencia_sueno, umbrales).color,
      evalVariableState("estado_animo", lectura.estado_animo, umbrales, ui_state.datos_manuales_obsoletos).color,
    ]),
  };

  const histSeries = (key) => historico.map((r) => Number(r[key]));
  const rutinaKeys = [
    ["glucemia", "🩸 Glucemia"],
    ["animo", "🧠 Ánimo"],
    ["sueno", "😴 Sueño 8.5h"],
    ["hidratacion", "💧 Hidratación"],
  ];
  const doneCount = rutinaKeys.filter(([k]) => ui_state.rutina_diaria[k]).length;

  const stripClass =
    nivel === "Emergency"
      ? `status-strip Emergency ${ui_state.parpadeo_detenido ? "steady" : "flashing"}`
      : `status-strip ${nivel}`;

  return (
    <div className="cockpit-shell">
      {/* BARRA SUPERIOR DE COMANDO */}
      <header className="top-bar">
        <div className="brand-block">
          <span className="brand-title">🛰️ MECASPACE</span>
          <span className="mission-pill">TRÁNSITO A MARTE · LATENCIA 20 MIN</span>
        </div>

        <nav className="nav-tabs">
          <button className={`nav-tab ${tab === "hud" ? "active" : ""}`} onClick={() => setTab("hud")}>
            🩺 Triaje y Acción
          </button>
          <button className={`nav-tab ${tab === "trends" ? "active" : ""}`} onClick={() => setTab("trends")}>
            📈 Tendencias e IA
          </button>
          <button className={`nav-tab ${tab === "jury" ? "active" : ""}`} onClick={() => setTab("jury")}>
            📚 Trazabilidad NASA
          </button>
        </nav>

        <div className="top-actions">
          <button className="btn btn-sm" onClick={() => apiPost("/api/control", { action: "toggle_play" })}>
            {ui_state.simulacion_activa ? "⏸ Pausar" : "▶ Reanudar"}
          </button>
          <button
            className={`btn btn-sm ${audioEnabled ? "btn-primary" : ""}`}
            onClick={() => setAudioEnabled(!audioEnabled)}
            title="Audio dual-codificado Tabla 10.3-1"
          >
            {audioEnabled ? "🔊 Audio ON" : "🔇 Audio OFF"}
          </button>
          <button className="btn btn-sm" onClick={() => apiPost("/api/alarm", { action: "silence" })}>
            {ui_state.alarma_silenciada ? "🔔 Reactivar" : "🔕 Silenciar"}
          </button>
          <button className="btn btn-sm" onClick={() => apiPost("/api/alarm", { action: "ack" })}>
            {ui_state.alerta_reconocida ? "✓ Confirmada" : "✓ Confirmar"}
          </button>
          {!ui_state.emergencia_manual ? (
            <button
              className="btn btn-hazard"
              onClick={() => {
                setSelectedOrgan("cardio");
                apiPost("/api/emergency", { active: true });
              }}
            >
              🚨 EMERGENCIA MANUAL
            </button>
          ) : (
            <button className="btn btn-success" onClick={() => apiPost("/api/emergency", { active: false })}>
              ✅ Cerrar Emergencia
            </button>
          )}
        </div>
      </header>

      {/* BANDA DE ESTADO GLOBAL */}
      <div className={stripClass}>
        <div className="status-main">
          <span className="status-badge">{nivelMeta?.label_es || nivel}</span>
          <span className="status-diag">{cleanDiag(resultado.diagnostico)}</span>
        </div>
        <div className="status-meta">
          {ui_state.datos_manuales_obsoletos && <span className="chip chip-cyan">CIAN: DATO VENCIDO</span>}
          {resultado.excede_alcance && <span className="chip chip-magenta">Requiere ECG/Eco + Envío Tierra</span>}
          <span className="chip tabular">{resultado.latencia_ml_ms} ms</span>
          <span className="chip">{resultado.origen_diagnostico}</span>
        </div>
      </div>

      {/* CONTENIDO SEGÚN PESTAÑA */}
      {tab === "hud" && (
        <main className="hud-grid">
          <AnatomicalBody
            colors={organColors}
            selected={selectedOrgan}
            onSelect={setSelectedOrgan}
            lectura={lectura}
            tempCentral={resultado.temp_central_est}
          />

          {/* 6 INDICADORES CENTRALES */}
          <div className="panel">
            <div className="panel-header">
              <span>6 Indicadores Prioritarios</span>
              <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{ui_state.escenario_label}</span>
            </div>

            <div className="kpi-grid">
              <IndicatorTile
                varKey="presion_sistolica"
                label="Presión Arterial"
                value={lectura.presion_sistolica}
                unit="mmHg"
                historyValues={histSeries("presion_sistolica")}
                umbrales={umbrales}
                subText="Astroskin (est.)"
              />
              <IndicatorTile
                varKey="frec_cardiaca"
                label="Frecuencia Cardíaca"
                value={lectura.frec_cardiaca}
                unit="lpm"
                historyValues={histSeries("frec_cardiaca")}
                umbrales={umbrales}
                subText={`ECG ${lectura.anomalia_ecg}`}
              />
              <IndicatorTile
                varKey="glucemia"
                label="Glucemia"
                value={lectura.glucemia}
                unit="mg/dL"
                historyValues={histSeries("glucemia")}
                umbrales={umbrales}
                isStale={ui_state.datos_manuales_obsoletos}
                subText={`Reg: ${ui_state.ultimo_registro_manual_ts}`}
                onQuickEdit={() => {
                  setGlucInput(String(lectura.glucemia));
                  setMoodInput(String(lectura.estado_animo));
                  setShowManualModal(true);
                }}
              />
              <IndicatorTile
                varKey="temp_corporal"
                label="Temp. Corporal (Piel)"
                value={lectura.temp_corporal}
                unit="°C"
                historyValues={histSeries("temp_corporal")}
                umbrales={umbrales}
                subText={`Central est.: ${resultado.temp_central_est} °C${resultado.temp_central_est < 35 ? " (<35°C!)" : ""}`}
              />
              <IndicatorTile
                varKey="horas_sueno"
                label="Horas de Sueño"
                value={lectura.horas_sueno}
                unit="h"
                historyValues={histSeries("horas_sueno")}
                umbrales={umbrales}
                subText={`Meta 8.5 h · Efic. ${lectura.eficiencia_sueno}%`}
              />
              <IndicatorTile
                varKey="estado_animo"
                label="Estado de Ánimo"
                value={lectura.estado_animo}
                unit="/10"
                historyValues={histSeries("estado_animo")}
                umbrales={umbrales}
                isStale={ui_state.datos_manuales_obsoletos}
                subText="Autorreporte"
                onQuickEdit={() => {
                  setGlucInput(String(lectura.glucemia));
                  setMoodInput(String(lectura.estado_animo));
                  setShowManualModal(true);
                }}
              />
            </div>

            <div className="cabin-bar tabular">
              <div className="cabin-mini">
                <span>SpO₂</span>
                <b>{lectura.spo2}%</b>
              </div>
              <div className="cabin-mini">
                <span>P_I O₂</span>
                <b>{cabin_env.pi_o2_mmhg} mmHg</b>
              </div>
              <div className="cabin-mini">
                <span>ppCO₂</span>
                <b>{cabin_env.ppco2_mmhg} mmHg</b>
              </div>
            </div>
          </div>

          <DecisionPanel
            lectura={lectura}
            cabinEnv={cabin_env}
            resultado={resultado}
            uiState={ui_state}
            onIntervention={(tipo, etiqueta) => apiPost("/api/intervention", { tipo, etiqueta })}
            onClearStale={() => apiPost("/api/manual", { glucemia: lectura.glucemia, estado_animo: lectura.estado_animo })}
          />
        </main>
      )}

      {tab === "trends" && <TrendsAndAI state={data} />}
      {tab === "jury" && <JuryTraceability state={data} />}

      {/* DOCK INFERIOR: RUTINA DIARIA + SELECTOR RÁPIDO DE ESCENARIOS DEMO */}
      <footer className="bottom-dock">
        <div className="routine-group">
          <span style={{ fontSize: "0.76rem", fontWeight: 800 }}>
            🎯 Rutina Hoy ({doneCount}/4) · Racha {ui_state.racha_dias}d
          </span>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${(doneCount / 4) * 100}%` }} />
          </div>
          {rutinaKeys.map(([key, lbl]) => (
            <button
              key={key}
              className={`btn btn-sm ${ui_state.rutina_diaria[key] ? "btn-success" : ""}`}
              onClick={() => apiPost("/api/routine", { key })}
            >
              {ui_state.rutina_diaria[key] ? "✅" : "⬜"} {lbl}
            </button>
          ))}
        </div>

        <div className="routine-group">
          <span style={{ fontSize: "0.74rem", color: "#94a3b8", fontWeight: 700 }}>Demo:</span>
          {[
            ["nominal", "🟢 Nominal"],
            ["sueno_glucemia_preventiva", "😴 Sueño+Gluc."],
            ["evento_cardiovascular_agudo", "❤️ Colapso CV"],
            ["hipoxia_critica", "🫁 Hipoxia"],
            ["hipotermia_critica", "❄️ Hipotermia"],
          ].map(([escKey, label]) => (
            <button
              key={escKey}
              className={`btn btn-sm ${ui_state.escenario_actual === escKey ? "btn-primary" : ""}`}
              onClick={() => apiPost("/api/scenario", { escenario: escKey })}
            >
              {label}
            </button>
          ))}
          <button
            className={`btn btn-sm ${ui_state.datos_manuales_obsoletos ? "btn-primary" : ""}`}
            onClick={() => apiPost("/api/manual", { toggle_stale: true })}
          >
            🟦 Dato Cian
          </button>
        </div>
      </footer>

      {/* MODAL REGISTRO MANUAL MULTIMODAL */}
      {showManualModal && (
        <div className="modal-backdrop" onClick={() => setShowManualModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: "1rem" }}>🩸 Registro Manual Multimodal</h3>
            <div className="field-group">
              <label>Glucemia capilar (mg/dL)</label>
              <input
                type="number"
                className="field-input"
                value={glucInput}
                onChange={(e) => setGlucInput(e.target.value)}
                min="35"
                max="350"
              />
            </div>
            <div className="field-group">
              <label>Estado de ánimo (1 = crítico, 10 = óptimo)</label>
              <input
                type="number"
                className="field-input"
                value={moodInput}
                onChange={(e) => setMoodInput(e.target.value)}
                min="1"
                max="10"
                step="0.5"
              />
            </div>
            <div className="btn-row">
              <button className="btn" onClick={() => setShowManualModal(false)}>Cancelar</button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  await apiPost("/api/manual", {
                    glucemia: Number(glucInput),
                    estado_animo: Number(moodInput),
                  });
                  setShowManualModal(false);
                }}
              >
                Guardar Medición
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
