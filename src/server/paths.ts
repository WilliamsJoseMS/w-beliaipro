import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * Gets the persistent data directory for the application.
 * In production (app packaged), it points to %AppData%/W-Beli-Ai-Pro.
 * In development, it points to the project root.
 */
export function getAppDataDir(): string {
    // If we are running in a packaged environment (pkg)
    const isPkg = (process as any).pkg !== undefined;

    if (isPkg || process.env.NODE_ENV === 'production') {
        const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : os.homedir());
        const dataDir = path.join(appData, 'W-Beli-Ai-Pro');

        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        return dataDir;
    }

    // Default to current working directory in dev
    return process.cwd();
}

/**
 * Resolves the path to the 'dist' folder (Vite frontend).
 * Handles the difference between local dev and packaged pkg environment.
 */
export function getDistDir(): string {
    if ((process as any).pkg) {
        // First check next to EXE (typical for installer setup)
        const externalDist = path.join(path.dirname(process.execPath), 'dist');
        if (fs.existsSync(externalDist)) {
            return externalDist;
        }
        // Fallback to internal snapshot folder
        return path.join(__dirname, 'dist');
    }

    return path.join(process.cwd(), 'dist');
}
