export const PVT_MODES = {
  quick: {
    id: "quick",
    label: "Quick Demo (10 stimuli)",
    shortLabel: "10 Stimuli",
    maxTrials: 10,
    durationMs: null,
  },
  clinical: {
    id: "clinical",
    label: "Clinical PVT-B (3 min)",
    shortLabel: "3 min (180 s)",
    maxTrials: null,
    durationMs: 180000,
  },
};

export const PVT_MIN_RT = 100;
export const PVT_LAPSE_RT = 355;
export const PVT_TIMEOUT_RT = 30000;
export const PVT_ISI_MIN = 1000;
export const PVT_ISI_MAX = 4000;
export const PVT_FEEDBACK_MS = 1000;

export function computePvtMetrics(trials = []) {
  const falseStarts = trials.filter((t) => t.falseStart || t.rt < PVT_MIN_RT).length;
  const validTrials = trials.filter((t) => !t.falseStart && t.rt >= PVT_MIN_RT);
  const validCount = validTrials.length;
  const lapses = validTrials.filter((t) => t.rt >= PVT_LAPSE_RT).length;

  const denom = validCount + falseStarts;
  const performanceScore =
    denom > 0 ? Math.max(0, Math.round(100 * (1 - (lapses + falseStarts) / denom) * 10) / 10) : 100;

  if (validCount === 0) {
    return {
      meanRt: 0,
      performanceScore,
      meanSpeed: 0,
      slowest10Speed: 0,
      fastest10Rt: 0,
      lapses,
      falseStarts,
      validCount: 0,
      totalEvents: trials.length,
    };
  }

  const rts = validTrials.map((t) => t.rt);
  const meanRt = Math.round(rts.reduce((a, b) => a + b, 0) / validCount);

  const speeds = rts.map((rt) => 1000 / rt);
  const meanSpeed = Math.round((speeds.reduce((a, b) => a + b, 0) / validCount) * 100) / 100;

  const tailCount = Math.max(1, Math.ceil(validCount * 0.1));
  const sortedAsc = [...rts].sort((a, b) => a - b);
  const fastest10Rt = Math.round(
    sortedAsc.slice(0, tailCount).reduce((a, b) => a + b, 0) / tailCount
  );

  const sortedSpeedAsc = [...speeds].sort((a, b) => a - b);
  const slowest10Speed = Math.round(
    (sortedSpeedAsc.slice(0, tailCount).reduce((a, b) => a + b, 0) / tailCount) * 100
  ) / 100;

  return {
    meanRt,
    performanceScore,
    meanSpeed,
    slowest10Speed,
    fastest10Rt,
    lapses,
    falseStarts,
    validCount,
    totalEvents: trials.length,
  };
}

export function loadPvtHistory(crewId) {
  if (!crewId || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`mecaspace_pvt_${crewId}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePvtSession(crewId, summary) {
  if (!crewId || typeof window === "undefined") return [];
  const prev = loadPvtHistory(crewId);
  const next = [
    {
      ...summary,
      timestamp: new Date().toISOString(),
    },
    ...prev,
  ].slice(0, 20);
  try {
    window.localStorage.setItem(`mecaspace_pvt_${crewId}`, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
  return next;
}

