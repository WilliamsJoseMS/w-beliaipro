import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import { getAppDataDir } from './paths.js';

const dbPath = path.join(getAppDataDir(), 'wbot.db');
let db: Database.Database;
try {
  console.log(`Initializing database at ${dbPath}...`);
  db = new Database(dbPath);
} catch (error) {
  console.error('Failed to initialize database, using memory database:', error);
  db = new Database(':memory:');
}

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    data TEXT
  );

  CREATE TABLE IF NOT EXISTS queue (
    id TEXT PRIMARY KEY,
    license_key TEXT,
    jid TEXT NOT NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    source_id TEXT,
    source_name TEXT,
    task_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME
  );

  
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT,
    license_key TEXT,
    value TEXT,
    PRIMARY KEY (key, license_key)
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    license_key TEXT,
    name TEXT,
    recipients TEXT,
    type TEXT,
    content TEXT,
    days TEXT,
    times TEXT,
    start_date TEXT,
    end_date TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS campaign_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id TEXT,
    sent_at TEXT,
    UNIQUE(campaign_id, sent_at)
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT,
    license_key TEXT,
    name TEXT,
    notify TEXT,
    img_url TEXT,
    status TEXT,
    PRIMARY KEY (id, license_key)
  );

  CREATE TABLE IF NOT EXISTS scheduled_statuses (
    id TEXT PRIMARY KEY,
    license_key TEXT,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    days TEXT,
    times TEXT,
    start_date TEXT,
    end_date TEXT,
    share_to_groups TEXT,
    status TEXT DEFAULT 'active',
    task_id TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS status_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status_id TEXT,
    sent_at TEXT,
    UNIQUE(status_id, sent_at)
  );
`);

// 🛡️ MIGRACIONES DE AISLAMIENTO (Multi-Tenancy)
const tablesWithLc = ['queue', 'settings', 'campaigns', 'contacts', 'scheduled_statuses'];
tablesWithLc.forEach(table => {
  const columns = db.pragma(`table_info(${table})`) as any[];
  if (!columns.some(c => c.name === 'license_key')) {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN license_key TEXT`);
      console.log(`[DB] Column license_key added to ${table}`);
    } catch (e) { }
  }
});

// Fix settings PK
const settingsInfo = db.pragma('table_info(settings)') as any[];
const settingsPkCount = settingsInfo.filter(c => c.pk > 0).length;
if (settingsPkCount < 2) {
  try {
    console.log('[DB] Refactoring PK for settings...');
    db.exec(`
      BEGIN TRANSACTION;
      CREATE TABLE IF NOT EXISTS settings_new (key TEXT, license_key TEXT, value TEXT, PRIMARY KEY (key, license_key));
      INSERT OR IGNORE INTO settings_new (key, value, license_key) 
      SELECT key, value, IFNULL(license_key, 'unknown') FROM settings;
      DROP TABLE settings;
      ALTER TABLE settings_new RENAME TO settings;
      COMMIT;
    `);
  } catch (e) {
    db.exec('ROLLBACK;');
    console.error('[DB] Error refactoring settings:', e);
  }
}

// Fix contacts PK
const contactsInfo = db.pragma('table_info(contacts)') as any[];
const contactsPkCount = contactsInfo.filter(c => c.pk > 0).length;
if (contactsPkCount < 2) {
  try {
    console.log('[DB] Refactoring PK for contacts...');
    db.exec(`
      BEGIN TRANSACTION;
      CREATE TABLE IF NOT EXISTS contacts_new (id TEXT, license_key TEXT, name TEXT, notify TEXT, img_url TEXT, status TEXT, PRIMARY KEY (id, license_key));
      INSERT OR IGNORE INTO contacts_new (id, name, notify, img_url, status, license_key) 
      SELECT id, name, notify, img_url, status, IFNULL(license_key, 'unknown') FROM contacts;
      DROP TABLE contacts;
      ALTER TABLE contacts_new RENAME TO contacts;
      COMMIT;
    `);
  } catch (e) {
    db.exec('ROLLBACK;');
    console.error('[DB] Error refactoring contacts:', e);
  }
}

// Migration for scheduled_at
try {
  db.exec("ALTER TABLE queue ADD COLUMN scheduled_at DATETIME DEFAULT CURRENT_TIMESTAMP");
  db.exec("CREATE INDEX IF NOT EXISTS idx_queue_process ON queue(status, scheduled_at)");
} catch (error) {
  // Column likely already exists
}

try {
  db.exec("ALTER TABLE queue ADD COLUMN task_id TEXT");
} catch (error) {
  // Column likely already exists
}
// Migration for source tracking
try {
  db.exec("ALTER TABLE queue ADD COLUMN source_id TEXT");
} catch (error) {
  // Column likely already exists
}
try {
  db.exec("ALTER TABLE queue ADD COLUMN source_name TEXT");
} catch (error) {
  // Column likely already exists
}

// Migration: task_id for campaigns
try {
  db.exec("ALTER TABLE campaigns ADD COLUMN task_id TEXT");
} catch (error) {
  // Column likely already exists
}

// Migration: task_id for scheduled_statuses
try {
  const columns = db.pragma('table_info(scheduled_statuses)') as any[];
  if (!columns.some(c => c.name === 'task_id')) {
    db.exec("ALTER TABLE scheduled_statuses ADD COLUMN task_id TEXT");
    console.log('[DB] Column task_id added to scheduled_statuses');
  }
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_status_task_id ON scheduled_statuses(task_id)");
} catch (error) {
  console.error('[DB] Error migrating scheduled_statuses:', error);
}

export const getNextId = (prefix: string, licenseKey: string = 'unknown') => {
  let nextId = '';
  const key = `${prefix}_sequence`;

  const tx = db.transaction(() => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ? AND license_key = ?').get(key, licenseKey) as { value: string } | undefined;
    const current = row ? parseInt(row.value) : 0;
    const next = current + 1;
    db.prepare('INSERT OR REPLACE INTO settings (key, license_key, value) VALUES (?, ?, ?)').run(key, licenseKey, next.toString());
    nextId = `${prefix}${next.toString().padStart(5, '0')}`;
  });
  tx();

  return nextId;
};

export function getSetting(key: string, licenseKey: string = 'unknown'): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ? AND license_key = ?').get(key, licenseKey) as { value: string } | undefined;
  return row ? row.value : null;
}

export function setSetting(key: string, value: string, licenseKey: string = 'unknown'): void {
  db.prepare('INSERT OR REPLACE INTO settings (key, license_key, value) VALUES (?, ?, ?)').run(key, licenseKey, value);
}

/**
 * Generates a unique, immutable task ID for broadcast tasks.
 * Format:
 *   - Direct sends:  DIR-{timestamp}-{random6}
 *   - Campaigns:     CMP-{timestamp}-{name-slug}
 *   - Statuses:      STS-{timestamp}-{random6}
 */
export function generateTaskId(type: 'DIR' | 'CMP' | 'STS', name?: string): string {
  const ts = Math.floor(Date.now() / 1000); // Unix seconds
  const rand = randomUUID().replace(/-/g, '').slice(0, 6);

  if (type === 'CMP' && name) {
    const slug = name
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 16);
    return `CMP-${ts}-${slug}`;
  }

  return `${type}-${ts}-${rand}`;
}

export default db;
