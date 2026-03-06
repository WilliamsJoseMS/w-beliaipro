import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { checkLicense, getLicenseStatus } from './src/server/license.js';
import { getSetting } from './src/server/db.js';
import licenseRoutes, { protectWithLicense } from './src/server/licenseRoutes.js';
import { getAppDataDir, getDistDir } from './src/server/paths.js';

const sanitizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9.\-_]/g, '_');

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });
  const PORT = 3000;

  // 1. Middleware
  app.use(express.json());
  app.use(protectWithLicense);
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });
  const upload = multer({ dest: 'uploads/' });

  // 2. Initialize services before setting up routes
  const clientName = getSetting('client_name') || 'Desconocido';
  console.log(`[Server] Initializing services for client: ${clientName}...`);
  const dataDir = getAppDataDir();
  if (!fs.existsSync(path.join(dataDir, 'sessions'))) fs.mkdirSync(path.join(dataDir, 'sessions'), { recursive: true });
  if (!fs.existsSync(path.join(dataDir, 'uploads'))) fs.mkdirSync(path.join(dataDir, 'uploads'), { recursive: true });

  const [
    { whatsapp },
    { messageQueue },
    { campaignManager },
    { statusManager },
    dbModule,
    { uploadToSupabase },
  ] = await Promise.all([
    import('./src/server/whatsapp'),
    import('./src/server/queue'),
    import('./src/server/campaignManager'),
    import('./src/server/statusManager'),
    import('./src/server/db'),
    import('./src/server/storage'),
  ]);

  const { generateTaskId } = dbModule;

  const services = { whatsapp, messageQueue, campaignManager, statusManager, db: dbModule.default, uploadToSupabase };
  console.log('[Server] Services initialized successfully.');

  // Wire up the message queue to the WhatsApp service
  services.messageQueue.on('process', async (job: any) => {
    try {
      console.log(`[Server] Processing job ${job.id} via WhatsApp service...`);
      await services.whatsapp.sendMessage(job.jid, job.content, job.type);
      services.messageQueue.complete(job.id);
      console.log(`[Server] Job ${job.id} completed successfully.`);
    } catch (error: any) {
      console.error(`[Server] Failed to send message for job ${job.id}:`, error.message);
      services.messageQueue.fail(job.id, error.message);
    }
  });

  // 3. API Routes
  app.use('/api/license', licenseRoutes);

  app.get('/api/ping', (req, res) => res.json({ message: 'pong' }));

  app.get('/favicon.ico', (req, res) => res.status(204).end());

  app.get('/api/time', (req, res) => {
    const now = new Date();
    res.json({
      iso: now.toISOString(),
      local: now.toLocaleString('en-US'),
      local12: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }),
      hours: now.getHours(),
      minutes: now.getMinutes(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
  });

  app.get('/api/status', async (req, res) => {
    const userInfo = await services.whatsapp.getUserInfo();
    res.json({
      connected: services.whatsapp.isConnected,
      qr: services.whatsapp.qr,
      user: userInfo || services.whatsapp.sock?.user
    });
  });

  app.post('/api/connect', async (req, res) => {
    if (!services.whatsapp.isConnected) {
      await services.whatsapp.connect();
      res.json({ message: 'Connecting...' });
    } else {
      res.json({ message: 'Already connected' });
    }
  });

  app.post('/api/disconnect', async (req, res) => {
    if (services.whatsapp.isConnected) {
      await services.whatsapp.logout();
      res.json({ message: 'Disconnected' });
    } else {
      res.json({ message: 'Not connected' });
    }
  });

  app.post('/api/reset', async (req, res) => {
    try {
      await services.whatsapp.reset();
      res.json({ message: 'Resetting...' });
    } catch (error) {
      res.status(500).json({ error: 'Failed' });
    }
  });

  app.get('/api/groups', async (req, res) => {
    try {
      const groups = await services.whatsapp.getGroups();
      res.json(groups);
    } catch (error) {
      console.error('Error fetching groups:', error);
      res.json([]); // Return empty array instead of 500 to prevent frontend errors
    }
  });

  app.post('/api/groups/:id/leave', async (req, res) => {
    try {
      const groupId = req.params.id;
      await services.whatsapp.leaveAndDeleteGroup(groupId);
      res.json({ success: true, message: 'Group left and deleted' });
    } catch (error: any) {
      console.error(`[Server] Error leaving group ${req.params.id}:`, error);
      res.status(500).json({ error: error.message || 'Failed to leave/delete group' });
    }
  });

  app.get('/api/contacts', async (req, res) => {
    try {
      const contacts = await services.whatsapp.getContacts();
      res.json(contacts || []);
    } catch (error) {
      console.error('[Server] Error fetching contacts:', error);
      res.json([]);
    }
  });

  app.get('/api/avatar/:jid', async (req, res) => {
    try {
      const url = await services.whatsapp.getAvatarUrl(req.params.jid);
      res.json({ url });
    } catch (error) {
      res.json({ url: null });
    }
  });

  app.get('/api/settings', (req, res) => {
    const rows = services.db.prepare('SELECT * FROM settings').all() as any[];
    const settings: any = {};
    rows.forEach((r: any) => {
      try { settings[r.key] = JSON.parse(r.value); } catch { settings[r.key] = r.value; }
    });
    res.json(settings);
  });

  app.post('/api/settings', (req, res) => {
    const stmt = services.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    services.db.transaction(() => {
      for (const [k, v] of Object.entries(req.body)) {
        stmt.run(k, JSON.stringify(v));
      }
    })();
    res.json({ message: 'Saved' });
  });

  app.get('/api/campaigns', (req, res) => {
    res.json(services.campaignManager.getAll());
  });

  app.post('/api/campaigns', upload.single('file'), async (req, res) => {
    const { name, recipients, type, text, caption, days, times, start_date, end_date, footer, buttons, urlButtons } = req.body;
    let content: any = {};

    // Base content construction
    if (req.file) {
      const safeName = sanitizeFileName(req.file.originalname);
      const url = await services.uploadToSupabase(req.file.path, `${Date.now()}-${safeName}`, req.file.mimetype);
      content = {
        url,
        caption: caption || '',
        fileName: req.file.originalname,
        mimetype: req.file.mimetype
      };
      fs.unlinkSync(req.file.path);
    } else {
      content = {
        text: text || '',
        caption: caption || ''
      };
    }

    // Add footer if present
    if (footer) {
      content.footer = footer;
    }

    // Add buttons if present
    if (buttons) {
      try {
        const parsedButtons = JSON.parse(buttons);
        if (parsedButtons.length > 0) {
          content.buttons = parsedButtons.map((btn: any, i: number) => ({
            buttonId: `btn_${i}_${Date.now()}`,
            buttonText: {
              displayText: btn || 'Botón'
            },
            type: 1
          }));
        }
      } catch (e) {
        console.error('[Server] Error parsing buttons:', e);
      }
    }

    // Add URL buttons (hyperlinks) if present
    if (urlButtons) {
      try {
        const parsedUrlButtons = JSON.parse(urlButtons);
        if (parsedUrlButtons.length > 0) {
          content.urlButtons = parsedUrlButtons;
        }
      } catch (e) {
        console.error('[Server] Error parsing URL buttons:', e);
      }
    }

    const result = services.campaignManager.create({
      name,
      recipients: JSON.parse(recipients),
      type: type || 'text',
      content,
      days: JSON.parse(days),
      times: JSON.parse(times),
      start_date,
      end_date
    });
    res.json({ id: result.id, task_id: result.task_id });
  });

  app.patch('/api/campaigns/:id', upload.single('file'), async (req, res) => {
    const { name, recipients, type, text, caption, days, times, start_date, end_date, footer, buttons, urlButtons } = req.body;
    const updateData: any = {};

    if (name) updateData.name = name;
    if (recipients) updateData.recipients = typeof recipients === 'string' ? JSON.parse(recipients) : recipients;
    if (type) updateData.type = type;
    if (days) updateData.days = typeof days === 'string' ? JSON.parse(days) : days;
    if (times) updateData.times = typeof times === 'string' ? JSON.parse(times) : times;
    if (start_date) updateData.start_date = start_date;
    if (end_date) updateData.end_date = end_date;

    // Handle content updates
    const current = services.db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id) as any;
    let currentContent = current && current.content ? JSON.parse(current.content) : {};
    let newContent = { ...currentContent };

    // Update text/caption
    if (text !== undefined) newContent.text = text;
    if (caption !== undefined) newContent.caption = caption;

    // Update file if new one uploaded
    if (req.file) {
      const safeName = sanitizeFileName(req.file.originalname);
      const url = await services.uploadToSupabase(req.file.path, `${Date.now()}-${safeName}`, req.file.mimetype);
      newContent.url = url;
      newContent.fileName = req.file.originalname;
      newContent.mimetype = req.file.mimetype;
      fs.unlinkSync(req.file.path);
    }

    // Update footer
    if (footer !== undefined) {
      newContent.footer = footer;
    }

    // Update buttons
    if (buttons !== undefined) {
      try {
        const parsedButtons = JSON.parse(buttons);
        if (parsedButtons.length > 0) {
          newContent.buttons = parsedButtons.map((btn: any, i: number) => ({
            buttonId: `btn_${i}_${Date.now()}`,
            buttonText: {
              displayText: btn || 'Botón'
            },
            type: 1
          }));
        } else {
          delete newContent.buttons;
        }
      } catch (e) {
        console.error('[Server] Error parsing buttons:', e);
      }
    }

    // Update URL buttons (hyperlinks)
    if (urlButtons !== undefined) {
      try {
        const parsedUrlButtons = JSON.parse(urlButtons);
        if (parsedUrlButtons.length > 0) {
          newContent.urlButtons = parsedUrlButtons;
        } else {
          delete newContent.urlButtons;
        }
      } catch (e) {
        console.error('[Server] Error parsing URL buttons:', e);
      }
    }

    updateData.content = newContent;

    services.campaignManager.update(req.params.id, updateData);
    res.json({ message: 'Updated' });
  });

  app.post('/api/campaigns/:id/toggle', (req, res) => {
    res.json({ status: services.campaignManager.toggleStatus(req.params.id) });
  });

  app.delete('/api/campaigns/:id', (req, res) => {
    services.campaignManager.delete(req.params.id);
    res.json({ message: 'Deleted' });
  });

  app.get('/api/statuses', (req, res) => {
    res.json(services.statusManager.getAll());
  });

  app.post('/api/statuses', upload.single('file'), async (req, res) => {
    const { type, text, backgroundColor, font, caption, days, times, start_date, end_date, share_to_groups } = req.body;
    let content: any = { text, backgroundColor, font: parseInt(font || '0') };
    if (req.file) {
      const safeName = sanitizeFileName(req.file.originalname);
      const url = await services.uploadToSupabase(req.file.path, `${Date.now()}-${safeName}`, req.file.mimetype);
      content = { url, caption, fileName: req.file.originalname, mimetype: req.file.mimetype };
      fs.unlinkSync(req.file.path);
    }
    const result = services.statusManager.create({
      type, content, days: JSON.parse(days), times: JSON.parse(times),
      start_date, end_date, share_to_groups: JSON.parse(share_to_groups || '[]')
    });
    res.json({ id: result.id, task_id: result.task_id });
  });

  app.patch('/api/statuses/:id', upload.single('file'), async (req, res) => {
    const { type, text, backgroundColor, font, caption, days, times, start_date, end_date, share_to_groups } = req.body;
    const updateData: any = {};

    if (type) updateData.type = type;
    if (days) updateData.days = typeof days === 'string' ? JSON.parse(days) : days;
    if (times) updateData.times = typeof times === 'string' ? JSON.parse(times) : times;
    if (start_date) updateData.start_date = start_date;
    if (end_date) updateData.end_date = end_date;
    if (share_to_groups) updateData.share_to_groups = typeof share_to_groups === 'string' ? JSON.parse(share_to_groups) : share_to_groups;

    if (text !== undefined || caption !== undefined || backgroundColor !== undefined || font !== undefined || req.file) {
      const current = services.db.prepare('SELECT * FROM scheduled_statuses WHERE id = ?').get(req.params.id) as any;
      let currentContent = current && current.content ? JSON.parse(current.content) : {};

      let newContent = { ...currentContent };
      if (text !== undefined) newContent.text = text;
      if (backgroundColor !== undefined) newContent.backgroundColor = backgroundColor;
      if (font !== undefined) newContent.font = parseInt(font);
      if (caption !== undefined) newContent.caption = caption;

      if (req.file) {
        const safeName = sanitizeFileName(req.file.originalname);
        const url = await services.uploadToSupabase(req.file.path, `${Date.now()}-${safeName}`, req.file.mimetype);
        newContent.url = url;
        newContent.fileName = req.file.originalname;
        newContent.mimetype = req.file.mimetype;
        fs.unlinkSync(req.file.path);
      }
      updateData.content = newContent;
    }

    services.statusManager.update(req.params.id, updateData);
    res.json({ message: 'Updated' });
  });

  app.post('/api/statuses/:id/toggle', (req, res) => {
    res.json({ status: services.statusManager.toggleStatus(req.params.id) });
  });

  app.delete('/api/statuses/:id', (req, res) => {
    services.statusManager.delete(req.params.id);
    res.json({ message: 'Deleted' });
  });

  // Test endpoint: send a text status directly (bypasses queue, for debugging)
  app.post('/api/test-status', async (req, res) => {
    try {
      if (!services.whatsapp.isConnected) {
        return res.status(400).json({ error: 'WhatsApp not connected' });
      }
      const text = req.body.text || '🧪 Test status from W-Beli.Ai Pro';
      const result = await services.whatsapp.sendMessage('status@broadcast', {
        text,
        backgroundColor: '#128C7E',
        font: 0
      }, 'text');
      res.json({ success: true, result: result?.key?.id || result || 'sent' });
    } catch (error: any) {
      console.error('[Test Status] Error:', error?.message);
      res.status(500).json({ error: error?.message || 'Failed' });
    }
  });

  app.post('/api/send', upload.single('file'), async (req, res) => {
    let { jids, type, text, caption, scheduledAt, footer, buttons } = req.body;
    if (typeof jids === 'string') jids = JSON.parse(jids);

    let content: any = {};

    if (req.file) {
      const safeName = sanitizeFileName(req.file.originalname);
      const url = await services.uploadToSupabase(req.file.path, `${Date.now()}-${safeName}`, req.file.mimetype);
      content = {
        url,
        caption: caption || '',
        fileName: req.file.originalname,
        mimetype: req.file.mimetype
      };
      fs.unlinkSync(req.file.path);
    } else {
      content = {
        text: text || '',
        caption: caption || ''
      };
    }

    // Add footer if present
    if (footer) {
      content.footer = footer;
    }

    // Add buttons if present
    if (buttons) {
      try {
        const parsedButtons = JSON.parse(buttons);
        if (parsedButtons.length > 0) {
          content.buttons = parsedButtons.map((btn: any, i: number) => ({
            buttonId: `btn_${i}_${Date.now()}`,
            buttonText: {
              displayText: btn || 'Botón'
            },
            type: 1
          }));
        }
      } catch (e) {
        console.error('[Server] Error parsing buttons:', e);
      }
    }

    const taskId = generateTaskId('DIR');

    for (const jid of jids) {
      services.messageQueue.add({
        jid,
        type: type || 'text',
        content,
        scheduled_at: scheduledAt,
        source_name: 'Envío Directo',
        task_id: taskId
      });
    }
    res.json({ message: 'Queued', count: jids.length, task_id: taskId });
  });

  app.get('/api/queue/stats', (req, res) => {
    res.json(services.messageQueue.getStats());
  });

  app.get('/api/queue/logs', (req, res) => {
    const logs = services.db.prepare("SELECT * FROM queue ORDER BY created_at DESC LIMIT 50").all();
    res.json(logs);
  });

  app.delete('/api/queue/clear', (req, res) => {
    try {
      services.messageQueue.clear();
      // Optional: También borrar logs de campañas y estados si "dejar la app en cero" lo amerita
      services.db.prepare("DELETE FROM campaign_logs").run();
      services.db.prepare("DELETE FROM status_logs").run();

      res.json({ message: 'Queue and logs cleared successfully' });
    } catch (error) {
      console.error('Error clearing queue:', error);
      res.status(500).json({ error: 'Failed to clear queue' });
    }
  });

  // 4. Catch-all for API
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: 'API route not found' });
  });

  // 5. Vite Middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    // Handle all other routes with Vite's index.html
    app.use('*', (req, res, next) => {
      vite.middlewares(req, res, next)
    })
  } else {
    const distPath = getDistDir();
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // 6. Socket.io
  io.on('connection', async (socket) => {
    console.log('[Socket] Client connected:', socket.id);

    const userInfo = await services.whatsapp.getUserInfo();
    const status = {
      connected: services.whatsapp.isConnected,
      qr: services.whatsapp.qr,
      user: userInfo || services.whatsapp.sock?.user
    };
    socket.emit('status', status);

    // If there's a QR, send it explicitly too
    if (services.whatsapp.qr) {
      socket.emit('qr', services.whatsapp.qr);
    }
  });

  // Wire up service events to Socket.IO
  whatsapp.on('qr', (qr) => io.emit('qr', qr));
  whatsapp.on('ready', (user) => io.emit('ready', user));
  whatsapp.on('disconnected', (reason) => io.emit('disconnected', reason));

  // 7. Listen
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Listening on port ${PORT}`);

    // Initial license check
    const savedKey = getSetting('license_key') as string;
    if (savedKey) {
      console.log(`[License] Found saved license key, verifying...`);
      checkLicense(savedKey).then(status => {
        if (!status.isValid) {
          console.warn(`[License] Saved license is invalid: ${status.message}`);
          // If suspended, don't auto-init WhatsApp
        } else {
          console.log(`[License] Verified successfully for client: ${status.clientName}`);
          // Start WhatsApp connection attempt after server is listening and license is valid
          setTimeout(() => whatsapp.init().catch(console.error), 1000);
        }
      });
    } else {
      console.log(`[License] No saved license key found.`);
      checkLicense('none');
    }

    // Periodical check every 5 minutes
    setInterval(() => {
      const key = getSetting('license_key') as string;
      if (key) {
        checkLicense(key).then(status => {
          if (!status.isValid) {
            console.warn(`[License] License is no longer valid: ${status.message}. Suspending services...`);
            services.whatsapp.logout().catch(() => { });
          }
        });
      }
    }, 5 * 60 * 1000);

    // WhatsApp init is now managed inside license check
  });
}

startServer().catch(err => {
  console.error('Fatal error during server startup:', err);
  process.exit(1);
});