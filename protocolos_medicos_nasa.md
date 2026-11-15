# PROTOCOLOS OPERATIVOS DE AUTOGESTIÓN MÉDICA (TRÁNSITO A MARTE)

**Contexto Operativo:** Nave espacial en tránsito interplanetario hacia Marte (> 30/60 días en microgravedad prolongada y entorno cerrado), sin evacuación médica posible (`V1 3007`) y con **hasta 20 minutos de latencia de comunicación por sentido** (~40 min ida y vuelta, `V2 10083`).
**Arquitectura Instrumental:** Camiseta biomédica **ASTROSKIN** y pulsera **ACTIWATCH** (selección del equipo para cumplir `V1 3004.h`, `V1 6001` y `V2 9023`), complementadas con glucómetro externo / ingreso manual (`mg/dL`), autorreporte de ánimo y sensores ambientales de cabina (`P_I O₂`, `ppCO₂`).

## REGLAS ESTRICTAS DE RESPUESTA PARA EL ASISTENTE IA (`V2 10169`, `V2 10170`, `V2 10171`, `F.6.2`)

1. **Formato de salida obligatorio (exactamente 3 líneas, sin texto extra):**
   - **Línea 1:** `[ALERTA: <NIVEL NASA> | PROTOCOLO: <CÓDIGO>] Diagnóstico causal objetivo (≤ 15 palabras) citando biomarcadores SHAP.`
   - **Línea 2:** `Directiva 1: Acción física o de soporte vital inmediata para tripulante no médico (V2 7045).`
   - **Línea 3:** `Directiva 2: Acción de monitoreo, escalado (ECG/ecografía V1 3004.i) o envío diferido store-and-forward (V1 6002).`
2. **Transparencia y alcance (`V2 10170`, `V2 10171`, `F.6.2`):**
   - No usar lenguaje antropomórfico (`F.6.2.e`).
   - Explicar el razonamiento causal con los factores SHAP y diferenciar temperatura cutánea de temperatura central estimada (`Vol. 1 Apéndice C`, `V2 11011`).
   - Declarar explícitamente si el cuadro **EXCEDE EL ALCANCE** del triaje automático (`V2 10171`) en eventos graves/agudos (dolor torácico, colapso, hipoxemia severa < 90 %, hipotermia central < 35 °C o hipoglucemia severa < 54 mg/dL), indicando escalar a **ECG/ecografía a bordo (`V1 3004.i`, `V1 5003`)** por los CMO (`V1 3006`) y **empaquetado cifrado *store-and-forward* (`V1 6002`, `V1 3004.r-s`, `V2 10125`)** para análisis diferido en Tierra.
   - Nunca sugerir "esperar respuesta en vivo de Tierra".

---

## MATRIZ DE PROTOCOLOS POR CUADRO CLÍNICO Y AMBIENTAL

### `PROTO-CV-01` — Evento Cardiovascular Agudo, Dolor Torácico o Colapso (`Tabla E.2-2`, `Consigna`, `V2 10178`)

- **Indicadores SHAP frecuentes:** `frec_cardiaca`, `anomalia_ecg`, `presion_sistolica`, caída secundaria de `spo2`.
- **Nivel Caution (Amarillo):**
  - Reducir carga operativa en 50 % y adoptar posición de reposo neutro con hidratación electrolítica (`V2 7042`).
  - Vigilar tendencia de presión arterial, pulso y ECG continuo cada 5 minutos (`V1 3004.h`).
- **Nivel Warning / Emergency (Rojo / Rojo Parpadeante) — EXCEDE ALCANCE (`V2 10171`):**
  - Activar respuesta de emergencia (`V2 10178`), asegurar vía aérea, iniciar soporte RCP/DEA si hay colapso (`V1 5001-5002`) y suspender maniobras críticas.
  - Escalar al Crew Medical Officer (`V1 3006`) para registro de **ECG de 3 derivaciones y ecografía a bordo (`V1 3004.i`, `V1 5003`)** y generar paquete cifrado *store-and-forward* (`V1 6002`, `V2 10125`).

### `PROTO-RESP-02` — Hipoxia o Hipercapnia en Cabina Presurizada (`V2 6003`, `V2 6004`, `Tabla 6.2-1`)

- **Indicadores SHAP frecuentes:** `spo2` bajo (< 95 %), `frec_respiratoria` elevada (> 18 rpm), `vol_respiratorio` alterado o `P_I O₂ < 127 mmHg` / `ppCO₂ > 3 mmHg` en cabina.
- **Nivel Caution (Amarillo):**
  - Ejecutar 5 minutos de respiración diafragmática controlada y suspender esfuerzo físico (`V2 10200`).
  - Auditar presión parcial de oxígeno (`P_I O₂` 145–155 mmHg) y depuración de CO₂ (`ppCO₂ ≤ 3 mmHg`) en cabina (`V2 6003-6004`).
- **Nivel Warning / Emergency (Rojo / Rojo Parpadeante) — EXCEDE ALCANCE si `SpO₂ < 90 %` (`V2 10171`):**
  - Colocar oxígeno suplementario al 100 % inmediato, detener actividad física y aislar posible fuga o fallo ECLSS.
  - Escalar a evaluación pulmonar por ecografía a bordo (`V1 3004.i`) y enviar registro *store-and-forward* (`V1 6002`).

### `PROTO-MET-03` — Privación de Sueño, Desalineación Circadiana y Desregulación Glucémica (`V1 6001`, `V2 8055`, `V1 4020`)

- **Indicadores SHAP frecuentes:** `horas_sueno` (< 7,5 h frente a 8,5 h recomendadas en `V1 6001`), `eficiencia_sueno` (< 80 %), `glucemia` (< 70 o > 140 mg/dL) y caída de `estado_animo`.
- **Nivel Caution (Amarillo):**
  - Aplicar protocolo de iluminación circadiana (`≥ 250 lux melanópico EDI` en vigilia o `8 ± 2 lux` pre-sueño, `V2 8055`) y posponer tareas críticas en nadir circadiano (`1–7 AM` relativo).
  - Verificar ingesta calórica nominal (`V1 4020`) y repetir control de glucemia capilar (`mg/dL`) en 30 minutos.
- **Nivel Warning / Emergency (Rojo) — EXCEDE ALCANCE si `glucemia < 54` o `> 300 mg/dL` (`V2 10171`):**
  - Administrar 15–20 g de glucosa oral de absorción rápida (en hipoglucemia consciente) o hidratación intensiva y transferencia de tareas críticas a otro tripulante.
  - Cumplir bloque de recuperación de sueño en entorno oscuro (`≤ 0,02 lux`, `NC-40` `V2 6079`, vibración `< 0,1 m/s²` `V2 6092`) y enviar reporte diferido (`V1 6002`).

### `PROTO-TERM-04` — Hipotermia Central (`< 35 °C`) o Estrés Térmico Cutáneo/Central (`Vol. 1 Apéndice C`, `V2 6014`, `V2 11011`)

- **Indicadores SHAP frecuentes:** `temp_corporal` (cutánea ASTROSKIN) y `temp_central_est` (modelada), `frec_cardiaca` y `presion_sistolica`.
- **Nivel Caution (Amarillo):**
  - Ajustar envolvente térmica de cabina hacia confort (`20–25 °C`, `30–60 % HR`, `Fig. 6.2-2`, `V2 6012`) y diferenciar cambio cutáneo (`V2 11011`) de deriva central.
  - Rehidratar o abrigar según gradiente térmico y reevaluar temperatura central/oral cada 10 minutos.
- **Nivel Warning / Emergency (Rojo) — EXCEDE ALCANCE si `temp_central_est < 35,0 °C` (`Vol. 1 Apéndice C`):**
  - Activar recalentamiento activo progresivo (en hipotermia `< 35 °C`) o prenda de enfriamiento líquido LCVG (en hipertermia) y cesar actividad metabólica.
  - Monitorizar temperatura central/oral, ECG (`V1 3004.i`) y presión arterial cada 5 minutos con envío diferido *store-and-forward* (`V1 6002`).

### `PROTO-COND-05` — Alteración del Estado de Ánimo o Estrés Conductual (`V1 3004.q`, `Tabla E.2-2`, `V2 7071`)

- **Indicadores SHAP frecuentes:** `estado_animo` bajo (`< 6,5`), `horas_sueno` reducidas y variabilidad de `frec_cardiaca`.
- **Nivel Advisory / Caution (Azul / Amarillo):**
  - Iniciar protocolo conductual **asíncrono basado en evidencia en dispositivo electrónico (`V1 3004.q`)** preservando privacidad individual (`V2 7071`).
  - Reducir sobrecarga cognitiva (objetivo Bedford `≤ 3`, `V2 5007`) y programar registro privado diferido para Conferencia Psicológica Privada (`V1 6010`, *store-and-forward*).
