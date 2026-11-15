import nasaThresholds from "./data/nasa_thresholds.json";
import osdrReferencia from "./data/osdr_referencia.json";

export const FEATURE_NAMES = [
  "presion_sistolica",
  "temp_corporal",
  "nivel_actividad",
  "spo2",
  "frec_respiratoria",
  "vol_respiratorio",
  "frec_cardiaca",
  "anomalia_ecg",
  "eficiencia_sueno",
  "glucemia",
  "horas_sueno",
  "estado_animo",
];

export const CONSIGNA_SIX_INDICATORS = [
  "presion_sistolica",
  "frec_cardiaca",
  "glucemia",
  "temp_corporal",
  "horas_sueno",
  "estado_animo",
];

export const RISK_LABELS = {
  0: "Normal",
  1: "Preventivo",
  2: "Crítico",
};

export const NASA_ALERT_LEVELS = {
  Emergency: {
    color_hex: "#DC2626",
    label_es: "EMERGENCY (ROJO PARPADEANTE)",
    criterio: "Amenaza vital; requiere acción y procedimientos inmediatos (Tabla 10.3-1).",
  },
  Warning: {
    color_hex: "#EF4444",
    label_es: "WARNING (ROJO SÓLIDO)",
    criterio: "Fallo o deterioro con potencial de escalar a amenaza vital; acción inmediata.",
  },
  Caution: {
    color_hex: "#F59E0B",
    label_es: "CAUTION (AMARILLO)",
    criterio: "Evento fuera de rango nominal que requiere atención, pero no acción inmediata.",
  },
  Advisory: {
    color_hex: "#3B82F6",
    label_es: "ADVISORY (AZUL)",
    criterio: "Aviso rutinario o recordatorio de medición multimodal (no alcanza Caution).",
  },
  Nominal: {
    color_hex: "#10B981",
    label_es: "NOMINAL (VERDE)",
    criterio: "Parámetros fisiológicos y ambientales dentro de banda nominal operativa.",
  },
  Stale: {
    color_hex: "#06B6D4",
    label_es: "DATO OBSOLETO / FALTANTE (CIAN)",
    criterio: "Telemetría o entrada manual desactualizada (Tabla F.5-1, V2 10020).",
  },
};

export const CABIN_ENV_NOMINAL = {
  pi_o2_mmhg: 150.0,
  ppco2_mmhg: 1.8,
  cabin_temp_c: 22.4,
  cabin_rh_pct: 46.0,
};

export function cargarUmbralesNasa() {
  return nasaThresholds;
}

export function obtenerReferenciasOsdr() {
  return { ...osdrReferencia, source_mode: "local_cache" };
}

export function estimarTempCentral(tempPiel, nivelActividad = 0.65) {
  const ajusteActividad = 0.1 * Math.max(0.0, Number(nivelActividad) - 0.8);
  const tempCentral = Number(tempPiel) + 0.65 - ajusteActividad;
  return Math.round(tempCentral * 100) / 100;
}

export function evaluarReglasDeterministasCriticas(
  registro,
  cabinEnv = null,
  emergenciaManual = false
) {
  const razones = [];
  let esEmergency = false;
  let excedeAlcance = false;

  const tempPiel = Number(registro.temp_corporal);
  const act = Number(registro.nivel_actividad);
  const tempCentral = estimarTempCentral(tempPiel, act);
  const spo2 = Number(registro.spo2);
  const fc = Number(registro.frec_cardiaca);
  const ps = Number(registro.presion_sistolica);
  const ecg = Number(registro.anomalia_ecg);
  const gluc = Number(registro.glucemia);

  if (emergenciaManual) {
    esEmergency = true;
    excedeAlcance = true;
    razones.push(
      "Activación manual directa de emergencia (V2 10178): posible dolor torácico o colapso."
    );
  }

  if (tempCentral < 35.0) {
    esEmergency = true;
    excedeAlcance = true;
    razones.push(
      `Hipotermia central estimada crítica (${tempCentral.toFixed(2)} °C < 35,0 °C, Vol. 1 Apéndice C; piel=${tempPiel.toFixed(2)} °C).`
    );
  } else if (tempCentral > 38.6) {
    esEmergency = true;
    excedeAlcance = true;
    razones.push(
      `Hipertermia central estimada crítica (${tempCentral.toFixed(2)} °C > 38,6 °C; piel=${tempPiel.toFixed(2)} °C, V2 11011).`
    );
  }

  if (spo2 < 90.0) {
    esEmergency = true;
    excedeAlcance = true;
    razones.push(`Hipoxemia severa determinista (SpO₂=${spo2.toFixed(1)} % < 90,0 %).`);
  }

  if (fc < 40.0 || fc > 150.0) {
    esEmergency = true;
    excedeAlcance = true;
    razones.push(`Bradicardia o taquicardia extrema determinista (FC=${fc.toFixed(0)} lpm).`);
  } else if (fc > 140.0 && ecg > 0.25) {
    esEmergency = true;
    excedeAlcance = true;
    razones.push(
      `Taquiarritmia de alto riesgo (FC=${fc.toFixed(0)} lpm > 140 lpm [ref. V2 11011] + ECG=${ecg.toFixed(2)}).`
    );
  }

  if (ps < 80.0 || ps >= 180.0) {
    esEmergency = true;
    excedeAlcance = true;
    razones.push(`Crisis hemodinámica determinista (PAS=${ps.toFixed(1)} mmHg).`);
  }

  if (ecg > 0.55) {
    esEmergency = true;
    excedeAlcance = true;
    razones.push(
      `Anomalía ECG severa determinista (índice=${ecg.toFixed(3)} > 0,55; escalar a V1 3004.i).`
    );
  }

  if (gluc < 54.0) {
    esEmergency = true;
    excedeAlcance = true;
    razones.push(`Hipoglucemia severa neuroglucopénica (${gluc.toFixed(0)} mg/dL < 54 mg/dL).`);
  } else if (gluc > 300.0) {
    esEmergency = true;
    excedeAlcance = true;
    razones.push(`Hiperglucemia severa determinista (${gluc.toFixed(0)} mg/dL > 300 mg/dL).`);
  }

  if (cabinEnv) {
    const piO2 = Number(cabinEnv.pi_o2_mmhg ?? CABIN_ENV_NOMINAL.pi_o2_mmhg);
    const ppco2 = Number(cabinEnv.ppco2_mmhg ?? CABIN_ENV_NOMINAL.ppco2_mmhg);
    if (piO2 < 122.0) {
      esEmergency = true;
      excedeAlcance = true;
      razones.push(
        `P_I O₂ de cabina debajo del mínimo absoluto 1 h (${piO2.toFixed(1)} < 122 mmHg, Tabla 6.2-1).`
      );
    }
    if (ppco2 > 5.3) {
      esEmergency = true;
      excedeAlcance = true;
      razones.push(
        `Hipercapnia crítica de cabina (ppCO₂=${ppco2.toFixed(2)} > 5,3 mmHg, ref. V2 6004).`
      );
    }
  }

  return {
    disparada: razones.length > 0,
    nivel_nasa: esEmergency ? "Emergency" : "Nominal",
    razones,
    excede_alcance: excedeAlcance,
    temp_central_est: tempCentral,
  };
}

