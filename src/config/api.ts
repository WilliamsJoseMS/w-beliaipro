/**
 * API Configuration
 * Automatically detects the correct server URL based on the current browser location.
 * This allows the app to work from any device on the network, not just localhost.
 */

// In production, use the current browser origin (works from any IP/hostname)
// In development, use localhost:3000
const isDev = (import.meta as any).env?.DEV;

export const API_BASE = isDev ? 'http://localhost:3000' : window.location.origin;
export const WS_URL = API_BASE;

export function apiUrl(path: string): string {
    return `${API_BASE}${path}`;
}
