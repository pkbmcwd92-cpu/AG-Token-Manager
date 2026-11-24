import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const message = s => { $('message').textContent = s; };
const view = session => { $('loginBox').classList.toggle('hidden', !!session); $('app').classList.toggle('hidden', !session); };
async function request(action, extra = {}) {
  const { data: { session }, error } = await db.auth.getSession();
  if (error || !session) throw new Error('Sesi admin berakhir. Silakan masuk lagi.');
  const response = await fetch(`${SUPABASE_URL}/functions/v1/smooth-function`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action, ...extra }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body;
}
async function refresh() {
  try {
    const { tokens } = await request('list');
    $('history').replaceChildren();
    for (const t of tokens) {
      const tr = document.createElement('tr');
      for (const value of [new Date(t.created_at).toLocaleDateString('id-ID'), t.status, new Date(t.expires_at).toLocaleString('id-ID')]) {
        const td = document.createElement('td'); td.textContent = value; tr.appendChild(td);
      }
      const td = document.createElement('td');
      if (t.status === 'unused') {
        const btn = document.createElement('button'); btn.textContent = 'Nonaktifkan';
        btn.onclick = async () => { if (!confirm('Nonaktifkan token ini?')) return; try { await request('revoke', { id: t.id }); await refresh(); } catch (e) { message(e.message); } };
        td.appendChild(btn);
      }
      tr.appendChild(td); $('history').appendChild(tr);
    }
  } catch (e) { message(e.message); }
}
$('loginForm').onsubmit = async e => {
  e.preventDefault(); message('');
  const { error } = await db.auth.signInWithPassword({ email: $('email').value.trim(), password: $('password').value });
  if (error) return message(error.message);
  $('password').value = ''; view(true); await refresh();
};
$('createForm').onsubmit = async e => {
  e.preventDefault(); message('');
  const btn = e.submitter; btn.disabled = true;
  try {
    const count = Number($('count').value), days = Number($('days').value);
    const { tokens } = await request('create', { count, days });
    $('tokensOut').replaceChildren();
    for (const token of tokens) {
      const p = document.createElement('p'); p.className = 'row';
      const code = document.createElement('code'); code.textContent = token;
      const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = 'Salin';
      copy.onclick = () => navigator.clipboard.writeText(token).then(() => message('Token disalin.')).catch(() => message('Gagal menyalin. Salin secara manual.'));
      p.append(code, copy); $('tokensOut').appendChild(p);
    }
    message(`${tokens.length} token dibuat. Salin sekarang; token tidak dapat ditampilkan kembali.`);
    await refresh();
  } catch (err) { message(err.message); } finally { btn.disabled = false; }
};
$('refresh').onclick = refresh;
$('logout').onclick = async () => { await db.auth.signOut(); view(false); $('history').replaceChildren(); $('tokensOut').replaceChildren(); message('Keluar.'); };
db.auth.onAuthStateChange((_event, session) => view(session));
const { data: { session } } = await db.auth.getSession(); view(session); if (session) await refresh();
