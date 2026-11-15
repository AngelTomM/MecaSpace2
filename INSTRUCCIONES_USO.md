# MecaSpace — Guía Rápida de Uso (Tránsito a Marte)

Sistema autónomo offline de monitorización biomédica y triaje clínico para misiones en **tránsito a Marte** (> 30/60 días en microgravedad) sin evacuación posible (`V1 3007`) y con **hasta 20 minutos de latencia por sentido** (~40 min ida y vuelta, `V2 10083`).

---

## Cómo Funciona (Flujo Integrado)

1. **Adquisición Multimodal (`simulador_sensores.py`):**
   - **Wearables seleccionados por el equipo:** Camiseta **Astroskin** y pulsera **Actiwatch Spectrum** (para cumplir `V1 3004.h`, `V1 6001` y `V2 9023`).
   - **Entradas multimodales:** Glucemia (`mg/dL`, glucómetro / manual) y estado de ánimo (`1–10`), completando los **6 indicadores prioritarios de la Consigna** más 6 variables contextuales cardiorrespiratorias/actigráficas (12 variables en total) y telemetría de cabina (`P_I O₂`, `ppCO₂`).
2. **Capa Determinista Previa + Clasificación (`motor_inferencia.py` + `modelo_xgb.json`):**
   - Antepone umbrales clínicos críticos (hipotermia central estimada `< 35 °C` según `Vol. 1 Apéndice C`, `SpO₂ < 90 %`, bradicardia/taquicardia extrema, hipoglucemia `< 54 mg/dL`, fallo de cabina o emergencia manual `V2 10178`) antes de invocar `XGBClassifier` (`≤ 1,0 s`, `Tabla 10.2-1`).
   - Mapea a la jerarquía oficial de **NASA-STD-3001 Vol. 2 Rev. E (`Tabla 10.3-1` / `Tabla F.5-1`)**: `Nominal (Verde)`, `Advisory (Azul)`, `Caution (Amarillo)`, `Warning (Rojo sólido)`, `Emergency (Rojo parpadeante)` y `Stale (Cian)`.
3. **Explicabilidad (`SHAP`) y Trazabilidad (`V2 10169-10171`):**
   - `TreeExplainer` identifica los 3 biomarcadores determinantes.
   - El LLM local (`LM Studio`) o el respaldo offline por reglas cita el código de alerta/protocolo y declara cuándo un cuadro **excede su alcance (`V2 10171`)**, indicando escalar a **ECG/ecografía a bordo (`V1 3004.i`, `V1 5003`)** y envío diferido ***store-and-forward* (`V1 6002`)**.

---

## Arranque Rápido

```powershell
.venv\Scripts\streamlit.exe run app.py
```

> **Si necesitas regenerar referencias, dataset o reentrenar el modelo:**
> ```powershell
> .venv\Scripts\python.exe nasa_referencia.py
> .venv\Scripts\python.exe generador_datos.py
> .venv\Scripts\python.exe entrenar_modelo.py
> ```

---

## Controles Principales en la Demostración

1. **Cabecera Persistente (`V2 10178`, `F.6.4.k`):** Botón directo de **Emergencia Manual** independiente de los sensores, más **Silenciar Alarma Global** y **Acknowledge** para detener el parpadeo (`F.5.10.g`).
2. **Selector de Escenarios (Barra Lateral):** Permite inyectar en vivo *Estado Nominal*, *Privación Acumulada de Sueño + Desregulación Glucémica (`V2 8055`)*, *Evento Cardiovascular Agudo en Tránsito (`Consigna`)*, *Hipoxia/Hipercapnia de Cabina (`V2 6003-6004`)* e *Hipotermia Central `< 35 °C` (`Vol. 1 Apéndice C`)*.
3. **Entrada Multimodal y Estado Obsoleto (Cian):** Registra glucemia y estado de ánimo manualmente o simula datos obsoletos (`V2 10020`).
4. **Procedimiento Electrónico y *Store-and-Forward* (`F.6.4.h`, `V1 6002`):** Lista paso a paso para tripulantes no médicos (`Tabla F.5-2` en magenta para pasos de sistema) con exportación JSON verificada por SHA-256.
