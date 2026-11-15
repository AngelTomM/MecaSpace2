$ErrorActionPreference = "Stop"

Write-Host "=== MecaSpace: Compilación de Ejecutable e Instalador Windows ===" -ForegroundColor Cyan

# 1. Verificar Python y Node.js
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    throw "Python no encontrado en PATH. Instala Python 3.11+ para Windows."
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm no encontrado en PATH. Instala Node.js LTS para compilar el frontend."
}

# 2. Compilar frontend React
Write-Host "`n[1/4] Compilando frontend React (frontend/dist)..." -ForegroundColor Yellow
if (-not (Test-Path "frontend\node_modules")) {
    npm --prefix frontend ci
}
npm --prefix frontend run build

# 3. Entorno virtual de compilación
Write-Host "`n[2/4] Preparando entorno virtual .venv-build..." -ForegroundColor Yellow
if (-not (Test-Path ".venv-build\Scripts\python.exe")) {
    python -m venv .venv-build
}
$VenvPy = ".venv-build\Scripts\python.exe"
& $VenvPy -m pip install --upgrade pip
& $VenvPy -m pip install -r requirements-desktop.txt

# 4. Empaquetar con PyInstaller
Write-Host "`n[3/4] Empaquetando ejecutable con PyInstaller (dist\MecaSpace\MecaSpace.exe)..." -ForegroundColor Yellow
& $VenvPy -m PyInstaller --noconfirm --clean MecaSpace.spec

# 5. Generar instalador con Inno Setup (si está disponible)
Write-Host "`n[4/4] Buscando Inno Setup (ISCC.exe)..." -ForegroundColor Yellow
$Iscc = (Get-Command iscc -ErrorAction SilentlyContinue).Source
if (-not $Iscc) {
    $DefaultIscc = "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe"
    if (Test-Path $DefaultIscc) {
        $Iscc = $DefaultIscc
    }
}

if ($Iscc) {
    & $Iscc installer.iss
    Write-Host "`nLISTO: Instalador generado en Output\MecaSpace_Setup.exe" -ForegroundColor Green
} else {
    Write-Host "`nAVISO: Ejecutable listo en dist\MecaSpace\MecaSpace.exe." -ForegroundColor Yellow
    Write-Host "Para generar el instalador MecaSpace_Setup.exe, instala Inno Setup 6 y ejecuta: iscc installer.iss" -ForegroundColor Yellow
}

