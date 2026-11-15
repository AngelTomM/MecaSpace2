/**
 * Operational clinical dictionary based on:
 * - protocolos_medicos_nasa.md (PROTO-CV-01 to PROTO-COND-05)
 * - NASA-STD-3001 Vol. 1 Rev. C & Vol. 2 Rev. E
 * - data/nasa_thresholds.json
 */

export const NASA_LEVELS = {
  nominal: {
    key: "nominal",
    backendKey: "Nominal",
    severity: 0,
    hex: "#10B981",
    cardBg: "#ECFDF5",
    cardBorder: "#10B981",
    badgeBg: "#10B981",
    badgeText: "#FFFFFF",
    pillBg: "#ECFDF5",
    pillText: "#065F46",
    pillBorder: "#10B981",
    label: "✓ NOMINAL",
    shortLabel: "NOMINAL",
    blink: false,
  },
  stale: {
    key: "stale",
    backendKey: "Stale",
    severity: 1,
    hex: "#06B6D4",
    cardBg: "#ECFEFF",
    cardBorder: "#06B6D4",
    badgeBg: "#0891B2",
    badgeText: "#FFFFFF",
    pillBg: "#ECFEFF",
    pillText: "#155E75",
    pillBorder: "#06B6D4",
    label: "⏱ STALE DATA",
    shortLabel: "STALE DATA",
    blink: false,
  },
  advisory: {
    key: "advisory",
    backendKey: "Advisory",
    severity: 1,
    hex: "#2563EB",
    cardBg: "#EFF6FF",
    cardBorder: "#2563EB",
    badgeBg: "#2563EB",
    badgeText: "#FFFFFF",
    pillBg: "#EFF6FF",
    pillText: "#1E40AF",
    pillBorder: "#2563EB",
    label: "▼ ADVISORY",
    shortLabel: "ADVISORY",
    blink: false,
  },
  caution: {
    key: "caution",
    backendKey: "Caution",
    severity: 2,
    hex: "#EAB308",
    cardBg: "#FEFCE8",
    cardBorder: "#EAB308",
    badgeBg: "#EAB308",
    badgeText: "#0F172A",
    pillBg: "#FEFCE8",
    pillText: "#854D0E",
    pillBorder: "#EAB308",
    label: "▲ CAUTION",
    shortLabel: "CAUTION",
    blink: false,
  },
  warning: {
    key: "warning",
    backendKey: "Warning",
    severity: 3,
    hex: "#EF4444",
    cardBg: "#FEF2F2",
    cardBorder: "#EF4444",
    badgeBg: "#EF4444",
    badgeText: "#FFFFFF",
    pillBg: "#FEF2F2",
    pillText: "#991B1B",
    pillBorder: "#EF4444",
    label: "▲ WARNING",
    shortLabel: "WARNING",
    blink: false,
  },
  emergency: {
    key: "emergency",
    backendKey: "Emergency",
    severity: 4,
    hex: "#DC2626",
    cardBg: "#FEF2F2",
    cardBorder: "#DC2626",
    badgeBg: "#DC2626",
    badgeText: "#FFFFFF",
    pillBg: "#DC2626",
    pillText: "#FFFFFF",
    pillBorder: "#DC2626",
    label: "⚡ EMERGENCY",
    shortLabel: "EMERGENCY",
    blink: true,
  },
};

export function mapBackendLevelToKey(nivelNasa, isStale = false) {
  if (isStale && (!nivelNasa || nivelNasa === "Nominal" || nivelNasa === "Advisory")) {
    return "stale";
  }
  const map = {
    Emergency: "emergency",
    Warning: "warning",
    Caution: "caution",
    Advisory: "advisory",
    Nominal: "nominal",
    Stale: "stale",
  };
  return map[nivelNasa] || "nominal";
}

export const PROTOCOL_DICTIONARY = {
  "PROTO-CV-01": {
    code: "PROTO-CV-01",
    title: "Acute Cardiovascular Event, Chest Pain, or Collapse",
    refs: "Table E.2-2 · V1 3004.i · V1 5001-5003 · V2 10178",
    shapIndicators: ["frec_cardiaca", "anomalia_ecg", "presion_sistolica", "spo2"],
    caution: {
      diag: "Moderate cardiovascular strain above individual baseline (Astroskin).",
      dir1: "Reduce operational workload by 50% and adopt neutral rest with electrolyte hydration.",
      dir2: "Monitor blood pressure, heart rate, and continuous ECG trends every 5 minutes.",
      actionType: "reposo_cv",
      actionLabel: "🛌 Rest + Hydration",
    },
    critical: {
      diag: "Acute cardiovascular event or critical strain in transit.",
      dir1: "Trigger emergency response, secure airway, initiate CPR/AED if collapsed, and halt critical maneuvers.",
      dir2: "EXCEEDS SCOPE: escalate to CMO for 3-lead ECG + onboard ultrasound and store-and-forward packet.",
      exceedsScope: true,
      actionType: "rcp_dea",
      actionLabel: "⚡ Run CPR / AED & Stabilize",
    },
  },
  "PROTO-RESP-02": {
    code: "PROTO-RESP-02",
    title: "Cabin Hypoxia or Hypercapnia",
    refs: "V2 6003 · V2 6004 · Table 6.2-1 · V1 3004.i",
    shapIndicators: ["spo2", "frec_respiratoria", "vol_respiratorio"],
    caution: {
      diag: "Early hypoxia or hypercapnia in pressurized cabin.",
      dir1: "Perform 5 minutes of controlled diaphragmatic breathing and halt physical exertion.",
      dir2: "Audit cabin oxygen partial pressure (P_I O₂ 145–155 mmHg) and CO₂ scrubbing (ppCO₂ ≤ 3 mmHg).",
      actionType: "oxigeno_100",
      actionLabel: "💨 Apply 100% O₂ & Audit ECLSS",
    },
    critical: {
      diag: "Severe respiratory compromise or cabin atmospheric failure (SpO₂ < 90% / low P_I O₂).",
      dir1: "Administer 100% supplemental oxygen immediately, stop physical activity, and isolate potential leak or ECLSS failure.",
      dir2: "EXCEEDS SCOPE: escalate to onboard lung ultrasound and transmit store-and-forward record.",
      exceedsScope: true,
      actionType: "oxigeno_100",
      actionLabel: "💨 Administer 100% O₂ Now",
    },
  },
  "PROTO-MET-03": {
    code: "PROTO-MET-03",
    title: "Sleep Deprivation, Circadian Misalignment & Glycemic Dysregulation",
    refs: "V1 6001 (8.5 h) · V2 8055 · V1 4020 · V2 6079",
    shapIndicators: ["horas_sueno", "eficiencia_sueno", "glucemia", "estado_animo"],
    caution: {
      diag: "Sleep deficit (< 7.5 h) or glycemic / circadian drift.",
      dir1: "Apply circadian lighting and avoid 1–7 AM nadir.",
      dir2: "Verify nominal caloric intake and recheck capillary blood glucose (mg/dL) in 30 minutes.",
      actionType: "iluminacion_descanso",
      actionLabel: "🌙 Circadian Light + Sleep",
    },
    critical: {
      diag: "Critical glycemic dysregulation (< 54 or > 300 mg/dL) or severe sleep deprivation.",
      dir1: "Administer 15–20 g fast-acting oral glucose (if conscious hypoglycemia) or intensive hydration and transfer critical tasks.",
      dir2: "EXCEEDS SCOPE: enforce protected sleep recovery and store-and-forward.",
      exceedsScope: true,
      actionType: "glucosa_oral",
      actionLabel: "🍬 Give 15–20 g Oral Glucose",
    },
  },
  "PROTO-TERM-04": {
    code: "PROTO-TERM-04",
    title: "Core Hypothermia (< 35 °C) or Skin/Core Thermal Stress",
    refs: "Vol. 1 Appendix C · V2 6012-6014 · V2 11011",
    shapIndicators: ["temp_corporal", "frec_cardiaca", "presion_sistolica"],
    caution: {
      diag: "Skin thermal stress (Astroskin); distinguish surface variation from core temperature.",
      dir1: "Adjust cabin thermal envelope toward comfort zone.",
      dir2: "Rehydrate or insulate based on thermal gradient and recheck core/oral temperature every 10 minutes.",
      actionType: "recalentamiento",
      actionLabel: "🌡️ Stabilize Thermal Envelope",
    },
    critical: {
      diag: "Core hypothermia or critical core hyperthermia.",
      dir1: "Activate progressive rewarming (if core < 35 °C) or LCVG liquid cooling garment (hyperthermia) and cease exertion.",
      dir2: "EXCEEDS SCOPE: monitor core/oral temp, ECG, and BP every 5 min with store-and-forward.",
      exceedsScope: true,
      actionType: "recalentamiento",
      actionLabel: "🔥 Activate Rewarming / LCVG",
    },
  },
  "PROTO-COND-05": {
    code: "PROTO-COND-05",
    title: "Mood Alteration or Behavioral Stress",
    refs: "V1 3004.q · Table E.2-2 (*) · V2 5007 · V2 7071 · V1 6010",
    shapIndicators: ["estado_animo", "horas_sueno", "frec_cardiaca"],
    caution: {
      diag: "Mood decline or cognitive overload during prolonged confinement.",
      dir1: "Start asynchronous evidence-based behavioral protocol on private device.",
      dir2: "Reduce operational cognitive load and save encrypted note for deferred PPC.",
      actionType: "protocolo_conductual",
      actionLabel: "🧘 Start Behavioral Protocol",
    },
    critical: {
      diag: "Significant behavioral alteration with risk of operational overload.",
      dir1: "Start asynchronous behavioral protocol and offload critical tasks to another crew member.",
      dir2: "Reduce cognitive load and transmit encrypted private PPC record.",
      exceedsScope: false,
      actionType: "protocolo_conductual",
      actionLabel: "🧘 Behavioral Protocol + Offload",
    },
  },
  "PROTO-RAD-06": {
    code: "PROTO-RAD-06",
    title: "Free-Space Ionizing Radiation Exposure",
    refs: "V1 4033 (< 1.3 mSv/d) · V1 4031 (< 250 mSv SPE) · V1 4030 (< 600 mSv) · V2 6164",
    shapIndicators: ["radiation"],
    caution: {
      diag: "Elevated ionizing radiation rate in interplanetary transit.",
      dir1: "Check personal dosimetry and autonomous cabin radiation alarm.",
      dir2: "Prepare transition to higher-shielding zone if rate exceeds 1.30 mSv/day and log cumulative dose.",
      actionType: null,
      actionLabel: "🛡️ Review Shielding in Parameters",
    },
    critical: {
      diag: "Free-space GCR limit exceeded or SPE threshold.",
      dir1: "Move crew immediately into the solar particle event (SPE) shielded storm shelter.",
      dir2: "EXCEEDS SCOPE: log cumulative dosimetry and transmit encrypted store-and-forward packet.",
      exceedsScope: true,
      actionType: null,
      actionLabel: "🛡️ Activate SPE Shelter",
    },
  },
  "PROTO-NOM-00": {
    code: "PROTO-NOM-00",
    title: "Nominal Monitoring in Mars Transit",
    refs: "V1 3004.h · V1 6001 · V1 7001 · V2 6001",
    shapIndicators: ["frec_cardiaca", "presion_sistolica", "temp_corporal"],
    caution: {
      diag: "Physiological stability within individual baseline; no active deviations.",
      dir1: "Maintain nominal transit routine, regular hydration, and 8.5 h/day sleep target.",
      dir2: "Keep continuous ASTROSKIN/ACTIWATCH logging in encrypted EHR and periodic manual checks.",
      actionType: "protocolo_conductual",
      actionLabel: "🧘 4-4-6 Preventive Pause",
    },
    critical: {
      diag: "Nominal monitoring active.",
      dir1: "Continue continuous monitoring.",
      dir2: "No critical alerts.",
      exceedsScope: false,
      actionType: null,
      actionLabel: null,
    },
  },
};

export const SYMPTOM_PROTOCOLS = {
  "Sharp Chest Pain": [
    {
      sistema: false,
      texto:
        "Stop activity, sit or remain in a stable and comfortable position, and loosen tight clothing. Keep calm and rest; if on EVA, return to the airlock according to mission procedures.",
    },
    {
      sistema: false,
      texto: "Immediately notify the crew and Flight Surgeon, and record the onset time.",
    },
    {
      sistema: false,
      texto: "Measure and log heart rate, blood pressure, temperature, SpO₂, and blood glucose.",
    },
    {
      sistema: true,
      texto: "[SYSTEM] Log symptom and vital signs in encrypted electronic health record.",
    },
  ],
  "Oxygen Shortage": [
    {
      sistema: false,
      texto: "Stop activity and secure the crewmember in an absolute rest position.",
    },
    {
      sistema: false,
      texto: "Immediately notify the crew and Flight Surgeon, and record the onset time.",
    },
    {
      sistema: false,
      texto:
        "Measure and log heart rate and SpO₂. If Heart Rate shows arrhythmias or extreme tachycardia/bradycardia impairing effective pumping: administer supplemental oxygen via life-support masks, ensure absolute rest, and monitor pulse telemetry.",
    },
    {
      sistema: true,
      texto: "[SYSTEM] Log symptom and pulse/SpO₂ telemetry in encrypted electronic health record.",
    },
  ],
  Dizziness: [
    {
      sistema: false,
      texto: "Stop activity and immobilize the crewmember in a neutral, stable position to prevent impacts in microgravity.",
    },
    {
      sistema: false,
      texto: "Immediately notify the crew and Flight Surgeon, and record the onset time.",
    },
    {
      sistema: false,
      texto: "Measure and log blood pressure, blood glucose, and heart rate.",
    },
    {
      sistema: false,
      texto:
        "Blood Pressure (fluid shift / space orthostatic hypotension): apply Lower Body Negative Pressure (LBNP) or leg compression garments to redistribute fluids.",
    },
    {
      sistema: false,
      texto:
        "Blood Glucose (hypoglycemia): administer fast-acting glucose or carbohydrates (space gel or paste) only if the crewmember is conscious and able to swallow.",
    },
    {
      sistema: false,
      texto:
        "Heart Rate (drop in cardiac output from rhythm changes): keep immobilized in absolute rest to reduce cardiac demand and monitor pulse telemetry.",
    },
    {
      sistema: true,
      texto: "[SYSTEM] Log symptom and hemodynamic/glycemic readings in encrypted electronic health record.",
    },
  ],
  "Blurred Vision": [
    {
      sistema: false,
      texto:
        "Stop any visually demanding or precision activity, and secure the crewmember to assess their level of consciousness.",
    },
    {
      sistema: false,
      texto: "Immediately notify the crew and Flight Surgeon, and record the onset time.",
    },
    {
      sistema: false,
      texto: "Measure and log blood pressure and blood glucose.",
    },
    {
      sistema: false,
      texto:
        "Blood Pressure (SANS / elevated intracranial and intraocular pressure from headward fluid accumulation): use Lower Body Negative Pressure (LBNP) devices on lower extremities to draw fluids down and relieve head pressure.",
    },
    {
      sistema: false,
      texto:
        "Blood Glucose (hypoglycemia impairing the central nervous system): immediately administer fast-acting carbohydrates, strictly verifying that consciousness is not altered (choking risk).",
    },
    {
      sistema: true,
      texto: "[SYSTEM] Log symptom and ocular/pressure assessment in encrypted electronic health record.",
    },
  ],
};

export const PARAM_ORDER = ["bp", "hr", "glucose", "temp", "sleep", "mood", "radiation", "spo2"];
export const PRIMARY_METRICS = ["hr", "bp", "temp", "radiation"];
export const SECONDARY_METRICS = ["glucose", "sleep", "mood", "pvt"];

export const METRIC_META = {
  bp: {
    key: "bp",
    backendVar: "presion_sistolica",
    label: "Blood Pressure",
    fullLabel: "Blood Pressure",
    unit: "mmHg",
    step: 5,
    source: "Astroskin (est.) / cuff",
    format: (m) => `${Math.round(m.bpSys)}/${Math.round(m.bpDia)}`,
  },
  hr: {
    key: "hr",
    backendVar: "frec_cardiaca",
    label: "Heart Rate",
    fullLabel: "Heart Rate",
    unit: "bpm",
    step: 6,
    source: "Astroskin (pulse / ECG)",
    format: (m) => `${Math.round(m.hr)}`,
  },
  glucose: {
    key: "glucose",
    backendVar: "glucemia",
    label: "Blood Glucose",
    fullLabel: "Blood Glucose",
    unit: "mg/dL",
    step: 8,
    source: "Glucometer / Manual",
    format: (m) => `${Math.round(m.glucose)}`,
  },
  temp: {
    key: "temp",
    backendVar: "temp_corporal",
    label: "Skin / Core Temp.",
    fullLabel: "Body Temperature",
    unit: "°C",
    step: 0.4,
    source: "Astroskin (skin) + core model",
    format: (m) => Number(m.temp).toFixed(1),
  },
  sleep: {
    key: "sleep",
    backendVar: "horas_sueno",
    label: "Sleep Hours",
    fullLabel: "Daily Sleep Hours",
    unit: "h",
    step: 0.4,
    source: "Actiwatch Spectrum (8.5 h goal)",
    format: (m) => Number(m.sleep).toFixed(1),
  },
  mood: {
    key: "mood",
    backendVar: "estado_animo",
    label: "Mood State",
    fullLabel: "Mood State",
    unit: "%",
    step: 0.5,
    source: "Multimodal self-report",
    format: (m) => `${Math.round(m.moodPct)}`,
  },
  radiation: {
    key: "radiation",
    backendVar: "radiation_rate",
    label: "Cumulative Radiation",
    fullLabel: "Ionizing Radiation",
    unit: "mSv/d",
    quickUnit: "mSv",
    step: 0.12,
    source: "Free-space dosimetry",
    format: (m) => Number(m.radiation).toFixed(2),
    quickFormat: (m) => Number(m.radiationTotal).toFixed(1),
  },
  pvt: {
    key: "pvt",
    backendVar: "pvt_ms",
    label: "Reflexes (PVT)",
    fullLabel: "PVT Test (Reflexes)",
    unit: "ms",
    step: null,
    source: "Psychomotor Vigilance Task",
    format: (m) => `${Math.round(m.pvt)}`,
  },
  spo2: {
    key: "spo2",
    backendVar: "spo2",
    label: "SpO₂ (Astroskin)",
    fullLabel: "SpO₂ (Astroskin)",
    unit: "%",
    step: 1,
    source: "Astroskin Pulse Oximetry",
    format: (m) => Number(m.spo2).toFixed(1),
  },
};

export function extractUiMetrics(data) {
  const lec = data?.lectura || {};
  const ext = data?.extras || {};
  const res = data?.resultado || {};
  const bpSys = Number(lec.presion_sistolica ?? 118);
  const bpDia = Number(ext.bp_diastolic ?? 76);
  const hr = Number(lec.frec_cardiaca ?? 68);
  const glucose = Number(lec.glucemia ?? 96);
  const temp = Number(lec.temp_corporal ?? 36.2);
  const tempCentral = Number(res.temp_central_est ?? temp + 0.65);
  const sleep = Number(lec.horas_sueno ?? 8.4);
  const moodScore = Number(lec.estado_animo ?? 8.2);
  const moodPct = Math.round((moodScore / 10) * 100);
  const radiation = Number(ext.radiation_rate ?? 0.84);
  const radiationTotal = Number(ext.radiation_total ?? 156.2);
  const pvt = Number(ext.pvt_ms ?? 238);
  const spo2 = Number(lec.spo2 ?? 98.4);
  const ecg = Number(lec.anomalia_ecg ?? 0.04);

  return {
    bpSys,
    bpDia,
    hr,
    glucose,
    temp,
    tempCentral,
    sleep,
    moodScore,
    moodPct,
    radiation,
    radiationTotal,
    pvt,
    spo2,
    ecg,
  };
}

export function getTrendArrow(key, m) {
  if (key === "hr") {
    if (m.hr > 95) return "up";
    if (m.hr < 55) return "down";
  } else if (key === "bp") {
    if (m.bpSys > 125) return "up";
    if (m.bpSys < 105) return "down";
  } else if (key === "glucose") {
    if (m.glucose > 140) return "up";
    if (m.glucose < 70) return "down";
  } else if (key === "temp") {
    if (m.temp > 36.9 || m.tempCentral > 37.8) return "up";
    if (m.temp < 35.6 || m.tempCentral < 35.5) return "down";
  } else if (key === "sleep") {
    if (m.sleep < 7.5) return "down";
    if (m.sleep > 9.5) return "up";
  } else if (key === "mood") {
    if (m.moodScore < 6.5) return "down";
  } else if (key === "radiation") {
    if (m.radiation >= 0.96 || m.radiationTotal >= 250) return "up";
  } else if (key === "pvt") {
    if (m.pvt >= 265) return "up";
  }
  return null;
}

export function evaluateIndicator(key, m, options = {}) {
  const { emergencyManual = false, staleManual = false, blinkPaused = false } = options;
  let levelKey = "nominal";
  let label = "✓ NOMINAL";

  if (staleManual && (key === "glucose" || key === "mood")) {
    return {...NASA_LEVELS.stale, label: "⏱ STALE DATA" };
  }

  if (key === "bp") {
    if (emergencyManual || m.bpSys >= 180 || m.bpSys < 80) {
      levelKey = "emergency";
      label = "⚡ EMERGENCY";
    } else if (m.bpSys > 145) {
      levelKey = "warning";
      label = "▲ WARNING";
    } else if (m.bpSys < 90) {
      levelKey = "warning";
      label = "▼ WARNING";
    } else if (m.bpSys > 125) {
      levelKey = "caution";
      label = "▲ CAUTION";
    } else if (m.bpSys < 105) {
      levelKey = "caution";
      label = "▼ CAUTION";
    }
  } else if (key === "hr") {
    if (emergencyManual || m.hr > 150 || m.hr < 40 || (m.hr > 140 && m.ecg > 0.25)) {
      levelKey = "emergency";
      label = "⚡ EMERGENCY";
    } else if (m.hr > 130) {
      levelKey = "warning";
      label = "▲ WARNING";
    } else if (m.hr < 45) {
      levelKey = "warning";
      label = "▼ WARNING";
    } else if (m.hr > 95) {
      levelKey = "caution";
      label = "▲ CAUTION";
    } else if (m.hr < 55) {
      levelKey = "caution";
      label = "▼ CAUTION";
    } else if (m.hr > 88) {
      levelKey = "advisory";
      label = "▲ ADVISORY";
    }
  } else if (key === "glucose") {
    if (m.glucose > 300 || m.glucose < 54) {
      levelKey = "emergency";
      label = "⚡ EMERGENCY";
    } else if (m.glucose > 200) {
      levelKey = "warning";
      label = "▲ WARNING";
    } else if (m.glucose < 55) {
      levelKey = "warning";
      label = "▼ WARNING";
    } else if (m.glucose > 140) {
      levelKey = "caution";
      label = "▲ CAUTION";
    } else if (m.glucose < 70) {
      levelKey = "caution";
      label = "▼ CAUTION";
    }
  } else if (key === "temp") {
    if (m.tempCentral < 35.0 || m.tempCentral > 38.6) {
      levelKey = "emergency";
      label = "⚡ EMERGENCY";
    } else if (m.temp < 34.8) {
      levelKey = "warning";
      label = "▼ WARNING";
    } else if (m.temp > 37.6) {
      levelKey = "warning";
      label = "▲ WARNING";
    } else if (m.temp < 35.6) {
      levelKey = "caution";
      label = "▼ CAUTION";
    } else if (m.temp > 36.9) {
      levelKey = "caution";
      label = "▲ CAUTION";
    }
  } else if (key === "sleep") {
    if (m.sleep < 6.0) {
      levelKey = "warning";
      label = "▼ WARNING";
    } else if (m.sleep < 7.5) {
      levelKey = "caution";
      label = "▼ CAUTION";
    } else if (m.sleep > 9.5) {
      levelKey = "advisory";
      label = "▲ ADVISORY";
    }
  } else if (key === "mood") {
    if (m.moodScore < 4.5) {
      levelKey = "warning";
      label = "▼ WARNING";
    } else if (m.moodScore < 6.5) {
      levelKey = "caution";
      label = "▼ CAUTION";
    } else if (m.moodScore < 7.2) {
      levelKey = "advisory";
      label = "▼ ADVISORY";
    }
  } else if (key === "radiation") {
    if (m.radiation >= 2.0 || m.radiationTotal >= 250) {
      levelKey = "emergency";
      label = "⚡ EMERGENCY";
    } else if (m.radiation >= 1.3) {
      levelKey = "warning";
      label = "▲ WARNING";
    } else if (m.radiation >= 1.1) {
      levelKey = "caution";
      label = "▲ CAUTION";
    } else if (m.radiation >= 0.96) {
      levelKey = "advisory";
      label = "▲ ADVISORY";
    }
  } else if (key === "pvt") {
    if (m.pvt >= 380) {
      levelKey = "warning";
      label = "▲ WARNING";
    } else if (m.pvt >= 300) {
      levelKey = "caution";
      label = "▲ CAUTION";
    } else if (m.pvt >= 265) {
      levelKey = "advisory";
      label = "▲ ADVISORY";
    }
  } else if (key === "spo2") {
    if (m.spo2 < 90) {
      levelKey = "emergency";
      label = "⚡ EMERGENCY";
    } else if (m.spo2 < 92) {
      levelKey = "warning";
      label = "▼ WARNING";
    } else if (m.spo2 < 96) {
      levelKey = "caution";
      label = "▼ CAUTION";
    }
  }

  const base = NASA_LEVELS[levelKey];
  return {
...base,
    label,
    blink: base.blink && !blinkPaused,
  };
}

export function pickHighestSeverity(list) {
  const valid = (list || []).filter(Boolean);
  if (valid.length === 0) return NASA_LEVELS.nominal;
  return valid.reduce((acc, cur) => (cur.severity > acc.severity ? cur : acc), valid[0]);
}

export function getAllIndicatorStates(m, options = {}) {
  const states = {};
  PARAM_ORDER.forEach((key) => {
    states[key] = evaluateIndicator(key, m, options);
  });
  if (!states.pvt) {
    states.pvt = evaluateIndicator("pvt", m, options);
  }
  return states;
}

export const SUMMARY_THREE_METRICS = ["hr", "bp", "glucose"];

export function getSpecificFirstAidRecommendation(key, m) {
  if (key === "hr") {
    if (m.hr > 95 || m.ecg > 0.25 || m.spo2 < 95) {
      return {
        symptom: "Oxygen Shortage / Dizziness",
        cause:
          "Heart rate alterations (arrhythmias or extreme tachycardia/bradycardia) impair effective pumping, reducing tissue oxygenation and cerebral blood flow.",
        recommendation:
          "Administer supplemental oxygen via life-support masks, keep the crewmember immobilized in absolute rest to reduce cardiac demand, and monitor pulse telemetry.",
      };
    }
    return {
      symptom: "Dizziness",
      cause:
        "Drop in cardiac output from rhythm alterations, momentarily reducing blood flow to the brain.",
      recommendation:
        "Keep the individual immobilized and in absolute rest to reduce cardiac demand; monitor pulse telemetry continuously.",
    };
  }

  if (key === "bp") {
    if (m.bpSys >= 180) {
      return {
        symptom: "Severe Hypertension (180/120+)",
        cause:
          "Critical arterial blood pressure spike in microgravity; elevated risk of acute cardiovascular event.",
        recommendation:
          "Wait 5 minutes and re-measure. If accompanied by chest pain, do not wait: treat immediately as an emergency.",
      };
    }
    if (m.bpSys >= 130) {
      return {
        symptom: "Blurred Vision (SANS)",
        cause:
          "Fluid accumulation in the head increases intracranial and intraocular pressure, affecting the optic nerve and globe shape (SANS).",
        recommendation:
          "Use lower body negative pressure (LBNP) devices on the lower extremities to draw fluids downward and relieve head pressure.",
      };
    }
    return {
      symptom: "Dizziness",
      cause:
        "Upward body fluid shift and blood pressure fluctuations (space orthostatic hypotension).",
      recommendation:
        "Immobilize in a neutral position. Apply lower body negative pressure (LBNP) or use leg compression garments to redistribute fluids.",
    };
  }

  if (key === "glucose") {
    if (m.glucose < 70) {
      return {
        symptom: "Dizziness / Blurred Vision",
        cause:
          "Drop in blood glucose (hypoglycemia) deprives the brain and central nervous system of their primary energy source, impairing visual processing and ocular muscles.",
        recommendation:
          "Immediately administer fast-acting glucose or carbohydrates (space gel or paste), verifying the crewmember is conscious and able to swallow safely (choking risk).",
      };
    }
    return {
      symptom: "Blurred Vision / Glycemic Drift",
      cause:
        "Elevated blood glucose and metabolic dysregulation in microgravity impair visual processing and energy stability.",
      recommendation:
        "Ensure adequate hydration, review recent caloric/medication intake, and recheck capillary blood glucose in 30 minutes.",
    };
  }

  if (key === "spo2") {
    return {
      symptom: "Oxygen Shortage / Hypoxia",
      cause:
        "Reduced blood oxygen saturation (SpO₂) from cabin atmosphere imbalance (low P_I O₂ / elevated CO₂) or impaired pulmonary gas exchange.",
      recommendation:
        "Administer 100% supplemental oxygen via life-support mask, halt physical exertion, and verify cabin O₂ / CO₂ scrubbers.",
    };
  }

  if (key === "temp") {
    if (m.tempCentral < 35.0 || m.temp < 35.6) {
      return {
        symptom: "Hypothermia / Cold Stress",
        cause:
          "Drop in core/skin temperature in microgravity impairs metabolic efficiency, thermoregulation, and cognitive alertness.",
        recommendation:
          "Confirm with oral/core thermometer, apply progressive thermal rewarming and insulation, and raise cabin temperature to 22–25 °C.",
      };
    }
    return {
      symptom: "Hyperthermia / Heat Stress",
      cause:
        "Elevated skin/core temperature due to reduced convective cooling in microgravity or high metabolic workload.",
      recommendation:
        "Activate liquid cooling garment (LCVG), cease strenuous activity, hydrate with 500 ml electrolytes, and cool cabin envelope.",
    };
  }

  if (key === "sleep") {
    return {
      symptom: "Cumulative Sleep Deprivation / Fatigue",
      cause:
        "Circadian misalignment in spaceflight reduces restorative sleep below the 8.5 h target, degrading reaction speed and glycemic control.",
      recommendation:
        "Enforce a protected dark/quiet rest block, apply circadian lighting, and defer safety-critical operations.",
    };
  }

  if (key === "mood") {
    return {
      symptom: "Behavioral / Mood Alteration",
      cause:
        "Isolation, confinement, and workload stress in long-duration transit elevate cognitive fatigue and emotional strain.",
      recommendation:
        "Reduce operational cognitive load, run a 4-4-6 guided breathing session, and log a private note for deferred psychological support.",
    };
  }

  if (key === "radiation") {
    return {
      symptom: "Elevated Ionizing Radiation Exposure",
      cause:
        "Increased galactic cosmic ray (GCR) flux or solar particle event (SPE) in interplanetary transit.",
      recommendation:
        "Verify personal dosimetry, relocate to the shielded storm shelter if SPE alert triggers, and log cumulative dose.",
    };
  }

  if (key === "pvt") {
    return {
      symptom: "Psychomotor Slowing / Attention Lapses",
      cause:
        "Neurocognitive fatigue or sleep debt slowing reaction time (≥ 265 ms) and increasing micro-lapses.",
      recommendation:
        "Pause high-precision tasks, schedule restorative sleep/rest, and repeat PVT-B after recovery.",
    };
  }

  return {
    symptom: "Physiological Deviation",
    cause: "Parameter outside nominal microgravity baseline.",
    recommendation: "Rest in neutral posture, hydrate, and monitor telemetry.",
  };
}

export function getQuickMetricPlan(m, states) {
  const slots = [...PRIMARY_METRICS];
  const abnormalOthers = SECONDARY_METRICS.map((key) => ({ key, state: states[key] }))
.filter((item) => item.state.severity > 0)
.sort(
      (a, b) =>
        b.state.severity - a.state.severity ||
        SECONDARY_METRICS.indexOf(a.key) - SECONDARY_METRICS.indexOf(b.key)
    );

  const replacements = [];
  abnormalOthers.forEach((item) => {
    let target = -1;
    for (let i = slots.length - 1; i >= 0; i -= 1) {
      const current = slots[i];
      if (!PRIMARY_METRICS.includes(current)) continue;
      if (states[current].severity > 0) continue;
      target = i;
      break;
    }
    if (target >= 0) {
      replacements.push({ from: slots[target], to: item.key, index: target });
      slots[target] = item.key;
    }
  });

  return { slots, replacements };
}

export function buildAlertSystemFeed(data) {
  if (!data) return { items: [], primaryBanner: null, activeCount: 0, overallState: NASA_LEVELS.nominal };

  const m = extractUiMetrics(data);
  const ui = data.ui_state || {};
  const cabin = data.cabin_env || {};
  const res = data.resultado || {};
  const inhibited = new Set(ui.alertas_inhibidas || []);
  const options = {
    emergencyManual: Boolean(ui.emergencia_manual),
    staleManual: Boolean(ui.datos_manuales_obsoletos),
    blinkPaused: Boolean(ui.parpadeo_detenido),
  };

  const states = getAllIndicatorStates(m, options);
  const items = [];

  const checks = [
    {
      key: "hr",
      proto: "PROTO-CV-01",
      title: `Heart Rate (${Math.round(m.hr)} bpm)`,
      desc: "Heart rate outside operational band (55–95 bpm). Check chest symptoms and Astroskin ECG.",
    },
    {
      key: "bp",
      proto: "PROTO-CV-01",
      title: `Blood Pressure (${Math.round(m.bpSys)}/${Math.round(m.bpDia)} mmHg)`,
      desc: "Hemodynamic deviation.",
    },
    {
      key: "temp",
      proto: "PROTO-TERM-04",
      title: `Temperature (Skin ${m.temp.toFixed(1)} °C · Est. Core ${m.tempCentral.toFixed(2)} °C)`,
      desc:
        m.tempCentral < 35.0
          ? "Estimated core hypothermia < 35.0 °C. Confirm via oral/core thermometry."
: "Skin vs. core thermal drift. Adjust cabin to 20–25 °C.",
    },
    {
      key: "glucose",
      proto: "PROTO-MET-03",
      title: `Blood Glucose (${Math.round(m.glucose)} mg/dL)`,
      desc: ui.datos_manuales_obsoletos
        ? "Stale manual entry. Update capillary blood glucose (mg/dL)."
: "Glycemic dysregulation.",
    },
    {
      key: "sleep",
      proto: "PROTO-MET-03",
      title: `Sleep Hours (${m.sleep.toFixed(1)} h)`,
      desc: "Deficit vs. 8.5 h/day baseline. Avoid critical tasks during 1–7 AM circadian nadir.",
    },
    {
      key: "mood",
      proto: "PROTO-COND-05",
      title: `Mood State (${Math.round(m.moodPct)}% · ${m.moodScore.toFixed(1)}/10)`,
      desc: ui.datos_manuales_obsoletos
        ? "Outdated self-report. Complete behavioral check-in."
: "Affective/behavioral decline.",
    },
    {
      key: "radiation",
      proto: "PROTO-RAD-06",
      title: `Ionizing Radiation (${m.radiation.toFixed(2)} mSv/d · ${m.radiationTotal.toFixed(1)} mSv total)`,
      desc: "Free-space monitoring: GCR limit < 1.3 mSv/d and SPE < 250 mSv.",
    },
    {
      key: "pvt",
      proto: "PROTO-MET-03",
      title: `PVT Reflexes (${Math.round(m.pvt)} ms)`,
      desc: "Reaction time above nominal threshold (< 265 ms); correlate with fatigue/sleep.",
    },
  ];

  checks.forEach((c) => {
    const st = states[c.key];
    if (st.severity > 0) {
      const protoEntry = PROTOCOL_DICTIONARY[c.proto];
      const tier = st.severity >= 3 ? protoEntry.critical: protoEntry.caution;
      items.push({
        id: `param-${c.key}`,
        metricKey: c.key,
        category: st.key === "stale" ? "reminder": "alert",
        protoCode: c.proto,
        state: st,
        inhibited: inhibited.has(c.key),
        title: c.title,
        desc: c.desc,
        recommendation: tier.dir1,
        followUp: tier.dir2,
        exceedsScope: Boolean(tier.exceedsScope),
      });
    }
  });

  const piO2 = Number(cabin.pi_o2_mmhg ?? 150);
  const ppCo2 = Number(cabin.ppco2_mmhg ?? 1.8);
  let respState = null;
  if (m.spo2 < 90 || piO2 < 122 || ppCo2 > 5.3) {
    respState = {...NASA_LEVELS.emergency, label: "⚡ EMERGENCY", blink: !ui.parpadeo_detenido };
  } else if (m.spo2 < 92 || piO2 < 127 || ppCo2 > 4.0) {
    respState = {...NASA_LEVELS.warning, label: "▲ WARNING" };
  } else if (m.spo2 < 96 || piO2 < 145 || ppCo2 > 3.0) {
    respState = {...NASA_LEVELS.caution, label: "▲ CAUTION" };
  }
  if (respState) {
    const protoEntry = PROTOCOL_DICTIONARY["PROTO-RESP-02"];
    const tier = respState.severity >= 3 ? protoEntry.critical: protoEntry.caution;
    items.push({
      id: "cabin-resp",
      metricKey: "spo2",
      category: "alert",
      protoCode: "PROTO-RESP-02",
      state: respState,
      inhibited: inhibited.has("spo2"),
      title: `Respiratory / Cabin (SpO₂ ${m.spo2.toFixed(1)}% · P_I O₂ ${piO2.toFixed(1)} · ppCO₂ ${ppCo2.toFixed(2)} mmHg)`,
      desc: "Oxygenation or CO₂ scrubbing deviation in pressurized cabin.",
      recommendation: tier.dir1,
      followUp: tier.dir2,
      exceedsScope: Boolean(tier.exceedsScope),
    });
  }

  items.push({
    id: "rem-store-forward",
    metricKey: null,
    category: "reminder",
    protoCode: res.protocolo_codigo || "PROTO-NOM-00",
    state: {...NASA_LEVELS.advisory, label: "▼ REMINDER" },
    inhibited: false,
    title: "Store-and-Forward Sync (20 min one-way latency)",
    desc: "Encrypted biometric record ready for deferred Earth–Mars transmission.",
    recommendation: "Do not wait for live Earth confirmation during acute events.",
    followUp: "Verify manual blood glucose (mg/dL) and mood check-in.",
    exceedsScope: false,
  });

  items.push({
    id: "suggestion-circadian",
    category: "suggestion",
    protoCode: "PROTO-NOM-00",
    metricKey: null,
    state: { ...NASA_LEVELS.nominal, label: "✓ SUGGESTION" },
    inhibited: false,
    title: "Circadian Hygiene & Hydration",
    desc: "Maintain ≥ 250 melanopic EDI lux awake, ≤ 0.02 lux during sleep, and 8.5 h sleep.",
    recommendation: "Run 4-4-6 preventive breathing pause if Bedford workload > 3.",
    followUp: "Continue continuous ASTROSKIN / ACTIWATCH logging.",
    exceedsScope: false,
  });

  const activeAlerts = items
.filter((i) => (i.category === "alert" || i.state.key === "stale") && !i.inhibited)
.sort((a, b) => b.state.severity - a.state.severity);

  const backendKey = mapBackendLevelToKey(res.nivel_nasa, Boolean(ui.datos_manuales_obsoletos));
  const backendState = {
...NASA_LEVELS[backendKey],
    blink: NASA_LEVELS[backendKey].blink && !ui.parpadeo_detenido,
  };
  const topActiveState = activeAlerts.length > 0 ? activeAlerts[0].state: NASA_LEVELS.nominal;
  const overallState =
    backendState.severity >= topActiveState.severity ? backendState: topActiveState;

  let activeProtoCode = res.protocolo_codigo || "PROTO-NOM-00";
  if (activeProtoCode === "PROTO-NOM-00" && activeAlerts.length > 0) {
    activeProtoCode = activeAlerts[0].protoCode;
  }
  const protoDict = PROTOCOL_DICTIONARY[activeProtoCode] || PROTOCOL_DICTIONARY["PROTO-NOM-00"];
  const isCriticalTier = overallState.severity >= 3 || Boolean(res.excede_alcance);
  const tierDict = isCriticalTier ? protoDict.critical: protoDict.caution;

  const cleanBackendDiag = (res.diagnostico || "")
.replace(/^\[(ALERTA|ALERT):[^\]]+\]\s*/i, "")
.trim();

  const shapTop = (res.top3_shap || [])
.slice(0, 3)
.map((s) => `${s.variable}=${s.valor}${s.unidad ? ` ${s.unidad}`: ""}`)
.join(" · ");

  const line1 =
    overallState.severity === 0
      ? tierDict.diag
: cleanBackendDiag && activeProtoCode === res.protocolo_codigo
      ? cleanBackendDiag
: tierDict.diag;

  const line2 =
    res.directivas?.[0] && activeProtoCode === res.protocolo_codigo && overallState.severity > 0
      ? res.directivas[0]
: tierDict.dir1;

  const line3 =
    res.directivas?.[1] && activeProtoCode === res.protocolo_codigo && overallState.severity > 0
      ? res.directivas[1]
: tierDict.dir2;

  const primaryBanner = {
    overallState,
    protoCode: activeProtoCode,
    protoTitle: protoDict.title,
    protoRefs: protoDict.refs,
    exceedsScope: Boolean(res.excede_alcance) || Boolean(tierDict.exceedsScope),
    line1,
    line2,
    line3,
    shapSummary: shapTop,
    actionType: tierDict.actionType,
    actionLabel: tierDict.actionLabel,
    activeAlerts,
  };

  return {
    items,
    primaryBanner,
    activeCount: activeAlerts.length,
    overallState,
    states,
  };
}
