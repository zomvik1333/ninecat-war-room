const Y = require('./_yahoo');
module.exports = async (req, res) => {
  const url = new URL(req.url, 'https://x');
  const code = url.searchParams.get('code'), state = url.searchParams.get('state');
  const expect = Y.cookies(req).ncw_state;
  const back = msg => { res.statusCode = 302; res.setHeader('Location', '/?yahoo=' + encodeURIComponent(msg)); res.end(); };
  if (!Y.configured()) return back('not_configured');
  if (process.env.NCW_DEBUG) console.log('callback', !!code, !!state, state === expect, url.searchParams.get('error') || '', url.searchParams.get('error_description') || '');
  if (!code || !state || state !== expect) return back('failed');
  try {
    const t = await Y.tokenCall(req, { grant_type: 'authorization_code', code });
    Y.setCookie(res, 'ncw_state', '', 0);
    Y.saveSession(res, t);
    back('connected');
  } catch (e) { back('failed'); }
};
