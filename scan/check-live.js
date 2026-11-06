#!/usr/bin/env node
/* Nine Cat War Room, live site check. Vikas, Nov 5 2026, version 26.13.
   Run it after a deploy, or any time, to say loudly whether the live site carries the data on this computer.
   It reads the one open file on the site, /data/players.json, which the ingest stamps with every scan, and compares that stamp with the local copy.
   No password, no cookie, no secret. It changes nothing.
   Use. node scan/check-live.js        Prints LIVE OK and exits 0, or LIVE STALE with both stamps and exits 1, or LIVE UNKNOWN and exits 2 when the site did not answer.
   It ends on its own rather than calling process.exit, which trips a libuv assertion on Windows after a fetch */
const fs=require('fs'), path=require('path');
const SITE='https://ninecatwarroom.vercel.app', DATA=path.join(__dirname,'..','data');
(async()=>{
  let local=null; try{ local=JSON.parse(fs.readFileSync(path.join(DATA,'players.json'),'utf8')).updated||null; }catch(e){}
  if(!local){ console.log('LIVE UNKNOWN, the local data/players.json could not be read.'); process.exitCode=2; return; }
  let live=null;
  for(let k=0;k<3 && live==null;k++){
    try{ const r=await fetch(SITE+'/data/players.json',{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)}); if(r.ok){ const j=await r.json(); live=j.updated||''; } }catch(e){}
    if(live==null && k<2) await new Promise(r=>setTimeout(r,1500));
  }
  if(live==null){ console.log('LIVE UNKNOWN, the site did not answer. Check the live site in Chrome. Local stamp '+local+'.'); process.exitCode=2; return; }
  if(live===local){ console.log('LIVE OK, the live site carries the local data, stamp '+local+'.'); process.exitCode=0; return; }
  console.log('LIVE STALE. The live site is on '+(live||'an unknown stamp')+' and this computer has '+local+'. The deploy did not go through. Say so loudly in the report and ask Vikas to run the deploy.');
  process.exitCode=1;
})();
