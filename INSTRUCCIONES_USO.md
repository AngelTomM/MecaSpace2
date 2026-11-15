# MecaSpace — Guía Rápida de Uso (Tránsito a Marte)

Sistema autónomo offline de monitorización biomédica y triaje clínico para misiones en **tránsito a Marte** (> 30/60 días en microgravedad) sin evacuación posible (`V1 3007`) y con **hasta 20 minutos de latencia por sentido** (~40 min ida y vuelta, `V2 10083`).

---

## Arranque Rápido (Consola Web React + Backend Python 100 % Offline)

Ejecuta el servidor local integrado (sirve la API biomédica y el frontend compilado en React en un solo comando):

```powershell
.venv\Scripts\python.exe server.py
```

Luego abre en el navegador: **http://127.0.0.1:8000**

*(Modo alternativo heredado en Streamlit: `.venv\Scripts\streamlit.exe run app.py`)*

---

## Cómo Funciona (Flujo Integrado)

1. **Explorador Anatómico y 6 Indicadores (`Triaje y Acción`):**
   - Figura humana SVG interactiva con 5 zonas clicables (`Neuro/Sueño-Ánimo`, `Corazón`, `Pulmones`, `Glucemia`, `Piel/Térmico`) coloreadas en tiempo real según `NASA-STD-3001 Vol. 2 Rev. E` (`Tabla F.5-1`).
   - Muestra los 6 indicadores centrales (`Presión Arterial`, `Frecuencia Cardíaca`, `Glucemia`, `Temperatura Cutánea vs. Central Estimada`, `Horas de Sueño` y `Estado de Ánimo`) y contexto de cabina (`SpO₂`, `P_I O₂`, `ppCO₂`).
2. **Capa Determinista Previa + XGBoost + SHAP (`motor_inferencia.py`):**
   - Intercepta cuadros agudos (`temp_central_est < 35 °C`, `SpO₂ < 90 %`, bradicardia/taquicardia extrema, hipoglucemia `< 54 mg/dL`, fallo atmosférico o emergencia manual `V2 10178`) en milisegundos (`≤ 1,0 s`, `Tabla 10.2-1`).
   - Despliega el árbol de decisión interactivo con acciones ejecutables (`RCP/DEA`, `O₂ 100 %`, `Glucosa oral`, `Recalentamiento`, `Enfriamiento LCVG`, `ECG/Ecografía a bordo`) que estabilizan la telemetría simulada y registran bitácora.
3. **Asistente IA Local y Trazabilidad (`Tendencias e IA` / `Trazabilidad NASA`):**
   - Gráficos temporales con bandas nominales, chat conectado a `LM Studio` (`http://localhost:1234/v1`) con respaldo offline determinista, nota conductual privada (`V1 3004.q`, `V1 6010`) y exportación JSON *store-and-forward* verificada por SHA-256 (`V1 6002`).

> **Si necesitas regenerar datos o reentrenar el modelo:**
> ```powershell
> .venv\Scripts\python.exe nasa_referencia.py
> .venv\Scripts\python.exe generador_datos.py
> .venv\Scripts\python.exe entrenar_modelo.py
> ```

> **Si modificas el frontend React (`frontend/src/`):**
> ```powershell
> npm --prefix frontend run build
> ```
