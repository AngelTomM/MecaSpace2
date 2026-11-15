"""
Lanzador de escritorio nativo para MecaSpace (Backend Python + Consola React).

Inicia el servidor HTTP local en un hilo en segundo plano sobre un puerto libre
y abre la interfaz en una ventana nativa de escritorio (sin navegador externo),
cerrando el servidor limpiamente al cerrar la ventana.
"""

from __future__ import annotations

import os
import socket
import sys
import threading
import time
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path


def _configure_stdio_for_noconsole() -> None:
    """Evita fallos de E/S cuando el ejecutable se compila sin consola (--noconsole)."""
    if sys.stdout is not None and sys.stderr is not None:
        return

    if os.name == "nt":
        base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    else:
        base = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))

    log_dir = base / "MecaSpace"
    try:
        log_dir.mkdir(parents=True, exist_ok=True)
        log_file = open(log_dir / "mecaspace.log", "a", encoding="utf-8", buffering=1)
    except OSError:
        log_file = open(os.devnull, "w", encoding="utf-8")

    if sys.stdout is None:
        sys.stdout = log_file
    if sys.stderr is None:
        sys.stderr = log_file


def _find_available_port(host: str = "127.0.0.1", preferred: int = 8000) -> int:
    """Devuelve `preferred` si está libre o un puerto efímero asignado por el SO."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        try:
            sock.bind((host, preferred))
            return preferred
        except OSError:
            pass

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind((host, 0))
        return int(sock.getsockname()[1])


def _wait_for_server(url: str, timeout_s: float = 15.0) -> None:
    """Espera hasta que el servidor HTTP responda en `url`."""
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1.0) as resp:
                if resp.status < 500:
                    return
        except Exception:
            time.sleep(0.05)


def main() -> None:
    _configure_stdio_for_noconsole()

    from server import MecaSpaceHandler

    host = "127.0.0.1"
    port = _find_available_port(host=host, preferred=8000)
    url = f"http://{host}:{port}"

    httpd = ThreadingHTTPServer((host, port), MecaSpaceHandler)
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()

    print(f"[MECASPACE] Servidor local iniciado en {url}")
    _wait_for_server(f"{url}/api/state")

    try:
        import webview

        webview.create_window(
            title="MecaSpace — Monitor Biomédico NASA-STD-3001",
            url=url,
            width=1440,
            height=900,
            min_size=(1024, 700),
            resizable=True,
        )
        webview.start()
    except ImportError:
        import webbrowser

        print("[MECASPACE] pywebview no disponible; abriendo en navegador predeterminado.")
        webbrowser.open(url)
        try:
            while server_thread.is_alive():
                time.sleep(0.5)
        except KeyboardInterrupt:
            pass
    finally:
        httpd.shutdown()
        httpd.server_close()
        print("[MECASPACE] Servidor detenido.")


if __name__ == "__main__":
    main()

