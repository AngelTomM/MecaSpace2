# MecaSpace — Guía Rápida de Uso

Sistema autónomo offline de monitorización biomédica para misiones espaciales con 30 minutos de latencia con la Tierra.

---

## Cómo Funciona (Flujo en 4 Pasos)

1. **Sensores (`simulador_sensores.py`):** Emite cada 2 s las 9 variables biomédicas de Astroskin + Actiwatch.
2. **Clasificación (`modelo_xgb.json`):** `XGBClassifier` (calibrado con `NASA-STD-3001` y `NASA OSDR`) clasifica el estado en **Normal (0)**, **Preventivo (1)** o **Crítico (2)**.
3. **Explicabilidad (`SHAP`):** `TreeExplainer` identifica los **3 biomarcadores** que más impulsan la alerta actual.
4. **Asistente Médico (`LM Studio` / Respaldo):** Lee los protocolos NASA (`protocolos_medicos_nasa.md`) y genera 1 línea de diagnóstico + 2 directivas inmediatas. Si LM Studio no está abierto, activa el respaldo offline por reglas sin interrumpir el sistema.

---

## Arranque Rápido

### Opción A: Modo Completo (con LLM local)
1. Abre **LM Studio**, carga un modelo instructivo ligero (ej. Llama 3 / Mistral / Qwen 7B-8B) e inicia el **Local Server** en el puerto `1234` (`http://localhost:1234/v1`).
2. En la carpeta del proyecto, ejecuta:

```powershell
.venv\Scripts\streamlit.exe run app.py
```

### Opción B: Modo 100% Offline (sin LM Studio)
Ejecuta directamente la consola; el respaldo determinista de protocolos NASA responderá de inmediato:

```powershell
.venv\Scripts\streamlit.exe run app.py
```

> **Si necesitas regenerar datos o reentrenar el modelo:**
> ```powershell
> .venv\Scripts\python.exe nasa_referencia.py
> .venv\Scripts\python.exe generador_datos.py
> .venv\Scripts\python.exe entrenar_modelo.py
> ```

---

## Uso de la Consola

1. **Panel Superior:** Revisa el semáforo global (**Normal / Preventivo / Crítico**), el diagnóstico causal en 1 línea y las **2 directivas operativas**.
2. **Barra Lateral (Simulación):** Usa los botones de emergencia (*Hipoxia*, *Fatiga Severa*, *Sobrecarga Cardiovascular*, *Estrés Térmico*) o *Restaurar Estado Nominal* para probar la respuesta en vivo.
3. **Panel Central y XAI:** Observa las 9 métricas, sus series temporales (zona verde = rango nominal NASA) y las barras SHAP con las 3 variables determinantes.
4. **Caja de Consulta IA (al final):** Escribe preguntas operativas al Oficial Médico IA; recibe automáticamente la telemetría actual y los valores SHAP como contexto.

---

## Escalabilidad Futura (Propuesta Hackathon)

- **Interacción Multimodal por Audio (Manos Libres):** Integrar modelos locales de voz a texto (*Whisper*) y modelos nativos de audio/multimodales (*omni-audio* en LM Studio / edge GPU) para que el astronauta consulte o reporte síntomas por voz durante actividades extravehiculares (EVA) o emergencias sin usar teclado.
- **Análisis Acústico Biométrico:** Detección temprana de fatiga vocal, disnea o estrés agudo a partir del micrófono del casco combinada con la telemetría de Astroskin.
- **Sincronización Diferida DTN:** Empaquetado automático de incidentes críticos y gráficas SHAP para transmisión asíncrona cuando se restablece la ventana de enlace con la Tierra.
