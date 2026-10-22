// Password gate for the whole site. Every page and data file needs the gate cookie.
// The password itself is never stored here. Vercel holds only its hash in the
// SITE_PASS_HASH environment variable, and the cookie is a hash of that hash,
// so changing the password signs everyone out, Rishi included.
// Only /data/players.json stays open, because the Yahoo scanner reads it from a Yahoo tab
// and it is just the public NBA player list.

declare const process: { env: Record<string, string | undefined> };

const COOKIE = 'ncw_gate';
const GATE = '/__gate';
const OPEN = new Set(['/data/players.json', '/favicon.ico']);
const DAYS = 400;

async function sha256hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function cookieOf(req, name) {
  const raw = req.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return '';
}

// only a path on this site, never another site
function safeNext(n) {
  return typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/\\') && !n.startsWith(GATE) ? n : '/';
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function page(next, msg, status) {
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="noindex,nofollow"><title>Nine Cat War Room</title><style>' +
    ':root{color-scheme:dark}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f1218;color:#e8ecf2;font:16px system-ui,-apple-system,Segoe UI,Roboto,sans-serif}' +
    'form{width:min(340px,calc(100vw - 32px));background:#171b23;border:1px solid #2a303c;border-radius:14px;padding:28px 24px}' +
    'h1{font-size:20px;margin:0 0 18px}label{display:block;font-size:14px;color:#a9b3c2;margin-bottom:8px}' +
    'input{width:100%;box-sizing:border-box;padding:12px;border-radius:9px;border:1px solid #3a4250;background:#0f1218;color:#e8ecf2;font-size:16px}' +
    'button{margin-top:14px;width:100%;padding:12px;border:0;border-radius:9px;background:#4f8cff;color:#fff;font-size:16px;font-weight:600;cursor:pointer}' +
    'p{margin:12px 0 0;color:#ff8a8a;font-size:14px;min-height:1em}</style></head><body>' +
    '<form method="post" action="' + GATE + '"><h1>Nine Cat War Room</h1><label for="pw">Password</label>' +
    '<input id="pw" name="pw" type="password" autocomplete="current-password" autofocus required>' +
    '<input type="hidden" name="next" value="' + esc(next) + '"><button type="submit">Enter</button><p>' + esc(msg || '') + '</p></form></body></html>';
  return new Response(html, { status: status || 401, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
}

export default async function middleware(request) {
  const url = new URL(request.url);
  if (OPEN.has(url.pathname)) return;

  const hash = (process.env.SITE_PASS_HASH || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hash)) {
    return new Response('The site is locked. The password is not set up yet.', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  }
  const token = await sha256hex('ncw-cookie-v1:' + hash);

  if (url.pathname === GATE) {
    if (request.method === 'POST') {
      let pw = '', next = '/';
      try { const f = await request.formData(); pw = String(f.get('pw') || ''); next = safeNext(String(f.get('next') || '/')); } catch (e) {}
      if (pw && (await sha256hex('ncw-gate-v1:' + pw)) === hash) {
        return new Response(null, { status: 303, headers: { location: next, 'cache-control': 'no-store',
          'set-cookie': COOKIE + '=' + token + '; Path=/; Max-Age=' + DAYS * 86400 + '; HttpOnly; Secure; SameSite=Lax' } });
      }
      await new Promise(r => setTimeout(r, 800));
      return page(next, 'Wrong password, try again.', 401);
    }
    if (url.searchParams.get('out') === '1') {
      return new Response(null, { status: 303, headers: { location: '/', 'cache-control': 'no-store',
        'set-cookie': COOKIE + '=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax' } });
    }
    return page('/', '', 200);
  }

  if (cookieOf(request, COOKIE) === token) return;
  const accept = request.headers.get('accept') || '';
  if (request.method === 'GET' && accept.includes('text/html')) return page(url.pathname + url.search, '', 401);
  return new Response('Locked. Sign in at ' + url.origin + '/', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
}
