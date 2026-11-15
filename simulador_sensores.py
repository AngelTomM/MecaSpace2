"""
Simulador continuo de telemetría biomédica y ambiental para tránsito a Marte.

Integra:
- Lecturas continuas de wearables (Astroskin + Actiwatch Spectrum) con transiciones
  suaves, acoplamiento cardiorrespiratorio y ruido de medición realista.
- Entradas multimodales (glucemia mg/dL y estado de ánimo 1-10) actualizables
  manualmente o mediante escenarios de prueba.
- Contexto ambiental de cabina presurizada (P_I O2, ppCO2, temperatura, HR)
  según NASA-STD-3001 Vol. 2 Rev. E (V2 6003-6004, V2 6012-6014).
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np

from nasa_referencia import CABIN_ENV_NOMINAL, FEATURE_NAMES

ESCENARIOS_OBJETIVO: dict[str, dict[str, Any]] = {
    "nominal": {
        "label": "Estado Nominal (Tránsito en Microgravedad)",
        "base": {
            "presion_sistolica": 116.0,
            "temp_corporal": 36.2,
            "nivel_actividad": 0.65,
            "spo2": 98.4,
            "frec_respiratoria": 14.8,
            "vol_respiratorio": 7.9,
            "frec_cardiaca": 71.0,
            "anomalia_ecg": 0.04,
            "eficiencia_sueno": 88.5,
            "glucemia": 96.0,
            "horas_sueno": 8.4,
            "estado_animo": 8.2,
        },
        "ruido": {
            "presion_sistolica": 1.4,
            "temp_corporal": 0.06,
            "nivel_actividad": 0.08,
            "spo2": 0.25,
            "frec_respiratoria": 0.4,
            "vol_respiratorio": 0.22,
            "frec_cardiaca": 1.8,
            "anomalia_ecg": 0.008,
            "eficiencia_sueno": 0.6,
            "glucemia": 1.5,
            "horas_sueno": 0.05,
            "estado_animo": 0.1,
        },
        "cabin": dict(CABIN_ENV_NOMINAL),
    },
    "sueno_glucemia_preventiva": {
        "label": "Privación Acumulada de Sueño + Desregulación Glucémica (Caution)",
        "base": {
            "presion_sistolica": 108.0,
            "temp_corporal": 35.95,
            "nivel_actividad": 0.45,
            "spo2": 97.2,
            "frec_respiratoria": 15.8,
            "vol_respiratorio": 7.4,
            "frec_cardiaca": 92.0,
            "anomalia_ecg": 0.14,
            "eficiencia_sueno": 76.0,
            "glucemia": 67.5,
            "horas_sueno": 6.8,
            "estado_animo": 5.4,
        },
        "ruido": {
            "presion_sistolica": 1.5,
            "temp_corporal": 0.06,
            "nivel_actividad": 0.08,
            "spo2": 0.25,
            "frec_respiratoria": 0.45,
            "vol_respiratorio": 0.25,
            "frec_cardiaca": 1.9,
            "anomalia_ecg": 0.012,
            "eficiencia_sueno": 0.8,
            "glucemia": 1.6,
            "horas_sueno": 0.08,
            "estado_animo": 0.15,
        },
        "cabin": dict(CABIN_ENV_NOMINAL),
    },
    "sueno_glucemia_critica": {
        "label": "Privación Severa de Sueño + Hipoglucemia Metabólica (Warning)",
        "base": {
            "presion_sistolica": 99.0,
            "temp_corporal": 35.7,
            "nivel_actividad": 0.25,
            "spo2": 96.6,
            "frec_respiratoria": 16.4,
            "vol_respiratorio": 7.1,
            "frec_cardiaca": 112.0,
            "anomalia_ecg": 0.24,
            "eficiencia_sueno": 58.0,
            "glucemia": 51.0,
            "horas_sueno": 4.6,
            "estado_animo": 3.4,
        },
        "ruido": {
            "presion_sistolica": 1.8,
            "temp_corporal": 0.07,
            "nivel_actividad": 0.10,
            "spo2": 0.3,
            "frec_respiratoria": 0.5,
            "vol_respiratorio": 0.3,
            "frec_cardiaca": 2.4,
            "anomalia_ecg": 0.02,
            "eficiencia_sueno": 1.0,
            "glucemia": 1.4,
            "horas_sueno": 0.08,
            "estado_animo": 0.18,
        },
        "cabin": dict(CABIN_ENV_NOMINAL),
    },
    "evento_cardiovascular_agudo": {
        "label": "Evento Cardiovascular Agudo (Dolor Torácico / Colapso en Tránsito)",
        "base": {
            "presion_sistolica": 162.0,
            "temp_corporal": 36.8,
            "nivel_actividad": 0.18,
            "spo2": 90.8,
            "frec_respiratoria": 25.2,
            "vol_respiratorio": 14.8,
            "frec_cardiaca": 152.0,
            "anomalia_ecg": 0.62,
            "eficiencia_sueno": 74.0,
            "glucemia": 134.0,
            "horas_sueno": 7.1,
            "estado_animo": 2.8,
        },
        "ruido": {
            "presion_sistolica": 2.6,
            "temp_corporal": 0.08,
            "nivel_actividad": 0.06,
            "spo2": 0.4,
            "frec_respiratoria": 0.7,
            "vol_respiratorio": 0.4,
            "frec_cardiaca": 3.2,
            "anomalia_ecg": 0.03,
            "eficiencia_sueno": 0.8,
            "glucemia": 2.0,
            "horas_sueno": 0.05,
            "estado_animo": 0.15,
        },
        "cabin": dict(CABIN_ENV_NOMINAL),
    },
    "sobrecarga_cardiovascular_preventiva": {
        "label": "Sobrecarga Cardiovascular Moderada (Caution)",
        "base": {
            "presion_sistolica": 134.0,
            "temp_corporal": 36.75,
            "nivel_actividad": 1.95,
            "spo2": 96.8,
            "frec_respiratoria": 19.5,
            "vol_respiratorio": 11.4,
            "frec_cardiaca": 114.0,
            "anomalia_ecg": 0.22,
            "eficiencia_sueno": 82.0,
            "glucemia": 108.0,
            "horas_sueno": 7.7,
            "estado_animo": 6.8,
        },
        "ruido": {
            "presion_sistolica": 2.0,
            "temp_corporal": 0.07,
            "nivel_actividad": 0.10,
            "spo2": 0.3,
            "frec_respiratoria": 0.55,
            "vol_respiratorio": 0.35,
            "frec_cardiaca": 2.3,
            "anomalia_ecg": 0.016,
            "eficiencia_sueno": 0.7,
            "glucemia": 1.5,
            "horas_sueno": 0.05,
            "estado_animo": 0.12,
        },
        "cabin": dict(CABIN_ENV_NOMINAL),
    },
    "hipoxia_preventiva": {
        "label": "Hipoxia / Hipercapnia Leve de Cabina (Caution)",
        "base": {
            "presion_sistolica": 119.0,
            "temp_corporal": 36.25,
            "nivel_actividad": 0.50,
            "spo2": 93.6,
            "frec_respiratoria": 20.2,
            "vol_respiratorio": 11.8,
            "frec_cardiaca": 102.0,
            "anomalia_ecg": 0.09,
            "eficiencia_sueno": 84.0,
            "glucemia": 99.0,
            "horas_sueno": 8.0,
            "estado_animo": 6.6,
        },
        "ruido": {
            "presion_sistolica": 1.6,
            "temp_corporal": 0.06,
            "nivel_actividad": 0.07,
            "spo2": 0.35,
            "frec_respiratoria": 0.6,
            "vol_respiratorio": 0.35,
            "frec_cardiaca": 2.0,
            "anomalia_ecg": 0.012,
            "eficiencia_sueno": 0.7,
            "glucemia": 1.4,
            "horas_sueno": 0.05,
            "estado_animo": 0.1,
        },
        "cabin": {
            "pi_o2_mmhg": 126.0,
            "ppco2_mmhg": 3.6,
            "cabin_temp_c": 22.8,
            "cabin_rh_pct": 48.0,
        },
    },
    "hipoxia_critica": {
        "label": "Hipoxia Severa / Fallo Atmosférico de Cabina (Emergency)",
        "base": {
            "presion_sistolica": 122.0,
            "temp_corporal": 36.2,
            "nivel_actividad": 0.30,
            "spo2": 87.8,
            "frec_respiratoria": 26.5,
            "vol_respiratorio": 15.2,
            "frec_cardiaca": 126.0,
            "anomalia_ecg": 0.21,
            "eficiencia_sueno": 82.0,
            "glucemia": 104.0,
            "horas_sueno": 8.1,
            "estado_animo": 4.2,
        },
        "ruido": {
            "presion_sistolica": 2.0,
            "temp_corporal": 0.08,
            "nivel_actividad": 0.07,
            "spo2": 0.45,
            "frec_respiratoria": 0.8,
            "vol_respiratorio": 0.45,
            "frec_cardiaca": 2.6,
            "anomalia_ecg": 0.015,
            "eficiencia_sueno": 0.8,
            "glucemia": 1.8,
            "horas_sueno": 0.05,
            "estado_animo": 0.15,
        },
        "cabin": {
            "pi_o2_mmhg": 118.0,
            "ppco2_mmhg": 5.8,
            "cabin_temp_c": 23.2,
            "cabin_rh_pct": 52.0,
        },
    },
    "hipotermia_critica": {
        "label": "Hipotermia Central < 35 °C (Vol. 1 Apéndice C)",
        "base": {
            "presion_sistolica": 87.0,
            "temp_corporal": 33.9,
            "nivel_actividad": 0.15,
            "spo2": 94.5,
            "frec_respiratoria": 8.2,
            "vol_respiratorio": 4.1,
            "frec_cardiaca": 42.0,
            "anomalia_ecg": 0.27,
            "eficiencia_sueno": 77.0,
            "glucemia": 66.0,
            "horas_sueno": 7.6,
            "estado_animo": 4.8,
        },
        "ruido": {
            "presion_sistolica": 1.6,
            "temp_corporal": 0.07,
            "nivel_actividad": 0.05,
            "spo2": 0.35,
            "frec_respiratoria": 0.35,
            "vol_respiratorio": 0.2,
            "frec_cardiaca": 1.5,
            "anomalia_ecg": 0.018,
            "eficiencia_sueno": 0.7,
            "glucemia": 1.4,
            "horas_sueno": 0.05,
            "estado_animo": 0.15,
        },
        "cabin": {
            "pi_o2_mmhg": 149.0,
            "ppco2_mmhg": 2.1,
            "cabin_temp_c": 16.5,
            "cabin_rh_pct": 68.0,
        },
    },
    "estres_termico_critico": {
        "label": "Estrés Térmico y Hemodinámico en Cabina (Warning)",
        "base": {
            "presion_sistolica": 141.0,
            "temp_corporal": 38.05,
            "nivel_actividad": 1.65,
            "spo2": 96.1,
            "frec_respiratoria": 21.8,
            "vol_respiratorio": 13.4,
            "frec_cardiaca": 127.0,
            "anomalia_ecg": 0.18,
            "eficiencia_sueno": 78.0,
            "glucemia": 116.0,
            "horas_sueno": 7.3,
            "estado_animo": 5.4,
        },
        "ruido": {
            "presion_sistolica": 2.1,
            "temp_corporal": 0.08,
            "nivel_actividad": 0.10,
            "spo2": 0.3,
            "frec_respiratoria": 0.6,
            "vol_respiratorio": 0.35,
            "frec_cardiaca": 2.5,
            "anomalia_ecg": 0.015,
            "eficiencia_sueno": 0.8,
            "glucemia": 1.5,
            "horas_sueno": 0.05,
            "estado_animo": 0.15,
        },
        "cabin": {
            "pi_o2_mmhg": 150.0,
            "ppco2_mmhg": 2.4,
            "cabin_temp_c": 28.4,
            "cabin_rh_pct": 72.0,
        },
    },
}

LIMITES_FISICOS: dict[str, tuple[float, float]] = {
    "presion_sistolica": (65.0, 210.0),
    "temp_corporal": (32.5, 41.0),
    "nivel_actividad": (0.02, 5.0),
    "spo2": (70.0, 100.0),
    "frec_respiratoria": (5.0, 40.0),
    "vol_respiratorio": (2.0, 28.0),
    "frec_cardiaca": (30.0, 200.0),
    "anomalia_ecg": (0.0, 1.0),
    "eficiencia_sueno": (20.0, 100.0),
    "glucemia": (35.0, 380.0),
    "horas_sueno": (2.0, 12.0),
    "estado_animo": (1.0, 10.0),
}

PRECISION_SALIDA: dict[str, int] = {
    "presion_sistolica": 1,
    "temp_corporal": 2,
    "nivel_actividad": 2,
    "spo2": 1,
    "frec_respiratoria": 1,
    "vol_respiratorio": 2,
    "frec_cardiaca": 0,
    "anomalia_ecg": 3,
    "eficiencia_sueno": 1,
    "glucemia": 1,
    "horas_sueno": 2,
    "estado_animo": 1,
}


class SimuladorSensores:
    """Mantiene el estado fisiológico/multimodal del astronauta y genera lecturas continuas."""

    def __init__(self, seed: int = 42, suavizado: float = 0.48) -> None:
        self._rng = np.random.default_rng(seed)
        self._suavizado = float(np.clip(suavizado, 0.1, 1.0))
        self._tick = 0
        self.escenario_actual: str = "nominal"
        self.valores_actuales: dict[str, float] = dict(ESCENARIOS_OBJETIVO["nominal"]["base"])
        self._objetivo_actual: dict[str, float] = dict(ESCENARIOS_OBJETIVO["nominal"]["base"])
        self._ruido_actual: dict[str, float] = dict(ESCENARIOS_OBJETIVO["nominal"]["ruido"])
        self._cabina_actual: dict[str, float] = dict(ESCENARIOS_OBJETIVO["nominal"]["cabin"])
        self._manual_overrides: dict[str, float] = {}
        self.intervenciones_aplicadas: list[str] = []

    def aplicar_intervencion(self, tipo_intervencion: str) -> str:
        """
        Ejecuta una decisión clínica del tripulante y actualiza el estado
        fisiológico/ambiental objetivo para reflejar la respuesta a la contramedida.
        """
        self._manual_overrides.clear()
        mensajes = {
            "oxigeno_100": "Oxígeno suplementario al 100 % aplicado y depuración ECLSS estabilizada.",
            "reposo_cv": "Reposo absoluto adoptado; carga operativa reducida e hidratación aplicada.",
            "rcp_dea": "Protocolo RCP/DEA y soporte vital básico ejecutado; ritmo en estabilización.",
            "glucosa_oral": "Administrados 15–20 g de glucosa oral de absorción rápida.",
            "iluminacion_descanso": "Iluminación circadiana aplicada y bloque de recuperación de sueño activado.",
            "recalentamiento": "Recalentamiento térmico progresivo y aislamiento de cabina activados.",
            "enfriamiento_lcvg": "Prenda de enfriamiento líquido (LCVG) activada al máximo flujo.",
            "protocolo_conductual": "Sesión breve de respiración guiada 4-6 y descarga cognitiva completada.",
            "ecg_ecografia_bordo": "Registro de ECG 3-derivaciones y ecografía portátil capturado para expediente.",
        }
        if tipo_intervencion not in mensajes:
            return "Intervención registrada."

        self.intervenciones_aplicadas.append(tipo_intervencion)

        if tipo_intervencion == "oxigeno_100":
            self._objetivo_actual["spo2"] = 98.2
            self._objetivo_actual["frec_respiratoria"] = 16.0
            self._objetivo_actual["vol_respiratorio"] = 8.4
            self._objetivo_actual["frec_cardiaca"] = min(self._objetivo_actual["frec_cardiaca"], 88.0)
            self._cabina_actual["pi_o2_mmhg"] = 150.0
            self._cabina_actual["ppco2_mmhg"] = 1.9
        elif tipo_intervencion == "reposo_cv":
            self._objetivo_actual["frec_cardiaca"] = 82.0
            self._objetivo_actual["presion_sistolica"] = 121.0
            self._objetivo_actual["anomalia_ecg"] = min(self._objetivo_actual["anomalia_ecg"], 0.12)
            self._objetivo_actual["nivel_actividad"] = 0.25
            self._objetivo_actual["spo2"] = max(self._objetivo_actual["spo2"], 96.5)
        elif tipo_intervencion == "rcp_dea":
            self._objetivo_actual["frec_cardiaca"] = 89.0
            self._objetivo_actual["presion_sistolica"] = 114.0
            self._objetivo_actual["anomalia_ecg"] = 0.18
            self._objetivo_actual["spo2"] = 95.8
            self._objetivo_actual["frec_respiratoria"] = 17.5
            self._objetivo_actual["nivel_actividad"] = 0.15
        elif tipo_intervencion == "glucosa_oral":
            self._objetivo_actual["glucemia"] = 98.0
            self._objetivo_actual["frec_cardiaca"] = min(self._objetivo_actual["frec_cardiaca"], 84.0)
            self._objetivo_actual["estado_animo"] = max(self._objetivo_actual["estado_animo"], 6.8)
        elif tipo_intervencion == "iluminacion_descanso":
            self._objetivo_actual["horas_sueno"] = 8.2
            self._objetivo_actual["eficiencia_sueno"] = 86.0
            self._objetivo_actual["estado_animo"] = max(self._objetivo_actual["estado_animo"], 7.4)
            self._objetivo_actual["anomalia_ecg"] = min(self._objetivo_actual["anomalia_ecg"], 0.10)
        elif tipo_intervencion == "recalentamiento":
            self._objetivo_actual["temp_corporal"] = 36.1
            self._objetivo_actual["frec_cardiaca"] = 68.0
            self._objetivo_actual["presion_sistolica"] = 112.0
            self._objetivo_actual["frec_respiratoria"] = 14.2
            self._cabina_actual["cabin_temp_c"] = 22.8
        elif tipo_intervencion == "enfriamiento_lcvg":
            self._objetivo_actual["temp_corporal"] = 36.3
            self._objetivo_actual["frec_cardiaca"] = 82.0
            self._objetivo_actual["presion_sistolica"] = 122.0
            self._cabina_actual["cabin_temp_c"] = 21.5
        elif tipo_intervencion == "protocolo_conductual":
            self._objetivo_actual["estado_animo"] = min(9.0, max(self.valores_actuales["estado_animo"] + 1.8, 7.2))
            self._objetivo_actual["frec_cardiaca"] = min(self._objetivo_actual["frec_cardiaca"], 78.0)

        # Acelerar parcialmente la respuesta fisiológica tras la acción
        if tipo_intervencion != "ecg_ecografia_bordo":
            for var in FEATURE_NAMES:
                actual = self.valores_actuales[var]
                objetivo = self._objetivo_actual[var]
                self.valores_actuales[var] = actual + 0.65 * (objetivo - actual)

        return mensajes[tipo_intervencion]

    def activar_escenario(self, nombre_escenario: str, inmediato: bool = True) -> None:
        """Cambia el perfil fisiológico y ambiental objetivo."""
        if nombre_escenario not in ESCENARIOS_OBJETIVO:
            raise ValueError(f"Escenario desconocido: {nombre_escenario}")
        self.escenario_actual = nombre_escenario
        self._manual_overrides.clear()
        self.intervenciones_aplicadas.clear()
        cfg = ESCENARIOS_OBJETIVO[nombre_escenario]
        self._objetivo_actual = dict(cfg["base"])
        self._ruido_actual = dict(cfg["ruido"])
        self._cabina_actual = dict(cfg["cabin"])
        if inmediato:
            for var in FEATURE_NAMES:
                actual = self.valores_actuales[var]
                objetivo = self._objetivo_actual[var]
                self.valores_actuales[var] = actual + 0.90 * (objetivo - actual)

    def registrar_entrada_manual(
        self,
        glucemia: float | None = None,
        estado_animo: float | None = None,
    ) -> None:
        """Permite fijar manualmente los indicadores multimodales (glucemia y ánimo)."""
        if glucemia is not None:
            g = float(np.clip(glucemia, *LIMITES_FISICOS["glucemia"]))
            self._manual_overrides["glucemia"] = g
            self._objetivo_actual["glucemia"] = g
            self.valores_actuales["glucemia"] = g
        if estado_animo is not None:
            a = float(np.clip(estado_animo, *LIMITES_FISICOS["estado_animo"]))
            self._manual_overrides["estado_animo"] = a
            self._objetivo_actual["estado_animo"] = a
            self.valores_actuales["estado_animo"] = a

    def restaurar_nominal(self, inmediato: bool = True) -> None:
        """Restaura los parámetros fisiológicos y de cabina a banda nominal."""
        self.activar_escenario("nominal", inmediato=inmediato)

    def inyectar_hipoxia(self, critica: bool = True, inmediato: bool = True) -> None:
        """Inyecta caída de SpO2 y P_I O2 / aumento de ppCO2 en cabina."""
        esc = "hipoxia_critica" if critica else "hipoxia_preventiva"
        self.activar_escenario(esc, inmediato=inmediato)

    def inyectar_privacion_sueno_glucemia(self, critica: bool = False, inmediato: bool = True) -> None:
        """Inyecta privación acumulada de sueño con desregulación glucémica (V2 8055)."""
        esc = "sueno_glucemia_critica" if critica else "sueno_glucemia_preventiva"
        self.activar_escenario(esc, inmediato=inmediato)

    def inyectar_fatiga_severa(self, critica: bool = True, inmediato: bool = True) -> None:
        """Alias compatible hacia privación de sueño / desregulación glucémica."""
        self.inyectar_privacion_sueno_glucemia(critica=critica, inmediato=inmediato)

    def inyectar_sobrecarga_cardiovascular(self, critica: bool = True, inmediato: bool = True) -> None:
        """Inyecta evento cardiovascular agudo (dolor torácico/colapso) o sobrecarga moderada."""
        esc = (
            "evento_cardiovascular_agudo"
            if critica
            else "sobrecarga_cardiovascular_preventiva"
        )
        self.activar_escenario(esc, inmediato=inmediato)

    def inyectar_hipotermia(self, inmediato: bool = True) -> None:
        """Inyecta hipotermia central < 35 °C (Vol. 1 Apéndice C)."""
        self.activar_escenario("hipotermia_critica", inmediato=inmediato)

    def inyectar_estres_termico(self, inmediato: bool = True) -> None:
        """Inyecta hipertermia cutánea/central con sobrecarga hemodinámica."""
        self.activar_escenario("estres_termico_critico", inmediato=inmediato)

    def obtener_entorno_cabina(self) -> dict[str, float]:
        """Devuelve la telemetría ambiental actual de la cabina presurizada."""
        return {
            "pi_o2_mmhg": round(self._cabina_actual["pi_o2_mmhg"] + float(self._rng.normal(0.0, 0.4)), 1),
            "ppco2_mmhg": round(max(0.2, self._cabina_actual["ppco2_mmhg"] + float(self._rng.normal(0.0, 0.05))), 2),
            "cabin_temp_c": round(self._cabina_actual["cabin_temp_c"] + float(self._rng.normal(0.0, 0.1)), 1),
            "cabin_rh_pct": round(self._cabina_actual["cabin_rh_pct"] + float(self._rng.normal(0.0, 0.4)), 1),
        }

    def obtener_estado_escenario(self) -> dict[str, Any]:
        """Devuelve metadatos del escenario activo."""
        return {
            "escenario": self.escenario_actual,
            "label": ESCENARIOS_OBJETIVO[self.escenario_actual]["label"],
            "tick": self._tick,
        }

    def leer_sensores(self) -> dict[str, float]:
        """
        Avanza un paso temporal la fisiología simulada y retorna las 12 claves
        del contrato biomédico y multimodal.
        """
        self._tick += 1
        fase_resp = math.sin(self._tick * 0.45)
        fase_circ = math.cos(self._tick * 0.12)

        lectura: dict[str, float] = {}
        for var in FEATURE_NAMES:
            if var in self._manual_overrides:
                dec = PRECISION_SALIDA[var]
                lectura[var] = float(round(self._manual_overrides[var], dec))
                continue

            actual = self.valores_actuales[var]
            objetivo = self._objetivo_actual[var]
            sigma = self._ruido_actual[var]

            modulacion = 0.0
            if var == "frec_cardiaca":
                modulacion = 1.6 * fase_resp + 1.2 * fase_circ
            elif var == "frec_respiratoria":
                modulacion = 0.35 * fase_resp
            elif var == "presion_sistolica":
                modulacion = 1.1 * fase_circ

            # Las entradas discretas/diarias (horas_sueno, estado_animo) oscilan mínimamente
            if var in {"horas_sueno", "estado_animo"}:
                nuevo = actual + self._suavizado * (objetivo - actual) + float(self._rng.normal(0.0, sigma * 0.35))
            else:
                nuevo = actual + self._suavizado * (objetivo - actual) + modulacion + float(self._rng.normal(0.0, sigma))

            lim_min, lim_max = LIMITES_FISICOS[var]
            nuevo = float(np.clip(nuevo, lim_min, lim_max))
            self.valores_actuales[var] = nuevo

            dec = PRECISION_SALIDA[var]
            lectura[var] = float(round(nuevo, dec))

        return lectura
