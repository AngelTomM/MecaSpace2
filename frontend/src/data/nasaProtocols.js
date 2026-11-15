/**
 * Diccionario operativo basado estrictamente en:
 * - protocolos_medicos_nasa.md (PROTO-CV-01 a PROTO-COND-05)
 * - guia-fuentes-anclaje-marte.md (NASA-STD-3001 Vol. 1 Rev. C y Vol. 2 Rev. E)
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
    label: "⏱ DATO CIAN",
    shortLabel: "DATO OBSOLETO",
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
    label: "▼ AVISO",
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
    label: "▲ PRECAUCIÓN",
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
    label: "▲ ALERTA",
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
    label: "⚡ EMERGENCIA",
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

/**
 * Diccionario clínico-operativo derivado de `protocolos_medicos_nasa.md`
 */
export const PROTOCOL_DICTIONARY = {
  "PROTO-CV-01": {
    code: "PROTO-CV-01",
    title: "Evento Cardiovascular Agudo, Dolor Torácico o Colapso",
    refs: "Tabla E.2-2 · Consigna · V1 3004.i · V1 5001-5003 · V2 10178",
    shapIndicators: ["frec_cardiaca", "anomalia_ecg", "presion_sistolica", "spo2"],
    caution: {
      diag: "Sobrecarga cardiovascular moderada sobre línea base (Astroskin).",
      dir1: "Reducir carga operativa en 50 % y adoptar reposo neutro con hidratación electrolítica (V2 7042).",
      dir2: "Vigilar tendencia de presión arterial, pulso y ECG continuo cada 5 minutos (V1 3004.h).",
      actionType: "reposo_cv",
      actionLabel: "🛌 Reposo + Hidratación (V2 7042)",
    },
    critical: {
      diag: "Evento cardiovascular agudo o sobrecarga crítica en tránsito.",
      dir1: "Activar respuesta de emergencia (V2 10178), asegurar vía aérea, iniciar RCP/DEA si hay colapso (V1 5001-5002) y suspender maniobras críticas.",
      dir2: "EXCEDE ALCANCE (V2 10171): escalar al CMO (V1 3006) para ECG 3-derivaciones + ecografía a bordo (V1 3004.i, V1 5003) y paquete store-and-forward (V1 6002, V2 10125).",
      exceedsScope: true,
      actionType: "rcp_dea",
      actionLabel: "⚡ Ejecutar RCP / DEA y Estabilizar",
    },
  },
  "PROTO-RESP-02": {
    code: "PROTO-RESP-02",
    title: "Hipoxia o Hipercapnia en Cabina Presurizada",
    refs: "V2 6003 · V2 6004 · Tabla 6.2-1 · V1 3004.i",
    shapIndicators: ["spo2", "frec_respiratoria", "vol_respiratorio"],
    caution: {
      diag: "Hipoxia o hipercapnia incipiente en cabina presurizada.",
      dir1: "Ejecutar 5 minutos de respiración diafragmática controlada y suspender esfuerzo físico (V2 10200).",
      dir2: "Auditar presión parcial de oxígeno (P_I O₂ 145–155 mmHg) y depuración de CO₂ (ppCO₂ ≤ 3 mmHg) en cabina (V2 6003-6004).",
      actionType: "oxigeno_100",
      actionLabel: "💨 Aplicar O₂ 100 % y Auditar ECLSS",
    },
    critical: {
      diag: "Compromiso respiratorio o fallo atmosférico severo (SpO₂ < 90 % / P_I O₂ bajo).",
      dir1: "Colocar oxígeno suplementario al 100 % inmediato, detener actividad física y aislar posible fuga o fallo ECLSS.",
      dir2: "EXCEDE ALCANCE (V2 10171): escalar a evaluación pulmonar por ecografía a bordo (V1 3004.i) y enviar registro store-and-forward (V1 6002).",
      exceedsScope: true,
      actionType: "oxigeno_100",
      actionLabel: "💨 Suministrar O₂ al 100 % Inmediato",
    },
  },
  "PROTO-MET-03": {
    code: "PROTO-MET-03",
    title: "Privación de Sueño, Desalineación Circadiana y Desregulación Glucémica",
    refs: "V1 6001 (8,5 h) · V2 8055 · V1 4020 · V2 6079 (NC-40)",
    shapIndicators: ["horas_sueno", "eficiencia_sueno", "glucemia", "estado_animo"],
    caution: {
      diag: "Déficit de sueño (< 7,5 h) o deriva glucémica / circadiana (V2 8055).",
      dir1: "Aplicar iluminación circadiana (≥ 250 lux melanópico EDI vigilia / 8 ± 2 lux pre-sueño, V2 8055) y evitar nadir 1–7 AM.",
      dir2: "Verificar ingesta calórica nominal (V1 4020) y repetir control de glucemia capilar (mg/dL) en 30 minutos.",
      actionType: "iluminacion_descanso",
      actionLabel: "🌙 Activar Luz Circadiana + Sueño",
    },
    critical: {
      diag: "Desregulación glucémica crítica (< 54 o > 300 mg/dL) o privación severa de sueño.",
      dir1: "Administrar 15–20 g de glucosa oral rápida (si hipoglucemia consciente) o hidratación intensiva y transferir tareas críticas.",
      dir2: "EXCEDE ALCANCE (V2 10171): cumplir recuperación protegida (≤ 0,02 lux, NC-40 V2 6079, < 0,1 m/s² V2 6092) y envío store-and-forward (V1 6002).",
      exceedsScope: true,
      actionType: "glucosa_oral",
      actionLabel: "🍬 Administrar 15–20 g Glucosa Oral",
    },
  },
  "PROTO-TERM-04": {
    code: "PROTO-TERM-04",
    title: "Hipotermia Central (< 35 °C) o Estrés Térmico Cutáneo/Central",
    refs: "Vol. 1 Apéndice C · V2 6012-6014 · V2 11011",
    shapIndicators: ["temp_corporal", "frec_cardiaca", "presion_sistolica"],
    caution: {
      diag: "Estrés térmico cutáneo (Astroskin); distinguir variación superficial de temperatura central (V2 11011).",
      dir1: "Ajustar envolvente térmica de cabina hacia confort (20–25 °C, 30–60 % HR, Fig. 6.2-2, V2 6012).",
      dir2: "Rehidratar o abrigar según gradiente térmico y reevaluar temperatura central/oral cada 10 minutos.",
      actionType: "recalentamiento",
      actionLabel: "🌡️ Estabilizar Envolvente Térmica",
    },
    critical: {
      diag: "Hipotermia central (< 35,0 °C Vol. 1 Apéndice C) o hipertermia central crítica.",
      dir1: "Activar recalentamiento activo progresivo (si < 35 °C central) o prenda de enfriamiento líquido LCVG (hipertermia) y cesar esfuerzo.",
      dir2: "EXCEDE ALCANCE (V2 10171): monitorizar temp. central/oral, ECG (V1 3004.i) y PA cada 5 min con envío store-and-forward (V1 6002).",
      exceedsScope: true,
      actionType: "recalentamiento",
      actionLabel: "🔥 Activar Recalentamiento / LCVG",
    },
  },
  "PROTO-COND-05": {
    code: "PROTO-COND-05",
    title: "Alteración del Estado de Ánimo o Estrés Conductual",
    refs: "V1 3004.q · Tabla E.2-2 (*) · V2 5007 · V2 7071 · V1 6010",
    shapIndicators: ["estado_animo", "horas_sueno", "frec_cardiaca"],
    caution: {
      diag: "Descenso de estado de ánimo o sobrecarga cognitiva en confinamiento prolongado.",
      dir1: "Iniciar protocolo conductual asíncrono basado en evidencia en dispositivo privado (V1 3004.q, privacidad V2 7071).",
      dir2: "Reducir carga cognitiva operativa (Bedford ≤ 3, V2 5007) y guardar nota privada cifrada para PPC diferida (V1 6010).",
      actionType: "protocolo_conductual",
      actionLabel: "🧘 Iniciar Protocolo Conductual",
    },
    critical: {
      diag: "Alteración conductual relevante con riesgo de sobrecarga operativa.",
      dir1: "Iniciar protocolo conductual asíncrono (V1 3004.q) y descargar tareas críticas a otro tripulante.",
      dir2: "Reducir carga cognitiva (Bedford ≤ 6 en degradado, V2 5007) y transmitir registro privado cifrado PPC (V1 6010, store-and-forward).",
      exceedsScope: false,
      actionType: "protocolo_conductual",
      actionLabel: "🧘 Protocolo Conductual + Descarga",
    },
  },
  "PROTO-RAD-06": {
    code: "PROTO-RAD-06",
    title: "Exposición a Radiación Ionizante en Espacio Libre",
    refs: "V1 4033 (< 1,3 mSv/d) · V1 4031 (< 250 mSv SPE) · V1 4030 (< 600 mSv) · V2 6164",
    shapIndicators: ["radiation"],
    caution: {
      diag: "Tasa de radiación ionizante elevada en tránsito interplanetario (ref. V1 4033 < 1,3 mSv/d).",
      dir1: "Verificar dosimetría personal y alerta autónoma de radiación en cabina (V2 6164).",
      dir2: "Preparar transición hacia zona de mayor blindaje si la tasa supera 1,30 mSv/día y registrar dosis acumulada.",
      actionType: null,
      actionLabel: "🛡️ Revisar Blindaje en Parámetros",
    },
    critical: {
      diag: "Exceso del límite GCR espacio libre (≥ 1,3 mSv/d V1 4033) o umbral SPE (V1 4031).",
      dir1: "Refugiar de inmediato a la tripulación en el compartimento blindado contra eventos de partículas solares (SPE).",
      dir2: "EXCEDE ALCANCE (V2 10171): registrar dosimetría acumulada (V1 4030/4031) y transmitir paquete cifrado store-and-forward (V1 6002).",
      exceedsScope: true,
      actionType: null,
      actionLabel: "🛡️ Activar Refugio SPE",
    },
  },
  "PROTO-NOM-00": {
    code: "PROTO-NOM-00",
    title: "Vigilancia Nominal en Tránsito a Marte",
    refs: "V1 3004.h · V1 6001 · V1 7001 · V2 6001",
    shapIndicators: ["frec_cardiaca", "presion_sistolica", "temp_corporal"],
    caution: {
      diag: "Estabilidad fisiológica dentro de línea base individual; sin desviaciones activas.",
      dir1: "Mantener rutina nominal de tránsito, hidratación regular y objetivo de sueño de 8,5 h/día (V1 6001).",
      dir2: "Conservar registro continuo ASTROSKIN/ACTIWATCH en historia clínica cifrada (V1 3004.a) y control manual periódico.",
      actionType: "protocolo_conductual",
      actionLabel: "🧘 Pausa Preventiva 4-4-6",
    },
    critical: {
      diag: "Vigilancia nominal activa.",
      dir1: "Continuar monitoreo continuo.",
      dir2: "Sin alertas críticas.",
      exceedsScope: false,
      actionType: null,
      actionLabel: null,
    },
  },
};

/**
 * Protocolos de síntomas para Guía Paso a Paso (Tabla F.5-2)
 * Estrictamente alineados con protocolos_medicos_nasa.md (sin esperar respuesta en vivo de Tierra).
 */
export const SYMPTOM_PROTOCOLS = {
  Cefalea: [
    { sistema: false, texto: "Hidratar con 350 ml de agua isotónica y verificar P_I O₂ (145–155 mmHg) y ppCO₂ (≤ 3 mmHg, V2 6004)." },
    { sistema: false, texto: "Reducir brillo de pantallas, relajar musculatura cervical 2 min y completar 2 ciclos 4-4-6." },
    { sistema: true, texto: "[SISTEMA] Registrar tendencia de síntomas en historia clínica electrónica cifrada (V1 3004.a)." },
  ],
  "Fatiga visual": [
    { sistema: false, texto: "Aplicar regla 20-20-20 mirando un punto lejano durante 20 segundos y aplicar lágrimas estériles." },
    { sistema: false, texto: "Ajustar iluminación circadiana de cabina según turno activo (Tabla 8.7-2, V2 8055)." },
    { sistema: true, texto: "[SISTEMA] Sugerir pausa de 3 min y registrar carga visual (Bedford ≤ 3, V2 5007)." },
  ],
  "Estrés / Tensión": [
    { sistema: false, texto: "Realizar pausa operativa de 5 min y ejecutar 3 ciclos completos de respiración guiada 4-4-6." },
    { sistema: true, texto: "[SISTEMA] Habilitar protocolo conductual asíncrono en dispositivo privado (V1 3004.q, V2 7071)." },
    { sistema: true, texto: "[SISTEMA] Guardar nota cifrada privada para Conferencia Psicológica Privada diferida (V1 6010)." },
  ],
  Insomnio: [
    { sistema: false, texto: "Atenuar iluminación pre-sueño (8 ± 2 lux melanópico EDI, V2 8055) y evitar estimulantes." },
    { sistema: false, texto: "Asegurar entorno protegido de descanso (≤ 0,02 lux, NC-40 V2 6079, vibración < 0,1 m/s² V2 6092)." },
    { sistema: true, texto: "[SISTEMA] Reprogramar tareas críticas fuera del nadir circadiano (1–7 AM relativo) y registrar acto (V1 6001)." },
  ],
  Mareo: [
    { sistema: false, texto: "Fijar mirada en referencia estructural estable de cabina, sujetarse y verificar Presión Arterial e hidratación (V2 7042)." },
    { sistema: false, texto: "Auditar parámetros atmosféricos de cabina (P_I O₂ y ppCO₂) y SpO₂." },
    { sistema: true, texto: "[SISTEMA] Evaluar intolerancia ortostática/neurovestibular y registrar evento (Tabla E.2-2)." },
  ],
  "Dolor torácico": [
    { sistema: true, texto: "[SISTEMA] PROTO-CV-01 · EXCEDE ALCANCE (V2 10171): activar respuesta de emergencia (V2 10178) y bloquear maniobras críticas." },
    { sistema: false, texto: "Suspender esfuerzo físico, adoptar reposo o iniciar RCP/DEA si hay colapso (V1 5001-5002)." },
    { sistema: false, texto: "Convocar al CMO (V1 3006) para ECG 3-derivaciones y ecografía a bordo (V1 3004.i, V1 5003)." },
    { sistema: true, texto: "[SISTEMA] Empaquetar trazado ECG, SHAP y signos vitales cifrados vía store-and-forward (V1 6002, V2 10125; no esperar respuesta en vivo)." },
  ],
};

export const PARAM_ORDER = ["bp", "hr", "glucose", "temp", "sleep", "mood", "radiation", "pvt"];
export const PRIMARY_METRICS = ["hr", "bp", "temp", "radiation"];
export const SECONDARY_METRICS = ["glucose", "sleep", "mood", "pvt"];

export const METRIC_META = {
  bp: {
    key: "bp",
    backendVar: "presion_sistolica",
    label: "Presión Arterial",
    fullLabel: "Presión Arterial",
    unit: "mmHg",
    step: 5,
    source: "Astroskin (est.) / manguito",
    format: (m) => `${Math.round(m.bpSys)}/${Math.round(m.bpDia)}`,
  },
  hr: {
    key: "hr",
    backendVar: "frec_cardiaca",
    label: "Pulsaciones",
    fullLabel: "Frecuencia Cardíaca",
    unit: "bpm",
    step: 6,
    source: "Astroskin (pulso / ECG)",
    format: (m) => `${Math.round(m.hr)}`,
  },
  glucose: {
    key: "glucose",
    backendVar: "glucemia",
    label: "Azúcar en Sangre",
    fullLabel: "Glucemia (Azúcar en Sangre)",
    unit: "mg/dL",
    step: 8,
    source: "Glucómetro / Manual",
    format: (m) => `${Math.round(m.glucose)}`,
  },
  temp: {
    key: "temp",
    backendVar: "temp_corporal",
    label: "Temp. Cutánea / Central",
    fullLabel: "Temperatura Corporal",
    unit: "°C",
    step: 0.4,
    source: "Astroskin (piel) + modelo central",
    format: (m) => Number(m.temp).toFixed(1),
  },
  sleep: {
    key: "sleep",
    backendVar: "horas_sueno",
    label: "Horas de Sueño",
    fullLabel: "Horas Diarias de Sueño",
    unit: "h",
    step: 0.4,
    source: "Actiwatch Spectrum (meta 8,5 h)",
    format: (m) => Number(m.sleep).toFixed(1),
  },
  mood: {
    key: "mood",
    backendVar: "estado_animo",
    label: "Estado de Ánimo",
    fullLabel: "Estado de Ánimo",
    unit: "%",
    step: 0.5,
    source: "Autorreporte multimodal",
    format: (m) => `${Math.round(m.moodPct)}`,
  },
  radiation: {
    key: "radiation",
    backendVar: "radiation_rate",
    label: "Radiación Acumulada",
    fullLabel: "Radiación Ionizante",
    unit: "mSv/d",
    quickUnit: "mSv",
    step: 0.12,
    source: "Dosimetría espacio libre (V1 4033)",
    format: (m) => Number(m.radiation).toFixed(2),
    quickFormat: (m) => Number(m.radiationTotal).toFixed(1),
  },
  pvt: {
    key: "pvt",
    backendVar: "pvt_ms",
    label: "Reflejos (PVT)",
    fullLabel: "Test PVT (Reflejos)",
    unit: "ms",
    step: null,
    source: "Prueba vigilancia psicomotora",
    format: (m) => `${Math.round(m.pvt)}`,
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
    const st = { ...NASA_LEVELS.stale, label: "⏱ DATO CIAN" };
    return st;
  }

  if (key === "bp") {
    if (emergencyManual || m.bpSys >= 180 || m.bpSys < 80) {
      levelKey = "emergency";
      label = "⚡ EMERGENCIA";
    } else if (m.bpSys > 145) {
      levelKey = "warning";
      label = "▲ ALERTA";
    } else if (m.bpSys < 90) {
      levelKey = "warning";
      label = "▼ ALERTA";
    } else if (m.bpSys > 125) {
      levelKey = "caution";
      label = "▲ PRECAUCIÓN";
    } else if (m.bpSys < 105) {
      levelKey = "caution";
      label = "▼ PRECAUCIÓN";
    }
  } else if (key === "hr") {
    if (emergencyManual || m.hr > 150 || m.hr < 40 || (m.hr > 140 && m.ecg > 0.25)) {
      levelKey = "emergency";
      label = "⚡ EMERGENCIA";
    } else if (m.hr > 130) {
      levelKey = "warning";
      label = "▲ ALERTA";
    } else if (m.hr < 45) {
      levelKey = "warning";
      label = "▼ ALERTA";
    } else if (m.hr > 95) {
      levelKey = "caution";
      label = "▲ PRECAUCIÓN";
    } else if (m.hr < 55) {
      levelKey = "caution";
      label = "▼ PRECAUCIÓN";
    } else if (m.hr > 88) {
      levelKey = "advisory";
      label = "▲ AVISO";
    }
  } else if (key === "glucose") {
    if (m.glucose > 300 || m.glucose < 54) {
      levelKey = "emergency";
      label = "⚡ EMERGENCIA";
    } else if (m.glucose > 200) {
      levelKey = "warning";
      label = "▲ ALERTA";
    } else if (m.glucose < 55) {
      levelKey = "warning";
      label = "▼ ALERTA";
    } else if (m.glucose > 140) {
      levelKey = "caution";
      label = "▲ PRECAUCIÓN";
    } else if (m.glucose < 70) {
      levelKey = "caution";
      label = "▼ PRECAUCIÓN";
    }
  } else if (key === "temp") {
    if (m.tempCentral < 35.0 || m.tempCentral > 38.6) {
      levelKey = "emergency";
      label = "⚡ EMERGENCIA";
    } else if (m.temp < 34.8) {
      levelKey = "warning";
      label = "▼ ALERTA";
    } else if (m.temp > 37.6) {
      levelKey = "warning";
      label = "▲ ALERTA";
    } else if (m.temp < 35.6) {
      levelKey = "caution";
      label = "▼ PRECAUCIÓN";
    } else if (m.temp > 36.9) {
      levelKey = "caution";
      label = "▲ PRECAUCIÓN";
    }
  } else if (key === "sleep") {
    if (m.sleep < 6.0) {
      levelKey = "warning";
      label = "▼ ALERTA";
    } else if (m.sleep < 7.5) {
      levelKey = "caution";
      label = "▼ PRECAUCIÓN";
    } else if (m.sleep > 9.5) {
      levelKey = "advisory";
      label = "▲ AVISO";
    }
  } else if (key === "mood") {
    if (m.moodScore < 4.5) {
      levelKey = "warning";
      label = "▼ ALERTA";
    } else if (m.moodScore < 6.5) {
      levelKey = "caution";
      label = "▼ PRECAUCIÓN";
    } else if (m.moodScore < 7.2) {
      levelKey = "advisory";
      label = "▼ AVISO";
    }
  } else if (key === "radiation") {
    // NASA-STD-3001 Vol. 1 Rev. C V1 4033 (< 1.3 mSv/d espacio libre), V1 4031 (< 250 mSv SPE)
    if (m.radiation >= 2.0 || m.radiationTotal >= 250) {
      levelKey = "emergency";
      label = "⚡ EMERGENCIA";
    } else if (m.radiation >= 1.3) {
      levelKey = "warning";
      label = "▲ ALERTA";
    } else if (m.radiation >= 1.1) {
      levelKey = "caution";
      label = "▲ PRECAUCIÓN";
    } else if (m.radiation >= 0.96) {
      levelKey = "advisory";
      label = "▲ AVISO";
    }
  } else if (key === "pvt") {
    if (m.pvt >= 380) {
      levelKey = "warning";
      label = "▲ ALERTA";
    } else if (m.pvt >= 300) {
      levelKey = "caution";
      label = "▲ PRECAUCIÓN";
    } else if (m.pvt >= 265) {
      levelKey = "advisory";
      label = "▲ AVISO";
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
  return list.reduce((acc, cur) => (cur.severity > acc.severity ? cur : acc), list[0]);
}

export function getAllIndicatorStates(m, options = {}) {
  const states = {};
  PARAM_ORDER.forEach((key) => {
    states[key] = evaluateIndicator(key, m, options);
  });
  return states;
}

/**
 * Plan de los 4 recuadros principales:
 * Base: Pulsaciones -> Presión -> Temperatura -> Radiación.
 * Cada parámetro secundario alterado reemplaza desde el 4.º lugar hacia el 1.º.
 */
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

/**
 * Construye el sistema unificado de mensajes, advertencias y recomendaciones
 * usando `protocolos_medicos_nasa.md` como diccionario maestro y la salida del backend.
 */
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

  // 1. Evaluar parámetros individuales contra diccionario de protocolos
  const checks = [
    {
      key: "hr",
      proto: "PROTO-CV-01",
      title: `Frecuencia Cardíaca (${Math.round(m.hr)} bpm)`,
      desc: "Pulso fuera de rango operativo (55–95 bpm). Evaluar síntomas torácicos y ECG Astroskin.",
    },
    {
      key: "bp",
      proto: "PROTO-CV-01",
      title: `Presión Arterial (${Math.round(m.bpSys)}/${Math.round(m.bpDia)} mmHg)`,
      desc: "Desviación hemodinámica (nominal 105–125 mmHg sistólica; ref. V2 7042).",
    },
    {
      key: "temp",
      proto: "PROTO-TERM-04",
      title: `Temperatura (Piel ${m.temp.toFixed(1)} °C · Central est. ${m.tempCentral.toFixed(2)} °C)`,
      desc:
        m.tempCentral < 35.0
          ? "Hipotermia central estimada < 35,0 °C (Vol. 1 Apéndice C). Confirmar vía oral/central."
          : "Deriva térmica cutánea vs. central (V2 11011). Ajustar cabina 20–25 °C (Fig. 6.2-2).",
    },
    {
      key: "glucose",
      proto: "PROTO-MET-03",
      title: `Glucemia (${Math.round(m.glucose)} mg/dL)`,
      desc: ui.datos_manuales_obsoletos
        ? "Dato manual vencido (estado Cian, V2 10020). Actualizar glucemia capilar (mg/dL)."
        : "Desregulación glucémica (nominal 70–140 mg/dL, ref. V2 8055 / V1 4020).",
    },
    {
      key: "sleep",
      proto: "PROTO-MET-03",
      title: `Horas de Sueño (${m.sleep.toFixed(1)} h)`,
      desc: "Déficit frente a referencia de 8,5 h/día (V1 6001). Evitar tareas en nadir circadiano 1–7 AM.",
    },
    {
      key: "mood",
      proto: "PROTO-COND-05",
      title: `Estado de Ánimo (${Math.round(m.moodPct)} % · ${m.moodScore.toFixed(1)}/10)`,
      desc: ui.datos_manuales_obsoletos
        ? "Autorreporte desactualizado (estado Cian, V2 10020). Completar cuestionario."
        : "Descenso afectivo/conductual (V1 3004.q, Tabla E.2-2, privacidad V2 7071).",
    },
    {
      key: "radiation",
      proto: "PROTO-RAD-06",
      title: `Radiación Ionizante (${m.radiation.toFixed(2)} mSv/d · ${m.radiationTotal.toFixed(1)} mSv acum.)`,
      desc: "Vigilancia en espacio libre: límite GCR < 1,3 mSv/d (V1 4033) y SPE < 250 mSv (V1 4031).",
    },
    {
      key: "pvt",
      proto: "PROTO-MET-03",
      title: `Test PVT Reflejos (${Math.round(m.pvt)} ms)`,
      desc: "Tiempo de reacción superior al umbral nominal (< 265 ms); correlacionar con fatiga/sueño.",
    },
  ];

  checks.forEach((c) => {
    const st = states[c.key];
    if (st.severity > 0) {
      const protoEntry = PROTOCOL_DICTIONARY[c.proto];
      const tier = st.severity >= 3 ? protoEntry.critical : protoEntry.caution;
      items.push({
        id: `param-${c.key}`,
        metricKey: c.key,
        category: st.key === "stale" ? "reminder" : "alert",
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

  // 2. Verificar respiración y atmósfera de cabina (PROTO-RESP-02)
  const piO2 = Number(cabin.pi_o2_mmhg ?? 150);
  const ppCo2 = Number(cabin.ppco2_mmhg ?? 1.8);
  let respState = null;
  if (m.spo2 < 90 || piO2 < 122 || ppCo2 > 5.3) {
    respState = { ...NASA_LEVELS.emergency, label: "⚡ EMERGENCIA", blink: !ui.parpadeo_detenido };
  } else if (m.spo2 < 92 || piO2 < 127 || ppCo2 > 4.0) {
    respState = { ...NASA_LEVELS.warning, label: "▲ ALERTA" };
  } else if (m.spo2 < 96 || piO2 < 145 || ppCo2 > 3.0) {
    respState = { ...NASA_LEVELS.caution, label: "▲ PRECAUCIÓN" };
  }
  if (respState) {
    const protoEntry = PROTOCOL_DICTIONARY["PROTO-RESP-02"];
    const tier = respState.severity >= 3 ? protoEntry.critical : protoEntry.caution;
    items.push({
      id: "cabin-resp",
      metricKey: "spo2",
      category: "alert",
      protoCode: "PROTO-RESP-02",
      state: respState,
      inhibited: inhibited.has("spo2"),
      title: `Respiratorio / Cabina (SpO₂ ${m.spo2.toFixed(1)} % · P_I O₂ ${piO2.toFixed(1)} · ppCO₂ ${ppCo2.toFixed(2)} mmHg)`,
      desc: "Desviación de oxigenación o depuración CO₂ en cabina presurizada (V2 6003-6004, Tabla 6.2-1).",
      recommendation: tier.dir1,
      followUp: tier.dir2,
      exceedsScope: Boolean(tier.exceedsScope),
    });
  }

  // 3. Recordatorio y Sugerencia operativa (Tabla 10.3-1 Advisory / Nominal)
  items.push({
    id: "rem-store-forward",
    metricKey: null,
    category: "reminder",
    protoCode: res.protocolo_codigo || "PROTO-NOM-00",
    state: { ...NASA_LEVELS.advisory, label: "▼ RECORDATORIO" },
    inhibited: false,
    title: "Sincronización Store-and-Forward (Latencia 20 min/sentido)",
    desc: "Expediente biométrico cifrado listo para envío diferido Tierra–Marte (V1 6002, V2 10125).",
    recommendation: "No esperar confirmación en vivo de Tierra ante eventos agudos.",
    followUp: "Verificar medición manual de glucemia (mg/dL) y estado de ánimo.",
    exceedsScope: false,
  });

  items.push({
    id: "sug-circadian",
    metricKey: null,
    category: "suggestion",
    protoCode: "PROTO-NOM-00",
    state: { ...NASA_LEVELS.nominal, label: "✓ SUGERENCIA" },
    inhibited: false,
    title: "Higiene Circadiana e Hidratación (V1 6001 · V2 8055)",
    desc: "Mantener ≥ 250 lux melanópico EDI en vigilia, ≤ 0,02 lux en descanso y 8,5 h de sueño.",
    recommendation: "Ejecutar pausa preventiva 4-4-6 ante sobrecarga Bedford > 3 (V2 5007).",
    followUp: "Continuar registro continuo ASTROSKIN / ACTIWATCH.",
    exceedsScope: false,
  });

  // Ordenar alertas activas por severidad descendente (V2 10175)
  const activeAlerts = items
    .filter((i) => (i.category === "alert" || i.state.key === "stale") && !i.inhibited)
    .sort((a, b) => b.state.severity - a.state.severity);

  // Determinar estado global combinando backend + evaluación frontend (incluye radiación/PVT)
  const backendKey = mapBackendLevelToKey(res.nivel_nasa, Boolean(ui.datos_manuales_obsoletos));
  const backendState = {
    ...NASA_LEVELS[backendKey],
    blink: NASA_LEVELS[backendKey].blink && !ui.parpadeo_detenido,
  };
  const topActiveState = activeAlerts.length > 0 ? activeAlerts[0].state : NASA_LEVELS.nominal;
  const overallState =
    backendState.severity >= topActiveState.severity ? backendState : topActiveState;

  // Seleccionar protocolo maestro para el recuadro principal (si backend es Nominal pero radiación/PVT están alterados, usar el protocolo correspondiente)
  let activeProtoCode = res.protocolo_codigo || "PROTO-NOM-00";
  if (activeProtoCode === "PROTO-NOM-00" && activeAlerts.length > 0) {
    activeProtoCode = activeAlerts[0].protoCode;
  }
  const protoDict = PROTOCOL_DICTIONARY[activeProtoCode] || PROTOCOL_DICTIONARY["PROTO-NOM-00"];
  const isCriticalTier = overallState.severity >= 3 || Boolean(res.excede_alcance);
  const tierDict = isCriticalTier ? protoDict.critical : protoDict.caution;

  const cleanBackendDiag = (res.diagnostico || "")
    .replace(/^\[ALERTA:[^\]]+\]\s*/i, "")
    .trim();

  const shapTop = (res.top3_shap || [])
    .slice(0, 3)
    .map((s) => `${s.variable}=${s.valor}${s.unidad ? ` ${s.unidad}` : ""}`)
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
