import { supabaseAdmin } from './supabase';
import fs from 'fs';
import path from 'path';

export async function uploadToSupabase(filePath: string, fileName: string, mimeType: string) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const { data, error } = await supabaseAdmin.storage
      .from('media')
      .upload(fileName, fileBuffer, {
        contentType: mimeType,
        upsert: true
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('media')
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading to Supabase Storage:', error);
    throw error;
  }
}

export async function deleteFromSupabase(fileName: string) {
  try {
    const { error } = await supabaseAdmin.storage
      .from('media')
      .remove([fileName]);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting from Supabase Storage:', error);
  }
}
