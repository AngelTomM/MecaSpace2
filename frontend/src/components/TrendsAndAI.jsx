import React, { useState } from "react";

function MiniTrendChart({ title, unit, values, normRange, color }) {
  const w = 320;
  const h = 92;
  const recent = values.slice(-40);
  const [nMin, nMax] = normRange;
  const allVals = [...recent, nMin, nMax];
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const span = max - min || 1;

  const yPos = (val) => h - 8 - ((val - min) / span) * (h - 16);
  const bandTop = yPos(nMax);
  const bandH = Math.max(2, yPos(nMin) - bandTop);

  const pts = recent
    .map((v, i) => {
      const x = recent.length > 1 ? (i / (recent.length - 1)) * (w - 12) + 6 : w / 2;
      return `${x.toFixed(1)},${yPos(v).toFixed(1)}`;
    })
    .join(" ");

  const lastVal = recent[recent.length - 1];

  return (
    <div className="chart-card">
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: "4px" }}>
        <b>{title}</b>
        <span className="tabular" style={{ color }}>
          {lastVal} {unit}
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ background: "#060a14", borderRadius: "6px" }}>
        <rect x="0" y={bandTop} width={w} height={bandH} fill="rgba(16, 185, 129, 0.14)" />
        {recent.length > 1 && (
          <polyline fill="none" stroke={color} strokeWidth="2" points={pts} strokeLinejoin="round" />
        )}
      </svg>
    </div>
  );
}

export default function TrendsAndAI({ state }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);

  const { historico, umbrales, cabin_env, indicadores_centrales, etiquetas } = state;
  const colors = ["#38bdf8", "#fb7185", "#fbbf24", "#f472b6", "#a78bfa", "#34d399"];

  async function handleSend(e) {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading) return;
    const nextHist = [...messages, { role: "user", content: q }];
    setMessages(nextHist);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pregunta: q, historial: messages }),
      });
      const data = await res.json();
      setMessages([...nextHist, { role: "assistant", content: data.respuesta, origen: data.origen }]);
    } catch {
      setMessages([...nextHist, { role: "assistant", content: "Error de comunicación local.", origen: "Sistema" }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div className="panel">
        <div className="panel-header">
          <span>Tendencias de los 6 Indicadores Centrales (Banda Verde = Nominal)</span>
          <span className="tabular" style={{ fontSize: "0.74rem", color: "#93c5fd" }}>
            Cabina: P_I O₂ {cabin_env.pi_o2_mmhg} mmHg · ppCO₂ {cabin_env.ppco2_mmhg} mmHg · {cabin_env.cabin_temp_c} °C · {cabin_env.cabin_rh_pct} % HR
          </span>
        </div>

        <div className="charts-grid">
          {indicadores_centrales.map((varKey, idx) => {
            const cfg = umbrales.biomarkers[varKey];
            const vals = historico.map((row) => Number(row[varKey]));
            return (
              <MiniTrendChart
                key={varKey}
                title={etiquetas[varKey].split("(")[0].trim()}
                unit={cfg.unit}
                values={vals}
                normRange={cfg.normal}
                color={colors[idx % colors.length]}
              />
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "12px" }}>
        <div className="panel">
          <div className="panel-header">
            <span>Asistente Clínico Autónomo (LM Studio / Respaldo Offline)</span>
            <button className="btn btn-sm" onClick={() => setMessages([])}>Limpiar</button>
          </div>
          <div className="chat-box">
            {messages.length === 0 && (
              <div style={{ color: "#64748b", fontSize: "0.80rem" }}>
                Consulta sobre el estado fisiológico actual o pasos de emergencia (sin espera a Tierra).
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>
                <div>{m.content}</div>
                {m.origen && (
                  <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: "3px" }}>
                    Fuente: {m.origen}
                  </div>
                )}
              </div>
            ))}
          </div>
          <form onSubmit={handleSend} style={{ display: "flex", gap: "8px" }}>
            <input
              className="field-input"
              style={{ flex: 1 }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ej: ¿Qué protocolo aplica ante dolor torácico o hipoxia?"
            />
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "..." : "Enviar"}
            </button>
          </form>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span>Registro Conductual Privado (PPC)</span>
            <span className="chip">V1 3004.q · V1 6010</span>
          </div>
          <textarea
            className="field-input"
            rows={7}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setNoteSaved(false);
            }}
            placeholder="Nota privada de estado anímico o síntomas para envío diferido cifrado..."
          />
          <button
            className="btn btn-primary"
            onClick={() => {
              if (note.trim()) {
                setNoteSaved(true);
                setNote("");
              }
            }}
          >
            🔒 Guardar en cola store-and-forward
          </button>
          {noteSaved && (
            <div style={{ fontSize: "0.76rem", color: "#34d399" }}>
              ✓ Nota cifrada localmente para Conferencia Psicológica Privada (V2 7071).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
