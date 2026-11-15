import React from "react";
import { handleExportDownload } from "../engine/localApi";

const MATRIX_ROWS = [
  { ind: "1. Presión arterial", src: "Astroskin (est.) / manguito clínico", nasa: "V1 3004.h, Tabla E.2-2, V2 7042" },
  { ind: "2. Frecuencia cardíaca", src: "Astroskin (pulso / ECG)", nasa: "V1 3004.h-i, V2 11011 (>140 bpm en traje)" },
  { ind: "3. Azúcar en sangre (mg/dL)", src: "Glucómetro externo / carga manual", nasa: "Consigna, V1 4020, V2 8055 (glucosa circadiana)" },
  { ind: "4. Temperatura corporal", src: "Astroskin (piel) + central estimada", nasa: "Vol. 1 Ap. C (<35 °C central), V2 6014, V2 11011" },
  { ind: "5. Horas diarias de sueño", src: "Actiwatch Spectrum", nasa: "V1 6001 (8,5 h), V2 6079 (NC-40), V2 6092, V2 8055" },
  { ind: "6. Estado de ánimo", src: "Autorreporte multimodal", nasa: "V1 3004.q, Tabla E.2-2 (*), V2 7071 (privacidad)" },
];

export default function JuryTraceability({ state }) {
  const { ui_state, osdr_ref, resultado } = state;
  const studies = Object.values(osdr_ref?.studies || {});

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div className="panel">
        <div className="panel-header">
          <span>Anclaje Normativo NASA-STD-3001 Vol. 1 Rev. C (2023) y Vol. 2 Rev. E (2025)</span>
          <span className="chip">Tránsito a Marte · Latencia 20 min/sentido</span>
        </div>

        <div style={{ fontSize: "0.80rem", color: "#cbd5e1", background: "#080d1a", padding: "10px 12px", borderRadius: "8px", border: "1px solid #334155" }}>
          <b>Rigor científico y límites normativos:</b> ASTROSKIN y ACTIWATCH representan la arquitectura
          instrumental seleccionada por el equipo para satisfacer <code>V1 3004.h</code>, <code>V1 6001</code> y{" "}
          <code>V2 9023</code>; no figuran homologados comercialmente en <code>NASA-STD-3001</code>. La norma no
          fija rangos numéricos de reposo para PA, FC, glucemia o ánimo (se monitorea desvío sobre línea base
          pre-misión según <code>V1 3000</code>, <code>V1 4011</code>, <code>V1 4015–4017</code>), salvo límites
          explícitos como hipotermia central <code>&lt; 35 °C</code> (Vol. 1 Apéndice C), sueño{" "}
          <code>8,5 h</code> (<code>V1 6001</code>) y atmósfera de cabina (<code>V2 6003–6004</code>).
        </div>

        <table className="jury-table">
          <thead>
            <tr>
              <th>Indicador Central</th>
              <th>Arquitectura Instrumental</th>
              <th>Citas y Requisitos NASA</th>
            </tr>
          </thead>
          <tbody>
            {MATRIX_ROWS.map((r) => (
              <tr key={r.ind}>
                <td><b>{r.ind}</b></td>
                <td>{r.src}</td>
                <td><code>{r.nasa}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div className="panel">
          <div className="panel-header">
            <span>Bitácora de Decisiones Ejecutadas</span>
            <span className="chip">Latencia ML: {resultado?.latencia_ml_ms} ms (≤1000 ms)</span>
          </div>
          {ui_state.bitacora_acciones.length === 0 ? (
            <div style={{ fontSize: "0.80rem", color: "#64748b" }}>
              Sin intervenciones registradas en esta sesión.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "0.78rem" }}>
              {ui_state.bitacora_acciones.map((b, i) => (
                <div key={i} className="log-box">{b}</div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <span>Referencias NASA OSDR y Store-and-Forward</span>
            <span className="chip">V1 6002 · V2 10125</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.78rem" }}>
            {studies.map((s) => (
              <div key={s.study_id} className="log-box">
                <b>{s.study_id}</b>: {s.title}
              </div>
            ))}
          </div>
          <a
            href="/api/export"
            download="mecaspace_store_and_forward.json"
            onClick={handleExportDownload}
            className="btn btn-primary"
            style={{ textDecoration: "none", justifyContent: "center", marginTop: "auto" }}
          >
            📦 Descargar Paquete Store-and-Forward (JSON + SHA-256)
          </a>
        </div>
      </div>
    </div>
  );
}
