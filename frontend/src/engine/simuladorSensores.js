import { CABIN_ENV_NOMINAL, FEATURE_NAMES } from "./nasaReferencia";

export const ESCENARIOS_OBJETIVO = {
  nominal: {
    label: "Estado Nominal (Tránsito en Microgravedad)",
    base: {
      presion_sistolica: 116.0,
      temp_corporal: 36.2,
      nivel_actividad: 0.65,
      spo2: 98.4,
      frec_respiratoria: 14.8,
      vol_respiratorio: 7.9,
      frec_cardiaca: 71.0,
      anomalia_ecg: 0.04,
      eficiencia_sueno: 88.5,
      glucemia: 96.0,
      horas_sueno: 8.4,
      estado_animo: 8.2,
    },
    ruido: {
      presion_sistolica: 1.4,
      temp_corporal: 0.06,
      nivel_actividad: 0.08,
      spo2: 0.25,
      frec_respiratoria: 0.4,
      vol_respiratorio: 0.22,
      frec_cardiaca: 1.8,
      anomalia_ecg: 0.008,
      eficiencia_sueno: 0.6,
      glucemia: 1.5,
      horas_sueno: 0.05,
      estado_animo: 0.1,
    },
    cabin: { ...CABIN_ENV_NOMINAL },
  },
  sueno_glucemia_preventiva: {
    label: "Privación Acumulada de Sueño + Desregulación Glucémica (Caution)",
    base: {
      presion_sistolica: 108.0,
      temp_corporal: 35.95,
      nivel_actividad: 0.45,
      spo2: 97.2,
      frec_respiratoria: 15.8,
      vol_respiratorio: 7.4,
      frec_cardiaca: 92.0,
      anomalia_ecg: 0.14,
      eficiencia_sueno: 76.0,
      glucemia: 67.5,
      horas_sueno: 6.8,
      estado_animo: 5.4,
    },
    ruido: {
      presion_sistolica: 1.5,
      temp_corporal: 0.06,
      nivel_actividad: 0.08,
      spo2: 0.25,
      frec_respiratoria: 0.45,
      vol_respiratorio: 0.25,
      frec_cardiaca: 1.9,
      anomalia_ecg: 0.012,
      eficiencia_sueno: 0.8,
      glucemia: 1.6,
      horas_sueno: 0.08,
      estado_animo: 0.15,
    },
    cabin: { ...CABIN_ENV_NOMINAL },
  },
  sueno_glucemia_critica: {
    label: "Privación Severa de Sueño + Hipoglucemia Metabólica (Warning)",
    base: {
      presion_sistolica: 99.0,
      temp_corporal: 35.7,
      nivel_actividad: 0.25,
      spo2: 96.6,
      frec_respiratoria: 16.4,
      vol_respiratorio: 7.1,
      frec_cardiaca: 112.0,
      anomalia_ecg: 0.24,
      eficiencia_sueno: 58.0,
      glucemia: 51.0,
      horas_sueno: 4.6,
      estado_animo: 3.4,
    },
    ruido: {
      presion_sistolica: 1.8,
      temp_corporal: 0.07,
      nivel_actividad: 0.1,
      spo2: 0.3,
      frec_respiratoria: 0.5,
      vol_respiratorio: 0.3,
      frec_cardiaca: 2.4,
      anomalia_ecg: 0.02,
      eficiencia_sueno: 1.0,
      glucemia: 1.4,
      horas_sueno: 0.08,
      estado_animo: 0.18,
    },
    cabin: { ...CABIN_ENV_NOMINAL },
  },
  evento_cardiovascular_agudo: {
    label: "Evento Cardiovascular Agudo (Dolor Torácico / Colapso en Tránsito)",
    base: {
      presion_sistolica: 162.0,
      temp_corporal: 36.8,
      nivel_actividad: 0.18,
      spo2: 90.8,
      frec_respiratoria: 25.2,
      vol_respiratorio: 14.8,
      frec_cardiaca: 152.0,
      anomalia_ecg: 0.62,
      eficiencia_sueno: 74.0,
      glucemia: 134.0,
      horas_sueno: 7.1,
      estado_animo: 2.8,
    },
    ruido: {
      presion_sistolica: 2.6,
      temp_corporal: 0.08,
      nivel_actividad: 0.06,
      spo2: 0.4,
      frec_respiratoria: 0.7,
      vol_respiratorio: 0.4,
      frec_cardiaca: 3.2,
      anomalia_ecg: 0.03,
      eficiencia_sueno: 0.8,
      glucemia: 2.0,
      horas_sueno: 0.05,
      estado_animo: 0.15,
    },
    cabin: { ...CABIN_ENV_NOMINAL },
  },
  sobrecarga_cardiovascular_preventiva: {
    label: "Sobrecarga Cardiovascular Moderada (Caution)",
    base: {
      presion_sistolica: 134.0,
      temp_corporal: 36.75,
      nivel_actividad: 1.95,
      spo2: 96.8,
      frec_respiratoria: 19.5,
      vol_respiratorio: 11.4,
      frec_cardiaca: 114.0,
      anomalia_ecg: 0.22,
      eficiencia_sueno: 82.0,
      glucemia: 108.0,
      horas_sueno: 7.7,
      estado_animo: 6.8,
    },
    ruido: {
      presion_sistolica: 2.0,
      temp_corporal: 0.07,
      nivel_actividad: 0.1,
      spo2: 0.3,
      frec_respiratoria: 0.55,
      vol_respiratorio: 0.35,
      frec_cardiaca: 2.3,
      anomalia_ecg: 0.016,
      eficiencia_sueno: 0.7,
      glucemia: 1.5,
      horas_sueno: 0.05,
      estado_animo: 0.12,
    },
    cabin: { ...CABIN_ENV_NOMINAL },
  },
  hipoxia_preventiva: {
    label: "Hipoxia / Hipercapnia Leve de Cabina (Caution)",
    base: {
      presion_sistolica: 119.0,
      temp_corporal: 36.25,
      nivel_actividad: 0.5,
      spo2: 93.6,
      frec_respiratoria: 20.2,
      vol_respiratorio: 11.8,
      frec_cardiaca: 102.0,
      anomalia_ecg: 0.09,
      eficiencia_sueno: 84.0,
      glucemia: 99.0,
      horas_sueno: 8.0,
      estado_animo: 6.6,
    },
    ruido: {
      presion_sistolica: 1.6,
      temp_corporal: 0.06,
      nivel_actividad: 0.07,
      spo2: 0.35,
      frec_respiratoria: 0.6,
      vol_respiratorio: 0.35,
      frec_cardiaca: 2.0,
      anomalia_ecg: 0.012,
      eficiencia_sueno: 0.7,
      glucemia: 1.4,
      horas_sueno: 0.05,
      estado_animo: 0.1,
    },
    cabin: {
      pi_o2_mmhg: 126.0,
      ppco2_mmhg: 3.6,
      cabin_temp_c: 22.8,
      cabin_rh_pct: 48.0,
    },
  },
  hipoxia_critica: {
    label: "Hipoxia Severa / Fallo Atmosférico de Cabina (Emergency)",
    base: {
      presion_sistolica: 122.0,
      temp_corporal: 36.2,
      nivel_actividad: 0.3,
      spo2: 87.8,
      frec_respiratoria: 26.5,
      vol_respiratorio: 15.2,
      frec_cardiaca: 126.0,
      anomalia_ecg: 0.21,
      eficiencia_sueno: 82.0,
      glucemia: 104.0,
      horas_sueno: 8.1,
      estado_animo: 4.2,
    },
    ruido: {
      presion_sistolica: 2.0,
      temp_corporal: 0.08,
      nivel_actividad: 0.07,
      spo2: 0.45,
      frec_respiratoria: 0.8,
      vol_respiratorio: 0.45,
      frec_cardiaca: 2.6,
      anomalia_ecg: 0.015,
      eficiencia_sueno: 0.8,
      glucemia: 1.8,
      horas_sueno: 0.05,
      estado_animo: 0.15,
    },
    cabin: {
      pi_o2_mmhg: 118.0,
      ppco2_mmhg: 5.8,
      cabin_temp_c: 23.2,
      cabin_rh_pct: 52.0,
    },
  },
  hipotermia_critica: {
    label: "Hipotermia Central < 35 °C (Vol. 1 Apéndice C)",
    base: {
      presion_sistolica: 87.0,
      temp_corporal: 33.9,
      nivel_actividad: 0.15,
      spo2: 94.5,
      frec_respiratoria: 8.2,
      vol_respiratorio: 4.1,
      frec_cardiaca: 42.0,
      anomalia_ecg: 0.27,
      eficiencia_sueno: 77.0,
      glucemia: 66.0,
      horas_sueno: 7.6,
      estado_animo: 4.8,
    },
    ruido: {
      presion_sistolica: 1.6,
      temp_corporal: 0.07,
      nivel_actividad: 0.05,
      spo2: 0.35,
      frec_respiratoria: 0.35,
      vol_respiratorio: 0.2,
      frec_cardiaca: 1.5,
      anomalia_ecg: 0.018,
      eficiencia_sueno: 0.7,
      glucemia: 1.4,
      horas_sueno: 0.05,
      estado_animo: 0.15,
    },
    cabin: {
      pi_o2_mmhg: 149.0,
      ppco2_mmhg: 2.1,
      cabin_temp_c: 16.5,
      cabin_rh_pct: 68.0,
    },
  },
  estres_termico_critico: {
    label: "Estrés Térmico y Hemodinámico en Cabina (Warning)",
    base: {
      presion_sistolica: 141.0,
      temp_corporal: 38.05,
      nivel_actividad: 1.65,
      spo2: 96.1,
      frec_respiratoria: 21.8,
      vol_respiratorio: 13.4,
      frec_cardiaca: 127.0,
      anomalia_ecg: 0.18,
      eficiencia_sueno: 78.0,
      glucemia: 116.0,
      horas_sueno: 7.3,
      estado_animo: 5.4,
    },
    ruido: {
      presion_sistolica: 2.1,
      temp_corporal: 0.08,
      nivel_actividad: 0.1,
      spo2: 0.3,
      frec_respiratoria: 0.6,
      vol_respiratorio: 0.35,
      frec_cardiaca: 2.5,
      anomalia_ecg: 0.015,
      eficiencia_sueno: 0.8,
      glucemia: 1.5,
      horas_sueno: 0.05,
      estado_animo: 0.15,
    },
    cabin: {
      pi_o2_mmhg: 150.0,
      ppco2_mmhg: 2.4,
      cabin_temp_c: 28.4,
      cabin_rh_pct: 72.0,
    },
  },
};

export const LIMITES_FISICOS = {
  presion_sistolica: [65.0, 210.0],
  temp_corporal: [32.5, 41.0],
  nivel_actividad: [0.02, 5.0],
  spo2: [70.0, 100.0],
  frec_respiratoria: [5.0, 40.0],
  vol_respiratorio: [2.0, 28.0],
  frec_cardiaca: [30.0, 200.0],
  anomalia_ecg: [0.0, 1.0],
  eficiencia_sueno: [20.0, 100.0],
  glucemia: [35.0, 380.0],
  horas_sueno: [2.0, 12.0],
  estado_animo: [1.0, 10.0],
};

export const PRECISION_SALIDA = {
  presion_sistolica: 1,
  temp_corporal: 2,
  nivel_actividad: 2,
  spo2: 1,
  frec_respiratoria: 1,
  vol_respiratorio: 2,
  frec_cardiaca: 0,
  anomalia_ecg: 3,
  eficiencia_sueno: 1,
  glucemia: 1,
  horas_sueno: 2,
  estado_animo: 1,
};

function clip(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function roundTo(val, decimals) {
  const factor = 10 ** decimals;
  return Math.round(val * factor) / factor;
}

function createRng(seed) {
  let state = (seed >>> 0) || 1;
  const uniform = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    normal(mean = 0, std = 1) {
      const u1 = Math.max(1e-12, uniform());
      const u2 = uniform();
      const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      return mean + std * z;
    },
  };
}

export class SimuladorSensores {
  constructor(seed = 42, suavizado = 0.48) {
    this._rng = createRng(seed);
    this._suavizado = clip(suavizado, 0.1, 1.0);
    this._tick = 0;
    this.escenario_actual = "nominal";
    this.valores_actuales = { ...ESCENARIOS_OBJETIVO.nominal.base };
    this._objetivo_actual = { ...ESCENARIOS_OBJETIVO.nominal.base };
    this._ruido_actual = { ...ESCENARIOS_OBJETIVO.nominal.ruido };
    this._cabina_actual = { ...ESCENARIOS_OBJETIVO.nominal.cabin };
    this._manual_overrides = {};
    this.intervenciones_aplicadas = [];
  }

  aplicarIntervencion(tipoIntervencion) {
    this._manual_overrides = {};
    const mensajes = {
      oxigeno_100: "Oxígeno suplementario al 100 % aplicado y depuración ECLSS estabilizada.",
      reposo_cv: "Reposo absoluto adoptado; carga operativa reducida e hidratación aplicada.",
      rcp_dea: "Protocolo RCP/DEA y soporte vital básico ejecutado; ritmo en estabilización.",
      glucosa_oral: "Administrados 15–20 g de glucosa oral de absorción rápida.",
      iluminacion_descanso: "Iluminación circadiana aplicada y bloque de recuperación de sueño activado.",
      recalentamiento: "Recalentamiento térmico progresivo y aislamiento de cabina activados.",
      enfriamiento_lcvg: "Prenda de enfriamiento líquido (LCVG) activada al máximo flujo.",
      protocolo_conductual: "Sesión breve de respiración guiada 4-6 y descarga cognitiva completada.",
      ecg_ecografia_bordo: "Registro de ECG 3-derivaciones y ecografía portátil capturado para expediente.",
    };
    if (!(tipoIntervencion in mensajes)) {
      return "Intervención registrada.";
    }
    this.intervenciones_aplicadas.push(tipoIntervencion);

    if (tipoIntervencion === "oxigeno_100") {
      this._objetivo_actual.spo2 = 98.2;
      this._objetivo_actual.frec_respiratoria = 16.0;
      this._objetivo_actual.vol_respiratorio = 8.4;
      this._objetivo_actual.frec_cardiaca = Math.min(this._objetivo_actual.frec_cardiaca, 88.0);
      this._cabina_actual.pi_o2_mmhg = 150.0;
      this._cabina_actual.ppco2_mmhg = 1.9;
    } else if (tipoIntervencion === "reposo_cv") {
      this._objetivo_actual.frec_cardiaca = 82.0;
      this._objetivo_actual.presion_sistolica = 121.0;
      this._objetivo_actual.anomalia_ecg = Math.min(this._objetivo_actual.anomalia_ecg, 0.12);
      this._objetivo_actual.nivel_actividad = 0.25;
      this._objetivo_actual.spo2 = Math.max(this._objetivo_actual.spo2, 96.5);
    } else if (tipoIntervencion === "rcp_dea") {
      this._objetivo_actual.frec_cardiaca = 89.0;
      this._objetivo_actual.presion_sistolica = 114.0;
      this._objetivo_actual.anomalia_ecg = 0.18;
      this._objetivo_actual.spo2 = 95.8;
      this._objetivo_actual.frec_respiratoria = 17.5;
      this._objetivo_actual.nivel_actividad = 0.15;
    } else if (tipoIntervencion === "glucosa_oral") {
      this._objetivo_actual.glucemia = 98.0;
      this._objetivo_actual.frec_cardiaca = Math.min(this._objetivo_actual.frec_cardiaca, 84.0);
      this._objetivo_actual.estado_animo = Math.max(this._objetivo_actual.estado_animo, 6.8);
    } else if (tipoIntervencion === "iluminacion_descanso") {
      this._objetivo_actual.horas_sueno = 8.2;
      this._objetivo_actual.eficiencia_sueno = 86.0;
      this._objetivo_actual.estado_animo = Math.max(this._objetivo_actual.estado_animo, 7.4);
      this._objetivo_actual.anomalia_ecg = Math.min(this._objetivo_actual.anomalia_ecg, 0.1);
    } else if (tipoIntervencion === "recalentamiento") {
      this._objetivo_actual.temp_corporal = 36.1;
      this._objetivo_actual.frec_cardiaca = 68.0;
      this._objetivo_actual.presion_sistolica = 112.0;
      this._objetivo_actual.frec_respiratoria = 14.2;
      this._cabina_actual.cabin_temp_c = 22.8;
    } else if (tipoIntervencion === "enfriamiento_lcvg") {
      this._objetivo_actual.temp_corporal = 36.3;
      this._objetivo_actual.frec_cardiaca = 82.0;
      this._objetivo_actual.presion_sistolica = 122.0;
      this._cabina_actual.cabin_temp_c = 21.5;
    } else if (tipoIntervencion === "protocolo_conductual") {
      this._objetivo_actual.estado_animo = Math.min(
        9.0,
        Math.max(this.valores_actuales.estado_animo + 1.8, 7.2)
      );
      this._objetivo_actual.frec_cardiaca = Math.min(this._objetivo_actual.frec_cardiaca, 78.0);
    }

    if (tipoIntervencion !== "ecg_ecografia_bordo") {
      for (const v of FEATURE_NAMES) {
        const actual = this.valores_actuales[v];
        const objetivo = this._objetivo_actual[v];
        this.valores_actuales[v] = actual + 0.65 * (objetivo - actual);
      }
    }
    return mensajes[tipoIntervencion];
  }

  activarEscenario(nombreEscenario, inmediato = true) {
    const cfg = ESCENARIOS_OBJETIVO[nombreEscenario];
    if (!cfg) {
      throw new Error(`Escenario desconocido: ${nombreEscenario}`);
    }
    this.escenario_actual = nombreEscenario;
    this._manual_overrides = {};
    this.intervenciones_aplicadas = [];
    this._objetivo_actual = { ...cfg.base };
    this._ruido_actual = { ...cfg.ruido };
    this._cabina_actual = { ...cfg.cabin };
    if (inmediato) {
      for (const v of FEATURE_NAMES) {
        const actual = this.valores_actuales[v];
        const objetivo = this._objetivo_actual[v];
        this.valores_actuales[v] = actual + 0.9 * (objetivo - actual);
      }
    }
  }

  registrarEntradaManual(glucemia = null, estadoAnimo = null) {
    if (glucemia !== null && glucemia !== undefined) {
      const [minG, maxG] = LIMITES_FISICOS.glucemia;
      const g = clip(Number(glucemia), minG, maxG);
      this._manual_overrides.glucemia = g;
      this._objetivo_actual.glucemia = g;
      this.valores_actuales.glucemia = g;
    }
    if (estadoAnimo !== null && estadoAnimo !== undefined) {
      const [minA, maxA] = LIMITES_FISICOS.estado_animo;
      const a = clip(Number(estadoAnimo), minA, maxA);
      this._manual_overrides.estado_animo = a;
      this._objetivo_actual.estado_animo = a;
      this.valores_actuales.estado_animo = a;
    }
  }

  restaurarNominal(inmediato = true) {
    this.activarEscenario("nominal", inmediato);
  }

  inyectarSobrecargaCardiovascular(critica = true, inmediato = true) {
    const esc = critica
      ? "evento_cardiovascular_agudo"
      : "sobrecarga_cardiovascular_preventiva";
    this.activarEscenario(esc, inmediato);
  }

  obtenerEntornoCabina() {
    return {
      pi_o2_mmhg: roundTo(this._cabina_actual.pi_o2_mmhg + this._rng.normal(0.0, 0.4), 1),
      ppco2_mmhg: roundTo(
        Math.max(0.2, this._cabina_actual.ppco2_mmhg + this._rng.normal(0.0, 0.05)),
        2
      ),
      cabin_temp_c: roundTo(this._cabina_actual.cabin_temp_c + this._rng.normal(0.0, 0.1), 1),
      cabin_rh_pct: roundTo(this._cabina_actual.cabin_rh_pct + this._rng.normal(0.0, 0.4), 1),
    };
  }

  leerSensores() {
    this._tick += 1;
    const faseResp = Math.sin(this._tick * 0.45);
    const faseCirc = Math.cos(this._tick * 0.12);
    const lectura = {};

    for (const v of FEATURE_NAMES) {
      if (v in this._manual_overrides) {
        lectura[v] = roundTo(this._manual_overrides[v], PRECISION_SALIDA[v]);
        continue;
      }

      const actual = this.valores_actuales[v];
      const objetivo = this._objetivo_actual[v];
      const sigma = this._ruido_actual[v];

      let modulacion = 0.0;
      if (v === "frec_cardiaca") {
        modulacion = 1.6 * faseResp + 1.2 * faseCirc;
      } else if (v === "frec_respiratoria") {
        modulacion = 0.35 * faseResp;
      } else if (v === "presion_sistolica") {
        modulacion = 1.1 * faseCirc;
      }

      let nuevo;
      if (v === "horas_sueno" || v === "estado_animo") {
        nuevo = actual + this._suavizado * (objetivo - actual) + this._rng.normal(0.0, sigma * 0.35);
      } else {
        nuevo =
          actual +
          this._suavizado * (objetivo - actual) +
          modulacion +
          this._rng.normal(0.0, sigma);
      }

      const [limMin, limMax] = LIMITES_FISICOS[v];
      nuevo = clip(nuevo, limMin, limMax);
      this.valores_actuales[v] = nuevo;
      lectura[v] = roundTo(nuevo, PRECISION_SALIDA[v]);
    }
    return lectura;
  }
}

