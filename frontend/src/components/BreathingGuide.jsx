import React, { useEffect, useRef, useState } from "react";

const BREATH_PHASES = [
  { label: "Inhalar", sec: 4, scale: 1.16, bg: "rgba(16, 185, 129, 0.35)", border: "#10B981" },
  { label: "Sostener", sec: 4, scale: 1.16, bg: "rgba(234, 179, 8, 0.35)", border: "#EAB308" },
  { label: "Exhalar", sec: 6, scale: 0.82, bg: "rgba(37, 99, 235, 0.35)", border: "#60A5FA" },
];

const BREATH_IDLE_STATE = {
  label: "Listo",
  secs: "4-4-6",
  scale: 0.88,
  bg: "rgba(16, 185, 129, 0.25)",
  border: "#10B981",
};

export default function BreathingGuide() {
  const [running, setRunning] = useState(false);
  const [phaseState, setPhaseState] = useState(BREATH_IDLE_STATE);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const toggleBreathing = () => {
    if (running) {
      clearInterval(timerRef.current);
      setRunning(false);
      setPhaseState(BREATH_IDLE_STATE);
      return;
    }

    setRunning(true);
    let idx = 0;
    let rem = BREATH_PHASES[0].sec;

    const paint = () => {
      const c = BREATH_PHASES[idx];
      setPhaseState({
        label: c.label,
        secs: `${rem}s`,
        scale: c.scale,
        bg: c.bg,
        border: c.border,
      });
    };
    paint();

    timerRef.current = setInterval(() => {
      rem -= 1;
      if (rem <= 0) {
        idx = (idx + 1) % BREATH_PHASES.length;
        rem = BREATH_PHASES[idx].sec;
      }
      paint();
    }, 1000);
  };

  return (
    <div
      style={{
        borderRadius: "16px",
        background: "rgba(30, 41, 59, 0.85)",
        border: "1px solid #334155",
        padding: "14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
      }}
    >
      <div>
        <span className="mono" style={{ fontSize: "10px", fontWeight: 800, color: "#34D399", textTransform: "uppercase" }}>
          Autorregulación
        </span>
        <h4 style={{ margin: "2px 0", fontSize: "14px", fontWeight: 800 }}>Respiración Guiada 4-4-6</h4>
        <p style={{ margin: "0 0 8px", fontSize: "11px", color: "#CBD5E1" }}>
          Inhalar 4s · Sostener 4s · Exhalar 6s
        </p>
        <button
          type="button"
          className={`pill-btn sm ${running ? "dark" : "green"}`}
          onClick={toggleBreathing}
        >
          {running ? "Detener" : "Iniciar 4-4-6"}
        </button>
      </div>

      <div
        className="breathing-orb"
        style={{
          transform: `scale(${phaseState.scale})`,
          backgroundColor: phaseState.bg,
          borderColor: phaseState.border,
        }}
      >
        <span style={{ fontSize: "11px", fontWeight: 800, color: "#FFFFFF" }}>{phaseState.label}</span>
        <span className="mono" style={{ fontSize: "11px", color: "#6EE7B7" }}>{phaseState.secs}</span>
      </div>
    </div>
  );
}
