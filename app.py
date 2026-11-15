"""
Consola Espacial Autónoma de Monitorización Biomédica (MecaSpace).

Arquitectura de interfaz de baja carga cognitiva para misiones con 30 minutos
de latencia de comunicación con la Tierra:
- Orquestación con `st.session_state` y `@st.fragment(run_every=2)` para
  telemetría en vivo sin bloquear controles.
- Clasificación XGBoost + Explicabilidad SHAP (Top 3 biomarcadores) +
  Diagnóstico autónomo vía LM Studio (o respaldo determinista offline).
"""

from __future__ import annotations

from collections import deque
from pathlib import Path
from typing import Any

import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import streamlit as st

from motor_inferencia import ETIQUETAS_LEGIBLES, MotorInferencia
from nasa_referencia import (
    FEATURE_NAMES,
    cargar_umbrales_nasa,
    obtener_referencias_osdr,
)
from simulador_sensores import SimuladorSensores

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "modelo_xgb.json"

st.set_page_config(
    page_title="MecaSpace | Consola Biomédica Autónoma",
    page_icon="🛰️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Estilos de consola espacial oscura de baja carga cognitiva
st.markdown(
    """
    <style>
    .stApp {
        background-color: #070B14;
        color: #E2E8F0;
    }
    section[data-testid="stSidebar"] {
        background-color: #0B1220;
        border-right: 1px solid #1E293B;
    }
    .status-banner {
        border-radius: 12px;
        padding: 18px 22px;
        margin-bottom: 14px;
        border: 1px solid;
    }
    .status-normal {
        background: linear-gradient(135deg, rgba(6, 78, 59, 0.55), rgba(15, 23, 42, 0.9));
        border-color: #10B981;
    }
    .status-preventivo {
        background: linear-gradient(135deg, rgba(120, 53, 15, 0.6), rgba(15, 23, 42, 0.9));
        border-color: #F59E0B;
    }
    .status-critico {
        background: linear-gradient(135deg, rgba(127, 29, 29, 0.72), rgba(15, 23, 42, 0.92));
        border-color: #EF4444;
    }
    .directive-card {
        background-color: #0F172A;
        border: 1px solid #334155;
        border-left: 4px solid #38BDF8;
        border-radius: 10px;
        padding: 14px 16px;
        height: 100%;
    }
    .directive-card-critico {
        border-left-color: #EF4444;
        background-color: rgba(127, 29, 29, 0.22);
    }
    .directive-card-preventivo {
        border-left-color: #F59E0B;
        background-color: rgba(120, 53, 15, 0.20);
    }
    .badge-pill {
        display: inline-block;
        padding: 3px 10px;
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 600;
        background-color: #1E293B;
        color: #CBD5E1;
        border: 1px solid #334155;
    }
    div[data-testid="stMetric"] {
        background-color: #0F172A;
        border: 1px solid #1E293B;
        border-radius: 10px;
        padding: 10px 14px;
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
    if "severidad_inyectar" not in st.session_state:
        st.session_state.severidad_inyectar = "Crítica"
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


def _estado_variable_nasa(var: str, valor: float, umbrales: dict[str, Any]) -> str:
    """Devuelve icono semántico según umbrales NASA-STD-3001."""
    cfg = umbrales["biomarkers"][var]
    cb = cfg.get("critico_bajo")
    ca = cfg.get("critico_alto")
    n_min, n_max = cfg["normal"]
    if (cb is not None and valor < float(cb)) or (ca is not None and valor > float(ca)):
        return "🔴 CRÍTICO"
    if var == "nivel_actividad" and 0.0 <= valor <= float(n_max):
        return "🟢 NOMINAL"
    if float(n_min) <= valor <= float(n_max):
        return "🟢 NOMINAL"
    return "🟡 PREVENTIVO"


def _construir_graficos_telemetria(df_hist: pd.DataFrame, umbrales: dict[str, Any]) -> go.Figure:
    """Construye gráfico temporal unificado de 3x3 con bandas nominales NASA-STD-3001."""
    fig = make_subplots(
        rows=3,
        cols=3,
        subplot_titles=[
            f"{ETIQUETAS_LEGIBLES[v]} ({umbrales['biomarkers'][v]['unit']})"
            for v in FEATURE_NAMES
        ],
        vertical_spacing=0.13,
        horizontal_spacing=0.06,
    )

    paleta = [
        "#38BDF8", "#FB7185", "#A78BFA",
        "#34D399", "#60A5FA", "#2DD4BF",
        "#F472B6", "#FBBF24", "#818CF8",
    ]

    for idx, var in enumerate(FEATURE_NAMES):
        fila = (idx // 3) + 1
        col = (idx % 3) + 1
        norm_min, norm_max = umbrales["biomarkers"][var]["normal"]

        fig.add_hrect(
            y0=float(norm_min),
            y1=float(norm_max),
            fillcolor="rgba(16, 185, 129, 0.12)",
            line_width=0,
            row=fila,
            col=col,
        )
        fig.add_trace(
            go.Scatter(
                x=df_hist["timestamp"],
                y=df_hist[var],
                mode="lines+markers",
                marker={"size": 4, "color": paleta[idx]},
                line={"width": 2, "color": paleta[idx]},
                name=var,
                showlegend=False,
            ),
            row=fila,
            col=col,
        )

    fig.update_layout(
        height=610,
        margin={"l": 20, "r": 20, "t": 40, "b": 20},
        paper_bgcolor="#0B1220",
        plot_bgcolor="#0F172A",
        font={"color": "#CBD5E1", "size": 11},
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
        title="Contribución SHAP hacia el estado predicho (Top 3 biomarcadores)",
        height=260,
        margin={"l": 15, "r": 40, "t": 42, "b": 20},
        paper_bgcolor="#0B1220",
        plot_bgcolor="#0F172A",
        font={"color": "#E2E8F0", "size": 12},
        xaxis_title="Impacto SHAP (log-odds)",
    )
    fig.update_xaxes(gridcolor="#1E293B", zeroline=True, zerolinecolor="#64748B")
    fig.update_yaxes(showgrid=False)
    return fig


def _renderizar_sidebar() -> None:
    """Construye la barra lateral de control de simulación, emergencias y respaldo NASA."""
    sim: SimuladorSensores = st.session_state.simulador
    osdr_ref: dict[str, Any] = st.session_state.osdr_ref

    with st.sidebar:
        st.markdown("### 🛰️ MecaSpace | Control de Misión")
        st.info(
            "**Latencia Tierra:** 30 min\n\n"
            "**Ejecución:** 100% Autónoma / Offline\n\n"
            f"**Escenario activo:** `{sim.escenario_actual}`"
        )

        st.markdown("#### Controles de Simulación")
        col_p1, col_p2 = st.columns(2)
        with col_p1:
            etiqueta_play = "⏸️ Pausar" if st.session_state.simulacion_activa else "▶️ Reanudar"
            if st.button(etiqueta_play, width="stretch"):
                st.session_state.simulacion_activa = not st.session_state.simulacion_activa
        with col_p2:
            if st.button("🧹 Limpiar Gráficas", width="stretch"):
                st.session_state.historico.clear()

        st.session_state.intervalo_llm = st.slider(
            "Intervalo refresco LM Studio (s)",
            min_value=10,
            max_value=90,
            value=int(st.session_state.intervalo_llm),
            step=5,
            help="Solo consulta LM Studio si cambia el estado de riesgo, el driver SHAP dominante o vence este intervalo.",
        )

        if st.button("🔄 Forzar Consulta LM Studio", width="stretch"):
            st.session_state.forzar_llm = True

        st.divider()
        st.markdown("#### Inyección de Emergencias en Vivo")
        st.session_state.severidad_inyectar = st.radio(
            "Severidad de anomalía",
            options=["Crítica", "Preventiva"],
            horizontal=True,
            index=0 if st.session_state.severidad_inyectar == "Crítica" else 1,
        )
        es_critica = st.session_state.severidad_inyectar == "Crítica"

        if st.button("🟢 Restaurar Estado Nominal", width="stretch", type="primary"):
            sim.restaurar_nominal()
        if st.button("🫁 Inyectar Hipoxia", width="stretch"):
            sim.inyectar_hipoxia(critica=es_critica)
        if st.button("😴 Inyectar Fatiga Severa", width="stretch"):
            sim.inyectar_fatiga_severa(critica=es_critica)
        if st.button("❤️ Inyectar Sobrecarga Cardiovascular", width="stretch"):
            sim.inyectar_sobrecarga_cardiovascular(critica=es_critica)
        if st.button("🌡️ Inyectar Estrés Térmico", width="stretch"):
            sim.inyectar_estres_termico()

        st.divider()
        with st.expander("📚 Respaldo Científico NASA", expanded=True):
            st.markdown(
                "- **Estándar:** `NASA-STD-3001 Vol. 2`\n"
                "- **Sensores:** Astroskin + Actiwatch Spectrum\n"
                f"- **Modo OSDR:** `{osdr_ref.get('source_mode', 'local_cache')}`"
            )
            for sid, meta in osdr_ref.get("studies", {}).items():
                st.caption(f"**{sid}**: {meta.get('title', '')}")
            if st.session_state.motor is not None:
                st.caption(f"Protocolos LLM: `{st.session_state.motor.ruta_protocolos}`")


@st.fragment(run_every=2)
def panel_telemetria_en_vivo() -> None:
    """Fragmento de actualización periódica cada 2 s sin bloquear la UI."""
    motor: MotorInferencia | None = st.session_state.motor
    sim: SimuladorSensores = st.session_state.simulador
    umbrales: dict[str, Any] = st.session_state.umbrales_nasa

    if motor is None:
        st.error(
            "No se encontró `modelo_xgb.json`. Ejecuta `python nasa_referencia.py`, "
            "`python generador_datos.py` y `python entrenar_modelo.py` antes de iniciar la consola."
        )
        return

    # Obtener nueva lectura si la simulación está activa o si aún no hay historial
    if st.session_state.simulacion_activa or len(st.session_state.historico) == 0:
        lectura_actual = sim.leer_sensores()
        forzar = bool(st.session_state.forzar_llm)
        st.session_state.forzar_llm = False

        resultado = motor.evaluar(
            lectura=lectura_actual,
            intervalo_llm_seg=float(st.session_state.intervalo_llm),
            forzar_llm=forzar,
        )
        st.session_state.ultimo_resultado = resultado

        fila_hist = dict(lectura_actual)
        fila_hist["timestamp"] = resultado["timestamp"]
        fila_hist["estado_riesgo"] = resultado["estado_riesgo"]
        st.session_state.historico.append(fila_hist)
    else:
        resultado = st.session_state.ultimo_resultado
        if st.session_state.forzar_llm:
            st.session_state.forzar_llm = False
            ultima_lectura = {k: st.session_state.historico[-1][k] for k in FEATURE_NAMES}
            resultado = motor.evaluar(
                lectura=ultima_lectura,
                intervalo_llm_seg=float(st.session_state.intervalo_llm),
                forzar_llm=True,
            )
            st.session_state.ultimo_resultado = resultado

    hist_list = list(st.session_state.historico)
    actual_row = hist_list[-1]
    prev_row = hist_list[-2] if len(hist_list) >= 2 else actual_row

    # ------------------------------------------------------------------
    # PANEL SUPERIOR: Estado cromático, diagnóstico causal y 2 directivas
    # ------------------------------------------------------------------
    clase = resultado["estado_riesgo"]
    etiqueta = resultado["etiqueta_riesgo"].upper()
    prob_clase = resultado["probabilidades"][resultado["etiqueta_riesgo"]]

    clase_css = {0: "status-normal", 1: "status-preventivo", 2: "status-critico"}[clase]
    icono_estado = {0: "🟢", 1: "🟡", 2: "🔴"}[clase]
    card_css = {
        0: "directive-card",
        1: "directive-card directive-card-preventivo",
        2: "directive-card directive-card-critico",
    }[clase]

    st.markdown(
        f"""
        <div class="status-banner {clase_css}">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <div style="font-size:1.55rem; font-weight:800; letter-spacing:0.5px;">
                    {icono_estado} ESTADO BIOMÉDICO GLOBAL: {etiqueta}
                </div>
                <div>
                    <span class="badge-pill">Confianza XGBoost: {prob_clase:.1%}</span>
                    <span class="badge-pill">Fuente IA: {resultado['origen_diagnostico']}</span>
                    <span class="badge-pill">Telemetría: {resultado['timestamp']}</span>
                </div>
            </div>
            <div style="margin-top:10px; font-size:1.08rem; font-weight:500; color:#F8FAFC;">
                <strong>Diagnóstico causal:</strong> {resultado['diagnostico']}
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    directivas = resultado["directivas"]
    col_d1, col_d2 = st.columns(2)
    with col_d1:
        dir1 = directivas[0] if len(directivas) > 0 else "Mantener monitoreo continuo Astroskin."
        st.markdown(
            f"""
            <div class="{card_css}">
                <div style="font-size:0.78rem; text-transform:uppercase; color:#94A3B8; font-weight:700;">
                    Directiva Operativa Inmediata 1
                </div>
                <div style="margin-top:6px; font-size:0.98rem; color:#F1F5F9;">
                    {dir1}
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )
    with col_d2:
        dir2 = directivas[1] if len(directivas) > 1 else "Registrar evolución fisiológica cada 2 segundos."
        st.markdown(
            f"""
            <div class="{card_css}">
                <div style="font-size:0.78rem; text-transform:uppercase; color:#94A3B8; font-weight:700;">
                    Directiva Operativa Inmediata 2
                </div>
                <div style="margin-top:6px; font-size:0.98rem; color:#F1F5F9;">
                    {dir2}
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)

    # ------------------------------------------------------------------
    # PANEL CENTRAL: 9 tarjetas métricas + gráficos temporales en vivo
    # ------------------------------------------------------------------
    st.markdown("#### 📡 Telemetría Biomédica en Tiempo Real (Astroskin + Actiwatch)")
    for fila_idx in range(3):
        cols = st.columns(3)
        for col_idx in range(3):
            var = FEATURE_NAMES[fila_idx * 3 + col_idx]
            cfg = umbrales["biomarkers"][var]
            val = float(actual_row[var])
            delta = round(val - float(prev_row[var]), 3)
            estado_txt = _estado_variable_nasa(var, val, umbrales)
            norm_min, norm_max = cfg["normal"]

            with cols[col_idx]:
                st.metric(
                    label=f"{ETIQUETAS_LEGIBLES[var]} · {estado_txt}",
                    value=f"{val} {cfg['unit']}",
                    delta=f"{delta:+} {cfg['unit']} | Nominal {norm_min}–{norm_max}",
                    delta_color="off",
                )

    df_hist = pd.DataFrame(hist_list)
    fig_ts = _construir_graficos_telemetria(df_hist, umbrales)
    st.plotly_chart(fig_ts, width="stretch", key="telemetry_ts_chart")

    # ------------------------------------------------------------------
    # PANEL DE EXPLICABILIDAD (XAI - SHAP)
    # ------------------------------------------------------------------
    st.markdown("#### 🧠 Explicabilidad Clínica (XAI - Top 3 Factores SHAP)")
    col_xai_chart, col_xai_table = st.columns([1.35, 1.0])

    with col_xai_chart:
        fig_shap = _construir_grafico_shap(resultado["top3_shap"])
        st.plotly_chart(fig_shap, width="stretch", key="shap_bar_chart")

    with col_xai_table:
        df_shap = pd.DataFrame(
            [
                {
                    "Biomarcador": item["nombre"],
                    "Lectura": f"{item['valor']} {item['unidad']}",
                    "Nominal NASA": item["rango_nominal"],
                    "SHAP": round(item["shap_valor"], 4),
                    "Efecto": item["direccion"],
                }
                for item in resultado["top3_shap"]
            ]
        )
        st.dataframe(df_shap, width="stretch", hide_index=True)
        st.caption(
            "Probabilidades XGBoost → "
            f"Normal: {resultado['probabilidades']['Normal']:.1%} | "
            f"Preventivo: {resultado['probabilidades']['Preventivo']:.1%} | "
            f"Crítico: {resultado['probabilidades']['Crítico']:.1%}"
        )


def _renderizar_caja_llm() -> None:
    """
    Caja de interacción directa con el Oficial Médico LLM (fuera del fragmento
    de 2 s para evitar interrumpir la escritura durante la telemetría en vivo).
    """
    motor: MotorInferencia | None = st.session_state.motor
    if motor is None:
        return

    st.divider()
    st.markdown("#### 💬 Interacción Directa con el Oficial Médico IA (LM Studio)")
    st.caption(
        "Envía preguntas operativas sobre el estado actual. El asistente recibe la "
        "lectura biomédica en vivo, el Top 3 SHAP y los protocolos NASA-STD-3001."
    )

    for msg in st.session_state.chat_llm[-6:]:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])
            if msg.get("origen"):
                st.caption(f"Fuente: {msg['origen']}")

    with st.form("form_consulta_llm", clear_on_submit=True):
        col_input, col_send, col_clear = st.columns([6.5, 1.5, 1.2])
        with col_input:
            pregunta = st.text_input(
                "Consulta médica o de soporte vital",
                placeholder="Ej: ¿Qué protocolo aplico si sigue bajando la SpO2?",
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


def main() -> None:
    """Punto de entrada de la consola Streamlit."""
    _inicializar_estado()
    _renderizar_sidebar()

    st.markdown(
        "## 👨‍🚀 Consola Autónoma de Salud del Astronauta — Misión Espacio Profundo"
    )
    st.caption(
        "Monitorización continua offline (XGBoost + SHAP + LM Studio) calibrada con "
        "NASA-STD-3001 Vol. 2 y NASA OSDR."
    )
    panel_telemetria_en_vivo()
    _renderizar_caja_llm()


if __name__ == "__main__":
    main()
