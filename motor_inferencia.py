"""
Motor de inferencia XGBoost + XAI (SHAP) + Diagnóstico Autónomo vía LM Studio.

Características clave:
- Carga `modelo_xgb.json` y construye `shap.TreeExplainer` una sola vez.
- Lee `data/protocolos_medicos_nasa.md` (con respaldo automático en la raíz
  `protocolos_medicos_nasa.md`) para construir el System Prompt de LM Studio.
- Optimiza las llamadas a LM Studio (`http://localhost:1234/v1/chat/completions`)
  ejecutándolas únicamente cuando cambia el estado de riesgo, cambia el factor
  SHAP dominante en alerta o expira el intervalo de refresco configurado.
- Incluye respaldo determinista basado en reglas médicas NASA si LM Studio
  no está iniciado o no responde.
"""

from __future__ import annotations

import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import requests
import shap
from xgboost import XGBClassifier

from nasa_referencia import FEATURE_NAMES, RISK_LABELS, cargar_umbrales_nasa

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "modelo_xgb.json"
PROTOCOLS_DATA_PATH = BASE_DIR / "data" / "protocolos_medicos_nasa.md"
PROTOCOLS_ROOT_PATH = BASE_DIR / "protocolos_medicos_nasa.md"
LM_STUDIO_CHAT_URL = "http://localhost:1234/v1/chat/completions"
LM_STUDIO_MODELS_URL = "http://localhost:1234/v1/models"

ETIQUETAS_LEGIBLES: dict[str, str] = {
    "presion_sistolica": "Presión Sistólica",
    "temp_corporal": "Temperatura Corporal",
    "nivel_actividad": "Nivel de Actividad",
    "spo2": "Saturación O₂ (SpO₂)",
    "frec_respiratoria": "Frecuencia Respiratoria",
    "vol_respiratorio": "Volumen Respiratorio",
    "frec_cardiaca": "Frecuencia Cardíaca",
    "anomalia_ecg": "Anomalía ECG",
    "eficiencia_sueno": "Eficiencia del Sueño",
}


class MotorInferencia:
    """Motor híbrido XGBoost + SHAP + LLM local (LM Studio) con caché inteligente."""

    def __init__(
        self,
        model_path: Path | str = MODEL_PATH,
        lm_studio_url: str = LM_STUDIO_CHAT_URL,
    ) -> None:
        self.model_path = Path(model_path)
        if not self.model_path.exists():
            raise FileNotFoundError(
                f"No se encontró el modelo entrenado en {self.model_path}. "
                "Ejecuta primero `python entrenar_modelo.py`."
            )

        self.modelo = XGBClassifier()
        self.modelo.load_model(self.model_path)
        self.explainer = shap.TreeExplainer(self.modelo)

        self.umbrales_data = cargar_umbrales_nasa()
        self.biomarkers_cfg = self.umbrales_data["biomarkers"]

        self.lm_studio_url = lm_studio_url
        self._lm_model_id: str | None = None

        self.protocolos_md, self.ruta_protocolos = self._cargar_protocolos_markdown()
        self.system_prompt = self._construir_system_prompt(self.protocolos_md)

        # Estado de caché para evitar saturar LM Studio / GPU en cada refresco de 2 s
        self._ultimo_estado_riesgo: int | None = None
        self._ultimo_top_feature: str | None = None
        self._ultimo_ts_llm: float = 0.0
        self._ultimo_diagnostico: str | None = None
        self._ultimas_directivas: list[str] = []
        self._ultimo_origen_base: str = ""

    def _cargar_protocolos_markdown(self) -> tuple[str, str]:
        """Lee `data/protocolos_medicos_nasa.md` o su ubicación en la raíz del proyecto."""
        for candidato in (PROTOCOLS_DATA_PATH, PROTOCOLS_ROOT_PATH):
            if candidato.exists() and candidato.stat().st_size > 0:
                return candidato.read_text(encoding="utf-8"), str(candidato)
        return (
            "Protocolos autónomos NASA: emitir 1 línea de diagnóstico causal y 2 directivas "
            "operativas inmediatas sin sugerir esperar respuesta de la Tierra.",
            "embedded_fallback",
        )

    @staticmethod
    def _construir_system_prompt(protocolos_md: str) -> str:
        """Construye el System Prompt de LM Studio incorporando el documento médico NASA."""
        return (
            "Eres el Oficial Médico de Inteligencia Artificial a bordo de una nave espacial "
            "en espacio profundo con 30 minutos de latencia de comunicación con la Tierra. "
            "Opera de forma 100% autónoma siguiendo estrictamente el manual oficial adjunto.\n\n"
            "=== MANUAL DE PROTOCOLOS MÉDICOS NASA ===\n"
            f"{protocolos_md}\n"
            "=== FIN DEL MANUAL ===\n\n"
            "INSTRUCCIÓN ESTRICTA DE FORMATO DE SALIDA (EXACTAMENTE 3 LÍNEAS, SIN TEXTO EXTRA):\n"
            "Línea 1: Diagnóstico causal breve (máximo 15 palabras) citando los biomarcadores SHAP.\n"
            "Línea 2: Directiva operativa 1 (acción física o de soporte vital inmediata).\n"
            "Línea 3: Directiva operativa 2 (acción de monitoreo o restricción operativa)."
        )

    def _extraer_shap_clase(self, X_df: pd.DataFrame, clase_predicha: int) -> np.ndarray:
        """Extrae el vector 1D de valores SHAP para la clase predicha de forma compatible."""
        raw_shap = self.explainer.shap_values(X_df)

        if isinstance(raw_shap, list):
            arr = np.asarray(raw_shap[clase_predicha])
            return arr[0].astype(float)

        arr = np.asarray(raw_shap)
        if arr.ndim == 3:
            # Formato (n_samples, n_features, n_classes) o (n_classes, n_samples, n_features)
            if arr.shape[0] == 1 and arr.shape[1] == len(FEATURE_NAMES):
                return arr[0, :, clase_predicha].astype(float)
            if arr.shape[0] == 3 and arr.shape[2] == len(FEATURE_NAMES):
                return arr[clase_predicha, 0, :].astype(float)
        if arr.ndim == 2:
            return arr[0].astype(float)

        return np.zeros(len(FEATURE_NAMES), dtype=float)

    def _construir_top3_shap(
        self,
        lectura: dict[str, float],
        shap_vector: np.ndarray,
    ) -> tuple[list[dict[str, Any]], dict[str, float]]:
        """Ordena y enriquece los 3 biomarcadores más influyentes según |SHAP|."""
        shap_todos = {
            var: float(shap_vector[idx]) for idx, var in enumerate(FEATURE_NAMES)
        }
        ordenados = sorted(
            enumerate(FEATURE_NAMES),
            key=lambda item: abs(shap_vector[item[0]]),
            reverse=True,
        )

        top3: list[dict[str, Any]] = []
        for idx, var in ordenados[:3]:
            cfg = self.biomarkers_cfg[var]
            val = float(lectura[var])
            s_val = float(shap_vector[idx])
            norm_min, norm_max = cfg["normal"]
            top3.append(
                {
                    "variable": var,
                    "nombre": ETIQUETAS_LEGIBLES.get(var, var),
                    "valor": val,
                    "unidad": cfg["unit"],
                    "rango_nominal": f"{norm_min} – {norm_max}",
                    "shap_valor": s_val,
                    "magnitud_abs": abs(s_val),
                    "direccion": "A favor de esta clase" if s_val >= 0 else "En contra de esta clase",
                }
            )
        return top3, shap_todos

    def _resolver_modelo_lm_studio(self) -> str:
        """Descubre el ID del modelo cargado en LM Studio o usa fallback estándar."""
        if self._lm_model_id:
            return self._lm_model_id
        try:
            resp = requests.get(LM_STUDIO_MODELS_URL, timeout=1.5)
            if resp.status_code == 200:
                modelos = resp.json().get("data", [])
                if modelos and isinstance(modelos, list):
                    model_id = modelos[0].get("id")
                    if model_id:
                        self._lm_model_id = str(model_id)
                        return self._lm_model_id
        except requests.RequestException:
            pass
        return "local-model"

    @staticmethod
    def _limpiar_linea_salida(texto: str) -> str:
        """Elimina prefijos numerados o viñetas redundantes de una línea LLM."""
        limpia = texto.strip()
        limpia = re.sub(r"^(?:L[ií]nea\s*\d+|Directiva\s*\d+|Diagn[oó]stico(?:\s*causal)?)\s*[:\-]\s*", "", limpia, flags=re.IGNORECASE)
        limpia = re.sub(r"^[\-\*\d\.\)\]]+\s*", "", limpia)
        return limpia.strip()

    def _consultar_lm_studio(
        self,
        clase_riesgo: int,
        probabilidades: dict[str, float],
        lectura: dict[str, float],
        top3_shap: list[dict[str, Any]],
    ) -> tuple[str, list[str]] | None:
        """Realiza la petición al endpoint local de LM Studio y parsea 1 línea + 2 directivas."""
        etiqueta = RISK_LABELS[clase_riesgo]
        resumen_shap = "; ".join(
            f"{item['variable']}={item['valor']} {item['unidad']} "
            f"(nominal {item['rango_nominal']}, SHAP={item['shap_valor']:+.3f})"
            for item in top3_shap
        )
        user_prompt = (
            f"Estado clasificado por XGBoost: {etiqueta} (clase {clase_riesgo}, "
            f"probabilidad={probabilidades[etiqueta]:.1%}).\n"
            f"Top 3 biomarcadores SHAP: {resumen_shap}.\n"
            f"Vector completo de telemetría: {json.dumps(lectura, ensure_ascii=False)}.\n"
            "Emite estrictamente 3 líneas: Línea 1 diagnóstico causal (<=15 palabras), "
            "Línea 2 Directiva 1, Línea 3 Directiva 2."
        )

        payload = {
            "model": self._resolver_modelo_lm_studio(),
            "messages": [
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.15,
            "max_tokens": 180,
            "stream": False,
        }

        try:
            resp = requests.post(self.lm_studio_url, json=payload, timeout=6.0)
            if resp.status_code != 200:
                return None
            data = resp.json()
            contenido = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
            )
            if not contenido:
                return None

            lineas = [self._limpiar_linea_salida(ln) for ln in contenido.splitlines() if ln.strip()]
            if len(lineas) < 2:
                return None

            diagnostico = lineas[0]
            directivas = lineas[1:3]
            if len(directivas) == 1:
                directivas.append("Mantener telemetría Astroskin continua y reevaluar en 5 minutos.")
            return diagnostico, directivas
        except (requests.RequestException, ValueError, KeyError, IndexError):
            return None

    def _diagnostico_respaldo_reglas(
        self,
        clase_riesgo: int,
        lectura: dict[str, float],
        top3_shap: list[dict[str, Any]],
    ) -> tuple[str, list[str]]:
        """
        Respaldo determinista alineado con `protocolos_medicos_nasa.md` cuando
        LM Studio no está disponible en localhost:1234.
        """
        if clase_riesgo == 0:
            top_vars = ", ".join(item["variable"] for item in top3_shap[:2])
            return (
                f"Homeostasis fisiológica estable confirmada por {top_vars} en rango NASA-STD-3001.",
                [
                    "Continuar plan nominal de actividades intravehiculares sin restricciones médicas.",
                    "Mantener registro pasivo continuo mediante Astroskin y Actiwatch Spectrum.",
                ],
            )

        es_critico = clase_riesgo == 2
        top_var = top3_shap[0]["variable"]
        vars_top2 = {item["variable"] for item in top3_shap[:2]}

        # Priorizar el cuadro clínico por umbrales agudos y driver SHAP dominante
        es_hipoxia = (
            lectura["spo2"] < 92.0
            or (lectura["spo2"] < 95.5 and (top_var in {"spo2", "frec_respiratoria", "vol_respiratorio"} or "spo2" in vars_top2))
        )
        es_termico = (
            lectura["temp_corporal"] > 38.2
            or (lectura["temp_corporal"] > 37.5 and top_var == "temp_corporal")
        )
        es_cardio = (
            lectura["frec_cardiaca"] > 130.0
            or lectura["presion_sistolica"] > 145.0
            or lectura["anomalia_ecg"] > 0.35
            or (top_var in {"frec_cardiaca", "presion_sistolica", "anomalia_ecg"} and lectura["eficiencia_sueno"] >= 65.0)
        )
        es_fatiga = (
            lectura["eficiencia_sueno"] < 65.0
            or (lectura["eficiencia_sueno"] < 79.0 and top_var == "eficiencia_sueno")
        )

        if es_hipoxia:
            if es_critico:
                return (
                    f"Hipoxia aguda detectada por spo2={lectura['spo2']}% y frec_respiratoria={lectura['frec_respiratoria']} rpm.",
                    [
                        "Colocar mascarilla de oxígeno suplementario al 100% durante 15 minutos y suspender actividad física.",
                        "Activar protocolo de diagnóstico de fugas o fallo de depuración de CO₂ en el módulo.",
                    ],
                )
            return (
                f"Compromiso respiratorio preventivo por spo2={lectura['spo2']}% y frec_respiratoria={lectura['frec_respiratoria']} rpm.",
                [
                    "Ejecutar 5 minutos de respiración diafragmática controlada (4 s inhalación, 6 s exhalación).",
                    "Verificar flujo y presión parcial de oxígeno (ppO₂) en el sistema ECLSS de cabina.",
                ],
            )

        if es_termico:
            if es_critico:
                return (
                    f"Estrés térmico severo por temp_corporal={lectura['temp_corporal']} °C y frec_cardiaca={lectura['frec_cardiaca']} lpm.",
                    [
                        "Activar prenda de enfriamiento líquido (LCVG) al máximo flujo y cesar actividad metabólica.",
                        "Monitorear temperatura central y presión arterial cada 5 minutos hasta bajar de 37.5 °C.",
                    ],
                )
            return (
                f"Sobrecarga térmica preventiva por temp_corporal={lectura['temp_corporal']} °C y pulso={lectura['frec_cardiaca']} lpm.",
                [
                    "Ajustar control térmico de cabina (-2 °C) y ventilar vestimenta operativa.",
                    "Consumir 750 ml de agua fría en intervalos de 15 minutos.",
                ],
            )

        if es_fatiga and not es_cardio:
            if es_critico:
                return (
                    f"Fatiga circadiana aguda por eficiencia_sueno={lectura['eficiencia_sueno']}% y anomalia_ecg={lectura['anomalia_ecg']}.",
                    [
                        "Transferir control de sistemas críticos al ordenador central o a otro tripulante.",
                        "Cumplir bloque obligatorio de recuperación de sueño de 90 minutos en entorno aislado.",
                    ],
                )
            return (
                f"Déficit circadiano preventivo por eficiencia_sueno={lectura['eficiencia_sueno']}% y frec_cardiaca={lectura['frec_cardiaca']} lpm.",
                [
                    "Exponerse a iluminación enriquecida en espectro azul (480 nm) durante 20 minutos.",
                    "Posponer tareas de acoplamiento, navegación manual o mantenimiento complejo por 2 horas.",
                ],
            )

        # Cuadro cardiovascular / autonómico general
        if es_critico:
            return (
                f"Sobrecarga cardiovascular crítica por frec_cardiaca={lectura['frec_cardiaca']} lpm, presion_sistolica={lectura['presion_sistolica']} mmHg y anomalia_ecg={lectura['anomalia_ecg']}.",
                [
                    "Detener maniobras críticas, activar piloto automático de la nave y permanecer en reposo absoluto.",
                    "Iniciar registro continuo de ECG de 3 derivaciones y preparar kit médico de soporte cardíaco.",
                ],
            )
        return (
            f"Sobrecarga cardiovascular preventiva por frec_cardiaca={lectura['frec_cardiaca']} lpm y anomalia_ecg={lectura['anomalia_ecg']}.",
            [
                "Reducir carga de trabajo operativa en un 50% y adoptar posición de reposo neutro.",
                "Ingerir 500 ml de solución electrolítica isotónica para estabilizar volumen plasmático.",
            ],
        )

    def evaluar(
        self,
        lectura: dict[str, float],
        intervalo_llm_seg: float = 25.0,
        forzar_llm: bool = False,
    ) -> dict[str, Any]:
        """
        Evalúa una lectura de 9 biomarcadores:
        1. Clasifica con XGBoost.
        2. Explica con SHAP TreeExplainer (Top 3).
        3. Consulta LM Studio solo ante cambio de estado/driver o expiración del intervalo.
        """
        fila_ordenada = {var: float(lectura[var]) for var in FEATURE_NAMES}
        X_df = pd.DataFrame([fila_ordenada], columns=FEATURE_NAMES)

        proba_vec = self.modelo.predict_proba(X_df)[0]
        clase_riesgo = int(np.argmax(proba_vec))
        etiqueta = RISK_LABELS[clase_riesgo]
        probabilidades = {
            RISK_LABELS[i]: float(proba_vec[i]) for i in range(3)
        }

        shap_vec = self._extraer_shap_clase(X_df, clase_riesgo)
        top3_shap, shap_todos = self._construir_top3_shap(fila_ordenada, shap_vec)
        top_feature = top3_shap[0]["variable"]

        ahora = time.monotonic()
        cambio_estado = (
            self._ultimo_estado_riesgo is None
            or clase_riesgo != self._ultimo_estado_riesgo
        )
        cambio_driver_en_alerta = (
            clase_riesgo > 0 and top_feature != self._ultimo_top_feature
        )
        intervalo_cumplido = (ahora - self._ultimo_ts_llm) >= max(float(intervalo_llm_seg), 5.0)

        debe_consultar_llm = (
            forzar_llm
            or self._ultimo_diagnostico is None
            or cambio_estado
            or cambio_driver_en_alerta
            or intervalo_cumplido
        )

        llm_actualizado = False
        if debe_consultar_llm:
            respuesta_llm = self._consultar_lm_studio(
                clase_riesgo=clase_riesgo,
                probabilidades=probabilidades,
                lectura=fila_ordenada,
                top3_shap=top3_shap,
            )
            if respuesta_llm is not None:
                diagnostico, directivas = respuesta_llm
                origen_diagnostico = "LM Studio (Local)"
                self._ultimo_origen_base = "LM Studio"
            else:
                diagnostico, directivas = self._diagnostico_respaldo_reglas(
                    clase_riesgo=clase_riesgo,
                    lectura=fila_ordenada,
                    top3_shap=top3_shap,
                )
                origen_diagnostico = "Respaldo Reglas NASA (Offline)"
                self._ultimo_origen_base = "Respaldo Reglas NASA"

            self._ultimo_estado_riesgo = clase_riesgo
            self._ultimo_top_feature = top_feature
            self._ultimo_ts_llm = ahora
            self._ultimo_diagnostico = diagnostico
            self._ultimas_directivas = directivas
            llm_actualizado = True
        else:
            diagnostico = self._ultimo_diagnostico
            directivas = self._ultimas_directivas
            origen_diagnostico = f"Caché ({self._ultimo_origen_base})"

        return {
            "estado_riesgo": clase_riesgo,
            "etiqueta_riesgo": etiqueta,
            "probabilidades": probabilidades,
            "top3_shap": top3_shap,
            "shap_todos": shap_todos,
            "diagnostico": diagnostico,
            "directivas": directivas[:2],
            "origen_diagnostico": origen_diagnostico,
            "llm_actualizado": llm_actualizado,
            "timestamp": datetime.now(timezone.utc).astimezone().strftime("%H:%M:%S"),
        }

    def consultar_asistente_interactivo(
        self,
        pregunta: str,
        lectura: dict[str, float],
        resultado_actual: dict[str, Any] | None = None,
        historial_chat: list[dict[str, str]] | None = None,
    ) -> dict[str, str]:
        """
        Responde consultas interactivas del tripulante usando el contexto
        fisiológico en vivo (telemetría + XGBoost + SHAP) y los protocolos NASA.
        Incluye respaldo determinista si LM Studio no está activo.
        """
        pregunta_limpia = pregunta.strip()
        if not pregunta_limpia:
            return {
                "respuesta": "Ingresa una consulta operativa o clínica.",
                "origen": "Sistema",
            }

        eval_actual = resultado_actual or self.evaluar(lectura, intervalo_llm_seg=9999.0)
        etiqueta = eval_actual["etiqueta_riesgo"]
        top3_txt = "; ".join(
            f"{item['variable']}={item['valor']} {item['unidad']} (nominal {item['rango_nominal']}, SHAP={item['shap_valor']:+.3f})"
            for item in eval_actual["top3_shap"]
        )

        system_chat = (
            "Eres el Oficial Médico IA a bordo de una nave espacial en espacio profundo "
            "(30 minutos de latencia con la Tierra). Responde de forma concisa, técnica y "
            "directa en español (máximo 4 oraciones), basándote exclusivamente en los "
            "protocolos NASA adjuntos y la telemetría actual. Nunca sugieras esperar "
            "instrucciones de la Tierra.\n\n"
            f"=== PROTOCOLOS MÉDICOS NASA ===\n{self.protocolos_md}"
        )

        contexto_telemetria = (
            f"[TELEMETRÍA ACTUAL] Estado={etiqueta} | "
            f"Diagnóstico={eval_actual['diagnostico']} | "
            f"Top 3 SHAP: {top3_txt} | "
            f"Valores: {json.dumps(lectura, ensure_ascii=False)}"
        )

        mensajes: list[dict[str, str]] = [{"role": "system", "content": system_chat}]
        if historial_chat:
            for msg in historial_chat[-4:]:
                rol = msg.get("role", "")
                contenido = msg.get("content", "")
                if rol in {"user", "assistant"} and contenido:
                    mensajes.append({"role": rol, "content": contenido})

        mensajes.append(
            {
                "role": "user",
                "content": f"{contexto_telemetria}\n\nConsulta del tripulante: {pregunta_limpia}",
            }
        )

        payload = {
            "model": self._resolver_modelo_lm_studio(),
            "messages": mensajes,
            "temperature": 0.2,
            "max_tokens": 260,
            "stream": False,
        }

        try:
            resp = requests.post(self.lm_studio_url, json=payload, timeout=12.0)
            if resp.status_code == 200:
                contenido = (
                    resp.json()
                    .get("choices", [{}])[0]
                    .get("message", {})
                    .get("content", "")
                    .strip()
                )
                if contenido:
                    return {
                        "respuesta": contenido,
                        "origen": "LM Studio (Local)",
                    }
        except (requests.RequestException, ValueError, KeyError, IndexError):
            pass

        # Respaldo determinista contextual offline
        directivas_txt = " ".join(
            f"({i + 1}) {d}" for i, d in enumerate(eval_actual["directivas"])
        )
        factores_txt = ", ".join(
            f"{item['nombre']} ({item['valor']} {item['unidad']})"
            for item in eval_actual["top3_shap"]
        )
        respuesta_offline = (
            f"Estado actual: {etiqueta}. Diagnóstico: {eval_actual['diagnostico']} "
            f"Principales factores SHAP: {factores_txt}. "
            f"Acciones recomendadas según protocolo NASA: {directivas_txt}"
        )
        return {
            "respuesta": respuesta_offline,
            "origen": "Respaldo Reglas NASA (Offline)",
        }
