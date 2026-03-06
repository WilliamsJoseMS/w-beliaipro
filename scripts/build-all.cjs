/**
 * W-Beli.Ai Pro — Master Build Script
 * 
 * Orchestrates the full build pipeline:
 * 1. Create icon from PNG
 * 2. Build frontend (Vite)
 * 3. Compile server (esbuild) — for run-server.bat (NOT packaged in EXE)
 * 4. Package Electron app (frontend only) with electron-builder
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');

function run(cmd, label) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔨 ${label}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`> ${cmd}\n`);

    try {
        execSync(cmd, {
            cwd: ROOT,
            stdio: 'inherit',
            env: { ...process.env, NODE_ENV: 'production' }
        });
        console.log(`✅ ${label} — DONE\n`);
    } catch (error) {
        console.error(`\n❌ ${label} — FAILED`);
        process.exit(1);
    }
}

function verify(filePath, label) {
    if (!fs.existsSync(filePath)) {
        console.error(`❌ Verification failed: ${label} not found at ${filePath}`);
        process.exit(1);
    }
    const stats = fs.statSync(filePath);
    const sizeKB = (stats.size / 1024).toFixed(1);
    console.log(`   ✓ ${label}: ${sizeKB} KB`);
}

console.log(`
╔══════════════════════════════════════════════════════════╗
║    W-Beli.Ai Pro — Build System v3.0                    ║
║    All-in-one Installer with Backend & Frontend           ║
╚══════════════════════════════════════════════════════════╝
`);

// Parse arguments
const args = process.argv.slice(2);
const buildX64 = args.length === 0 || args.includes('--x64') || args.includes('--all');
const buildX86 = args.length === 0 || args.includes('--x86') || args.includes('--all');

console.log(`Build targets: ${buildX64 ? 'x64' : ''} ${buildX86 ? 'x86' : ''}`);

// Step 1: Create icon
run('node scripts/create-icon.cjs', 'Step 1/4: Create ICO icon');
verify(path.join(ROOT, 'assets', 'icons', 'icon.ico'), 'Icon file');

// Step 2: Build frontend
run('npx vite build', 'Step 2/4: Build frontend (Vite)');
verify(path.join(ROOT, 'dist', 'index.html'), 'Frontend index.html');

// Step 3: Compile server
run('node scripts/build-server.cjs', 'Step 3/4: Compile server (for run-server.bat/EXE bundle)');
verify(path.join(ROOT, 'server-compiled.cjs'), 'Compiled server');

// Step 4: Package Electron app
console.log(`\n${'='.repeat(60)}`);
console.log('🔨 Step 4/4: Package Final Electron app (Frontend + Backend)');
console.log(`${'='.repeat(60)}\n`);

if (buildX64) {
    run('npx electron-builder --win --x64', 'Packaging x64 build');
}

if (buildX86) {
    run('npx electron-builder --win --ia32', 'Packaging x86 (ia32) build');
}

// Final verification
console.log(`\n${'='.repeat(60)}`);
console.log('📋 Build Verification');
console.log(`${'='.repeat(60)}\n`);

const outputDir = path.join(ROOT, 'dist-electron');
if (fs.existsSync(outputDir)) {
    const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.exe') && !f.includes('unpacked'));
    if (files.length > 0) {
        console.log('📦 Generated executables (Frontend + Backend Bundle):');
        for (const file of files) {
            const filePath = path.join(outputDir, file);
            const stats = fs.statSync(filePath);
            const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
            console.log(`   ✓ ${file} (${sizeMB} MB)`);
        }
    } else {
        console.log('⚠️ No .exe files found in dist-electron/');
    }
} else {
    console.log('⚠️ dist-electron/ directory not found');
}

console.log(`
╔══════════════════════════════════════════════════════════╗
║          ✅ BUILD COMPLETE                               ║
║                                                          ║
║  📌 Un Solo Archivo Instalador generado                  ║
║  - Incluye Frontend + Backend + Base de datos            ║
║  - Crea automáticamente accesos directos de ambos        ║
║  - No requiere que el cliente instale Node.js            ║
╚══════════════════════════════════════════════════════════╝
`);
