import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL')!;
const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const adminIds = new Set((Deno.env.get('ADMIN_USER_IDS') || '').split(',').map(s => s.trim()).filter(Boolean));
const allowedOrigin = Deno.env.get('APP_ORIGIN') || '';
const headers = { 'Access-Control-Allow-Origin': allowedOrigin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' };
const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

Deno.serve(async request => {
  if (!allowedOrigin || request.headers.get('origin') !== allowedOrigin) return respond({ error: 'Origin tidak diizinkan' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return respond({ error: 'Method tidak diizinkan' }, 405);
  if (!adminIds.size) return respond({ error: 'Admin belum dikonfigurasi' }, 503);
  const jwt = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return respond({ error: 'Harus login' }, 401);
  const auth = createClient(url, anon);
  const { data: { user }, error: authError } = await auth.auth.getUser(jwt);
  if (authError || !user) return respond({ error: 'Sesi tidak valid' }, 401);
  if (!adminIds.has(user.id)) return respond({ error: 'Bukan admin' }, 403);
  const db = createClient(url, service);
  try {
    const body = await request.json();
    if (body.action === 'create') {
      const count = Number(body.count), days = Number(body.days);
      if (!Number.isInteger(count) || count < 1 || count > 20 || !Number.isInteger(days) || days < 1 || days > 30) return respond({ error: 'Jumlah 1–20, masa berlaku 1–30 hari' }, 400);
      const tokens: string[] = [], records: { token_hash: string; status: string; expires_at: string }[] = [];
      for (let i = 0; i < count; i++) {
        const random = crypto.getRandomValues(new Uint8Array(8));
        const token = `AG-${Array.from(random, x => x.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
        const token_hash = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
        tokens.push(token); records.push({ token_hash, status: 'unused', expires_at: new Date(Date.now() + days * 86400000).toISOString() });
      }
      const { error } = await db.from('access_tokens').insert(records);
      if (error) throw error;
      return respond({ tokens });
    }
    if (body.action === 'list') {
      const { data, error } = await db.from('access_tokens').select('id,status,created_at,expires_at,used_at').order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return respond({ tokens: data || [] });
    }
    if (body.action === 'revoke') {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(body.id || ''))) return respond({ error: 'ID tidak valid' }, 400);
      const { data, error } = await db.from('access_tokens').update({ status: 'revoked' }).eq('id', body.id).eq('status', 'unused').select('id');
      if (error) throw error;
      if (!data?.length) return respond({ error: 'Token sudah digunakan atau tidak ada' }, 409);
      return respond({ ok: true });
    }
    return respond({ error: 'Aksi tidak dikenal' }, 400);
  } catch (e) { console.error('ag-tokens:', e instanceof Error ? e.message : String(e)); return respond({ error: 'Permintaan gagal. Periksa log Edge Function.' }, 500); }
});
