import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// ESM and CJS compatible __dirname
const getDirname = () => {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch (e) {
    return __dirname;
  }
};

const _dir = getDirname();

// Find the .env file. In production, it's typically in the root of process.cwd() or one level up
const envLocations = [
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), '..', '.env'),
  path.join(_dir, '..', '..', '.env') // Adjust to actual .env location based on src/server
];

let envLoaded = false;
for (const envPath of envLocations) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    envLoaded = true;
    break;
  }
}

// Fallback just in case
if (!envLoaded) dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zsuuhwhytiajiyaugoya.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

if (!process.env.VITE_SUPABASE_URL) {
  console.warn('[Supabase] VITE_SUPABASE_URL not found in env, using hardcoded fallback.');
}
if (!process.env.SUPABASE_SERVICE_ROLE && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[Supabase] SUPABASE_SERVICE_ROLE not found in env.');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
