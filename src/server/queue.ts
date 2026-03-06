import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import db, { getNextId } from './db';

// Lazy import to avoid circular dependency (whatsapp imports queue indirectly via server.ts)
let _whatsapp: any = null;
async function getWhatsapp() {
  if (!_whatsapp) {
    const mod = await import('./whatsapp');
    _whatsapp = mod.whatsapp;
  }
  return _whatsapp;
}

interface QueueJob {
  id: string;
  jid: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document';
  content: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retries: number;
  scheduled_at: string;
}

// 🛡️ CONTROL ANTI-SPAM INTELIGENTE
class AntiSpamController {
  private messageHistory = new Map<string, number[]>(); // groupId -> [timestamps]

  private config = {
    maxMessagesPerGroupPerDay: 20, // Límite diario seguro por grupo
    minDelayBetweenGroups: 5000, // 5 segundos mínimo
  };

  async canSendToGroup(groupId: string): Promise<boolean> {
    const now = Date.now();
    const history = this.messageHistory.get(groupId) || [];

    // Limpiar historial antiguo (más de 24h)
    const recentHistory = history.filter(t => now - t < 86400000);
    this.messageHistory.set(groupId, recentHistory);

    if (recentHistory.length >= this.config.maxMessagesPerGroupPerDay) {
      console.log(`[AntiSpam] Group ${groupId}: Daily limit reached (${recentHistory.length})`);
      return false;
    }
    return true;
  }

  async recordSent(groupId: string) {
    const history = this.messageHistory.get(groupId) || [];
    history.push(Date.now());
    this.messageHistory.set(groupId, history);
  }

  async calculateDelay(): Promise<number> {
    // Delay base + Jitter (aleatoriedad) para parecer humano
    const base = this.config.minDelayBetweenGroups;
    const jitter = Math.random() * 3000; // 0-3 segundos extra
    return base + jitter;
  }
}

const antiSpam = new AntiSpamController();

class MessageQueue extends EventEmitter {
  private processing = false;
  private interval = 5000; // Default fallback
  private lastHeartbeat = 0;
  private timer: NodeJS.Timeout | null = null;

  constructor() {
    super();
    // Delay initial processing
    setTimeout(() => this.process(), 3000);
  }

  add(job: Omit<QueueJob, 'id' | 'status' | 'retries' | 'scheduled_at'> & { scheduled_at?: string; source_id?: string; source_name?: string; task_id?: string }) {
    const id = randomUUID();
    const scheduledAt = job.scheduled_at || new Date().toISOString();
    const stmt = db.prepare('INSERT INTO queue (id, jid, type, content, status, scheduled_at, source_id, source_name, task_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    stmt.run(id, job.jid, job.type, JSON.stringify(job.content), 'pending', scheduledAt, job.source_id || null, job.source_name || null, job.task_id || null);
    this.emit('queued', { id, ...job, scheduled_at: scheduledAt });
    return id;
  }

  private getSettings() {
    const rows = db.prepare('SELECT * FROM settings').all() as { key: string, value: string }[];
    const settings: Record<string, any> = {};
    rows.forEach(row => {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch {
        settings[row.key] = row.value;
      }
    });
    return {
      minDelay: settings.minDelay || 50,   // seconds
      maxDelay: settings.maxDelay || 115,  // seconds
      sleepStart: settings.sleepStart || '22:00',
      sleepEnd: settings.sleepEnd || '08:00',
      typingDelay: settings.typingDelay ?? 10, // seconds - 0 = disabled
      ...settings
    };
  }

  /**
   * Simulates human typing in the target chat before a message is sent.
   * Uses sendPresenceUpdate('composing') → wait → sendPresenceUpdate('paused').
   * @param jid  The recipient JID (user or group)
   * @param seconds  Duration (seconds) to show the "typing…" indicator
   */
  private async simulateTyping(jid: string, seconds: number) {
    if (seconds <= 0) return;
    try {
      const wa = await getWhatsapp();
      if (!wa || !wa.isConnected || !wa.sock) return;
      await wa.sock.sendPresenceUpdate('composing', jid);
      await new Promise(resolve => setTimeout(resolve, seconds * 1000));
      await wa.sock.sendPresenceUpdate('paused', jid);
    } catch (err) {
      // Non-fatal – typing simulation is cosmetic, never block the send
      console.warn('[Queue] Typing simulation failed (non-fatal):', (err as any)?.message);
    }
  }

  async process() {
    if (this.processing) return;
    this.processing = true;
    this.runLoop();
  }

  private runLoop = async () => {
    if (!this.processing) return;

    try {
      const settings = this.getSettings() as any;

      // --- Professional System Time Sleep Check ---
      // Usar la hora local del sistema sin forzar zona horaria
      const timeParts = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
      const findPart = (partName: string) => timeParts.find(p => p.type === partName)?.value || '0';
      const currentHour = parseInt(findPart('hour'));
      const currentMinute = parseInt(findPart('minute'));
      const currentTotalMinutes = currentHour * 60 + currentMinute;

      const [startH, startM] = settings.sleepStart.split(':').map(Number);
      const startMinutes = startH * 60 + startM;

      const [endH, endM] = settings.sleepEnd.split(':').map(Number);
      const endMinutes = endH * 60 + endM;

      let isSleeping = false;
      if (startMinutes > endMinutes) {
        isSleeping = currentTotalMinutes >= startMinutes || currentTotalMinutes < endMinutes;
      } else {
        isSleeping = currentTotalMinutes >= startMinutes && currentTotalMinutes < endMinutes;
      }

      if (isSleeping) {
        this.timer = setTimeout(this.runLoop, 60000);
        return;
      }

      // Calculate random delay
      const delay = Math.floor(Math.random() * (settings.maxDelay - settings.minDelay + 1) + settings.minDelay) * 1000;

      const nowISO = new Date().toISOString();
      const stmt = db.prepare(`
        SELECT * FROM queue 
        WHERE status = 'pending' 
        AND scheduled_at <= ?
        ORDER BY scheduled_at ASC 
        LIMIT 1
      `);
      const job = stmt.get(nowISO) as any;

      if (job) {
        console.log(`[Queue] Found job ${job.id} for ${job.jid}. Status: ${job.status}, Scheduled: ${job.scheduled_at}`);
        try {
          const isStatusPost = job.jid === 'status@broadcast';

          // Anti-Spam Check for Groups (skip for status posts)
          if (!isStatusPost && job.jid.endsWith('@g.us')) {
            const canSend = await antiSpam.canSendToGroup(job.jid);
            if (!canSend) {
              console.log(`[Queue] Skipping job ${job.id} due to AntiSpam limits`);
              db.prepare("UPDATE queue SET status = 'failed' WHERE id = ?").run(job.id);
              this.timer = setTimeout(this.runLoop, 1000);
              return;
            }
          }

          // ── Typing simulation (skip for status posts — no chat to type in) ──
          if (!isStatusPost) {
            const typingSeconds = Number(settings.typingDelay ?? 3);
            if (typingSeconds > 0) {
              console.log(`[Queue] Simulating typing for ${typingSeconds}s in ${job.jid}...`);
              await this.simulateTyping(job.jid, typingSeconds);
            }
          }

          // Update status to processing
          db.prepare("UPDATE queue SET status = 'processing' WHERE id = ?").run(job.id);

          console.log(`[Queue] Emitting process event for job ${job.id}${isStatusPost ? ' (STATUS POST - priority)' : ''}`);
          this.emit('process', {
            ...job,
            content: JSON.parse(job.content)
          });

          // Calculate smart delay
          let nextDelay = delay;
          if (isStatusPost) {
            // Status posts: minimal delay, process quickly
            nextDelay = 2000;
          } else if (job.jid.endsWith('@g.us')) {
            const spamDelay = await antiSpam.calculateDelay();
            nextDelay = Math.max(delay, spamDelay);
            await antiSpam.recordSent(job.jid);
          }

          this.timer = setTimeout(this.runLoop, nextDelay);
        } catch (error) {
          console.error('[Queue] Error processing job:', error);
          db.prepare("UPDATE queue SET status = 'failed' WHERE id = ?").run(job.id);
          this.timer = setTimeout(this.runLoop, 1000); // Retry loop quickly on error
        }
      } else {
        // Heartbeat log every 30 seconds
        const now = Date.now();
        if (!this.lastHeartbeat || now - this.lastHeartbeat > 60000) {
          const stats = this.getStats();
          if (stats.pending > 0 || stats.failed > 0) {
            console.log(`[Queue] Status - Pending: ${stats.pending}, Completed: ${stats.completed}, Failed: ${stats.failed}`);
          }
          this.lastHeartbeat = now;
        }
        this.timer = setTimeout(this.runLoop, 2000);
      }
    } catch (error) {
      console.error('[Queue] Fatal error in runLoop:', error);
      this.timer = setTimeout(this.runLoop, 5000); // Restart after 5s
    }
  };

  forceProcess() {
    console.log('[Queue] Force processing triggered');
    if (this.timer) {
      clearTimeout(this.timer);
      console.log('[Queue] Bypassing current delay/sleep timer.');
    }
    if (!this.processing) {
      this.process();
    } else {
      // If already processing, run the next loop iteration immediately
      this.runLoop();
    }
  }

  complete(id: string) {
    db.prepare("UPDATE queue SET status = 'completed', processed_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
    this.emit('completed', id);
  }

  fail(id: string, error: string) {
    db.prepare("UPDATE queue SET status = 'failed' WHERE id = ?").run(id);
    this.emit('failed', { id, error });
  }

  getStats() {
    const pending = db.prepare("SELECT COUNT(*) as count FROM queue WHERE status = 'pending'").get() as any;
    const completed = db.prepare("SELECT COUNT(*) as count FROM queue WHERE status = 'completed'").get() as any;
    const failed = db.prepare("SELECT COUNT(*) as count FROM queue WHERE status = 'failed'").get() as any;

    return {
      pending: pending.count,
      completed: completed.count,
      failed: failed.count
    };
  }

  clear() {
    db.prepare("DELETE FROM queue").run();
    console.log('[Queue] All queue history and pending tasks have been completely cleared.');
    this.emit('cleared');
  }
}

export const messageQueue = new MessageQueue();
