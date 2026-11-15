# PROTOCOLOS OPERATIVOS DE AUTOGESTIÓN MÉDICA (MISIÓN ESPACIO PROFUNDO)

**Contexto Operativo:** Nave espacial con 30 minutos de latencia de comunicación con Control de Misión (Tierra). El sistema debe emitir respuestas autónomas de baja carga cognitiva.
**Sensores Activos:** Camiseta biométrica Astroskin y actígrafo Actiwatch Spectrum.

## REGLAS ESTRICTAS DE RESPUESTA PARA EL ASISTENTE IA

1. **Formato de salida obligatorio:**
   - Línea 1: Diagnóstico causal breve (máximo 15 palabras) citando los biomarcadores críticos entregados por SHAP.
   - Línea 2: Directiva operativa 1 (acción física o de soporte vital inmediata).
   - Línea 3: Directiva operativa 2 (acción de monitoreo o restricción operativa).
2. **Restricciones:** No utilizar jerga médica extensa, no dar explicaciones teóricas y nunca sugerir "esperar instrucciones de la Tierra" debido a la latencia de 30 minutos.

---

## MATRIZ DE PROTOCOLOS POR CUADRO FISIOLÓGICO

### 1. Hipoxia o Compromiso Respiratorio

- **Indicadores SHAP frecuentes:** `spo2` bajo (< 95%), `frec_respiratoria` elevada (> 18 rpm) o caída en `vol_respiratorio` (< 6 L/min).

- **Protocolo Preventivo:**
  - Ejecutar 5 minutos de respiración diafragmática controlada (4 segundos inhalación, 6 segundos exhalación).
  - Verificar flujo y presión parcial de oxígeno (ppO2) en el sistema ECLSS de la cabina.
- **Protocolo Crítico:**
  - Colocar mascarilla de oxígeno suplementario al 100% durante 15 minutos y suspender toda actividad física.
  - Activar protocolo de diagnóstico de fugas o fallo de depuración de CO₂ en el módulo habitacional.

### 2. Sobrecarga Cardiovascular o Arritmia Inducida

- **Indicadores SHAP frecuentes:** `frec_cardiaca` elevada (> 100 lpm), `anomalia_ecg` (> 0.15) o `presion_sistolica` fuera de rango (> 130 o < 95 mmHg).

- **Protocolo Preventivo:**
  - Reducir carga de trabajo operativa en un 50% y adoptar posición de reposo neutro.
  - Ingerir 500 ml de solución electrolítica isotónica para estabilizar volumen plasmático.
- **Protocolo Crítico:**
  - Detener maniobras críticas inmediatamente, activar piloto automático de la nave y permanecer en reposo absoluto.
  - Iniciar registro continuo de ECG de 3 derivaciones en modo de alta resolución y preparar kit médico de soporte cardíaco.

### 3. Fatiga Circadiana y Déficit Cognitivo

- **Indicadores SHAP frecuentes:** `eficiencia_sueno` baja (< 75%) combinada con variaciones en `frec_cardiaca` o `nivel_actividad` errático.

- **Protocolo Preventivo:**
  - Exponerse a iluminación enriquecida en espectro azul (480 nm) durante 20 minutos para supresión de melatonina.
  - Posponer tareas de acoplamiento, navegación manual o mantenimiento complejo por 2 horas.
- **Protocolo Crítico:**
  - Transferir el control de sistemas críticos al ordenador central o a otro miembro de la tripulación.
  - Cumplir bloque obligatorio de recuperación de sueño de 90 minutos en entorno oscuro y aislado acústicamente.

### 4. Estrés Térmico o Deshidratación Severa

- **Indicadores SHAP frecuentes:** `temp_corporal` elevada (> 37.6 °C), `frec_cardiaca` elevada y descenso en `presion_sistolica`.

- **Protocolo Preventivo:**
  - Ajustar el sistema de control térmico de la cabina (reducción de 2 °C) y ventilar vestimenta.
  - Consumir 750 ml de agua fría en intervalos de 15 minutos.
- **Protocolo Crítico:**
  - Activar prenda de enfriamiento líquido (LCVG) al máximo flujo y cesar toda actividad metabólica intensa.
  - Monitorear temperatura central y presión arterial cada 5 minutos hasta estabilizar por debajo de 37.5 °C.
