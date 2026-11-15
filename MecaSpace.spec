# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path
from PyInstaller.utils.hooks import collect_all, collect_submodules

ROOT = Path(SPECPATH)

xgb_datas, xgb_binaries, xgb_hidden = collect_all("xgboost")
shap_datas, shap_binaries, shap_hidden = collect_all("shap")
webview_hidden = collect_submodules("webview")

datas = [
    (str(ROOT / "frontend" / "dist"), "frontend/dist"),
    (str(ROOT / "data"), "data"),
    (str(ROOT / "modelo_xgb.json"), "."),
    (str(ROOT / "protocolos_medicos_nasa.md"), "."),
    (str(ROOT / "Cuerpo Humano.png"), "."),
] + xgb_datas + shap_datas

binaries = xgb_binaries + shap_binaries

hiddenimports = (
    [
        "sklearn.utils._typedefs",
        "sklearn.neighbors._partition_nodes",
        "sklearn.tree._utils",
        "scipy.special.cython_special",
        "clr",
        "bottle",
        "proxy_tools",
    ]
    + xgb_hidden
    + shap_hidden
    + webview_hidden
)

a = Analysis(
    [str(ROOT / "desktop_app.py")],
    pathex=[str(ROOT)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["streamlit", "plotly", "matplotlib", "tkinter", "PyQt5", "PyQt6", "PySide6"],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="MecaSpace",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="MecaSpace",
)

