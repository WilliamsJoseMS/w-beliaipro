import { Router } from 'express';
import { checkLicense, getLicenseStatus, getMachineId, LicenseStatus, getAllLicenses, createLicense, updateLicense, deleteLicense } from './license.js';
import { getSetting, setSetting } from './db.js';

const router = Router();

router.get('/status', async (req, res) => {
    const status = getLicenseStatus();
    const savedKey = getSetting('license_key') as string;
    const clientState = req.query.state as string;

    // Refresh if state provided or if status is stale
    if (savedKey && (clientState || !status.lastCheckedAt || Date.now() - status.lastCheckedAt > 60 * 1000)) {
        const newStatus = await checkLicense(savedKey, clientState);
        return res.json(newStatus);
    }

    res.json(status);
});

router.get('/machine-id', (req, res) => {
    res.json({ machineId: getMachineId() });
});

router.post('/activate', async (req, res) => {
    const { licenseKey } = req.body;
    if (!licenseKey) {
        return res.status(400).json({ error: 'License key is required' });
    }

    const status = await checkLicense(licenseKey);
    if (status.isValid) {
        setSetting('license_key', licenseKey);
        res.json(status);
    } else {
        res.status(403).json(status);
    }
});

// Admin routes
router.get('/admin/list', async (req, res) => {
    try {
        const adminKey = req.headers['x-admin-key'];
        if (adminKey !== process.env.VITE_SUPABASE_ANON_KEY) { // Using the anon key as a temporary admin key for simplicity
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const licenses = await getAllLicenses();
        res.json(licenses);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/admin/create', async (req, res) => {
    try {
        const adminKey = req.headers['x-admin-key'];
        if (adminKey !== process.env.VITE_SUPABASE_ANON_KEY) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const license = await createLicense(req.body);
        res.json(license);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.patch('/admin/update/:id', async (req, res) => {
    try {
        const adminKey = req.headers['x-admin-key'];
        if (adminKey !== process.env.VITE_SUPABASE_ANON_KEY) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const license = await updateLicense(req.params.id, req.body);
        res.json(license);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/admin/delete/:id', async (req, res) => {
    try {
        const adminKey = req.headers['x-admin-key'];
        if (adminKey !== process.env.VITE_SUPABASE_ANON_KEY) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        await deleteLicense(req.params.id);
        res.json({ message: 'Deleted' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Middleware to protect API routes
 */
export const protectWithLicense = async (req: any, res: any, next: any) => {
    let status = getLicenseStatus();
    const savedKey = getSetting('license_key') as string;

    // Allow these routes even without a license
    const publicRoutes = [
        '/api/license/status',
        '/api/license/activate',
        '/api/license/machine-id',
        '/api/license/admin',
        '/api/ping',
        '/api/time'
    ];

    // Only protect /api routes. Static files, Vite, etc should be accessible.
    if (!req.path.startsWith('/api')) {
        return next();
    }

    if (publicRoutes.some(route => req.path.startsWith(route))) {
        return next();
    }

    // Refresh if stale
    if (savedKey && (!status.lastCheckedAt || Date.now() - status.lastCheckedAt > 5 * 60 * 1000)) {
        status = await checkLicense(savedKey);
    }

    if (!status.isValid) {
        return res.status(402).json({
            error: 'License Required',
            message: status.message || 'Tu licencia ha expirado o no es válida.',
            ...status
        });
    }

    next();
};

export default router;
