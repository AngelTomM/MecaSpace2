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
from simulador_sensores import ESCENARIOS_OBJETIVO, LIMITES_FISICOS, SimuladorSensores

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIST_DIR = BASE_DIR / "frontend" / "dist"
MODEL_PATH = BASE_DIR / "modelo_xgb.json"

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8000
HISTORY_MAXLEN = 90
BITACORA_EXPORT_LIMIT = 14
LLM_INTERVAL_SEC = 25.0
RADIATION_RATE_BOUNDS = (0.20, 2.40)
PVT_MS_BOUNDS = (140, 650)
DIASTOLIC_BOUNDS = (45, 118)
CREW_META_KEYS = ("id", "name", "role", "height", "weight", "bmi", "blood", "skin", "hair")

CREW_TEMPLATES: dict[str, dict[str, Any]] = {
    "koch": {
        "id": "koch",
        "name": "Esp. Christina Koch",
        "role": "Especialista de Misión",
        "height": "170 cm",
        "weight": "61 kg",
        "bmi": "21.1",
        "blood": "O+",
        "skin": "#F4CBB2",
        "hair": "#6B3410",
        "seed": 42,
        "initial_scenario": "nominal",
        "initial_overrides": {
            "presion_sistolica": 118.0,
            "frec_cardiaca": 68.0,
            "glucemia": 88.0,
            "temp_corporal": 36.15,
            "horas_sueno": 8.2,
            "estado_animo": 9.1,
        },
        "radiation_rate": 0.84,
        "radiation_total": 156.2,
        "pvt_ms": 238,
    },
    "glover": {
        "id": "glover",
        "name": "Cmdte. Victor Glover",
        "role": "Comandante de Misión",
        "height": "183 cm",
        "weight": "86 kg",
        "bmi": "25.7",
        "blood": "A+",
        "skin": "#8C5327",
        "hair": "#1A1A1D",
        "seed": 108,
        "initial_scenario": "sobrecarga_cardiovascular_preventiva",
        "initial_overrides": {
            "presion_sistolica": 135.0,
            "frec_cardiaca": 96.0,
            "glucemia": 94.0,
            "temp_corporal": 36.35,
            "horas_sueno": 7.8,
            "estado_animo": 8.7,
        },
        "radiation_rate": 1.18,
        "radiation_total": 219.5,
        "pvt_ms": 248,
    },
    "kim": {
        "id": "kim",
        "name": "Dr. Jonny Kim",
        "role": "Médico de Vuelo / CMO",
        "height": "178 cm",
        "weight": "77 kg",
        "bmi": "24.3",
        "blood": "B+",
        "skin": "#E6BF9E",
        "hair": "#14161B",
        "seed": 215,
        "initial_scenario": "sueno_glucemia_preventiva",
        "initial_overrides": {
            "presion_sistolica": 115.0,
            "frec_cardiaca": 64.0,
            "glucemia": 86.0,
            "temp_corporal": 36.0,
            "horas_sueno": 5.8,
            "estado_animo": 8.2,
        },
        "radiation_rate": 0.92,
        "radiation_total": 171.1,
        "pvt_ms": 328,
    },
}


class PerfilTripulante:
    """Estado fisiológico, histórico y operativo independiente por tripulante."""

    def __init__(self, cfg: dict[str, Any]) -> None:
        self.meta = dict(cfg)
        self.simulador = SimuladorSensores(seed=int(cfg["seed"]))
        self.simulador.activar_escenario(cfg["initial_scenario"], inmediato=True)
        for var, val in cfg.get("initial_overrides", {}).items():
            self.simulador.valores_actuales[var] = float(val)
            self.simulador._objetivo_actual[var] = float(val)

        self.historico: deque[dict[str, Any]] = deque(maxlen=HISTORY_MAXLEN)
        self.emergencia_manual = False
        self.alarma_silenciada = False
        self.parpadeo_detenido = False
        self.alerta_reconocida = False
        self.datos_manuales_obsoletos = False
        self.ultimo_registro_manual_ts = _hora_local_actual()
        self.rutina_diaria: dict[str, bool] = {
            "glucemia": True,
            "animo": True,
            "sueno": True,
            "hidratacion": False,
        }
        self.racha_dias = 12
        self.bitacora_acciones: list[str] = []
        self.alertas_inhibidas: list[str] = []
        self.radiation_rate = float(cfg["radiation_rate"])
        self.radiation_total = float(cfg["radiation_total"])
        self.pvt_ms = int(cfg["pvt_ms"])
        self.ultimo_resultado: dict[str, Any] | None = None
        self.ultimo_cabin_env: dict[str, float] = self.simulador.obtener_entorno_cabina()


def _clamp(value: float, low: float, high: float) -> float:
    """Restringe un valor numérico al intervalo [low, high]."""
    return float(max(low, min(high, value)))


def _hora_local_actual() -> str:
    """Devuelve la hora local formateada HH:MM:SS."""
    return datetime.now(timezone.utc).astimezone().strftime("%H:%M:%S")


def registrar_bitacora(perfil: PerfilTripulante, mensaje: str) -> None:
    """Inserta un evento con marca horaria al inicio de la bitácora del tripulante."""
    perfil.bitacora_acciones.insert(0, f"[{_hora_local_actual()}] {mensaje}")


def estimar_presion_diastolica(presion_sistolica: float) -> int:
    """Estima la presión diastólica coherente con la sistólica para despliegue clínico."""
    dia = round(52.0 + (float(presion_sistolica) - 80.0) * 0.52)
    return int(_clamp(dia, *DIASTOLIC_BOUNDS))


class EstadoConsola:
    """Mantiene el estado compartido de simulación, triaje y alertas de forma thread-safe."""

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.motor = MotorInferencia(model_path=MODEL_PATH)
        self.umbrales = cargar_umbrales_nasa()
        self.osdr_ref = obtener_referencias_osdr(forzar_red=False)

        self.simulacion_activa = True
        self.mission_day = 186
        self.active_crew_id = "koch"
        self.crew: dict[str, PerfilTripulante] = {
            cid: PerfilTripulante(cfg) for cid, cfg in CREW_TEMPLATES.items()
        }

        # Lectura inicial garantizada para toda la tripulación
        for cid in ("glover", "kim", "koch"):
            self._tick_perfil(self.crew[cid], forzar_tick=True, forzar_llm=True)

    @property
    def perfil_activo(self) -> PerfilTripulante:
        return self.crew[self.active_crew_id]

    def _tick_perfil(
        self,
        perfil: PerfilTripulante,
        forzar_tick: bool = False,
        forzar_llm: bool = False,
    ) -> None:
        if self.simulacion_activa or forzar_tick or len(perfil.historico) == 0:
            lectura = perfil.simulador.leer_sensores()
            cabin_env = perfil.simulador.obtener_entorno_cabina()
            stale = bool(perfil.datos_manuales_obsoletos) or (not self.simulacion_activa and not forzar_tick)
            resultado = self.motor.evaluar(
                lectura=lectura,
                cabin_env=cabin_env,
                emergencia_manual=perfil.emergencia_manual,
                datos_obsoletos=stale,
                intervalo_llm_seg=LLM_INTERVAL_SEC,
                forzar_llm=forzar_llm,
            )
            perfil.ultimo_resultado = resultado
            perfil.ultimo_cabin_env = cabin_env

            fila = dict(lectura)
            fila["timestamp"] = resultado["timestamp"]
            fila["estado_riesgo"] = resultado["estado_riesgo"]
            fila["temp_central_est"] = resultado["temp_central_est"]
            fila["pi_o2_mmhg"] = cabin_env["pi_o2_mmhg"]
            fila["ppco2_mmhg"] = cabin_env["ppco2_mmhg"]
            perfil.historico.append(fila)
        elif forzar_llm and perfil.historico:
            ultima = perfil.historico[-1]
            lectura = {k: float(ultima[k]) for k in FEATURE_NAMES}
            stale = bool(perfil.datos_manuales_obsoletos) or (not self.simulacion_activa)
            perfil.ultimo_resultado = self.motor.evaluar(
                lectura=lectura,
                cabin_env=perfil.ultimo_cabin_env,
                emergencia_manual=perfil.emergencia_manual,
                datos_obsoletos=stale,
                intervalo_llm_seg=LLM_INTERVAL_SEC,
                forzar_llm=True,
            )

    def avanzar_tick(self, forzar_tick: bool = False, forzar_llm: bool = False) -> dict[str, Any]:
        """Avanza un paso de telemetría para el tripulante activo."""
        self._tick_perfil(self.perfil_activo, forzar_tick=forzar_tick, forzar_llm=forzar_llm)
        return self.snapshot()

    def _resumen_tripulacion(self) -> list[dict[str, Any]]:
        resumen: list[dict[str, Any]] = []
        for cid, perfil in self.crew.items():
            ultima = perfil.historico[-1]
            lectura = {k: float(ultima[k]) for k in FEATURE_NAMES}
            res = perfil.ultimo_resultado or {}
            item = {k: perfil.meta[k] for k in CREW_META_KEYS}
            item.update(
                {
                    "id": cid,
                    "nivel_nasa": res.get("nivel_nasa", "Nominal"),
                    "protocolo_codigo": res.get("protocolo_codigo", "PROTO-NOM-00"),
                    "temp_central_est": res.get("temp_central_est", 37.0),
                    "bp_diastolic": estimar_presion_diastolica(lectura["presion_sistolica"]),
                    "radiation_rate": round(perfil.radiation_rate, 2),
                    "radiation_total": round(perfil.radiation_total, 1),
                    "pvt_ms": perfil.pvt_ms,
                    "datos_manuales_obsoletos": perfil.datos_manuales_obsoletos,
                    "emergencia_manual": perfil.emergencia_manual,
                    "lectura": lectura,
                }
            )
            resumen.append(item)
        return resumen

    def snapshot(self) -> dict[str, Any]:
        """Construye el payload JSON completo para el frontend React."""
        p = self.perfil_activo
        ultima = p.historico[-1]
        lectura = {k: float(ultima[k]) for k in FEATURE_NAMES}
        return {
            "active_crew_id": self.active_crew_id,
            "mission_day": self.mission_day,
            "crew_roster": self._resumen_tripulacion(),
            "lectura": lectura,
            "extras": {
                "bp_diastolic": estimar_presion_diastolica(lectura["presion_sistolica"]),
                "radiation_rate": round(p.radiation_rate, 2),
                "radiation_total": round(p.radiation_total, 1),
                "pvt_ms": p.pvt_ms,
            },
            "cabin_env": p.ultimo_cabin_env,
            "resultado": p.ultimo_resultado,
            "historico": list(p.historico),
            "ui_state": {
                "simulacion_activa": self.simulacion_activa,
                "emergencia_manual": p.emergencia_manual,
                "alarma_silenciada": p.alarma_silenciada,
                "parpadeo_detenido": p.parpadeo_detenido,
                "alerta_reconocida": p.alerta_reconocida,
                "datos_manuales_obsoletos": p.datos_manuales_obsoletos,
                "ultimo_registro_manual_ts": p.ultimo_registro_manual_ts,
                "escenario_actual": p.simulador.escenario_actual,
                "escenario_label": ESCENARIOS_OBJETIVO[p.simulador.escenario_actual]["label"],
                "rutina_diaria": p.rutina_diaria,
                "racha_dias": p.racha_dias,
                "bitacora_acciones": p.bitacora_acciones[:14],
                "alertas_inhibidas": p.alertas_inhibidas,
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
        p = self.perfil_activo
        ultima = p.historico[-1]
        lectura = {k: float(ultima[k]) for k in FEATURE_NAMES}
        res = p.ultimo_resultado or {}
        payload = {
            "schema": "MecaSpace-StoreAndForward-v2",
            "standard_ref": "NASA-STD-3001 Vol.1 Rev.C (V1 3004.a, V1 6002) & Vol.2 Rev.E (V2 10125)",
            "mission_context": f"Tránsito a Marte | Día {self.mission_day} | Latencia 20 min/sentido",
            "crew_member": p.meta["name"],
            "crew_role": p.meta["role"],
            "generated_utc": datetime.now(timezone.utc).isoformat(),
            "nasa_alert_level": res.get("nivel_nasa"),
            "protocolo_codigo": res.get("protocolo_codigo"),
            "excede_alcance_v2_10171": res.get("excede_alcance"),
            "diagnostico": res.get("diagnostico"),
            "temp_cutanea_c": lectura["temp_corporal"],
            "temp_central_estimada_c": res.get("temp_central_est"),
            "radiacion_mSv_dia": round(p.radiation_rate, 2),
            "radiacion_acumulada_mSv": round(p.radiation_total, 1),
            "pvt_ms": p.pvt_ms,
            "telemetria": lectura,
            "cabina": p.ultimo_cabin_env,
            "top3_shap": res.get("top3_shap", []),
            "acciones_ejecutadas": p.bitacora_acciones[:14],
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

    def _send_cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_json(self, status: int, data: Any) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._send_cors_headers()
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
        self._send_cors_headers()
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

        rel = urllib.parse.unquote(path.lstrip("/")) or "index.html"
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
        path = urllib.parse.urlparse(self.path).path
        try:
            body = self._read_json_body()
        except ValueError:
            self._send_json(400, {"error": "JSON inválido"})
            return

        routes = {
            "/api/crew": self._post_crew,
            "/api/scenario": self._post_scenario,
            "/api/adjust": self._post_adjust,
            "/api/emergency": self._post_emergency,
            "/api/alarm": self._post_alarm,
            "/api/inhibit": self._post_inhibit,
            "/api/manual": self._post_manual,
            "/api/intervention": self._post_intervention,
            "/api/routine": self._post_routine,
            "/api/control": self._post_control,
            "/api/chat": self._post_chat,
        }
        handler = routes.get(path)
        if handler is None:
            self._send_json(404, {"error": f"Endpoint no encontrado: {path}"})
            return

        with ESTADO.lock:
            status, payload = handler(ESTADO.perfil_activo, body)
        self._send_json(status, payload)

    def _post_crew(self, _p: PerfilTripulante, body: dict[str, Any]) -> tuple[int, Any]:
        cid = str(body.get("crew_id", "koch"))
        if cid not in ESTADO.crew:
            return 400, {"error": f"Tripulante desconocido: {cid}"}
        ESTADO.active_crew_id = cid
        return 200, ESTADO.avanzar_tick(forzar_tick=False, forzar_llm=True)

    def _post_scenario(self, p: PerfilTripulante, body: dict[str, Any]) -> tuple[int, Any]:
        esc = str(body.get("escenario", "nominal"))
        if esc not in ESCENARIOS_OBJETIVO:
            return 400, {"error": f"Escenario desconocido: {esc}"}
        p.emergencia_manual = False
        p.alerta_reconocida = False
        p.parpadeo_detenido = False
        p.datos_manuales_obsoletos = False
        p.simulador.activar_escenario(esc, inmediato=True)
        return 200, ESTADO.avanzar_tick(forzar_tick=True, forzar_llm=True)

    def _post_adjust(self, p: PerfilTripulante, body: dict[str, Any]) -> tuple[int, Any]:
        if body.get("action") == "advance_day":
            ESTADO.mission_day += 1
            for member in ESTADO.crew.values():
                member.radiation_total = round(member.radiation_total + member.radiation_rate, 1)
            registrar_bitacora(p, f"Día de tránsito {ESTADO.mission_day} registrado")
            return 200, ESTADO.snapshot()

        var = str(body.get("var", ""))
        delta = body.get("delta")
        value = body.get("value")

        if var == "radiation_rate":
            nxt = float(value) if value is not None else p.radiation_rate + float(delta or 0.0)
            p.radiation_rate = round(_clamp(nxt, *RADIATION_RATE_BOUNDS), 2)
            return 200, ESTADO.snapshot()

        if var == "pvt_ms":
            nxt = float(value) if value is not None else p.pvt_ms + float(delta or 0.0)
            p.pvt_ms = int(round(_clamp(nxt, *PVT_MS_BOUNDS)))
            return 200, ESTADO.snapshot()

        if var in FEATURE_NAMES:
            cur = float(p.simulador.valores_actuales[var])
            nxt = float(value) if value is not None else cur + float(delta or 0.0)
            clamped = _clamp(nxt, *LIMITES_FISICOS[var])
            p.simulador.valores_actuales[var] = clamped
            p.simulador._objetivo_actual[var] = clamped
            if var in {"glucemia", "estado_animo"}:
                p.datos_manuales_obsoletos = False
                p.ultimo_registro_manual_ts = _hora_local_actual()
            return 200, ESTADO.avanzar_tick(forzar_tick=True, forzar_llm=True)

        return 400, {"error": f"Variable no ajustable: {var}"}

    def _post_emergency(self, p: PerfilTripulante, body: dict[str, Any]) -> tuple[int, Any]:
        active = bool(body.get("active", True))
        p.emergencia_manual = active
        if active:
            p.parpadeo_detenido = False
            p.alerta_reconocida = False
            p.alarma_silenciada = False
            p.simulador.inyectar_sobrecarga_cardiovascular(critica=True)
            registrar_bitacora(p, "SOS Torácico manual activado (V2 10178)")
        else:
            p.simulador.restaurar_nominal(inmediato=True)
            registrar_bitacora(p, "Emergencia manual desactivada → retorno nominal")
        return 200, ESTADO.avanzar_tick(forzar_tick=True, forzar_llm=True)

    def _post_alarm(self, p: PerfilTripulante, body: dict[str, Any]) -> tuple[int, Any]:
        action = body.get("action")
        if action == "silence":
            p.alarma_silenciada = not p.alarma_silenciada
            p.parpadeo_detenido = True
        elif action == "ack":
            p.alerta_reconocida = True
            p.parpadeo_detenido = True
        elif action == "stop_flash":
            p.parpadeo_detenido = True
        return 200, ESTADO.snapshot()

    def _post_inhibit(self, p: PerfilTripulante, body: dict[str, Any]) -> tuple[int, Any]:
        key = str(body.get("key", "")).strip()
        if key:
            if key in p.alertas_inhibidas:
                p.alertas_inhibidas.remove(key)
            else:
                p.alertas_inhibidas.append(key)
        return 200, ESTADO.snapshot()

    def _post_manual(self, p: PerfilTripulante, body: dict[str, Any]) -> tuple[int, Any]:
        if body.get("toggle_stale"):
            p.datos_manuales_obsoletos = not p.datos_manuales_obsoletos
            return 200, ESTADO.avanzar_tick(forzar_tick=False, forzar_llm=True)

        gluc = body.get("glucemia")
        animo = body.get("estado_animo")
        p.simulador.registrar_entrada_manual(
            glucemia=float(gluc) if gluc is not None else None,
            estado_animo=float(animo) if animo is not None else None,
        )
        p.datos_manuales_obsoletos = False
        p.ultimo_registro_manual_ts = _hora_local_actual()
        if gluc is not None:
            p.rutina_diaria["glucemia"] = True
        if animo is not None:
            p.rutina_diaria["animo"] = True
        return 200, ESTADO.avanzar_tick(forzar_tick=True, forzar_llm=True)

    def _post_intervention(self, p: PerfilTripulante, body: dict[str, Any]) -> tuple[int, Any]:
        tipo = str(body.get("tipo", ""))
        etiqueta = str(body.get("etiqueta", tipo))
        resumen = p.simulador.aplicar_intervencion(tipo)
        registrar_bitacora(p, f"{etiqueta} — {resumen}")
        if tipo in {"rcp_dea", "reposo_cv"} and p.emergencia_manual:
            p.emergencia_manual = False
        routine_map = {
            "glucosa_oral": "glucemia",
            "protocolo_conductual": "animo",
            "iluminacion_descanso": "sueno",
        }
        if tipo in routine_map:
            p.rutina_diaria[routine_map[tipo]] = True
        return 200, ESTADO.avanzar_tick(forzar_tick=True, forzar_llm=True)

    def _post_routine(self, p: PerfilTripulante, body: dict[str, Any]) -> tuple[int, Any]:
        key = str(body.get("key", ""))
        if key in p.rutina_diaria:
            p.rutina_diaria[key] = not p.rutina_diaria[key]
        return 200, ESTADO.snapshot()

    def _post_control(self, p: PerfilTripulante, body: dict[str, Any]) -> tuple[int, Any]:
        action = body.get("action")
        if action == "toggle_play":
            ESTADO.simulacion_activa = not ESTADO.simulacion_activa
            return 200, ESTADO.snapshot()
        if action == "clear_history":
            p.historico.clear()
            return 200, ESTADO.avanzar_tick(forzar_tick=True, forzar_llm=False)
        if action == "force_llm":
            return 200, ESTADO.avanzar_tick(forzar_tick=False, forzar_llm=True)
        return 400, {"error": f"Acción de control desconocida: {action}"}

    def _post_chat(self, p: PerfilTripulante, body: dict[str, Any]) -> tuple[int, Any]:
        pregunta = str(body.get("pregunta", "")).strip()
        historial = body.get("historial", [])
        ultima = p.historico[-1]
        lectura = {k: float(ultima[k]) for k in FEATURE_NAMES}
        resp = ESTADO.motor.consultar_asistente_interactivo(
            pregunta=pregunta,
            lectura=lectura,
            resultado_actual=p.ultimo_resultado,
            historial_chat=historial if isinstance(historial, list) else [],
        )
        return 200, resp


def main(host: str = DEFAULT_HOST, port: int = DEFAULT_PORT) -> None:
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
