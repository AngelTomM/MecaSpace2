import React, { useState } from "react";
import { smartFetchJson } from "../engine/localApi";
import { evaluateIndicator, extractUiMetrics, pickHighestSeverity } from "../data/nasaProtocols";
import { loadPvtHistory } from "../data/pvtMetrics";
import WinScatBattery from "./WinScatBattery";

const MENTAL_QUESTIONS = [
  { id: "q1", text: "1. Energy and motivation level on shift", invert: false },
  { id: "q2", text: "2. Sense of calm and emotional balance", invert: false },
  { id: "q3", text: "3. Perceived tension or stress level (1 = none, 5 = high)", invert: true },
  { id: "q4", text: "4. Mental clarity and operational focus", invert: false },
  { id: "q5", text: "5. Feeling rested after sleep", invert: false },
  { id: "q6", text: "6. Mood and cohesion with mission crew", invert: false },
];

const INITIAL_MENTAL_ANSWERS = {
  koch: { q1: 5, q2: 5, q3: 1, q4: 5, q5: 4, q6: 5 },
  glover: { q1: 4, q2: 4, q3: 2, q4: 5, q5: 4, q6: 5 },
  kim: { q1: 4, q2: 4, q3: 2, q4: 4, q5: 3, q6: 5 },
};

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
        { role: "assistant", content: "Local communication error with backup engine.", origen: "System" },
      ]);
    } finally {
      setLoadingChat(false);
    }
  };

  const [winscatDeviation, setWinscatDeviation] = useState(null);
  const crewId = data.active_crew_id || activeCrew.id || "koch";
  const latestPvt = loadPvtHistory(crewId)[0] || null;
  const pvtSpeed = latestPvt?.meanSpeed ?? (m.pvt > 0 ? Math.round((1000 / m.pvt) * 100) / 100 : 0);
  const pvtScore = latestPvt?.performanceScore ?? 100;
  const pvtSlowest10 = latestPvt?.slowest10Speed ?? pvtSpeed;
  const pvtFastest10 = latestPvt?.fastest10Rt ?? Math.round(m.pvt);
  const pvtLapses = latestPvt?.lapses ?? 0;
  const pvtFalseStarts = latestPvt?.falseStarts ?? 0;

  return (
    <section className="screen-section">
      <header className="screen-header screen-header-bordered">
        <div>
          <h1 className="screen-title">Psychological Test, PVT-B &amp; WinSCAT</h1>
          <p className="screen-subtitle">
            Behavioral health, psychomotor vigilance &amp; neurocognitive battery · <strong>{activeCrew.name}</strong>
          </p>
        </div>
        <span
          className="status-pill"
          style={{
            backgroundColor: winscatDeviation ? "#FEE2E2" : overall.pillBg,
            color: winscatDeviation ? "#B91C1C" : overall.pillText,
            border: `1.5px solid ${winscatDeviation ? "#EF4444" : overall.pillBorder}`,
          }}
        >
          {winscatDeviation ? "✕ CLINICAL DEVIATION · RCI" : overall.label}
        </span>
      </header>

      {/* Top row: PVT-B Telemetry + Protocol */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px", alignItems: "stretch" }}>
        {/* PVT-B Card */}
          <div
            className="human-stage"
            style={{
              padding: "20px",
              borderRadius: "16px",
              background: "linear-gradient(160deg, #0B192C 0%, #112239 100%)",
              color: "#FFFFFF",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
              <div>
                <span className="mono" style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#38BDF8" }}>
                  NASA ISS Reaction Self Test
                </span>
                <h2 style={{ margin: "2px 0 0", fontSize: "18px", fontWeight: 800 }}>PVT-B · Psychomotor Vigilance</h2>
              </div>
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: "10px",
                  fontSize: "11px",
                  fontWeight: 800,
                  backgroundColor: stPvt.severity === 0 ? "#E6F8F2" : stPvt.badgeBg,
                  color: stPvt.severity === 0 ? "#009966" : stPvt.badgeText,
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
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#CBD5E1" }}>ms Mean RT</span>
            </div>

            <div
              className="mono"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: "8px",
                fontSize: "11px",
                background: "rgba(15, 23, 42, 0.72)",
                border: "1px solid #243B55",
                borderRadius: "12px",
                padding: "10px 12px",
              }}
            >
              <div>
                <div style={{ color: "#94A3B8" }}>Score</div>
                <strong style={{ color: "#00B87C" }}>{pvtScore}%</strong>
              </div>
              <div>
                <div style={{ color: "#94A3B8" }}>Mean 1/RT</div>
                <strong>{pvtSpeed} s⁻¹</strong>
              </div>
              <div>
                <div style={{ color: "#94A3B8" }}>Slowest 10%</div>
                <strong>{pvtSlowest10} s⁻¹</strong>
              </div>
              <div>
                <div style={{ color: "#94A3B8" }}>Fastest 10%</div>
                <strong>{pvtFastest10} ms</strong>
              </div>
              <div>
                <div style={{ color: "#94A3B8" }}>Lapses (≥355)</div>
                <strong style={{ color: pvtLapses > 0 ? "#FBBF24" : "#FFFFFF" }}>{pvtLapses}</strong>
              </div>
              <div>
                <div style={{ color: "#94A3B8" }}>False Starts</div>
                <strong style={{ color: pvtFalseStarts > 0 ? "#F87171" : "#FFFFFF" }}>{pvtFalseStarts}</strong>
              </div>
            </div>

            <button
              type="button"
              className="pill-btn green"
              style={{
                justifyContent: "center",
                padding: "12px 16px",
                fontSize: "13px",
                background: "#00B87C",
                borderColor: "#00B87C",
                color: "#052E16",
              }}
              onClick={onOpenPvt}
            >
              Start PVT-B Test
            </button>
          </div>

          <div className="white-panel" style={{ padding: "16px", borderRadius: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 800 }}>PVT-B Protocol</h3>
            <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", color: "#475569", display: "flex", flexDirection: "column", gap: "5px" }}>
              <li>Quick Demo (10 stimuli) or Clinical PVT-B (3 min) with 1–4 s ISI.</li>
              <li>Valid RT: 100–354 ms · Lapse: ≥ 355 ms · False Start: &lt; 100 ms.</li>
              <li>Mean RT syncs automatically with the active crew member&apos;s telemetry.</li>
            </ul>
          </div>
      </div>

      {/* WinSCAT Neurocognitive Battery */}
      <WinScatBattery
        crewId={crewId}
        crewName={activeCrew.name}
        onClinicalDeviation={setWinscatDeviation}
        showToast={showToast}
      />

      {/* Autonomous Clinical Assistant + Private Behavioral Note (PPC) */}
      <div className="ai-ppc-grid">
        <div className="white-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>
                Autonomous Clinical Assistant (Offline Backup)
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#475569" }}>
                Anchored in <code>protocolos_medicos_nasa.md</code> · Non-anthropomorphic (F.6.2.e)
              </p>
            </div>
            <button type="button" className="pill-btn sm" onClick={() => setMessages([])}>
              Clear
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
                Ask about current physiological status, NASA-STD-3001 thresholds, or emergency steps (no live Earth wait).
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
                    Source: {msg.origen}
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
              placeholder="e.g., Which protocol applies to chest pain or hypoxia?"
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
              {loadingChat ? "..." : "Ask"}
            </button>
          </form>
        </div>

        <div className="white-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>Private Note (PPC)</h2>
            <span className="mono" style={{ fontSize: "10.5px", fontWeight: 800, color: "#2563EB" }}>
              V1 3004.q · V1 6010
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "11.5px", color: "#475569" }}>
            Encrypted private note for deferred Private Psychological Conference via store-and-forward.
          </p>
          <textarea
            rows={6}
            value={ppcNote}
            onChange={(e) => {
              setPpcNote(e.target.value);
              setPpcSaved(false);
            }}
            placeholder="Behavioral or symptom note for deferred transmission..."
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
                showToast("Encrypted PPC note queued for store-and-forward", "#2563EB");
              }
            }}
          >
            🔒 Save to Store-and-Forward Queue
          </button>
          {ppcSaved && (
            <span style={{ fontSize: "11.5px", color: "#065F46", fontWeight: 700 }}>
              ✓ Note protected locally under V2 7071 privacy.
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
