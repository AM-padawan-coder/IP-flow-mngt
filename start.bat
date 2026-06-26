@echo off
chcp 1252 >nul
title IP Flow Manager

set ROOT=%~dp0
set NODE_DIR=%ROOT%tools\node
set PYTHON=%ROOT%tools\python\python.exe
set BACKEND=%ROOT%backend
set FRONTEND=%ROOT%frontend

:: Ajouter node au PATH pour que npm trouve les binaires locaux
set PATH=%NODE_DIR%;%NODE_DIR%\node_modules\npm\bin;%PATH%

echo.
echo =============================================
echo   IP Flow Manager - Demarrage
echo =============================================
echo.

if not exist "%PYTHON%" (
    echo [ERREUR] Python portable non trouve.
    echo          Veuillez d'abord lancer setup.bat
    pause & exit /b 1
)
if not exist "%NODE_DIR%\node.exe" (
    echo [ERREUR] Node.js portable non trouve.
    echo          Veuillez d'abord lancer setup.bat
    pause & exit /b 1
)

:: Reinstaller node_modules si vite est absent
if not exist "%FRONTEND%\node_modules\vite" (
    echo [!] node_modules incomplet - reinstallation...
    if exist "%FRONTEND%\node_modules" rmdir /s /q "%FRONTEND%\node_modules"
    if exist "%FRONTEND%\package-lock.json" del /q "%FRONTEND%\package-lock.json"
    cd /d "%FRONTEND%"
    "%NODE_DIR%\npm.cmd" install
    if errorlevel 1 (
        echo [ERREUR] Echec npm install.
        pause & exit /b 1
    )
)

echo [1/2] Demarrage du backend (port 8000)...
start "Backend - IP Flow Manager" cmd /k "cd /d "%BACKEND%" && "%PYTHON%" -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

echo [2/2] Demarrage du frontend (port 5173)...
start "Frontend - IP Flow Manager" cmd /k "set PATH=%NODE_DIR%;%PATH% && cd /d "%FRONTEND%" && "%NODE_DIR%\npm.cmd" run dev"

echo.
echo     Demarrage en cours, patientez 6 secondes...
timeout /t 6 /nobreak >nul
start "" http://localhost:5173

echo.
echo =============================================
echo   Backend  -^> http://localhost:8000
echo   Frontend -^> http://localhost:5173
echo   API docs -^> http://localhost:8000/docs
echo =============================================
echo.
echo   Fermez les deux fenetres pour arreter.
echo.
pause
