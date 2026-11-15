# Contexto del Proyecto: MecaSpace (AHBM — Tránsito a Marte)

> **Propósito de este documento:** Proveer contexto técnico completo y actualizado del repositorio `MecaSpace3` para compartir con integrantes del equipo o adjuntar al inicio de una nueva conversación con un asistente de IA.

---

## 1. Descripción General y Alcance

**MecaSpace** es una consola autónoma y **100 % fuera de línea (offline)** de monitorización biomédica y triaje clínico para tripulaciones en **tránsito a Marte** (> 30/60 días en microgravedad), diseñada bajo los lineamientos de **NASA-STD-3001 Vol. 1 Rev. C** y **Vol. 2 Rev. E**:

- **Sin evacuación posible (`V1 3007`)** y con **latencia de comunicaciones de hasta 20 min por sentido** (~40 min ida y vuelta, `V2 10083`).
- **Autonomía clínica a bordo:** los protocolos de emergencia (incluido dolor torácico) omiten enlaces médicos en tiempo real con Tierra y exigen evaluación autónoma mediante Oficial Médico de Tripulación (CMO), ECG, ecografía a bordo y registro diferido *store-and-forward* (`V2 10171`, `V1 3004.i`, `V1 5003`, `V1 3006`, `V1 6002`).
- **Perfil del equipo:** Estudiantes de ingeniería mecatrónica. El código prioriza claridad, modularidad, parametrización mediante constantes y ausencia de dependencias externas en tiempo de ejecución (sin CDNs ni APIs remotas obligatorias).

---

## 2. Arquitectura y Estructura del Repositorio

### Backend y Ciencia de Datos (Raíz)
- `server.py`: Servidor HTTP local (`ThreadingHTTPServer` en `127.0.0.1:8000`) que sirve la API JSON y la compilación estática del frontend (`frontend/dist/`). Gestiona de forma independiente a los 3 tripulantes (`koch`, `glover`, `kim`), con rutas `POST` despachadas por diccionario y constantes parametrizadas.
- `motor_inferencia.py`: Motor híbrido de evaluación clínica: capa determinista de seguridad (`≤ 1,0 s`) + modelo `XGBoost` (`modelo_xgb.json`) + explicabilidad `SHAP` (Top-3 variables) + asistente de chat local con respaldo determinista offline.
- `simulador_sensores.py`: Simulador fisiológico y ambiental de cabina (`SpO₂`, `P_I O₂`, `ppCO₂`) con escenarios objetivo e inyección de contramedidas/emergencias.
- `nasa_referencia.py`: Umbrales normativos NASA-STD-3001, definición de indicadores centrales y carga de datos de referencia (`data/nasa_thresholds.json`, `data/osdr_referencia.json`).
- `generador_datos.py` y `entrenar_modelo.py`: Scripts para generar `dataset_salud.csv` y entrenar `modelo_xgb.json`.
- `requirements.txt`: Dependencias Python (`xgboost`, `scikit-learn`, `shap`, `pandas`, `numpy`, `requests`).

### Frontend (`frontend/`, React 18 + Vite 6)
- `frontend/src/App.jsx`: Estructura principal de tableta clínica, barra lateral de 4 pestañas, dock inferior (simulación, rutina diaria, escenarios) y alertas sonoras duales por Web Audio (`V2 10176`) + destello de emergencia a 3 Hz.
- `frontend/src/data/nasaProtocols.js`: Diccionario normativo (`NASA_LEVELS`, `PROTOCOL_DICTIONARY` de `PROTO-CV-01` a `PROTO-NOM-00`, `SYMPTOM_PROTOCOLS`), asignación dinámica de 4 tarjetas prioritarias (`getQuickMetricPlan`), generador de avisos (`buildAlertSystemFeed`) y mapeo cromático (`getSeverityColor`).
- `frontend/src/components/SummaryTab.jsx`: Vista **Resumen** (explorador anatómico sobre `Cuerpo Humano.png`, 4 tarjetas prioritarias, panel interactivo de avisos/protocolos y disparador `SOS Torácico` `V2 10178`).
- `frontend/src/components/ParametersTab.jsx`: Vista **Parámetros** (8 parámetros ajustables, filtro e inhibición individual de avisos `V2 10156`, explicabilidad SHAP Top-3, contramedidas y guía paso a paso).
- `frontend/src/components/BreathingGuide.jsx`: Módulo independiente de respiración guiada 4-4-6 con fases parametrizadas.
- `frontend/src/components/TestsAndAITab.jsx`: Vista **Tests** (cuestionario psicológico sincronizado con `/api/manual`, acceso a prueba PVT, 6 gráficos de tendencia SVG, chat médico local y nota conductual privada PPC).
- `frontend/src/components/PvtModal.jsx`: Modal interactivo para la prueba de vigilancia psicomotora (PVT).
- `frontend/src/components/CrewAndTraceabilityTab.jsx`: Vista **Tripulación** (selección de perfil `koch`/`glover`/`kim`, descargos científicos, trazabilidad normativa, bitácora y exportación JSON *store-and-forward* con SHA-256).
- `frontend/src/components/Icons.jsx`: Iconografía SVG embebida (sin librerías externas).

### Documentación Normativa y de Uso
- `INSTRUCCIONES_USO.md`: Guía rápida de arranque y operación.
- `guia-fuentes-anclaje-marte.md` y `protocolos_medicos_nasa.md`: Base documental de requisitos NASA-STD-3001 y protocolos de misión.
- `Consigna.md` e `Informe.md`: Consigna académica e informe técnico del proyecto.

---

## 3. Endpoints de la API Local (`server.py`)

- **GET**
  - `/api/state?tick=0|1`: Devuelve el estado completo del tripulante activo, roster, cabin_env, histórico y resultado de inferencia.
  - `/api/export`: Descarga el expediente JSON *store-and-forward* firmado con `sha256_integrity`.
- **POST**
  - `/api/crew`: Cambia el tripulante activo (`koch`, `glover`, `kim`).
  - `/api/scenario`: Activa un escenario fisiológico de prueba.
  - `/api/adjust`: Ajusta variables fisiológicas, `radiation_rate`, `pvt_ms` o avanza el día de tránsito (`action: "advance_day"`).
  - `/api/emergency`: Activa o desactiva la emergencia manual (`SOS Torácico`, `V2 10178`).
  - `/api/alarm`: Controla silencio, reconocimiento o detención del parpadeo.
  - `/api/inhibit`: Inhibe o reactiva avisos individuales (`V2 10156`).
  - `/api/manual`: Registra mediciones manuales (`glucemia`, `estado_animo`) o alterna estado obsoleto cian (`V2 10020`).
  - `/api/intervention`: Ejecuta contramedidas médicas y las registra en bitácora.
  - `/api/routine`: Alterna ítems de la rutina diaria.
  - `/api/control`: Pausa/reanuda simulación, limpia histórico o fuerza evaluación.
  - `/api/chat`: Consulta al asistente médico local.

---

## 4. Comandos de Operación

```powershell
# 1. Iniciar servidor local (API + frontend compilado en http://127.0.0.1:8000)
python server.py

# 2. Recompilar frontend tras editar archivos en frontend/src/
npm --prefix frontend run build

# 3. Regenerar datos o reentrenar el modelo XGBoost (si se modifican umbrales)
python nasa_referencia.py
python generador_datos.py
python entrenar_modelo.py
```

---

## 5. Reglas de Trabajo para Asistentes y Colaboradores

1. Mantener la operación **100 % offline**: no agregar CDNs, fuentes web externas ni llamadas obligatorias a APIs en la nube.
2. Preservar la coherencia normativa con **NASA-STD-3001** (codificación cromática de 5 niveles + cian *stale*, sin telemedicina en tiempo real con Tierra).
3. Parametrizar límites, umbrales y configuraciones como constantes al inicio de los módulos; evitar duplicar lógica entre componentes o endpoints.
4. Tras cualquier modificación en `frontend/src/`, ejecutar `npm --prefix frontend run build` para actualizar `frontend/dist/` antes de probar `server.py`.
