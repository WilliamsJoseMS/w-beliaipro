import { execSync } from 'child_process';
import os from 'os';
import { supabaseAdmin } from './supabase.js';

let machineIdStr: string | null = null;

export function getMachineId(): string {
    if (machineIdStr) return machineIdStr;

    try {
        if (os.platform() === 'win32') {
            const output = execSync('reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid').toString();
            const match = /MachineGuid\s+REG_SZ\s+([a-fA-F0-9-]+)/.exec(output);
            if (match) machineIdStr = match[1];
        } else if (os.platform() === 'linux') {
            try {
                machineIdStr = execSync('cat /etc/machine-id').toString().trim();
            } catch {
                machineIdStr = execSync('cat /var/lib/dbus/machine-id').toString().trim();
            }
        } else if (os.platform() === 'darwin') {
            machineIdStr = execSync('ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID').toString().split('"')[3];
        }
    } catch (error) {
        console.warn('Failed to get hardware machine-id, falling back to hostname:', error);
        machineIdStr = os.hostname();
    }

    if (!machineIdStr) machineIdStr = 'unknown-machine-id';
    return machineIdStr;
}

export type LicenseStatus = {
    isValid: boolean;
    message?: string;
    expirationDate?: string;
    clientName?: string;
    managerName?: string;
    lastCheckedAt?: number;
};

let currentStatus: LicenseStatus = { isValid: true, lastCheckedAt: Date.now() }; // Allow start during init

export async function checkLicense(licenseKey: string, clientState?: string): Promise<LicenseStatus> {
    const machineId = getMachineId();

    try {
        const { data: license, error } = await supabaseAdmin
            .from('licenses')
            .select('*')
            .eq('key', licenseKey)
            .single();

        if (error || !license) {
            currentStatus = { isValid: false, message: 'Licencia inválida o no encontrada.' };
            return currentStatus;
        }

        // Always record client presence if record exists
        await supabaseAdmin
            .from('licenses')
            .update({
                last_check_in: new Date().toISOString(),
                client_state: clientState || 'ONLINE'
            })
            .eq('id', license.id);

        // Check if machine_id matches, or assign it if it's the first time
        if (!license.machine_id) {
            // Assign this machine_id to the license
            await supabaseAdmin
                .from('licenses')
                .update({ machine_id: machineId })
                .eq('id', license.id);
        } else if (license.machine_id !== machineId) {
            currentStatus = { isValid: false, message: 'Esta licencia está siendo usada en otro computador.' };
            return currentStatus;
        }

        // Check expiration date
        const now = new Date();
        const expiry = new Date(license.expiration_date);
        if (expiry < now) {
            currentStatus = { isValid: false, message: 'Tu licencia ha expirado. Por favor, realiza el pago mensual.' };
            return currentStatus;
        }

        // Check manual active flag
        if (license.is_active === false) {
            currentStatus = { isValid: false, message: 'Tu licencia ha sido suspendida. Contacta con soporte.' };
            return currentStatus;
        }

        // Success status

        const { setSetting } = await import('./db.js');
        setSetting('client_name', license.client_name);

        currentStatus = {
            isValid: true,
            expirationDate: license.expiration_date,
            clientName: license.client_name,
            managerName: license.manager_name,
            lastCheckedAt: Date.now()
        };
        return currentStatus;

    } catch (error) {
        console.error('Error verifying license:', error);
        // In case of network error, we might want a grace period or just fail
        // For now, let's keep it restrictive
        return { isValid: false, message: 'Error de conexión al verificar licencia.' };
    }
}

export function getLicenseStatus(): LicenseStatus {
    return currentStatus;
}

// Admin functions
export async function getAllLicenses() {
    const { data, error } = await supabaseAdmin
        .from('licenses')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

export async function createLicense(payload: any) {
    const { data, error } = await supabaseAdmin
        .from('licenses')
        .insert([payload])
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateLicense(id: string, payload: any) {
    const { data, error } = await supabaseAdmin
        .from('licenses')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteLicense(id: string) {
    const { error } = await supabaseAdmin
        .from('licenses')
        .delete()
        .eq('id', id);
    if (error) throw error;
    return true;
}
