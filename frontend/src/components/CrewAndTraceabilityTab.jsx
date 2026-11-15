import React from "react";
import { handleExportDownload } from "../engine/localApi";
import { NASA_LEVELS, evaluateIndicator, mapBackendLevelToKey, pickHighestSeverity } from "../data/nasaProtocols";

const TRACEABILITY_ROWS = [
  { ind: "1. Presión arterial", src: "Astroskin (est.) / manguito clínico", nasa: "V1 3004.h, Tabla E.2-2, V2 7042" },
  { ind: "2. Frecuencia cardíaca", src: "Astroskin (pulso / ECG)", nasa: "V1 3004.h-i, V2 11011 (>140 bpm deterioro traje)" },
  { ind: "3. Azúcar en sangre (mg/dL)", src: "Glucómetro externo / carga manual", nasa: "Consigna, V1 4020, V2 8055 (glucosa circadiana)" },
  { ind: "4. Temperatura corporal", src: "Astroskin (piel) + central estimada", nasa: "Vol. 1 Ap. C (<35 °C central), V2 6014, V2 11011" },
  { ind: "5. Horas diarias de sueño", src: "Actiwatch Spectrum", nasa: "V1 6001 (8,5 h), V2 6079 (NC-40), V2 6092, V2 8055" },
  { ind: "6. Estado de ánimo", src: "Autorreporte multimodal / PANAS", nasa: "V1 3004.q, Tabla E.2-2 (*), V2 7071 (privacidad)" },
  { ind: "7. Radiación ionizante", src: "Dosimetría de tránsito espacio libre", nasa: "V1 4033 (<1,3 mSv/d), V1 4031 (<250 mSv), V2 6164" },
];

function CrewAvatar({ crew, ringColor }) {
  return (
    <svg style={{ width: "100%", height: "100%" }} viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="32" fill={ringColor} fillOpacity="0.2" />
      <path d="M12 60 C14 47, 22 43, 32 43 C42 43, 50 47, 52 60 Z" fill="#F8FAFC" />
      <rect x="27" y="35" width="10" height="9" rx="4" fill={crew.skin} />
      <path d="M22 25 C22 15, 42 15, 42 25 L42 32 C42 39, 22 39, 22 32 Z" fill={crew.skin} />
      <path d="M21 25 C21 13, 43 13, 43 25 C40 18, 24 18, 21 25 Z" fill={crew.hair} />
      <circle cx="28" cy="27" r="1.4" fill="#0F172A" />
      <circle cx="36" cy="27" r="1.4" fill="#0F172A" />
      <path d="M29 33 Q32 35.5 35 33" stroke="#0F172A" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export default function CrewAndTraceabilityTab({ data, onSelectCrewFromCard }) {
  const roster = data.crew_roster || [];
  const ui = data.ui_state || {};
  const res = data.resultado || {};
  const studies = Object.values(data.osdr_ref?.studies || {});

  return (
    <section className="screen-section">
      <header className="screen-header screen-header-bordered">
        <div>
          <h1 className="screen-title">Tripulación</h1>
          <p className="screen-subtitle">
            Selecciona un tripulante para ver su estado
          </p>
        </div>
        <a
          href="/api/export"
          download="mecaspace_store_and_forward.json"
          onClick={handleExportDownload}
          className="pill-btn dark"
        >
          📦 Descargar Store-and-Forward (JSON + SHA-256)
        </a>
      </header>

      {/* Tarjetas de los 3 astronautas */}
      <div className="crew-grid">
        {roster.map((crew) => {
          const isCurrent = crew.id === data.active_crew_id;
          const lec = crew.lectura || {};
          const m = {
            bpSys: Number(lec.presion_sistolica ?? 118),
            bpDia: Number(crew.bp_diastolic ?? 76),
            hr: Number(lec.frec_cardiaca ?? 68),
            glucose: Number(lec.glucemia ?? 88),
            temp: Number(lec.temp_corporal ?? 36.2),
            tempCentral: Number(crew.temp_central_est ?? 36.8),
            sleep: Number(lec.horas_sueno ?? 8.2),
            moodScore: Number(lec.estado_animo ?? 8.2),
            moodPct: Math.round((Number(lec.estado_animo ?? 8.2) / 10) * 100),
            radiation: Number(crew.radiation_rate ?? 0.84),
            radiationTotal: Number(crew.radiation_total ?? 156.2),
            pvt: Number(crew.pvt_ms ?? 238),
            ecg: Number(lec.anomalia_ecg ?? 0.04),
          };

          const opts = {
            emergencyManual: Boolean(crew.emergencia_manual),
            staleManual: Boolean(crew.datos_manuales_obsoletos),
          };
          const localOverall = pickHighestSeverity([
            evaluateIndicator("bp", m, opts),
            evaluateIndicator("hr", m, opts),
            evaluateIndicator("glucose", m, opts),
            evaluateIndicator("temp", m, opts),
            evaluateIndicator("sleep", m, opts),
            evaluateIndicator("mood", m, opts),
            evaluateIndicator("radiation", m, opts),
            evaluateIndicator("pvt", m, opts),
          ]);
          const backendKey = mapBackendLevelToKey(crew.nivel_nasa, Boolean(crew.datos_manuales_obsoletos));
          const backendSt = NASA_LEVELS[backendKey];
          const overall = backendSt.severity >= localOverall.severity ? backendSt : localOverall;

          return (
            <div
              key={crew.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectCrewFromCard(crew.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelectCrewFromCard(crew.id);
              }}
              className={`crew-card ${isCurrent ? "active" : "inactive"}`}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "999px",
                    padding: "2px",
                    backgroundColor: overall.hex,
                    flexShrink: 0,
                  }}
                >
                  <div style={{ width: "100%", height: "100%", borderRadius: "999px", background: "#0F172A", overflow: "hidden" }}>
                    <CrewAvatar crew={crew} ringColor={overall.hex} />
                  </div>
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "8px",
                        fontSize: "10px",
                        fontWeight: 800,
                        backgroundColor: overall.badgeBg,
                        color: overall.badgeText,
                      }}
                    >
                      {overall.label}
                    </span>
                    {isCurrent && (
                      <span className="mono" style={{ fontSize: "11px", fontWeight: 800, color: "#34D399" }}>
                        ACTIVO
                      </span>
                    )}
                  </div>
                  <h2 style={{ margin: "5px 0 2px", fontSize: "17px", fontWeight: 800 }}>{crew.name}</h2>
                  <p style={{ margin: 0, fontSize: "12px", color: isCurrent ? "#CBD5E1" : "#475569" }}>{crew.role}</p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", textAlign: "center" }}>
                {[
                  ["Altura", crew.height],
                  ["Peso", crew.weight],
                  ["IMC", crew.bmi],
                  ["Grupo", crew.blood],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      background: isCurrent ? "#1E293B" : "#FAF7F2",
                      borderRadius: "12px",
                      padding: "8px 4px",
                    }}
                  >
                    <div style={{ fontSize: "10px", opacity: 0.75, fontWeight: 700 }}>{k}</div>
                    <div className="mono" style={{ fontSize: "12px", fontWeight: 800, marginTop: "2px" }}>
                      {v}
                    </div>
                  </div>
                ))}
              </div>

              <div
                className="mono"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "6px",
                  fontSize: "11.5px",
                  paddingTop: "10px",
                  borderTop: `1px solid ${isCurrent ? "#1E293B" : "#E5DFD3"}`,
                }}
              >
                <div>PA: <strong>{Math.round(m.bpSys)}/{Math.round(m.bpDia)}</strong></div>
                <div>FC: <strong>{Math.round(m.hr)} bpm</strong></div>
                <div>Azúcar: <strong>{Math.round(m.glucose)} mg/dL</strong></div>
                <div>Piel/Cent: <strong>{m.temp.toFixed(1)}/{m.tempCentral.toFixed(1)}°C</strong></div>
                <div>Sueño: <strong>{m.sleep.toFixed(1)} h</strong></div>
                <div>Ánimo: <strong>{m.moodPct} %</strong></div>
                <div>Rad: <strong>{m.radiationTotal.toFixed(1)} mSv</strong></div>
                <div>PVT: <strong>{Math.round(m.pvt)} ms</strong></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trazabilidad normativa desplegable para mantener la vista limpia */}
      <details className="white-panel" style={{ cursor: "pointer" }}>
        <summary style={{ fontSize: "14px", fontWeight: 800, listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Trazabilidad Normativa NASA-STD-3001 y Referencias OSDR</span>
          <span className="mono" style={{ fontSize: "11px", color: "#64748B" }}>
            Latencia ML: {res.latencia_ml_ms ?? 1.5} ms · Ver detalles ▾
          </span>
        </summary>

        <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "12px", cursor: "default" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="nasa-table">
              <thead>
                <tr>
                  <th>Indicador Central</th>
                  <th>Arquitectura Instrumental</th>
                  <th>Citas y Requisitos NASA-STD-3001</th>
                </tr>
              </thead>
              <tbody>
                {TRACEABILITY_ROWS.map((r) => (
                  <tr key={r.ind}>
                    <td><strong>{r.ind}</strong></td>
                    <td>{r.src}</td>
                    <td><code>{r.nasa}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {studies.map((s) => (
              <div
                key={s.study_id}
                style={{
                  fontSize: "12px",
                  padding: "8px 10px",
                  borderRadius: "10px",
                  background: "#FAF7F2",
                  border: "1px solid #E5DFD3",
                }}
              >
                <strong>{s.study_id}:</strong> {s.title}
              </div>
            ))}
          </div>
        </div>
      </details>

      {/* Bitácora */}
      <div className="white-panel">
        <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800 }}>Bitácora de Decisiones</h3>
        {!ui.bitacora_acciones || ui.bitacora_acciones.length === 0 ? (
          <p style={{ margin: 0, fontSize: "12px", color: "#64748B" }}>
            Sin intervenciones registradas en esta sesión.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {ui.bitacora_acciones.map((b, i) => (
              <div
                key={i}
                className="mono"
                style={{
                  fontSize: "11.5px",
                  padding: "7px 10px",
                  borderRadius: "10px",
                  background: "#FAF7F2",
                  border: "1px solid #E5DFD3",
                }}
              >
                {b}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
