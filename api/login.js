const Y = require('./_yahoo');
const crypto = require('crypto');
module.exports = (req, res) => {
  if (!Y.configured()) { res.statusCode = 503; res.setHeader('Content-Type', 'text/html'); return res.end('<p>Yahoo is not set up yet. Add YAHOO_CLIENT_ID and YAHOO_CLIENT_SECRET in the Vercel project settings, then redeploy.</p><p><a href="/">Back to the board</a></p>'); }
  const state = crypto.randomBytes(16).toString('hex');
  Y.setCookie(res, 'ncw_state', state, 600);
  const q = new URLSearchParams({ client_id: process.env.YAHOO_CLIENT_ID, redirect_uri: Y.redirectUri(req), response_type: 'code', scope: 'fspt-r', prompt: 'consent', state, language: 'en-us' });
  res.statusCode = 302; res.setHeader('Location', Y.AUTH_URL + '?' + q.toString()); res.end();
};
