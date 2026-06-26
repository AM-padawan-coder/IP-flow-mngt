@echo off
chcp 1252 >nul
title IP Flow Manager - Installation

echo.
echo =============================================
echo   IP Flow Manager - Installation autonome
echo =============================================
echo.
echo   Telechargement de Python et Node.js
echo   en version portable (aucune installation
echo   systeme requise).
echo.

set ROOT=%~dp0
set TOOLS=%ROOT%tools
set PYTHON_DIR=%TOOLS%\python
set NODE_DIR=%TOOLS%\node

set PYTHON_VERSION=3.11.9
set PYTHON_ZIP=python-%PYTHON_VERSION%-embed-amd64.zip
set PYTHON_URL=https://www.python.org/ftp/python/%PYTHON_VERSION%/%PYTHON_ZIP%

set NODE_VERSION=20.15.1
set NODE_ZIP=node-v%NODE_VERSION%-win-x64.zip
set NODE_FOLDER=node-v%NODE_VERSION%-win-x64
set NODE_URL=https://nodejs.org/dist/v%NODE_VERSION%/%NODE_ZIP%

if not exist "%TOOLS%" mkdir "%TOOLS%"

:: ── Python embarque ────────────────────────────────────────────────────────
if exist "%PYTHON_DIR%\python.exe" (
    echo [OK] Python portable deja present.
) else (
    echo [1/5] Telechargement de Python %PYTHON_VERSION% portable...
    powershell -NoProfile -Command "Invoke-WebRequest -Uri '%PYTHON_URL%' -OutFile '%TOOLS%\%PYTHON_ZIP%' -UseBasicParsing"
    if not exist "%TOOLS%\%PYTHON_ZIP%" (
        echo [ERREUR] Echec du telechargement de Python.
        pause & exit /b 1
    )

    echo [2/5] Extraction de Python...
    if not exist "%PYTHON_DIR%" mkdir "%PYTHON_DIR%"
    powershell -NoProfile -Command "Expand-Archive -Path '%TOOLS%\%PYTHON_ZIP%' -DestinationPath '%PYTHON_DIR%' -Force"
    del "%TOOLS%\%PYTHON_ZIP%"

    powershell -NoProfile -Command "Get-ChildItem '%PYTHON_DIR%' -Filter '*._pth' | ForEach-Object { (Get-Content $_.FullName) -replace '#import site','import site' | Set-Content $_.FullName }"

    echo [3/5] Installation de pip...
    powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile '%TOOLS%\get-pip.py' -UseBasicParsing"
    "%PYTHON_DIR%\python.exe" "%TOOLS%\get-pip.py" --no-warn-script-location -q
    del "%TOOLS%\get-pip.py"
)

:: ── Node.js portable ───────────────────────────────────────────────────────
if exist "%NODE_DIR%\node.exe" (
    echo [OK] Node.js portable deja present.
) else (
    echo [4/5] Telechargement de Node.js %NODE_VERSION% portable...
    powershell -NoProfile -Command "Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%TOOLS%\%NODE_ZIP%' -UseBasicParsing"
    if not exist "%TOOLS%\%NODE_ZIP%" (
        echo [ERREUR] Echec du telechargement de Node.js.
        pause & exit /b 1
    )

    echo      Extraction de Node.js...
    powershell -NoProfile -Command "Expand-Archive -Path '%TOOLS%\%NODE_ZIP%' -DestinationPath '%TOOLS%' -Force"
    move "%TOOLS%\%NODE_FOLDER%" "%NODE_DIR%"
    del "%TOOLS%\%NODE_ZIP%" 2>nul
)

:: ── Dependances Python ─────────────────────────────────────────────────────
echo [5/5] Installation des librairies Python...
"%PYTHON_DIR%\python.exe" -m pip install -q -r "%ROOT%backend\requirements.txt" --no-warn-script-location
if errorlevel 1 (
    echo [ERREUR] Echec de l'installation des librairies Python.
    pause & exit /b 1
)

:: ── Dependances Node.js ────────────────────────────────────────────────────
echo      Installation des librairies Node.js...
cd /d "%ROOT%frontend"

:: Supprimer node_modules et package-lock.json (binaires specifiques a la plateforme)
if exist "node_modules" (
    echo      Suppression de l'ancien node_modules...
    rmdir /s /q "node_modules"
)
if exist "package-lock.json" del /q "package-lock.json"

"%NODE_DIR%\npm.cmd" install
if errorlevel 1 (
    echo [ERREUR] Echec de l'installation des librairies Node.js.
    pause & exit /b 1
)

echo.
echo =============================================
echo   Installation terminee avec succes !
echo   Lancez start.bat pour demarrer la demo.
echo =============================================
echo.
pause
