@echo off
chcp 65001 >nul 2>&1
TITLE W-Beli.Ai Pro - Backend Server
color 0A

:: This will force the Electron executable to act just like Node.js
SET ELECTRON_RUN_AS_NODE=1
SET NODE_ENV=production
SET PORT=3000

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║       W-Beli.Ai Pro - Servidor Backend               ║
echo  ║       Puerto: 3000                                   ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

:: Check if running from packaged installation (resources config)
IF EXIST "%~dp0..\W-Beli.Ai Pro.exe" (
    echo  [INFO] Modo Instalado detectado.
    echo  [INFO] Usando el motor interno de la aplicacion (sin requerir Node.js externo)
    echo  [INFO] Iniciando servidor en: http://localhost:%PORT%
    echo  [INFO] Presiona Ctrl+C para detener el servidor.
    echo.
    echo  ──────────────────────────────────────────────────────
    echo.
    "%~dp0..\W-Beli.Ai Pro.exe" "%~dp0app.asar\server-compiled.cjs"
) ELSE (
    :: Fallback in case they run it directly from Dev directory
    IF EXIST "%~dp0server-compiled.cjs" (
        echo  [INFO] Modo Desarrollo detectado.
        echo  [INFO] El servidor estara disponible en: http://localhost:%PORT%
        echo  [INFO] Presiona Ctrl+C para detener el servidor.
        echo.
        echo  ──────────────────────────────────────────────────────
        echo.
        node "%~dp0server-compiled.cjs"
    ) ELSE (
        echo  [ERROR] No se pudo encontrar el servidor compilado.
        pause
        exit /b 1
    )
)

echo.
echo  ──────────────────────────────────────────────────────
echo.
IF %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] El servidor se detuvo con error (Codigo: %ERRORLEVEL%)
) ELSE (
    echo  [INFO] El servidor se detuvo correctamente.
)
echo.
echo  Presiona cualquier tecla para cerrar...
pause >nul
