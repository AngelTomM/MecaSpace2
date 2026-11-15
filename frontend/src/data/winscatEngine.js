export const WINSCAT_SUBTESTS = [
  {
    id: "CDS",
    name: "Code Substitution",
    items: 12,
    leftLabel: "Match",
    rightLabel: "No Match",
    desc: "Compare the central symbol-digit pair against the reference key above.",
  },
  {
    id: "MTH",
    name: "Mathematical Processing",
    items: 12,
    leftLabel: "Greater than 5",
    rightLabel: "Less than 5",
    desc: "Solve the 3-term operation and decide if the result is > 5 or < 5.",
  },
  {
    id: "MSP",
    name: "Delayed Matching to Sample",
    items: 8,
    leftLabel: "Left Matrix",
    rightLabel: "Right Matrix",
    desc: "Memorize the 4x4 pattern (2.5 s), hold (3.0 s), and pick the matching grid.",
  },
  {
    id: "CPT",
    name: "Running Memory CPT",
    items: 12,
    leftLabel: "Same",
    rightLabel: "Different",
    desc: "1-back continuous stream (1.5 s/item): decide if the symbol matches the previous one.",
  },
  {
    id: "CDD",
    name: "Code Substitution Delayed",
    items: 12,
    leftLabel: "Match",
    rightLabel: "No Match",
    desc: "Recall the symbol-digit pairs from CDS without the reference key.",
  },
];

export const DEFAULT_PREFLIGHT_BASELINE = {
  CDS: 48.0,
  MTH: 28.0,
  MSP: 24.0,
  CPT: 52.0,
  CDD: 44.0,
  global: 39.2,
};

const SYMBOLS = ["▲", "●", "■", "◆", "★", "✚", "✖", "▼", "⬟"];

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function generateSymbolDigitKey() {
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  return SYMBOLS.map((symbol, idx) => ({
    symbol,
    digit: digits[idx],
  }));
}

export function generateCdsItems(keyMap, count = 12) {
  const items = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * keyMap.length);
    const base = keyMap[idx];
    const isMatch = i % 2 === 0;
    let shownDigit = base.digit;
    if (!isMatch) {
      const others = keyMap.filter((k) => k.digit !== base.digit);
      shownDigit = others[Math.floor(Math.random() * others.length)].digit;
    }
    items.push({
      symbol: base.symbol,
      digit: shownDigit,
      expected: isMatch ? "left" : "right",
    });
  }
  return shuffle(items);
}

export function generateMthItems(count = 12) {
  const items = [];
  let guard = 0;
  while (items.length < count && guard < 2000) {
    guard += 1;
    const a = 1 + Math.floor(Math.random() * 9);
    const b = 1 + Math.floor(Math.random() * 9);
    const c = 1 + Math.floor(Math.random() * 9);
    const op1 = Math.random() < 0.5 ? "+" : "-";
    const op2 = Math.random() < 0.5 ? "+" : "-";
    const val1 = op1 === "+" ? a + b : a - b;
    const res = op2 === "+" ? val1 + c : val1 - c;
    if (res >= 1 && res <= 9 && res !== 5) {
      const wantGreater = items.length % 2 === 0;
      if ((wantGreater && res > 5) || (!wantGreater && res < 5)) {
        items.push({
          expr: `${a} ${op1} ${b} ${op2} ${c}`,
          result: res,
          expected: res > 5 ? "left" : "right",
        });
      }
    }
  }
  return shuffle(items);
}

function makeGrid4x4() {
  const cells = Array(16).fill(0);
  const indices = shuffle(Array.from({ length: 16 }, (_, i) => i));
  const fillCount = 6 + Math.floor(Math.random() * 4);
  for (let i = 0; i < fillCount; i++) {
    cells[indices[i]] = 1;
  }
  return cells;
}

function makeDistractorGrid(target) {
  const dist = [...target];
  const flips = shuffle(Array.from({ length: 16 }, (_, i) => i)).slice(0, 3);
  for (const idx of flips) {
    dist[idx] = dist[idx] === 1 ? 0 : 1;
  }
  return dist;
}

export function generateMspItems(count = 8) {
  const items = [];
  for (let i = 0; i < count; i++) {
    const sample = makeGrid4x4();
    const distractor = makeDistractorGrid(sample);
    const targetOnLeft = i % 2 === 0;
    items.push({
      sample,
      leftGrid: targetOnLeft ? sample : distractor,
      rightGrid: targetOnLeft ? distractor : sample,
      expected: targetOnLeft ? "left" : "right",
    });
  }
  return shuffle(items);
}

export function generateCptStream(count = 12) {
  const pool = ["A", "C", "E", "H", "K", "M", "P", "R", "S", "T", "3", "7"];
  const stream = [];
  let prev = pool[Math.floor(Math.random() * pool.length)];
  stream.push({ char: prev, expected: null, isBaselineObs: true });

  for (let i = 0; i < count; i++) {
    const wantSame = Math.random() < 0.42;
    let nextChar = prev;
    if (!wantSame) {
      const others = pool.filter((c) => c !== prev);
      nextChar = others[Math.floor(Math.random() * others.length)];
    }
    stream.push({
      char: nextChar,
      expected: nextChar === prev ? "left" : "right",
      isBaselineObs: false,
    });
    prev = nextChar;
  }
  return stream;
}

export function computeSubtestMetrics(trials = []) {
  const total = trials.length;
  if (total === 0) {
    return { accuracy: 0, meanRt: 0, throughput: 0, correctCount: 0, total: 0 };
  }
  const correctTrials = trials.filter((t) => t.correct);
  const correctCount = correctTrials.length;
  const accuracy = Math.round((correctCount / total) * 1000) / 10;
  const meanRt =
    correctCount > 0
      ? Math.round(correctTrials.reduce((s, t) => s + t.rt, 0) / correctCount)
      : 0;
  const totalRtMs = trials.reduce((s, t) => s + Math.max(100, t.rt), 0);
  const totalMinutes = totalRtMs / 60000;
  const throughput =
    totalMinutes > 0 ? Math.round((correctCount / totalMinutes) * 10) / 10 : 0;

  return { accuracy, meanRt, throughput, correctCount, total };
}

export function evaluateRciStatus(throughput, baselineThroughput, accuracy) {
  const base = baselineThroughput > 0 ? baselineThroughput : DEFAULT_PREFLIGHT_BASELINE.global;
  const pctChange = Math.round(((throughput - base) / base) * 1000) / 10;
  const dropPct = -pctChange;

  if (dropPct > 18 || accuracy < 70) {
    return {
      key: "deviation",
      label: "✕ SIGNIFICANT DEVIATION - RCI",
      bg: "#FEE2E2",
      color: "#B91C1C",
      border: "#EF4444",
      pctChange,
      isAlert: true,
    };
  }
  if (dropPct >= 10) {
    return {
      key: "fatigue",
      label: "⚠ FATIGUE / MONITOR",
      bg: "#FEF3C7",
      color: "#B45309",
      border: "#F59E0B",
      pctChange,
      isAlert: false,
    };
  }
  return {
    key: "nominal",
    label: "✓ NOMINAL",
    bg: "#E6F8F2",
    color: "#009966",
    border: "#10B981",
    pctChange,
    isAlert: false,
  };
}

export function loadWinscatHistory(crewId) {
  if (!crewId || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`mecaspace_winscat_${crewId}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getCrewWinscatBaseline(crewId) {
  const history = loadWinscatHistory(crewId);
  if (history.length === 0) {
    return { ...DEFAULT_PREFLIGHT_BASELINE, source: "Preflight Default" };
  }
  const recent = history.slice(0, 3);
  const avg = (key) => {
    const vals = recent
      .map((s) => s.subtests?.[key]?.throughput)
      .filter((v) => typeof v === "number" && v > 0);
    if (vals.length === 0) return DEFAULT_PREFLIGHT_BASELINE[key];
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  };
  const globalVals = recent.map((s) => s.global?.throughput).filter((v) => typeof v === "number" && v > 0);
  const global =
    globalVals.length > 0
      ? Math.round((globalVals.reduce((a, b) => a + b, 0) / globalVals.length) * 10) / 10
      : DEFAULT_PREFLIGHT_BASELINE.global;

  return {
    CDS: avg("CDS"),
    MTH: avg("MTH"),
    MSP: avg("MSP"),
    CPT: avg("CPT"),
    CDD: avg("CDD"),
    global,
    source: `Last ${recent.length} session(s)`,
  };
}

export function saveWinscatSession(crewId, sessionSummary) {
  if (!crewId || typeof window === "undefined") return [];
  const prev = loadWinscatHistory(crewId);
  const next = [
    {
      ...sessionSummary,
      timestamp: new Date().toISOString(),
    },
    ...prev,
  ].slice(0, 20);
  try {
    window.localStorage.setItem(`mecaspace_winscat_${crewId}`, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
  return next;
}

export function enqueueStoreAndForwardAlert(crewId, alertPayload) {
  if (!crewId || typeof window === "undefined") return [];
  const key = `mecaspace_sf_queue_${crewId}`;
  try {
    const raw = window.localStorage.getItem(key);
    const prev = raw ? JSON.parse(raw) : [];
    const next = [
      {
        ...alertPayload,
        queuedAt: new Date().toISOString(),
        refs: "V1 3006 (CMO), V1 3004.r-s, V1 6010, V2 10083",
        mode: "offline_store_and_forward",
      },
      ...(Array.isArray(prev) ? prev : []),
    ].slice(0, 30);
    window.localStorage.setItem(key, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

