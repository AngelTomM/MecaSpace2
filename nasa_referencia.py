"""
Módulo de respaldo científico y referencia fisiológica NASA para tránsito a Marte.

Integra:
1. Estándares NASA-STD-3001 Vol. 1 Rev. C (2023) y Vol. 2 Rev. E (2025) cargados
   desde `data/nasa_thresholds.json`.
2. Distinción explícita entre arquitectura instrumental del equipo (Astroskin,
   Actiwatch Spectrum, glucómetro externo y autorreporte) y requisitos oficiales
   de la normativa NASA, sin atribuir homologación comercial inexistente.
3. Reglas deterministas previas al árbol de decisión para garantizar detección
   instantánea de cuadros agudos (hipotermia central < 35 °C, SpO2 < 90 %,
   bradicardia/taquicardia extrema, hipoglucemia severa o fallo atmosférico).
4. Referencias públicas de NASA OSDR / GeneLab con respaldo offline automático.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

try:
    import requests
except ImportError:
    requests = None

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
THRESHOLDS_PATH = DATA_DIR / "nasa_thresholds.json"
OSDR_CACHE_PATH = DATA_DIR / "osdr_referencia.json"
TELEMETRY_BASE_PATH = DATA_DIR / "telemetry_base.csv"

# Contrato de variables (9 wearables Astroskin/Actiwatch + 3 multimodales de la Consigna)
FEATURE_NAMES: list[str] = [
    "presion_sistolica",
    "temp_corporal",
    "nivel_actividad",
    "spo2",
    "frec_respiratoria",
    "vol_respiratorio",
    "frec_cardiaca",
    "anomalia_ecg",
    "eficiencia_sueno",
    "glucemia",
    "horas_sueno",
    "estado_animo",
]

# Los 6 indicadores centrales de la Consigna NASA Space Apps 2026
CONSIGNA_SIX_INDICATORS: list[str] = [
    "presion_sistolica",
    "frec_cardiaca",
    "glucemia",
    "temp_corporal",
    "horas_sueno",
    "estado_animo",
]

RISK_LABELS: dict[int, str] = {
    0: "Normal",
    1: "Preventivo",
    2: "Crítico",
}

# Jerarquía de 5 niveles + estado Stale (Vol. 2 Rev. E, Tabla 10.3-1 y Tabla F.5-1)
NASA_ALERT_LEVELS: dict[str, dict[str, str]] = {
    "Emergency": {
        "color_hex": "#DC2626",
        "label_es": "EMERGENCY (ROJO PARPADEANTE)",
        "criterio": "Amenaza vital; requiere acción y procedimientos inmediatos (Tabla 10.3-1).",
    },
    "Warning": {
        "color_hex": "#EF4444",
        "label_es": "WARNING (ROJO SÓLIDO)",
        "criterio": "Fallo o deterioro con potencial de escalar a amenaza vital; acción inmediata.",
    },
    "Caution": {
        "color_hex": "#F59E0B",
        "label_es": "CAUTION (AMARILLO)",
        "criterio": "Evento fuera de rango nominal que requiere atención, pero no acción inmediata.",
    },
    "Advisory": {
        "color_hex": "#3B82F6",
        "label_es": "ADVISORY (AZUL)",
        "criterio": "Aviso rutinario o recordatorio de medición multimodal (no alcanza Caution).",
    },
    "Nominal": {
        "color_hex": "#10B981",
        "label_es": "NOMINAL (VERDE)",
        "criterio": "Parámetros fisiológicos y ambientales dentro de banda nominal operativa.",
    },
    "Stale": {
        "color_hex": "#06B6D4",
        "label_es": "DATO OBSOLETO / FALTANTE (CIAN)",
        "criterio": "Telemetría o entrada manual desactualizada (Tabla F.5-1, V2 10020).",
    },
}

CABIN_ENV_NOMINAL: dict[str, float] = {
    "pi_o2_mmhg": 150.0,
    "ppco2_mmhg": 1.8,
    "cabin_temp_c": 22.4,
    "cabin_rh_pct": 46.0,
}

# Referencia de respaldo si `data/nasa_thresholds.json` no estuviera accesible
NASA_STD_3001_LIMITS: dict[str, dict[str, Any]] = {
    "presion_sistolica": {
        "unit": "mmHg",
        "sensor": "Astroskin (estimación) / manguito clínico",
        "normal": [105.0, 125.0],
        "preventivo_bajo": [90.0, 104.9],
        "preventivo_alto": [125.1, 145.0],
        "critico_bajo": 90.0,
        "critico_alto": 145.0,
    },
    "temp_corporal": {
        "unit": "°C",
        "sensor": "Astroskin (temperatura cutánea)",
        "normal": [35.6, 36.9],
        "preventivo_bajo": [34.8, 35.59],
        "preventivo_alto": [36.91, 37.6],
        "critico_bajo": 34.8,
        "critico_alto": 37.6,
    },
    "nivel_actividad": {
        "unit": "g-index",
        "sensor": "Actiwatch / Astroskin",
        "normal": [0.1, 1.8],
        "preventivo_alto": [1.81, 3.0],
        "critico_alto": 3.0,
    },
    "spo2": {
        "unit": "%",
        "sensor": "Astroskin",
        "normal": [96.0, 100.0],
        "preventivo_bajo": [92.0, 95.9],
        "critico_bajo": 92.0,
    },
    "frec_respiratoria": {
        "unit": "rpm",
        "sensor": "Astroskin",
        "normal": [12.0, 18.0],
        "preventivo_bajo": [9.0, 11.9],
        "preventivo_alto": [18.1, 24.0],
        "critico_bajo": 9.0,
        "critico_alto": 24.0,
    },
    "vol_respiratorio": {
        "unit": "L/min",
        "sensor": "Astroskin",
        "normal": [6.0, 10.5],
        "preventivo_bajo": [4.5, 5.9],
        "preventivo_alto": [10.6, 16.0],
        "critico_bajo": 4.5,
        "critico_alto": 16.0,
    },
    "frec_cardiaca": {
        "unit": "lpm",
        "sensor": "Astroskin",
        "normal": [55.0, 95.0],
        "preventivo_bajo": [45.0, 54.9],
        "preventivo_alto": [95.1, 130.0],
        "critico_bajo": 45.0,
        "critico_alto": 130.0,
    },
    "anomalia_ecg": {
        "unit": "índice 0-1",
        "sensor": "Astroskin",
        "normal": [0.0, 0.15],
        "preventivo_alto": [0.16, 0.35],
        "critico_alto": 0.35,
    },
    "eficiencia_sueno": {
        "unit": "%",
        "sensor": "Actiwatch Spectrum",
        "normal": [80.0, 100.0],
        "preventivo_bajo": [65.0, 79.9],
        "critico_bajo": 65.0,
    },
    "glucemia": {
        "unit": "mg/dL",
        "sensor": "Entrada manual / glucómetro externo",
        "normal": [70.0, 140.0],
        "preventivo_bajo": [55.0, 69.9],
        "preventivo_alto": [140.1, 200.0],
        "critico_bajo": 55.0,
        "critico_alto": 200.0,
    },
    "horas_sueno": {
        "unit": "h",
        "sensor": "Actiwatch Spectrum",
        "normal": [7.5, 9.5],
        "preventivo_bajo": [6.0, 7.49],
        "critico_bajo": 6.0,
    },
    "estado_animo": {
        "unit": "pts (1-10)",
        "sensor": "Autorreporte multimodal",
        "normal": [6.5, 10.0],
        "preventivo_bajo": [4.5, 6.49],
        "critico_bajo": 4.5,
    },
}

OSDR_STUDIES_CATALOG: dict[str, dict[str, Any]] = {
    "OSD-530": {
        "study_id": "OSD-530",
        "title": "Inspiration4 Commercial Spaceflight Crew Biometrics and Physiological Telemetry",
        "platform": "Astroskin / Wearable Biometric Shirt & Smart Watch",
        "variables_cubiertas": [
            "frec_cardiaca",
            "frec_respiratoria",
            "vol_respiratorio",
            "spo2",
            "temp_corporal",
            "anomalia_ecg",
            "nivel_actividad",
        ],
        "url": "https://osdr.nasa.gov/bio/repo/data/studies/OSD-530",
    },
    "OSD-356": {
        "study_id": "OSD-356",
        "title": "Spaceflight Sleep Architecture, Circadian Desynchrony and Actigraphy Monitoring",
        "platform": "Actiwatch Spectrum",
        "variables_cubiertas": ["eficiencia_sueno", "horas_sueno", "nivel_actividad", "estado_animo"],
        "url": "https://osdr.nasa.gov/bio/repo/data/studies/OSD-356",
    },
    "OSD-479": {
        "study_id": "OSD-479",
        "title": "Microgravity Analog Cardiovascular Deconditioning and Autonomic Regulation",
        "platform": "Ambulatory Blood Pressure, Metabolic & ECG Telemetry",
        "variables_cubiertas": ["presion_sistolica", "frec_cardiaca", "anomalia_ecg", "glucemia"],
        "url": "https://osdr.nasa.gov/bio/repo/data/studies/OSD-479",
    },
}

OSDR_BASELINE_STATS: dict[str, dict[str, float]] = {
    "presion_sistolica": {"mean": 116.5, "std": 5.2, "min": 75.0, "max": 190.0},
    "temp_corporal": {"mean": 36.25, "std": 0.28, "min": 33.4, "max": 39.0},
    "nivel_actividad": {"mean": 0.65, "std": 0.35, "min": 0.05, "max": 4.2},
    "spo2": {"mean": 98.1, "std": 0.9, "min": 80.0, "max": 100.0},
    "frec_respiratoria": {"mean": 15.0, "std": 1.6, "min": 6.0, "max": 34.0},
    "vol_respiratorio": {"mean": 8.0, "std": 1.1, "min": 3.0, "max": 20.0},
    "frec_cardiaca": {"mean": 73.0, "std": 8.5, "min": 34.0, "max": 175.0},
    "anomalia_ecg": {"mean": 0.05, "std": 0.035, "min": 0.0, "max": 0.90},
    "eficiencia_sueno": {"mean": 87.5, "std": 4.5, "min": 40.0, "max": 99.0},
    "glucemia": {"mean": 96.0, "std": 12.0, "min": 45.0, "max": 320.0},
    "horas_sueno": {"mean": 8.4, "std": 0.45, "min": 3.0, "max": 10.5},
    "estado_animo": {"mean": 8.1, "std": 0.85, "min": 1.0, "max": 10.0},
}


def estimar_temp_central(temp_piel: float, nivel_actividad: float = 0.65) -> float:
    """
    Estima la temperatura corporal central (°C) a partir de la temperatura cutánea
    de Astroskin (`temp_corporal`) y el nivel de actividad.

    NASA-STD-3001 Vol. 1 Apéndice C fija hipotermia en < 35,0 °C central (normal ≈ 37,0 °C),
    mientras que Vol. 2 Rev. E V2 11011 distingue variaciones cutáneas (+1,4 °C) de centrales (+0,6 °C).
    """
    ajuste_actividad = 0.10 * max(0.0, float(nivel_actividad) - 0.8)
    temp_central = float(temp_piel) + 0.65 - ajuste_actividad
    return round(temp_central, 2)


def evaluar_reglas_deterministas_criticas(
    registro: dict[str, float],
    cabin_env: dict[str, float] | None = None,
    emergencia_manual: bool = False,
) -> dict[str, Any]:
    """
    Capa determinista previa al árbol de decisión (Sugerencia de Ajuste 1 - Informe.md).

    Garantiza que ningún cuadro agudo quede subclasificado por limitaciones de datos
    sintéticos y mantiene latencia de decisión determinista sub-milisegundo (≤ 1,0 s
    según Tabla 10.2-1 de NASA-STD-3001 Vol. 2 Rev. E).
    """
    razones: list[str] = []
    es_emergency = False
    excede_alcance = False

    temp_piel = float(registro["temp_corporal"])
    act = float(registro["nivel_actividad"])
    temp_central = estimar_temp_central(temp_piel, act)
    spo2 = float(registro["spo2"])
    fc = float(registro["frec_cardiaca"])
    ps = float(registro["presion_sistolica"])
    ecg = float(registro["anomalia_ecg"])
    gluc = float(registro["glucemia"])

    if emergencia_manual:
        es_emergency = True
        excede_alcance = True
        razones.append("Activación manual directa de emergencia (V2 10178): posible dolor torácico o colapso.")

    if temp_central < 35.0:
        es_emergency = True
        excede_alcance = True
        razones.append(
            f"Hipotermia central estimada crítica ({temp_central:.2f} °C < 35,0 °C, Vol. 1 Apéndice C; piel={temp_piel:.2f} °C)."
        )
    elif temp_central > 38.6:
        es_emergency = True
        excede_alcance = True
        razones.append(
            f"Hipertermia central estimada crítica ({temp_central:.2f} °C > 38,6 °C; piel={temp_piel:.2f} °C, V2 11011)."
        )

    if spo2 < 90.0:
        es_emergency = True
        excede_alcance = True
        razones.append(f"Hipoxemia severa determinista (SpO₂={spo2:.1f} % < 90,0 %).")

    if fc < 40.0 or fc > 150.0:
        es_emergency = True
        excede_alcance = True
        razones.append(f"Bradicardia o taquicardia extrema determinista (FC={fc:.0f} lpm).")
    elif fc > 140.0 and ecg > 0.25:
        es_emergency = True
        excede_alcance = True
        razones.append(f"Taquiarritmia de alto riesgo (FC={fc:.0f} lpm > 140 lpm [ref. V2 11011] + ECG={ecg:.2f}).")

    if ps < 80.0 or ps >= 180.0:
        es_emergency = True
        excede_alcance = True
        razones.append(f"Crisis hemodinámica determinista (PAS={ps:.1f} mmHg).")

    if ecg > 0.55:
        es_emergency = True
        excede_alcance = True
        razones.append(f"Anomalía ECG severa determinista (índice={ecg:.3f} > 0,55; escalar a V1 3004.i).")

    if gluc < 54.0:
        es_emergency = True
        excede_alcance = True
        razones.append(f"Hipoglucemia severa neuroglucopénica ({gluc:.0f} mg/dL < 54 mg/dL).")
    elif gluc > 300.0:
        es_emergency = True
        excede_alcance = True
        razones.append(f"Hiperglucemia severa determinista ({gluc:.0f} mg/dL > 300 mg/dL).")

    if cabin_env:
        pi_o2 = float(cabin_env.get("pi_o2_mmhg", CABIN_ENV_NOMINAL["pi_o2_mmhg"]))
        ppco2 = float(cabin_env.get("ppco2_mmhg", CABIN_ENV_NOMINAL["ppco2_mmhg"]))
        if pi_o2 < 122.0:
            es_emergency = True
            excede_alcance = True
            razones.append(f"P_I O₂ de cabina debajo del mínimo absoluto 1 h ({pi_o2:.1f} < 122 mmHg, Tabla 6.2-1).")
        if ppco2 > 5.3:
            es_emergency = True
            excede_alcance = True
            razones.append(f"Hipercapnia crítica de cabina (ppCO₂={ppco2:.2f} > 5,3 mmHg, ref. V2 6004).")

    return {
        "disparada": len(razones) > 0,
        "nivel_nasa": "Emergency" if es_emergency else "Nominal",
        "razones": razones,
        "excede_alcance": excede_alcance,
        "temp_central_est": temp_central,
    }


def cargar_umbrales_nasa(ruta_json: Path | str = THRESHOLDS_PATH) -> dict[str, Any]:
    """Carga los límites oficiales y metadata desde `data/nasa_thresholds.json`."""
    ruta = Path(ruta_json)
    if ruta.exists() and ruta.stat().st_size > 0:
        with ruta.open("r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "metadata": {
            "standard": "NASA-STD-3001 Vol. 1 Rev. C / Vol. 2 Rev. E",
            "sensors": ["Astroskin Bio-Monitor", "Actiwatch Spectrum", "Glucómetro / Manual"],
            "communication_latency_min": 20,
            "risk_classes": {str(k): v for k, v in RISK_LABELS.items()},
        },
        "biomarkers": NASA_STD_3001_LIMITS,
        "cabin_environment": {},
        "synergistic_critical_rules": [],
    }


def _fetch_osdr_study_meta(study_id: str, timeout: float = 4.0) -> dict[str, Any] | None:
    """Consulta el endpoint público de metadatos de NASA OSDR para un estudio."""
    url = f"https://osdr.nasa.gov/osdr/data/osd/meta/{study_id}"
    try:
        if requests is not None:
            resp = requests.get(url, timeout=timeout)
            if resp.status_code == 200:
                payload = resp.json()
            else:
                return None
        else:
            req = urllib.request.Request(url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                if resp.status != 200:
                    return None
                payload = json.loads(resp.read().decode("utf-8"))

        study_block = payload.get("study", {}).get(study_id, {})
        if not study_block:
            return None
        studies_list = study_block.get("studies", [])
        title = studies_list[0].get("title") if studies_list else None
        description = studies_list[0].get("description") if studies_list else None
        return {
            "study_id": study_id,
            "api_title": title,
            "api_description_snippet": (description[:260] + "...") if description and len(description) > 260 else description,
            "fetched_online": True,
        }
    except (OSError, ValueError, urllib.error.URLError, Exception):
        return None


def obtener_referencias_osdr(
    forzar_red: bool = False,
    ruta_cache: Path | str = OSDR_CACHE_PATH,
) -> dict[str, Any]:
    """Obtiene metadatos y distribuciones base de NASA OSDR con caché local offline."""
    cache_path = Path(ruta_cache)
    cache_path.parent.mkdir(parents=True, exist_ok=True)

    if cache_path.exists() and cache_path.stat().st_size > 0 and not forzar_red:
        with cache_path.open("r", encoding="utf-8") as f:
            data = json.load(f)
            data["source_mode"] = "local_cache"
            return data

    estudios_actualizados: dict[str, dict[str, Any]] = {}
    online_hits = 0
    for sid, meta in OSDR_STUDIES_CATALOG.items():
        merged = dict(meta)
        remoto = _fetch_osdr_study_meta(sid)
        if remoto:
            merged.update(remoto)
            online_hits += 1
        else:
            merged["fetched_online"] = False
        estudios_actualizados[sid] = merged

    referencia = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "source_mode": "online_osdr_api" if online_hits > 0 else "offline_scientific_fallback",
        "online_studies_fetched": online_hits,
        "standard": "NASA-STD-3001 Vol. 1 Rev. C & Vol. 2 Rev. E",
        "studies": estudios_actualizados,
        "baseline_distributions": OSDR_BASELINE_STATS,
    }

    with cache_path.open("w", encoding="utf-8") as f:
        json.dump(referencia, f, indent=2, ensure_ascii=False)

    return referencia


def asegurar_telemetry_base(
    ruta_csv: Path | str = TELEMETRY_BASE_PATH,
    n_muestras: int = 120,
    seed: int = 42,
) -> pd.DataFrame:
    """
    Garantiza que `data/telemetry_base.csv` contenga las 12 variables calibradas
    para tránsito interplanetario a Marte (microgravedad, sueño 8.5 h V1 6001).
    """
    csv_path = Path(ruta_csv)
    csv_path.parent.mkdir(parents=True, exist_ok=True)

    if csv_path.exists() and csv_path.stat().st_size > 0:
        df = pd.read_csv(csv_path)
        if (
            all(col in df.columns for col in FEATURE_NAMES)
            and len(df) > 0
            and float(df["temp_corporal"].mean()) <= 36.8
        ):
            return df

    rng = np.random.default_rng(seed)
    umbrales = cargar_umbrales_nasa()["biomarkers"]

    actividad = np.clip(rng.normal(0.65, 0.28, n_muestras), 0.15, 1.65)
    horas_sueno = np.clip(rng.normal(8.4, 0.42, n_muestras), 7.6, 9.4)
    sueno = np.clip(rng.normal(88.0, 3.8, n_muestras), 80.5, 97.0)
    estres_basal = np.clip((90.0 - sueno) / 20.0, 0.0, 0.6)

    fc = np.clip(
        66.0 + 13.0 * actividad + 5.0 * estres_basal + rng.normal(0.0, 3.5, n_muestras),
        umbrales["frec_cardiaca"]["normal"][0] + 1.0,
        umbrales["frec_cardiaca"]["normal"][1] - 1.0,
    )
    fr = np.clip(
        13.5 + 2.2 * actividad + rng.normal(0.0, 0.9, n_muestras),
        umbrales["frec_respiratoria"]["normal"][0] + 0.2,
        umbrales["frec_respiratoria"]["normal"][1] - 0.2,
    )
    vr = np.clip(
        6.8 + 1.8 * actividad + 0.12 * (fr - 15.0) + rng.normal(0.0, 0.45, n_muestras),
        umbrales["vol_respiratorio"]["normal"][0] + 0.2,
        umbrales["vol_respiratorio"]["normal"][1] - 0.2,
    )
    ps = np.clip(
        114.0 + 4.5 * actividad + 0.15 * (fc - 72.0) + rng.normal(0.0, 2.8, n_muestras),
        umbrales["presion_sistolica"]["normal"][0] + 1.0,
        umbrales["presion_sistolica"]["normal"][1] - 1.0,
    )
    # Temperatura cutánea ASTROSKIN (~36.25 °C en reposo -> ~36.9 °C central estimada)
    temp = np.clip(
        36.15 + 0.18 * actividad + rng.normal(0.0, 0.15, n_muestras),
        umbrales["temp_corporal"]["normal"][0] + 0.05,
        umbrales["temp_corporal"]["normal"][1] - 0.05,
    )
    spo2 = np.clip(
        98.3 - 0.3 * actividad + rng.normal(0.0, 0.6, n_muestras),
        umbrales["spo2"]["normal"][0] + 0.2,
        umbrales["spo2"]["normal"][1],
    )
    ecg = np.clip(
        0.04 + 0.025 * estres_basal + np.abs(rng.normal(0.0, 0.02, n_muestras)),
        0.0,
        umbrales["anomalia_ecg"]["normal"][1] - 0.01,
    )
    glucemia = np.clip(
        95.0 + 10.0 * estres_basal + rng.normal(0.0, 10.0, n_muestras),
        umbrales["glucemia"]["normal"][0] + 2.0,
        umbrales["glucemia"]["normal"][1] - 5.0,
    )
    animo = np.clip(
        8.2 - 1.0 * estres_basal + rng.normal(0.0, 0.65, n_muestras),
        umbrales["estado_animo"]["normal"][0] + 0.2,
        umbrales["estado_animo"]["normal"][1],
    )

    df_base = pd.DataFrame(
        {
            "presion_sistolica": np.round(ps, 2),
            "temp_corporal": np.round(temp, 2),
            "nivel_actividad": np.round(actividad, 3),
            "spo2": np.round(spo2, 2),
            "frec_respiratoria": np.round(fr, 2),
            "vol_respiratorio": np.round(vr, 2),
            "frec_cardiaca": np.round(fc, 1),
            "anomalia_ecg": np.round(ecg, 3),
            "eficiencia_sueno": np.round(sueno, 1),
            "glucemia": np.round(glucemia, 1),
            "horas_sueno": np.round(horas_sueno, 2),
            "estado_animo": np.round(animo, 1),
        }
    )
    df_base.to_csv(csv_path, index=False)
    return df_base


def _evaluar_condicion_simple(registro: dict[str, float], expresion: str) -> bool:
    """Evalúa una cláusula simple tipo `spo2 < 95.0` sin usar `eval`."""
    partes = expresion.strip().split()
    if len(partes) != 3:
        return False
    campo, operador, valor_str = partes
    if campo not in registro:
        return False
    val = float(registro[campo])
    umbral = float(valor_str)
    if operador == "<":
        return val < umbral
    if operador == "<=":
        return val <= umbral
    if operador == ">":
        return val > umbral
    if operador == ">=":
        return val >= umbral
    if operador == "==":
        return val == umbral
    return False


def evaluar_registro_nasa_std_3001(
    registro: dict[str, float],
    thresholds_data: dict[str, Any] | None = None,
) -> tuple[int, list[str]]:
    """
    Evalúa un vector de 12 biomarcadores contra `data/nasa_thresholds.json`.

    Retorna `(estado_riesgo, razones)` donde `0: Normal`, `1: Preventivo`, `2: Crítico`.
    """
    data = thresholds_data or cargar_umbrales_nasa()
    biomarkers = data["biomarkers"]
    reglas_sinergicas = data.get("synergistic_critical_rules", [])

    razones_criticas: list[str] = []
    razones_preventivas: list[str] = []

    det = evaluar_reglas_deterministas_criticas(registro)
    if det["disparada"]:
        razones_criticas.extend(det["razones"])

    for regla in reglas_sinergicas:
        trigger = regla.get("trigger", "")
        clausulas = [c.strip() for c in trigger.split("AND") if c.strip()]
        if clausulas and all(_evaluar_condicion_simple(registro, c) for c in clausulas):
            razones_criticas.append(f"Regla sinérgica: {regla.get('condition', 'Crítico')}")

    for var in FEATURE_NAMES:
        val = float(registro[var])
        lim = biomarkers[var]

        crit_bajo = lim.get("critico_bajo")
        crit_alto = lim.get("critico_alto")
        normal_min, normal_max = lim["normal"]

        if crit_bajo is not None and val < float(crit_bajo):
            razones_criticas.append(f"{var} crítico bajo ({val} < {crit_bajo})")
        elif crit_alto is not None and val > float(crit_alto):
            razones_criticas.append(f"{var} crítico alto ({val} > {crit_alto})")
        elif var == "nivel_actividad" and 0.0 <= val <= float(normal_max):
            continue
        elif not (float(normal_min) <= val <= float(normal_max)):
            razones_preventivas.append(f"{var} fuera de rango nominal ({val})")

    if razones_criticas:
        return 2, razones_criticas
    if razones_preventivas:
        return 1, razones_preventivas
    return 0, ["Todos los biomarcadores dentro de límites operativos nominales"]


if __name__ == "__main__":
    ref = obtener_referencias_osdr(forzar_red=False)
    df_base = asegurar_telemetry_base()
    print(f"[NASA REF] Modo de obtención OSDR: {ref['source_mode']}")
    print(f"[NASA REF] Estudios referenciados: {', '.join(ref['studies'].keys())}")
    print(f"[NASA REF] Registros base en telemetry_base.csv: {len(df_base)} ({len(FEATURE_NAMES)} variables)")
