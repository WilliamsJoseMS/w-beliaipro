@echo off
setlocal enabledelayedexpansion

:: --- W-Beli.Ai Pro: Instalador Universal "One-Click" ---
:: Repositorio: https://github.com/WilliamsJoseMS/w-beliaipro

title W-Beli.Ai Pro - Instalador Automático
echo ==========================================================
echo       🤖 W-Beli.Ai Pro - Configuración del Sistema
echo ==========================================================
echo.

:: 1. Verificar si Git está instalado
where git >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [!] Git no detectado.
    echo [*] Descargando instalador de Git...
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/git-for-windows/git/releases/download/v2.44.0.windows.1/Git-2.44.0-64-bit.exe' -OutFile 'git_installer.exe'"
    echo [*] Ejecutando instalador de Git. Por favor, completa la instalacion.
    start /wait git_installer.exe /SILENT
    del git_installer.exe
    echo [*] Git instalado. Reinicia este script para continuar.
    pause
    exit
)

:: 2. Verificar si Node.js está instalado
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [!] Node.js no detectado.
    echo [*] Descargando Node.js v20 (LTS)...
    powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi' -OutFile 'node_installer.msi'"
    echo [*] Ejecutando instalador de Node.js...
    start /wait msiexec /i node_installer.msi /passive
    del node_installer.msi
    echo [*] Node.js instalado. Reinicia este script.
    pause
    exit
)

:: 3. Clonar el repositorio si no existe
if not exist "w-beliaipro\" (
    echo [*] Clonando el sistema desde GitHub...
    git clone https://github.com/WilliamsJoseMS/w-beliaipro.git
    cd w-beliaipro
) else (
    echo [*] Carpeta del proyecto detectada. Actualizando...
    cd w-beliaipro
    git pull origin main
)

:: 4. Instalar dependencias
if not exist "node_modules\" (
    echo [*] Instalando dependencias (esto puede tardar unos minutos)...
    call npm install
    echo [*] Recomponiendo base de datos SQLite...
    call npm rebuild better-sqlite3
)

:: 5. Configurar archivo de entorno (.env)
if not exist ".env" (
    echo [*] Creando archivo de configuracion inicial...
    if exist ".env.example" (
        copy .env.example .env >nul
    ) else (
        echo PORT=3000 > .env
    )
)

:: 6. Lanzar servidor en segundo plano e interfaz
echo.
echo ==========================================================
echo       🚀 Todo listo. Iniciando W-Beli.Ai Pro...
echo ==========================================================

:: Verificar si ya hay un proceso en el puerto 3000
netstat -ano | findstr :3000 | findstr LISTENING >nul
if %ERRORLEVEL% equ 0 (
    echo [*] El servidor ya esta corriendo. Abriendo navegador.
    start http://localhost:3000
    exit
)

:: Crear VBScript para ejecución invisible
echo Set WshShell = CreateObject("WScript.Shell") > run_invisible.vbs
echo WshShell.Run "cmd /c npm run dev", 0, False >> run_invisible.vbs

:: Ejecutar servidor
start wscript.exe run_invisible.vbs
timeout /t 5 /nobreak >nul
del run_invisible.vbs

:: Abrir el navegador
start http://localhost:3000

echo [*] El sistema se esta ejecutando en segundo plano.
echo [*] Puedes cerrar esta ventana. 
echo.
pause
exit
