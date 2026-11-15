"""
Generador de dataset sintético calibrado (5.000 registros) para entrenamiento.

Vincula:
- Parámetros y correlaciones fisiológicas base desde `nasa_referencia.py` (NASA OSDR).
- Etiquetado determinista leyendo explícitamente `data/nasa_thresholds.json`
  (umbrales NASA-STD-3001 y reglas sinérgicas críticas).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from nasa_referencia import (
    FEATURE_NAMES,
    RISK_LABELS,
    asegurar_telemetry_base,
    obtener_referencias_osdr,
)

BASE_DIR = Path(__file__).resolve().parent
THRESHOLDS_PATH = BASE_DIR / "data" / "nasa_thresholds.json"
DATASET_OUTPUT_PATH = BASE_DIR / "dataset_salud.csv"
N_REGISTROS_TOTAL = 5000


def cargar_umbrales_json(ruta: Path | str = THRESHOLDS_PATH) -> dict[str, Any]:
    """Lee directamente el archivo `data/nasa_thresholds.json`."""
    ruta_path = Path(ruta)
    if not ruta_path.exists():
        raise FileNotFoundError(f"No se encontró el archivo de umbrales NASA: {ruta_path}")
    with ruta_path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _evaluar_clausula(fila: dict[str, float], clausula: str) -> bool:
    """Evalúa una expresión simple de regla sinérgica (ej. `spo2 < 95.0`)."""
    partes = clausula.strip().split()
    if len(partes) != 3:
        return False
    campo, op, valor_str = partes
    if campo not in fila:
        return False
    v = float(fila[campo])
    u = float(valor_str)
    if op == "<":
        return v < u
    if op == "<=":
        return v <= u
    if op == ">":
        return v > u
    if op == ">=":
        return v >= u
    if op == "==":
        return v == u
    return False


def etiquetar_registro_desde_json(
    fila: dict[str, float],
    thresholds_json: dict[str, Any],
) -> int:
    """
    Etiqueta un registro (`0: Normal`, `1: Preventivo`, `2: Crítico`)
    estrictamente a partir de las reglas de `data/nasa_thresholds.json`.
    """
    biomarkers = thresholds_json["biomarkers"]
    reglas_sinergicas = thresholds_json.get("synergistic_critical_rules", [])

    # 1. Evaluar reglas sinérgicas críticas
    for regla in reglas_sinergicas:
        trigger = regla.get("trigger", "")
        clausulas = [c.strip() for c in trigger.split("AND") if c.strip()]
        if clausulas and all(_evaluar_clausula(fila, c) for c in clausulas):
            return int(regla.get("assigned_class", 2))

    # 2. Evaluar límites individuales de NASA-STD-3001
    es_preventivo = False
    for var in FEATURE_NAMES:
        val = float(fila[var])
        lim = biomarkers[var]

        crit_bajo = lim.get("critico_bajo")
        crit_alto = lim.get("critico_alto")
        norm_min, norm_max = lim["normal"]

        if crit_bajo is not None and val < float(crit_bajo):
            return 2
        if crit_alto is not None and val > float(crit_alto):
            return 2

        if var == "nivel_actividad":
            # En reposo profundo (<0.1) no se considera desviación preventiva por sí sola
            if val > float(norm_max):
                es_preventivo = True
        else:
            if not (float(norm_min) <= val <= float(norm_max)):
                es_preventivo = True

    return 1 if es_preventivo else 0


def _generar_bloque_nominal(
    n: int,
    rng: np.random.Generator,
    base_df: pd.DataFrame,
    umbrales: dict[str, Any],
) -> list[dict[str, float]]:
    """Genera muestras nominales ancladas en `telemetry_base.csv` y límites normales."""
    b = umbrales["biomarkers"]
    indices = rng.integers(0, len(base_df), size=n)
    muestras: list[dict[str, float]] = []

    for idx in indices:
        ref = base_df.iloc[idx]
        act = float(np.clip(ref["nivel_actividad"] + rng.normal(0.0, 0.18), 0.12, 1.75))
        sueno = float(np.clip(ref["eficiencia_sueno"] + rng.normal(0.0, 2.5), 80.2, 98.5))
        fc = float(np.clip(ref["frec_cardiaca"] + 6.0 * (act - 0.65) + rng.normal(0.0, 3.2), b["frec_cardiaca"]["normal"][0] + 0.5, b["frec_cardiaca"]["normal"][1] - 0.5))
        fr = float(np.clip(ref["frec_respiratoria"] + 1.2 * (act - 0.65) + rng.normal(0.0, 0.7), b["frec_respiratoria"]["normal"][0] + 0.1, b["frec_respiratoria"]["normal"][1] - 0.1))
        vr = float(np.clip(ref["vol_respiratorio"] + 1.0 * (act - 0.65) + rng.normal(0.0, 0.4), b["vol_respiratorio"]["normal"][0] + 0.1, b["vol_respiratorio"]["normal"][1] - 0.1))
        ps = float(np.clip(ref["presion_sistolica"] + 0.12 * (fc - 72.0) + rng.normal(0.0, 2.6), b["presion_sistolica"]["normal"][0] + 0.5, b["presion_sistolica"]["normal"][1] - 0.5))
        temp = float(np.clip(ref["temp_corporal"] + 0.08 * (act - 0.65) + rng.normal(0.0, 0.12), b["temp_corporal"]["normal"][0] + 0.05, b["temp_corporal"]["normal"][1] - 0.05))
        spo2 = float(np.clip(ref["spo2"] + rng.normal(0.0, 0.5), b["spo2"]["normal"][0] + 0.1, 100.0))
        ecg = float(np.clip(ref["anomalia_ecg"] + np.abs(rng.normal(0.0, 0.018)), 0.0, b["anomalia_ecg"]["normal"][1] - 0.005))

        muestras.append({
            "presion_sistolica": ps,
            "temp_corporal": temp,
            "nivel_actividad": act,
            "spo2": spo2,
            "frec_respiratoria": fr,
            "vol_respiratorio": vr,
            "frec_cardiaca": fc,
            "anomalia_ecg": ecg,
            "eficiencia_sueno": sueno,
        })
    return muestras


def _generar_bloque_preventivo(n: int, rng: np.random.Generator) -> list[dict[str, float]]:
    """Genera escenarios preventivos (banda amarilla NASA-STD-3001)."""
    muestras: list[dict[str, float]] = []
    subtipos = [
        "hipoxia_leve",
        "sobrecarga_cv_moderada",
        "fatiga_circadiana",
        "estres_termico_leve",
        "hipotension_bradicardia",
        "hiperventilacion_esfuerzo",
    ]
    for i in range(n):
        tipo = subtipos[i % len(subtipos)]
        # Partir de un estado basal saludable
        ps = float(rng.uniform(107.0, 123.0))
        temp = float(rng.uniform(36.4, 37.2))
        act = float(rng.uniform(0.25, 1.5))
        spo2 = float(rng.uniform(96.3, 99.6))
        fr = float(rng.uniform(12.5, 17.5))
        vr = float(rng.uniform(6.3, 10.0))
        fc = float(rng.uniform(58.0, 92.0))
        ecg = float(rng.uniform(0.01, 0.13))
        sueno = float(rng.uniform(81.0, 95.0))

        if tipo == "hipoxia_leve":
            spo2 = float(rng.uniform(92.3, 95.7))
            fr = float(rng.uniform(18.2, 22.8))
            fc = float(rng.uniform(95.5, 109.0))  # Debajo de 110 para no disparar regla sinérgica crítica
            vr = float(rng.uniform(10.6, 13.8))
        elif tipo == "sobrecarga_cv_moderada":
            fc = float(rng.uniform(96.0, 124.0))
            ps = float(rng.uniform(126.0, 143.0))
            ecg = float(rng.uniform(0.16, 0.31))
            act = float(rng.uniform(1.6, 2.5))
        elif tipo == "fatiga_circadiana":
            sueno = float(rng.uniform(66.0, 79.2))
            ecg = float(rng.uniform(0.16, 0.28))
            fc = float(rng.uniform(86.0, 99.5))  # Mantiene combinación por debajo de regla crítica
        elif tipo == "estres_termico_leve":
            temp = float(rng.uniform(37.5, 38.1))
            fc = float(rng.uniform(95.5, 114.0))
            ps = float(rng.uniform(94.0, 104.5)) if rng.random() < 0.5 else float(rng.uniform(125.5, 134.0))
            vr = float(rng.uniform(10.6, 12.8))
        elif tipo == "hipotension_bradicardia":
            ps = float(rng.uniform(91.0, 104.2))
            fc = float(rng.uniform(46.0, 54.4))
            temp = float(rng.uniform(35.6, 36.2))
        else:  # hiperventilacion_esfuerzo
            act = float(rng.uniform(1.85, 2.85))
            fr = float(rng.uniform(18.5, 23.5))
            vr = float(rng.uniform(10.8, 15.5))
            fc = float(rng.uniform(96.0, 125.0))

        muestras.append({
            "presion_sistolica": ps,
            "temp_corporal": temp,
            "nivel_actividad": act,
            "spo2": spo2,
            "frec_respiratoria": fr,
            "vol_respiratorio": vr,
            "frec_cardiaca": fc,
            "anomalia_ecg": ecg,
            "eficiencia_sueno": sueno,
        })
    return muestras


def _generar_bloque_critico(n: int, rng: np.random.Generator) -> list[dict[str, float]]:
    """
    Genera escenarios críticos (banda roja NASA-STD-3001 y reglas sinérgicas).
    """
    muestras: list[dict[str, float]] = []
    subtipos = [
        "hipoxia_aguda",
        "hipoxia_compensada_sinergica",
        "sobrecarga_cv_aguda",
        "fatiga_circadiana_sinergica",
        "estres_termico_sinergico",
        "hipertermia_aislada_critica",
        "hipotermia_depresion_resp",
        "arritmia_convulsion",
    ]
    for i in range(n):
        tipo = subtipos[i % len(subtipos)]
        ps = float(rng.uniform(108.0, 124.0))
        temp = float(rng.uniform(36.5, 37.3))
        act = float(rng.uniform(0.3, 1.6))
        spo2 = float(rng.uniform(96.0, 99.2))
        fr = float(rng.uniform(13.0, 17.5))
        vr = float(rng.uniform(6.5, 10.2))
        fc = float(rng.uniform(65.0, 90.0))
        ecg = float(rng.uniform(0.02, 0.14))
        sueno = float(rng.uniform(80.5, 93.0))

        if tipo == "hipoxia_aguda":
            spo2 = float(rng.uniform(83.0, 91.8))
            fr = float(rng.uniform(24.2, 31.0)) if rng.random() < 0.7 else float(rng.uniform(6.5, 8.8))
            vr = float(rng.uniform(3.2, 4.4)) if fr < 9.0 else float(rng.uniform(14.5, 18.5))
            fc = float(rng.uniform(118.0, 146.0))
        elif tipo == "hipoxia_compensada_sinergica":
            # Regla sinérgica: spo2 < 95.0 AND frec_respiratoria > 20.0 AND frec_cardiaca > 110.0
            spo2 = float(rng.uniform(92.2, 94.8))
            fr = float(rng.uniform(20.4, 23.8))
            fc = float(rng.uniform(111.0, 128.5))
            vr = float(rng.uniform(11.5, 15.5))
        elif tipo == "sobrecarga_cv_aguda":
            fc = float(rng.uniform(131.5, 162.0))
            ps = float(rng.uniform(146.0, 172.0))
            ecg = float(rng.uniform(0.36, 0.78))
            act = float(rng.uniform(1.8, 3.3))
        elif tipo == "fatiga_circadiana_sinergica":
            # Regla sinérgica: eficiencia_sueno < 72.0 AND anomalia_ecg > 0.20 AND frec_cardiaca > 100.0
            sueno = float(rng.uniform(50.0, 71.5))
            ecg = float(rng.uniform(0.21, 0.45))
            fc = float(rng.uniform(101.0, 126.0))
            ps = float(rng.uniform(92.0, 106.0))
        elif tipo == "estres_termico_sinergico":
            # Regla sinérgica: temp_corporal > 37.8 AND presion_sistolica > 135.0 AND frec_cardiaca > 115.0
            temp = float(rng.uniform(37.85, 39.2))
            ps = float(rng.uniform(136.0, 156.0))
            fc = float(rng.uniform(116.0, 142.0))
            vr = float(rng.uniform(12.0, 16.8))
        elif tipo == "hipertermia_aislada_critica":
            # Umbral individual crítico: temp_corporal > 38.2 con taquicardia moderada
            temp = float(rng.uniform(38.23, 39.4))
            fc = float(rng.uniform(98.0, 134.0))
            ps = float(rng.uniform(98.0, 144.0))
            vr = float(rng.uniform(10.5, 15.2))
        elif tipo == "hipotermia_depresion_resp":
            temp = float(rng.uniform(34.5, 35.4))
            fc = float(rng.uniform(38.0, 44.5))
            ps = float(rng.uniform(78.0, 89.2))
            fr = float(rng.uniform(6.5, 8.8))
            vr = float(rng.uniform(3.2, 4.4))
        else:  # arritmia_convulsion
            ecg = float(rng.uniform(0.37, 0.82))
            act = float(rng.uniform(3.05, 4.1))
            fc = float(rng.uniform(132.0, 158.0))
            sueno = float(rng.uniform(52.0, 64.5))

        muestras.append({
            "presion_sistolica": ps,
            "temp_corporal": temp,
            "nivel_actividad": act,
            "spo2": spo2,
            "frec_respiratoria": fr,
            "vol_respiratorio": vr,
            "frec_cardiaca": fc,
            "anomalia_ecg": ecg,
            "eficiencia_sueno": sueno,
        })
    return muestras


def generar_dataset(
    n_total: int = N_REGISTROS_TOTAL,
    seed: int = 42,
    ruta_salida: Path | str = DATASET_OUTPUT_PATH,
) -> pd.DataFrame:
    """
    Genera `dataset_salud.csv` con `n_total` registros calibrados y etiquetados
    directamente mediante `data/nasa_thresholds.json`.
    """
    rng = np.random.default_rng(seed)
    thresholds_json = cargar_umbrales_json(THRESHOLDS_PATH)
    obtener_referencias_osdr(forzar_red=False)
    base_df = asegurar_telemetry_base()

    n_nominal = int(n_total * 0.48)
    n_preventivo = int(n_total * 0.28)
    n_critico = n_total - n_nominal - n_preventivo

    registros = (
        _generar_bloque_nominal(n_nominal, rng, base_df, thresholds_json)
        + _generar_bloque_preventivo(n_preventivo, rng)
        + _generar_bloque_critico(n_critico, rng)
    )

    # Redondeo realista de sensores y etiquetado estricto desde nasa_thresholds.json
    filas_procesadas: list[dict[str, float | int]] = []
    for reg in registros:
        limpia = {
            "presion_sistolica": round(float(reg["presion_sistolica"]), 2),
            "temp_corporal": round(float(reg["temp_corporal"]), 2),
            "nivel_actividad": round(float(reg["nivel_actividad"]), 3),
            "spo2": round(float(reg["spo2"]), 2),
            "frec_respiratoria": round(float(reg["frec_respiratoria"]), 2),
            "vol_respiratorio": round(float(reg["vol_respiratorio"]), 2),
            "frec_cardiaca": round(float(reg["frec_cardiaca"]), 1),
            "anomalia_ecg": round(float(reg["anomalia_ecg"]), 3),
            "eficiencia_sueno": round(float(reg["eficiencia_sueno"]), 1),
        }
        etiqueta = etiquetar_registro_desde_json(limpia, thresholds_json)
        limpia["estado_riesgo"] = etiqueta
        filas_procesadas.append(limpia)

    df = pd.DataFrame(filas_procesadas, columns=FEATURE_NAMES + ["estado_riesgo"])
    df = df.sample(frac=1.0, random_state=seed).reset_index(drop=True)
    df.to_csv(ruta_salida, index=False)
    return df


if __name__ == "__main__":
    df_generado = generar_dataset()
    conteo = df_generado["estado_riesgo"].value_counts().sort_index()
    print(f"[GENERADOR] Dataset guardado en: {DATASET_OUTPUT_PATH} ({len(df_generado)} registros)")
    for clase_id, cantidad in conteo.items():
        nombre = RISK_LABELS.get(int(clase_id), str(clase_id))
        pct = 100.0 * cantidad / len(df_generado)
        print(f"  - Clase {clase_id} ({nombre}): {cantidad} ({pct:.1f}%)")
