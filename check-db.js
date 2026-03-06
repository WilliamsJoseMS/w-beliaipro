import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'wbot.db');
const db = new Database(dbPath);

const tables = ['settings', 'contacts', 'queue', 'campaigns', 'scheduled_statuses'];
console.log('--- DB CHECK ---');
tables.forEach(table => {
    try {
        const info = db.pragma(`table_info(${table})`);
        console.log(`\n--- ${table} ---`);
        if (Array.isArray(info)) {
            info.forEach(col => {
                console.log(`${col.name}: ${col.type}`);
            });
        } else {
            console.log('No info returned');
        }
    } catch (err) {
        console.log(`\nError checking ${table}: ${err.message}`);
    }
});
db.close();
