import React from "react";
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
          <h1 className="screen-title">Tripulación a Bordo y Trazabilidad NASA-STD-3001</h1>
          <p className="screen-subtitle">
            Selecciona un tripulante para cargar su telemetría en Resumen · Anclaje normativo Vol. 1 Rev. C / Vol. 2 Rev. E
          </p>
        </div>
        <a
          href="/api/export"
          download="mecaspace_store_and_forward.json"
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

      {/* Rigor científico y matriz normativa (guia-fuentes-anclaje-marte.md) */}
      <div className="white-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>
            Anclaje Normativo y Límites de Rigor Científico (guia-fuentes-anclaje-marte.md)
          </h2>
          <span className="mono" style={{ fontSize: "11px", color: "#475569" }}>
            Latencia ML: {res.latencia_ml_ms ?? 1.5} ms (≤ 1000 ms, Tabla 10.2-1)
          </span>
        </div>

        <div
          style={{
            background: "#FAF7F2",
            border: "1px solid #DFD8CA",
            borderRadius: "14px",
            padding: "12px 14px",
            fontSize: "12px",
            color: "#334155",
            lineHeight: 1.55,
          }}
        >
          <strong>Transparencia normativa (Secc. 6):</strong> <code>ASTROSKIN</code> y <code>ACTIWATCH</code> constituyen la arquitectura instrumental seleccionada por el equipo para cumplir <code>V1 3004.h</code>, <code>V1 6001</code> y <code>V2 9023</code>; no figuran homologados comercialmente en <code>NASA-STD-3001</code>. La norma no fija cifras numéricas universales en reposo para presión arterial, frecuencia cardíaca, glucemia ni ánimo (se evalúa desvío sobre línea base individual pre-misión conforme a <code>V1 3000</code>, <code>V1 4011</code>, <code>V1 4015-4017</code>), mientras que sí establece límites explícitos de hipotermia central (<code>&lt; 35,0 °C</code>, Vol. 1 Apéndice C frente a lectura cutánea <code>V2 11011</code>), sueño (<code>8,5 h</code>, <code>V1 6001</code>), radiación en espacio libre (<code>&lt; 1,3 mSv/d</code>, <code>V1 4033</code>) y cabina (<code>P_I O₂</code> / <code>ppCO₂</code>, <code>V2 6003-6004</code>).
        </div>

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
      </div>

      {/* Bitácora + Referencias OSDR */}
      <div className="two-col-ops">
        <div className="white-panel">
          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800 }}>Bitácora de Decisiones Ejecutadas</h3>
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

        <div className="white-panel">
          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800 }}>Referencias NASA OSDR (Respaldo Offline)</h3>
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
      </div>
    </section>
  );
}
