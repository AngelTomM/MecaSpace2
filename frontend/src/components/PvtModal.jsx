import React, { useEffect, useRef, useState } from "react";

export default function PvtModal({ open, crewName, currentPvt, onClose, onSavePvt, showToast }) {
  const [status, setStatus] = useState("idle"); // idle | wait | go | feedback | done
  const [results, setResults] = useState([]);
  const [liveMs, setLiveMs] = useState(0);
  const [feedbackMs, setFeedbackMs] = useState(currentPvt || 238);
  const [feedbackSub, setFeedbackSub] = useState("");

  const waitTimerRef = useRef(null);
  const nextTimerRef = useRef(null);
  const animFrameRef = useRef(null);
  const goTimeRef = useRef(0);

  const cleanup = () => {
    clearTimeout(waitTimerRef.current);
    clearTimeout(nextTimerRef.current);
    cancelAnimationFrame(animFrameRef.current);
  };

  useEffect(() => {
    if (!open) {
      cleanup();
      setStatus("idle");
      setResults([]);
    }
    return cleanup;
  }, [open]);

  const scheduleNext = (currentList) => {
    if (currentList.length >= 5) {
      const avg = Math.round(currentList.reduce((a, b) => a + b, 0) / currentList.length);
      setFeedbackMs(avg);
      setFeedbackSub("Promedio de 5 estímulos guardado");
      setStatus("done");
      onSavePvt(avg);
      showToast(`Test PVT guardado: ${avg} ms`, avg >= 265 ? "#EAB308" : "#10B981");
      return;
    }
    setStatus("wait");
    const randomDelay = 1200 + Math.random() * 2000;
    waitTimerRef.current = setTimeout(() => {
      goTimeRef.current = performance.now();
      setStatus("go");
      const loop = () => {
        setLiveMs(Math.round(performance.now() - goTimeRef.current));
        animFrameRef.current = requestAnimationFrame(loop);
      };
      animFrameRef.current = requestAnimationFrame(loop);
    }, randomDelay);
  };

  const handlePadClick = () => {
    if (status === "wait") {
      clearTimeout(waitTimerRef.current);
      showToast("Espera el estímulo amarillo antes de pulsar", "#EAB308");
      scheduleNext(results);
    } else if (status === "go") {
      cancelAnimationFrame(animFrameRef.current);
      const reaction = Math.max(140, Math.round(performance.now() - goTimeRef.current));
      const updated = [...results, reaction];
      setResults(updated);
      setFeedbackMs(reaction);
      setFeedbackSub(`Estímulo ${updated.length} de 5`);
      setStatus("feedback");
      nextTimerRef.current = setTimeout(() => scheduleNext(updated), 650);
    }
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.code === "Space" && (status === "wait" || status === "go")) {
        e.preventDefault();
        handlePadClick();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "520px",
          borderRadius: "26px",
          background: "#0F172A",
          border: "2px solid #334155",
          color: "#FFFFFF",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          boxShadow: "0 24px 48px rgba(0,0,0,0.45)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
          <div>
            <span className="mono" style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#38BDF8" }}>
              Prueba Psicomotora de Vigilancia (5 Estímulos)
            </span>
            <h2 style={{ margin: "3px 0 0", fontSize: "18px", fontWeight: 800 }}>
              Test PVT · {crewName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "#1E293B",
              border: "none",
              color: "#E2E8F0",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        <p style={{ margin: 0, fontSize: "12px", color: "#CBD5E1" }}>
          Haz clic en el recuadro o presiona <kbd className="mono" style={{ padding: "2px 6px", borderRadius: "5px", background: "rgba(255,255,255,0.15)", color: "#FDE047" }}>Espacio</kbd> lo más rápido posible cuando se encienda el estímulo visual.
        </p>

        <div
          onClick={handlePadClick}
          style={{
            height: "220px",
            borderRadius: "18px",
            background: "#1E293B",
            border: "2px solid #475569",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          {status === "idle" && (
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" }}>
              <div style={{ fontSize: "14px", fontWeight: 800 }}>5 estímulos en intervalos aleatorios (1,2 s – 3,2 s)</div>
              <button
                type="button"
                className="pill-btn green"
                onClick={(e) => {
                  e.stopPropagation();
                  setResults([]);
                  scheduleNext([]);
                }}
              >
                Comenzar Prueba
              </button>
            </div>
          )}

          {status === "wait" && (
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "10px", alignItems: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#CBD5E1" }}>
                Mantente atento...
              </span>
              <div style={{ width: "46px", height: "46px", borderRadius: "999px", border: "2px solid #64748B", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ width: "14px", height: "14px", borderRadius: "999px", background: "#38BDF8" }} />
              </div>
              <span className="mono" style={{ fontSize: "12px", color: "#94A3B8" }}>
                Estímulo {results.length + 1} de 5
              </span>
            </div>
          )}

          {status === "go" && (
            <div style={{ padding: "18px 34px", borderRadius: "16px", background: "#EAB308", color: "#0F172A", textAlign: "center" }}>
              <div style={{ fontSize: "12px", fontWeight: 800, textTransform: "uppercase" }}>¡PULSA AHORA!</div>
              <div className="mono" style={{ fontSize: "36px", fontWeight: 800, marginTop: "4px" }}>{liveMs} ms</div>
            </div>
          )}

          {(status === "feedback" || status === "done") && (
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "8px", alignItems: "center" }}>
              <div className="mono" style={{ fontSize: "38px", fontWeight: 800, color: "#34D399" }}>
                {feedbackMs} ms
              </div>
              <div style={{ fontSize: "12px", color: "#CBD5E1" }}>{feedbackSub}</div>
              {status === "done" && (
                <button
                  type="button"
                  className="pill-btn green"
                  style={{ marginTop: "6px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setResults([]);
                    scheduleNext([]);
                  }}
                >
                  Repetir Prueba
                </button>
              )}
            </div>
          )}
        </div>

        <div
          className="mono"
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "12px",
            background: "#1E293B",
            borderRadius: "12px",
            padding: "10px 14px",
            border: "1px solid #334155",
          }}
        >
          <span>Último registro: <strong>{Math.round(currentPvt || 238)} ms</strong></span>
          <span>Nominal: <strong style={{ color: "#34D399" }}>&lt; 265 ms</strong></span>
        </div>
      </div>
    </div>
  );
}
