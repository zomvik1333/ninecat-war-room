#!/usr/bin/env node
/* Nine Cat War Room, team depth charts. Run on a computer with open internet access.
   Needs Node 18 or later.
   Use. node scan/fetch-depth.js [--out <dir>] [--from <dir>] [--today YYYY-MM-DD]
   It rewrites data/depth.json from ESPN's depth chart feed, one request for each of the 30 teams.
   --out    the folder to write depth.json to. Left off, it is the data folder of the project.
   --from   test mode. Reads each team from <dir>/<ESPN team id>.json and makes no network call.
   --today  test mode clock. Left off, it is today's date in US Eastern time.
   data/depth.json is published on a public site. It holds facts only, which are Yahoo player ids, the order ESPN lists them in
   at each position, and the date a player's spot last changed. No ESPN text goes into it.
   The file holds
     t   for each team, five lists for PG SG SF PF C, each one the Yahoo ids in ESPN's order. A player the site does not know is an empty string,
         so the order of the players it does know stays right.
     p   for each Yahoo id, [team, spot, spot before, day the spot changed]. Spot 0 is a starter, 1 is first off the bench at his best position, and so on.
         The spot is the best one he holds at any position.
   Every check runs first. The file is written only at the very end, after all of them have passed.
   If a check fails one line is printed, the exit code is 1 and the old file is left as it was. */
const fs=require('fs'), path=require('path');
const URL0='https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/';
const ROOT=path.join(__dirname,'..'), DATA=path.join(ROOT,'data');
const TID={1:'ATL',2:'BOS',3:'NOP',4:'CHI',5:'CLE',6:'DAL',7:'DEN',8:'DET',9:'GSW',10:'HOU',11:'IND',12:'LAC',13:'LAL',14:'MIA',15:'MIL',16:'MIN',17:'BKN',18:'NYK',19:'ORL',20:'PHI',21:'PHX',22:'POR',23:'SAC',24:'SAS',25:'OKC',26:'UTA',27:'WAS',28:'TOR',29:'MEM',30:'CHA'};
const POS=['pg','sg','sf','pf','c'];
const MIN_TEAMS=28;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const stop=m=>{ console.log(m); process.exit(1); };
const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
// the same name key the site uses, copied from nkey in index.html. Keep the two the same
const nkey = str => String(str||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[.'’`]/g,'').replace(/-/g,' ').replace(/\b(jr|sr|ii|iii|iv)\b/g,' ').replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim();
// known spelling differences, the same pairs as PALIAS and BALIAS in moves.js
const PAIRS=[['nic claxton','nicolas claxton'],['alex sarr','alexandre sarr'],['bub carrington','carlton carrington'],['herb jones','herbert jones'],['cam johnson','cameron johnson'],['bones hyland','nahshon hyland'],['gg jackson','gregory jackson'],['moe wagner','moritz wagner'],['gui santos','guilherme santos']];
const ALIAS={}; PAIRS.forEach(p=>{ ALIAS[p[0]]=p[1]; ALIAS[p[1]]=p[0]; });
const isDay=s=>typeof s==='string' && /^\d{4}-\d\d-\d\d$/.test(s) && !isNaN(Date.parse(s+'T00:00:00Z')) && new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const etDay=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
const readJson=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^﻿/,''));

const args=process.argv.slice(2), opt={}, KNOWN=['--out','--from','--today'];
for(let i=0;i<args.length;i++){ const a=args[i];
  if(KNOWN.indexOf(a)<0) stop('depth NOT saved. The option '+a+' is not one this script knows. Use '+KNOWN.join(', ')+'. Nothing written.');
  if(i+1>=args.length || args[i+1].indexOf('--')===0) stop('depth NOT saved. The option '+a+' needs a value after it. Nothing written.');
  opt[a.slice(2)]=args[++i]; }
const OUT=opt.out?path.resolve(opt.out):DATA;
const today=opt.today||etDay(new Date());
if(!isDay(today)) stop('depth NOT saved. The date given with --today is not a real date in the form YYYY-MM-DD. Nothing written.');

let P=null; try{ P=readJson(path.join(DATA,'players.json')).p; }catch(e){}
if(!P || typeof P!=='object' || !Object.keys(P).length) stop('depth NOT saved. The file data/players.json could not be read. Nothing written.');
const idx={}; Object.keys(P).forEach(i=>{ if(!Array.isArray(P[i])) return; const k=nkey(P[i][0]); if(k) (idx[k]||(idx[k]=[])).push(i); });
const find=(name,team)=>{ const k=nkey(name); let ids=idx[k]||(ALIAS[k]&&idx[ALIAS[k]])||[]; if(ids.length>1){ const same=ids.filter(i=>P[i][1]===team); ids=same.length===1?same:[]; } return ids.length===1?ids[0]:null; };

// one GET to ESPN, tried up to 4 times with a short wait. It never follows a redirect, so no other host is ever called
async function get(url){
  for(let k=0;k<4;k++){
    try{ const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(20000)}); if(r.ok) return await r.json(); }catch(e){}
    if(k<3) await sleep(700*(k+1));
  }
  return null;
}

(async()=>{
  const say=[], t={}, seen={}, failed=[];
  for(const id of Object.keys(TID)){
    const code=TID[id]; let d=null;
    if(opt.from){ const f=path.join(opt.from,id+'.json'); try{ d=readJson(f); }catch(e){ d=null; } }
    else { d=await get(URL0+id+'/depthcharts'); await sleep(250); }
    const dc=d && Array.isArray(d.depthchart) && d.depthchart[0] && d.depthchart[0].positions;
    if(!dc || POS.some(k=>!dc[k] || !Array.isArray(dc[k].athletes) || !dc[k].athletes.length)){ failed.push(code); continue; }
    const tm=d.team && d.team.id!=null && String(d.team.id)!==String(id) ? null : code;
    if(!tm){ failed.push(code); continue; }
    t[code]=POS.map(k=>{ const out=[];
      dc[k].athletes.slice(0,8).forEach(a=>{ const nm=a && typeof a.displayName==='string'?a.displayName:''; const yid=nm?find(nm,code):null;
        if(yid){ if(seen[yid] && seen[yid]!==code){ say.push('WARNING, '+P[yid][0]+' is listed by both '+seen[yid]+' and '+code+'. Kept under '+seen[yid]+'.'); out.push(''); return; } seen[yid]=code; }
        out.push(yid||''); });
      return out; });
    const st=new Set(t[code].map(l=>l[0]).filter(Boolean));
    if(t[code].some(l=>!l[0])) say.push('NOTE, '+code+' has a starter the site does not track.');
    else if(st.size<5) say.push('WARNING, '+code+' lists the same player as a starter at two positions.');
  }
  if(Object.keys(t).length<MIN_TEAMS) stop('depth NOT saved. Only '+Object.keys(t).length+' of 30 teams came back in the right shape'+(failed.length?', missing '+failed.join(' '):'')+'. Nothing written.');
  if(failed.length) say.push('WARNING, these teams did not come back and keep their old chart, '+failed.join(' ')+'.');

  // the old file gives each player's spot before today, so a move can be dated
  const f=path.join(OUT,'depth.json'); let old=null;
  if(fs.existsSync(f)){ try{ old=readJson(f); }catch(e){ say.push('WARNING, the old depth file could not be read, so every spot counts as new today.'); } }
  const op=old && old.p && typeof old.p==='object'?old.p:{}, ot=old && old.t && typeof old.t==='object'?old.t:{};
  failed.forEach(code=>{ if(Array.isArray(ot[code]) && ot[code].length===5) t[code]=ot[code]; });

  const p={}, into=[], outOf=[], up=[], down=[];
  Object.keys(t).forEach(code=>{ const best={};
    t[code].forEach(list=>list.forEach((id,s)=>{ if(id && (best[id]==null || s<best[id])) best[id]=s; }));
    Object.keys(best).forEach(id=>{ const s=best[id], o=Array.isArray(op[id])?op[id]:null;
      if(o && o[0]===code && o[1]===s){ p[id]=[code,s,o[2]==null?null:o[2],isDay(o[3])?o[3]:today]; return; }
      const was=o && o[0]===code && Number.isInteger(o[1])?o[1]:null;
      p[id]=[code,s,was,today];
      if(was!=null){ const n=P[id][0];
        if(s===0) into.push(n); else if(was===0) outOf.push(n); else if(s<was) up.push(n); else down.push(n); } }); });
  if(Object.keys(p).length<150) stop('depth NOT saved. Only '+Object.keys(p).length+' tracked players were found on the charts, far fewer than expected. Nothing written.');

  const out={made:new Date().toISOString().slice(0,19)+'Z',day:today,src:'ESPN depth charts, order only',t,p};
  fs.writeFileSync(f,JSON.stringify(out));
  say.forEach(x=>console.log(x));
  if(into.length) console.log('Into the starting five, '+into.join(', ')+'.');
  if(outOf.length) console.log('Out of the starting five, '+outOf.join(', ')+'.');
  if(up.length) console.log('Up the bench, '+up.join(', ')+'.');
  if(down.length) console.log('Down the bench, '+down.join(', ')+'.');
  const starters=Object.keys(p).filter(id=>p[id][1]===0).length;
  console.log('depth saved, '+Object.keys(t).length+' teams, '+Object.keys(p).length+' tracked players placed, '+starters+' of them starters, '+(into.length+outOf.length+up.length+down.length)+' moves since the last run.');
})().catch(e=>stop('depth NOT saved. '+String(e&&e.message||e).slice(0,120)+'. Nothing written.'));
