"""
Consola Espacial Autónoma de Monitorización Biomédica y Triaje en Tránsito a Marte (MecaSpace).

Alineada con NASA-STD-3001 Vol. 1 Rev. C (2023) y Vol. 2 Rev. E (2025):
- Misión: Tránsito interplanetario a Marte (> 30/60 días, microgravedad prolongada,
  entorno cerrado) con latencia de hasta 20 min por sentido (~40 min ida/vuelta, V2 10083)
  y sin evacuación médica posible (V1 3007).
- Arquitectura híbrida: Reglas deterministas previas (≤ 1,0 s Tabla 10.2-1) + XGBoost +
  SHAP (V2 10169-10170) + LLM local / respaldo offline con límites de alcance (V2 10171).
- Codificación cromática oficial Tabla F.5-1 (Rojo parpadeante Emergency, Rojo Warning,
  Amarillo Caution, Azul Advisory, Verde Nominal, Cian Stale) y pasos Magenta (Tabla F.5-2).
"""

from __future__ import annotations

import hashlib
import json
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
    estimar_temp_central,
    obtener_referencias_osdr,
)
from simulador_sensores import ESCENARIOS_OBJETIVO, SimuladorSensores

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "modelo_xgb.json"

st.set_page_config(
    page_title="MecaSpace | Triaje Autónomo en Tránsito a Marte",
    page_icon="🛰️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Estilos de consola espacial con contraste ≥ 6:1 (F.5.10.f) y codificación Tabla F.5-1
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
        padding: 16px 20px;
        margin-bottom: 12px;
        border: 2px solid;
    }
    .status-nominal {
        background: linear-gradient(135deg, rgba(6, 78, 59, 0.50), rgba(15, 23, 42, 0.94));
        border-color: #10B981;
    }
    .status-advisory {
        background: linear-gradient(135deg, rgba(30, 58, 138, 0.55), rgba(15, 23, 42, 0.94));
        border-color: #3B82F6;
    }
    .status-caution {
        background: linear-gradient(135deg, rgba(120, 53, 15, 0.62), rgba(15, 23, 42, 0.94));
        border-color: #F59E0B;
    }
    .status-warning {
        background: linear-gradient(135deg, rgba(127, 29, 29, 0.78), rgba(15, 23, 42, 0.94));
        border-color: #EF4444;
    }
    .status-emergency-flashing {
        border-color: #EF4444;
        animation: nasa-emergency-flash 1.2s infinite;
    }
    .status-emergency-steady {
        background: linear-gradient(135deg, rgba(153, 27, 27, 0.82), rgba(15, 23, 42, 0.94));
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
        padding: 6px 12px;
        margin-bottom: 8px;
    }
    .directive-card {
        background-color: #0F172A;
        border: 1px solid #334155;
        border-left: 5px solid #10B981;
        border-radius: 8px;
        padding: 13px 15px;
        height: 100%;
    }
    .directive-card-advisory { border-left-color: #3B82F6; }
    .directive-card-caution { border-left-color: #F59E0B; background-color: rgba(120, 53, 15, 0.18); }
    .directive-card-warning, .directive-card-emergency {
        border-left-color: #EF4444;
        background-color: rgba(127, 29, 29, 0.24);
    }
    .kpi-card {
        background-color: #0F172A;
        border: 1px solid #1E293B;
        border-left: 5px solid #10B981;
        border-radius: 8px;
        padding: 11px 14px;
        margin-bottom: 8px;
    }
    .kpi-nominal { border-left-color: #10B981; }
    .kpi-caution { border-left-color: #F59E0B; background-color: rgba(120, 53, 15, 0.16); }
    .kpi-warning { border-left-color: #EF4444; background-color: rgba(127, 29, 29, 0.22); }
    .kpi-stale { border-left-color: #06B6D4; background-color: rgba(8, 145, 178, 0.18); }
    .badge-pill {
        display: inline-block;
        padding: 3px 9px;
        border-radius: 999px;
        font-size: 0.77rem;
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
    .badge-magenta {
        background-color: rgba(217, 70, 239, 0.18);
        border-color: #D946EF;
        color: #F5D0FE;
    }
    .proc-step-system {
        border-left: 4px solid #D946EF;
        background-color: rgba(112, 26, 117, 0.20);
        padding: 8px 12px;
        border-radius: 6px;
        margin-bottom: 6px;
        color: #FAE8FF;
    }
    .proc-step-crew {
        border-left: 4px solid #38BDF8;
        background-color: rgba(15, 23, 42, 0.9);
        padding: 8px 12px;
        border-radius: 6px;
        margin-bottom: 6px;
        color: #F1F5F9;
    }
    </style>
    """,
    unsafe_allow_html=True,
)


def _inicializar_estado() -> None:
    """Inicializa componentes y buffers persistentes en `st.session_state`."""
    if "simulador" not in st.session_state:
        st.session_state.simulador = SimuladorSensores(seed=42)
    if "historico" not in st.session_state:
        st.session_state.historico = deque(maxlen=90)
    if "simulacion_activa" not in st.session_state:
        st.session_state.simulacion_activa = True
    if "forzar_llm" not in st.session_state:
        st.session_state.forzar_llm = False
    if "intervalo_llm" not in st.session_state:
        st.session_state.intervalo_llm = 25
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
    if "alertas_inhibidas" not in st.session_state:
        st.session_state.alertas_inhibidas = []
    if "escenario_selector" not in st.session_state:
        st.session_state.escenario_selector = "nominal"
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


def _evaluar_estado_variable(
    var: str,
    valor: float,
    umbrales: dict[str, Any],
    es_obsoleto: bool = False,
) -> dict[str, str]:
    """
    Devuelve codificación cromática Tabla F.5-1 y flecha direccional redundante
    (F.4.3.1.d / V2 10045) para una variable biomédica.
    """
    if es_obsoleto:
        return {
            "nivel": "STALE",
            "css": "kpi-stale",
            "badge": "🟦 OBSOLETO (CIAN)",
            "flecha": "⏱",
        }

    cfg = umbrales["biomarkers"][var]
    cb = cfg.get("critico_bajo")
    ca = cfg.get("critico_alto")
    n_min, n_max = cfg["normal"]

    if cb is not None and valor < float(cb):
        return {"nivel": "CRITICAL", "css": "kpi-warning", "badge": "🔴 CRÍTICO ↓", "flecha": "↓"}
    if ca is not None and valor > float(ca):
        return {"nivel": "CRITICAL", "css": "kpi-warning", "badge": "🔴 CRÍTICO ↑", "flecha": "↑"}
    if var == "nivel_actividad" and 0.0 <= valor <= float(n_max):
        return {"nivel": "NOMINAL", "css": "kpi-nominal", "badge": "🟢 NOMINAL", "flecha": "•"}
    if float(n_min) <= valor <= float(n_max):
        return {"nivel": "NOMINAL", "css": "kpi-nominal", "badge": "🟢 NOMINAL", "flecha": "•"}

    flecha = "↓" if valor < float(n_min) else "↑"
    return {
        "nivel": "CAUTION",
        "css": "kpi-caution",
        "badge": f"🟡 PRECAUCIÓN {flecha}",
        "flecha": flecha,
    }


def _emitir_audio_dual_nasa(nivel_nasa: str) -> None:
    """
    Reproduce secuencia acústica conforme a Tabla 10.3-1 y pre-alerta V2 10176 (-10 dB
    previo al tono completo) usando Web Audio API cuando el audio está habilitado
    y no se ha presionado el silenciamiento global (F.6.4.k / V2 10116).
    """
    if (
        not st.session_state.audio_habilitado
        or st.session_state.alarma_silenciada
        or nivel_nasa in {"Nominal", "Advisory"}
    ):
        return

    freq_map = {
        "Emergency": (650, 1500, 0.22),
        "Warning": (400, 1024, 0.18),
        "Caution": (512, 512, 0.14),
    }
    f1, f2, gain_final = freq_map.get(nivel_nasa, (512, 512, 0.12))
    gain_pre = round(gain_final * 0.316, 4)  # -10 dB pre-alerta (V2 10176)

    components.html(
        f"""
        <script>
        (function() {{
            try {{
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (!AudioCtx) return;
                const ctx = new AudioCtx();
                const now = ctx.currentTime;
                const osc1 = ctx.createOscillator();
                const g1 = ctx.createGain();
                osc1.type = "{ 'triangle' if nivel_nasa == 'Caution' else 'sine' }";
                osc1.frequency.setValueAtTime({f1}, now);
                g1.gain.setValueAtTime({gain_pre}, now);
                osc1.connect(g1); g1.connect(ctx.destination);
                osc1.start(now); osc1.stop(now + 0.15);

                const osc2 = ctx.createOscillator();
                const g2 = ctx.createGain();
                osc2.type = "{ 'triangle' if nivel_nasa == 'Caution' else 'sine' }";
                osc2.frequency.setValueAtTime({f2}, now + 0.35);
                g2.gain.setValueAtTime({gain_final}, now + 0.35);
                osc2.connect(g2); g2.connect(ctx.destination);
                osc2.start(now + 0.35); osc2.stop(now + 0.60);
            }} catch (e) {{}}
        }})();
        </script>
        """,
        height=0,
    )


def _construir_graficos_grupo(
    df_hist: pd.DataFrame,
    variables: list[str],
    umbrales: dict[str, Any],
    filas: int,
    cols: int,
    altura: int,
) -> go.Figure:
    """Construye gráfico temporal con bandas nominales verdes NASA."""
    fig = make_subplots(
        rows=filas,
        cols=cols,
        subplot_titles=[
            f"{ETIQUETAS_LEGIBLES[v]} ({umbrales['biomarkers'][v]['unit']})"
            for v in variables
        ],
        vertical_spacing=0.16,
        horizontal_spacing=0.07,
    )

    paleta = ["#38BDF8", "#FB7185", "#FBBF24", "#F472B6", "#A78BFA", "#34D399"]
    for idx, var in enumerate(variables):
        r = (idx // cols) + 1
        c = (idx % cols) + 1
        norm_min, norm_max = umbrales["biomarkers"][var]["normal"]
        color = paleta[idx % len(paleta)]

        fig.add_hrect(
            y0=float(norm_min),
            y1=float(norm_max),
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
                marker={"size": 4, "color": color},
                line={"width": 2, "color": color},
                name=var,
                showlegend=False,
            ),
            row=r,
            col=c,
        )

    fig.update_layout(
        height=altura,
        margin={"l": 20, "r": 20, "t": 38, "b": 20},
        paper_bgcolor="#0B1220",
        plot_bgcolor="#0F172A",
        font={"color": "#E2E8F0", "size": 11},
    )
    fig.update_xaxes(showgrid=False, tickfont={"size": 9}, nticks=4)
    fig.update_yaxes(gridcolor="#1E293B", zeroline=False)
    return fig


def _construir_grafico_shap(top3_shap: list[dict[str, Any]]) -> go.Figure:
    """Genera gráfico de barras horizontal para los 3 factores SHAP determinantes."""
    ordenado = list(reversed(top3_shap))
    etiquetas = [f"{item['nombre']} ({item['valor']} {item['unidad']})" for item in ordenado]
    valores = [item["shap_valor"] for item in ordenado]
    colores = ["#EF4444" if v >= 0 else "#38BDF8" for v in valores]

    fig = go.Figure(
        go.Bar(
            x=valores,
            y=etiquetas,
            orientation="h",
            marker_color=colores,
            text=[f"{v:+.3f}" for v in valores],
            textposition="outside",
        )
    )
    fig.update_layout(
        title="Contribución SHAP hacia la clasificación (V2 10169-10170)",
        height=265,
        margin={"l": 15, "r": 45, "t": 42, "b": 20},
        paper_bgcolor="#0B1220",
        plot_bgcolor="#0F172A",
        font={"color": "#F1F5F9", "size": 12},
        xaxis_title="Impacto SHAP (log-odds)",
    )
    fig.update_xaxes(gridcolor="#1E293B", zeroline=True, zerolinecolor="#64748B")
    fig.update_yaxes(showgrid=False)
    return fig


def _generar_paquete_store_and_forward(
    lectura: dict[str, float],
    cabin_env: dict[str, float],
    resultado: dict[str, Any],
) -> str:
    """Genera expediente cifrable/verificable store-and-forward (V1 6002, V1 3004.a, V2 10125)."""
    payload = {
        "schema": "MecaSpace-StoreAndForward-v2",
        "standard_ref": "NASA-STD-3001 Vol.1 Rev.C (V1 3004.a, V1 6002) & Vol.2 Rev.E (V2 10125)",
        "mission_context": "Tránsito a Marte | Latencia 20 min/sentido (~40 min RTT)",
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "nasa_alert_level": resultado["nivel_nasa"],
        "protocolo_codigo": resultado["protocolo_codigo"],
        "excede_alcance_v2_10171": resultado["excede_alcance"],
        "diagnostico": resultado["diagnostico"],
        "directivas": resultado["directivas"],
        "temp_cutanea_astroskin_c": lectura["temp_corporal"],
        "temp_central_estimada_c": resultado["temp_central_est"],
        "telemetria_12_variables": lectura,
        "entorno_cabina": cabin_env,
        "top3_shap": resultado["top3_shap"],
    }
    raw_bytes = json.dumps(payload, sort_keys=True, ensure_ascii=False).encode("utf-8")
    payload["sha256_integrity"] = hashlib.sha256(raw_bytes).hexdigest()
    return json.dumps(payload, indent=2, ensure_ascii=False)


def _renderizar_cabecera_y_emergencia() -> None:
    """
    Renderiza cabecera persistente con botón directo de emergencia independiente
    de sensores (V2 10178) y silenciamiento global en una sola acción (F.6.4.k / V2 10116).
    """
    col_titulo, col_emerg, col_mute, col_ack = st.columns([4.2, 2.3, 1.8, 1.7])

    with col_titulo:
        st.markdown("## 👨‍🚀 MecaSpace — Triaje Biomédico en Tránsito a Marte")
        st.caption(
            "Autonomía local (≤ 1,0 s Tabla 10.2-1) · Latencia Tierra: hasta 20 min/sentido (V2 10083) · "
            "Sin evacuación (V1 3007)"
        )

    with col_emerg:
        st.markdown('<div class="hazard-header-box">', unsafe_allow_html=True)
        if not st.session_state.emergencia_manual:
            if st.button(
                "🚨 EMERGENCIA MANUAL (V2 10178)",
                type="primary",
                width="stretch",
                help="Disparador directo independiente de telemetría ante dolor torácico o colapso súbito.",
            ):
                st.session_state.emergencia_manual = True
                st.session_state.parpadeo_detenido = False
                st.session_state.alerta_reconocida = False
                st.session_state.alarma_silenciada = False
                st.session_state.forzar_llm = True
                st.session_state.simulador.inyectar_sobrecarga_cardiovascular(critica=True)
                st.rerun()
        else:
            if st.button(
                "✅ Desactivar Emergencia Manual",
                width="stretch",
            ):
                st.session_state.emergencia_manual = False
                st.session_state.forzar_llm = True
                st.rerun()
        st.markdown("</div>", unsafe_allow_html=True)

    with col_mute:
        label_mute = "🔊 Reactivar Audio" if st.session_state.alarma_silenciada else "🔇 Silenciar Alarma"
        if st.button(label_mute, width="stretch", help="Silenciamiento global en una sola acción (F.6.4.k, V2 10116)."):
            st.session_state.alarma_silenciada = not st.session_state.alarma_silenciada
            st.session_state.parpadeo_detenido = True
            st.rerun()

    with col_ack:
        label_ack = "✓ Reconocida" if st.session_state.alerta_reconocida else "✓ Acknowledge"
        if st.button(label_ack, width="stretch", help="Reconocer alerta activa y detener parpadeo (F.5.10.g, F.6.4)."):
            st.session_state.alerta_reconocida = True
            st.session_state.parpadeo_detenido = True
            st.rerun()


def _renderizar_sidebar() -> None:
    """Construye la barra lateral con selector de escenarios, entradas manuales y anclaje NASA."""
    sim: SimuladorSensores = st.session_state.simulador
    osdr_ref: dict[str, Any] = st.session_state.osdr_ref

    with st.sidebar:
        st.markdown("### 🛰️ Control de Misión a Marte")
        st.info(
            "**Perfil:** Tránsito interplanetario (> 30/60 días)\n\n"
            "**Latencia Tierra:** Hasta 20 min/sentido (~40 min RTT)\n\n"
            f"**Escenario activo:** `{ESCENARIOS_OBJETIVO[sim.escenario_actual]['label']}`"
        )

        # ------------------------------------------------------------------
        # Sugerencia de Ajuste 3: Selector de escenarios preconfigurados
        # ------------------------------------------------------------------
        st.markdown("#### 🎛️ Selector de Escenarios en Vivo")
        claves_esc = list(ESCENARIOS_OBJETIVO.keys())
        seleccion = st.selectbox(
            "Escenario de demostración",
            options=claves_esc,
            index=claves_esc.index(sim.escenario_actual),
            format_func=lambda k: ESCENARIOS_OBJETIVO[k]["label"],
        )
        col_ap1, col_ap2 = st.columns(2)
        with col_ap1:
            if st.button("▶ Inyectar Escenario", type="primary", width="stretch"):
                st.session_state.emergencia_manual = False
                st.session_state.alerta_reconocida = False
                st.session_state.parpadeo_detenido = False
                st.session_state.datos_manuales_obsoletos = False
                st.session_state.forzar_llm = True
                sim.activar_escenario(seleccion, inmediato=True)
                st.rerun()
        with col_ap2:
            if st.button("🟢 Nominal", width="stretch"):
                st.session_state.emergencia_manual = False
                st.session_state.datos_manuales_obsoletos = False
                st.session_state.forzar_llm = True
                sim.restaurar_nominal()
                st.rerun()

        # Botones directos para los 3 escenarios clave de la demo del Hackathon
        if st.button("😴 Sueño + Desregulación Glucémica", width="stretch"):
            st.session_state.emergencia_manual = False
            st.session_state.forzar_llm = True
            sim.inyectar_privacion_sueno_glucemia(critica=False)
            st.rerun()
        if st.button("❤️ Evento Cardiovascular Agudo (Consigna)", width="stretch"):
            st.session_state.alerta_reconocida = False
            st.session_state.parpadeo_detenido = False
            st.session_state.forzar_llm = True
            sim.inyectar_sobrecarga_cardiovascular(critica=True)
            st.rerun()
        if st.button("❄️ Hipotermia Central < 35 °C", width="stretch"):
            st.session_state.alerta_reconocida = False
            st.session_state.forzar_llm = True
            sim.inyectar_hipotermia()
            st.rerun()

        st.divider()

        # ------------------------------------------------------------------
        # Entradas Multimodales Manuales (Glucemia + Estado de Ánimo)
        # ------------------------------------------------------------------
        st.markdown("#### 🩸 Entrada Multimodal Manual")
        st.caption("Astroskin/Actiwatch no miden glucemia ni ánimo; ingreso periódico requerido.")
        with st.form("form_manual_multimodal"):
            gluc_in = st.number_input(
                "Glucemia capilar (mg/dL)",
                min_value=35.0,
                max_value=350.0,
                value=float(sim.valores_actuales["glucemia"]),
                step=1.0,
            )
            animo_in = st.slider(
                "Estado de ánimo (1 = crítico, 10 = óptimo)",
                min_value=1.0,
                max_value=10.0,
                value=float(sim.valores_actuales["estado_animo"]),
                step=0.5,
            )
            guardar_manual = st.form_submit_button("Registrar Medición Manual", width="stretch")
            if guardar_manual:
                sim.registrar_entrada_manual(glucemia=gluc_in, estado_animo=animo_in)
                st.session_state.datos_manuales_obsoletos = False
                st.session_state.ultimo_registro_manual_ts = datetime.now(timezone.utc).astimezone().strftime("%H:%M:%S")
                st.session_state.forzar_llm = True
                st.rerun()

        if st.button("🟦 Simular Dato Manual Obsoleto (Cian)", width="stretch"):
            st.session_state.datos_manuales_obsoletos = not st.session_state.datos_manuales_obsoletos
            st.session_state.forzar_llm = True
            st.rerun()

        st.divider()

        # ------------------------------------------------------------------
        # Controles de Telemetría, Audio y Auditoría de Alertas (V2 10156)
        # ------------------------------------------------------------------
        st.markdown("#### ⚙️ Telemetría y Alertas")
        col_p1, col_p2 = st.columns(2)
        with col_p1:
            etiqueta_play = "⏸️ Pausar" if st.session_state.simulacion_activa else "▶️ Reanudar"
            if st.button(etiqueta_play, width="stretch"):
                st.session_state.simulacion_activa = not st.session_state.simulacion_activa
                st.rerun()
        with col_p2:
            if st.button("🧹 Limpiar", width="stretch"):
                st.session_state.historico.clear()
                st.rerun()

        st.session_state.audio_habilitado = st.toggle(
            "🔊 Audio dual-codificado (Tabla 10.3-1)",
            value=bool(st.session_state.audio_habilitado),
            help="Emite pre-alerta -10 dB (V2 10176) antes del tono completo.",
        )

        st.session_state.intervalo_llm = st.slider(
            "Intervalo refresco LM Studio (s)",
            min_value=10,
            max_value=90,
            value=int(st.session_state.intervalo_llm),
            step=5,
        )
        if st.button("🔄 Forzar Consulta LM Studio", width="stretch"):
            st.session_state.forzar_llm = True

        st.session_state.alertas_inhibidas = st.multiselect(
            "Alertas inhibidas (sensor fuera de servicio)",
            options=["glucemia", "estado_animo", "temp_corporal"],
            default=st.session_state.alertas_inhibidas,
            help="Auditoría periódica requerida por V2 10156.",
        )
        if st.session_state.alertas_inhibidas:
            st.warning(f"Auditoría V2 10156: {len(st.session_state.alertas_inhibidas)} canal(es) inhibido(s).")

        st.divider()
        with st.expander("📚 Anclaje Científico y Alcance Normativo", expanded=False):
            st.markdown(
                "- **Norma:** `NASA-STD-3001 Vol. 1 Rev. C` (2023) y `Vol. 2 Rev. E` (2025).\n"
                "- **Hardware del equipo:** Astroskin + Actiwatch Spectrum (seleccionados para `V1 3004.h`, `V1 6001` y `V2 9023`; sin homologación comercial en 3001).\n"
                "- **Honestidad de umbrales:** `3001` no fija cifras fijas en reposo para PA, FC, glucemia o ánimo; se evalúan desvíos de línea base (`V1 3000`, `V1 4015-4017`) junto con límites explícitos de norma (`< 35 °C` hipotermia central `Vol. 1 Apéndice C`, `8,5 h` sueño `V1 6001`, `P_I O₂`/`ppCO₂` `V2 6003-6004`).\n"
                f"- **Modo OSDR:** `{osdr_ref.get('source_mode', 'local_cache')}`"
            )
            for sid, meta in osdr_ref.get("studies", {}).items():
                st.caption(f"**{sid}**: {meta.get('title', '')}")


@st.fragment(run_every=2)
def panel_telemetria_en_vivo() -> None:
    """Fragmento de actualización cada 2 s con latencia ≤ 1,0 s (Tabla 10.2-1)."""
    motor: MotorInferencia | None = st.session_state.motor
    sim: SimuladorSensores = st.session_state.simulador
    umbrales: dict[str, Any] = st.session_state.umbrales_nasa

    if motor is None:
        st.error(
            "No se encontró `modelo_xgb.json`. Ejecuta `python nasa_referencia.py`, "
            "`python generador_datos.py` y `python entrenar_modelo.py`."
        )
        return

    cabin_env = sim.obtener_entorno_cabina()
    stale_flag = bool(st.session_state.datos_manuales_obsoletos) or (not st.session_state.simulacion_activa)

    if st.session_state.simulacion_activa or len(st.session_state.historico) == 0:
        lectura_actual = sim.leer_sensores()
        forzar = bool(st.session_state.forzar_llm)
        st.session_state.forzar_llm = False

        resultado = motor.evaluar(
            lectura=lectura_actual,
            cabin_env=cabin_env,
            emergencia_manual=bool(st.session_state.emergencia_manual),
            datos_obsoletos=stale_flag,
            intervalo_llm_seg=float(st.session_state.intervalo_llm),
            forzar_llm=forzar,
        )
        st.session_state.ultimo_resultado = resultado
        st.session_state.ultimo_cabin_env = cabin_env

        fila_hist = dict(lectura_actual)
        fila_hist["timestamp"] = resultado["timestamp"]
        fila_hist["estado_riesgo"] = resultado["estado_riesgo"]
        fila_hist["temp_central_est"] = resultado["temp_central_est"]
        st.session_state.historico.append(fila_hist)
    else:
        resultado = st.session_state.ultimo_resultado
        cabin_env = st.session_state.get("ultimo_cabin_env", cabin_env)
        if st.session_state.forzar_llm:
            st.session_state.forzar_llm = False
            ultima_lectura = {k: st.session_state.historico[-1][k] for k in FEATURE_NAMES}
            resultado = motor.evaluar(
                lectura=ultima_lectura,
                cabin_env=cabin_env,
                emergencia_manual=bool(st.session_state.emergencia_manual),
                datos_obsoletos=stale_flag,
                intervalo_llm_seg=float(st.session_state.intervalo_llm),
                forzar_llm=True,
            )
            st.session_state.ultimo_resultado = resultado

    hist_list = list(st.session_state.historico)
    actual_row = hist_list[-1]
    prev_row = hist_list[-2] if len(hist_list) >= 2 else actual_row
    lectura_actual_dict = {k: float(actual_row[k]) for k in FEATURE_NAMES}

    nivel_nasa = resultado["nivel_nasa"]
    _emitir_audio_dual_nasa(nivel_nasa)

    # ------------------------------------------------------------------
    # PANEL SUPERIOR: Codificación Tabla F.5-1 + Trazabilidad + Directivas
    # ------------------------------------------------------------------
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

    card_css_map = {
        "Emergency": "directive-card directive-card-emergency",
        "Warning": "directive-card directive-card-warning",
        "Caution": "directive-card directive-card-caution",
        "Advisory": "directive-card directive-card-advisory",
        "Nominal": "directive-card",
    }
    card_css = card_css_map.get(nivel_nasa, "directive-card")
    nivel_info = NASA_ALERT_LEVELS.get(nivel_nasa, NASA_ALERT_LEVELS["Nominal"])
    prob_clase = resultado["probabilidades"][resultado["etiqueta_riesgo"]]

    stale_pill = (
        '<span class="badge-pill badge-cyan">CIAN: DATO MANUAL OBSOLETO (V2 10020)</span>'
        if st.session_state.datos_manuales_obsoletos
        else ""
    )
    alcance_pill = (
        '<span class="badge-pill badge-magenta">EXCEDE ALCANCE V2 10171 → ECG/ECO V1 3004.i</span>'
        if resultado["excede_alcance"]
        else ""
    )
    det_pill = (
        '<span class="badge-pill">Guardia Determinista Activa</span>'
        if resultado["regla_determinista_disparada"]
        else '<span class="badge-pill">XGBoost + SHAP</span>'
    )

    st.markdown(
        f"""
        <div class="status-banner {banner_css}">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <div style="font-size:1.38rem; font-weight:800;">
                    {icono} {nivel_info['label_es']} · {resultado['protocolo_codigo']}
                </div>
                <div>
                    {stale_pill}
                    {alcance_pill}
                    {det_pill}
                    <span class="badge-pill">Latencia Triaje: {resultado['latencia_ml_ms']:.1f} ms (≤1000 ms)</span>
                    <span class="badge-pill">Confianza XGBoost: {prob_clase:.1%}</span>
                    <span class="badge-pill">{resultado['origen_diagnostico']} · {resultado['timestamp']}</span>
                </div>
            </div>
            <div style="margin-top:9px; font-size:1.05rem; color:#F8FAFC;">
                <strong>Diagnóstico trazable:</strong> {resultado['diagnostico']}
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    directivas = resultado["directivas"]
    col_d1, col_d2 = st.columns(2)
    with col_d1:
        st.markdown(
            f"""
            <div class="{card_css}">
                <div style="font-size:0.76rem; text-transform:uppercase; color:#94A3B8; font-weight:700;">
                    Directiva Operativa 1 (Tripulante no médico · V2 7045)
                </div>
                <div style="margin-top:6px; font-size:0.97rem; color:#F8FAFC;">
                    {directivas[0] if len(directivas) > 0 else 'Mantener vigilancia continua.'}
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )
    with col_d2:
        st.markdown(
            f"""
            <div class="{card_css}">
                <div style="font-size:0.76rem; text-transform:uppercase; color:#94A3B8; font-weight:700;">
                    Directiva Operativa 2 (Escalado / Store-and-Forward · V1 6002)
                </div>
                <div style="margin-top:6px; font-size:0.97rem; color:#F8FAFC;">
                    {directivas[1] if len(directivas) > 1 else 'Registrar en historia electrónica cifrada.'}
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    # ------------------------------------------------------------------
    # PROCEDIMIENTO ELECTRÓNICO DIRECTO (F.6.4.h / Tabla F.5-2 Magenta)
    # ------------------------------------------------------------------
    proc = resultado["procedimiento_electronico"]
    expand_proc = nivel_nasa in {"Emergency", "Warning", "Caution"}
    with st.expander(
        f"📋 Procedimiento Electrónico Asociado ({resultado['protocolo_codigo']} — {proc['titulo']}) [F.6.4.h]",
        expanded=expand_proc,
    ):
        st.caption(f"Referencias normativas: `{proc['referencias']}` · Pasos en Magenta = acción dirigida por sistema (Tabla F.5-2).")
        for idx_p, paso in enumerate(proc["pasos"], start=1):
            css_p = "proc-step-system" if paso["sistema"] else "proc-step-crew"
            st.markdown(
                f'<div class="{css_p}"><strong>Paso {idx_p}:</strong> {paso["texto"]}</div>',
                unsafe_allow_html=True,
            )

        col_sf1, col_sf2 = st.columns([2.2, 1.0])
        with col_sf1:
            if resultado["excede_alcance"]:
                st.warning(
                    "**Límite de Alcance Declarado (V2 10171):** Cuadro grave que excede el triaje automático. "
                    "Escalar a CMO (V1 3006) con ECG/ecografía a bordo (V1 3004.i, V1 5003) y remitir lote cifrado a Tierra."
                )
        with col_sf2:
            bundle_json = _generar_paquete_store_and_forward(lectura_actual_dict, cabin_env, resultado)
            st.download_button(
                "📦 Exportar Lote Store-and-Forward (V1 6002)",
                data=bundle_json,
                file_name=f"mecaspace_{resultado['protocolo_codigo'].lower()}_{resultado['timestamp'].replace(':', '')}.json",
                mime="application/json",
                width="stretch",
            )

    # ------------------------------------------------------------------
    # SECCIÓN 1: LOS 6 INDICADORES CENTRALES DE LA CONSIGNA
    # ------------------------------------------------------------------
    st.markdown("#### 🎯 6 Indicadores Prioritarios de la Consigna (Wearables + Entradas Multimodales)")
    for row_idx in range(2):
        cols = st.columns(3)
        for col_idx in range(3):
            var = CONSIGNA_SIX_INDICATORS[row_idx * 3 + col_idx]
            cfg = umbrales["biomarkers"][var]
            val = float(actual_row[var])
            delta = round(val - float(prev_row[var]), 2)
            es_manual = var in {"glucemia", "estado_animo"}
            es_obsoleto = (es_manual and st.session_state.datos_manuales_obsoletos) or (var in st.session_state.alertas_inhibidas)
            estado = _evaluar_estado_variable(var, val, umbrales, es_obsoleto=es_obsoleto)
            norm_min, norm_max = cfg["normal"]

            extra_txt = ""
            if var == "temp_corporal":
                t_cent = float(resultado["temp_central_est"])
                alerta_hipo = " ⚠ <35°C CENTRAL" if t_cent < 35.0 else ""
                extra_txt = f"Central est.: <b>{t_cent:.2f} °C</b>{alerta_hipo} (Vol. 1 Ap. C)"
            elif var == "horas_sueno":
                extra_txt = f"Meta V1 6001: <b>8.5 h</b> | Efic. Actiwatch: <b>{actual_row['eficiencia_sueno']:.1f}%</b>"
            elif es_manual:
                extra_txt = f"Último registro manual: {st.session_state.ultimo_registro_manual_ts}"
            else:
                extra_txt = f"Fuente: {cfg['sensor']}"

            with cols[col_idx]:
                st.markdown(
                    f"""
                    <div class="kpi-card {estado['css']}">
                        <div style="display:flex; justify-content:space-between; font-size:0.82rem; color:#CBD5E1; font-weight:700;">
                            <span>{ETIQUETAS_LEGIBLES[var]}</span>
                            <span>{estado['badge']}</span>
                        </div>
                        <div style="font-size:1.55rem; font-weight:800; color:#F8FAFC; margin:4px 0;">
                            {val} <span style="font-size:0.95rem; font-weight:600; color:#94A3B8;">{cfg['unit']}</span>
                            <span style="font-size:0.95rem; color:#E2E8F0; margin-left:4px;">{estado['flecha']}</span>
                        </div>
                        <div style="font-size:0.78rem; color:#94A3B8;">
                            Δ {delta:+} | Ref: {norm_min}–{norm_max} {cfg['unit']}<br>{extra_txt}
                        </div>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )

    # ------------------------------------------------------------------
    # SECCIÓN 2: TELEMETRÍA AUXILIAR WEARABLE Y AMBIENTAL DE CABINA
    # ------------------------------------------------------------------
    st.markdown("#### 🛰️ Contexto Fisiológico Auxiliar (Astroskin/Actiwatch) y Cabina (V2 6003-6014)")
    aux_vars = ["spo2", "frec_respiratoria", "vol_respiratorio", "anomalia_ecg", "nivel_actividad"]
    cols_aux = st.columns(7)
    for idx, var in enumerate(aux_vars):
        cfg = umbrales["biomarkers"][var]
        val = float(actual_row[var])
        estado = _evaluar_estado_variable(var, val, umbrales)
        with cols_aux[idx]:
            st.metric(
                label=f"{ETIQUETAS_LEGIBLES[var].split(' ')[0]} {estado['flecha']}",
                value=f"{val} {cfg['unit']}",
                delta=estado["badge"],
                delta_color="off",
            )
    with cols_aux[5]:
        pi_o2 = cabin_env["pi_o2_mmhg"]
        o2_tag = "🟢 145–155" if 145.0 <= pi_o2 <= 155.0 else ("🔴 <122 Crít" if pi_o2 < 122.0 else "🟡 Desvío")
        st.metric("Cabina P_I O₂", f"{pi_o2} mmHg", delta=o2_tag, delta_color="off")
    with cols_aux[6]:
        ppco2 = cabin_env["ppco2_mmhg"]
        co2_tag = "🟢 ≤3.0" if ppco2 <= 3.0 else ("🔴 >5.3 Crít" if ppco2 > 5.3 else "🟡 >3.0")
        st.metric("Cabina ppCO₂", f"{ppco2} mmHg", delta=co2_tag, delta_color="off")

    # ------------------------------------------------------------------
    # SECCIÓN 3: GRÁFICOS TEMPORALES Y EXPLICABILIDAD SHAP
    # ------------------------------------------------------------------
    df_hist = pd.DataFrame(hist_list)
    tab_6, tab_aux = st.tabs([
        "📈 Tendencias: 6 Indicadores Prioritarios",
        "📊 Tendencias: Contexto Cardiorrespiratorio y Sueño",
    ])
    with tab_6:
        st.plotly_chart(
            _construir_graficos_grupo(df_hist, CONSIGNA_SIX_INDICATORS, umbrales, filas=2, cols=3, altura=430),
            width="stretch",
            key="chart_6_consigna",
        )
    with tab_aux:
        aux_chart_vars = ["spo2", "frec_respiratoria", "vol_respiratorio", "anomalia_ecg", "nivel_actividad", "eficiencia_sueno"]
        st.plotly_chart(
            _construir_graficos_grupo(df_hist, aux_chart_vars, umbrales, filas=2, cols=3, altura=430),
            width="stretch",
            key="chart_aux_wearables",
        )

    st.markdown("#### 🧠 Explicabilidad Clínica (XAI - Top 3 Factores SHAP)")
    col_xai_chart, col_xai_table = st.columns([1.3, 1.0])
    with col_xai_chart:
        st.plotly_chart(
            _construir_grafico_shap(resultado["top3_shap"]),
            width="stretch",
            key="shap_bar_chart",
        )
    with col_xai_table:
        df_shap = pd.DataFrame(
            [
                {
                    "Biomarcador": item["nombre"],
                    "Lectura": f"{item['valor']} {item['unidad']}",
                    "Línea Base": item["rango_nominal"],
                    "SHAP": round(item["shap_valor"], 4),
                    "Efecto": item["direccion"],
                }
                for item in resultado["top3_shap"]
            ]
        )
        st.dataframe(df_shap, width="stretch", hide_index=True)
        if resultado["regla_determinista_disparada"]:
            st.error("Guardia determinista previa activada: " + " | ".join(resultado["razones_deterministas"]))
        st.caption(
            f"Probabilidades XGBoost → Normal: {resultado['probabilidades']['Normal']:.1%} | "
            f"Preventivo: {resultado['probabilidades']['Preventivo']:.1%} | "
            f"Crítico: {resultado['probabilidades']['Crítico']:.1%}"
        )


def _renderizar_caja_llm_y_conductual() -> None:
    """Caja interactiva con Oficial Médico CDSS y módulo conductual asíncrono (V1 3004.q)."""
    motor: MotorInferencia | None = st.session_state.motor
    if motor is None:
        return

    st.divider()
    col_chat, col_cond = st.columns([1.65, 1.0])

    with col_chat:
        st.markdown("#### 💬 Asistente Clínico Autónomo (LM Studio / Respaldo NASA)")
        st.caption(
            "Recibe la telemetría multimodal actual, temperatura central estimada, Top 3 SHAP "
            "y protocolos NASA-STD-3001. Declara límites de alcance (V2 10171)."
        )

        for msg in st.session_state.chat_llm[-6:]:
            with st.chat_message(msg["role"]):
                st.markdown(msg["content"])
                if msg.get("origen"):
                    st.caption(f"Fuente: {msg['origen']}")

        with st.form("form_consulta_llm", clear_on_submit=True):
            col_input, col_send, col_clear = st.columns([6.0, 1.6, 1.3])
            with col_input:
                pregunta = st.text_input(
                    "Consulta médica o de soporte vital",
                    placeholder="Ej: ¿Qué protocolo aplica ante dolor torácico o hipoglucemia?",
                    label_visibility="collapsed",
                )
            with col_send:
                enviar = st.form_submit_button("Enviar", type="primary", width="stretch")
            with col_clear:
                limpiar = st.form_submit_button("Limpiar", width="stretch")

        if limpiar:
            st.session_state.chat_llm = []
            st.rerun()

        if enviar and pregunta.strip():
            if len(st.session_state.historico) > 0:
                ultima = st.session_state.historico[-1]
                lectura_ctx = {k: float(ultima[k]) for k in FEATURE_NAMES}
            else:
                lectura_ctx = st.session_state.simulador.leer_sensores()

            resultado_ctx = st.session_state.get("ultimo_resultado")
            st.session_state.chat_llm.append({"role": "user", "content": pregunta.strip()})
            resp = motor.consultar_asistente_interactivo(
                pregunta=pregunta.strip(),
                lectura=lectura_ctx,
                resultado_actual=resultado_ctx,
                historial_chat=st.session_state.chat_llm[:-1],
            )
            st.session_state.chat_llm.append(
                {
                    "role": "assistant",
                    "content": resp["respuesta"],
                    "origen": resp["origen"],
                }
            )
            st.rerun()

    with col_cond:
        st.markdown("#### 🧠 Soporte Conductual Asíncrono (V1 3004.q)")
        st.caption(
            "Con latencia de hasta 20 min/sentido, V1 3004.q exige protocolos conductuales "
            "asíncronos en dispositivo privado (V2 7071) y envío diferido PPC (V1 6010)."
        )
        with st.expander("Abrir Protocolo Guiado de Regulación y Sueño", expanded=False):
            st.markdown(
                "- **Respiración táctica 4-6:** 4 s inhalación, 6 s exhalación durante 5 min.\n"
                "- **Higiene circadiana (V2 8055):** ≥ 250 lux melanópico EDI en vigilia; 8 ± 2 lux pre-sueño.\n"
                "- **Carga cognitiva (V2 5007):** Evitar maniobras críticas si carga Bedford > 3 o sueño < 7,5 h.\n"
                "- **Privacidad (V1 6010 / V2 7071):** Las notas personales se cifran localmente para Conferencia Psicológica Privada diferida."
            )
            nota_ppc = st.text_area(
                "Nota privada para PPC diferida (cifrada localmente)",
                placeholder="Registro breve de síntomas o estado anímico...",
                height=75,
            )
            if st.button("🔒 Guardar Nota Privada (V1 6010)", width="stretch"):
                if nota_ppc.strip():
                    st.success("Nota cifrada en cola store-and-forward (Privacy Act / V2 7071).")
                else:
                    st.info("Ingresa texto antes de guardar.")


def main() -> None:
    """Punto de entrada principal de la consola MecaSpace."""
    _inicializar_estado()
    _renderizar_sidebar()
    _renderizar_cabecera_y_emergencia()
    panel_telemetria_en_vivo()
    _renderizar_caja_llm_y_conductual()


if __name__ == "__main__":
    main()
