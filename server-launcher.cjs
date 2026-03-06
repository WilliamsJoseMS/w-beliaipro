/**
 * W-Beli.Ai Pro - Server Launcher
 * 
 * This script is responsible for starting the backend server on port 3000.
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function startServer() {
    console.log('🚀 Launching Backend Server...');

    const serverPath = path.join(__dirname, 'server-compiled.cjs');
    const logsPath = path.join(process.cwd(), 'server-output.log');

    if (!fs.existsSync(serverPath)) {
        console.error('❌ Error: server-compiled.cjs not found at ' + serverPath);
        process.exit(1);
    }

    // Spawn as a detached process so it can keep running
    const child = spawn(process.execPath, [serverPath], {
        cwd: process.cwd(),
        detached: true,
        stdio: 'ignore', // We ignore stdio to prevent EPIPE errors in detached mode
        env: {
            ...process.env,
            NODE_ENV: 'production',
            PORT: '3000'
        }
    });

    child.unref(); // Allow the parent to exit without waiting for the child

    console.log('✅ Server spawn signal sent.');
    process.exit(0);
}

startServer();
