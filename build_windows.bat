@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build_windows.ps1"
if errorlevel 1 (
    echo.
    echo [ERROR] La compilacion fallo. Revisa los mensajes anteriores.
    pause
    exit /b 1
)
echo.
pause

