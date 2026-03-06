const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');

async function buildStandalone() {
    console.log('🚀 [W-Beli.Ai Pro] Starting Standalone Packaging Process...');

    const distFolder = path.join(ROOT, 'dist-standalone');

    // 1. Clean and Create dist-standalone
    try {
        if (fs.existsSync(distFolder)) {
            console.log('🧹 Cleaning previous build directory...');
            fs.rmSync(distFolder, { recursive: true, force: true });
        }
        fs.mkdirSync(distFolder, { recursive: true });
    } catch (e) {
        console.error('❌ Failed to prepare dist-standalone folder:', e.message);
    }

    try {
        // 2. Build Frontend (Vite)
        console.log('📦 Step 1/6: Building Frontend (Vite)...');
        execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });

        // 3. Compile Server (esbuild)
        console.log('📦 Step 2/6: Compiling Server Bundle (esbuild)...');
        execSync('node scripts/build-server.cjs', { cwd: ROOT, stdio: 'inherit' });

        // 4. Create Standalone Server (pkg)
        console.log('📦 Step 3/6: Creating Standalone EXE (pkg)...');
        // Removing --no-bytecode as it was causing "breaks final executable" error
        const pkgCmd = 'npx pkg server-compiled.cjs --targets node18-win-x64 --output dist-standalone/W-Beli-Ai-Server.exe';
        execSync(pkgCmd, { cwd: ROOT, stdio: 'inherit' });

        // 5. Copy Frontend dist folder
        console.log('📦 Step 4/6: Copying frontend assets...');
        function copyFolderSync(from, to) {
            if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
            fs.readdirSync(from).forEach(element => {
                const srcPath = path.join(from, element);
                const destPath = path.join(to, element);
                if (fs.lstatSync(srcPath).isDirectory()) {
                    copyFolderSync(srcPath, destPath);
                } else {
                    fs.copyFileSync(srcPath, destPath);
                }
            });
        }
        if (fs.existsSync(path.join(ROOT, 'dist'))) {
            copyFolderSync(path.join(ROOT, 'dist'), path.join(distFolder, 'dist'));
        }

        // 5.5. Copy .env file (Optional but recommended for user overrides if needed)
        console.log('📦 Step 4.5/6: Copying .env file...');
        if (fs.existsSync(path.join(ROOT, '.env'))) {
            fs.copyFileSync(path.join(ROOT, '.env'), path.join(distFolder, '.env'));
            console.log('   ✅ copied .env');
        } else if (fs.existsSync(path.join(ROOT, '.env.example'))) {
            fs.copyFileSync(path.join(ROOT, '.env.example'), path.join(distFolder, '.env'));
            console.log('   ✅ created .env from .env.example');
        }

        // 6. Copy Native Binaries (Crucial for better-sqlite3 and sharp)
        console.log('📦 Step 5/6: Copying native binaries...');

        // better-sqlite3
        const sqliteBinary = path.join(ROOT, 'node_modules/better-sqlite3/build/Release/better_sqlite3.node');
        const sqlitePrebuild = path.join(ROOT, 'node_modules/better-sqlite3/prebuilds/win32-x64/node.napi.node');

        if (fs.existsSync(sqliteBinary)) {
            fs.copyFileSync(sqliteBinary, path.join(distFolder, 'better_sqlite3.node'));
            console.log('   ✅ copied better_sqlite3.node');
        } else if (fs.existsSync(sqlitePrebuild)) {
            fs.copyFileSync(sqlitePrebuild, path.join(distFolder, 'better_sqlite3.node'));
            console.log('   ✅ copied better_sqlite3.node (from prebuilds)');
        }

        // 7. Create the "Lanzador" (Runner Script)
        console.log('📦 Step 6/6: Creating Runner Script (W-Beli-Ai.bat)...');

        // Load variables to bake them as fallbacks in the BAT if needed
        require('dotenv').config({ path: path.join(ROOT, '.env') });
        const bakedUrl = process.env.VITE_SUPABASE_URL || '';
        const bakedKey = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        const bakedGemini = process.env.GEMINI_API_KEY || '';

        const batContent = `@echo off
title W-Beli.Ai Pro Launcher
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

echo.
echo ============================================================
echo   W-Beli.Ai Pro - Sistema de Automatizacion
echo ============================================================
echo.

:: Set fallback environment variables if they are not in .env
if "%VITE_SUPABASE_URL%"=="" set "VITE_SUPABASE_URL=${bakedUrl}"
if "%SUPABASE_SERVICE_ROLE%"=="" set "SUPABASE_SERVICE_ROLE=${bakedKey}"
if "%GEMINI_API_KEY%"=="" set "GEMINI_API_KEY=${bakedGemini}"

echo [INFO] Verificando entorno...
if not exist ".env" (
    echo [WARN] Archivo .env no encontrado. Usando configuracion predeterminada.
)

echo [1/2] Iniciando servidor en segundo plano...
:: Inicia el servidor
start /b "" "W-Beli-Ai-Server.exe"

echo [2/2] Esperando a que el sistema este listo...
set /a attempt=0
:wait
set /a attempt+=1
if %attempt% GEQ 30 (
    echo.
    echo [ERROR] El servidor tarda demasiado en responder.
    echo Intenta abrir: http://localhost:3000 manualmente.
    pause
    exit
)
timeout /t 2 /nobreak >nul
netstat -ano | find "LISTENING" | find ":3000" >nul
if errorlevel 1 goto wait

echo.
echo ✅ Todo listo! Abriendo el navegador...
start http://localhost:3000
echo.
echo Esta ventana se cerrara en 5 segundos...
timeout /t 5 >nul
exit`.replace(/\$\{bakedUrl\}/g, bakedUrl)
            .replace(/\$\{bakedKey\}/g, bakedKey)
            .replace(/\$\{bakedGemini\}/g, bakedGemini);

        fs.writeFileSync(path.join(distFolder, 'W-Beli-Ai-Pro.bat'), batContent);

        console.log('\n✨ [W-Beli.Ai Pro] Standalone build complete!');
        console.log('Output location: ' + distFolder);
        console.log('Files in package:');
        fs.readdirSync(distFolder).forEach(f => console.log(` - ${f}`));

    } catch (error) {
        console.error('\n❌ Build process failed:', error.message);
        process.exit(1);
    }
}

buildStandalone();
