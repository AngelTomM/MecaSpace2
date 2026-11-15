"""
Simulador continuo de telemetría biomédica (Astroskin + Actiwatch Spectrum).

Mantiene el estado fisiológico del astronauta con transiciones suaves,
acoplamiento cardiorrespiratorio y ruido de medición realista, permitiendo
inyectar emergencias agudas o restaurar el estado nominal en vivo.
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np

from nasa_referencia import FEATURE_NAMES

ESCENARIOS_OBJETIVO: dict[str, dict[str, dict[str, float]]] = {
    "nominal": {
        "base": {
            "presion_sistolica": 116.0,
            "temp_corporal": 36.8,
            "nivel_actividad": 0.65,
            "spo2": 98.4,
            "frec_respiratoria": 14.8,
            "vol_respiratorio": 7.9,
            "frec_cardiaca": 71.0,
            "anomalia_ecg": 0.04,
            "eficiencia_sueno": 88.5,
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
        },
    },
    "hipoxia_critica": {
        "base": {
            "presion_sistolica": 122.0,
            "temp_corporal": 36.9,
            "nivel_actividad": 0.35,
            "spo2": 88.5,
            "frec_respiratoria": 26.0,
            "vol_respiratorio": 14.8,
            "frec_cardiaca": 124.0,
            "anomalia_ecg": 0.17,
            "eficiencia_sueno": 82.0,
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
        },
    },
    "hipoxia_preventiva": {
        "base": {
            "presion_sistolica": 119.0,
            "temp_corporal": 36.85,
            "nivel_actividad": 0.50,
            "spo2": 93.6,
            "frec_respiratoria": 20.2,
            "vol_respiratorio": 11.8,
            "frec_cardiaca": 102.0,
            "anomalia_ecg": 0.09,
            "eficiencia_sueno": 84.0,
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
        },
    },
    "fatiga_severa_critica": {
        "base": {
            "presion_sistolica": 101.0,
            "temp_corporal": 36.4,
            "nivel_actividad": 0.25,
            "spo2": 96.4,
            "frec_respiratoria": 16.5,
            "vol_respiratorio": 7.2,
            "frec_cardiaca": 109.0,
            "anomalia_ecg": 0.31,
            "eficiencia_sueno": 59.0,
        },
        "ruido": {
            "presion_sistolica": 1.8,
            "temp_corporal": 0.07,
            "nivel_actividad": 0.12,
            "spo2": 0.3,
            "frec_respiratoria": 0.5,
            "vol_respiratorio": 0.3,
            "frec_cardiaca": 2.5,
            "anomalia_ecg": 0.025,
            "eficiencia_sueno": 1.1,
        },
    },
    "fatiga_preventiva": {
        "base": {
            "presion_sistolica": 106.5,
            "temp_corporal": 36.6,
            "nivel_actividad": 0.45,
            "spo2": 97.1,
            "frec_respiratoria": 15.8,
            "vol_respiratorio": 7.4,
            "frec_cardiaca": 96.5,
            "anomalia_ecg": 0.19,
            "eficiencia_sueno": 72.5,
        },
        "ruido": {
            "presion_sistolica": 1.5,
            "temp_corporal": 0.06,
            "nivel_actividad": 0.09,
            "spo2": 0.25,
            "frec_respiratoria": 0.45,
            "vol_respiratorio": 0.25,
            "frec_cardiaca": 1.9,
            "anomalia_ecg": 0.015,
            "eficiencia_sueno": 0.9,
        },
    },
    "sobrecarga_cardiovascular_critica": {
        "base": {
            "presion_sistolica": 152.0,
            "temp_corporal": 37.65,
            "nivel_actividad": 2.25,
            "spo2": 95.8,
            "frec_respiratoria": 22.8,
            "vol_respiratorio": 14.2,
            "frec_cardiaca": 141.0,
            "anomalia_ecg": 0.44,
            "eficiencia_sueno": 79.0,
        },
        "ruido": {
            "presion_sistolica": 2.5,
            "temp_corporal": 0.08,
            "nivel_actividad": 0.14,
            "spo2": 0.35,
            "frec_respiratoria": 0.7,
            "vol_respiratorio": 0.4,
            "frec_cardiaca": 3.0,
            "anomalia_ecg": 0.028,
            "eficiencia_sueno": 0.8,
        },
    },
    "sobrecarga_cardiovascular_preventiva": {
        "base": {
            "presion_sistolica": 134.0,
            "temp_corporal": 37.35,
            "nivel_actividad": 1.95,
            "spo2": 96.8,
            "frec_respiratoria": 19.5,
            "vol_respiratorio": 11.4,
            "frec_cardiaca": 114.0,
            "anomalia_ecg": 0.22,
            "eficiencia_sueno": 82.0,
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
        },
    },
    "estres_termico_critico": {
        "base": {
            "presion_sistolica": 141.0,
            "temp_corporal": 38.55,
            "nivel_actividad": 1.65,
            "spo2": 96.1,
            "frec_respiratoria": 21.8,
            "vol_respiratorio": 13.4,
            "frec_cardiaca": 127.0,
            "anomalia_ecg": 0.18,
            "eficiencia_sueno": 78.0,
        },
        "ruido": {
            "presion_sistolica": 2.1,
            "temp_corporal": 0.09,
            "nivel_actividad": 0.10,
            "spo2": 0.3,
            "frec_respiratoria": 0.6,
            "vol_respiratorio": 0.35,
            "frec_cardiaca": 2.5,
            "anomalia_ecg": 0.015,
            "eficiencia_sueno": 0.8,
        },
    },
}

LIMITES_FISICOS: dict[str, tuple[float, float]] = {
    "presion_sistolica": (65.0, 210.0),
    "temp_corporal": (34.0, 41.5),
    "nivel_actividad": (0.02, 5.0),
    "spo2": (70.0, 100.0),
    "frec_respiratoria": (5.0, 40.0),
    "vol_respiratorio": (2.0, 28.0),
    "frec_cardiaca": (32.0, 200.0),
    "anomalia_ecg": (0.0, 1.0),
    "eficiencia_sueno": (20.0, 100.0),
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
}


class SimuladorSensores:
    """Mantiene el estado biomédico del astronauta y genera lecturas continuas."""

    def __init__(self, seed: int = 42, suavizado: float = 0.45) -> None:
        self._rng = np.random.default_rng(seed)
        self._suavizado = float(np.clip(suavizado, 0.1, 1.0))
        self._tick = 0
        self.escenario_actual: str = "nominal"
        self.valores_actuales: dict[str, float] = dict(ESCENARIOS_OBJETIVO["nominal"]["base"])
        self._objetivo_actual: dict[str, float] = dict(ESCENARIOS_OBJETIVO["nominal"]["base"])
        self._ruido_actual: dict[str, float] = dict(ESCENARIOS_OBJETIVO["nominal"]["ruido"])

    def _activar_escenario(self, nombre_escenario: str, inmediato: bool = True) -> None:
        """Cambia el perfil fisiológico objetivo y opcionalmente aplica salto agudo."""
        if nombre_escenario not in ESCENARIOS_OBJETIVO:
            raise ValueError(f"Escenario desconocido: {nombre_escenario}")
        self.escenario_actual = nombre_escenario
        cfg = ESCENARIOS_OBJETIVO[nombre_escenario]
        self._objetivo_actual = dict(cfg["base"])
        self._ruido_actual = dict(cfg["ruido"])
        if inmediato:
            # Transición aguda inmediata (80% hacia el objetivo) manteniendo continuidad
            for var in FEATURE_NAMES:
                actual = self.valores_actuales[var]
                objetivo = self._objetivo_actual[var]
                self.valores_actuales[var] = actual + 0.85 * (objetivo - actual)

    def restaurar_nominal(self, inmediato: bool = True) -> None:
        """Restaura los parámetros fisiológicos a límites nominales NASA-STD-3001."""
        self._activar_escenario("nominal", inmediato=inmediato)

    def inyectar_hipoxia(self, critica: bool = True, inmediato: bool = True) -> None:
        """Inyecta caída de SpO2 con taquipnea y taquicardia compensatoria."""
        esc = "hipoxia_critica" if critica else "hipoxia_preventiva"
        self._activar_escenario(esc, inmediato=inmediato)

    def inyectar_fatiga_severa(self, critica: bool = True, inmediato: bool = True) -> None:
        """Inyecta deterioro agudo de eficiencia de sueño y alteración autonómica."""
        esc = "fatiga_severa_critica" if critica else "fatiga_preventiva"
        self._activar_escenario(esc, inmediato=inmediato)

    def inyectar_sobrecarga_cardiovascular(self, critica: bool = True, inmediato: bool = True) -> None:
        """Inyecta taquicardia, hipertensión sistólica y anomalía ECG elevada."""
        esc = (
            "sobrecarga_cardiovascular_critica"
            if critica
            else "sobrecarga_cardiovascular_preventiva"
        )
        self._activar_escenario(esc, inmediato=inmediato)

    def inyectar_estres_termico(self, inmediato: bool = True) -> None:
        """Inyecta hipertermia con sobrecarga hemodinámica."""
        self._activar_escenario("estres_termico_critico", inmediato=inmediato)

    def obtener_estado_escenario(self) -> dict[str, Any]:
        """Devuelve metadatos del escenario activo."""
        return {
            "escenario": self.escenario_actual,
            "tick": self._tick,
        }

    def leer_sensores(self) -> dict[str, float]:
        """
        Avanza un paso temporal la fisiología simulada y retorna un diccionario
        con exactamente las 9 claves del contrato de datos.
        """
        self._tick += 1
        fase_resp = math.sin(self._tick * 0.45)
        fase_circ = math.cos(self._tick * 0.12)

        lectura: dict[str, float] = {}
        for var in FEATURE_NAMES:
            actual = self.valores_actuales[var]
            objetivo = self._objetivo_actual[var]
            sigma = self._ruido_actual[var]

            # Relajación autoregresiva + modulación fisiológica leve + ruido gaussiano
            modulacion = 0.0
            if var == "frec_cardiaca":
                modulacion = 1.6 * fase_resp + 1.2 * fase_circ
            elif var == "frec_respiratoria":
                modulacion = 0.35 * fase_resp
            elif var == "presion_sistolica":
                modulacion = 1.1 * fase_circ

            nuevo = actual + self._suavizado * (objetivo - actual) + modulacion + float(self._rng.normal(0.0, sigma))
            lim_min, lim_max = LIMITES_FISICOS[var]
            nuevo = float(np.clip(nuevo, lim_min, lim_max))
            self.valores_actuales[var] = nuevo

            dec = PRECISION_SALIDA[var]
            val_out = round(nuevo, dec)
            lectura[var] = float(val_out)

        return lectura
