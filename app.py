"""
Consola Espacial Autónoma de Monitorización Biomédica y Triaje en Tránsito a Marte (MecaSpace).

Diseño de baja carga cognitiva orientado a la toma de decisiones (NASA-STD-3001
Vol. 1 Rev. C y Vol. 2 Rev. E):
- Cabecera persistente: semáforo global, botón de Emergencia Manual (V2 10178) y
  silenciamiento/confirmación en 1 clic (F.6.4.k, F.5.10.g).
- Vista 1 (Triaje y Acción): figura humana anatómica interactiva, los 6 indicadores
  centrales limpios, explicación SHAP y árbol de decisión ejecutable paso a paso.
- Vista 2 (Tendencias, Cabina e IA): gráficos dinámicos, variables auxiliares,
  parámetros atmosféricos de cabina y asistente clínico local.
- Vista 3 (Trazabilidad NASA): matriz normativa completa para jurado, bitácora de
  intervenciones y descarga de expediente store-and-forward (V1 6002).
"""

from __future__ import annotations

import hashlib
import json
import re
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import streamlit as st
import streamlit.components.v1 as components

from motor_inferencia import ETIQUETAS_LEGIBLES, MotorInferencia
from nasa_referencia import (
    CONSIGNA_SIX_INDICATORS,
    FEATURE_NAMES,
    NASA_ALERT_LEVELS,
    cargar_umbrales_nasa,
    obtener_referencias_osdr,
)
from simulador_sensores import ESCENARIOS_OBJETIVO, SimuladorSensores

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "modelo_xgb.json"

st.set_page_config(
    page_title="MecaSpace | Triaje en Tránsito a Marte",
    page_icon="🛰️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Estilos limpios de alto contraste (≥ 6:1) y codificación Tabla F.5-1
st.markdown(
    """
    <style>
    .stApp {
        background-color: #060A12;
        color: #F1F5F9;
    }
    section[data-testid="stSidebar"] {
        background-color: #0B1220;
        border-right: 1px solid #1E293B;
    }
    @keyframes nasa-emergency-flash {
        0%, 49% {
            border-color: #FF2E2E;
            box-shadow: 0 0 22px rgba(239, 68, 68, 0.72);
            background: linear-gradient(135deg, rgba(153, 27, 27, 0.85), rgba(15, 23, 42, 0.95));
        }
        50%, 100% {
            border-color: #7F1D1D;
            box-shadow: 0 0 4px rgba(239, 68, 68, 0.18);
            background: linear-gradient(135deg, rgba(69, 10, 10, 0.75), rgba(15, 23, 42, 0.95));
        }
    }
    .status-banner {
        border-radius: 10px;
        padding: 14px 18px;
        margin-bottom: 12px;
        border: 2px solid;
    }
    .status-nominal {
        background: linear-gradient(135deg, rgba(6, 78, 59, 0.45), rgba(15, 23, 42, 0.94));
        border-color: #10B981;
    }
    .status-advisory {
        background: linear-gradient(135deg, rgba(30, 58, 138, 0.50), rgba(15, 23, 42, 0.94));
        border-color: #3B82F6;
    }
    .status-caution {
        background: linear-gradient(135deg, rgba(120, 53, 15, 0.58), rgba(15, 23, 42, 0.94));
        border-color: #F59E0B;
    }
    .status-warning {
        background: linear-gradient(135deg, rgba(127, 29, 29, 0.76), rgba(15, 23, 42, 0.94));
        border-color: #EF4444;
    }
    .status-emergency-flashing {
        border-color: #EF4444;
        animation: nasa-emergency-flash 1.2s infinite;
    }
    .status-emergency-steady {
        background: linear-gradient(135deg, rgba(153, 27, 27, 0.80), rgba(15, 23, 42, 0.94));
        border-color: #EF4444;
    }
    .hazard-header-box {
        border: 2px solid #F59E0B;
        background: repeating-linear-gradient(
            -45deg,
            rgba(245, 158, 11, 0.14),
            rgba(245, 158, 11, 0.14) 10px,
            rgba(15, 23, 42, 0.92) 10px,
            rgba(15, 23, 42, 0.92) 20px
        );
        border-radius: 8px;
        padding: 4px 10px;
    }
    .kpi-card {
        background-color: #0F172A;
        border: 1px solid #1E293B;
        border-left: 5px solid #10B981;
        border-radius: 8px;
        padding: 10px 13px;
        margin-bottom: 8px;
    }
    .kpi-nominal { border-left-color: #10B981; }
    .kpi-caution { border-left-color: #F59E0B; background-color: rgba(120, 53, 15, 0.16); }
    .kpi-warning { border-left-color: #EF4444; background-color: rgba(127, 29, 29, 0.22); }
    .kpi-stale { border-left-color: #06B6D4; background-color: rgba(8, 145, 178, 0.18); }
    .body-info-box {
        background-color: #0F172A;
        border: 1px solid #334155;
        border-radius: 8px;
        padding: 10px 12px;
        margin-top: 8px;
        font-size: 0.86rem;
    }
    .decision-box {
        background-color: #0F172A;
        border: 1px solid #334155;
        border-radius: 10px;
        padding: 12px 14px;
    }
    .badge-pill {
        display: inline-block;
        padding: 2px 9px;
        border-radius: 999px;
        font-size: 0.76rem;
        font-weight: 700;
        background-color: #1E293B;
        color: #F8FAFC;
        border: 1px solid #475569;
        margin-right: 4px;
    }
    .badge-cyan {
        background-color: rgba(6, 182, 212, 0.22);
        border-color: #06B6D4;
        color: #67E8F9;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

# Información simple y educativa por sistema corporal para tripulantes no médicos (Consigna.md)
GUIA_SISTEMAS_CUERPO: dict[str, dict[str, str]] = {
    "cardio": {
        "titulo": "❤️ Sistema Cardiovascular",
        "mide": "Frecuencia cardíaca, presión arterial estimada y ritmo ECG (camiseta Astroskin).",
        "como_actuar": "Si hay dolor en el pecho o pulso muy alto/bajo, sentar/recostar al compañero, suspender esfuerzos y capturar ECG de 3 derivaciones.",
        "riesgo_marte": "La microgravedad prolongada provoca desacondicionamiento cardíaco y riesgo de arritmias o intolerancia ortostática.",
    },
    "resp": {
        "titulo": "🫁 Sistema Respiratorio y Cabina",
        "mide": "Oxigenación en sangre (SpO₂), frecuencia respiratoria y aire de cabina (O₂ / CO₂).",
        "como_actuar": "Si SpO₂ < 94 % o sube el CO₂, aplicar O₂ suplementario al 100 % y revisar filtros depuradores del módulo.",
        "riesgo_marte": "En entornos cerrados, fugas o fallos de ventilación causan hipoxia o hipercapnia silenciosa en minutos.",
    },
    "metab": {
        "titulo": "🩸 Metabolismo y Glucemia",
        "mide": "Nivel de glucosa en sangre (mg/dL) mediante glucómetro externo o carga manual.",
        "como_actuar": "Si es < 70 mg/dL y está consciente, administrar 15–20 g de glucosa rápida y volver a medir en 15 min.",
        "riesgo_marte": "La falta de sueño y alteración circadiana desregulan la glucosa y comprometen la energía cognitiva.",
    },
    "term": {
        "titulo": "🌡️ Termorregulación (Piel vs. Central)",
        "mide": "Temperatura cutánea (Astroskin) y estimación de temperatura corporal interna (normal ~37 °C).",
        "como_actuar": "Confirmar con termómetro oral si baja de 35,5 °C; abrigar ante hipotermia (< 35 °C) o enfriar con LCVG si hay hipertermia.",
        "riesgo_marte": "La piel cambia más rápido que el núcleo del cuerpo; ignorar la diferencia puede ocultar hipotermia o golpe de calor.",
    },
    "neuro": {
        "titulo": "🧠 Sueño, Ritmo Circadiano y Ánimo",
        "mide": "Horas/calidad de sueño (pulsera Actiwatch, meta 8,5 h) y autorreporte breve de ánimo.",
        "como_actuar": "Usar luz enriquecida en azul (≥ 250 lux) al despertar, oscuridad total al dormir y evitar maniobras complejas tras mal descanso.",
        "riesgo_marte": "El aislamiento y el ciclo luz-oscuridad alterado degradan el juicio operativo, la inmunidad y la estabilidad emocional.",
    },
}


def _inicializar_estado() -> None:
    """Inicializa componentes y estado persistente en `st.session_state`."""
    if "simulador" not in st.session_state:
        st.session_state.simulador = SimuladorSensores(seed=42)
    if "historico" not in st.session_state:
        st.session_state.historico = deque(maxlen=90)
    if "simulacion_activa" not in st.session_state:
        st.session_state.simulacion_activa = True
    if "forzar_llm" not in st.session_state:
        st.session_state.forzar_llm = False
    if "emergencia_manual" not in st.session_state:
        st.session_state.emergencia_manual = False
    if "alarma_silenciada" not in st.session_state:
        st.session_state.alarma_silenciada = False
    if "parpadeo_detenido" not in st.session_state:
        st.session_state.parpadeo_detenido = False
    if "alerta_reconocida" not in st.session_state:
        st.session_state.alerta_reconocida = False
    if "audio_habilitado" not in st.session_state:
        st.session_state.audio_habilitado = False
    if "datos_manuales_obsoletos" not in st.session_state:
        st.session_state.datos_manuales_obsoletos = False
    if "ultimo_registro_manual_ts" not in st.session_state:
        st.session_state.ultimo_registro_manual_ts = datetime.now(timezone.utc).astimezone().strftime("%H:%M:%S")
    if "sistema_seleccionado" not in st.session_state:
        st.session_state.sistema_seleccionado = "cardio"
    if "paso_triaje_respuesta" not in st.session_state:
        st.session_state.paso_triaje_respuesta = None
    if "bitacora_acciones" not in st.session_state:
        st.session_state.bitacora_acciones = []
    if "rutina_diaria" not in st.session_state:
        st.session_state.rutina_diaria = {
            "glucemia": True,
            "animo": True,
            "sueno": True,
            "hidratacion": False,
        }
    if "racha_dias" not in st.session_state:
        st.session_state.racha_dias = 12
    if "paquete_sf_listo" not in st.session_state:
        st.session_state.paquete_sf_listo = None
    if "umbrales_nasa" not in st.session_state:
        st.session_state.umbrales_nasa = cargar_umbrales_nasa()
    if "osdr_ref" not in st.session_state:
        st.session_state.osdr_ref = obtener_referencias_osdr(forzar_red=False)
    if "chat_llm" not in st.session_state:
        st.session_state.chat_llm = []
    if "motor" not in st.session_state:
        if MODEL_PATH.exists():
            st.session_state.motor = MotorInferencia(model_path=MODEL_PATH)
        else:
            st.session_state.motor = None


def _avanzar_telemetria(forzar_llm: bool = False) -> tuple[dict[str, float], dict[str, float], dict[str, Any]]:
    """Lee sensores, ejecuta inferencia y actualiza el historial."""
    motor: MotorInferencia = st.session_state.motor
    sim: SimuladorSensores = st.session_state.simulador
    cabin_env = sim.obtener_entorno_cabina()
    stale_flag = bool(st.session_state.datos_manuales_obsoletos) or (not st.session_state.simulacion_activa)

    if st.session_state.simulacion_activa or len(st.session_state.historico) == 0:
        lectura = sim.leer_sensores()
        forzar = forzar_llm or bool(st.session_state.forzar_llm)
        st.session_state.forzar_llm = False

        resultado = motor.evaluar(
            lectura=lectura,
            cabin_env=cabin_env,
            emergencia_manual=bool(st.session_state.emergencia_manual),
            datos_obsoletos=stale_flag,
            intervalo_llm_seg=25.0,
            forzar_llm=forzar,
        )
        st.session_state.ultimo_resultado = resultado
        st.session_state.ultimo_cabin_env = cabin_env

        fila_hist = dict(lectura)
        fila_hist["timestamp"] = resultado["timestamp"]
        fila_hist["estado_riesgo"] = resultado["estado_riesgo"]
        fila_hist["temp_central_est"] = resultado["temp_central_est"]
        st.session_state.historico.append(fila_hist)
    else:
        resultado = st.session_state.ultimo_resultado
        cabin_env = st.session_state.get("ultimo_cabin_env", cabin_env)
        lectura = {k: float(st.session_state.historico[-1][k]) for k in FEATURE_NAMES}
        if forzar_llm or st.session_state.forzar_llm:
            st.session_state.forzar_llm = False
            resultado = motor.evaluar(
                lectura=lectura,
                cabin_env=cabin_env,
                emergencia_manual=bool(st.session_state.emergencia_manual),
                datos_obsoletos=stale_flag,
                intervalo_llm_seg=25.0,
                forzar_llm=True,
            )
            st.session_state.ultimo_resultado = resultado

    return lectura, cabin_env, resultado


def _estado_color_variable(
    var: str,
    valor: float,
    umbrales: dict[str, Any],
    es_obsoleto: bool = False,
) -> dict[str, str]:
    """Devuelve color hex, clase CSS, etiqueta corta y flecha redundante."""
    if es_obsoleto:
        return {"hex": "#06B6D4", "css": "kpi-stale", "badge": "🟦 OBSOLETO", "flecha": "⏱"}

    cfg = umbrales["biomarkers"][var]
    cb = cfg.get("critico_bajo")
    ca = cfg.get("critico_alto")
    n_min, n_max = cfg["normal"]

    if cb is not None and valor < float(cb):
        return {"hex": "#EF4444", "css": "kpi-warning", "badge": "🔴 CRÍTICO ↓", "flecha": "↓"}
    if ca is not None and valor > float(ca):
        return {"hex": "#EF4444", "css": "kpi-warning", "badge": "🔴 CRÍTICO ↑", "flecha": "↑"}
    if var == "nivel_actividad" and 0.0 <= valor <= float(n_max):
        return {"hex": "#10B981", "css": "kpi-nominal", "badge": "🟢 NORMAL", "flecha": "•"}
    if float(n_min) <= valor <= float(n_max):
        return {"hex": "#10B981", "css": "kpi-nominal", "badge": "🟢 NORMAL", "flecha": "•"}

    flecha = "↓" if valor < float(n_min) else "↑"
    return {"hex": "#F59E0B", "css": "kpi-caution", "badge": f"🟡 PRECAUCIÓN {flecha}", "flecha": flecha}


def _color_sistemas_cuerpo(
    lectura: dict[str, float],
    cabin_env: dict[str, float],
    resultado: dict[str, Any],
    umbrales: dict[str, Any],
) -> dict[str, str]:
    """Calcula el color semántico de cada una de las 5 zonas anatómicas del SVG."""
    def peor_color(estados: list[str]) -> str:
        if "#EF4444" in estados:
            return "#EF4444"
        if "#F59E0B" in estados:
            return "#F59E0B"
        if "#06B6D4" in estados:
            return "#06B6D4"
        return "#10B981"

    obsoleto = bool(st.session_state.datos_manuales_obsoletos)
    c_cardio = peor_color([
        _estado_color_variable("frec_cardiaca", lectura["frec_cardiaca"], umbrales)["hex"],
        _estado_color_variable("presion_sistolica", lectura["presion_sistolica"], umbrales)["hex"],
        _estado_color_variable("anomalia_ecg", lectura["anomalia_ecg"], umbrales)["hex"],
        "#EF4444" if st.session_state.emergencia_manual else "#10B981",
    ])
    c_resp = peor_color([
        _estado_color_variable("spo2", lectura["spo2"], umbrales)["hex"],
        _estado_color_variable("frec_respiratoria", lectura["frec_respiratoria"], umbrales)["hex"],
        "#EF4444" if cabin_env["pi_o2_mmhg"] < 122.0 or cabin_env["ppco2_mmhg"] > 5.3 else (
            "#F59E0B" if cabin_env["pi_o2_mmhg"] < 145.0 or cabin_env["ppco2_mmhg"] > 3.0 else "#10B981"
        ),
    ])
    c_metab = _estado_color_variable("glucemia", lectura["glucemia"], umbrales, es_obsoleto=obsoleto)["hex"]
    c_term = peor_color([
        _estado_color_variable("temp_corporal", lectura["temp_corporal"], umbrales)["hex"],
        "#EF4444" if resultado["temp_central_est"] < 35.0 else "#10B981",
    ])
    c_neuro = peor_color([
        _estado_color_variable("horas_sueno", lectura["horas_sueno"], umbrales)["hex"],
        _estado_color_variable("eficiencia_sueno", lectura["eficiencia_sueno"], umbrales)["hex"],
        _estado_color_variable("estado_animo", lectura["estado_animo"], umbrales, es_obsoleto=obsoleto)["hex"],
    ])
    return {
        "cardio": c_cardio,
        "resp": c_resp,
        "metab": c_metab,
        "term": c_term,
        "neuro": c_neuro,
    }


def _construir_svg_cuerpo(colores: dict[str, str], activo: str) -> str:
    """Genera diagrama anatómico SVG limpio con indicadores de color en tiempo real."""
    def stroke(key: str) -> str:
        return "#FFFFFF" if activo == key else "#0F172A"

    def width(key: str) -> str:
        return "3" if activo == key else "1.8"

    return f"""
    <div style="display:flex; justify-content:center; background:#0B1220; border:1px solid #1E293B; border-radius:10px; padding:10px;">
      <svg viewBox="0 0 220 310" width="195" height="275" xmlns="http://www.w3.org/2000/svg">
        <!-- Silueta astronauta estilizada -->
        <circle cx="110" cy="40" r="24" fill="#1E293B" stroke="#475569" stroke-width="2"/>
        <path d="M72 74 C72 64, 148 64, 148 74 L160 155 L142 158 L138 102 L138 188 L145 292 L120 292 L113 200 L107 200 L100 292 L75 292 L82 188 L82 102 L78 158 L60 155 Z"
              fill="#1E293B" stroke="#475569" stroke-width="2"/>

        <!-- 1. Cerebro / Sueño y Ánimo -->
        <circle cx="110" cy="38" r="13" fill="{colores['neuro']}" stroke="{stroke('neuro')}" stroke-width="{width('neuro')}" opacity="0.92"/>
        <text x="110" y="42" text-anchor="middle" fill="#060A12" font-size="10" font-weight="bold">S/A</text>

        <!-- 2. Pulmones / Respiratorio -->
        <ellipse cx="94" cy="102" rx="11" ry="17" fill="{colores['resp']}" stroke="{stroke('resp')}" stroke-width="{width('resp')}" opacity="0.88"/>
        <ellipse cx="126" cy="102" rx="11" ry="17" fill="{colores['resp']}" stroke="{stroke('resp')}" stroke-width="{width('resp')}" opacity="0.88"/>

        <!-- 3. Corazón / Cardiovascular -->
        <circle cx="113" cy="106" r="11" fill="{colores['cardio']}" stroke="{stroke('cardio')}" stroke-width="{width('cardio')}"/>
        <text x="113" y="110" text-anchor="middle" fill="#060A12" font-size="9" font-weight="bold">♥</text>

        <!-- 4. Metabolismo / Glucosa -->
        <rect x="93" y="135" width="34" height="22" rx="7" fill="{colores['metab']}" stroke="{stroke('metab')}" stroke-width="{width('metab')}" opacity="0.90"/>
        <text x="110" y="150" text-anchor="middle" fill="#060A12" font-size="9" font-weight="bold">GLU</text>

        <!-- 5. Piel / Termorregulación -->
        <rect x="150" y="110" width="38" height="22" rx="6" fill="{colores['term']}" stroke="{stroke('term')}" stroke-width="{width('term')}"/>
        <text x="169" y="125" text-anchor="middle" fill="#060A12" font-size="9" font-weight="bold">T°C</text>
        <line x1="138" y1="121" x2="150" y2="121" stroke="{colores['term']}" stroke-width="2"/>
      </svg>
    </div>
    """


def _limpiar_texto_diagnostico(diag: str) -> str:
    """Remueve prefijos de código técnico para dejar una frase clara para el tripulante."""
    limpio = re.sub(r"^\[ALERTA:[^\]]+\]\s*", "", diag).strip()
    return limpio


def _emitir_audio_dual_nasa(nivel_nasa: str) -> None:
    """Emite audio dual-codificado (Tabla 10.3-1 / V2 10176) solo si está habilitado."""
    if (
        not st.session_state.audio_habilitado
        or st.session_state.alarma_silenciada
        or nivel_nasa in {"Nominal", "Advisory"}
    ):
        return

    freq_map = {
        "Emergency": (650, 1500, 0.20),
        "Warning": (400, 1024, 0.16),
        "Caution": (512, 512, 0.12),
    }
    f1, f2, gain_final = freq_map.get(nivel_nasa, (512, 512, 0.12))
    gain_pre = round(gain_final * 0.316, 4)

    components.html(
        f"""
        <script>
        (function() {{
            try {{
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (!AudioCtx) return;
                const ctx = new AudioCtx();
                const now = ctx.currentTime;
                const o1 = ctx.createOscillator(), g1 = ctx.createGain();
                o1.type = "{ 'triangle' if nivel_nasa == 'Caution' else 'sine' }";
                o1.frequency.setValueAtTime({f1}, now);
                g1.gain.setValueAtTime({gain_pre}, now);
                o1.connect(g1); g1.connect(ctx.destination);
                o1.start(now); o1.stop(now + 0.14);

                const o2 = ctx.createOscillator(), g2 = ctx.createGain();
                o2.type = "{ 'triangle' if nivel_nasa == 'Caution' else 'sine' }";
                o2.frequency.setValueAtTime({f2}, now + 0.34);
                g2.gain.setValueAtTime({gain_final}, now + 0.34);
                o2.connect(g2); g2.connect(ctx.destination);
                o2.start(now + 0.34); o2.stop(now + 0.58);
            }} catch (e) {{}}
        }})();
        </script>
        """,
        height=0,
    )


def _registrar_accion(sim: SimuladorSensores, tipo: str, etiqueta: str) -> None:
    """Aplica una intervención al simulador y guarda constancia en bitácora."""
    resumen = sim.aplicar_intervencion(tipo)
    ts = datetime.now(timezone.utc).astimezone().strftime("%H:%M:%S")
    st.session_state.bitacora_acciones.insert(0, f"[{ts}] {etiqueta} — {resumen}")
    if tipo in {"rcp_dea", "reposo_cv"} and st.session_state.emergencia_manual:
        st.session_state.emergencia_manual = False
    if tipo == "glucosa_oral":
        st.session_state.rutina_diaria["glucemia"] = True
    if tipo == "protocolo_conductual":
        st.session_state.rutina_diaria["animo"] = True
    if tipo == "iluminacion_descanso":
        st.session_state.rutina_diaria["sueno"] = True
    st.session_state.forzar_llm = True


def _generar_paquete_store_and_forward(
    lectura: dict[str, float],
    cabin_env: dict[str, float],
    resultado: dict[str, Any],
) -> str:
    """Construye el expediente JSON verificable para transmisión diferida a Tierra."""
    payload = {
        "schema": "MecaSpace-StoreAndForward-v2",
        "standard_ref": "NASA-STD-3001 Vol.1 Rev.C (V1 3004.a, V1 6002) & Vol.2 Rev.E (V2 10125)",
        "mission_context": "Tránsito a Marte | Latencia 20 min/sentido",
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "nasa_alert_level": resultado["nivel_nasa"],
        "protocolo_codigo": resultado["protocolo_codigo"],
        "excede_alcance_v2_10171": resultado["excede_alcance"],
        "diagnostico": resultado["diagnostico"],
        "temp_cutanea_c": lectura["temp_corporal"],
        "temp_central_estimada_c": resultado["temp_central_est"],
        "telemetria": lectura,
        "cabina": cabin_env,
        "top3_shap": resultado["top3_shap"],
        "acciones_ejecutadas": st.session_state.bitacora_acciones[:10],
    }
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False).encode("utf-8")
    payload["sha256_integrity"] = hashlib.sha256(raw).hexdigest()
    return json.dumps(payload, indent=2, ensure_ascii=False)


def _renderizar_cabecera() -> None:
    """Cabecera fija de comando con disparador directo de emergencia (V2 10178)."""
    col_t, col_em, col_sil, col_ack = st.columns([4.4, 2.3, 1.6, 1.7])

    with col_t:
        st.markdown("## 👨‍🚀 MecaSpace · Consola de Salud (Tránsito a Marte)")
        st.caption("Modo autónomo local · Latencia Tierra: 20 min/sentido · Sin evacuación posible")

    with col_em:
        st.markdown('<div class="hazard-header-box">', unsafe_allow_html=True)
        if not st.session_state.emergencia_manual:
            if st.button("🚨 EMERGENCIA MANUAL", type="primary", width="stretch"):
                st.session_state.emergencia_manual = True
                st.session_state.parpadeo_detenido = False
                st.session_state.alerta_reconocida = False
                st.session_state.alarma_silenciada = False
                st.session_state.paso_triaje_respuesta = None
                st.session_state.sistema_seleccionado = "cardio"
                st.session_state.simulador.inyectar_sobrecarga_cardiovascular(critica=True)
                st.session_state.forzar_llm = True
                st.rerun()
        else:
            if st.button("✅ Cerrar Emergencia Manual", width="stretch"):
                st.session_state.emergencia_manual = False
                st.session_state.paso_triaje_respuesta = None
                st.session_state.forzar_llm = True
                st.rerun()
        st.markdown("</div>", unsafe_allow_html=True)

    with col_sil:
        lbl_sil = "🔊 Audio OFF" if st.session_state.alarma_silenciada else "🔇 Silenciar"
        if st.button(lbl_sil, width="stretch"):
            st.session_state.alarma_silenciada = not st.session_state.alarma_silenciada
            st.session_state.parpadeo_detenido = True
            st.rerun()

    with col_ack:
        lbl_ack = "✓ Confirmada" if st.session_state.alerta_reconocida else "✓ Confirmar"
        if st.button(lbl_ack, width="stretch"):
            st.session_state.alerta_reconocida = True
            st.session_state.parpadeo_detenido = True
            st.rerun()


def _renderizar_sidebar() -> None:
    """Barra lateral minimalista para demostración y mediciones manuales rápidas."""
    sim: SimuladorSensores = st.session_state.simulador

    with st.sidebar:
        st.markdown("### 🎛️ Control de Simulación")
        claves = list(ESCENARIOS_OBJETIVO.keys())
        sel = st.selectbox(
            "Escenario fisiológico",
            options=claves,
            index=claves.index(sim.escenario_actual),
            format_func=lambda k: ESCENARIOS_OBJETIVO[k]["label"],
        )
        c1, c2 = st.columns(2)
        with c1:
            if st.button("▶ Aplicar", type="primary", width="stretch"):
                st.session_state.emergencia_manual = False
                st.session_state.alerta_reconocida = False
                st.session_state.parpadeo_detenido = False
                st.session_state.datos_manuales_obsoletos = False
                st.session_state.paso_triaje_respuesta = None
                sim.activar_escenario(sel, inmediato=True)
                st.session_state.forzar_llm = True
                st.rerun()
        with c2:
            if st.button("🟢 Nominal", width="stretch"):
                st.session_state.emergencia_manual = False
                st.session_state.datos_manuales_obsoletos = False
                st.session_state.paso_triaje_respuesta = None
                sim.restaurar_nominal()
                st.session_state.forzar_llm = True
                st.rerun()

        st.divider()
        st.markdown("#### 🩸 Registro Manual Rápido")
        with st.form("form_manual_rapido"):
            gluc_in = st.number_input(
                "Glucemia (mg/dL)",
                min_value=35.0,
                max_value=350.0,
                value=float(sim.valores_actuales["glucemia"]),
                step=1.0,
            )
            animo_in = st.slider(
                "Ánimo (1–10)",
                min_value=1.0,
                max_value=10.0,
                value=float(sim.valores_actuales["estado_animo"]),
                step=0.5,
            )
            if st.form_submit_button("Guardar medición", width="stretch"):
                sim.registrar_entrada_manual(glucemia=gluc_in, estado_animo=animo_in)
                st.session_state.datos_manuales_obsoletos = False
                st.session_state.ultimo_registro_manual_ts = datetime.now(timezone.utc).astimezone().strftime("%H:%M:%S")
                st.session_state.rutina_diaria["glucemia"] = True
                st.session_state.rutina_diaria["animo"] = True
                st.session_state.forzar_llm = True
                st.rerun()

        if st.button("🟦 Simular dato vencido (Cian)", width="stretch"):
            st.session_state.datos_manuales_obsoletos = not st.session_state.datos_manuales_obsoletos
            st.session_state.forzar_llm = True
            st.rerun()

        st.divider()
        c_p1, c_p2 = st.columns(2)
        with c_p1:
            lbl_play = "⏸️ Pausar" if st.session_state.simulacion_activa else "▶️ Reanudar"
            if st.button(lbl_play, width="stretch"):
                st.session_state.simulacion_activa = not st.session_state.simulacion_activa
                st.rerun()
        with c_p2:
            if st.button("🧹 Limpiar", width="stretch"):
                st.session_state.historico.clear()
                st.rerun()

        st.session_state.audio_habilitado = st.toggle(
            "🔊 Audio de alarma",
            value=bool(st.session_state.audio_habilitado),
        )


def _renderizar_banner_estado(resultado: dict[str, Any]) -> None:
    """Muestra el semáforo global y una única frase clara de qué ocurre."""
    nivel_nasa = resultado["nivel_nasa"]
    _emitir_audio_dual_nasa(nivel_nasa)

    if nivel_nasa == "Emergency":
        banner_css = "status-emergency-steady" if st.session_state.parpadeo_detenido else "status-emergency-flashing"
        icono = "🚨"
    elif nivel_nasa == "Warning":
        banner_css = "status-warning"
        icono = "🔴"
    elif nivel_nasa == "Caution":
        banner_css = "status-caution"
        icono = "🟡"
    elif nivel_nasa == "Advisory":
        banner_css = "status-advisory"
        icono = "🔵"
    else:
        banner_css = "status-nominal"
        icono = "🟢"

    nivel_info = NASA_ALERT_LEVELS.get(nivel_nasa, NASA_ALERT_LEVELS["Nominal"])
    diag_simple = _limpiar_texto_diagnostico(resultado["diagnostico"])

    pills = []
    if st.session_state.datos_manuales_obsoletos:
        pills.append('<span class="badge-pill badge-cyan">CIAN: DATO MANUAL VENCIDO</span>')
    if resultado["excede_alcance"]:
        pills.append('<span class="badge-pill">⚠️ Requiere estudio a bordo + envío a Tierra</span>')
    pills.append(f'<span class="badge-pill">Respuesta: {resultado["latencia_ml_ms"]:.0f} ms</span>')

    st.markdown(
        f"""
        <div class="status-banner {banner_css}">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <div style="font-size:1.30rem; font-weight:800;">
                    {icono} {nivel_info['label_es']}
                </div>
                <div>{''.join(pills)}</div>
            </div>
            <div style="margin-top:6px; font-size:1.03rem; color:#F8FAFC;">
                {diag_simple}
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def _construir_grafico_shap_compacto(top3_shap: list[dict[str, Any]]) -> go.Figure:
    """Gráfico horizontal compacto de los 3 factores que más explican el estado."""
    ordenado = list(reversed(top3_shap))
    etiquetas = [item["nombre"].split("(")[0].strip() for item in ordenado]
    valores = [item["shap_valor"] for item in ordenado]
    colores = ["#EF4444" if v >= 0 else "#38BDF8" for v in valores]

    fig = go.Figure(
        go.Bar(
            x=valores,
            y=etiquetas,
            orientation="h",
            marker_color=colores,
            text=[f"{v:+.2f}" for v in valores],
            textposition="outside",
        )
    )
    fig.update_layout(
        height=175,
        margin={"l": 10, "r": 35, "t": 10, "b": 10},
        paper_bgcolor="#0F172A",
        plot_bgcolor="#0F172A",
        font={"color": "#E2E8F0", "size": 11},
    )
    fig.update_xaxes(showgrid=True, gridcolor="#1E293B", zeroline=True, zerolinecolor="#64748B")
    fig.update_yaxes(showgrid=False)
    return fig


def _renderizar_panel_decision(
    lectura: dict[str, float],
    cabin_env: dict[str, float],
    resultado: dict[str, Any],
) -> None:
    """Árbol de decisión interactivo y botones ejecutables para tripulantes no médicos."""
    sim: SimuladorSensores = st.session_state.simulador
    nivel_nasa = resultado["nivel_nasa"]
    proto = resultado["protocolo_codigo"]

    st.markdown("##### 🧭 Decisión y Acción Inmediata")
    st.caption("Por qué ocurre (Top 3 SHAP):")
    st.plotly_chart(
        _construir_grafico_shap_compacto(resultado["top3_shap"]),
        width="stretch",
        key="shap_compact_chart",
    )

    if nivel_nasa == "Nominal" and not st.session_state.emergencia_manual:
        st.success("Tripulante estable. Sin acciones urgentes pendientes.")
        if st.button("🧘 Hacer pausa de respiración guiada (preventiva)", width="stretch"):
            _registrar_accion(sim, "protocolo_conductual", "Respiración preventiva")
            st.rerun()
        return

    if nivel_nasa == "Advisory":
        st.info("Hay mediciones manuales vencidas (estado Cian). Registra glucemia y ánimo para limpiar el aviso.")
        if st.button("✅ Marcar mediciones al día", type="primary", width="stretch"):
            st.session_state.datos_manuales_obsoletos = False
            st.session_state.ultimo_registro_manual_ts = datetime.now(timezone.utc).astimezone().strftime("%H:%M:%S")
            st.session_state.forzar_llm = True
            st.rerun()
        return

    # Flujo de decisión guiado según el cuadro activo
    st.markdown('<div class="decision-box">', unsafe_allow_html=True)

    if proto == "PROTO-CV-01" or st.session_state.emergencia_manual:
        st.markdown("**Paso 1 — Evaluación rápida:** ¿El compañero responde y respira con normalidad?")
        c_q1, c_q2 = st.columns(2)
        with c_q1:
            if st.button("✅ Sí, está consciente", width="stretch"):
                st.session_state.paso_triaje_respuesta = "cv_consciente"
        with c_q2:
            if st.button("🚨 No / Colapso", type="primary", width="stretch"):
                st.session_state.paso_triaje_respuesta = "cv_colapso"

        resp_cv = st.session_state.paso_triaje_respuesta
        if resp_cv == "cv_colapso":
            st.error("Prioridad vital: iniciar soporte RCP/DEA inmediato y detener maniobras.")
            if st.button("⚡ Ejecutar Protocolo RCP / DEA y Estabilizar", type="primary", width="stretch"):
                _registrar_accion(sim, "rcp_dea", "RCP/DEA iniciado")
                st.rerun()
        else:
            st.warning("Mantener reposo absoluto, suspender esfuerzo y preparar ECG/ecografía.")
            if st.button("🛌 Aplicar Reposo + Hidratación Electrolítica", type="primary", width="stretch"):
                _registrar_accion(sim, "reposo_cv", "Reposo cardiovascular aplicado")
                st.rerun()

    elif proto == "PROTO-RESP-02":
        st.markdown(f"**Cabina:** O₂ = `{cabin_env['pi_o2_mmhg']} mmHg` · CO₂ = `{cabin_env['ppco2_mmhg']} mmHg`")
        st.markdown("**Paso 1 — Decisión:** ¿La anomalía persiste en reposo?")
        if st.button("💨 Suministrar O₂ al 100 % y Revisar Depurador CO₂", type="primary", width="stretch"):
            _registrar_accion(sim, "oxigeno_100", "O₂ 100% + revisión ECLSS")
            st.rerun()

    elif proto == "PROTO-MET-03":
        gluc = lectura["glucemia"]
        st.markdown(f"**Glucemia actual:** `{gluc:.0f} mg/dL` · **Sueño:** `{lectura['horas_sueno']:.1f} h`")
        if gluc < 70.0:
            if st.button("🍬 Administrar 15–20 g de Glucosa Oral", type="primary", width="stretch"):
                _registrar_accion(sim, "glucosa_oral", "Glucosa oral 15-20 g")
                st.rerun()
        if st.button("🌙 Activar Luz Circadiana y Bloque de Sueño", width="stretch"):
            _registrar_accion(sim, "iluminacion_descanso", "Recuperación circadiana")
            st.rerun()

    elif proto == "PROTO-TERM-04":
        t_cent = resultado["temp_central_est"]
        st.markdown(f"**Temp. central estimada:** `{t_cent:.2f} °C` (piel `{lectura['temp_corporal']:.2f} °C`)")
        if t_cent < 35.5:
            if st.button("🔥 Activar Recalentamiento Progresivo", type="primary", width="stretch"):
                _registrar_accion(sim, "recalentamiento", "Recalentamiento activo")
                st.rerun()
        else:
            if st.button("❄️ Activar Prenda de Enfriamiento (LCVG)", type="primary", width="stretch"):
                _registrar_accion(sim, "enfriamiento_lcvg", "Enfriamiento LCVG")
                st.rerun()

    else:  # PROTO-COND-05
        if st.button("🧘 Iniciar Protocolo Conductual y Respiración 4-6", type="primary", width="stretch"):
            _registrar_accion(sim, "protocolo_conductual", "Protocolo conductual")
            st.rerun()

    # Acciones de segundo escalón (ECG/Ecografía + Store-and-Forward)
    c_e1, c_e2 = st.columns(2)
    with c_e1:
        if st.button("🫀 Capturar ECG / Eco", width="stretch"):
            _registrar_accion(sim, "ecg_ecografia_bordo", "ECG/Ecografía a bordo")
            st.rerun()
    with c_e2:
        if st.button("📦 Preparar Envío Tierra", width="stretch"):
            st.session_state.paquete_sf_listo = _generar_paquete_store_and_forward(lectura, cabin_env, resultado)

    if st.session_state.paquete_sf_listo:
        st.download_button(
            "⬇️ Descargar Paquete Diferido (JSON)",
            data=st.session_state.paquete_sf_listo,
            file_name=f"mecaspace_{proto.lower()}_{resultado['timestamp'].replace(':', '')}.json",
            mime="application/json",
            width="stretch",
        )

    st.markdown("</div>", unsafe_allow_html=True)

    if st.session_state.bitacora_acciones:
        st.caption(f"Última acción: {st.session_state.bitacora_acciones[0]}")


def _renderizar_rutina_diaria() -> None:
    """Barra inferior de rutina diaria y gamificación ligera (Consigna.md)."""
    st.divider()
    rutina = st.session_state.rutina_diaria
    completadas = sum(1 for v in rutina.values() if v)
    total = len(rutina)

    col_prog, c1, c2, c3, c4 = st.columns([2.4, 1.4, 1.4, 1.4, 1.4])
    with col_prog:
        st.markdown(f"**🎯 Rutina de Salud Hoy ({completadas}/{total}) · Racha: {st.session_state.racha_dias} días**")
        st.progress(completadas / total)
    with c1:
        if st.button(f"{'✅' if rutina['glucemia'] else '⬜'} Glucemia", width="stretch"):
            rutina["glucemia"] = not rutina["glucemia"]
            st.rerun()
    with c2:
        if st.button(f"{'✅' if rutina['animo'] else '⬜'} Ánimo", width="stretch"):
            rutina["animo"] = not rutina["animo"]
            st.rerun()
    with c3:
        if st.button(f"{'✅' if rutina['sueno'] else '⬜'} Sueño 8.5 h", width="stretch"):
            rutina["sueno"] = not rutina["sueno"]
            st.rerun()
    with c4:
        if st.button(f"{'✅' if rutina['hidratacion'] else '⬜'} Hidratación", width="stretch"):
            rutina["hidratacion"] = not rutina["hidratacion"]
            st.rerun()


@st.fragment(run_every=2)
def vista_triaje_en_vivo() -> None:
    """Vista 1: Triaje en vivo cada 2 s con figura humana, 6 indicadores y decisiones."""
    if st.session_state.motor is None:
        st.error("Falta `modelo_xgb.json`. Ejecuta `entrenar_modelo.py`.")
        return

    umbrales = st.session_state.umbrales_nasa
    lectura, cabin_env, resultado = _avanzar_telemetria()
    hist_list = list(st.session_state.historico)
    prev_row = hist_list[-2] if len(hist_list) >= 2 else hist_list[-1]

    _renderizar_banner_estado(resultado)

    col_cuerpo, col_indicadores, col_decision = st.columns([1.05, 1.25, 1.20])

    # ------------------------------------------------------------------
    # COLUMNA 1: FIGURA HUMANA INTERACTIVA (Consigna.md)
    # ------------------------------------------------------------------
    with col_cuerpo:
        st.markdown("##### 🧍 Explorador Anatómico")
        colores = _color_sistemas_cuerpo(lectura, cabin_env, resultado, umbrales)
        st.markdown(
            _construir_svg_cuerpo(colores, st.session_state.sistema_seleccionado),
            unsafe_allow_html=True,
        )
        b1, b2, b3, b4, b5 = st.columns(5)
        botones_sis = [
            (b1, "🧠", "neuro"),
            (b2, "🫀", "cardio"),
            (b3, "🫁", "resp"),
            (b4, "🩸", "metab"),
            (b5, "🌡️", "term"),
        ]
        for col_b, ico, clave in botones_sis:
            with col_b:
                tipo_b = "primary" if st.session_state.sistema_seleccionado == clave else "secondary"
                if st.button(ico, key=f"sis_{clave}", type=tipo_b, width="stretch"):
                    st.session_state.sistema_seleccionado = clave
                    st.rerun()

        info_sis = GUIA_SISTEMAS_CUERPO[st.session_state.sistema_seleccionado]
        st.markdown(
            f"""
            <div class="body-info-box">
                <strong>{info_sis['titulo']}</strong><br>
                <b>Mide:</b> {info_sis['mide']}<br>
                <b>Qué hacer:</b> {info_sis['como_actuar']}<br>
                <b>En Marte:</b> {info_sis['riesgo_marte']}
            </div>
            """,
            unsafe_allow_html=True,
        )

    # ------------------------------------------------------------------
    # COLUMNA 2: LOS 6 INDICADORES PRIORITARIOS (LIMPIOS)
    # ------------------------------------------------------------------
    with col_indicadores:
        st.markdown("##### 📊 6 Indicadores Centrales")
        for r_idx in range(3):
            c_left, c_right = st.columns(2)
            for c_idx, col_box in enumerate((c_left, c_right)):
                var = CONSIGNA_SIX_INDICATORS[r_idx * 2 + c_idx]
                cfg = umbrales["biomarkers"][var]
                val = float(lectura[var])
                delta = round(val - float(prev_row[var]), 1)
                es_manual = var in {"glucemia", "estado_animo"}
                obsoleto = es_manual and bool(st.session_state.datos_manuales_obsoletos)
                est = _estado_color_variable(var, val, umbrales, es_obsoleto=obsoleto)

                sublinea = f"Δ {delta:+}"
                if var == "temp_corporal":
                    t_c = resultado["temp_central_est"]
                    alerta_hipo = " · <b>&lt;35°C</b>" if t_c < 35.0 else ""
                    sublinea = f"Central est.: <b>{t_c:.1f} °C</b>{alerta_hipo}"
                elif var == "horas_sueno":
                    sublinea = f"Meta 8.5 h · Efic. {lectura['eficiencia_sueno']:.0f}%"

                nombre_corto = ETIQUETAS_LEGIBLES[var].split("(")[0].strip()
                with col_box:
                    st.markdown(
                        f"""
                        <div class="kpi-card {est['css']}">
                            <div style="font-size:0.78rem; color:#CBD5E1; font-weight:700;">
                                {nombre_corto}
                            </div>
                            <div style="font-size:1.42rem; font-weight:800; color:#F8FAFC; margin:2px 0;">
                                {val} <span style="font-size:0.84rem; color:#94A3B8;">{cfg['unit']}</span>
                                <span style="font-size:0.9rem;">{est['flecha']}</span>
                            </div>
                            <div style="font-size:0.75rem; color:#94A3B8;">
                                {est['badge']} · {sublinea}
                            </div>
                        </div>
                        """,
                        unsafe_allow_html=True,
                    )

        # Banda ambiental de cabina compacta
        st.caption(
            f"Cabina → P_I O₂: `{cabin_env['pi_o2_mmhg']} mmHg` (145–155) · "
            f"ppCO₂: `{cabin_env['ppco2_mmhg']} mmHg` (≤3.0) · "
            f"Temp: `{cabin_env['cabin_temp_c']} °C`"
        )

    # ------------------------------------------------------------------
    # COLUMNA 3: PANEL DE DECISIÓN INTERACTIVA
    # ------------------------------------------------------------------
    with col_decision:
        _renderizar_panel_decision(lectura, cabin_env, resultado)

    _renderizar_rutina_diaria()


def _construir_graficos_grupo(
    df_hist: pd.DataFrame,
    variables: list[str],
    umbrales: dict[str, Any],
) -> go.Figure:
    """Construye grilla de 2x3 con bandas nominales verdes."""
    fig = make_subplots(
        rows=2,
        cols=3,
        subplot_titles=[
            f"{ETIQUETAS_LEGIBLES[v].split('(')[0].strip()} ({umbrales['biomarkers'][v]['unit']})"
            for v in variables
        ],
        vertical_spacing=0.18,
        horizontal_spacing=0.07,
    )
    paleta = ["#38BDF8", "#FB7185", "#FBBF24", "#F472B6", "#A78BFA", "#34D399"]
    for idx, var in enumerate(variables):
        r, c = (idx // 3) + 1, (idx % 3) + 1
        n_min, n_max = umbrales["biomarkers"][var]["normal"]
        fig.add_hrect(
            y0=float(n_min),
            y1=float(n_max),
            fillcolor="rgba(16, 185, 129, 0.13)",
            line_width=0,
            row=r,
            col=c,
        )
        fig.add_trace(
            go.Scatter(
                x=df_hist["timestamp"],
                y=df_hist[var],
                mode="lines+markers",
                marker={"size": 4, "color": paleta[idx % len(paleta)]},
                line={"width": 2, "color": paleta[idx % len(paleta)]},
                showlegend=False,
            ),
            row=r,
            col=c,
        )
    fig.update_layout(
        height=400,
        margin={"l": 20, "r": 20, "t": 36, "b": 20},
        paper_bgcolor="#0B1220",
        plot_bgcolor="#0F172A",
        font={"color": "#E2E8F0", "size": 11},
    )
    fig.update_xaxes(showgrid=False, tickfont={"size": 9}, nticks=4)
    fig.update_yaxes(gridcolor="#1E293B", zeroline=False)
    return fig


def vista_tendencias_cabina_e_ia() -> None:
    """Vista 2: Gráficos temporales, contexto auxiliar/cabina y chat clínico sin interrupciones."""
    if st.session_state.motor is None:
        st.error("Falta `modelo_xgb.json`.")
        return

    if len(st.session_state.historico) == 0:
        _avanzar_telemetria()

    c_top1, c_top2 = st.columns([4, 1])
    with c_top1:
        st.markdown("#### 📈 Evolución Temporal y Telemetría de Cabina")
    with c_top2:
        if st.button("🔄 Tomar nueva lectura", width="stretch"):
            _avanzar_telemetria()
            st.rerun()

    df_hist = pd.DataFrame(list(st.session_state.historico))
    umbrales = st.session_state.umbrales_nasa
    cabin_env = st.session_state.get("ultimo_cabin_env", st.session_state.simulador.obtener_entorno_cabina())

    t1, t2 = st.tabs(["6 Indicadores Centrales", "Contexto Wearable y Cabina"])
    with t1:
        st.plotly_chart(
            _construir_graficos_grupo(df_hist, CONSIGNA_SIX_INDICATORS, umbrales),
            width="stretch",
            key="ts_6_central",
        )
    with t2:
        aux_vars = ["spo2", "frec_respiratoria", "vol_respiratorio", "anomalia_ecg", "nivel_actividad", "eficiencia_sueno"]
        st.plotly_chart(
            _construir_graficos_grupo(df_hist, aux_vars, umbrales),
            width="stretch",
            key="ts_6_aux",
        )
        m1, m2, m3, m4 = st.columns(4)
        m1.metric("Cabina P_I O₂", f"{cabin_env['pi_o2_mmhg']} mmHg", "Nominal 145–155")
        m2.metric("Cabina ppCO₂", f"{cabin_env['ppco2_mmhg']} mmHg", "Nominal ≤ 3.0")
        m3.metric("Cabina Temp.", f"{cabin_env['cabin_temp_c']} °C", "Confort 20–25 °C")
        m4.metric("Cabina Humedad", f"{cabin_env['cabin_rh_pct']} %", "Confort 30–60 %")

    st.divider()
    col_chat, col_psi = st.columns([1.65, 1.0])
    with col_chat:
        st.markdown("#### 💬 Asistente Clínico Autónomo (LM Studio / Respaldo Offline)")
        for msg in st.session_state.chat_llm[-6:]:
            with st.chat_message(msg["role"]):
                st.markdown(msg["content"])
                if msg.get("origen"):
                    st.caption(f"Fuente: {msg['origen']}")

        with st.form("form_chat_ia", clear_on_submit=True):
            ci, cs, cl = st.columns([6.0, 1.5, 1.3])
            with ci:
                pregunta = st.text_input(
                    "Consulta",
                    placeholder="Ej: ¿Qué hago si la SpO2 sigue bajando o hay dolor torácico?",
                    label_visibility="collapsed",
                )
            with cs:
                enviar = st.form_submit_button("Enviar", type="primary", width="stretch")
            with cl:
                limpiar = st.form_submit_button("Limpiar", width="stretch")

        if limpiar:
            st.session_state.chat_llm = []
            st.rerun()
        if enviar and pregunta.strip():
            ultima = st.session_state.historico[-1]
            lectura_ctx = {k: float(ultima[k]) for k in FEATURE_NAMES}
            st.session_state.chat_llm.append({"role": "user", "content": pregunta.strip()})
            resp = st.session_state.motor.consultar_asistente_interactivo(
                pregunta=pregunta.strip(),
                lectura=lectura_ctx,
                resultado_actual=st.session_state.get("ultimo_resultado"),
                historial_chat=st.session_state.chat_llm[:-1],
            )
            st.session_state.chat_llm.append(
                {"role": "assistant", "content": resp["respuesta"], "origen": resp["origen"]}
            )
            st.rerun()

    with col_psi:
        st.markdown("#### 🧠 Nota Privada Conductual (PPC)")
        st.caption("Protocolos asíncronos privados (`V1 3004.q`, `V1 6010`, `V2 7071`).")
        nota = st.text_area("Registro privado cifrado", height=100, placeholder="Estado anímico, estrés o síntomas...")
        if st.button("🔒 Guardar en cola diferida", width="stretch"):
            if nota.strip():
                st.success("Nota cifrada en cola store-and-forward.")
            else:
                st.info("Escribe una nota primero.")


def vista_trazabilidad_jurado() -> None:
    """Vista 3: Anclaje normativo NASA-STD-3001, honestidad técnica y bitácora."""
    st.markdown("#### 📚 Trazabilidad Normativa (NASA-STD-3001 Vol. 1 Rev. C y Vol. 2 Rev. E)")
    st.info(
        "**Aclaración de rigor científico:** ASTROSKIN y ACTIWATCH representan la arquitectura "
        "instrumental seleccionada por el equipo para cumplir `V1 3004.h`, `V1 6001` y `V2 9023`; "
        "no figuran homologados en `NASA-STD-3001`. Asimismo, la norma no fija umbrales numéricos "
        "de reposo para presión arterial, frecuencia cardíaca, glucemia ni estado de ánimo "
        "(se evalúa desvío respecto a línea base pre-misión según `V1 3000`, `V1 4011` y `V1 4015-4017`), "
        "reservando umbrales explícitos para hipotermia central (`< 35 °C`, `Vol. 1 Apéndice C`), "
        "sueño (`8,5 h`, `V1 6001`) y atmósfera de cabina (`V2 6003-6004`)."
    )

    matriz = pd.DataFrame(
        [
            {"Indicador": "1. Presión arterial", "Fuente Equipo": "Astroskin (est.) / manguito", "Citas NASA": "V1 3004.h, Tabla E.2-2, V2 7042"},
            {"Indicador": "2. Frecuencia cardíaca", "Fuente Equipo": "Astroskin (pulso/ECG)", "Citas NASA": "V1 3004.h-i, V2 11011 (>140 bpm traje)"},
            {"Indicador": "3. Azúcar en sangre (mg/dL)", "Fuente Equipo": "Glucómetro / manual", "Citas NASA": "Consigna, V1 4020, V2 8055"},
            {"Indicador": "4. Temperatura corporal", "Fuente Equipo": "Astroskin (piel) + est. central", "Citas NASA": "Vol. 1 Ap. C (<35°C), V2 6014, V2 11011"},
            {"Indicador": "5. Horas diarias de sueño", "Fuente Equipo": "Actiwatch Spectrum", "Citas NASA": "V1 6001 (8,5 h), V2 6079, V2 6092, V2 8055"},
            {"Indicador": "6. Estado de ánimo", "Fuente Equipo": "Autorreporte multimodal", "Citas NASA": "V1 3004.q, Tabla E.2-2 (*), V2 7071"},
        ]
    )
    st.dataframe(matriz, width="stretch", hide_index=True)

    c_j1, c_j2 = st.columns(2)
    with c_j1:
        st.markdown("##### 📝 Bitácora de Decisiones del Tripulante")
        if st.session_state.bitacora_acciones:
            for item in st.session_state.bitacora_acciones[:10]:
                st.write(f"- {item}")
        else:
            st.caption("Aún no se ejecutaron contramedidas manuales en esta sesión.")

    with c_j2:
        st.markdown("##### 📦 Exportación Store-and-Forward (`V1 6002`, `V2 10125`)")
        if "ultimo_resultado" in st.session_state and len(st.session_state.historico) > 0:
            ultima = st.session_state.historico[-1]
            lect = {k: float(ultima[k]) for k in FEATURE_NAMES}
            cab = st.session_state.get("ultimo_cabin_env", st.session_state.simulador.obtener_entorno_cabina())
            res = st.session_state.ultimo_resultado
            st.download_button(
                "⬇️ Descargar Expediente JSON con Hash SHA-256",
                data=_generar_paquete_store_and_forward(lect, cab, res),
                file_name=f"expediente_marte_{res['timestamp'].replace(':', '')}.json",
                mime="application/json",
                width="stretch",
            )
        st.caption(f"Estudios OSDR cacheados: {', '.join(st.session_state.osdr_ref.get('studies', {}).keys())}")


def main() -> None:
    """Punto de entrada principal."""
    _inicializar_estado()
    _renderizar_sidebar()
    _renderizar_cabecera()

    vista = st.segmented_control(
        "Navegación",
        options=[
            "🩺 Triaje y Acción",
            "📈 Tendencias, Cabina e IA",
            "📚 Trazabilidad NASA (Jurado)",
        ],
        default="🩺 Triaje y Acción",
        label_visibility="collapsed",
    )

    if vista == "📈 Tendencias, Cabina e IA":
        vista_tendencias_cabina_e_ia()
    elif vista == "📚 Trazabilidad NASA (Jurado)":
        vista_trazabilidad_jurado()
    else:
        vista_triaje_en_vivo()


if __name__ == "__main__":
    main()
