"""
Servidor HTTP local 100% offline para MecaSpace (Backend Python + Frontend React).

Expone la lógica biomédica existente (`SimuladorSensores`, `MotorInferencia`,
`nasa_referencia`) mediante una API JSON local y sirve los archivos compilados
de React desde `frontend/dist` en http://localhost:8000.
"""

from __future__ import annotations

import hashlib
import json
import mimetypes
import threading
import urllib.parse
from collections import deque
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from motor_inferencia import ETIQUETAS_LEGIBLES, MotorInferencia
from nasa_referencia import (
    CONSIGNA_SIX_INDICATORS,
    FEATURE_NAMES,
    NASA_ALERT_LEVELS,
    cargar_umbrales_nasa,
    obtener_referencias_osdr,
)
from simulador_sensores import ESCENARIOS_OBJETIVO, SimuladorSensores

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIST_DIR = BASE_DIR / "frontend" / "dist"
MODEL_PATH = BASE_DIR / "modelo_xgb.json"


class EstadoConsola:
    """Mantiene el estado compartido de simulación, triaje y alertas de forma thread-safe."""

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.simulador = SimuladorSensores(seed=42)
        self.motor = MotorInferencia(model_path=MODEL_PATH)
        self.umbrales = cargar_umbrales_nasa()
        self.osdr_ref = obtener_referencias_osdr(forzar_red=False)
        self.historico: deque[dict[str, Any]] = deque(maxlen=90)

        self.simulacion_activa = True
        self.emergencia_manual = False
        self.alarma_silenciada = False
        self.parpadeo_detenido = False
        self.alerta_reconocida = False
        self.datos_manuales_obsoletos = False
        self.ultimo_registro_manual_ts = datetime.now(timezone.utc).astimezone().strftime("%H:%M:%S")
        self.rutina_diaria: dict[str, bool] = {
            "glucemia": True,
            "animo": True,
            "sueno": True,
            "hidratacion": False,
        }
        self.racha_dias = 12
        self.bitacora_acciones: list[str] = []
        self.alertas_inhibidas: list[str] = []

        self.ultimo_resultado: dict[str, Any] | None = None
        self.ultimo_cabin_env: dict[str, float] = self.simulador.obtener_entorno_cabina()

        # Lectura inicial garantizada
        self.avanzar_tick(forzar_llm=True)

    def avanzar_tick(self, forzar_tick: bool = False, forzar_llm: bool = False) -> dict[str, Any]:
        """Avanza un paso de telemetría si la simulación está activa o se fuerza."""
        if self.simulacion_activa or forzar_tick or len(self.historico) == 0:
            lectura = self.simulador.leer_sensores()
            cabin_env = self.simulador.obtener_entorno_cabina()
            stale = bool(self.datos_manuales_obsoletos) or (not self.simulacion_activa and not forzar_tick)
            resultado = self.motor.evaluar(
                lectura=lectura,
                cabin_env=cabin_env,
                emergencia_manual=self.emergencia_manual,
                datos_obsoletos=stale,
                intervalo_llm_seg=25.0,
                forzar_llm=forzar_llm,
            )
            self.ultimo_resultado = resultado
            self.ultimo_cabin_env = cabin_env

            fila = dict(lectura)
            fila["timestamp"] = resultado["timestamp"]
            fila["estado_riesgo"] = resultado["estado_riesgo"]
            fila["temp_central_est"] = resultado["temp_central_est"]
            fila["pi_o2_mmhg"] = cabin_env["pi_o2_mmhg"]
            fila["ppco2_mmhg"] = cabin_env["ppco2_mmhg"]
            self.historico.append(fila)
        elif forzar_llm and self.historico:
            ultima = self.historico[-1]
            lectura = {k: float(ultima[k]) for k in FEATURE_NAMES}
            stale = bool(self.datos_manuales_obsoletos) or (not self.simulacion_activa)
            self.ultimo_resultado = self.motor.evaluar(
                lectura=lectura,
                cabin_env=self.ultimo_cabin_env,
                emergencia_manual=self.emergencia_manual,
                datos_obsoletos=stale,
                intervalo_llm_seg=25.0,
                forzar_llm=True,
            )

        return self.snapshot()

    def snapshot(self) -> dict[str, Any]:
        """Construye el payload JSON completo para el frontend React."""
        ultima = self.historico[-1]
        lectura = {k: float(ultima[k]) for k in FEATURE_NAMES}
        return {
            "lectura": lectura,
            "cabin_env": self.ultimo_cabin_env,
            "resultado": self.ultimo_resultado,
            "historico": list(self.historico),
            "ui_state": {
                "simulacion_activa": self.simulacion_activa,
                "emergencia_manual": self.emergencia_manual,
                "alarma_silenciada": self.alarma_silenciada,
                "parpadeo_detenido": self.parpadeo_detenido,
                "alerta_reconocida": self.alerta_reconocida,
                "datos_manuales_obsoletos": self.datos_manuales_obsoletos,
                "ultimo_registro_manual_ts": self.ultimo_registro_manual_ts,
                "escenario_actual": self.simulador.escenario_actual,
                "escenario_label": ESCENARIOS_OBJETIVO[self.simulador.escenario_actual]["label"],
                "rutina_diaria": self.rutina_diaria,
                "racha_dias": self.racha_dias,
                "bitacora_acciones": self.bitacora_acciones[:12],
                "alertas_inhibidas": self.alertas_inhibidas,
            },
            "escenarios": {k: v["label"] for k, v in ESCENARIOS_OBJETIVO.items()},
            "etiquetas": ETIQUETAS_LEGIBLES,
            "indicadores_centrales": CONSIGNA_SIX_INDICATORS,
            "nasa_levels": NASA_ALERT_LEVELS,
            "umbrales": self.umbrales,
            "osdr_ref": self.osdr_ref,
        }

    def generar_paquete_store_and_forward(self) -> str:
        """Genera expediente JSON verificable con hash SHA-256 (V1 6002, V2 10125)."""
        ultima = self.historico[-1]
        lectura = {k: float(ultima[k]) for k in FEATURE_NAMES}
        res = self.ultimo_resultado or {}
        payload = {
            "schema": "MecaSpace-StoreAndForward-v2",
            "standard_ref": "NASA-STD-3001 Vol.1 Rev.C (V1 3004.a, V1 6002) & Vol.2 Rev.E (V2 10125)",
            "mission_context": "Tránsito a Marte | Latencia 20 min/sentido",
            "generated_utc": datetime.now(timezone.utc).isoformat(),
            "nasa_alert_level": res.get("nivel_nasa"),
            "protocolo_codigo": res.get("protocolo_codigo"),
            "excede_alcance_v2_10171": res.get("excede_alcance"),
            "diagnostico": res.get("diagnostico"),
            "temp_cutanea_c": lectura["temp_corporal"],
            "temp_central_estimada_c": res.get("temp_central_est"),
            "telemetria": lectura,
            "cabina": self.ultimo_cabin_env,
            "top3_shap": res.get("top3_shap", []),
            "acciones_ejecutadas": self.bitacora_acciones[:12],
        }
        raw = json.dumps(payload, sort_keys=True, ensure_ascii=False).encode("utf-8")
        payload["sha256_integrity"] = hashlib.sha256(raw).hexdigest()
        return json.dumps(payload, indent=2, ensure_ascii=False)


ESTADO = EstadoConsola()


class MecaSpaceHandler(BaseHTTPRequestHandler):
    """Manejador HTTP para API JSON y archivos estáticos del frontend React."""

    protocol_version = "HTTP/1.1"

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A002
        return

    def _send_json(self, status: int, data: Any) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8"))

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/state":
            qs = urllib.parse.parse_qs(parsed.query)
            do_tick = qs.get("tick", ["1"])[0] != "0"
            with ESTADO.lock:
                data = ESTADO.avanzar_tick(forzar_tick=False) if do_tick else ESTADO.snapshot()
            self._send_json(200, data)
            return

        if path == "/api/export":
            with ESTADO.lock:
                body = ESTADO.generar_paquete_store_and_forward().encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Disposition", 'attachment; filename="mecaspace_store_and_forward.json"')
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)
            return

        # Servir frontend React compilado (SPA fallback a index.html)
        if not FRONTEND_DIST_DIR.exists():
            self._send_json(
                503,
                {"error": "Frontend no compilado. Ejecuta `npm run build` dentro de `frontend/`."},
            )
            return

        rel = path.lstrip("/") or "index.html"
        target = (FRONTEND_DIST_DIR / rel).resolve()
        if not str(target).startswith(str(FRONTEND_DIST_DIR.resolve())) or not target.is_file():
            target = FRONTEND_DIST_DIR / "index.html"

        mime_type, _ = mimetypes.guess_type(str(target))
        content = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mime_type or "application/octet-stream")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_POST(self) -> None:  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        try:
            body = self._read_json_body()
        except ValueError:
            self._send_json(400, {"error": "JSON inválido"})
            return

        with ESTADO.lock:
            if path == "/api/scenario":
                esc = str(body.get("escenario", "nominal"))
                if esc not in ESCENARIOS_OBJETIVO:
                    self._send_json(400, {"error": f"Escenario desconocido: {esc}"})
                    return
                ESTADO.emergencia_manual = False
                ESTADO.alerta_reconocida = False
                ESTADO.parpadeo_detenido = False
                ESTADO.datos_manuales_obsoletos = False
                ESTADO.simulador.activar_escenario(esc, inmediato=True)
                data = ESTADO.avanzar_tick(forzar_tick=True, forzar_llm=True)
                self._send_json(200, data)
                return

            if path == "/api/emergency":
                active = bool(body.get("active", True))
                ESTADO.emergencia_manual = active
                if active:
                    ESTADO.parpadeo_detenido = False
                    ESTADO.alerta_reconocida = False
                    ESTADO.alarma_silenciada = False
                    ESTADO.simulador.inyectar_sobrecarga_cardiovascular(critica=True)
                data = ESTADO.avanzar_tick(forzar_tick=True, forzar_llm=True)
                self._send_json(200, data)
                return

            if path == "/api/alarm":
                action = body.get("action")
                if action == "silence":
                    ESTADO.alarma_silenciada = not ESTADO.alarma_silenciada
                    ESTADO.parpadeo_detenido = True
                elif action == "ack":
                    ESTADO.alerta_reconocida = True
                    ESTADO.parpadeo_detenido = True
                elif action == "stop_flash":
                    ESTADO.parpadeo_detenido = True
                self._send_json(200, ESTADO.snapshot())
                return

            if path == "/api/manual":
                if body.get("toggle_stale"):
                    ESTADO.datos_manuales_obsoletos = not ESTADO.datos_manuales_obsoletos
                    data = ESTADO.avanzar_tick(forzar_tick=False, forzar_llm=True)
                    self._send_json(200, data)
                    return

                gluc = body.get("glucemia")
                animo = body.get("estado_animo")
                ESTADO.simulador.registrar_entrada_manual(
                    glucemia=float(gluc) if gluc is not None else None,
                    estado_animo=float(animo) if animo is not None else None,
                )
                ESTADO.datos_manuales_obsoletos = False
                ESTADO.ultimo_registro_manual_ts = datetime.now(timezone.utc).astimezone().strftime("%H:%M:%S")
                if gluc is not None:
                    ESTADO.rutina_diaria["glucemia"] = True
                if animo is not None:
                    ESTADO.rutina_diaria["animo"] = True
                data = ESTADO.avanzar_tick(forzar_tick=True, forzar_llm=True)
                self._send_json(200, data)
                return

            if path == "/api/intervention":
                tipo = str(body.get("tipo", ""))
                etiqueta = str(body.get("etiqueta", tipo))
                resumen = ESTADO.simulador.aplicar_intervencion(tipo)
                ts = datetime.now(timezone.utc).astimezone().strftime("%H:%M:%S")
                ESTADO.bitacora_acciones.insert(0, f"[{ts}] {etiqueta} — {resumen}")
                if tipo in {"rcp_dea", "reposo_cv"} and ESTADO.emergencia_manual:
                    ESTADO.emergencia_manual = False
                if tipo == "glucosa_oral":
                    ESTADO.rutina_diaria["glucemia"] = True
                elif tipo == "protocolo_conductual":
                    ESTADO.rutina_diaria["animo"] = True
                elif tipo == "iluminacion_descanso":
                    ESTADO.rutina_diaria["sueno"] = True
                data = ESTADO.avanzar_tick(forzar_tick=True, forzar_llm=True)
                self._send_json(200, data)
                return

            if path == "/api/routine":
                key = str(body.get("key", ""))
                if key in ESTADO.rutina_diaria:
                    ESTADO.rutina_diaria[key] = not ESTADO.rutina_diaria[key]
                self._send_json(200, ESTADO.snapshot())
                return

            if path == "/api/control":
                action = body.get("action")
                if action == "toggle_play":
                    ESTADO.simulacion_activa = not ESTADO.simulacion_activa
                    self._send_json(200, ESTADO.snapshot())
                    return
                if action == "clear_history":
                    ESTADO.historico.clear()
                    data = ESTADO.avanzar_tick(forzar_tick=True, forzar_llm=False)
                    self._send_json(200, data)
                    return
                if action == "force_llm":
                    data = ESTADO.avanzar_tick(forzar_tick=False, forzar_llm=True)
                    self._send_json(200, data)
                    return

            if path == "/api/chat":
                pregunta = str(body.get("pregunta", "")).strip()
                historial = body.get("historial", [])
                ultima = ESTADO.historico[-1]
                lectura = {k: float(ultima[k]) for k in FEATURE_NAMES}
                resp = ESTADO.motor.consultar_asistente_interactivo(
                    pregunta=pregunta,
                    lectura=lectura,
                    resultado_actual=ESTADO.ultimo_resultado,
                    historial_chat=historial if isinstance(historial, list) else [],
                )
                self._send_json(200, resp)
                return

        self._send_json(404, {"error": f"Endpoint no encontrado: {path}"})


def main(host: str = "127.0.0.1", port: int = 8000) -> None:
    """Inicia el servidor local MecaSpace."""
    httpd = ThreadingHTTPServer((host, port), MecaSpaceHandler)
    print(f"[MECASPACE] Consola disponible en: http://{host}:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[MECASPACE] Servidor detenido.")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
