import db, { getNextId, generateTaskId, getSetting } from './db';
import { messageQueue } from './queue';
import { supabaseAdmin } from './supabase';

export interface ScheduledStatus {
  id: string;
  type: 'text' | 'image' | 'video';
  content: any;
  days: number[];
  times: string[];
  start_date: string;
  end_date: string;
  share_to_groups: string[];
  task_id: string;
  status: 'active' | 'paused';
  license_key: string;
}

class StatusManager {
  constructor() {
    this.init();
  }

  private init() {
    setInterval(() => this.checkStatuses(), 60000);
    // Delay initial check
    setTimeout(() => this.checkStatuses(), 7000);
  }

  private async syncToSupabase(status: any) {
    try {
      const { error } = await supabaseAdmin
        .from('scheduled_statuses')
        .upsert({
          id: status.id,
          type: status.type,
          content: status.content,
          days: status.days,
          times: status.times,
          start_date: status.start_date,
          end_date: status.end_date,
          share_to_groups: status.share_to_groups,
          task_id: status.task_id,
          status: status.status
        });
      if (error) console.error('[Supabase Sync] Error upserting status:', error);
    } catch (err) {
      console.error('[Supabase Sync] Fatal error:', err);
    }
  }

  private async deleteFromSupabase(id: string) {
    try {
      const { error } = await supabaseAdmin
        .from('scheduled_statuses')
        .delete()
        .eq('id', id);
      if (error) console.error('[Supabase Sync] Error deleting status:', error);
    } catch (err) {
      console.error('[Supabase Sync] Fatal error:', err);
    }
  }

  private async checkStatuses() {
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

    // Heartbeat para debug (cada 5 minutos)
    if (parseInt(currentMinute) % 5 === 0 && now.getSeconds() < 2) {
      console.log(`[Status Heartbeat] Checking at ${currentTime} (${deviceTimezone}). Day: ${dayOfWeek}`);
    }

    const licenseKey = getSetting('license_key') || 'unknown';
    // Fetch active statuses
    let statuses: any[] = [];
    try {
      const { data, error } = await supabaseAdmin
        .from('scheduled_statuses')
        .select('*')
        .eq('license_key', licenseKey)
        .eq('status', 'active');

      if (error) throw error;
      statuses = data || [];
    } catch (err) {
      statuses = db.prepare("SELECT * FROM scheduled_statuses WHERE status = 'active' AND license_key = ?").all(licenseKey) as any[];
      statuses = statuses.map(s => ({
        ...s,
        days: JSON.parse(s.days),
        times: JSON.parse(s.times),
        share_to_groups: JSON.parse(s.share_to_groups),
        content: JSON.parse(s.content)
      }));
    }

    for (const status of statuses) {
      try {
        if (currentDate < status.start_date || currentDate > status.end_date) continue;
        if (!status.days.includes(dayOfWeek)) continue;

        // Lógica de "Catch-up" para Estados
        for (const time of status.times) {
          if (time <= currentTime) {
            const sentAt = `${currentDate} ${time}`;
            const log = db.prepare("SELECT id FROM status_logs WHERE status_id = ? AND sent_at = ?").get(status.id, sentAt);

            if (!log) {
              console.log(`[Statuses] Catch-up trigger: Status "${status.id}" scheduled for ${sentAt} (Now: ${currentTime})`);

              // Post to Status
              messageQueue.add({
                jid: 'status@broadcast',
                type: status.type,
                content: status.content,
                scheduled_at: now.toISOString(),
                source_id: status.id,
                source_name: `Estado Programado`,
                task_id: status.task_id || undefined
              });

              // Share to groups if configured
              if (status.share_to_groups && status.share_to_groups.length > 0) {
                for (const groupJid of status.share_to_groups) {
                  messageQueue.add({
                    jid: groupJid,
                    type: status.type,
                    content: status.content,
                    scheduled_at: now.toISOString(),
                    source_id: status.id,
                    source_name: `Estado -> ${groupJid.split('@')[0]}`,
                    task_id: status.task_id || undefined
                  });
                }
              }

              db.prepare("INSERT INTO status_logs (status_id, sent_at) VALUES (?, ?)").run(status.id, sentAt);
            }
          }
        }
      } catch (err) {
        console.error(`[Statuses] Error processing status ${status.id}:`, err);
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
    return db.prepare("SELECT * FROM scheduled_statuses WHERE license_key = ? ORDER BY created_at DESC").all(licenseKey).map((s: any) => ({
      ...s,
      days: JSON.parse(s.days),
      times: JSON.parse(s.times),
      share_to_groups: JSON.parse(s.share_to_groups),
      content: JSON.parse(s.content)
    }));
  }

  create(status: Omit<ScheduledStatus, 'id' | 'status' | 'task_id' | 'license_key'>) {
    const licenseKey = getSetting('license_key') || 'unknown';
    const id = getNextId('ST', licenseKey);
    const taskId = generateTaskId('STS');
    const activeStatus = 'active';
    const stmt = db.prepare(`
      INSERT INTO scheduled_statuses (id, type, content, days, times, start_date, end_date, share_to_groups, task_id, status, license_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      status.type,
      JSON.stringify(status.content),
      JSON.stringify(status.days),
      JSON.stringify(status.times),
      status.start_date,
      status.end_date,
      JSON.stringify(status.share_to_groups),
      taskId,
      activeStatus,
      licenseKey
    );

    this.syncToSupabase({ ...status, id, status: activeStatus, task_id: taskId, license_key: licenseKey });
    return { id, task_id: taskId };
  }

  update(id: string, status: Partial<ScheduledStatus>) {
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(status)) {
      if (key === 'id') continue;
      fields.push(`${key} = ?`);
      values.push(typeof value === 'object' ? JSON.stringify(value) : value);
    }
    values.push(id);
    const stmt = db.prepare(`UPDATE scheduled_statuses SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    const updated = db.prepare("SELECT * FROM scheduled_statuses WHERE id = ?").get(id) as any;
    if (updated) {
      this.syncToSupabase({
        ...updated,
        days: JSON.parse(updated.days),
        times: JSON.parse(updated.times),
        share_to_groups: JSON.parse(updated.share_to_groups),
        content: JSON.parse(updated.content)
      });
    }
  }

  delete(id: string) {
    db.prepare("DELETE FROM scheduled_statuses WHERE id = ?").run(id);
    db.prepare("DELETE FROM status_logs WHERE status_id = ?").run(id);
    this.deleteFromSupabase(id);
  }

  toggleStatus(id: string) {
    const status = db.prepare("SELECT * FROM scheduled_statuses WHERE id = ?").get(id) as any;
    const newStatus = status.status === 'active' ? 'paused' : 'active';
    db.prepare("UPDATE scheduled_statuses SET status = ? WHERE id = ?").run(newStatus, id);

    this.syncToSupabase({
      ...status,
      status: newStatus,
      days: JSON.parse(status.days),
      times: JSON.parse(status.times),
      share_to_groups: JSON.parse(status.share_to_groups),
      content: JSON.parse(status.content)
    });

    return newStatus;
  }
}

export const statusManager = new StatusManager();