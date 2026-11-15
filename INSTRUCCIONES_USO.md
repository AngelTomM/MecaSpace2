# MecaSpace — Guía Rápida de Uso (Tránsito a Marte)

Sistema autónomo fuera de línea de monitorización biomédica y triaje clínico para misiones en **tránsito a Marte** (> 30/60 días en microgravedad), sin evacuación posible (`V1 3007`) y con hasta 20 minutos de latencia por sentido (~40 min ida y vuelta, `V2 10083`).

---

## Arranque Rápido (Consola Web React + Backend Python Offline)

1. Posicionarse en la raíz del repositorio (`c:\Users\ulica\Documents\GitHub\MecaSpace3`) e iniciar el servidor local integrado (`server.py`), que sirve la API biomédica y la compilación de producción de React (`frontend/dist/`):

```powershell
c:\Users\ulica\Documents\GitHub\MecaSpace2\.venv\Scripts\python.exe server.py
```

*(Si se utiliza un entorno virtual local dentro de `MecaSpace3`, activar o invocar `.venv\Scripts\python.exe server.py`.)*

2. Abrir en el navegador web local: **http://127.0.0.1:8000**

*(Modo alternativo heredado en Streamlit: `streamlit run app.py`.)*

---

## Estructura y Flujo de la Interfaz

La consola se organiza en cuatro vistas principales accesibles desde la barra lateral y un dock inferior de control de simulación, rutina diaria y escenarios de prueba:

1. **Resumen (`SummaryTab.jsx`):**
   - Muestra el estado general del tripulante activo mediante codificación de 5 niveles de severidad (`NASA-STD-3001 Vol. 2 Rev. E`, `Tabla F.5-1`) más el estado cian *stale* para mediciones manuales obsoletas (`V2 10020`), destello de emergencia a 3 Hz y alertas sonoras duales mediante Web Audio (`V2 10176`).
   - Presenta cuatro tarjetas de métricas prioritarias asignadas dinámicamente (`getQuickMetricPlan`) y un panel interactivo de avisos y protocolos (`PROTO-*`) con parámetro afectado, umbral normativo, estado de alcance médico y acción inmediata recomendada.
   - Incluye el disparador de emergencia manual (`SOS Torácico`, `V2 10178`) con protocolo autónomo a bordo (evaluación CMO, ECG, ecografía y registro diferido *store-and-forward*, sin enlaces médicos en tiempo real con Tierra).

2. **Parámetros (`ParametersTab.jsx`):**
   - Permite ajustar manualmente 8 parámetros fisiológicos y ambientales (`POST /api/adjust`), avanzar el día de tránsito y consultar la explicabilidad SHAP Top-3 del modelo (`motor_inferencia.py`).
   - Incorpora filtro e inhibición individual de avisos (`V2 10156`, `POST /api/inhibit`), contramedidas ejecutables (`POST /api/intervention`) y módulo de respiración guiada 4-4-6.

3. **Tests (`TestsAndAITab.jsx`):**
   - Integra el cuestionario psicológico sincronizado con `/api/manual`, la prueba de vigilancia psicomotora PVT (`PvtModal.jsx`), seis gráficos de tendencias temporales en SVG, el chat médico local (`/api/chat`) y la nota conductual privada PPC (`V1 3004.q`, `V1 6010`).

4. **Tripulación (`CrewAndTraceabilityTab.jsx`):**
   - Gestiona de forma independiente los tres perfiles de tripulación (`koch`, `glover`, `kim` mediante `POST /api/crew`), descargos científicos, trazabilidad normativa `NASA-STD-3001`, bitácora de eventos y exportación JSON *store-and-forward* verificada con SHA-256 (`/api/export`, `V1 6002`).

---

## Mantenimiento y Compilación

Para regenerar el conjunto de datos o reentrenar el modelo XGBoost (`modelo_xgb.json`):

```powershell
python nasa_referencia.py
python generador_datos.py
python entrenar_modelo.py
```

Si se realizan cambios en el código fuente del frontend (`frontend/src/`), recompilar los archivos estáticos en `frontend/dist/` antes de iniciar el servidor:

```powershell
npm --prefix frontend run build
```
