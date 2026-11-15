"""
Entrenamiento y validación de XGBClassifier para clasificación de riesgo biomédico.

Prioriza la sensibilidad (recall) y tasa de falsos negativos sobre la clase
`2: Crítico` para garantizar detección temprana en tránsito a Marte con
latencia de comunicación de hasta 20 minutos por sentido. Exporta el modelo
entrenado en `modelo_xgb.json`.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import shap
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.utils.class_weight import compute_sample_weight
from xgboost import XGBClassifier

from nasa_referencia import FEATURE_NAMES, RISK_LABELS

BASE_DIR = Path(__file__).resolve().parent
DATASET_PATH = BASE_DIR / "dataset_salud.csv"
MODEL_OUTPUT_PATH = BASE_DIR / "modelo_xgb.json"


def entrenar_y_exportar(
    dataset_path: Path | str = DATASET_PATH,
    model_output_path: Path | str = MODEL_OUTPUT_PATH,
    seed: int = 42,
) -> dict[str, float]:
    """Entrena `XGBClassifier`, valida métricas en clase Crítico y guarda `modelo_xgb.json`."""
    ruta_csv = Path(dataset_path)
    if not ruta_csv.exists():
        raise FileNotFoundError(
            f"No existe {ruta_csv}. Ejecuta primero `python generador_datos.py`."
        )

    df = pd.read_csv(ruta_csv)
    faltantes = [c for c in FEATURE_NAMES + ["estado_riesgo"] if c not in df.columns]
    if faltantes:
        raise ValueError(f"Faltan columnas requeridas en el dataset: {faltantes}")

    X = df[FEATURE_NAMES].astype(float)
    y = df["estado_riesgo"].astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.20,
        stratify=y,
        random_state=seed,
    )

    # Pesos balanceados con refuerzo prioritario para la clase Crítico (2)
    sample_weights = compute_sample_weight(class_weight="balanced", y=y_train)
    sample_weights = np.where(y_train.to_numpy() == 2, sample_weights * 1.4, sample_weights)

    modelo = XGBClassifier(
        n_estimators=260,
        max_depth=5,
        learning_rate=0.06,
        subsample=0.85,
        colsample_bytree=0.85,
        min_child_weight=2,
        reg_lambda=1.0,
        objective="multi:softprob",
        num_class=3,
        eval_metric="mlogloss",
        random_state=seed,
        n_jobs=-1,
    )

    modelo.fit(
        X_train,
        y_train,
        sample_weight=sample_weights,
        eval_set=[(X_test, y_test)],
        verbose=False,
    )

    y_pred = modelo.predict(X_test)
    y_proba = modelo.predict_proba(X_test)

    acc = float(accuracy_score(y_test, y_pred))
    f1_macro = float(f1_score(y_test, y_pred, average="macro"))
    recall_por_clase = recall_score(y_test, y_pred, labels=[0, 1, 2], average=None)
    f1_por_clase = f1_score(y_test, y_pred, labels=[0, 1, 2], average=None)

    # Métricas prioritarias sobre clase 2 (Crítico)
    y_test_crit = (y_test.to_numpy() == 2).astype(int)
    y_pred_crit = (y_pred == 2).astype(int)
    fn_crit = int(np.sum((y_test_crit == 1) & (y_pred_crit == 0)))
    tp_crit = int(np.sum((y_test_crit == 1) & (y_pred_crit == 1)))
    fnr_crit = float(fn_crit / max(fn_crit + tp_crit, 1))
    auc_crit = float(roc_auc_score(y_test_crit, y_proba[:, 2]))

    print("\n=== REPORTE DE CLASIFICACIÓN (TEST SET) ===")
    target_names = [f"{k} ({RISK_LABELS[k]})" for k in (0, 1, 2)]
    print(classification_report(y_test, y_pred, target_names=target_names, digits=4))

    print("=== MATRIZ DE CONFUSIÓN ===")
    print(confusion_matrix(y_test, y_pred, labels=[0, 1, 2]))

    print("\n=== VALIDACIÓN PRIORITARIA: CLASE 2 (CRÍTICO) ===")
    print(f"  Accuracy Global        : {acc:.4f}")
    print(f"  F1 Macro               : {f1_macro:.4f}")
    print(f"  Recall Clase Crítico   : {recall_por_clase[2]:.4f}")
    print(f"  F1 Clase Crítico       : {f1_por_clase[2]:.4f}")
    print(f"  Falsos Negativos Crít. : {fn_crit} (FNR = {fnr_crit:.4%})")
    print(f"  ROC-AUC (Crítico OvR)  : {auc_crit:.4f}")

    # Verificar compatibilidad SHAP TreeExplainer antes de exportar
    explainer = shap.TreeExplainer(modelo)
    _ = explainer.shap_values(X_test.iloc[:5])

    ruta_modelo = Path(model_output_path)
    modelo.save_model(ruta_modelo)
    print(f"\n[ENTRENAMIENTO] Modelo exportado correctamente en: {ruta_modelo}")

    return {
        "accuracy": acc,
        "f1_macro": f1_macro,
        "recall_critico": float(recall_por_clase[2]),
        "f1_critico": float(f1_por_clase[2]),
        "fn_critico": float(fn_crit),
        "fnr_critico": fnr_crit,
        "roc_auc_critico": auc_crit,
    }


if __name__ == "__main__":
    entrenar_y_exportar()
