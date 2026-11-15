"""
Motor de inferencia híbrido: Reglas Deterministas + XGBoost + XAI (SHAP) + LLM Local.

Cumple las directivas de NASA-STD-3001 Vol. 1 Rev. C y Vol. 2 Rev. E para
tránsito a Marte (hasta 20 min de latencia por sentido):
1. Capa determinista previa al árbol de decisión (Sugerencia de Ajuste 1):
   intercepta cuadros agudos (hipotermia central < 35 °C, SpO2 < 90 %,
   bradicardia/taquicardia extrema, hipoglucemia severa, fallo de cabina o
   botón manual de emergencia V2 10178) garantizando tiempo de respuesta <= 1,0 s.
2. Clasificador XGBClassifier + explicabilidad SHAP TreeExplainer (V2 10169-10170).
3. Asistente prescriptivo vía LM Studio o respaldo offline con trazabilidad de
   código de protocolo, límite de alcance (V2 10171) y escalado a ECG/ecografía
   a bordo (V1 3004.i) + envío diferido store-and-forward (V1 6002).
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

from nasa_referencia import (
    CABIN_ENV_NOMINAL,
    FEATURE_NAMES,
    RISK_LABELS,
    cargar_umbrales_nasa,
    estimar_temp_central,
    evaluar_reglas_deterministas_criticas,
)

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "modelo_xgb.json"
PROTOCOLS_DATA_PATH = BASE_DIR / "data" / "protocolos_medicos_nasa.md"
PROTOCOLS_ROOT_PATH = BASE_DIR / "protocolos_medicos_nasa.md"
LM_STUDIO_CHAT_URL = "http://localhost:1234/v1/chat/completions"
LM_STUDIO_MODELS_URL = "http://localhost:1234/v1/models"

ETIQUETAS_LEGIBLES: dict[str, str] = {
    "presion_sistolica": "Presión Arterial Sistólica",
    "temp_corporal": "Temp. Cutánea (Astroskin)",
    "nivel_actividad": "Nivel de Actividad",
    "spo2": "Saturación O₂ (SpO₂)",
    "frec_respiratoria": "Frecuencia Respiratoria",
    "vol_respiratorio": "Volumen Respiratorio",
    "frec_cardiaca": "Frecuencia Cardíaca",
    "anomalia_ecg": "Anomalía ECG",
    "eficiencia_sueno": "Eficiencia del Sueño",
    "glucemia": "Glucemia (Azúcar en Sangre)",
    "horas_sueno": "Horas Diarias de Sueño",
    "estado_animo": "Estado de Ánimo",
}

PROCEDIMIENTOS_ELECTRONICOS: dict[str, dict[str, Any]] = {
    "PROTO-CV-01": {
        "titulo": "Evento Cardiovascular Agudo / Dolor Torácico o Colapso",
        "referencias": "Consigna, Vol. 1 Tabla E.2-2, V1 3004.i, V1 5001-5003, V2 10178",
        "pasos": [
            {"sistema": True, "texto": "[SISTEMA] Bloquear maniobras críticas y activar registro continuo de signos vitales y ECG (V1 3004.h)."},
            {"sistema": False, "texto": "Evaluar consciencia, respiración y pulso del tripulante; iniciar RCP/DEA si hay colapso (V1 5001-5002)."},
            {"sistema": False, "texto": "Convocar al Crew Medical Officer (CMO, V1 3006) para adquirir ECG de 3 derivaciones e imagenología por ecografía a bordo (V1 3004.i, V1 5003)."},
            {"sistema": True, "texto": "[SISTEMA] Empaquetar trazado ECG, SHAP y signos vitales en lote cifrado store-and-forward para Tierra (V1 6002, V2 10125)."},
        ],
    },
    "PROTO-RESP-02": {
        "titulo": "Hipoxia o Hipercapnia en Cabina Presurizada",
        "referencias": "V2 6003-6004, Tabla 6.2-1, V1 Rev. B 3.1.5.f, V1 3004.i",
        "pasos": [
            {"sistema": True, "texto": "[SISTEMA] Contrastar SpO₂ con sensores ambientales de cabina P_I O₂ (145–155 mmHg) y ppCO₂ (≤ 3 mmHg)."},
            {"sistema": False, "texto": "Suministrar oxígeno suplementario al 100 % si SpO₂ < 92 % o P_I O₂ < 127 mmHg y suspender actividad física (V2 10200)."},
            {"sistema": False, "texto": "Inspeccionar depuradores de CO₂ y sellado del módulo habitable."},
            {"sistema": True, "texto": "[SISTEMA] Si persiste hipoxemia < 90 %, escalar a ecografía pulmonar (V1 3004.i) y registro diferido (V1 6002)."},
        ],
    },
    "PROTO-MET-03": {
        "titulo": "Privación de Sueño, Desalineación Circadiana y Desregulación Glucémica",
        "referencias": "V1 6001 (8,5 h), V2 8055, V1 4020, V2 6079 (NC-40), V2 6092",
        "pasos": [
            {"sistema": True, "texto": "[SISTEMA] Verificar déficit frente al objetivo de 8,5 h/día (V1 6001) y correlación metabólica/glucémica (V2 8055)."},
            {"sistema": False, "texto": "Si glucemia < 70 mg/dL en tripulante consciente, administrar 15–20 g de carbohidratos rápidos y reevaluar en 15 min."},
            {"sistema": False, "texto": "Aplicar iluminación circadiana (≥ 250 lux EDI en vigilia / 8 ± 2 lux pre-sueño, V2 8055) y reprogramar tareas críticas fuera del nadir 1–7 AM."},
            {"sistema": True, "texto": "[SISTEMA] Activar bloque de descanso protegido (NC-40, ≤ 0,02 lux) y envío store-and-forward al equipo médico (V1 6002)."},
        ],
    },
    "PROTO-TERM-04": {
        "titulo": "Hipotermia Central (< 35 °C) o Estrés Térmico Cutáneo/Central",
        "referencias": "Vol. 1 Apéndice C (< 35 °C), V2 6012-6014, Fig. 6.2-2, V2 11011",
        "pasos": [
            {"sistema": True, "texto": "[SISTEMA] Comparar temperatura cutánea (Astroskin) con temperatura central estimada (Vol. 1 Apéndice C; V2 11011)."},
            {"sistema": False, "texto": "Confirmar lectura con termometría central/oral; ante hipotermia (< 35,0 °C) aplicar recalentamiento progresivo y aislamiento térmico."},
            {"sistema": False, "texto": "Ante estrés térmico hipertérmico, activar enfriamiento LCVG o ajustar cabina a zona de confort (20–25 °C, 30–60 % HR)."},
            {"sistema": True, "texto": "[SISTEMA] Registrar tendencia térmica cada 5 min y adjuntar en expediente cifrado store-and-forward (V1 6002, V1 7001)."},
        ],
    },
    "PROTO-COND-05": {
        "titulo": "Alteración del Estado de Ánimo o Sobrecarga Conductual",
        "referencias": "V1 3004.q, Tabla E.2-2 (*), V2 5007 (Bedford), V2 7071 (Privacidad), V1 6010",
        "pasos": [
            {"sistema": True, "texto": "[SISTEMA] Habilitar sesión de protocolo conductual asíncrono en dispositivo privado (V1 3004.q, V2 7071)."},
            {"sistema": False, "texto": "Reducir carga cognitiva operativa (mantener escala Bedford ≤ 3 en nominal / ≤ 6 degradado, V2 5007)."},
            {"sistema": True, "texto": "[SISTEMA] Preparar nota cifrada privada para Conferencia Psicológica Privada diferida (V1 6010, store-and-forward)."},
        ],
    },
    "PROTO-NOM-00": {
        "titulo": "Vigilancia Nominal en Tránsito a Marte",
        "referencias": "V1 3004.h, V1 6001, V1 7001, V2 6001",
        "pasos": [
            {"sistema": True, "texto": "[SISTEMA] Registro continuo de tendencias en historia clínica electrónica cifrada (V1 3004.a, V1 7001)."},
            {"sistema": False, "texto": "Mantener recordatorios periódicos de medición manual de glucemia (mg/dL) y autorreporte de ánimo."},
        ],
    },
}


class MotorInferencia:
    """Motor híbrido Determinista + XGBoost + SHAP + LLM local con trazabilidad NASA."""

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

        # Estado de caché para evitar saturar LM Studio / GPU
        self._ultimo_estado_riesgo: int | None = None
        self._ultimo_nivel_nasa: str | None = None
        self._ultimo_top_feature: str | None = None
        self._ultimo_ts_llm: float = 0.0
        self._ultimo_diagnostico: str | None = None
        self._ultimas_directivas: list[str] = []
        self._ultimo_origen_base: str = ""
        self._ultimo_protocolo: str = "PROTO-NOM-00"

    def _cargar_protocolos_markdown(self) -> tuple[str, str]:
        """Lee `data/protocolos_medicos_nasa.md` o su ubicación en la raíz del proyecto."""
        for candidato in (PROTOCOLS_DATA_PATH, PROTOCOLS_ROOT_PATH):
            if candidato.exists() and candidato.stat().st_size > 0:
                return candidato.read_text(encoding="utf-8"), str(candidato)
        return (
            "Protocolos autónomos NASA en tránsito a Marte (20 min latencia por sentido): "
            "citar código de alerta/protocolo, explicar causa SHAP sin lenguaje antropomórfico "
            "(F.6.2.e) y declarar límite de alcance (V2 10171) escalando a ECG/ecografía (V1 3004.i) "
            "y store-and-forward (V1 6002).",
            "embedded_fallback",
        )

    @staticmethod
    def _construir_system_prompt(protocolos_md: str) -> str:
        """Construye el System Prompt con trazabilidad normativa NASA-STD-3001."""
        return (
            "Eres el sistema de apoyo a la decisión clínica (CDSS) a bordo de una nave en "
            "tránsito hacia Marte con hasta 20 minutos de latencia de comunicación por sentido "
            "(~40 min ida y vuelta, V2 10083) y sin evacuación médica posible (V1 3007). "
            "Usa tono técnico objetivo sin lenguaje antropomórfico (F.6.2.e).\n\n"
            "=== MANUAL DE PROTOCOLOS MÉDICOS NASA ===\n"
            f"{protocolos_md}\n"
            "=== FIN DEL MANUAL ===\n\n"
            "INSTRUCCIÓN ESTRICTA DE SALIDA (EXACTAMENTE 3 LÍNEAS):\n"
            "Línea 1: [ALERTA: <NIVEL> | PROTOCOLO: <CÓDIGO>] Diagnóstico causal objetivo (≤15 palabras) citando biomarcadores SHAP y aclarando temp. cutánea vs. central si aplica.\n"
            "Línea 2: Directiva operativa 1 inmediata para tripulante no médico (V2 7045).\n"
            "Línea 3: Directiva operativa 2. Si el cuadro es grave o excede el análisis (V2 10171), declara explícitamente 'EXCEDE ALCANCE' e indica escalar a ECG/ecografía a bordo (V1 3004.i) y empaquetado store-and-forward a Tierra (V1 6002)."
        )

    def _extraer_shap_clase(self, X_df: pd.DataFrame, clase_predicha: int) -> np.ndarray:
        """Extrae el vector 1D de valores SHAP para la clase predicha."""
        raw_shap = self.explainer.shap_values(X_df)

        if isinstance(raw_shap, list):
            arr = np.asarray(raw_shap[clase_predicha])
            return arr[0].astype(float)

        arr = np.asarray(raw_shap)
        if arr.ndim == 3:
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
                    "direccion": "Impulsa este estado" if s_val >= 0 else "Atenúa este estado",
                }
            )
        return top3, shap_todos

    def _resolver_modelo_lm_studio(self) -> str:
        """Descubre el ID del modelo cargado en LM Studio o usa fallback estándar."""
        if self._lm_model_id:
            return self._lm_model_id
        try:
            resp = requests.get(LM_STUDIO_MODELS_URL, timeout=1.2)
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
        limpia = re.sub(
            r"^(?:L[ií]nea\s*\d+|Directiva\s*(?:operativa\s*)?\d+|Diagn[oó]stico(?:\s*causal)?)\s*[:\-]\s*",
            "",
            limpia,
            flags=re.IGNORECASE,
        )
        limpia = re.sub(r"^[\-\*\d\.\)\]]+\s*", "", limpia)
        return limpia.strip()

    @staticmethod
    def _seleccionar_protocolo_y_alcance(
        clase_riesgo: int,
        nivel_nasa: str,
        lectura: dict[str, float],
        top3_shap: list[dict[str, Any]],
        det_info: dict[str, Any],
        cabin_env: dict[str, float],
        emergencia_manual: bool,
    ) -> tuple[str, bool]:
        """Determina el código de protocolo NASA y si el cuadro excede el alcance (V2 10171)."""
        if emergencia_manual:
            return "PROTO-CV-01", True

        if clase_riesgo == 0 and not det_info["disparada"]:
            return "PROTO-NOM-00", False

        top_var = top3_shap[0]["variable"]
        vars_top2 = {item["variable"] for item in top3_shap[:2]}
        temp_central = float(det_info["temp_central_est"])
        excede = bool(det_info["excede_alcance"]) or nivel_nasa == "Emergency"

        # Priorizar evento cardiovascular agudo primario si hay anomalía ECG crítica o taquicardia extrema con cabina nominal
        cabina_en_rango = cabin_env.get("pi_o2_mmhg", 150.0) >= 127.0 and cabin_env.get("ppco2_mmhg", 1.8) <= 3.0
        if cabina_en_rango and (
            lectura["anomalia_ecg"] > 0.35
            or (lectura["frec_cardiaca"] > 135.0 and lectura["anomalia_ecg"] > 0.25)
        ):
            return "PROTO-CV-01", excede or (lectura["anomalia_ecg"] > 0.35 and lectura["frec_cardiaca"] > 125.0)

        # Priorizar cuadros por severidad clínica y contexto ambiental/SHAP
        if (
            lectura["spo2"] < 92.0
            or cabin_env.get("pi_o2_mmhg", 150.0) < 127.0
            or cabin_env.get("ppco2_mmhg", 1.8) > 3.0
            or (lectura["spo2"] < 95.8 and (top_var in {"spo2", "frec_respiratoria", "vol_respiratorio"} or "spo2" in vars_top2))
        ):
            return "PROTO-RESP-02", excede or lectura["spo2"] < 90.0

        if (
            temp_central < 35.0
            or temp_central > 38.4
            or lectura["temp_corporal"] > 37.5
            or lectura["temp_corporal"] < 35.2
            or (top_var == "temp_corporal" and not (35.6 <= lectura["temp_corporal"] <= 36.9))
        ):
            return "PROTO-TERM-04", excede or temp_central < 35.0

        if (
            lectura["anomalia_ecg"] > 0.35
            or lectura["frec_cardiaca"] > 130.0
            or lectura["presion_sistolica"] > 145.0
            or lectura["presion_sistolica"] < 90.0
            or (top_var in {"frec_cardiaca", "presion_sistolica", "anomalia_ecg"} and lectura["horas_sueno"] >= 6.8)
        ):
            return "PROTO-CV-01", excede or (lectura["anomalia_ecg"] > 0.35 and lectura["frec_cardiaca"] > 125.0)

        if (
            lectura["glucemia"] < 70.0
            or lectura["glucemia"] > 140.0
            or lectura["horas_sueno"] < 7.5
            or lectura["eficiencia_sueno"] < 80.0
            or top_var in {"glucemia", "horas_sueno", "eficiencia_sueno"}
        ):
            return "PROTO-MET-03", excede or lectura["glucemia"] < 55.0 or lectura["glucemia"] > 220.0

        if lectura["estado_animo"] < 6.5 or top_var == "estado_animo":
            return "PROTO-COND-05", excede

        return "PROTO-CV-01", excede

    def _consultar_lm_studio(
        self,
        clase_riesgo: int,
        nivel_nasa: str,
        protocolo_codigo: str,
        excede_alcance: bool,
        probabilidades: dict[str, float],
        lectura: dict[str, float],
        top3_shap: list[dict[str, Any]],
        det_info: dict[str, Any],
        cabin_env: dict[str, float],
    ) -> tuple[str, list[str]] | None:
        """Consulta LM Studio inyectando código de protocolo, trazabilidad SHAP y alcance V2 10171."""
        etiqueta = RISK_LABELS[clase_riesgo]
        resumen_shap = "; ".join(
            f"{item['variable']}={item['valor']} {item['unidad']} "
            f"(nominal {item['rango_nominal']}, SHAP={item['shap_valor']:+.3f})"
            for item in top3_shap
        )
        razones_det = "; ".join(det_info["razones"]) if det_info["razones"] else "Ninguna regla crítica determinista disparada."

        user_prompt = (
            f"Nivel NASA: {nivel_nasa} | Protocolo asignado: {protocolo_codigo} | "
            f"Clase XGBoost: {etiqueta} ({probabilidades[etiqueta]:.1%}) | "
            f"Excede alcance análisis automático (V2 10171): {'SÍ' if excede_alcance else 'NO'}.\n"
            f"Temperatura cutánea Astroskin: {lectura['temp_corporal']:.2f} °C | "
            f"Temperatura central estimada (Vol. 1 Apéndice C): {det_info['temp_central_est']:.2f} °C.\n"
            f"Contexto cabina: P_I O2={cabin_env.get('pi_o2_mmhg', 150.0)} mmHg, "
            f"ppCO2={cabin_env.get('ppco2_mmhg', 1.8)} mmHg.\n"
            f"Capa determinista previa: {razones_det}\n"
            f"Top 3 biomarcadores SHAP: {resumen_shap}.\n"
            f"Vector completo: {json.dumps(lectura, ensure_ascii=False)}.\n"
            "Emite estrictamente 3 líneas siguiendo el formato con [ALERTA: ... | PROTOCOLO: ...]."
        )

        payload = {
            "model": self._resolver_modelo_lm_studio(),
            "messages": [
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.12,
            "max_tokens": 220,
            "stream": False,
        }

        try:
            resp = requests.post(self.lm_studio_url, json=payload, timeout=5.0)
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
            if protocolo_codigo not in diagnostico:
                diagnostico = f"[ALERTA: {nivel_nasa.upper()} | {protocolo_codigo}] {diagnostico}"

            directivas = lineas[1:3]
            if len(directivas) == 1:
                directivas.append(
                    "Registrar en historia electrónica y preparar envío diferido store-and-forward a Tierra (V1 6002, latencia 20 min)."
                )
            return diagnostico, directivas
        except (requests.RequestException, ValueError, KeyError, IndexError):
            return None

    def _diagnostico_respaldo_reglas(
        self,
        clase_riesgo: int,
        nivel_nasa: str,
        protocolo_codigo: str,
        excede_alcance: bool,
        lectura: dict[str, float],
        top3_shap: list[dict[str, Any]],
        det_info: dict[str, Any],
        cabin_env: dict[str, float],
        emergencia_manual: bool,
    ) -> tuple[str, list[str]]:
        """
        Respaldo determinista trazable (offline) con citas exactas a NASA-STD-3001
        y declaración de alcance V2 10171.
        """
        tag = f"[ALERTA: {nivel_nasa.upper()} | {protocolo_codigo}]"
        temp_central = float(det_info["temp_central_est"])

        if emergencia_manual:
            return (
                f"{tag} Activación manual de emergencia (V2 10178): sospecha de evento agudo o colapso en tránsito.",
                [
                    "Asegurar vía aérea, verificar respuesta/pulso e iniciar RCP o DEA si corresponde (V1 5001-5002).",
                    "EXCEDE ALCANCE (V2 10171): escalar a CMO (V1 3006) para ECG/ecografía a bordo (V1 3004.i, V1 5003) y envío store-and-forward (V1 6002).",
                ],
            )

        if clase_riesgo == 0 and nivel_nasa == "Nominal":
            top_vars = ", ".join(item["variable"] for item in top3_shap[:2])
            return (
                f"{tag} Estabilidad fisiológica en microgravedad confirmada por {top_vars} dentro de línea base.",
                [
                    "Continuar cronograma nominal de tránsito y verificar cumplimiento de 8,5 h de sueño (V1 6001).",
                    "Mantener vigilancia continua Astroskin/Actiwatch y registro periódico de glucemia (mg/dL) y ánimo.",
                ],
            )

        if nivel_nasa == "Advisory":
            return (
                f"{tag} Datos manuales obsoletos (estado Cian, V2 10020) o desviación menor sin criterio Caution.",
                [
                    "Actualizar medición capilar de glucemia (mg/dL) y autorreporte breve de estado de ánimo.",
                    "Mantener registro continuo de tendencias en historia clínica cifrada (V1 3004.a, V1 7001).",
                ],
            )

        if protocolo_codigo == "PROTO-RESP-02":
            pi_o2 = cabin_env.get("pi_o2_mmhg", 150.0)
            ppco2 = cabin_env.get("ppco2_mmhg", 1.8)
            if clase_riesgo == 2 or excede_alcance:
                return (
                    f"{tag} Compromiso respiratorio severo (SpO₂={lectura['spo2']} %, P_I O₂={pi_o2} mmHg, ppCO₂={ppco2} mmHg).",
                    [
                        "Colocar oxígeno suplementario al 100 %, suspender esfuerzo (V2 10200) y aislar fallo ECLSS / CO₂ (V2 6004).",
                        "EXCEDE ALCANCE (V2 10171): escalar a ecografía pulmonar/ECG a bordo (V1 3004.i) y envío store-and-forward (V1 6002).",
                    ],
                )
            return (
                f"{tag} Hipoxia o hipercapnia leve (SpO₂={lectura['spo2']} %, FR={lectura['frec_respiratoria']} rpm, P_I O₂={pi_o2} mmHg).",
                [
                    "Ejecutar respiración diafragmática controlada 5 min y verificar depuración ppCO₂ ≤ 3 mmHg (V2 6004).",
                    "Repetir oximetría Astroskin en 5 min y validar si el pico responde a actividad física.",
                ],
            )

        if protocolo_codigo == "PROTO-TERM-04":
            if temp_central < 35.0:
                return (
                    f"{tag} Hipotermia central estimada ({temp_central:.2f} °C < 35,0 °C Vol. 1 Apéndice C; piel={lectura['temp_corporal']} °C).",
                    [
                        "Confirmar temperatura central/oral, activar recalentamiento progresivo y elevar cabina a 22–25 °C (V2 6012).",
                        "EXCEDE ALCANCE (V2 10171): vigilar ECG continuo (V1 3004.i) cada 5 min y transmitir paquete store-and-forward (V1 6002).",
                    ],
                )
            if clase_riesgo == 2 or excede_alcance:
                return (
                    f"{tag} Sobrecarga térmica crítica (piel={lectura['temp_corporal']} °C, central est.={temp_central:.2f} °C, V2 11011).",
                    [
                        "Activar prenda de enfriamiento líquido LCVG al máximo y cesar actividad metabólica intensa.",
                        "EXCEDE ALCANCE (V2 10171): evaluar ECG/hemodinamia por CMO (V1 3004.i) y enviar registro store-and-forward (V1 6002).",
                    ],
                )
            return (
                f"{tag} Deriva térmica preventiva (piel={lectura['temp_corporal']} °C, central est.={temp_central:.2f} °C).",
                [
                    "Ajustar ambiente térmico de cabina hacia confort (20–25 °C, Fig. 6.2-2) e hidratar con 500 ml.",
                    "Validar temperatura oral/central para distinguir variación cutánea de central (V2 11011).",
                ],
            )

        if protocolo_codigo == "PROTO-MET-03":
            if clase_riesgo == 2 or excede_alcance:
                return (
                    f"{tag} Desregulación metabólica y privación de sueño ({lectura['horas_sueno']} h vs 8,5 h V1 6001; glucemia={lectura['glucemia']} mg/dL).",
                    [
                        "Corregir glucemia inmediata (15–20 g glucosa oral si < 70 mg/dL) y transferir tareas críticas a otro tripulante.",
                        "EXCEDE ALCANCE (V2 10171): cumplir recuperación de sueño protegida (NC-40, ≤ 0,02 lux) y enviar reporte diferido (V1 6002).",
                    ],
                )
            return (
                f"{tag} Déficit acumulado de sueño ({lectura['horas_sueno']} h) con deriva glucémica ({lectura['glucemia']} mg/dL, V2 8055).",
                [
                    "Aplicar iluminación circadiana (≥ 250 lux EDI vigilia / 8 ± 2 lux pre-sueño, V2 8055) y asegurar ingesta calórica (V1 4020).",
                    "Evitar tareas críticas en nadir circadiano (1–7 AM relativo) y recontrolar glucemia en 30 min.",
                ],
            )

        if protocolo_codigo == "PROTO-COND-05":
            return (
                f"{tag} Alteración afectiva/conductual detectada (ánimo={lectura['estado_animo']}/10, Tabla E.2-2).",
                [
                    "Iniciar protocolo conductual asíncrono en dispositivo privado (V1 3004.q, privacidad V2 7071).",
                    "Reducir carga cognitiva (Bedford ≤ 3, V2 5007) y registrar nota cifrada para PPC diferida (V1 6010).",
                ],
            )

        # PROTO-CV-01
        if clase_riesgo == 2 or excede_alcance:
            return (
                f"{tag} Evento cardiovascular agudo (FC={lectura['frec_cardiaca']:.0f} lpm, PAS={lectura['presion_sistolica']} mmHg, ECG={lectura['anomalia_ecg']}).",
                [
                    "Detener maniobras, adoptar reposo inmediato y evaluar síntomas torácicos o colapso (Tabla E.2-2).",
                    "EXCEDE ALCANCE (V2 10171): activar CMO (V1 3006) para ECG 3-derivaciones y ecografía a bordo (V1 3004.i, V1 5003) + store-and-forward (V1 6002).",
                ],
            )
        return (
            f"{tag} Sobrecarga cardiovascular moderada (FC={lectura['frec_cardiaca']:.0f} lpm, PAS={lectura['presion_sistolica']} mmHg).",
            [
                "Reducir carga física en 50 % y aplicar hidratación isotónica con reposo neutro (V2 7042).",
                "Vigilar tendencia de ECG y presión arterial cada 5 min hasta retorno a línea base (V1 3004.h).",
            ],
        )

    def evaluar(
        self,
        lectura: dict[str, float],
        cabin_env: dict[str, float] | None = None,
        emergencia_manual: bool = False,
        datos_obsoletos: bool = False,
        intervalo_llm_seg: float = 25.0,
        forzar_llm: bool = False,
    ) -> dict[str, Any]:
        """
        Evalúa telemetría multimodal:
        1. Ejecuta capa determinista previa (ajuste 1) y mide latencia total (<= 1,0 s Tabla 10.2-1).
        2. Ejecuta XGBoost + SHAP TreeExplainer.
        3. Clasifica en jerarquía oficial de 5 niveles NASA-STD-3001 Vol. 2 Rev. E.
        4. Invoca LM Studio o respaldo offline con trazabilidad (ajuste 2).
        """
        t_inicio = time.perf_counter()
        cabin = cabin_env or dict(CABIN_ENV_NOMINAL)
        fila_ordenada = {var: float(lectura[var]) for var in FEATURE_NAMES}

        # 1. Capa determinista previa al árbol de decisión
        det_info = evaluar_reglas_deterministas_criticas(
            fila_ordenada,
            cabin_env=cabin,
            emergencia_manual=emergencia_manual,
        )

        # 2. Inferencia XGBoost + SHAP
        X_df = pd.DataFrame([fila_ordenada], columns=FEATURE_NAMES)
        proba_vec = self.modelo.predict_proba(X_df)[0]
        clase_xgb = int(np.argmax(proba_vec))

        # Si la regla determinista crítica se dispara, nunca permite subclasificación
        clase_riesgo = 2 if det_info["disparada"] else clase_xgb
        etiqueta = RISK_LABELS[clase_riesgo]
        probabilidades = {
            RISK_LABELS[i]: float(proba_vec[i]) for i in range(3)
        }

        shap_vec = self._extraer_shap_clase(X_df, clase_riesgo)
        top3_shap, shap_todos = self._construir_top3_shap(fila_ordenada, shap_vec)
        top_feature = top3_shap[0]["variable"]

        # 3. Mapeo a jerarquía NASA-STD-3001 Vol. 2 Rev. E (Tabla 10.3-1 / F.5-1)
        if emergencia_manual or det_info["nivel_nasa"] == "Emergency":
            nivel_nasa = "Emergency"
        elif clase_riesgo == 2:
            nivel_nasa = "Warning"
        elif clase_riesgo == 1:
            nivel_nasa = "Caution"
        elif datos_obsoletos:
            nivel_nasa = "Advisory"
        else:
            nivel_nasa = "Nominal"

        protocolo_codigo, excede_alcance = self._seleccionar_protocolo_y_alcance(
            clase_riesgo=clase_riesgo,
            nivel_nasa=nivel_nasa,
            lectura=fila_ordenada,
            top3_shap=top3_shap,
            det_info=det_info,
            cabin_env=cabin,
            emergencia_manual=emergencia_manual,
        )

        latencia_ml_ms = (time.perf_counter() - t_inicio) * 1000.0

        # 4. Gestión inteligente de caché para LM Studio
        ahora = time.monotonic()
        cambio_estado = (
            self._ultimo_estado_riesgo is None
            or clase_riesgo != self._ultimo_estado_riesgo
            or nivel_nasa != self._ultimo_nivel_nasa
            or protocolo_codigo != self._ultimo_protocolo
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
                nivel_nasa=nivel_nasa,
                protocolo_codigo=protocolo_codigo,
                excede_alcance=excede_alcance,
                probabilidades=probabilidades,
                lectura=fila_ordenada,
                top3_shap=top3_shap,
                det_info=det_info,
                cabin_env=cabin,
            )
            if respuesta_llm is not None:
                diagnostico, directivas = respuesta_llm
                origen_diagnostico = "LM Studio (Local)"
                self._ultimo_origen_base = "LM Studio"
            else:
                diagnostico, directivas = self._diagnostico_respaldo_reglas(
                    clase_riesgo=clase_riesgo,
                    nivel_nasa=nivel_nasa,
                    protocolo_codigo=protocolo_codigo,
                    excede_alcance=excede_alcance,
                    lectura=fila_ordenada,
                    top3_shap=top3_shap,
                    det_info=det_info,
                    cabin_env=cabin,
                    emergencia_manual=emergencia_manual,
                )
                origen_diagnostico = "Respaldo Reglas NASA (Offline)"
                self._ultimo_origen_base = "Respaldo Reglas NASA"

            self._ultimo_estado_riesgo = clase_riesgo
            self._ultimo_nivel_nasa = nivel_nasa
            self._ultimo_protocolo = protocolo_codigo
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
            "nivel_nasa": nivel_nasa,
            "protocolo_codigo": protocolo_codigo,
            "procedimiento_electronico": PROCEDIMIENTOS_ELECTRONICOS.get(
                protocolo_codigo, PROCEDIMIENTOS_ELECTRONICOS["PROTO-NOM-00"]
            ),
            "excede_alcance": excede_alcance,
            "regla_determinista_disparada": det_info["disparada"],
            "razones_deterministas": det_info["razones"],
            "temp_central_est": det_info["temp_central_est"],
            "latencia_ml_ms": round(latencia_ml_ms, 2),
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
        """Responde consultas operativas del tripulante con trazabilidad NASA-STD-3001."""
        pregunta_limpia = pregunta.strip()
        if not pregunta_limpia:
            return {
                "respuesta": "Ingresa una consulta operativa o clínica.",
                "origen": "Sistema",
            }

        eval_actual = resultado_actual or self.evaluar(lectura, intervalo_llm_seg=9999.0)
        nivel_nasa = eval_actual["nivel_nasa"]
        protocolo = eval_actual["protocolo_codigo"]
        top3_txt = "; ".join(
            f"{item['variable']}={item['valor']} {item['unidad']} (nominal {item['rango_nominal']}, SHAP={item['shap_valor']:+.3f})"
            for item in eval_actual["top3_shap"]
        )

        system_chat = (
            "Eres el sistema de apoyo a la decisión clínica (CDSS) a bordo de una nave en tránsito "
            "a Marte (hasta 20 minutos de latencia por sentido con la Tierra, V2 10083). "
            "Responde de forma técnica, objetiva y sin lenguaje antropomórfico (F.6.2.e) en máximo "
            "4 oraciones. Cita explícitamente el código de alerta/protocolo y, si el cuadro excede "
            "el análisis automático (V2 10171), recomienda escalar a ECG/ecografía a bordo (V1 3004.i) "
            "y registro diferido store-and-forward (V1 6002). Nunca indiques esperar respuesta en vivo de Tierra.\n\n"
            f"=== PROTOCOLOS MÉDICOS NASA ===\n{self.protocolos_md}"
        )

        contexto_telemetria = (
            f"[TELEMETRÍA ACTUAL] Nivel={nivel_nasa} | Protocolo={protocolo} | "
            f"Excede alcance V2 10171={'SÍ' if eval_actual['excede_alcance'] else 'NO'} | "
            f"Temp. cutánea={lectura['temp_corporal']} °C | Temp. central est.={eval_actual['temp_central_est']} °C | "
            f"Diagnóstico={eval_actual['diagnostico']} | Top 3 SHAP: {top3_txt}"
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
            "temperature": 0.18,
            "max_tokens": 280,
            "stream": False,
        }

        try:
            resp = requests.post(self.lm_studio_url, json=payload, timeout=10.0)
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

        directivas_txt = " ".join(
            f"({i + 1}) {d}" for i, d in enumerate(eval_actual["directivas"])
        )
        factores_txt = ", ".join(
            f"{item['nombre']} ({item['valor']} {item['unidad']})"
            for item in eval_actual["top3_shap"]
        )
        aviso_alcance = (
            " Aviso V2 10171: el cuadro excede el alcance del triaje automático; escalar a "
            "ECG/ecografía a bordo (V1 3004.i) por el CMO (V1 3006) y empaquetar para "
            "transmisión diferida store-and-forward (V1 6002)."
            if eval_actual["excede_alcance"]
            else ""
        )
        respuesta_offline = (
            f"[Alerta {nivel_nasa} | {protocolo}] {eval_actual['diagnostico']} "
            f"Factores SHAP determinantes: {factores_txt}. "
            f"Acciones operativas: {directivas_txt}.{aviso_alcance}"
        )
        return {
            "respuesta": respuesta_offline,
            "origen": "Respaldo Reglas NASA (Offline)",
        }
