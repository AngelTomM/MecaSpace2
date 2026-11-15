import React, { useEffect, useRef, useState } from "react";
import {
  WINSCAT_SUBTESTS,
  computeSubtestMetrics,
  enqueueStoreAndForwardAlert,
  evaluateRciStatus,
  generateCdsItems,
  generateCptStream,
  generateMspItems,
  generateMthItems,
  generateSymbolDigitKey,
  getCrewWinscatBaseline,
  loadWinscatHistory,
  saveWinscatSession,
} from "../data/winscatEngine";

function Matrix4x4({ cells, highlight = "#0B192C" }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 24px)",
        gap: "4px",
        padding: "10px",
        borderRadius: "12px",
        background: "#FAF7F2",
        border: "1px solid #E5E7EB",
      }}
    >
      {cells.map((v, i) => (
        <div
          key={i}
          style={{
            width: "24px",
            height: "24px",
            borderRadius: "5px",
            background: v === 1 ? highlight : "#FFFFFF",
            border: "1px solid #CBD5E1",
          }}
        />
      ))}
    </div>
  );
}

export default function WinScatBattery({
  crewId,
  crewName,
  onClinicalDeviation,
  showToast,
}) {
  const [phase, setPhase] = useState("idle"); // idle | running | summary
  const [subIdx, setSubIdx] = useState(0);
  const [itemIdx, setItemIdx] = useState(0);
  const [mspStage, setMspStage] = useState("sample"); // sample | hold | choice
  const [sessionKey, setSessionKey] = useState([]);
  const [items, setItems] = useState([]);
  const [subResults, setSubResults] = useState({});
  const [lastFeedback, setLastFeedback] = useState(null);
  const [baseline, setBaseline] = useState(() => getCrewWinscatBaseline(crewId));
  const [history, setHistory] = useState(() => loadWinscatHistory(crewId));
  const [latestSummary, setLatestSummary] = useState(() => loadWinscatHistory(crewId)[0] || null);

  const stimStartRef = useRef(performance.now());
  const currentTrialsRef = useRef([]);
  const mspTimerRef = useRef(null);
  const cptTimerRef = useRef(null);
  const cptAnsweredRef = useRef(false);

  const activeSub = WINSCAT_SUBTESTS[subIdx];

  useEffect(() => {
    setBaseline(getCrewWinscatBaseline(crewId));
    const hist = loadWinscatHistory(crewId);
    setHistory(hist);
    setLatestSummary(hist[0] || null);
    setPhase("idle");
    clearTimers();
  }, [crewId]);

  const clearTimers = () => {
    clearTimeout(mspTimerRef.current);
    clearTimeout(cptTimerRef.current);
  };

  useEffect(() => () => clearTimers(), []);

  const prepareSubtest = (idx, keyForCdd) => {
    clearTimers();
    const sub = WINSCAT_SUBTESTS[idx];
    currentTrialsRef.current = [];
    setSubIdx(idx);
    setItemIdx(0);
    setLastFeedback(null);

    if (sub.id === "CDS") {
      const generated = generateCdsItems(keyForCdd, sub.items);
      setItems(generated);
      stimStartRef.current = performance.now();
    } else if (sub.id === "MTH") {
      setItems(generateMthItems(sub.items));
      stimStartRef.current = performance.now();
    } else if (sub.id === "MSP") {
      setItems(generateMspItems(sub.items));
      startMspCycle();
    } else if (sub.id === "CPT") {
      const stream = generateCptStream(sub.items);
      setItems(stream);
      startCptStep(0, stream);
    } else if (sub.id === "CDD") {
      setItems(generateCdsItems(keyForCdd, sub.items));
      stimStartRef.current = performance.now();
    }
  };

  const startMspCycle = () => {
    clearTimeout(mspTimerRef.current);
    setMspStage("sample");
    mspTimerRef.current = setTimeout(() => {
      setMspStage("hold");
      mspTimerRef.current = setTimeout(() => {
        setMspStage("choice");
        stimStartRef.current = performance.now();
      }, 3000);
    }, 2500);
  };

  const startCptStep = (idx, stream) => {
    clearTimeout(cptTimerRef.current);
    cptAnsweredRef.current = false;
    setItemIdx(idx);
    stimStartRef.current = performance.now();

    cptTimerRef.current = setTimeout(() => {
      if (idx === 0) {
        startCptStep(1, stream);
        return;
      }
      if (!cptAnsweredRef.current) {
        const nextTrials = [
          ...currentTrialsRef.current,
          { correct: false, rt: 1500, timeout: true },
        ];
        currentTrialsRef.current = nextTrials;
        setLastFeedback({ ok: false, text: "Omission (1500 ms)" });
      }
      if (idx + 1 < stream.length) {
        startCptStep(idx + 1, stream);
      } else {
        completeSubtest(3, currentTrialsRef.current);
      }
    }, 1500);
  };

  const startBattery = () => {
    const newKey = generateSymbolDigitKey();
    setSessionKey(newKey);
    setSubResults({});
    setPhase("running");
    prepareSubtest(0, newKey);
  };

  const completeSubtest = (finishedIdx, trialsList, latestResultsMap = subResults) => {
    clearTimers();
    const sub = WINSCAT_SUBTESTS[finishedIdx];
    const metrics = computeSubtestMetrics(trialsList);
    const updatedMap = { ...latestResultsMap, [sub.id]: metrics };
    setSubResults(updatedMap);

    if (finishedIdx + 1 < WINSCAT_SUBTESTS.length) {
      prepareSubtest(finishedIdx + 1, sessionKey);
      return;
    }

    // Complete entire battery
    const subValues = Object.values(updatedMap);
    const avgAccuracy =
      Math.round((subValues.reduce((s, v) => s + v.accuracy, 0) / subValues.length) * 10) / 10;
    const validRts = subValues.filter((v) => v.meanRt > 0);
    const avgRt =
      validRts.length > 0
        ? Math.round(validRts.reduce((s, v) => s + v.meanRt, 0) / validRts.length)
        : 0;
    const avgThroughput =
      Math.round((subValues.reduce((s, v) => s + v.throughput, 0) / subValues.length) * 10) / 10;

    const currentBaseline = getCrewWinscatBaseline(crewId);
    const rci = evaluateRciStatus(avgThroughput, currentBaseline.global, avgAccuracy);

    const summary = {
      subtests: updatedMap,
      global: {
        accuracy: avgAccuracy,
        meanRt: avgRt,
        throughput: avgThroughput,
        baselineThroughput: currentBaseline.global,
        rci,
      },
    };

    const nextHist = saveWinscatSession(crewId, summary);
    setHistory(nextHist);
    setLatestSummary(nextHist[0]);
    setBaseline(getCrewWinscatBaseline(crewId));
    setPhase("summary");

    if (rci.isAlert) {
      enqueueStoreAndForwardAlert(crewId, {
        crewId,
        crewName,
        type: "WINSCAT_RCI_DEVIATION",
        accuracy: avgAccuracy,
        throughput: avgThroughput,
        pctChange: rci.pctChange,
      });
      onClinicalDeviation?.(summary);
      showToast(
        `WinSCAT RCI Alert (${rci.pctChange}%): Onboard CMO notified & store-and-forward queued`,
        "#EF4444"
      );
    } else {
      onClinicalDeviation?.(null);
      showToast(
        `WinSCAT completed · Global Throughput: ${avgThroughput}/min (${rci.label})`,
        rci.key === "fatigue" ? "#F59E0B" : "#00B87C"
      );
    }
  };

  const handleBinaryAnswer = (side) => {
    if (phase !== "running") return;
    const sub = WINSCAT_SUBTESTS[subIdx];

    if (sub.id === "MSP" && mspStage !== "choice") return;
    if (sub.id === "CPT" && (itemIdx === 0 || cptAnsweredRef.current)) return;

    const item = items[itemIdx];
    if (!item || !item.expected) return;

    const rt = Math.max(100, Math.round(performance.now() - stimStartRef.current));
    const correct = side === item.expected;
    const nextTrials = [...currentTrialsRef.current, { correct, rt }];
    currentTrialsRef.current = nextTrials;
    setLastFeedback({ ok: correct, text: `${correct ? "✓" : "✕"} ${rt} ms` });

    if (sub.id === "CPT") {
      cptAnsweredRef.current = true;
      return;
    }

    if (itemIdx + 1 < items.length) {
      setItemIdx(itemIdx + 1);
      if (sub.id === "MSP") {
        startMspCycle();
      } else {
        stimStartRef.current = performance.now();
      }
    } else {
      completeSubtest(subIdx, nextTrials);
    }
  };

  // Keyboard support: A / ArrowLeft = left, L / ArrowRight = right
  useEffect(() => {
    if (phase !== "running") return undefined;
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      const k = e.key.toLowerCase();
      if (k === "a" || e.key === "ArrowLeft") {
        e.preventDefault();
        handleBinaryAnswer("left");
      } else if (k === "l" || e.key === "ArrowRight") {
        e.preventDefault();
        handleBinaryAnswer("right");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const activeItem = items[itemIdx];
  const globalRci = latestSummary?.global?.rci || null;

  return (
    <div className="white-panel" style={{ borderRadius: "16px", border: "1px solid #E5E7EB" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#0F172A" }}>
            Space Neurocognitive Battery · WinSCAT
          </h2>
          <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: "#475569" }}>
            5-subtest binary assessment (CDS · MTH · MSP · CPT · CDD) · Crew Baseline:{" "}
            <strong className="mono">{baseline.global}/min</strong> ({baseline.source})
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {globalRci && (
            <span
              className="mono"
              style={{
                padding: "5px 11px",
                borderRadius: "10px",
                fontSize: "11px",
                fontWeight: 800,
                backgroundColor: globalRci.bg,
                color: globalRci.color,
                border: `1px solid ${globalRci.border}`,
              }}
            >
              {globalRci.label}
            </span>
          )}
          <button
            type="button"
            className="pill-btn green"
            style={{ background: "#00B87C", borderColor: "#00B87C", color: "#052E16" }}
            onClick={startBattery}
          >
            {phase === "running" ? "Restart Battery" : latestSummary ? "Run New WinSCAT" : "Start WinSCAT"}
          </button>
        </div>
      </div>

      {/* Subtest Stepper */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "8px" }}>
        {WINSCAT_SUBTESTS.map((sub, idx) => {
          const isCurrent = phase === "running" && subIdx === idx;
          const doneMetrics = subResults[sub.id] || latestSummary?.subtests?.[sub.id];
          return (
            <div
              key={sub.id}
              style={{
                padding: "8px 10px",
                borderRadius: "12px",
                background: isCurrent ? "#0B192C" : "#FAF7F2",
                color: isCurrent ? "#FFFFFF" : "#0F172A",
                border: isCurrent ? "1.5px solid #00B87C" : "1px solid #E5E7EB",
              }}
            >
              <div className="mono" style={{ fontSize: "11px", fontWeight: 800 }}>
                {idx + 1}. {sub.id}
              </div>
              <div style={{ fontSize: "10.5px", color: isCurrent ? "#CBD5E1" : "#64748B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {sub.name}
              </div>
              {doneMetrics && (
                <div className="mono" style={{ fontSize: "10.5px", fontWeight: 700, color: isCurrent ? "#34D399" : "#009966", marginTop: "3px" }}>
                  TP {doneMetrics.throughput}/m · {doneMetrics.accuracy}%
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Active Test Stage */}
      {phase === "running" && activeSub && (
        <div
          onMouseDown={(e) => {
            if (e.target.closest("button")) return;
            if (e.button === 0) handleBinaryAnswer("left");
            else if (e.button === 2) handleBinaryAnswer("right");
          }}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            borderRadius: "16px",
            background: "linear-gradient(160deg, #0B192C 0%, #112239 100%)",
            border: "1.5px solid #243B55",
            color: "#FFFFFF",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            userSelect: "none",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <div>
              <span className="mono" style={{ fontSize: "11px", fontWeight: 800, color: "#38BDF8" }}>
                {activeSub.id} · {activeSub.name}
              </span>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#CBD5E1" }}>{activeSub.desc}</p>
            </div>
            <div className="mono" style={{ fontSize: "12px", fontWeight: 800, color: "#00B87C" }}>
              {activeSub.id === "CPT"
                ? itemIdx === 0
                  ? "OBS"
                  : `${itemIdx} / ${activeSub.items}`
                : `${itemIdx + 1} / ${items.length}`}
              {lastFeedback && (
                <span style={{ marginLeft: "10px", color: lastFeedback.ok ? "#34D399" : "#F87171" }}>
                  {lastFeedback.text}
                </span>
              )}
            </div>
          </div>

          {/* CDS Key Table */}
          {activeSub.id === "CDS" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(9, minmax(0, 1fr))", gap: "6px", background: "rgba(255,255,255,0.06)", padding: "10px", borderRadius: "12px" }}>
              {sessionKey.map((pair) => (
                <div
                  key={pair.symbol}
                  style={{
                    textAlign: "center",
                    padding: "6px 4px",
                    borderRadius: "8px",
                    background: "rgba(15, 23, 42, 0.7)",
                    border: "1px solid #334155",
                  }}
                >
                  <div style={{ fontSize: "18px", lineHeight: 1.2 }}>{pair.symbol}</div>
                  <div className="mono" style={{ fontSize: "13px", fontWeight: 800, color: "#38BDF8", marginTop: "3px" }}>
                    {pair.digit}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Stimulus Display */}
          <div
            style={{
              minHeight: "150px",
              borderRadius: "14px",
              background: "rgba(15, 23, 42, 0.72)",
              border: "1px solid #334155",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "18px",
            }}
          >
            {(activeSub.id === "CDS" || activeSub.id === "CDD") && activeItem && (
              <div className="mono" style={{ display: "flex", alignItems: "center", gap: "18px", fontSize: "42px", fontWeight: 800 }}>
                <span>{activeItem.symbol}</span>
                <span style={{ color: "#64748B" }}>—</span>
                <span style={{ color: "#FDE047" }}>{activeItem.digit}</span>
              </div>
            )}

            {activeSub.id === "MTH" && activeItem && (
              <div className="mono" style={{ fontSize: "40px", fontWeight: 800, color: "#FFFFFF" }}>
                {activeItem.expr}
              </div>
            )}

            {activeSub.id === "MSP" && activeItem && (
              <>
                {mspStage === "sample" && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                    <span className="mono" style={{ fontSize: "11px", color: "#38BDF8", fontWeight: 800 }}>
                      MEMORIZE PATTERN (2.5 s)
                    </span>
                    <Matrix4x4 cells={activeItem.sample} highlight="#00B87C" />
                  </div>
                )}
                {mspStage === "hold" && (
                  <div className="mono" style={{ fontSize: "16px", fontWeight: 800, color: "#FBBF24" }}>
                    Retention Interval (3.0 s)...
                  </div>
                )}
                {mspStage === "choice" && (
                  <div style={{ display: "flex", alignItems: "center", gap: "28px", flexWrap: "wrap", justifyContent: "center" }}>
                    <div style={{ textAlign: "center" }}>
                      <div className="mono" style={{ fontSize: "11px", color: "#94A3B8", marginBottom: "6px" }}>LEFT [A]</div>
                      <Matrix4x4 cells={activeItem.leftGrid} highlight="#38BDF8" />
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div className="mono" style={{ fontSize: "11px", color: "#94A3B8", marginBottom: "6px" }}>RIGHT [L]</div>
                      <Matrix4x4 cells={activeItem.rightGrid} highlight="#38BDF8" />
                    </div>
                  </div>
                )}
              </>
            )}

            {activeSub.id === "CPT" && activeItem && (
              <div style={{ textAlign: "center" }}>
                <div className="mono" style={{ fontSize: "52px", fontWeight: 800, color: itemIdx === 0 ? "#38BDF8" : "#FDE047", lineHeight: 1 }}>
                  {activeItem.char}
                </div>
                <div className="mono" style={{ fontSize: "11px", color: "#94A3B8", marginTop: "8px" }}>
                  {itemIdx === 0 ? "Initial observation stimulus..." : "Compare with previous symbol (1.5 s)"}
                </div>
              </div>
            )}
          </div>

          {/* Binary Controls */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <button
              type="button"
              className="pill-btn"
              onClick={() => handleBinaryAnswer("left")}
              style={{
                justifyContent: "center",
                padding: "14px 16px",
                fontSize: "14px",
                fontWeight: 800,
                background: "#1E293B",
                color: "#FFFFFF",
                borderColor: "#38BDF8",
              }}
            >
              [A / ← / Left Click] {activeSub.leftLabel}
            </button>
            <button
              type="button"
              className="pill-btn"
              onClick={() => handleBinaryAnswer("right")}
              style={{
                justifyContent: "center",
                padding: "14px 16px",
                fontSize: "14px",
                fontWeight: 800,
                background: "#1E293B",
                color: "#FFFFFF",
                borderColor: "#00B87C",
              }}
            >
              [L / → / Right Click] {activeSub.rightLabel}
            </button>
          </div>
        </div>
      )}

      {/* Results & RCI Summary */}
      {phase !== "running" && latestSummary && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {globalRci?.isAlert && (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "12px",
                background: "#FEE2E2",
                border: "1.5px solid #EF4444",
                color: "#991B1B",
                fontSize: "12.5px",
                fontWeight: 700,
              }}
            >
              CMO Onboard Alert (V1 3006) &amp; Store-and-Forward Report Queued (V1 3004.r-s, V1 6010, V2 10083):
              Throughput change {globalRci.pctChange}% · Accuracy {latestSummary.global.accuracy}%.
            </div>
          )}

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #E5E7EB", color: "#64748B", textAlign: "left" }}>
                  <th style={{ padding: "8px 6px" }}>Subtest</th>
                  <th style={{ padding: "8px 6px" }}>Accuracy</th>
                  <th style={{ padding: "8px 6px" }}>Mean RT</th>
                  <th style={{ padding: "8px 6px" }}>Throughput</th>
                  <th style={{ padding: "8px 6px" }}>vs Baseline</th>
                  <th style={{ padding: "8px 6px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {WINSCAT_SUBTESTS.map((sub) => {
                  const m = latestSummary.subtests?.[sub.id];
                  if (!m) return null;
                  const rci = evaluateRciStatus(m.throughput, baseline[sub.id], m.accuracy);
                  return (
                    <tr key={sub.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "8px 6px", fontWeight: 700, color: "#0F172A" }}>
                        {sub.id} · {sub.name}
                      </td>
                      <td className="mono" style={{ padding: "8px 6px" }}>{m.accuracy}%</td>
                      <td className="mono" style={{ padding: "8px 6px" }}>{m.meanRt} ms</td>
                      <td className="mono" style={{ padding: "8px 6px", fontWeight: 800 }}>{m.throughput}/min</td>
                      <td className="mono" style={{ padding: "8px 6px", color: rci.pctChange < -10 ? "#B91C1C" : "#009966" }}>
                        {rci.pctChange >= 0 ? "+" : ""}{rci.pctChange}%
                      </td>
                      <td style={{ padding: "8px 6px" }}>
                        <span
                          className="mono"
                          style={{
                            padding: "3px 8px",
                            borderRadius: "8px",
                            fontSize: "10.5px",
                            fontWeight: 800,
                            backgroundColor: rci.bg,
                            color: rci.color,
                          }}
                        >
                          {rci.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ background: "#FAF7F2", fontWeight: 800 }}>
                  <td style={{ padding: "9px 6px" }}>Global Session Summary</td>
                  <td className="mono" style={{ padding: "9px 6px" }}>{latestSummary.global.accuracy}%</td>
                  <td className="mono" style={{ padding: "9px 6px" }}>{latestSummary.global.meanRt} ms</td>
                  <td className="mono" style={{ padding: "9px 6px" }}>{latestSummary.global.throughput}/min</td>
                  <td className="mono" style={{ padding: "9px 6px" }}>
                    {latestSummary.global.rci.pctChange >= 0 ? "+" : ""}{latestSummary.global.rci.pctChange}%
                  </td>
                  <td style={{ padding: "9px 6px" }}>
                    <span
                      className="mono"
                      style={{
                        padding: "3px 8px",
                        borderRadius: "8px",
                        fontSize: "10.5px",
                        fontWeight: 800,
                        backgroundColor: latestSummary.global.rci.bg,
                        color: latestSummary.global.rci.color,
                      }}
                    >
                      {latestSummary.global.rci.label}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mono" style={{ fontSize: "11px", color: "#64748B" }}>
            Stored offline sessions for {crewName}: {history.length}
          </div>
        </div>
      )}
    </div>
  );
}

