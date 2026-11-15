import {
  CABIN_ENV_NOMINAL,
  FEATURE_NAMES,
  RISK_LABELS,
  cargarUmbralesNasa,
  evaluarReglasDeterministasCriticas,
} from "./nasaReferencia";

export const ETIQUETAS_LEGIBLES = {
  presion_sistolica: "Systolic Blood Pressure",
  temp_corporal: "Skin Temp. (Astroskin)",
  nivel_actividad: "Activity Level",
  spo2: "O₂ Saturation (SpO₂)",
  frec_respiratoria: "Respiratory Rate",
  vol_respiratorio: "Respiratory Volume",
  frec_cardiaca: "Heart Rate",
  anomalia_ecg: "ECG Anomaly",
  eficiencia_sueno: "Sleep Efficiency",
  glucemia: "Blood Glucose",
  horas_sueno: "Daily Sleep Hours",
  estado_animo: "Mood State",
};

export const PROCEDIMIENTOS_ELECTRONICOS = {
  "PROTO-CV-01": {
    titulo: "Acute Cardiovascular Event / Chest Pain or Collapse",
    referencias: "Mission Brief, Vol. 1 Table E.2-2",
    pasos: [
      {
        sistema: true,
        texto:
          "[SYSTEM] Lock out critical maneuvers and activate continuous vital signs and ECG logging.",
      },
      {
        sistema: false,
        texto:
          "Assess crewmember consciousness, breathing, and pulse; initiate CPR/AED if collapsed.",
      },
      {
        sistema: false,
        texto:
          "Summon Crew Medical Officer to acquire 3-lead ECG and onboard ultrasound imaging.",
      },
      {
        sistema: true,
        texto:
          "[SYSTEM] Package ECG trace, SHAP, and vital signs into encrypted store-and-forward batch for Earth.",
      },
    ],
  },
  "PROTO-RESP-02": {
    titulo: "Hypoxia or Hypercapnia in Pressurized Cabin",
    referencias: "V2 6003-6004, Table 6.2-1, V1 Rev. B 3.1.5.f",
    pasos: [
      {
        sistema: true,
        texto:
          "[SYSTEM] Cross-check SpO₂ with cabin environmental sensors P_I O₂ (145–155 mmHg) and ppCO₂ (≤ 3 mmHg).",
      },
      {
        sistema: false,
        texto:
          "Deliver 100% supplemental oxygen if SpO₂ < 92% or P_I O₂ < 127 mmHg and halt physical activity.",
      },
      {
        sistema: false,
        texto: "Inspect CO₂ scrubbers and habitable module seals.",
      },
      {
        sistema: true,
        texto:
          "[SYSTEM] If hypoxemia < 90% persists, escalate to lung ultrasound and deferred logging.",
      },
    ],
  },
  "PROTO-MET-03": {
    titulo: "Sleep Deprivation, Circadian Misalignment & Glycemic Dysregulation",
    referencias: "V1 6001 (8.5 h)",
    pasos: [
      {
        sistema: true,
        texto:
          "[SYSTEM] Verify deficit against 8.5 h/day target and metabolic/glycemic correlation.",
      },
      {
        sistema: false,
        texto:
          "If blood glucose < 70 mg/dL in a conscious crewmember, administer 15–20 g fast-acting carbs and re-evaluate in 15 min.",
      },
      {
        sistema: false,
        texto:
          "Apply circadian lighting and reschedule critical tasks outside 1–7 AM nadir.",
      },
      {
        sistema: true,
        texto:
          "[SYSTEM] Activate protected rest block and store-and-forward transmission to medical team.",
      },
    ],
  },
  "PROTO-TERM-04": {
    titulo: "Core Hypothermia (< 35 °C) or Skin/Core Thermal Stress",
    referencias: "Vol. 1 Appendix C (< 35 °C), Fig. 6.2-2",
    pasos: [
      {
        sistema: true,
        texto:
          "[SYSTEM] Compare skin temperature (Astroskin) with estimated core temperature.",
      },
      {
        sistema: false,
        texto:
          "Confirm reading with core/oral thermometry; for hypothermia (< 35.0 °C) apply progressive rewarming and thermal insulation.",
      },
      {
        sistema: false,
        texto:
          "For hyperthermic stress, activate LCVG cooling or adjust cabin to comfort zone (20–25 °C, 30–60% RH).",
      },
      {
        sistema: true,
        texto:
          "[SYSTEM] Log thermal trend every 5 min and attach to encrypted store-and-forward record.",
      },
    ],
  },
  "PROTO-COND-05": {
    titulo: "Mood Alteration or Behavioral Overload",
    referencias: "V1 3004.q, Table E.2-2 (*) (Bedford) (Privacy)",
    pasos: [
      {
        sistema: true,
        texto:
          "[SYSTEM] Enable asynchronous behavioral protocol session on private device.",
      },
      {
        sistema: false,
        texto:
          "Reduce operational cognitive workload.",
      },
      {
        sistema: true,
        texto:
          "[SYSTEM] Prepare encrypted private note for deferred Private Psychological Conference.",
      },
    ],
  },
  "PROTO-NOM-00": {
    titulo: "Nominal Mars Transit Monitoring",
    referencias: "V1 3004.h",
    pasos: [
      {
        sistema: true,
        texto:
          "[SYSTEM] Continuous trend logging in encrypted electronic medical record.",
      },
      {
        sistema: false,
        texto:
          "Maintain periodic reminders for manual blood glucose measurement (mg/dL) and mood self-report.",
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
        const nextNode = fVal < splitCond[node] ? left[node]: right[node];
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
        direccion: sVal >= 0 ? "Drives this state": "Mitigates this state",
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
    const tag = `[ALERT: ${nivelNasa.toUpperCase()} | ${protocoloCodigo}]`;
    const tempCentral = Number(detInfo.temp_central_est);

    if (emergenciaManual) {
      return [
        `${tag} Manual emergency activation: possible chest pain or transit collapse.`,
        [
          "Secure airway, verify response/pulse, and initiate CPR or AED if indicated.",
          "EXCEEDS SCOPE: escalate to CMO for onboard ECG/ultrasound and store-and-forward dispatch.",
        ],
      ];
    }

    if (claseRiesgo === 0 && nivelNasa === "Nominal") {
      const topVars = top3Shap.slice(0, 2).map((i) => i.variable).join(", ");
      return [
        `${tag} Physiological stability in microgravity confirmed by ${topVars} within baseline.`,
        [
          "Continue nominal transit schedule and verify 8.5 h sleep compliance.",
          "Maintain continuous Astroskin/Actiwatch monitoring and periodic blood glucose (mg/dL) and mood logging.",
        ],
      ];
    }

    if (nivelNasa === "Advisory") {
      return [
        `${tag} Stale manual data or minor deviation below Caution threshold.`,
        [
          "Update capillary blood glucose measurement (mg/dL) and brief mood self-report.",
          "Maintain continuous trend logging in encrypted medical record.",
        ],
      ];
    }

    if (protocoloCodigo === "PROTO-RESP-02") {
      const piO2 = cabinEnv.pi_o2_mmhg ?? 150.0;
      const ppco2 = cabinEnv.ppco2_mmhg ?? 1.8;
      if (claseRiesgo === 2 || excedeAlcance) {
        return [
          `${tag} Severe respiratory compromise (SpO₂=${lectura.spo2}%, P_I O₂=${piO2} mmHg, ppCO₂=${ppco2} mmHg).`,
          [
            "Deliver 100% supplemental oxygen, halt exertion, and isolate ECLSS / CO₂ failure.",
            "EXCEEDS SCOPE: escalate to onboard lung ultrasound/ECG and store-and-forward dispatch.",
          ],
        ];
      }
      return [
        `${tag} Mild hypoxia or hypercapnia (SpO₂=${lectura.spo2}%, RR=${lectura.frec_respiratoria} rpm, P_I O₂=${piO2} mmHg).`,
        [
          "Perform controlled diaphragmatic breathing for 5 min and verify ppCO₂ scrubbing ≤ 3 mmHg.",
          "Repeat Astroskin oximetry in 5 min and validate whether peak correlates with physical activity.",
        ],
      ];
    }

    if (protocoloCodigo === "PROTO-TERM-04") {
      if (tempCentral < 35.0) {
        return [
          `${tag} Estimated core hypothermia (${tempCentral.toFixed(2)} °C < 35.0 °C Vol. 1 Appendix C; skin=${lectura.temp_corporal} °C).`,
          [
            "Confirm core/oral temperature, activate progressive rewarming, and raise cabin to 22–25 °C.",
            "EXCEEDS SCOPE: monitor continuous ECG every 5 min and transmit store-and-forward package.",
          ],
        ];
      }
      if (claseRiesgo === 2 || excedeAlcance) {
        return [
          `${tag} Critical thermal overload (skin=${lectura.temp_corporal} °C, est. core=${tempCentral.toFixed(2)} °C).`,
          [
            "Activate liquid cooling garment (LCVG) at maximum and cease intense metabolic activity.",
            "EXCEEDS SCOPE: evaluate ECG/hemodynamics via CMO and send store-and-forward log.",
          ],
        ];
      }
      return [
        `${tag} Preventive thermal drift (skin=${lectura.temp_corporal} °C, est. core=${tempCentral.toFixed(2)} °C).`,
        [
          "Adjust cabin thermal environment toward comfort and hydrate with 500 ml.",
          "Validate oral/core temperature to distinguish skin variation from core shift.",
        ],
      ];
    }

    if (protocoloCodigo === "PROTO-MET-03") {
      if (claseRiesgo === 2 || excedeAlcance) {
        return [
          `${tag} Metabolic dysregulation and sleep deprivation.`,
          [
            "Correct glucose immediately (15–20 g oral glucose if < 70 mg/dL) and transfer critical tasks to another crewmember.",
            "EXCEEDS SCOPE: enforce protected sleep recovery and send deferred report.",
          ],
        ];
      }
      return [
        `${tag} Cumulative sleep deficit (${lectura.horas_sueno} h) with glycemic drift.`,
        [
          "Apply circadian lighting and ensure caloric intake.",
          "Avoid critical tasks during circadian nadir (1–7 AM relative) and recheck glucose in 30 min.",
        ],
      ];
    }

    if (protocoloCodigo === "PROTO-COND-05") {
      return [
        `${tag} Affective/behavioral alteration detected.`,
        [
          "Start asynchronous behavioral protocol on private device.",
          "Reduce cognitive workload and log encrypted note for deferred PPC.",
        ],
      ];
    }

    if (claseRiesgo === 2 || excedeAlcance) {
      return [
        `${tag} Acute cardiovascular event (HR=${lectura.frec_cardiaca.toFixed(0)} bpm, SBP=${lectura.presion_sistolica} mmHg, ECG=${lectura.anomalia_ecg}).`,
        [
          "Halt maneuvers, adopt immediate rest, and assess chest symptoms or collapse.",
          "EXCEEDS SCOPE: activate CMO for 3-lead ECG and onboard ultrasound + store-and-forward.",
        ],
      ];
    }
    return [
      `${tag} Moderate cardiovascular overload (HR=${lectura.frec_cardiaca.toFixed(0)} bpm, SBP=${lectura.presion_sistolica} mmHg).`,
      [
        "Reduce physical workload by 50% and apply isotonic hydration with neutral rest.",
        "Monitor ECG and blood pressure trend every 5 min until return to baseline.",
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
    const cabin = cabinEnv || {...CABIN_ENV_NOMINAL };
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

    const claseRiesgo = detInfo.disparada ? 2: claseXgb;
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
      origen_diagnostico: "NASA Rules Engine (Web Offline)",
      llm_actualizado: true,
      timestamp,
    };
  }

  consultarAsistenteInteractivo({ pregunta, lectura, resultadoActual }) {
    const preguntaLimpia = String(pregunta || "").trim();
    if (!preguntaLimpia) {
      return {
        respuesta: "Enter an operational or clinical query.",
        origen: "System",
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
      ? " Notice V2 10171: presentation exceeds automated triage scope; escalate to onboard ECG/ultrasound by CMO and package for deferred store-and-forward transmission."
: "";

    return {
      respuesta: `[Alert ${nivelNasa} | ${protocolo}] ${evalActual.diagnostico} Key SHAP factors: ${factoresTxt}. Operational actions: ${directivasTxt}.${avisoAlcance}`,
      origen: "NASA Rules Engine (Web Offline)",
    };
  }
}

