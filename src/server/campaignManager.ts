import db, { getNextId, generateTaskId, getSetting } from './db';
import { messageQueue } from './queue';
import { supabaseAdmin } from './supabase';

export interface Campaign {
  id: string;
  name: string;
  recipients: string[];
  type: 'text' | 'image' | 'video' | 'audio' | 'document';
  content: any;
  days: number[]; // 0-6 (Sunday-Saturday)
  times: string[]; // HH:MM
  start_date: string;
  end_date: string;
  task_id: string;
  status: 'active' | 'paused';
  license_key: string;
}

class CampaignManager {
  constructor() {
    this.init();
  }

  private init() {
    // Check for scheduled campaigns every minute
    setInterval(() => this.checkCampaigns(), 60000);
    // Also run once at start, but with a delay to not block startup
    setTimeout(() => this.checkCampaigns(), 5000);
  }

  private async syncToSupabase(campaign: any) {
    try {
      const { error } = await supabaseAdmin
        .from('campaigns')
        .upsert({
          id: campaign.id,
          name: campaign.name,
          recipients: campaign.recipients,
          type: campaign.type,
          content: campaign.content,
          days: campaign.days,
          times: campaign.times,
          start_date: campaign.start_date,
          end_date: campaign.end_date,
          status: campaign.status
        });
      if (error) console.error('[Supabase Sync] Error upserting campaign:', error);
    } catch (err) {
      console.error('[Supabase Sync] Fatal error:', err);
    }
  }

  private async deleteFromSupabase(id: string) {
    try {
      const { error } = await supabaseAdmin
        .from('campaigns')
        .delete()
        .eq('id', id);
      if (error) console.error('[Supabase Sync] Error deleting campaign:', error);
    } catch (err) {
      console.error('[Supabase Sync] Fatal error:', err);
    }
  }

  private async checkCampaigns() {
    // Usar estrictamente la hora del sistema (PC local)
    const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // --- Professional System Time Handling ---
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric', minute: 'numeric', year: 'numeric',
      month: 'numeric', day: 'numeric', weekday: 'short',
      hour12: false,
    }).formatToParts(now);

    const findPart = (partName: string) => parts.find(p => p.type === partName)?.value || '';

    const currentHour = findPart('hour').padStart(2, '0');
    const currentMinute = findPart('minute').padStart(2, '0');
    const currentTime = `${currentHour}:${currentMinute}`;

    const year = findPart('year');
    const month = findPart('month').padStart(2, '0');
    const day = findPart('day').padStart(2, '0');
    const currentDate = `${year}-${month}-${day}`;

    const dayOfWeekStr = findPart('weekday');
    const dayOfWeekMap: { [key: string]: number } = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
    const dayOfWeek = dayOfWeekMap[dayOfWeekStr];

    const licenseKey = getSetting('license_key') || 'unknown';
    // Heartbeat log every 5 minutes to show it's alive
    if (parseInt(currentMinute) % 5 === 0 && now.getSeconds() < 2) {
      console.log(`[Campaigns Heartbeat] Checking at ${currentTime} (${deviceTimezone}). Day: ${dayOfWeek} (Client: ${licenseKey})`);
    }

    // Use LOCAL DB as primary source of truth (always reliable)
    let campaigns: any[] = [];
    try {
      campaigns = db.prepare("SELECT * FROM campaigns WHERE status = 'active' AND license_key = ?").all(licenseKey) as any[];
      // Parse JSON fields for local DB
      campaigns = campaigns.map(c => ({
        ...c,
        days: typeof c.days === 'string' ? JSON.parse(c.days) : c.days,
        times: typeof c.times === 'string' ? JSON.parse(c.times) : c.times,
        recipients: typeof c.recipients === 'string' ? JSON.parse(c.recipients) : c.recipients,
        content: typeof c.content === 'string' ? JSON.parse(c.content) : c.content
      }));
    } catch (err) {
      console.error('[Campaigns] Error fetching from local DB:', err);
      campaigns = [];
    }

    for (const campaign of campaigns) {
      try {
        const days = Array.isArray(campaign.days) ? campaign.days : JSON.parse(campaign.days);
        const times = Array.isArray(campaign.times) ? campaign.times : JSON.parse(campaign.times);
        const startDate = campaign.start_date;
        const endDate = campaign.end_date;

        // Check if within date range
        if (currentDate < startDate || currentDate > endDate) continue;

        // Check if today is a scheduled day
        if (!days.includes(dayOfWeek)) continue;

        // Lógica de "Catch-up" (Ponerse al día):
        // En lugar de buscar una coincidencia exacta, revisamos todas las horas programadas.
        // Si una hora ya pasó (<= currentTime) y no se ha registrado en los logs, se envía.
        for (const time of times) {
          if (time <= currentTime) {
            const sentAt = `${currentDate} ${time}`;

            // Verificar si ya se envió para esta fecha y hora específica
            const log = db.prepare("SELECT id FROM campaign_logs WHERE campaign_id = ? AND sent_at = ?").get(campaign.id, sentAt);

            if (!log) {
              console.log(`[Campaigns] Catch-up trigger: Campaign "${campaign.name}" scheduled for ${sentAt} (Now: ${currentTime})`);

              const recipients = Array.isArray(campaign.recipients) ? campaign.recipients : JSON.parse(campaign.recipients);
              const content = typeof campaign.content === 'object' ? campaign.content : JSON.parse(campaign.content);

              for (const jid of recipients) {
                messageQueue.add({
                  jid,
                  type: campaign.type,
                  content,
                  scheduled_at: now.toISOString(),
                  source_id: campaign.id,
                  source_name: campaign.name,
                  task_id: campaign.task_id || undefined
                });
              }

              // Registrar el envío para no repetirlo
              db.prepare("INSERT INTO campaign_logs (campaign_id, sent_at) VALUES (?, ?)").run(campaign.id, sentAt);
            }
          }
        }
      } catch (err) {
        console.error(`[Campaigns] Error processing campaign ${campaign.id}:`, err);
      }
    }
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
    return settings;
  }

  getAll() {
    const licenseKey = getSetting('license_key') || 'unknown';
    return db.prepare("SELECT * FROM campaigns WHERE license_key = ? ORDER BY created_at DESC").all(licenseKey).map((c: any) => ({
      ...c,
      recipients: JSON.parse(c.recipients),
      content: JSON.parse(c.content),
      days: JSON.parse(c.days),
      times: JSON.parse(c.times)
    }));
  }

  create(campaign: Omit<Campaign, 'id' | 'status' | 'task_id' | 'license_key'>) {
    const licenseKey = getSetting('license_key') || 'unknown';
    const id = getNextId('CP', licenseKey);
    const taskId = generateTaskId('CMP', campaign.name);
    const status = 'active';
    const stmt = db.prepare(`
      INSERT INTO campaigns (id, name, recipients, type, content, days, times, start_date, end_date, task_id, status, license_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      campaign.name,
      JSON.stringify(campaign.recipients),
      campaign.type,
      JSON.stringify(campaign.content),
      JSON.stringify(campaign.days),
      JSON.stringify(campaign.times),
      campaign.start_date,
      campaign.end_date,
      taskId,
      status,
      licenseKey
    );

    this.syncToSupabase({ ...campaign, id, status, task_id: taskId, license_key: licenseKey });
    return { id, task_id: taskId };
  }

  update(id: string, campaign: Partial<Campaign>) {
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(campaign)) {
      if (key === 'id') continue;
      fields.push(`${key} = ?`);
      values.push(typeof value === 'object' ? JSON.stringify(value) : value);
    }
    values.push(id);
    const stmt = db.prepare(`UPDATE campaigns SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    // Fetch full campaign for sync
    const updated = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id) as any;
    if (updated) {
      this.syncToSupabase({
        ...updated,
        recipients: JSON.parse(updated.recipients),
        content: JSON.parse(updated.content),
        days: JSON.parse(updated.days),
        times: JSON.parse(updated.times)
      });
    }
  }

  delete(id: string) {
    db.prepare("DELETE FROM campaigns WHERE id = ?").run(id);
    db.prepare("DELETE FROM campaign_logs WHERE campaign_id = ?").run(id);
    this.deleteFromSupabase(id);
  }

  toggleStatus(id: string) {
    const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id) as any;
    const newStatus = campaign.status === 'active' ? 'paused' : 'active';
    db.prepare("UPDATE campaigns SET status = ? WHERE id = ?").run(newStatus, id);

    this.syncToSupabase({
      ...campaign,
      status: newStatus,
      recipients: JSON.parse(campaign.recipients),
      content: JSON.parse(campaign.content),
      days: JSON.parse(campaign.days),
      times: JSON.parse(campaign.times)
    });

    return newStatus;
  }

  triggerManual(id: string) {
    console.log(`[Campaigns] Manual trigger for campaign ${id}`);
    const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id) as any;
    if (!campaign) {
      console.error(`[Campaigns] Campaign ${id} not found for manual trigger`);
      return;
    }

    const recipients = JSON.parse(campaign.recipients);
    console.log(`[Campaigns] Queueing messages for ${recipients.length} recipients`);
    const content = JSON.parse(campaign.content);
    const now = new Date().toISOString();

    for (const jid of recipients) {
      messageQueue.add({
        jid,
        type: campaign.type,
        content,
        scheduled_at: now,
        source_id: campaign.id,
        source_name: campaign.name,
        task_id: campaign.task_id || undefined
      });
    }
  }
}

export const campaignManager = new CampaignManager();