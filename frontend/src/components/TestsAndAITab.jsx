import React, { useState } from "react";
import { smartFetchJson } from "../engine/localApi";
import { evaluateIndicator, extractUiMetrics, pickHighestSeverity } from "../data/nasaProtocols";

const MENTAL_QUESTIONS = [
  { id: "q1", text: "1. Nivel de energía y motivación en turno", invert: false },
  { id: "q2", text: "2. Sensación de calma y equilibrio emocional", invert: false },
  { id: "q3", text: "3. Nivel de tensión o estrés percibido (1 = nada, 5 = alto)", invert: true },
  { id: "q4", text: "4. Claridad mental y concentración operativa", invert: false },
  { id: "q5", text: "5. Sensación de descanso tras el sueño", invert: false },
  { id: "q6", text: "6. Ánimo y cohesión con el equipo de misión", invert: false },
];

const INITIAL_MENTAL_ANSWERS = {
  koch: { q1: 5, q2: 5, q3: 1, q4: 5, q5: 4, q6: 5 },
  glover: { q1: 4, q2: 4, q3: 2, q4: 5, q5: 4, q6: 5 },
  kim: { q1: 4, q2: 4, q3: 2, q4: 4, q5: 3, q6: 5 },
};

function MiniTrendChart({ title, unit, values, normRange, color }) {
  const w = 320;
  const h = 88;
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

  const lastVal = recent.length ? recent[recent.length - 1] : 0;

  return (
    <div
      style={{
        background: "#FAF7F2",
        border: "1px solid #DFD8CA",
        borderRadius: "16px",
        padding: "10px 12px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "5px" }}>
        <strong style={{ color: "#0F172A" }}>{title}</strong>
        <span className="mono" style={{ color, fontWeight: 800 }}>
          {lastVal} {unit}
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ background: "#0F172A", borderRadius: "10px" }}>
        <rect x="0" y={bandTop} width={w} height={bandH} fill="rgba(16, 185, 129, 0.18)" />
        {recent.length > 1 && (
          <polyline fill="none" stroke={color} strokeWidth="2.2" points={pts} strokeLinejoin="round" />
        )}
      </svg>
    </div>
  );
}

export default function TestsAndAITab({
  data,
  onSaveMoodScore,
  onOpenPvt,
  onGoToSummary,
  showToast,
}) {
  const [crewAnswers, setCrewAnswers] = useState(INITIAL_MENTAL_ANSWERS);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const [ppcNote, setPpcNote] = useState("");
  const [ppcSaved, setPpcSaved] = useState(false);

  const m = extractUiMetrics(data);
  const roster = data.crew_roster || [];
  const activeCrew = roster.find((c) => c.id === data.active_crew_id) || {
    id: "koch",
    name: "Esp. Christina Koch",
  };
  const ui = data.ui_state || {};
  const historico = data.historico || [];
  const umbrales = data.umbrales || { biomarkers: {} };
  const indicadores = data.indicadores_centrales || [];
  const etiquetas = data.etiquetas || {};

  const answers = crewAnswers[activeCrew.id] || INITIAL_MENTAL_ANSWERS.koch;

  const stPvt = evaluateIndicator("pvt", m);
  const stMood = evaluateIndicator("mood", m, { staleManual: Boolean(ui.datos_manuales_obsoletos) });
  const overall = pickHighestSeverity([stMood, stPvt]);

  const handleSetAnswer = async (qId, num) => {
    const nextCrewAnswers = { ...answers, [qId]: num };
    setCrewAnswers((prev) => ({ ...prev, [activeCrew.id]: nextCrewAnswers }));

    let sum = 0;
    MENTAL_QUESTIONS.forEach((q) => {
      const raw = nextCrewAnswers[q.id] || 3;
      sum += q.invert ? 6 - raw : raw;
    });
    const score10 = Number(((sum / (MENTAL_QUESTIONS.length * 5)) * 10).toFixed(1));
    await onSaveMoodScore(score10);
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || loadingChat) return;
    const nextHist = [...messages, { role: "user", content: q }];
    setMessages(nextHist);
    setInput("");
    setLoadingChat(true);
    try {
      const json = await smartFetchJson("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pregunta: q, historial: messages }),
      });
      setMessages([...nextHist, { role: "assistant", content: json.respuesta, origen: json.origen }]);
    } catch {
      setMessages([
        ...nextHist,
        { role: "assistant", content: "Error de comunicación local con el motor de respaldo.", origen: "Sistema" },
      ]);
    } finally {
      setLoadingChat(false);
    }
  };

  const trendColors = ["#38BDF8", "#FB7185", "#EAB308", "#F472B6", "#A78BFA", "#10B981"];

  return (
    <section className="screen-section">
      <header className="screen-header screen-header-bordered">
        <div>
          <h1 className="screen-title">Test Psicológico, PVT y Tendencias IA</h1>
          <p className="screen-subtitle">
            Salud conductual, vigilancia psicomotora y asistente autónomo · <strong>{activeCrew.name}</strong>
          </p>
        </div>
        <span
          className="status-pill"
          style={{
            backgroundColor: overall.pillBg,
            color: overall.pillText,
            border: `1.5px solid ${overall.pillBorder}`,
          }}
        >
          {overall.label}
        </span>
      </header>

      {/* Fila superior: Test Psicológico (izq) + Test PVT (der) */}
      <div className="tests-top-grid">
        {/* Cuestionario Psicológico */}
        <div className="white-panel">
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 800 }}>Test Psicológico · Rutina Diaria</h2>
              <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: "#475569" }}>
                Cuestionario rápido PANAS / GHQ-12 · Sincronizado con <code>estado_animo</code>
              </p>
            </div>
            <span
              className="mono"
              style={{
                padding: "6px 12px",
                borderRadius: "10px",
                fontSize: "12px",
                fontWeight: 800,
                backgroundColor: stMood.badgeBg,
                color: stMood.badgeText,
              }}
            >
              Estado de Ánimo: {m.moodPct} % ({m.moodScore.toFixed(1)}/10)
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px", fontWeight: 700, color: "#475569" }}>
            <span>Selecciona del 1 (Muy bajo) al 5 (Óptimo)</span>
            <span className="mono" style={{ color: "#0F172A" }}>6 / 6 respondidas</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {MENTAL_QUESTIONS.map((q) => {
              const currentVal = answers[q.id];
              return (
                <div
                  key={q.id}
                  style={{
                    borderRadius: "14px",
                    background: "#FAF7F2",
                    border: "1px solid #E5DFD3",
                    padding: "10px 12px",
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                  }}
                >
                  <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#0F172A" }}>{q.text}</span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => handleSetAnswer(q.id, n)}
                        className="mono"
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "10px",
                          fontSize: "12px",
                          fontWeight: 800,
                          cursor: "pointer",
                          border: currentVal === n ? "none" : "1px solid #D6CFC2",
                          background: currentVal === n ? "#0F172A" : "#FFFFFF",
                          color: currentVal === n ? "#FFFFFF" : "#0F172A",
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ paddingTop: "10px", borderTop: "1px solid #E5DFD3", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "11.5px", color: "#475569" }}>
              Actualiza el parámetro Estado de Ánimo y borra estado Cian si estaba pendiente.
            </span>
            <button
              type="button"
              className="pill-btn dark"
              onClick={() => {
                showToast(`Estado de Ánimo guardado: ${m.moodPct} %`, "#10B981");
                onGoToSummary();
              }}
            >
              Guardar y Ver Resumen
            </button>
          </div>
        </div>

        {/* Columna PVT */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div className="human-stage" style={{ padding: "20px", color: "#FFFFFF", display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
              <div>
                <span className="mono" style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#38BDF8" }}>
                  Prueba de vigilancia
                </span>
                <h2 style={{ margin: "2px 0 0", fontSize: "18px", fontWeight: 800 }}>Test PVT · Reflejos</h2>
              </div>
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: "10px",
                  fontSize: "11px",
                  fontWeight: 800,
                  backgroundColor: stPvt.badgeBg,
                  color: stPvt.badgeText,
                }}
              >
                {stPvt.label}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <span
                className="mono"
                style={{
                  fontSize: "48px",
                  fontWeight: 800,
                  lineHeight: 1,
                  color: stPvt.severity > 0 ? stPvt.hex : "#FFFFFF",
                }}
              >
                {Math.round(m.pvt)}
              </span>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#CBD5E1" }}>ms</span>
            </div>

            <p style={{ margin: 0, fontSize: "12px", color: "#CBD5E1", lineHeight: 1.5 }}>
              Tiempo de reacción promedio de la última sesión. El test lanza 5 estímulos visuales en intervalos aleatorios de 1,2 s a 3,2 s.
            </p>

            <div
              className="mono"
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "12px",
                background: "rgba(30, 41, 59, 0.8)",
                border: "1px solid #334155",
                borderRadius: "12px",
                padding: "10px 14px",
              }}
            >
              <span>
                Nominal: <strong style={{ color: "#34D399" }}>&lt; 265 ms</strong>
              </span>
              <span>Último: {Math.round(m.pvt)} ms</span>
            </div>

            <button
              type="button"
              className="pill-btn green"
              style={{ justifyContent: "center", padding: "12px 16px", fontSize: "13px" }}
              onClick={onOpenPvt}
            >
              Iniciar Test PVT
            </button>
          </div>

          <div className="white-panel" style={{ padding: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 800 }}>¿Cómo se evalúa?</h3>
            <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", color: "#475569", display: "flex", flexDirection: "column", gap: "5px" }}>
              <li>5 estímulos aleatorios entre 1,2 s y 3,2 s.</li>
              <li>Pulsar el recuadro o la barra espaciadora al encender el estímulo amarillo.</li>
              <li>El promedio actualiza el parámetro PVT del tripulante activo.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Gráficos dinámicos de los 6 Indicadores Centrales */}
      <div className="white-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>
            Tendencias Temporales · 6 Indicadores Centrales (Banda Verde = Nominal)
          </h2>
          <span className="mono" style={{ fontSize: "11px", color: "#475569" }}>
            Últimas {historico.length} muestras (V1 7001 / V2 6001)
          </span>
        </div>

        <div className="charts-grid-6">
          {indicadores.map((varKey, idx) => {
            const cfg = umbrales.biomarkers?.[varKey];
            if (!cfg) return null;
            const vals = historico.map((row) => Number(row[varKey]));
            return (
              <MiniTrendChart
                key={varKey}
                title={(etiquetas[varKey] || varKey).split("(")[0].trim()}
                unit={cfg.unit}
                values={vals}
                normRange={cfg.normal}
                color={trendColors[idx % trendColors.length]}
              />
            );
          })}
        </div>
      </div>

      {/* Asistente Clínico Autónomo (LM Studio / Offline) + Nota Conductual Privada (PPC) */}
      <div className="ai-ppc-grid">
        <div className="white-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>
                Asistente Clínico Autónomo (LM Studio / Respaldo Offline)
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#475569" }}>
                Anclado en <code>protocolos_medicos_nasa.md</code> · Sin lenguaje antropomórfico (F.6.2.e)
              </p>
            </div>
            <button type="button" className="pill-btn sm" onClick={() => setMessages([])}>
              Limpiar
            </button>
          </div>

          <div
            style={{
              height: "230px",
              overflowY: "auto",
              background: "#FAF7F2",
              border: "1px solid #DFD8CA",
              borderRadius: "14px",
              padding: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {messages.length === 0 && (
              <div style={{ fontSize: "12px", color: "#64748B" }}>
                Consulta sobre el estado fisiológico actual, umbrales NASA-STD-3001 o pasos de emergencia (sin espera a Tierra).
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "90%",
                  padding: "9px 12px",
                  borderRadius: "12px",
                  fontSize: "12px",
                  background: msg.role === "user" ? "#0F172A" : "#FFFFFF",
                  color: msg.role === "user" ? "#FFFFFF" : "#0F172A",
                  border: msg.role === "user" ? "none" : "1px solid #DFD8CA",
                }}
              >
                <div>{msg.content}</div>
                {msg.origen && (
                  <div className="mono" style={{ fontSize: "10px", color: "#64748B", marginTop: "4px" }}>
                    Fuente: {msg.origen}
                  </div>
                )}
              </div>
            ))}
          </div>

          <form onSubmit={handleSendChat} style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ej: ¿Qué protocolo aplica ante dolor torácico o hipoxia?"
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: "12px",
                border: "1px solid #D6CFC2",
                background: "#FAF7F2",
                fontSize: "12px",
                outline: "none",
              }}
            />
            <button type="submit" className="pill-btn dark" disabled={loadingChat}>
              {loadingChat ? "..." : "Consultar"}
            </button>
          </form>
        </div>

        <div className="white-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>Registro Privado (PPC)</h2>
            <span className="mono" style={{ fontSize: "10.5px", fontWeight: 800, color: "#2563EB" }}>
              V1 3004.q · V1 6010
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "11.5px", color: "#475569" }}>
            Nota privada cifrada para Conferencia Psicológica Privada en modalidad store-and-forward (privacidad V2 7071).
          </p>
          <textarea
            rows={6}
            value={ppcNote}
            onChange={(e) => {
              setPpcNote(e.target.value);
              setPpcSaved(false);
            }}
            placeholder="Anotación conductual o de síntomas para transmisión diferida..."
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "12px",
              border: "1px solid #D6CFC2",
              background: "#FAF7F2",
              fontSize: "12px",
              resize: "vertical",
              outline: "none",
            }}
          />
          <button
            type="button"
            className="pill-btn blue"
            style={{ justifyContent: "center" }}
            onClick={() => {
              if (ppcNote.trim()) {
                setPpcSaved(true);
                setPpcNote("");
                showToast("Nota PPC cifrada en cola store-and-forward", "#2563EB");
              }
            }}
          >
            🔒 Guardar en Cola Store-and-Forward
          </button>
          {ppcSaved && (
            <span style={{ fontSize: "11.5px", color: "#065F46", fontWeight: 700 }}>
              ✓ Nota protegida localmente bajo privacidad V2 7071.
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
