import {
  CONSIGNA_SIX_INDICATORS,
  FEATURE_NAMES,
  NASA_ALERT_LEVELS,
  cargarUmbralesNasa,
  obtenerReferenciasOsdr,
} from "./nasaReferencia";
import { ESCENARIOS_OBJETIVO, LIMITES_FISICOS, SimuladorSensores } from "./simuladorSensores";
import { ETIQUETAS_LEGIBLES, MotorInferencia } from "./motorInferencia";

const CREW_TEMPLATES = {
  koch: {
    id: "koch",
    name: "Spec. Christina Koch",
    role: "Mission Specialist",
    height: "170 cm",
    weight: "61 kg",
    bmi: "21.1",
    blood: "O+",
    skin: "#F4CBB2",
    hair: "#6B3410",
    seed: 42,
    initial_scenario: "nominal",
    initial_overrides: {
      presion_sistolica: 118.0,
      frec_cardiaca: 68.0,
      glucemia: 88.0,
      temp_corporal: 36.15,
      horas_sueno: 8.2,
      estado_animo: 9.1,
    },
    radiation_rate: 0.84,
    radiation_total: 156.2,
    pvt_ms: 238,
  },
  glover: {
    id: "glover",
    name: "Cmdr. Victor Glover",
    role: "Mission Commander",
    height: "183 cm",
    weight: "86 kg",
    bmi: "25.7",
    blood: "A+",
    skin: "#8C5327",
    hair: "#1A1A1D",
    seed: 108,
    initial_scenario: "sobrecarga_cardiovascular_preventiva",
    initial_overrides: {
      presion_sistolica: 135.0,
      frec_cardiaca: 96.0,
      glucemia: 94.0,
      temp_corporal: 36.35,
      horas_sueno: 7.8,
      estado_animo: 8.7,
    },
    radiation_rate: 1.18,
    radiation_total: 219.5,
    pvt_ms: 248,
  },
  kim: {
    id: "kim",
    name: "Dr. Jonny Kim",
    role: "Flight Surgeon / CMO",
    height: "178 cm",
    weight: "77 kg",
    bmi: "24.3",
    blood: "B+",
    skin: "#E6BF9E",
    hair: "#14161B",
    seed: 215,
    initial_scenario: "sueno_glucemia_preventiva",
    initial_overrides: {
      presion_sistolica: 115.0,
      frec_cardiaca: 64.0,
      glucemia: 86.0,
      temp_corporal: 36.0,
      horas_sueno: 5.8,
      estado_animo: 8.2,
    },
    radiation_rate: 0.92,
    radiation_total: 171.1,
    pvt_ms: 328,
  },
};

function estimarPresionDiastolica(presionSistolica) {
  const dia = Math.round(52.0 + (Number(presionSistolica) - 80.0) * 0.52);
  return Math.max(45, Math.min(118, dia));
}

function nowTimeStr() {
  return new Date().toTimeString().slice(0, 8);
}

class PerfilTripulante {
  constructor(cfg) {
    this.meta = { ...cfg };
    this.simulador = new SimuladorSensores(Number(cfg.seed));
    this.simulador.activarEscenario(cfg.initial_scenario, true);
    for (const [k, val] of Object.entries(cfg.initial_overrides || {})) {
      this.simulador.valores_actuales[k] = Number(val);
      this.simulador._objetivo_actual[k] = Number(val);
    }

    this.historico = [];
    this.emergencia_manual = false;
    this.alarma_silenciada = false;
    this.parpadeo_detenido = false;
    this.alerta_reconocida = false;
    this.datos_manuales_obsoletos = false;
    this.ultimo_registro_manual_ts = nowTimeStr();
    this.rutina_diaria = {
      glucemia: true,
      animo: true,
      sueno: true,
      hidratacion: false,
    };
    this.racha_dias = 12;
    this.bitacora_acciones = [];
    this.alertas_inhibidas = [];
    this.radiation_rate = Number(cfg.radiation_rate);
    this.radiation_total = Number(cfg.radiation_total);
    this.pvt_ms = Number(cfg.pvt_ms);
    this.ultimo_resultado = null;
    this.ultimo_cabin_env = this.simulador.obtenerEntornoCabina();
  }
}

class EstadoConsola {
  constructor(modelJson) {
    this.motor = new MotorInferencia(modelJson);
    this.umbrales = cargarUmbralesNasa();
    this.osdr_ref = obtenerReferenciasOsdr();
    this.simulacion_activa = true;
    this.mission_day = 186;
    this.active_crew_id = "koch";
    this.crew = {};
    for (const [cid, cfg] of Object.entries(CREW_TEMPLATES)) {
      this.crew[cid] = new PerfilTripulante(cfg);
    }
    for (const cid of ["glover", "kim", "koch"]) {
      this._tickPerfil(this.crew[cid], true);
    }
  }

  get perfilActivo() {
    return this.crew[this.active_crew_id];
  }

  _tickPerfil(perfil, forzarTick = false) {
    if (this.simulacion_activa || forzarTick || perfil.historico.length === 0) {
      const lectura = perfil.simulador.leerSensores();
      const cabinEnv = perfil.simulador.obtenerEntornoCabina();
      const stale =
        Boolean(perfil.datos_manuales_obsoletos) ||
        (!this.simulacion_activa && !forzarTick);
      const resultado = this.motor.evaluar({
        lectura,
        cabinEnv,
        emergenciaManual: perfil.emergencia_manual,
        datosObsoletos: stale,
      });
      perfil.ultimo_resultado = resultado;
      perfil.ultimo_cabin_env = cabinEnv;

      const fila = {
        ...lectura,
        timestamp: resultado.timestamp,
        estado_riesgo: resultado.estado_riesgo,
        temp_central_est: resultado.temp_central_est,
        pi_o2_mmhg: cabinEnv.pi_o2_mmhg,
        ppco2_mmhg: cabinEnv.ppco2_mmhg,
      };
      perfil.historico.push(fila);
      if (perfil.historico.length > 90) {
        perfil.historico.shift();
      }
    } else if (perfil.historico.length > 0) {
      const ultima = perfil.historico[perfil.historico.length - 1];
      const lectura = {};
      for (const k of FEATURE_NAMES) lectura[k] = Number(ultima[k]);
      const stale = Boolean(perfil.datos_manuales_obsoletos) || !this.simulacion_activa;
      perfil.ultimo_resultado = this.motor.evaluar({
        lectura,
        cabinEnv: perfil.ultimo_cabin_env,
        emergenciaManual: perfil.emergencia_manual,
        datosObsoletos: stale,
      });
    }
  }

  avanzarTick(forzarTick = false) {
    this._tickPerfil(this.perfilActivo, forzarTick);
    return this.snapshot();
  }

  _resumenTripulacion() {
    return Object.entries(this.crew).map(([cid, perfil]) => {
      const ultima = perfil.historico[perfil.historico.length - 1];
      const lectura = {};
      for (const k of FEATURE_NAMES) lectura[k] = Number(ultima[k]);
      const res = perfil.ultimo_resultado || {};
      return {
        id: cid,
        name: perfil.meta.name,
        role: perfil.meta.role,
        height: perfil.meta.height,
        weight: perfil.meta.weight,
        bmi: perfil.meta.bmi,
        blood: perfil.meta.blood,
        skin: perfil.meta.skin,
        hair: perfil.meta.hair,
        nivel_nasa: res.nivel_nasa || "Nominal",
        protocolo_codigo: res.protocolo_codigo || "PROTO-NOM-00",
        temp_central_est: res.temp_central_est ?? 37.0,
        bp_diastolic: estimarPresionDiastolica(lectura.presion_sistolica),
        radiation_rate: Math.round(perfil.radiation_rate * 100) / 100,
        radiation_total: Math.round(perfil.radiation_total * 10) / 10,
        pvt_ms: perfil.pvt_ms,
        datos_manuales_obsoletos: perfil.datos_manuales_obsoletos,
        emergencia_manual: perfil.emergencia_manual,
        lectura,
      };
    });
  }

  snapshot() {
    const p = this.perfilActivo;
    const ultima = p.historico[p.historico.length - 1];
    const lectura = {};
    for (const k of FEATURE_NAMES) lectura[k] = Number(ultima[k]);
    const escenariosMap = {};
    for (const [k, v] of Object.entries(ESCENARIOS_OBJETIVO)) {
      escenariosMap[k] = v.label;
    }

    return {
      active_crew_id: this.active_crew_id,
      mission_day: this.mission_day,
      crew_roster: this._resumenTripulacion(),
      lectura,
      extras: {
        bp_diastolic: estimarPresionDiastolica(lectura.presion_sistolica),
        radiation_rate: Math.round(p.radiation_rate * 100) / 100,
        radiation_total: Math.round(p.radiation_total * 10) / 10,
        pvt_ms: p.pvt_ms,
      },
      cabin_env: p.ultimo_cabin_env,
      resultado: p.ultimo_resultado,
      historico: [...p.historico],
      ui_state: {
        simulacion_activa: this.simulacion_activa,
        emergencia_manual: p.emergencia_manual,
        alarma_silenciada: p.alarma_silenciada,
        parpadeo_detenido: p.parpadeo_detenido,
        alerta_reconocida: p.alerta_reconocida,
        datos_manuales_obsoletos: p.datos_manuales_obsoletos,
        ultimo_registro_manual_ts: p.ultimo_registro_manual_ts,
        escenario_actual: p.simulador.escenario_actual,
        escenario_label: ESCENARIOS_OBJETIVO[p.simulador.escenario_actual].label,
        rutina_diaria: { ...p.rutina_diaria },
        racha_dias: p.racha_dias,
        bitacora_acciones: p.bitacora_acciones.slice(0, 14),
        alertas_inhibidas: [...p.alertas_inhibidas],
      },
      escenarios: escenariosMap,
      etiquetas: ETIQUETAS_LEGIBLES,
      indicadores_centrales: CONSIGNA_SIX_INDICATORS,
      nasa_levels: NASA_ALERT_LEVELS,
      umbrales: this.umbrales,
      osdr_ref: this.osdr_ref,
    };
  }

  async generarPaqueteStoreAndForward() {
    const p = this.perfilActivo;
    const ultima = p.historico[p.historico.length - 1];
    const lectura = {};
    for (const k of FEATURE_NAMES) lectura[k] = Number(ultima[k]);
    const res = p.ultimo_resultado || {};

    const payload = {
      schema: "MecaSpace-StoreAndForward-v2",
      standard_ref: "NASA-STD-3001 Vol.1 Rev.C (V1 3004.a, V1 6002) & Vol.2 Rev.E (V2 10125)",
      mission_context: `Mars Transit | Day ${this.mission_day} | 20 min/way Latency`,
      crew_member: p.meta.name,
      crew_role: p.meta.role,
      generated_utc: new Date().toISOString(),
      nasa_alert_level: res.nivel_nasa,
      protocolo_codigo: res.protocolo_codigo,
      excede_alcance_v2_10171: res.excede_alcance,
      diagnostico: res.diagnostico,
      temp_cutanea_c: lectura.temp_corporal,
      temp_central_estimada_c: res.temp_central_est,
      radiacion_mSv_dia: Math.round(p.radiation_rate * 100) / 100,
      radiacion_acumulada_mSv: Math.round(p.radiation_total * 10) / 10,
      pvt_ms: p.pvt_ms,
      telemetria: lectura,
      cabina: p.ultimo_cabin_env,
      top3_shap: res.top3_shap || [],
      acciones_ejecutadas: p.bitacora_acciones.slice(0, 14),
    };

    const raw = new TextEncoder().encode(JSON.stringify(payload));
    if (window.crypto?.subtle) {
      const hashBuf = await window.crypto.subtle.digest("SHA-256", raw);
      payload.sha256_integrity = Array.from(new Uint8Array(hashBuf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } else {
      payload.sha256_integrity = "web-crypto-unavailable";
    }
    return JSON.stringify(payload, null, 2);
  }
}

let estadoPromise = null;
let useLocalOnly =
  typeof window !== "undefined" &&
  (window.location.hostname.endsWith("github.io") ||
    window.location.protocol === "file:");

async function getEstado() {
  if (!estadoPromise) {
    estadoPromise = (async () => {
      const modelUrl = `${import.meta.env.BASE_URL || "./"}modelo_xgb.json`;
      const res = await fetch(modelUrl);
      const modelJson = await res.json();
      return new EstadoConsola(modelJson);
    })();
  }
  return estadoPromise;
}

export async function handleLocalApi(url, options = {}) {
  const estado = await getEstado();
  const parsed = new URL(url, window.location.origin);
  const path = parsed.pathname;
  const method = (options.method || "GET").toUpperCase();
  const body = options.body ? JSON.parse(options.body) : {};
  const p = estado.perfilActivo;

  if (method === "GET" && path === "/api/state") {
    const doTick = parsed.searchParams.get("tick") === "1";
    return doTick ? estado.avanzarTick(false) : estado.snapshot();
  }

  if (method === "POST") {
    if (path === "/api/crew") {
      const cid = String(body.crew_id || "koch");
      if (!(cid in estado.crew)) throw new Error(`Tripulante desconocido: ${cid}`);
      estado.active_crew_id = cid;
      return estado.avanzarTick(false);
    }

    if (path === "/api/scenario") {
      const esc = String(body.escenario || "nominal");
      if (!(esc in ESCENARIOS_OBJETIVO)) throw new Error(`Escenario desconocido: ${esc}`);
      p.emergencia_manual = false;
      p.alerta_reconocida = false;
      p.parpadeo_detenido = false;
      p.datos_manuales_obsoletos = false;
      p.simulador.activarEscenario(esc, true);
      return estado.avanzarTick(true);
    }

    if (path === "/api/adjust") {
      if (body.action === "advance_day") {
        estado.mission_day += 1;
        for (const member of Object.values(estado.crew)) {
          member.radiation_total =
            Math.round((member.radiation_total + member.radiation_rate) * 10) / 10;
        }
        p.bitacora_acciones.unshift(
          `[${nowTimeStr()}] Transit day ${estado.mission_day} logged`
        );
        return estado.snapshot();
      }

      const v = String(body.var || "");
      const delta = body.delta;
      const value = body.value;

      if (v === "radiation_rate") {
        const nxt =
          value !== undefined && value !== null
            ? Number(value)
            : p.radiation_rate + Number(delta || 0);
        p.radiation_rate = Math.round(Math.max(0.2, Math.min(2.4, nxt)) * 100) / 100;
        return estado.snapshot();
      }

      if (v === "pvt_ms") {
        const nxt =
          value !== undefined && value !== null
            ? Number(value)
            : p.pvt_ms + Number(delta || 0);
        p.pvt_ms = Math.round(Math.max(140, Math.min(650, nxt)));
        return estado.snapshot();
      }

      if (FEATURE_NAMES.includes(v)) {
        const cur = Number(p.simulador.valores_actuales[v]);
        const nxt =
          value !== undefined && value !== null ? Number(value) : cur + Number(delta || 0);
        const [limMin, limMax] = LIMITES_FISICOS[v];
        const clamped = Math.max(limMin, Math.min(limMax, nxt));
        p.simulador.valores_actuales[v] = clamped;
        p.simulador._objetivo_actual[v] = clamped;
        if (v === "glucemia" || v === "estado_animo") {
          p.datos_manuales_obsoletos = false;
          p.ultimo_registro_manual_ts = nowTimeStr();
        }
        return estado.avanzarTick(true);
      }
      throw new Error(`Variable no ajustable: ${v}`);
    }

    if (path === "/api/emergency") {
      const active = Boolean(body.active ?? true);
      p.emergencia_manual = active;
      if (active) {
        p.parpadeo_detenido = false;
        p.alerta_reconocida = false;
        p.alarma_silenciada = false;
        p.simulador.inyectarSobrecargaCardiovascular(true);
        p.bitacora_acciones.unshift(
          `[${nowTimeStr()}] Manual Chest SOS activated`
        );
      } else {
        p.simulador.restaurarNominal(true);
        p.bitacora_acciones.unshift(
          `[${nowTimeStr()}] Manual emergency deactivated → nominal return`
        );
      }
      return estado.avanzarTick(true);
    }

    if (path === "/api/alarm") {
      if (body.action === "silence") {
        p.alarma_silenciada = !p.alarma_silenciada;
        p.parpadeo_detenido = true;
      } else if (body.action === "ack") {
        p.alerta_reconocida = true;
        p.parpadeo_detenido = true;
      } else if (body.action === "stop_flash") {
        p.parpadeo_detenido = true;
      }
      return estado.snapshot();
    }

    if (path === "/api/inhibit") {
      const key = String(body.key || "").trim();
      if (key) {
        const idx = p.alertas_inhibidas.indexOf(key);
        if (idx >= 0) p.alertas_inhibidas.splice(idx, 1);
        else p.alertas_inhibidas.push(key);
      }
      return estado.snapshot();
    }

    if (path === "/api/manual") {
      if (body.toggle_stale) {
        p.datos_manuales_obsoletos = !p.datos_manuales_obsoletos;
        return estado.avanzarTick(false);
      }
      const gluc = body.glucemia;
      const animo = body.estado_animo;
      p.simulador.registrarEntradaManual(
        gluc !== undefined && gluc !== null ? Number(gluc) : null,
        animo !== undefined && animo !== null ? Number(animo) : null
      );
      p.datos_manuales_obsoletos = false;
      p.ultimo_registro_manual_ts = nowTimeStr();
      if (gluc !== undefined && gluc !== null) p.rutina_diaria.glucemia = true;
      if (animo !== undefined && animo !== null) p.rutina_diaria.animo = true;
      return estado.avanzarTick(true);
    }

    if (path === "/api/intervention") {
      const tipo = String(body.tipo || "");
      const etiqueta = String(body.etiqueta || tipo);
      const resumen = p.simulador.aplicarIntervencion(tipo);
      p.bitacora_acciones.unshift(`[${nowTimeStr()}] ${etiqueta} — ${resumen}`);
      if ((tipo === "rcp_dea" || tipo === "reposo_cv") && p.emergencia_manual) {
        p.emergencia_manual = false;
      }
      if (tipo === "glucosa_oral") p.rutina_diaria.glucemia = true;
      else if (tipo === "protocolo_conductual") p.rutina_diaria.animo = true;
      else if (tipo === "iluminacion_descanso") p.rutina_diaria.sueno = true;
      return estado.avanzarTick(true);
    }

    if (path === "/api/routine") {
      const key = String(body.key || "");
      if (key in p.rutina_diaria) {
        p.rutina_diaria[key] = !p.rutina_diaria[key];
      }
      return estado.snapshot();
    }

    if (path === "/api/control") {
      if (body.action === "toggle_play") {
        estado.simulacion_activa = !estado.simulacion_activa;
        return estado.snapshot();
      }
      if (body.action === "clear_history") {
        p.historico = [];
        return estado.avanzarTick(true);
      }
      if (body.action === "force_llm") {
        return estado.avanzarTick(false);
      }
    }

    if (path === "/api/chat") {
      const pregunta = String(body.pregunta || "").trim();
      const ultima = p.historico[p.historico.length - 1];
      const lectura = {};
      for (const k of FEATURE_NAMES) lectura[k] = Number(ultima[k]);
      return estado.motor.consultarAsistenteInteractivo({
        pregunta,
        lectura,
        resultadoActual: p.ultimo_resultado,
      });
    }
  }

  throw new Error(`Endpoint no encontrado: ${path}`);
}

export async function smartFetchJson(url, options = {}) {
  if (!useLocalOnly) {
    try {
      const res = await fetch(url, options);
      const ct = res.headers.get("content-type") || "";
      if (res.ok && ct.includes("application/json")) {
        return await res.json();
      }
    } catch {
      // Sin servidor Python local: activar motor integrado en navegador
    }
    useLocalOnly = true;
  }
  return handleLocalApi(url, options);
}

export async function handleExportDownload(e) {
  if (!useLocalOnly) {
    return;
  }
  e.preventDefault();
  const estado = await getEstado();
  const content = await estado.generarPaqueteStoreAndForward();
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mecaspace_store_and_forward.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

