import pkg from '@whiskeysockets/baileys';
import { useMultiFileAuthState } from '@whiskeysockets/baileys/lib/Utils/use-multi-file-auth-state';
import { fetchLatestBaileysVersion } from '@whiskeysockets/baileys/lib/Utils/generics';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import db, { getSetting } from './db.js';
import { supabaseAdmin } from './supabase';
import { getAppDataDir } from './paths.js';

const makeWASocket = (pkg as any).default?.default || (pkg as any).default || pkg;
const {
  prepareWAMessageMedia,
  generateWAMessageFromContent,
} = (pkg as any).default || pkg;

// Some types, might not be needed as values but just ignoring ts complaints
type WAMessageKey = any;
type Contact = any;

const logger = pino({ level: 'silent' });

class WhatsAppClient extends EventEmitter {
  sock: any;
  qr: string | null = null;
  isConnected: boolean = false;
  isConnecting: boolean = false;
  reconnectInterval: number = 5000;
  maxRetries: number = 5;
  retries: number = 0;
  private qrTimeout: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  async init() {
    if (this.isConnected || this.isConnecting) return;
    await this.connect();
  }

  async connect() {
    if (this.isConnected || this.isConnecting) {
      console.log('[WhatsApp] Already connected or connecting, skipping...');
      return;
    }

    this.isConnecting = true;

    try {
      const { getLicenseStatus } = await import('./license.js');
      const status = getLicenseStatus();
      if (!status.isValid) {
        console.warn(`[WhatsApp] Connection blocked: License is invalid (${status.message})`);
        this.isConnecting = false;
        return;
      }

      const licenseKey = getSetting('license_key') || 'default';
      const sessionPath = path.join(getAppDataDir(), 'sessions', licenseKey.replace(/[^a-zA-Z0-9]/g, '_'));

      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

      let version;
      try {
        const result = await fetchLatestBaileysVersion();
        version = result.version;
        console.log(`[WhatsApp] Using Baileys version: ${version}`);
      } catch (error) {
        console.warn('[WhatsApp] Failed to fetch latest Baileys version, using fallback:', error);
        version = [2, 3000, 1015901307]; // Fallback version
      }

      this.sock = makeWASocket({
        version,
        logger,
        auth: {
          creds: state.creds,
          keys: state.keys,
        },
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        printQRInTerminal: false,
        generateHighQualityLinkPreview: true,
        connectTimeoutMs: 120000,
        keepAliveIntervalMs: 10000,
        defaultQueryTimeoutMs: 120000,
        retryRequestDelayMs: 2000,
        markOnlineOnConnect: true,
        syncFullHistory: false,
        emitOwnEvents: true,
      });

      // Watchdog to prevent hanging
      const watchdog = setTimeout(() => {
        if (!this.isConnected && !this.qr) {
          console.warn('[WhatsApp] Connection watchdog triggered. Soft restarting...');
          try { this.sock?.ws?.close(); } catch { }
          this.isConnected = false;
          this.isConnecting = false;
          this.connect();
        }
      }, 120000);

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          clearTimeout(watchdog);
          console.log('[WhatsApp] New QR generated');
          this.qr = qr;
          this.emit('qr', qr);

          // QR expiration watchdog (WhatsApp QRs expire in ~60-120s)
          if (this.qrTimeout) clearTimeout(this.qrTimeout);
          this.qrTimeout = setTimeout(() => {
            if (!this.isConnected && this.qr === qr) {
              console.log('[WhatsApp] QR expired. Soft restarting to get a fresh one...');
              try { this.sock?.ws?.close(); } catch { }
              this.isConnected = false;
              this.isConnecting = false;
              this.connect();
            }
          }, 115000); // Slightly less than 2 mins
        }

        if (connection === 'close') {
          this.isConnecting = false;
          clearTimeout(watchdog);
          if (this.qrTimeout) clearTimeout(this.qrTimeout);
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const reason = lastDisconnect?.error?.message || 'Unknown reason';
          console.log(`[WhatsApp] Connection closed. Reason: ${reason} (Status: ${statusCode})`);

          // Handle session corruption (Bad MAC, Bad Session) by not reconnecting and clearing session
          const isSessionCorruption = reason.includes('Bad MAC') || reason.includes('PreKey') || reason.includes('Bad session') || reason.includes('Session error');
          const shouldReconnect = statusCode !== 401 /* loggedOut */ && !isSessionCorruption;

          if (shouldReconnect) {
            if (this.retries < this.maxRetries) {
              this.retries++;
              const delay = Math.min(this.reconnectInterval * this.retries, 30000);
              console.log(`[WhatsApp] Reconnecting in ${delay}ms... Attempt ${this.retries}/${this.maxRetries}`);
              setTimeout(() => this.connect(), delay);
            } else {
              console.error('[WhatsApp] Max retries reached. Will attempt to reconnect in 60s without clearing session.');
              this.emit('disconnected', 'Max retries reached. Retrying later.');
              // Do NOT call this.reset(), as that deletes the session. Just retry later.
              setTimeout(() => {
                this.retries = 0; // Reset retries to try again
                this.connect();
              }, 60000);
            }
          } else {
            console.log('[WhatsApp] Logged out or session corrupted. Clearing session...');
            this.emit('disconnected', 'Logged out or session corrupted');
            this.clearSession();
          }

          this.isConnected = false;
          this.qr = null;
        } else if (connection === 'open') {
          this.isConnecting = false;
          clearTimeout(watchdog);
          if (this.qrTimeout) clearTimeout(this.qrTimeout);
          console.log('[WhatsApp] Connection opened successfully');
          this.isConnected = true;
          this.retries = 0;
          this.qr = null;

          this.getUserInfo().then(userInfo => {
            this.emit('ready', userInfo || this.sock.user);
          });
        }
      });

      this.sock.ev.on('messages.upsert', async (m: any) => {
        if (m.type === 'notify') {
          for (const msg of m.messages) {
            if (!msg.key.fromMe) {
              this.emit('message', msg);
            }
          }
        }
      });

      this.sock.ev.on('contacts.upsert', (contacts: Contact[]) => {
        console.log(`[WhatsApp] Upserting ${contacts.length} contacts`);
        this.saveContacts(contacts);
      });

      this.sock.ev.on('contacts.set', ({ contacts }: { contacts: Contact[] }) => {
        console.log(`[WhatsApp] Setting initial ${contacts.length} contacts`);
        this.saveContacts(contacts);
      });

      this.sock.ev.on('contacts.update', (updates: Partial<Contact>[]) => {
        const licenseKey = getSetting('license_key') || 'unknown';
        for (const update of updates) {
          if (update.id) {
            try {
              const existing = db.prepare('SELECT * FROM contacts WHERE id = ? AND license_key = ?').get(update.id, licenseKey) as any;
              if (existing) {
                const stmt = db.prepare('UPDATE contacts SET name = ?, notify = ? WHERE id = ? AND license_key = ?');
                stmt.run(update.name || existing.name, update.notify || existing.notify, update.id, licenseKey);
              } else if (update.name || update.notify) {
                this.saveContacts([update as Contact]);
              }
            } catch (err) {
              console.warn(`[WhatsApp] Skipping contact update for ${update.id}: ${(err as any).message}`);
            }
          }
        }
      });
    } catch (error) {
      this.isConnecting = false;
      console.error('Fatal error in WhatsApp connection:', error);
      // Retry connection after delay even on fatal error
      setTimeout(() => this.connect(), this.reconnectInterval * 2);
    }
  }

  async sendMessage(jid: string, content: any, type: string = 'text') {
    console.log(`[WhatsApp] Attempting to send ${type} to ${jid}`);
    if (!this.isConnected) {
      console.error('[WhatsApp] Cannot send message: Not connected');
      throw new Error('WhatsApp not connected');
    }

    // Guard clause to ensure the user object is available
    if (!this.sock.user || !this.sock.user.id) {
      console.error('[WhatsApp] Cannot send message: User info not available. Connection might be in a bad state.');
      throw new Error('WhatsApp user info not available');
    }

    // Special handling for status
    if (jid === 'status@broadcast') {
      return this.sendStatus(content, type);
    }

    // ── Detect if this message has interactive buttons ──
    const hasQuickReplyButtons = content.buttons && content.buttons.length > 0;
    const hasUrlButtons = content.urlButtons && content.urlButtons.length > 0;
    const hasButtons = hasQuickReplyButtons || hasUrlButtons;

    if (hasButtons) {
      return this.sendInteractiveMessage(jid, content, type);
    }

    // ── Standard (non-button) messages ──
    try {
      if (type === 'text') {
        const result = await this.sock.sendMessage(jid, { text: content.text });
        console.log(`[WhatsApp] Message sent successfully to ${jid}:`, result.key.id);
        return result;
      } else if (type === 'image' || type === 'video') {
        let mediaContent;
        if (content.url && fs.existsSync(content.url)) {
          mediaContent = fs.readFileSync(content.url);
        } else {
          mediaContent = { url: content.url };
        }

        const message: any = { caption: content.caption };
        if (type === 'image') message.image = mediaContent;
        else message.video = mediaContent;

        const result = await this.sock.sendMessage(jid, message);
        console.log(`[WhatsApp] ${type} sent successfully to ${jid}:`, result.key.id);
        return result;
      } else if (type === 'audio') {
        let audioContent;
        if (content.url && fs.existsSync(content.url)) {
          audioContent = fs.readFileSync(content.url);
        } else {
          audioContent = { url: content.url };
        }
        const result = await this.sock.sendMessage(jid, { audio: audioContent, mimetype: 'audio/mp4', ptt: true });
        console.log(`[WhatsApp] Audio sent successfully to ${jid}:`, result.key.id);
        return result;
      } else if (type === 'document') {
        let docContent;
        if (content.url && fs.existsSync(content.url)) {
          docContent = fs.readFileSync(content.url);
        } else {
          docContent = { url: content.url };
        }
        const result = await this.sock.sendMessage(jid, {
          document: docContent,
          mimetype: content.mimetype || 'application/pdf',
          fileName: content.fileName || 'document.pdf',
          caption: content.caption
        });
        console.log(`[WhatsApp] Document sent successfully to ${jid}:`, result.key.id);
        return result;
      }
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Sends an interactive message (with quick_reply, cta_url, or cta_copy buttons)
   * using the `interactive` property that @dark-yasiya/baileys' generateWAMessageContent
   * maps to `nativeFlowMessage.buttons`.
   *
   * The fork's messages.js checks for `'interactive' in message` (NOT `interactiveButtons`)
   * and builds:
   *   interactiveMessage = { nativeFlowMessage: { buttons: message.interactive } }
   *
   * It then reads `message.text` → body, `message.footer` → footer,
   * `message.caption` + media → body + header (with media attachment).
   */
  private async sendInteractiveMessage(jid: string, content: any, type: string) {
    // ── 1. Build the NativeFlowButton[] array ──
    const nativeFlowButtons: Array<{ name: string; buttonParamsJson: string }> = [];

    // Quick reply buttons
    if (content.buttons && content.buttons.length > 0) {
      for (let i = 0; i < content.buttons.length; i++) {
        const btn = content.buttons[i];
        const btnId = btn.buttonId || btn.id || `btn_${i}_${Date.now()}`;
        const btnText = btn.buttonText?.displayText || btn.text || 'Botón';

        nativeFlowButtons.push({
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({
            display_text: btnText,
            id: btnId
          })
        });
      }
    }

    // URL / hyperlink buttons (cta_url)
    if (content.urlButtons && content.urlButtons.length > 0) {
      for (const btn of content.urlButtons) {
        nativeFlowButtons.push({
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({
            display_text: btn.text || 'Enlace',
            url: btn.url || ''
          })
        });
      }
    }

    console.log(`[WhatsApp] Building interactive message with ${nativeFlowButtons.length} native flow buttons for ${jid}`);

    // ── 2. Build the message object that the fork expects ──
    // The fork's generateWAMessageContent checks: `'interactive' in message && !!message.interactive`
    // Then it does: nativeFlowMessage: { buttons: message.interactive }
    // It reads body from `message.text` or `message.caption`, footer from `message.footer`.
    const interactiveMsg: any = {
      interactive: nativeFlowButtons,   // <-- This is the KEY property the fork looks for
      footer: content.footer || undefined,
    };

    // ── 3. Attach body text and optional media header ──
    if (type === 'image' || type === 'video' || type === 'document') {
      // For media messages, the fork reads `caption` for the body
      // and attaches the media to the header via prepareWAMessageMedia.
      let mediaData: any;
      if (content.url && fs.existsSync(content.url)) {
        mediaData = fs.readFileSync(content.url);
      } else {
        mediaData = { url: content.url };
      }

      if (type === 'image') {
        interactiveMsg.image = mediaData;
      } else if (type === 'video') {
        interactiveMsg.video = mediaData;
      } else {
        interactiveMsg.document = mediaData;
        interactiveMsg.mimetype = content.mimetype || 'application/pdf';
        interactiveMsg.fileName = content.fileName || 'document';
      }

      interactiveMsg.caption = content.caption || content.text || '';
      interactiveMsg.hasMediaAttachment = true;
    } else {
      // For text-only messages, the fork reads `message.text` for the body
      interactiveMsg.text = content.text || 'Mensaje';
    }

    try {
      const result = await this.sock.sendMessage(jid, interactiveMsg);
      console.log(`[WhatsApp] ✅ Interactive message (${type}) sent successfully to ${jid}: ${result?.key?.id}`);
      return result;
    } catch (error: any) {
      console.error(`[WhatsApp] ❌ Failed to send interactive message to ${jid}:`, error?.message || error);
      throw error;
    }
  }

  async sendStatus(content: any, type: string) {
    console.log(`[WhatsApp] ═══════════════════════════════════════`);
    console.log(`[WhatsApp] 📤 POSTING ${type.toUpperCase()} STATUS`);

    if (!this.sock || !this.sock.user?.id) {
      console.error('[WhatsApp] ❌ Socket not ready');
      throw new Error('WhatsApp not connected');
    }

    // ══════════════════════════════════════════════════════════
    // STEP 1: Build statusJidList from ALL available sources
    // All JIDs MUST be @s.whatsapp.net format (never @g.us)
    // This list determines WHO can see the status
    // ══════════════════════════════════════════════════════════
    const jidSet = new Set<string>();

    // Self JID (always first — ensures we see our own status)
    const rawSelfId = this.sock.user.id;
    const selfJid = rawSelfId.includes(':')
      ? rawSelfId.split(':')[0] + '@s.whatsapp.net'
      : rawSelfId.split('@')[0] + '@s.whatsapp.net';
    jidSet.add(selfJid);
    console.log(`[WhatsApp] 👤 Self: ${selfJid}`);

    // Source 1: DB contacts
    try {
      const contacts = await Promise.race([
        this.getContacts(),
        new Promise<any[]>(r => setTimeout(() => r([]), 8000))
      ]) as any[];
      let added = 0;
      for (const c of contacts) {
        if (c.id?.endsWith('@s.whatsapp.net')) {
          jidSet.add(c.id);
          added++;
        }
      }
      console.log(`[WhatsApp] 📋 DB: ${added} contacts`);
    } catch (e) {
      console.warn('[WhatsApp] ⚠️ DB fetch failed');
    }

    // Source 2: Collect ALL Group JIDs directly
    // Instead of resolving 20,000+ individual participants which FREEZES Baileys
    // during encryption, we use the modern `groupMentions` feature.
    const groupJids: string[] = [];
    try {
      const groups = await Promise.race([
        this.sock.groupFetchAllParticipating(),
        new Promise<any>(r => setTimeout(() => r({}), 12000))
      ]);
      const groupList = Object.values(groups) as any[];
      for (const g of groupList) {
        if (g.id?.endsWith('@g.us')) {
          groupJids.push(g.id);
        }
      }
      console.log(`[WhatsApp] 📋 Groups: ${groupJids.length} groups collected for groupMentions`);
    } catch (e) {
      console.warn('[WhatsApp] ⚠️ Group fetch failed');
    }

    // Convert Set to Array and apply a safety cap to prevent freezing (max 3000 contacts)
    let statusJidList = Array.from(jidSet);
    if (statusJidList.length > 3000) {
      console.warn(`[WhatsApp] ⚠️ statusJidList too large (${statusJidList.length}). Capping at 3000 to prevent crashing.`);
      statusJidList = statusJidList.slice(0, 3000);
    }
    console.log(`[WhatsApp] 📊 statusJidList: ${statusJidList.length} total`);

    // ══════════════════════════════════════════════════════════
    // STEP 2: Build message content and options SEPARATELY
    //
    // CRITICAL: In Baileys, generateWAMessageContent() reads:
    //   - backgroundColor from OPTIONS (3rd param), not content
    //   - font from OPTIONS
    //   - textColor from OPTIONS
    //
    // sendMessage(jid, content, options) calls:
    //   generateWAMessage(jid, content, { ...options })
    //
    // So styling MUST go in options, not in the message body.
    // ══════════════════════════════════════════════════════════
    let msgContent: any;
    const msgOptions: any = {
      statusJidList,
      broadcast: true, // Recommended by Baileys community to force broadcast flag
    };

    // Correct mapping for Baileys IGroupMention type expectation
    const groupMentionsData = groupJids.map(jid => ({ groupJid: jid, groupSubject: '' }));

    if (type === 'text') {
      // Text status: content = { text }, styling = options
      msgContent = {
        text: content.text || '',
        contextInfo: {
          forwardingScore: 0,
          isForwarded: false,
          groupMentions: groupMentionsData,
        }
      };
      msgOptions.backgroundColor = content.backgroundColor || '#000000';
      msgOptions.font = typeof content.font === 'number' ? content.font : 0;
      msgOptions.textColor = content.textColor || '#FFFFFF';
    } else if (type === 'image') {
      // Image status
      let imageData: any;
      if (content.url && fs.existsSync(content.url)) {
        imageData = fs.readFileSync(content.url);
      } else if (content.url) {
        imageData = { url: content.url };
      } else {
        throw new Error('No image URL provided for status');
      }
      msgContent = {
        image: imageData,
        caption: content.caption || '',
        contextInfo: {
          forwardingScore: 0,
          isForwarded: false,
          groupMentions: groupMentionsData,
        }
      };
    } else if (type === 'video') {
      // Video status
      let videoData: any;
      if (content.url && fs.existsSync(content.url)) {
        videoData = fs.readFileSync(content.url);
      } else if (content.url) {
        videoData = { url: content.url };
      } else {
        throw new Error('No video URL provided for status');
      }
      msgContent = {
        video: videoData,
        caption: content.caption || '',
        contextInfo: {
          forwardingScore: 0,
          isForwarded: false,
          groupMentions: groupMentionsData,
        }
      };
    } else {
      throw new Error(`Unknown status type: ${type}`);
    }

    // ══════════════════════════════════════════════════════════
    // STEP 3: Send using sock.sendMessage
    //
    // This is the CORRECT method. It calls internally:
    //   generateWAMessage('status@broadcast', content, options)
    //   relayMessage('status@broadcast', msg, { statusJidList })
    //
    // Do NOT use sendStatusMentions for general posting —
    // it sends individual mention notifications to EACH JID,
    // which causes rate limiting with hundreds of contacts.
    // ══════════════════════════════════════════════════════════
    try {
      console.log(`[WhatsApp] 🚀 Sending ${type} status to 'status@broadcast'...`);
      console.log(`[WhatsApp] 📦 Content keys: ${Object.keys(msgContent).join(', ')}`);
      console.log(`[WhatsApp] ⚙️ Options: statusJidList(${statusJidList.length}), bg=${msgOptions.backgroundColor || 'N/A'}, font=${msgOptions.font ?? 'N/A'}`);

      const result = await this.sock.sendMessage('status@broadcast', msgContent, msgOptions);

      console.log(`[WhatsApp] ✅ STATUS POSTED! Message ID: ${result?.key?.id}`);
      console.log(`[WhatsApp] ═══════════════════════════════════════`);
      return result;
    } catch (err: any) {
      console.error(`[WhatsApp] ❌ 'status@broadcast' failed: ${err?.message}`);
      console.error(`[WhatsApp]    Stack: ${err?.stack?.split('\n').slice(0, 3).join(' | ')}`);

      // ══════════════════════════════════════════════════════════
      // FALLBACK (As recommended in community tech report)
      // Send directly to own JID but with `broadcast: true` flag.
      // This bypasses `status@broadcast` routing issues in
      // newer WhatsApp versions.
      // ══════════════════════════════════════════════════════════
      try {
        console.log(`[WhatsApp] 🔄 Retrying with community fix: sending to self JID (${selfJid}) with broadcast=true...`);
        msgOptions.statusJidList = [selfJid]; // Ensure minimal list or user JID list
        const fallbackResult = await this.sock.sendMessage(selfJid, msgContent, msgOptions);
        console.log(`[WhatsApp] ✅ Status posted (fallback community fix)! ID: ${fallbackResult?.key?.id}`);
        console.log(`[WhatsApp] ═══════════════════════════════════════`);
        return fallbackResult;
      } catch (retryErr: any) {
        console.error(`[WhatsApp] ❌ RETRY ALSO FAILED: ${retryErr?.message}`);
        console.log(`[WhatsApp] ═══════════════════════════════════════`);
        throw retryErr; // Propagate so queue marks as failed
      }
    }
  }

  async getGroups() {
    if (!this.isConnected || !this.sock) return [];
    try {
      const groups = await this.sock.groupFetchAllParticipating();
      return Object.values(groups);
    } catch (error) {
      console.error('Error fetching groups:', error);
      return [];
    }
  }

  async leaveAndDeleteGroup(groupId: string) {
    if (!this.isConnected || !this.sock) {
      throw new Error('WhatsApp not connected');
    }
    console.log(`[WhatsApp] Attempting to leave and delete group: ${groupId}`);
    try {
      // 1. Leave the group
      await this.sock.groupLeave(groupId);
      console.log(`[WhatsApp] Successfully left group: ${groupId}`);

      // 2. Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 3. Delete the chat completely
      try {
        await this.sock.chatModify(
          { delete: true, lastMessages: [{ key: { remoteJid: groupId, id: '' }, messageTimestamp: Date.now() / 1000 }] },
          groupId
        );
      } catch (e: any) {
        console.warn(`[WhatsApp] Note on delete chat for ${groupId}:`, e.message);
      }

      console.log(`[WhatsApp] Group ${groupId} processed for deletion.`);
      return true;
    } catch (error) {
      console.error(`[WhatsApp] Error leaving/deleting group ${groupId}:`, error);
      throw error;
    }
  }

  async getContacts() {
    const licenseKey = getSetting('license_key') || 'unknown';
    // Try to get from local DB first for speed
    const localContacts = db.prepare('SELECT * FROM contacts WHERE license_key = ? ORDER BY name ASC, notify ASC').all(licenseKey);

    // If local is empty, try to fetch from Supabase to "warm up"
    if (localContacts.length === 0) {
      try {
        const { data } = await supabaseAdmin.from('contacts').select('*').eq('license_key', licenseKey);
        if (data && data.length > 0) {
          this.saveContacts(data as Contact[]);
          return data;
        }
      } catch (e) { }
    }

    return localContacts;
  }

  async getAvatarUrl(jid: string) {
    if (!this.isConnected || !this.sock) return null;
    try {
      const url = await this.sock.profilePictureUrl(jid, 'image');
      return url;
    } catch (error) {
      // It's normal to throw if no profile picture exists
      return null;
    }
  }

  private async saveContacts(contacts: Contact[]) {
    const licenseKey = getSetting('license_key') || 'unknown';
    const stmt = db.prepare('INSERT OR REPLACE INTO contacts (id, license_key, name, notify) VALUES (?, ?, ?, ?)');
    db.transaction(() => {
      for (const contact of contacts) {
        if (contact.id && contact.id.endsWith('@s.whatsapp.net')) {
          const name = contact.name || contact.verifiedName || null;
          const notify = contact.notify || null;
          stmt.run(contact.id, licenseKey, name, notify);
        }
      }
    })();

    // Sync to Supabase in background
    this.syncContactsToSupabase(contacts);
  }

  private async syncContactsToSupabase(contacts: Contact[]) {
    try {
      const licenseKey = getSetting('license_key') || 'unknown';
      const payload = contacts
        .filter(c => c.id && c.id.endsWith('@s.whatsapp.net'))
        .map(c => ({
          id: c.id,
          license_key: licenseKey,
          name: c.name || c.verifiedName || null,
          notify: c.notify || null,
          updated_at: new Date().toISOString()
        }));

      if (payload.length === 0) return;

      const chunkSize = 100;
      for (let i = 0; i < payload.length; i += chunkSize) {
        const chunk = payload.slice(i, i + chunkSize);
        await supabaseAdmin.from('contacts').upsert(chunk, { onConflict: 'id,license_key' });
      }
    } catch (error) {
      console.error('[Supabase Sync] Error syncing contacts:', error);
    }
  }

  async getUserInfo() {
    if (!this.isConnected || !this.sock?.user) return null;

    try {
      const id = this.sock.user.id;
      let ppUrl = null;
      try {
        ppUrl = await this.sock.profilePictureUrl(id, 'image');
      } catch (e) { }

      let status = null;
      try {
        const statusData = await this.sock.fetchStatus(id);
        status = statusData?.status;
      } catch (e) { }

      return {
        ...this.sock.user,
        ppUrl,
        status,
        platform: this.sock.authState.creds.platform || 'unknown'
      };
    } catch (error) {
      console.error('Error fetching user info:', error);
      return this.sock.user;
    }
  }

  async logout() {
    try {
      await this.sock.logout();
      this.clearSession();
      this.isConnected = false;
      this.qr = null;
      this.emit('disconnected', 'User initiated logout');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  }

  private clearSession() {
    try {
      const licenseKey = getSetting('license_key');
      const sessionPath = licenseKey ? path.join(getAppDataDir(), 'sessions', licenseKey.replace(/[^a-zA-Z0-9]/g, '_')) : path.join(getAppDataDir(), 'sessions');
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        console.log(`[WhatsApp] Session folder ${sessionPath} cleared`);
      }
    } catch (e) {
      console.error('[WhatsApp] Failed to clear session folder:', e);
    }
  }

  async reset() {
    console.log('[WhatsApp] Resetting connection...');
    if (this.sock) {
      try {
        await this.sock.ws.close();
      } catch { }
    }
    try {
      const licenseKey = getSetting('license_key');
      const sessionPath = licenseKey ? path.join(getAppDataDir(), 'sessions', licenseKey.replace(/[^a-zA-Z0-9]/g, '_')) : path.join(getAppDataDir(), 'sessions');
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
      }
    } catch (e) {
      console.error('Failed to clear session during reset:', e);
    }
    this.isConnected = false;
    this.qr = null;
    this.retries = 0;
    this.emit('status', { connected: false, qr: null, user: null });
    // Reconnect after a short delay
    setTimeout(() => this.connect(), 1000);
  }
}

export const whatsapp = new WhatsAppClient();
