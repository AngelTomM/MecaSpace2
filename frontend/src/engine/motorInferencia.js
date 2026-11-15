import {
  CABIN_ENV_NOMINAL,
  FEATURE_NAMES,
  RISK_LABELS,
  cargarUmbralesNasa,
  evaluarReglasDeterministasCriticas,
} from "./nasaReferencia";

export const ETIQUETAS_LEGIBLES = {
  presion_sistolica: "Presión Arterial Sistólica",
  temp_corporal: "Temp. Cutánea (Astroskin)",
  nivel_actividad: "Nivel de Actividad",
  spo2: "Saturación O₂ (SpO₂)",
  frec_respiratoria: "Frecuencia Respiratoria",
  vol_respiratorio: "Volumen Respiratorio",
  frec_cardiaca: "Frecuencia Cardíaca",
  anomalia_ecg: "Anomalía ECG",
  eficiencia_sueno: "Eficiencia del Sueño",
  glucemia: "Glucemia (Azúcar en Sangre)",
  horas_sueno: "Horas Diarias de Sueño",
  estado_animo: "Estado de Ánimo",
};

export const PROCEDIMIENTOS_ELECTRONICOS = {
  "PROTO-CV-01": {
    titulo: "Evento Cardiovascular Agudo / Dolor Torácico o Colapso",
    referencias: "Consigna, Vol. 1 Tabla E.2-2, V1 3004.i, V1 5001-5003, V2 10178",
    pasos: [
      {
        sistema: true,
        texto:
          "[SISTEMA] Bloquear maniobras críticas y activar registro continuo de signos vitales y ECG (V1 3004.h).",
      },
      {
        sistema: false,
        texto:
          "Evaluar consciencia, respiración y pulso del tripulante; iniciar RCP/DEA si hay colapso (V1 5001-5002).",
      },
      {
        sistema: false,
        texto:
          "Convocar al Crew Medical Officer (CMO, V1 3006) para adquirir ECG de 3 derivaciones e imagenología por ecografía a bordo (V1 3004.i, V1 5003).",
      },
      {
        sistema: true,
        texto:
          "[SISTEMA] Empaquetar trazado ECG, SHAP y signos vitales en lote cifrado store-and-forward para Tierra (V1 6002, V2 10125).",
      },
    ],
  },
  "PROTO-RESP-02": {
    titulo: "Hipoxia o Hipercapnia en Cabina Presurizada",
    referencias: "V2 6003-6004, Tabla 6.2-1, V1 Rev. B 3.1.5.f, V1 3004.i",
    pasos: [
      {
        sistema: true,
        texto:
          "[SISTEMA] Contrastar SpO₂ con sensores ambientales de cabina P_I O₂ (145–155 mmHg) y ppCO₂ (≤ 3 mmHg).",
      },
      {
        sistema: false,
        texto:
          "Suministrar oxígeno suplementario al 100 % si SpO₂ < 92 % o P_I O₂ < 127 mmHg y suspender actividad física (V2 10200).",
      },
      {
        sistema: false,
        texto: "Inspeccionar depuradores de CO₂ y sellado del módulo habitable.",
      },
      {
        sistema: true,
        texto:
          "[SISTEMA] Si persiste hipoxemia < 90 %, escalar a ecografía pulmonar (V1 3004.i) y registro diferido (V1 6002).",
      },
    ],
  },
  "PROTO-MET-03": {
    titulo: "Privación de Sueño, Desalineación Circadiana y Desregulación Glucémica",
    referencias: "V1 6001 (8,5 h), V2 8055, V1 4020, V2 6079 (NC-40), V2 6092",
    pasos: [
      {
        sistema: true,
        texto:
          "[SISTEMA] Verificar déficit frente al objetivo de 8,5 h/día (V1 6001) y correlación metabólica/glucémica (V2 8055).",
      },
      {
        sistema: false,
        texto:
          "Si glucemia < 70 mg/dL en tripulante consciente, administrar 15–20 g de carbohidratos rápidos y reevaluar en 15 min.",
      },
      {
        sistema: false,
        texto:
          "Aplicar iluminación circadiana (≥ 250 lux EDI en vigilia / 8 ± 2 lux pre-sueño, V2 8055) y reprogramar tareas críticas fuera del nadir 1–7 AM.",
      },
      {
        sistema: true,
        texto:
          "[SISTEMA] Activar bloque de descanso protegido (NC-40, ≤ 0,02 lux) y envío store-and-forward al equipo médico (V1 6002).",
      },
    ],
  },
  "PROTO-TERM-04": {
    titulo: "Hipotermia Central (< 35 °C) o Estrés Térmico Cutáneo/Central",
    referencias: "Vol. 1 Apéndice C (< 35 °C), V2 6012-6014, Fig. 6.2-2, V2 11011",
    pasos: [
      {
        sistema: true,
        texto:
          "[SISTEMA] Comparar temperatura cutánea (Astroskin) con temperatura central estimada (Vol. 1 Apéndice C; V2 11011).",
      },
      {
        sistema: false,
        texto:
          "Confirmar lectura con termometría central/oral; ante hipotermia (< 35,0 °C) aplicar recalentamiento progresivo y aislamiento térmico.",
      },
      {
        sistema: false,
        texto:
          "Ante estrés térmico hipertérmico, activar enfriamiento LCVG o ajustar cabina a zona de confort (20–25 °C, 30–60 % HR).",
      },
      {
        sistema: true,
        texto:
          "[SISTEMA] Registrar tendencia térmica cada 5 min y adjuntar en expediente cifrado store-and-forward (V1 6002, V1 7001).",
      },
    ],
  },
  "PROTO-COND-05": {
    titulo: "Alteración del Estado de Ánimo o Sobrecarga Conductual",
    referencias: "V1 3004.q, Tabla E.2-2 (*), V2 5007 (Bedford), V2 7071 (Privacidad), V1 6010",
    pasos: [
      {
        sistema: true,
        texto:
          "[SISTEMA] Habilitar sesión de protocolo conductual asíncrono en dispositivo privado (V1 3004.q, V2 7071).",
      },
      {
        sistema: false,
        texto:
          "Reducir carga cognitiva operativa (mantener escala Bedford ≤ 3 en nominal / ≤ 6 degradado, V2 5007).",
      },
      {
        sistema: true,
        texto:
          "[SISTEMA] Preparar nota cifrada privada para Conferencia Psicológica Privada diferida (V1 6010, store-and-forward).",
      },
    ],
  },
  "PROTO-NOM-00": {
    titulo: "Vigilancia Nominal en Tránsito a Marte",
    referencias: "V1 3004.h, V1 6001, V1 7001, V2 6001",
    pasos: [
      {
        sistema: true,
        texto:
          "[SISTEMA] Registro continuo de tendencias en historia clínica electrónica cifrada (V1 3004.a, V1 7001).",
      },
      {
        sistema: false,
        texto:
          "Mantener recordatorios periódicos de medición manual de glucemia (mg/dL) y autorreporte de ánimo.",
      },
    ],
  },
};

function parseBaseScore(raw) {
  if (Array.isArray(raw)) return raw.map(Number);
  if (typeof raw === "string") {
    const cleaned = raw.trim().replace(/^\[|\]$/g, "");
    return cleaned.split(",").map((v) => Number(v.trim()));
  }
  return [0, 0, 0];
}

function softmax(logits) {
  const maxL = Math.max(...logits);
  const exps = logits.map((v) => Math.exp(v - maxL));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

class XgbTreeEvaluator {
  constructor(modelJson) {
    const learner = modelJson.learner;
    const model = learner.gradient_booster.model;
    this.numClass = Number(learner.learner_model_param.num_class || 3);
    this.baseScore = parseBaseScore(learner.learner_model_param.base_score);
    this.trees = model.trees;
    this.treeInfo = model.tree_info;
  }

  predictProbaAndAttrib(xVec) {
    const margins = [...this.baseScore];
    const contribsByClass = Array.from({ length: this.numClass }, () =>
      new Float64Array(xVec.length)
    );

    for (let t = 0; t < this.trees.length; t++) {
      const tree = this.trees[t];
      const cls = this.treeInfo[t] ?? t % this.numClass;
      const left = tree.left_children;
      const right = tree.right_children;
      const splitIdx = tree.split_indices;
      const splitCond = tree.split_conditions;
      const weights = tree.base_weights;

      let node = 0;
      while (left[node] !== -1) {
        const fIdx = splitIdx[node];
        const fVal = xVec[fIdx];
        const nextNode = fVal < splitCond[node] ? left[node] : right[node];
        contribsByClass[cls][fIdx] += weights[nextNode] - weights[node];
        node = nextNode;
      }
      margins[cls] += weights[node];
    }

    const proba = softmax(margins);
    return { proba, contribsByClass };
  }
}

export class MotorInferencia {
  constructor(modelJson) {
    this.xgb = new XgbTreeEvaluator(modelJson);
    this.biomarkersCfg = cargarUmbralesNasa().biomarkers;
    this._ultimoEstadoRiesgo = null;
    this._ultimoNivelNasa = null;
    this._ultimoProtocolo = null;
    this._ultimoDiagnostico = null;
    this._ultimasDirectivas = [];
  }

  _construirTop3Shap(lectura, shapVec) {
    const shapTodos = {};
    FEATURE_NAMES.forEach((v, idx) => {
      shapTodos[v] = Number(shapVec[idx]);
    });

    const ordenados = FEATURE_NAMES.map((v, idx) => ({ idx, v })).sort(
      (a, b) => Math.abs(shapVec[b.idx]) - Math.abs(shapVec[a.idx])
    );

    const top3 = ordenados.slice(0, 3).map(({ idx, v }) => {
      const cfg = this.biomarkersCfg[v];
      const val = Number(lectura[v]);
      const sVal = Number(shapVec[idx]);
      const [normMin, normMax] = cfg.normal;
      return {
        variable: v,
        nombre: ETIQUETAS_LEGIBLES[v] || v,
        valor: val,
        unidad: cfg.unit,
        rango_nominal: `${normMin} – ${normMax}`,
        shap_valor: sVal,
        magnitud_abs: Math.abs(sVal),
        direccion: sVal >= 0 ? "Impulsa este estado" : "Atenúa este estado",
      };
    });

    return { top3, shapTodos };
  }

  _seleccionarProtocoloYAlcance(
    claseRiesgo,
    nivelNasa,
    lectura,
    top3Shap,
    detInfo,
    cabinEnv,
    emergenciaManual
  ) {
    if (emergenciaManual) return ["PROTO-CV-01", true];
    if (claseRiesgo === 0 && !detInfo.disparada) return ["PROTO-NOM-00", false];

    const topVar = top3Shap[0].variable;
    const varsTop2 = new Set(top3Shap.slice(0, 2).map((item) => item.variable));
    const tempCentral = Number(detInfo.temp_central_est);
    const excede = Boolean(detInfo.excede_alcance) || nivelNasa === "Emergency";

    const piO2 = cabinEnv.pi_o2_mmhg ?? 150.0;
    const ppco2 = cabinEnv.ppco2_mmhg ?? 1.8;
    const cabinaEnRango = piO2 >= 127.0 && ppco2 <= 3.0;

    if (
      cabinaEnRango &&
      (lectura.anomalia_ecg > 0.35 ||
        (lectura.frec_cardiaca > 135.0 && lectura.anomalia_ecg > 0.25))
    ) {
      return [
        "PROTO-CV-01",
        excede || (lectura.anomalia_ecg > 0.35 && lectura.frec_cardiaca > 125.0),
      ];
    }

    if (
      lectura.spo2 < 92.0 ||
      piO2 < 127.0 ||
      ppco2 > 3.0 ||
      (lectura.spo2 < 95.8 &&
        (["spo2", "frec_respiratoria", "vol_respiratorio"].includes(topVar) ||
          varsTop2.has("spo2")))
    ) {
      return ["PROTO-RESP-02", excede || lectura.spo2 < 90.0];
    }

    if (
      tempCentral < 35.0 ||
      tempCentral > 38.4 ||
      lectura.temp_corporal > 37.5 ||
      lectura.temp_corporal < 35.2 ||
      (topVar === "temp_corporal" &&
        !(lectura.temp_corporal >= 35.6 && lectura.temp_corporal <= 36.9))
    ) {
      return ["PROTO-TERM-04", excede || tempCentral < 35.0];
    }

    if (
      lectura.anomalia_ecg > 0.35 ||
      lectura.frec_cardiaca > 130.0 ||
      lectura.presion_sistolica > 145.0 ||
      lectura.presion_sistolica < 90.0 ||
      (["frec_cardiaca", "presion_sistolica", "anomalia_ecg"].includes(topVar) &&
        lectura.horas_sueno >= 6.8)
    ) {
      return [
        "PROTO-CV-01",
        excede || (lectura.anomalia_ecg > 0.35 && lectura.frec_cardiaca > 125.0),
      ];
    }

    if (
      lectura.glucemia < 70.0 ||
      lectura.glucemia > 140.0 ||
      lectura.horas_sueno < 7.5 ||
      lectura.eficiencia_sueno < 80.0 ||
      ["glucemia", "horas_sueno", "eficiencia_sueno"].includes(topVar)
    ) {
      return [
        "PROTO-MET-03",
        excede || lectura.glucemia < 55.0 || lectura.glucemia > 220.0,
      ];
    }

    if (lectura.estado_animo < 6.5 || topVar === "estado_animo") {
      return ["PROTO-COND-05", excede];
    }

    return ["PROTO-CV-01", excede];
  }

  _diagnosticoRespaldoReglas({
    claseRiesgo,
    nivelNasa,
    protocoloCodigo,
    excedeAlcance,
    lectura,
    top3Shap,
    detInfo,
    cabinEnv,
    emergenciaManual,
  }) {
    const tag = `[ALERTA: ${nivelNasa.toUpperCase()} | ${protocoloCodigo}]`;
    const tempCentral = Number(detInfo.temp_central_est);

    if (emergenciaManual) {
      return [
        `${tag} Activación manual de emergencia (V2 10178): posible dolor torácico o colapso en tránsito.`,
        [
          "Asegurar vía aérea, verificar respuesta/pulso e iniciar RCP o DEA si corresponde (V1 5001-5002).",
          "EXCEDE ALCANCE (V2 10171): escalar a CMO (V1 3006) para ECG/ecografía a bordo (V1 3004.i, V1 5003) y envío store-and-forward (V1 6002).",
        ],
      ];
    }

    if (claseRiesgo === 0 && nivelNasa === "Nominal") {
      const topVars = top3Shap.slice(0, 2).map((i) => i.variable).join(", ");
      return [
        `${tag} Estabilidad fisiológica en microgravedad confirmada por ${topVars} dentro de línea base.`,
        [
          "Continuar cronograma nominal de tránsito y verificar cumplimiento de 8,5 h de sueño (V1 6001).",
          "Mantener vigilancia continua Astroskin/Actiwatch y registro periódico de glucemia (mg/dL) y ánimo.",
        ],
      ];
    }

    if (nivelNasa === "Advisory") {
      return [
        `${tag} Datos manuales obsoletos (estado Cian, V2 10020) o desviación menor sin criterio Caution.`,
        [
          "Actualizar medición capilar de glucemia (mg/dL) y autorreporte breve de estado de ánimo.",
          "Mantener registro continuo de tendencias en historia clínica cifrada (V1 3004.a, V1 7001).",
        ],
      ];
    }

    if (protocoloCodigo === "PROTO-RESP-02") {
      const piO2 = cabinEnv.pi_o2_mmhg ?? 150.0;
      const ppco2 = cabinEnv.ppco2_mmhg ?? 1.8;
      if (claseRiesgo === 2 || excedeAlcance) {
        return [
          `${tag} Compromiso respiratorio severo (SpO₂=${lectura.spo2} %, P_I O₂=${piO2} mmHg, ppCO₂=${ppco2} mmHg).`,
          [
            "Colocar oxígeno suplementario al 100 %, suspender esfuerzo (V2 10200) y aislar fallo ECLSS / CO₂ (V2 6004).",
            "EXCEDE ALCANCE (V2 10171): escalar a ecografía pulmonar/ECG a bordo (V1 3004.i) y envío store-and-forward (V1 6002).",
          ],
        ];
      }
      return [
        `${tag} Hipoxia o hipercapnia leve (SpO₂=${lectura.spo2} %, FR=${lectura.frec_respiratoria} rpm, P_I O₂=${piO2} mmHg).`,
        [
          "Ejecutar respiración diafragmática controlada 5 min y verificar depuración ppCO₂ ≤ 3 mmHg (V2 6004).",
          "Repetir oximetría Astroskin en 5 min y validar si el pico responde a actividad física.",
        ],
      ];
    }

    if (protocoloCodigo === "PROTO-TERM-04") {
      if (tempCentral < 35.0) {
        return [
          `${tag} Hipotermia central estimada (${tempCentral.toFixed(2)} °C < 35,0 °C Vol. 1 Apéndice C; piel=${lectura.temp_corporal} °C).`,
          [
            "Confirmar temperatura central/oral, activar recalentamiento progresivo y elevar cabina a 22–25 °C (V2 6012).",
            "EXCEDE ALCANCE (V2 10171): vigilar ECG continuo (V1 3004.i) cada 5 min y transmitir paquete store-and-forward (V1 6002).",
          ],
        ];
      }
      if (claseRiesgo === 2 || excedeAlcance) {
        return [
          `${tag} Sobrecarga térmica crítica (piel=${lectura.temp_corporal} °C, central est.=${tempCentral.toFixed(2)} °C, V2 11011).`,
          [
            "Activar prenda de enfriamiento líquido LCVG al máximo y cesar actividad metabólica intensa.",
            "EXCEDE ALCANCE (V2 10171): evaluar ECG/hemodinamia por CMO (V1 3004.i) y enviar registro store-and-forward (V1 6002).",
          ],
        ];
      }
      return [
        `${tag} Deriva térmica preventiva (piel=${lectura.temp_corporal} °C, central est.=${tempCentral.toFixed(2)} °C).`,
        [
          "Ajustar ambiente térmico de cabina hacia confort (20–25 °C, Fig. 6.2-2) e hidratar con 500 ml.",
          "Validar temperatura oral/central para distinguir variación cutánea de central (V2 11011).",
        ],
      ];
    }

    if (protocoloCodigo === "PROTO-MET-03") {
      if (claseRiesgo === 2 || excedeAlcance) {
        return [
          `${tag} Desregulación metabólica y privación de sueño (${lectura.horas_sueno} h vs 8,5 h V1 6001; glucemia=${lectura.glucemia} mg/dL).`,
          [
            "Corregir glucemia inmediata (15–20 g glucosa oral si < 70 mg/dL) y transferir tareas críticas a otro tripulante.",
            "EXCEDE ALCANCE (V2 10171): cumplir recuperación de sueño protegida (NC-40, ≤ 0,02 lux) y enviar reporte diferido (V1 6002).",
          ],
        ];
      }
      return [
        `${tag} Déficit acumulado de sueño (${lectura.horas_sueno} h) con deriva glucémica (${lectura.glucemia} mg/dL, V2 8055).`,
        [
          "Aplicar iluminación circadiana (≥ 250 lux EDI vigilia / 8 ± 2 lux pre-sueño, V2 8055) y asegurar ingesta calórica (V1 4020).",
          "Evitar tareas críticas en nadir circadiano (1–7 AM relativo) y recontrolar glucemia en 30 min.",
        ],
      ];
    }

    if (protocoloCodigo === "PROTO-COND-05") {
      return [
        `${tag} Alteración afectiva/conductual detectada (ánimo=${lectura.estado_animo}/10, Tabla E.2-2).`,
        [
          "Iniciar protocolo conductual asíncrono en dispositivo privado (V1 3004.q, privacidad V2 7071).",
          "Reducir carga cognitiva (Bedford ≤ 3, V2 5007) y registrar nota cifrada para PPC diferida (V1 6010).",
        ],
      ];
    }

    if (claseRiesgo === 2 || excedeAlcance) {
      return [
        `${tag} Evento cardiovascular agudo (FC=${lectura.frec_cardiaca.toFixed(0)} lpm, PAS=${lectura.presion_sistolica} mmHg, ECG=${lectura.anomalia_ecg}).`,
        [
          "Detener maniobras, adoptar reposo inmediato y evaluar síntomas torácicos o colapso (Tabla E.2-2).",
          "EXCEDE ALCANCE (V2 10171): activar CMO (V1 3006) para ECG 3-derivaciones y ecografía a bordo (V1 3004.i, V1 5003) + store-and-forward (V1 6002).",
        ],
      ];
    }
    return [
      `${tag} Sobrecarga cardiovascular moderada (FC=${lectura.frec_cardiaca.toFixed(0)} lpm, PAS=${lectura.presion_sistolica} mmHg).`,
      [
        "Reducir carga física en 50 % y aplicar hidratación isotónica con reposo neutro (V2 7042).",
        "Vigilar tendencia de ECG y presión arterial cada 5 min hasta retorno a línea base (V1 3004.h).",
      ],
    ];
  }

  evaluar({
    lectura,
    cabinEnv = null,
    emergenciaManual = false,
    datosObsoletos = false,
  }) {
    const t0 = performance.now();
    const cabin = cabinEnv || { ...CABIN_ENV_NOMINAL };
    const fila = {};
    const xVec = FEATURE_NAMES.map((v) => {
      const val = Number(lectura[v]);
      fila[v] = val;
      return val;
    });

    const detInfo = evaluarReglasDeterministasCriticas(fila, cabin, emergenciaManual);
    const { proba, contribsByClass } = this.xgb.predictProbaAndAttrib(xVec);

    let claseXgb = 0;
    if (proba[1] > proba[claseXgb]) claseXgb = 1;
    if (proba[2] > proba[claseXgb]) claseXgb = 2;

    const claseRiesgo = detInfo.disparada ? 2 : claseXgb;
    const etiqueta = RISK_LABELS[claseRiesgo];
    const probabilidades = {
      [RISK_LABELS[0]]: proba[0],
      [RISK_LABELS[1]]: proba[1],
      [RISK_LABELS[2]]: proba[2],
    };

    const { top3: top3Shap, shapTodos } = this._construirTop3Shap(
      fila,
      contribsByClass[claseRiesgo]
    );

    let nivelNasa;
    if (emergenciaManual || detInfo.nivel_nasa === "Emergency") {
      nivelNasa = "Emergency";
    } else if (claseRiesgo === 2) {
      nivelNasa = "Warning";
    } else if (claseRiesgo === 1) {
      nivelNasa = "Caution";
    } else if (datosObsoletos) {
      nivelNasa = "Advisory";
    } else {
      nivelNasa = "Nominal";
    }

    const [protocoloCodigo, excedeAlcance] = this._seleccionarProtocoloYAlcance(
      claseRiesgo,
      nivelNasa,
      fila,
      top3Shap,
      detInfo,
      cabin,
      emergenciaManual
    );

    const latenciaMlMs = performance.now() - t0;

    const [diagnostico, directivas] = this._diagnosticoRespaldoReglas({
      claseRiesgo,
      nivelNasa,
      protocoloCodigo,
      excedeAlcance,
      lectura: fila,
      top3Shap,
      detInfo,
      cabinEnv: cabin,
      emergenciaManual,
    });

    this._ultimoEstadoRiesgo = claseRiesgo;
    this._ultimoNivelNasa = nivelNasa;
    this._ultimoProtocolo = protocoloCodigo;
    this._ultimoDiagnostico = diagnostico;
    this._ultimasDirectivas = directivas;

    const now = new Date();
    const timestamp = now.toTimeString().slice(0, 8);

    return {
      estado_riesgo: claseRiesgo,
      etiqueta_riesgo: etiqueta,
      nivel_nasa: nivelNasa,
      protocolo_codigo: protocoloCodigo,
      procedimiento_electronico:
        PROCEDIMIENTOS_ELECTRONICOS[protocoloCodigo] ||
        PROCEDIMIENTOS_ELECTRONICOS["PROTO-NOM-00"],
      excede_alcance: excedeAlcance,
      regla_determinista_disparada: detInfo.disparada,
      razones_deterministas: detInfo.razones,
      temp_central_est: detInfo.temp_central_est,
      latencia_ml_ms: Math.round(latenciaMlMs * 100) / 100,
      probabilidades,
      top3_shap: top3Shap,
      shap_todos: shapTodos,
      diagnostico,
      directivas: directivas.slice(0, 2),
      origen_diagnostico: "Respaldo Reglas NASA (Web Offline)",
      llm_actualizado: true,
      timestamp,
    };
  }

  consultarAsistenteInteractivo({ pregunta, lectura, resultadoActual }) {
    const preguntaLimpia = String(pregunta || "").trim();
    if (!preguntaLimpia) {
      return {
        respuesta: "Ingresa una consulta operativa o clínica.",
        origen: "Sistema",
      };
    }

    const evalActual = resultadoActual || this.evaluar({ lectura });
    const nivelNasa = evalActual.nivel_nasa;
    const protocolo = evalActual.protocolo_codigo;
    const directivasTxt = evalActual.directivas
      .map((d, i) => `(${i + 1}) ${d}`)
      .join(" ");
    const factoresTxt = evalActual.top3_shap
      .map((item) => `${item.nombre} (${item.valor} ${item.unidad})`)
      .join(", ");
    const avisoAlcance = evalActual.excede_alcance
      ? " Aviso V2 10171: el cuadro excede el alcance del triaje automático; escalar a ECG/ecografía a bordo (V1 3004.i) por el CMO (V1 3006) y empaquetar para transmisión diferida store-and-forward (V1 6002)."
      : "";

    return {
      respuesta: `[Alerta ${nivelNasa} | ${protocolo}] ${evalActual.diagnostico} Factores SHAP determinantes: ${factoresTxt}. Acciones operativas: ${directivasTxt}.${avisoAlcance}`,
      origen: "Respaldo Reglas NASA (Web Offline)",
    };
  }
}

