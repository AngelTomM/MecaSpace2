import React, { useEffect, useRef, useState } from "react";
import {
  PVT_FEEDBACK_MS,
  PVT_ISI_MAX,
  PVT_ISI_MIN,
  PVT_LAPSE_RT,
  PVT_MIN_RT,
  PVT_MODES,
  PVT_TIMEOUT_RT,
  computePvtMetrics,
  savePvtSession,
} from "../data/pvtMetrics";

export default function PvtModal({
  open,
  crewId,
  crewName,
  currentPvt,
  onClose,
  onSavePvt,
  onSessionComplete,
  showToast,
}) {
  const [mode, setMode] = useState("quick"); // quick | clinical
  const [status, setStatus] = useState("idle"); // idle | wait | go | feedback | done
  const [trials, setTrials] = useState([]);
  const [liveMs, setLiveMs] = useState(0);
  const [remainingSec, setRemainingSec] = useState(180);
  const [feedbackTitle, setFeedbackTitle] = useState(`${currentPvt || 238} ms`);
  const [feedbackSub, setFeedbackSub] = useState("");
  const [feedbackKind, setFeedbackKind] = useState("nominal"); // nominal | false_start | lapse
  const [summary, setSummary] = useState(null);

  const waitTimerRef = useRef(null);
  const nextTimerRef = useRef(null);
  const timeoutTimerRef = useRef(null);
  const clockIntervalRef = useRef(null);
  const animFrameRef = useRef(null);
  const goTimeRef = useRef(0);
  const sessionStartRef = useRef(0);
  const trialsRef = useRef([]);
  const modeRef = useRef(mode);

  modeRef.current = mode;

  const cleanup = () => {
    clearTimeout(waitTimerRef.current);
    clearTimeout(nextTimerRef.current);
    clearTimeout(timeoutTimerRef.current);
    clearInterval(clockIntervalRef.current);
    cancelAnimationFrame(animFrameRef.current);
  };

  useEffect(() => {
    if (!open) {
      cleanup();
      setStatus("idle");
      setTrials([]);
      trialsRef.current = [];
      setSummary(null);
      setFeedbackKind("nominal");
    }
    return cleanup;
  }, [open]);

  const finishSession = (finalTrials) => {
    cleanup();
    const metrics = computePvtMetrics(finalTrials);
    const payload = {
      ...metrics,
      mode: modeRef.current,
    };
    savePvtSession(crewId, payload);
    setSummary(payload);
    setFeedbackTitle(`${metrics.meanRt || currentPvt || 238} ms`);
    setFeedbackSub(
      `Score ${metrics.performanceScore}% · ${metrics.lapses} lapse(s) · ${metrics.falseStarts} false start(s)`
    );
    setFeedbackKind(metrics.meanRt >= 265 || metrics.lapses > 1 ? "lapse" : "nominal");
    setStatus("done");
    if (metrics.meanRt > 0) {
      onSavePvt(metrics.meanRt);
    }
    onSessionComplete?.(payload);
    showToast(
      `PVT-B saved: ${metrics.meanRt} ms (Score ${metrics.performanceScore}%)`,
      metrics.meanRt >= 265 ? "#EAB308" : "#00B87C"
    );
  };

  const scheduleNext = (currentList) => {
    const activeCfg = PVT_MODES[modeRef.current];
    const validCount = currentList.filter((t) => !t.falseStart && t.rt >= PVT_MIN_RT).length;

    if (activeCfg.maxTrials && validCount >= activeCfg.maxTrials) {
      finishSession(currentList);
      return;
    }
    if (
      activeCfg.durationMs &&
      performance.now() - sessionStartRef.current >= activeCfg.durationMs
    ) {
      finishSession(currentList);
      return;
    }

    setStatus("wait");
    const isi = PVT_ISI_MIN + Math.random() * (PVT_ISI_MAX - PVT_ISI_MIN);
    waitTimerRef.current = setTimeout(() => {
      if (
        activeCfg.durationMs &&
        performance.now() - sessionStartRef.current >= activeCfg.durationMs
      ) {
        finishSession(trialsRef.current);
        return;
      }

      goTimeRef.current = performance.now();
      setLiveMs(0);
      setStatus("go");

      const loop = () => {
        setLiveMs(Math.round(performance.now() - goTimeRef.current));
        animFrameRef.current = requestAnimationFrame(loop);
      };
      animFrameRef.current = requestAnimationFrame(loop);

      timeoutTimerRef.current = setTimeout(() => {
        cancelAnimationFrame(animFrameRef.current);
        const updated = [
          ...trialsRef.current,
          { rt: PVT_TIMEOUT_RT, falseStart: false, timeout: true },
        ];
        trialsRef.current = updated;
        setTrials(updated);
        setFeedbackTitle("30000 ms · TIMEOUT");
        setFeedbackSub("Attention lapse recorded (30 s limit)");
        setFeedbackKind("lapse");
        setStatus("feedback");
        nextTimerRef.current = setTimeout(() => scheduleNext(updated), PVT_FEEDBACK_MS);
      }, PVT_TIMEOUT_RT);
    }, isi);
  };

  const startSession = () => {
    cleanup();
    trialsRef.current = [];
    setTrials([]);
    setSummary(null);
    sessionStartRef.current = performance.now();
    if (PVT_MODES[mode].durationMs) {
      setRemainingSec(Math.round(PVT_MODES[mode].durationMs / 1000));
      clockIntervalRef.current = setInterval(() => {
        const left = Math.max(
          0,
          Math.ceil(
            (PVT_MODES[modeRef.current].durationMs -
              (performance.now() - sessionStartRef.current)) /
              1000
          )
        );
        setRemainingSec(left);
      }, 250);
    }
    scheduleNext([]);
  };

  const handlePadClick = () => {
    if (status === "wait") {
      clearTimeout(waitTimerRef.current);
      const updated = [...trialsRef.current, { rt: 0, falseStart: true, timeout: false }];
      trialsRef.current = updated;
      setTrials(updated);
      setFeedbackTitle("FALSE START!");
      setFeedbackSub("Wait for the yellow counter before pressing");
      setFeedbackKind("false_start");
      setStatus("feedback");
      nextTimerRef.current = setTimeout(() => scheduleNext(updated), PVT_FEEDBACK_MS);
      return;
    }

    if (status === "go") {
      cancelAnimationFrame(animFrameRef.current);
      clearTimeout(timeoutTimerRef.current);
      const reaction = Math.round(performance.now() - goTimeRef.current);

      if (reaction < PVT_MIN_RT) {
        const updated = [
          ...trialsRef.current,
          { rt: reaction, falseStart: true, timeout: false },
        ];
        trialsRef.current = updated;
        setTrials(updated);
        setFeedbackTitle("FALSE START!");
        setFeedbackSub(`Anticipation (${reaction} ms < 100 ms)`);
        setFeedbackKind("false_start");
        setStatus("feedback");
        nextTimerRef.current = setTimeout(() => scheduleNext(updated), PVT_FEEDBACK_MS);
        return;
      }

      const isLapse = reaction >= PVT_LAPSE_RT;
      const updated = [
        ...trialsRef.current,
        { rt: reaction, falseStart: false, timeout: false },
      ];
      trialsRef.current = updated;
      setTrials(updated);
      const validCount = updated.filter((t) => !t.falseStart && t.rt >= PVT_MIN_RT).length;
      const modeCfg = PVT_MODES[modeRef.current];
      setFeedbackTitle(`${reaction} ms`);
      setFeedbackSub(
        `${isLapse ? "Attention Lapse (≥ 355 ms) · " : ""}${
          modeCfg.maxTrials ? `Stimulus ${validCount} of ${modeCfg.maxTrials}` : `Valid #${validCount}`
        }`
      );
      setFeedbackKind(isLapse ? "lapse" : "nominal");
      setStatus("feedback");
      nextTimerRef.current = setTimeout(() => scheduleNext(updated), PVT_FEEDBACK_MS);
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

  const validDone = trials.filter((t) => !t.falseStart && t.rt >= PVT_MIN_RT).length;
  const isRunning = status === "wait" || status === "go" || status === "feedback";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "560px",
          borderRadius: "20px",
          background: "linear-gradient(160deg, #0B192C 0%, #112239 100%)",
          border: "1.5px solid #243B55",
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
            <span
              className="mono"
              style={{
                fontSize: "10px",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "#38BDF8",
              }}
            >
              NASA ISS Reaction Self Test · PVT-B
            </span>
            <h2 style={{ margin: "3px 0 0", fontSize: "18px", fontWeight: 800 }}>
              PVT-B Test · {crewName}
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

        {/* Mode Selector */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          {Object.values(PVT_MODES).map((m) => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                disabled={isRunning}
                onClick={() => setMode(m.id)}
                style={{
                  padding: "9px 12px",
                  borderRadius: "12px",
                  border: active ? "1.5px solid #00B87C" : "1px solid #334155",
                  background: active ? "rgba(0, 184, 124, 0.16)" : "rgba(15, 23, 42, 0.6)",
                  color: active ? "#E6F8F2" : "#CBD5E1",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: isRunning ? "not-allowed" : "pointer",
                  opacity: isRunning && !active ? 0.55 : 1,
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "#CBD5E1" }}>
          <span>
            Click the box or press{" "}
            <kbd className="mono" style={{ padding: "2px 6px", borderRadius: "5px", background: "rgba(255,255,255,0.15)", color: "#FDE047" }}>
              Space
            </kbd>{" "}
            when the yellow counter appears.
          </span>
          {isRunning && (
            <span className="mono" style={{ color: "#38BDF8", fontWeight: 800 }}>
              {mode === "quick" ? `${validDone}/10` : `${remainingSec}s`}
            </span>
          )}
        </div>

        <div
          onClick={handlePadClick}
          style={{
            height: "210px",
            borderRadius: "16px",
            background:
              status === "go"
                ? "linear-gradient(180deg, #FACC15 0%, #EAB308 100%)"
                : status === "feedback" && feedbackKind === "false_start"
                ? "rgba(220, 38, 38, 0.25)"
                : "#0F172A",
            border:
              status === "go"
                ? "3px solid #FEF08A"
                : status === "feedback" && feedbackKind === "false_start"
                ? "2px solid #EF4444"
                : "2px solid #334155",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            cursor: status === "wait" || status === "go" ? "pointer" : "default",
            userSelect: "none",
            textAlign: "center",
            padding: "16px",
          }}
        >
          {status === "idle" && (
            <p style={{ margin: 0, color: "#94A3B8", fontSize: "14px" }}>
              Select mode and press{" "}
              <strong style={{ color: "#FFFFFF" }}>Start PVT-B</strong>. ISI: 1.0–4.0 s.
            </p>
          )}
          {status === "wait" && (
            <p className="mono" style={{ margin: 0, color: "#94A3B8", fontSize: "16px", fontWeight: 700 }}>
              Stay alert... wait for the stimulus
            </p>
          )}
          {status === "go" && (
            <>
              <span className="mono" style={{ fontSize: "48px", fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>
                {liveMs} ms
              </span>
              <span style={{ fontSize: "12px", fontWeight: 800, color: "#1E293B", textTransform: "uppercase", marginTop: "6px" }}>
                PRESS NOW!
              </span>
            </>
          )}
          {(status === "feedback" || status === "done") && (
            <>
              <span
                className="mono"
                style={{
                  fontSize: feedbackKind === "false_start" ? "30px" : "42px",
                  fontWeight: 800,
                  color:
                    feedbackKind === "false_start"
                      ? "#FCA5A5"
                      : feedbackKind === "lapse"
                      ? "#FCD34D"
                      : "#34D399",
                  lineHeight: 1.1,
                }}
              >
                {feedbackTitle}
              </span>
              <span style={{ fontSize: "12.5px", color: "#CBD5E1", marginTop: "6px" }}>
                {feedbackSub}
              </span>
            </>
          )}
        </div>

        {summary && (
          <div
            className="mono"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "8px",
              background: "rgba(15, 23, 42, 0.75)",
              border: "1px solid #334155",
              borderRadius: "12px",
              padding: "10px 12px",
              fontSize: "11px",
            }}
          >
            <div>
              <div style={{ color: "#94A3B8" }}>Score</div>
              <strong style={{ color: "#00B87C", fontSize: "13px" }}>{summary.performanceScore}%</strong>
            </div>
            <div>
              <div style={{ color: "#94A3B8" }}>Mean 1/RT</div>
              <strong style={{ color: "#FFFFFF", fontSize: "13px" }}>{summary.meanSpeed} s⁻¹</strong>
            </div>
            <div>
              <div style={{ color: "#94A3B8" }}>Fastest 10%</div>
              <strong style={{ color: "#38BDF8", fontSize: "13px" }}>{summary.fastest10Rt} ms</strong>
            </div>
            <div>
              <div style={{ color: "#94A3B8" }}>Slowest 10%</div>
              <strong style={{ color: "#FBBF24", fontSize: "13px" }}>{summary.slowest10Speed} s⁻¹</strong>
            </div>
            <div>
              <div style={{ color: "#94A3B8" }}>Lapses (≥355)</div>
              <strong style={{ color: summary.lapses > 0 ? "#F87171" : "#FFFFFF", fontSize: "13px" }}>
                {summary.lapses}
              </strong>
            </div>
            <div>
              <div style={{ color: "#94A3B8" }}>False Starts</div>
              <strong style={{ color: summary.falseStarts > 0 ? "#F87171" : "#FFFFFF", fontSize: "13px" }}>
                {summary.falseStarts}
              </strong>
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
          <span className="mono" style={{ fontSize: "11px", color: "#94A3B8" }}>
            {mode === "quick"
              ? `Valid stimuli: ${validDone} / 10`
              : `Elapsed: ${180 - remainingSec}s / 180s · Valid: ${validDone}`}
          </span>
          {(status === "idle" || status === "done") && (
            <button
              type="button"
              className="pill-btn green"
              style={{ background: "#00B87C", borderColor: "#00B87C", color: "#052E16" }}
              onClick={startSession}
            >
              {status === "done" ? "Repeat Test" : "Start PVT-B"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
