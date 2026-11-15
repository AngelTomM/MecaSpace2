import React, { useState } from "react";
import { handleExportDownload } from "../engine/localApi";

export default function DecisionPanel({
  lectura,
  cabinEnv,
  resultado,
  uiState,
  onIntervention,
  onClearStale,
}) {
  const [cvAnswer, setCvAnswer] = useState(null);
  const [showProc, setShowProc] = useState(false);

  if (!resultado) return null;

  const nivel = resultado.nivel_nasa;
  const proto = resultado.protocolo_codigo;
  const top3 = resultado.top3_shap || [];
  const maxAbs = Math.max(...top3.map((t) => Math.abs(t.shap_valor)), 0.1);
  const proc = resultado.procedimiento_electronico;

  return (
    <div className="panel">
      <div className="panel-header">
        <span>Decisión y Acción</span>
        <span className="chip">{proto}</span>
      </div>

      {/* Explicabilidad SHAP Compacta */}
      <div>
        <div style={{ fontSize: "0.74rem", color: "#94a3b8", marginBottom: "5px", fontWeight: 700 }}>
          Factores determinantes (SHAP Top 3):
        </div>
        <div className="shap-list">
          {top3.map((item) => {
            const pct = Math.min(100, Math.round((Math.abs(item.shap_valor) / maxAbs) * 100));
            const barColor = item.shap_valor >= 0 ? "#ef4444" : "#38bdf8";
            return (
              <div key={item.variable} className="shap-row">
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {item.nombre.split("(")[0].trim()}
                </span>
                <div className="shap-bar-bg">
                  <div className="shap-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
                </div>
                <span className="tabular" style={{ textAlign: "right", color: barColor, fontWeight: 700 }}>
                  {item.shap_valor >= 0 ? "+" : ""}
                  {item.shap_valor.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Árbol de decisión interactivo */}
      {nivel === "Nominal" && !uiState.emergencia_manual ? (
        <div className="triage-card" style={{ borderColor: "#065f46" }}>
          <div className="triage-question" style={{ color: "#6ee7b7" }}>
            ✓ Tripulante estable. Sin acciones urgentes.
          </div>
          <button
            className="btn btn-success"
            onClick={() => onIntervention("protocolo_conductual", "Pausa preventiva")}
          >
            🧘 Ejecutar respiración preventiva (4-6)
          </button>
        </div>
      ) : nivel === "Advisory" ? (
        <div className="triage-card" style={{ borderColor: "#1d4ed8" }}>
          <div className="triage-question">
            Medición manual vencida (Cian). Actualiza glucemia y ánimo.
          </div>
          <button className="btn btn-primary" onClick={onClearStale}>
            ✅ Confirmar mediciones al día
          </button>
        </div>
      ) : (
        <div className="triage-card" style={{ borderColor: nivel === "Caution" ? "#f59e0b" : "#ef4444" }}>
          {(proto === "PROTO-CV-01" || uiState.emergencia_manual) && (
            <>
              <div className="triage-question">
                Paso 1: ¿El tripulante responde y respira con normalidad?
              </div>
              <div className="btn-row">
                <button
                  className={`btn ${cvAnswer === "consciente" ? "btn-primary" : ""}`}
                  onClick={() => setCvAnswer("consciente")}
                >
                  ✅ Sí, consciente
                </button>
                <button
                  className={`btn ${cvAnswer === "colapso" ? "btn-danger" : ""}`}
                  onClick={() => setCvAnswer("colapso")}
                >
                  🚨 No / Colapso
                </button>
              </div>
              {cvAnswer === "colapso" ? (
                <button
                  className="btn btn-danger"
                  onClick={() => onIntervention("rcp_dea", "RCP / DEA iniciado")}
                >
                  ⚡ Ejecutar RCP / DEA y Estabilizar
                </button>
              ) : (
                <button
                  className="btn btn-warning"
                  onClick={() => onIntervention("reposo_cv", "Reposo cardiovascular")}
                >
                  🛌 Aplicar Reposo + Hidratación Electrolítica
                </button>
              )}
            </>
          )}

          {proto === "PROTO-RESP-02" && !uiState.emergencia_manual && (
            <>
              <div className="triage-question">
                Cabina O₂ {cabinEnv.pi_o2_mmhg} mmHg · CO₂ {cabinEnv.ppco2_mmhg} mmHg. ¿Aplicar oxígeno?
              </div>
              <button
                className="btn btn-danger"
                onClick={() => onIntervention("oxigeno_100", "O₂ 100% + revisión ECLSS")}
              >
                💨 Suministrar O₂ al 100 % y Revisar ECLSS
              </button>
            </>
          )}

          {proto === "PROTO-MET-03" && !uiState.emergencia_manual && (
            <>
              <div className="triage-question">
                Glucemia {lectura.glucemia} mg/dL · Sueño {lectura.horas_sueno} h. Selecciona acción:
              </div>
              {lectura.glucemia < 70 && (
                <button
                  className="btn btn-warning"
                  onClick={() => onIntervention("glucosa_oral", "Glucosa oral 15-20g")}
                >
                  🍬 Administrar 15–20 g de Glucosa Oral
                </button>
              )}
              <button
                className="btn btn-primary"
                onClick={() => onIntervention("iluminacion_descanso", "Luz circadiana + Sueño")}
              >
                🌙 Activar Luz Circadiana y Bloque de Sueño
              </button>
            </>
          )}

          {proto === "PROTO-TERM-04" && !uiState.emergencia_manual && (
            <>
              <div className="triage-question">
                Temp. central estimada {resultado.temp_central_est} °C (piel {lectura.temp_corporal} °C).
              </div>
              {resultado.temp_central_est < 35.5 ? (
                <button
                  className="btn btn-danger"
                  onClick={() => onIntervention("recalentamiento", "Recalentamiento activo")}
                >
                  🔥 Activar Recalentamiento Progresivo
                </button>
              ) : (
                <button
                  className="btn btn-warning"
                  onClick={() => onIntervention("enfriamiento_lcvg", "Enfriamiento LCVG")}
                >
                  ❄️ Activar Prenda de Enfriamiento (LCVG)
                </button>
              )}
            </>
          )}

          {proto === "PROTO-COND-05" && !uiState.emergencia_manual && (
            <>
              <div className="triage-question">
                Estado afectivo/conductual reducido ({lectura.estado_animo}/10).
              </div>
              <button
                className="btn btn-primary"
                onClick={() => onIntervention("protocolo_conductual", "Protocolo conductual")}
              >
                🧘 Iniciar Protocolo Conductual y Respiración 4-6
              </button>
            </>
          )}

          {/* Segundo escalón: ECG / Eco + Envío a Tierra */}
          <div className="btn-row">
            <button
              className="btn"
              onClick={() => onIntervention("ecg_ecografia_bordo", "ECG/Ecografía a bordo")}
            >
              🫀 Capturar ECG / Eco
            </button>
            <a className="btn" href="/api/export" download="mecaspace_store_and_forward.json" onClick={handleExportDownload} style={{ textDecoration: "none", justifyContent: "center" }}>
              📦 Enviar a Tierra
            </a>
          </div>
        </div>
      )}

      {/* Desplegable compacto de pasos del protocolo (Magenta = sistema) */}
      <div>
        <button className="btn btn-sm" onClick={() => setShowProc(!showProc)} style={{ width: "100%", justifyContent: "space-between" }}>
          <span>📋 Guía paso a paso ({proc?.titulo?.split("/")[0].trim()})</span>
          <span>{showProc ? "▲" : "▼"}</span>
        </button>
        {showProc && proc && (
          <div className="proc-list" style={{ marginTop: "6px" }}>
            {proc.pasos.map((p, idx) => (
              <div key={idx} className={`proc-step ${p.sistema ? "system" : ""}`}>
                <b>{idx + 1}.</b> {p.texto}
              </div>
            ))}
          </div>
        )}
      </div>

      {uiState.bitacora_acciones?.length > 0 && (
        <div className="log-box">
          <b>Última acción:</b> {uiState.bitacora_acciones[0]}
        </div>
      )}
    </div>
  );
}
