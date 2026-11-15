import React, { useEffect, useRef, useState } from "react";
import { buildAlertSystemFeed, extractUiMetrics } from "./data/nasaProtocols";
import { AhbmLogo, TabIcon } from "./components/Icons";
import SummaryTab from "./components/SummaryTab";
import ParametersTab from "./components/ParametersTab";
import TestsAndAITab from "./components/TestsAndAITab";
import CrewAndTraceabilityTab from "./components/CrewAndTraceabilityTab";
import PvtModal from "./components/PvtModal";

function playDualAlertTone(levelKey) {
  if (levelKey === "nominal" || levelKey === "advisory" || levelKey === "stale") return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const map = {
      emergency: [650, 1500, 0.16, "sine"],
      warning: [400, 1024, 0.12, "sine"],
      caution: [512, 512, 0.09, "triangle"],
    };
    const [f1, f2, gain, type] = map[levelKey] || map.caution;

    // Pre-alerta -10 dB (NASA-STD-3001 Vol. 2 Rev. E, V2 10176)
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
    // Ignorar si el navegador bloquea audio sin interacción previa
  }
}

export default function App() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState(1);
  const [focusedMetric, setFocusedMetric] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [pvtOpen, setPvtOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const toastTimerRef = useRef(null);
  const lastAlertLevelRef = useRef("nominal");
  const blinkTimerRef = useRef(null);

  const showToast = (text, color = "#10B981") => {
    setToast({ text, color });
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2600);
  };

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

  const alertSystem = buildAlertSystemFeed(data);
  const overallKey = alertSystem.overallState.key;

  // Audio dual-codificado al escalar severidad (V2 10176)
  useEffect(() => {
    const silenced = data?.ui_state?.alarma_silenciada;
    if (audioEnabled && !silenced && overallKey !== "nominal" && overallKey !== lastAlertLevelRef.current) {
      playDualAlertTone(overallKey);
    }
    lastAlertLevelRef.current = overallKey;
  }, [overallKey, audioEnabled, data?.ui_state?.alarma_silenciada]);

  // Permitir detener parpadeo automáticamente tras 10 s manteniendo rojo sólido (Apéndice F.5.10.g)
  useEffect(() => {
    clearTimeout(blinkTimerRef.current);
    if (overallKey === "emergency" && !data?.ui_state?.parpadeo_detenido) {
      blinkTimerRef.current = setTimeout(() => {
        apiPost("/api/alarm", { action: "stop_flash" });
      }, 10000);
    }
    return () => clearTimeout(blinkTimerRef.current);
  }, [overallKey, data?.ui_state?.parpadeo_detenido]);

  if (!data) {
    return (
      <div className="app-viewport">
        <div className="tablet-shell" style={{ alignItems: "center", justifyContent: "center", minHeight: "420px" }}>
          <div style={{ textAlign: "center", padding: "32px" }}>
            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800 }}>AHBM v2 · MecaSpace</h2>
            <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#475569" }}>
              Conectando con telemetría local y motor XGBoost/SHAP offline...
            </p>
          </div>
        </div>
      </div>
    );
  }

  const m = extractUiMetrics(data);
  const ui = data.ui_state || {};
  const roster = data.crew_roster || [];
  const activeCrew = roster.find((c) => c.id === data.active_crew_id) || { name: "Esp. Christina Koch" };

  const rutinaKeys = [
    ["glucemia", "Glucemia"],
    ["animo", "Ánimo"],
    ["sueno", "Sueño 8,5 h"],
    ["hidratacion", "Hidratación"],
  ];
  const doneRoutine = rutinaKeys.filter(([k]) => ui.rutina_diaria?.[k]).length;

  const handleFocusMetric = (metricKey) => {
    setFocusedMetric(metricKey);
    setTab(2);
  };

  return (
    <div className="app-viewport">
      {toast && (
        <div className="toast-pill">
          <span
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "999px",
              backgroundColor: toast.color,
            }}
          />
          <span>{toast.text}</span>
        </div>
      )}

      {/* CONTENEDOR PRINCIPAL TIPO TABLET AEROESPACIAL AHBM */}
      <div className="tablet-shell">
        {/* Barra lateral izquierda blanca (#FFFFFF) */}
        <aside className="ahbm-sidebar">
          <button
            type="button"
            className="brand-btn"
            title="AHBM — Monitor de Salud Espacial"
            onClick={() => setTab(1)}
          >
            <div className="brand-icon-box">
              <AhbmLogo />
            </div>
            <span className="brand-label">AHBM</span>
          </button>

          <nav className="sidebar-nav" aria-label="Navegación principal">
            {[
              { id: 1, label: "Resumen" },
              { id: 2, label: "Parámetros", dot: alertSystem.activeCount > 0 },
              { id: 3, label: "Tests" },
              { id: 4, label: "Tripulación" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                className={`nav-tab-btn ${tab === item.id ? "active" : ""}`}
                onClick={() => setTab(item.id)}
              >
                {item.dot && <span className="nav-alert-dot" />}
                <TabIcon tab={item.id} />
                <span className="tab-text">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="sidebar-std-ref">
            <span className="mono" style={{ fontSize: "8.5px", fontWeight: 700, color: "#64748B" }}>
              NASA
            </span>
            <span className="mono" style={{ fontSize: "10px", fontWeight: 800, color: "#0F172A" }}>
              3001
            </span>
          </div>
        </aside>

        {/* Área Principal en tono crema cálido (#FAF7F2) */}
        <main className="main-stage">
          {tab === 1 && (
            <SummaryTab
              data={data}
              alertSystem={alertSystem}
              audioEnabled={audioEnabled}
              onToggleAudio={() => setAudioEnabled((v) => !v)}
              onSelectCrew={(cid) => apiPost("/api/crew", { crew_id: cid })}
              onToggleEmergency={(active) => {
                apiPost("/api/emergency", { active });
                showToast(
                  active ? "⚡ EMERGENCIA V2 10178: Evento torácico activo" : "SOS Torácico cerrado",
                  active ? "#DC2626" : "#10B981"
                );
              }}
              onAlarmAction={(action) => apiPost("/api/alarm", { action })}
              onIntervention={(tipo, etiqueta) => {
                apiPost("/api/intervention", { tipo, etiqueta });
                showToast(`Contramedida aplicada: ${etiqueta}`, "#10B981");
              }}
              onClearStale={() => {
                apiPost("/api/manual", {
                  glucemia: m.glucose,
                  estado_animo: m.moodScore,
                });
                showToast("Mediciones manuales validadas (fin estado Cian)", "#10B981");
              }}
              onFocusMetric={handleFocusMetric}
              onGoToParameters={() => setTab(2)}
            />
          )}

          {tab === 2 && (
            <ParametersTab
              data={data}
              alertSystem={alertSystem}
              focusedMetric={focusedMetric}
              onAdjustMetric={(varName, delta) => apiPost("/api/adjust", { var: varName, delta })}
              onAdvanceDay={() => {
                apiPost("/api/adjust", { action: "advance_day" });
                showToast(`Día ${data.mission_day + 1} registrado · dosis acumulada actualizada`, "#2563EB");
              }}
              onToggleInhibit={(key) => apiPost("/api/inhibit", { key })}
              onIntervention={(tipo, etiqueta) => {
                apiPost("/api/intervention", { tipo, etiqueta });
                showToast(`Contramedida ejecutada: ${etiqueta}`, "#10B981");
              }}
              onClearStale={() => {
                apiPost("/api/manual", { glucemia: m.glucose, estado_animo: m.moodScore });
                showToast("Datos manuales actualizados", "#10B981");
              }}
              onOpenPvt={() => setPvtOpen(true)}
              onGoToTests={() => setTab(3)}
              onToggleStaleDemo={() => apiPost("/api/manual", { toggle_stale: true })}
            />
          )}

          {tab === 3 && (
            <TestsAndAITab
              data={data}
              onSaveMoodScore={(score10) => apiPost("/api/manual", { estado_animo: score10 })}
              onOpenPvt={() => setPvtOpen(true)}
              onGoToSummary={() => setTab(1)}
              showToast={showToast}
            />
          )}

          {tab === 4 && (
            <CrewAndTraceabilityTab
              data={data}
              onSelectCrewFromCard={(cid) => {
                apiPost("/api/crew", { crew_id: cid });
                setTab(1);
                const selected = roster.find((c) => c.id === cid);
                showToast(`Astronauta activo: ${selected?.name || cid}`, "#10B981");
              }}
            />
          )}
        </main>
      </div>

      {/* Dock inferior discreto: Simulación, Rutina Diaria y Escenarios Demo */}
      <footer className="bottom-dock">
        <div className="dock-group">
          <button
            type="button"
            className="pill-btn sm"
            onClick={() => apiPost("/api/control", { action: "toggle_play" })}
          >
            {ui.simulacion_activa ? "⏸ Pausar" : "▶ Reanudar"}
          </button>
          <span style={{ fontSize: "11.5px", fontWeight: 800, color: "#0F172A" }}>
            🎯 Rutina ({doneRoutine}/4) · Racha {ui.racha_dias}d:
          </span>
          {rutinaKeys.map(([key, lbl]) => (
            <button
              key={key}
              type="button"
              className={`pill-btn sm ${ui.rutina_diaria?.[key] ? "green" : ""}`}
              onClick={() => apiPost("/api/routine", { key })}
            >
              {ui.rutina_diaria?.[key] ? "✓" : "○"} {lbl}
            </button>
          ))}
        </div>

        <div className="dock-group">
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B" }}>Escenarios:</span>
          {[
            ["nominal", "🟢 Nominal"],
            ["sueno_glucemia_preventiva", "😴 Sueño+Gluc."],
            ["evento_cardiovascular_agudo", "❤️ Colapso CV"],
            ["hipoxia_critica", "🫁 Hipoxia"],
            ["hipotermia_critica", "❄️ Hipotermia"],
            ["estres_termico_critico", "🌡️ Estrés Térm."],
          ].map(([escKey, label]) => (
            <button
              key={escKey}
              type="button"
              className={`pill-btn sm ${ui.escenario_actual === escKey ? "dark" : ""}`}
              onClick={() => apiPost("/api/scenario", { escenario: escKey })}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            className={`pill-btn sm ${ui.datos_manuales_obsoletos ? "blue" : ""}`}
            onClick={() => apiPost("/api/manual", { toggle_stale: true })}
          >
            ⏱ Dato Cian
          </button>
        </div>
      </footer>

      <PvtModal
        open={pvtOpen}
        crewName={activeCrew.name}
        currentPvt={m.pvt}
        onClose={() => setPvtOpen(false)}
        onSavePvt={(avg) => apiPost("/api/adjust", { var: "pvt_ms", value: avg })}
        showToast={showToast}
      />
    </div>
  );
}
