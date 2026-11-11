#!/usr/bin/env node
/* Nine Cat War Room, game by game box scores. Vikas, Nov 11 2026, version 26.18. Run on a computer with open internet access.
   Needs Node 18 or later.
   Use. node scan/fetch-games.js [--out <dir>] [--today YYYY-MM-DD] [--days N]
   It rewrites data/games.json from ESPN's scoreboard and box scores, one request for each day and one for each finished game.
   --out    the folder to write games.json to. Left off, it is the data folder of the project.
   --today  test mode clock. Left off, it is today's date in US Eastern time.
   --days   how many days back to keep, 16 when left off.
   data/games.json is published on a public site. It holds numbers only, which are the date and the box score line of each game. No ESPN text goes into it.
   The file holds
     p     for each Yahoo id, his games, newest first, ten at most. Each game is
           [day, minutes, fgm, fga, ftm, fta, threes, points, rebounds, assists, steals, blocks, turnovers, 1 when he started]
     done  the days whose games were all final when they were read. They are not read again
     new   players who played 15 minutes or more a night over their last games and are not in data/players.json yet, name, NBA team, games and minutes.
           The Yahoo scan picks them up from its last seven days list
   A day already in done is kept from the old file, so a nightly run reads only the last few days.
   Every check runs first. The file is written only at the very end, after all of them have passed.
   If a check fails one line is printed, the exit code is 1 and the old file is left as it was.
   After a network call it ends on its own rather than calling process.exit, which trips a libuv assertion on Windows */
const fs=require('fs'), path=require('path');
const API='https://site.api.espn.com/apis/site/v2/sports/basketball/nba/';
const ROOT=path.join(__dirname,'..'), DATA=path.join(ROOT,'data');
const MAP={GS:'GSW',NO:'NOP',NY:'NYK',SA:'SAS',UTAH:'UTA',WSH:'WAS'};
const T30=new Set('ATL BOS BKN CHA CHI CLE DAL DEN DET GSW HOU IND LAC LAL MEM MIA MIL MIN NOP NYK OKC ORL PHI PHX POR SAC SAS TOR UTA WAS'.split(' '));
const KEEP=10, NEWMIN=15;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
class Stop extends Error{}
let NET=false;
const stop=m=>{ console.log(m); if(!NET) process.exit(1); process.exitCode=1; throw new Stop(m); };
// the same name key the site uses, copied from nkey in index.html. Keep the two the same
const nkey = str => String(str||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[.'’`]/g,'').replace(/-/g,' ').replace(/\b(jr|sr|ii|iii|iv)\b/g,' ').replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim();
// known spelling differences, the same pairs as PALIAS and BALIAS in moves.js
const PAIRS=[['nic claxton','nicolas claxton'],['alex sarr','alexandre sarr'],['bub carrington','carlton carrington'],['herb jones','herbert jones'],['cam johnson','cameron johnson'],['bones hyland','nahshon hyland'],['gg jackson','gregory jackson'],['moe wagner','moritz wagner'],['gui santos','guilherme santos']];
const ALIAS={}; PAIRS.forEach(p=>{ ALIAS[p[0]]=p[1]; ALIAS[p[1]]=p[0]; });
const isDay=s=>typeof s==='string' && /^\d{4}-\d\d-\d\d$/.test(s) && !isNaN(Date.parse(s+'T00:00:00Z')) && new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const etDay=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
const addDays=(s,n)=>new Date(Date.parse(s+'T12:00:00Z')+n*864e5).toISOString().slice(0,10);
const readJson=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^﻿/,''));

const args=process.argv.slice(2), opt={}, KNOWN=['--out','--today','--days'];
for(let i=0;i<args.length;i++){ const a=args[i];
  if(KNOWN.indexOf(a)<0) stop('games NOT saved. The option '+a+' is not one this script knows. Use '+KNOWN.join(', ')+'. Nothing written.');
  if(i+1>=args.length || args[i+1].indexOf('--')===0) stop('games NOT saved. The option '+a+' needs a value after it. Nothing written.');
  opt[a.slice(2)]=args[++i]; }
const OUT=opt.out?path.resolve(opt.out):DATA;
const today=opt.today||etDay(new Date());
if(!isDay(today)) stop('games NOT saved. The date given with --today is not a real date in the form YYYY-MM-DD. Nothing written.');
const DAYS=opt.days==null?16:+opt.days;
if(!(Number.isInteger(DAYS) && DAYS>=3 && DAYS<=40)) stop('games NOT saved. --days must be a whole number from 3 to 40. Nothing written.');

let P=null; try{ P=readJson(path.join(DATA,'players.json')).p; }catch(e){}
if(!P || typeof P!=='object' || !Object.keys(P).length) stop('games NOT saved. The file data/players.json could not be read. Nothing written.');
const idx={}; Object.keys(P).forEach(i=>{ if(!Array.isArray(P[i])) return; const k=nkey(P[i][0]); if(k) (idx[k]||(idx[k]=[])).push(i); });
const find=(name,team)=>{ const k=nkey(name); let ids=idx[k]||(ALIAS[k]&&idx[ALIAS[k]])||[]; if(ids.length>1){ const same=ids.filter(i=>P[i][1]===team); ids=same.length===1?same:[]; } return ids.length===1?ids[0]:null; };

// one GET to ESPN, tried up to 4 times with a short wait. It never follows a redirect, so no other host is ever called
async function get(url){
  for(let k=0;k<4;k++){
    NET=true;
    try{ const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(20000)}); if(r.ok) return await r.json(); }catch(e){}
    if(k<3) await sleep(700*(k+1));
  }
  return null;
}
const num=x=>{ const v=parseFloat(x); return isFinite(v)?v:0; };
const pair=x=>{ const m=String(x||'').match(/^(\d+)-(\d+)$/); return m?[+m[1],+m[2]]:[0,0]; };

(async()=>{
  const f=path.join(OUT,'games.json'); let old=null;
  if(fs.existsSync(f)){ try{ old=readJson(f); }catch(e){ old=null; } }
  const oldP=old && old.p && typeof old.p==='object'?old.p:{}, oldNew=old && old.n && typeof old.n==='object'?old.n:{}, oldDone=new Set(old && Array.isArray(old.done)?old.done.filter(isDay):[]);
  const first=addDays(today,-DAYS), days=[]; for(let d=first; d<=today; d=addDays(d,1)) days.push(d);
  // rows by day. A day in done keeps its old rows. Every other day is read again
  const rows={}, names={}; // rows[day] = list of {id or null, key, name, team, line}
  const keepDay=d=>oldDone.has(d) && d<addDays(today,-1);
  Object.keys(oldP).forEach(id=>{ (Array.isArray(oldP[id])?oldP[id]:[]).forEach(g=>{ if(Array.isArray(g) && isDay(g[0]) && keepDay(g[0])) (rows[g[0]]||(rows[g[0]]=[])).push({id,line:g.slice(1)}); }); });
  Object.keys(oldNew).forEach(k=>{ const o=oldNew[k]; if(!o || !Array.isArray(o.g)) return; o.g.forEach(g=>{ if(Array.isArray(g) && isDay(g[0]) && keepDay(g[0])) (rows[g[0]]||(rows[g[0]]=[])).push({id:null,key:k,name:o.n,team:o.t,line:g.slice(1)}); }); });
  const done=new Set(days.filter(keepDay)), failed=[]; let gamesRead=0, live=0;
  const readDay=async day=>{
    const sb=await get(API+'scoreboard?dates='+day.replace(/-/g,'')); if(!sb || !Array.isArray(sb.events)){ failed.push(day); return; }
    const out=[]; let allFinal=true, bad=false;
    for(const e of sb.events){
      if(!(e.season && e.season.type===2)) continue;
      const c0=(e.competitions&&e.competitions[0])||{}, state=c0.status&&c0.status.type&&c0.status.type.name;
      // the NBA Cup championship game does not count, the same rule as fetch-sched.js
      const note=[e.name,e.shortName].concat([].concat(e.notes||[],c0.notes||[]).map(x=>x&&x.headline)).join(' ');
      if(/championship/i.test(note)&&/cup/i.test(note)) continue;
      if(state==='STATUS_POSTPONED' || state==='STATUS_CANCELED') continue;
      if(state!=='STATUS_FINAL'){ allFinal=false; live++; continue; }
      const s=await get(API+'summary?event='+encodeURIComponent(e.id)); const bp=s && s.boxscore && Array.isArray(s.boxscore.players)?s.boxscore.players:null;
      if(!bp){ bad=true; continue; }
      gamesRead++;
      for(const t of bp){ const st=t && Array.isArray(t.statistics)?t.statistics[0]:null; if(!st || !Array.isArray(st.athletes)) continue;
        const ab=String((t.team&&t.team.abbreviation)||'').toUpperCase(), team=MAP[ab]||ab; if(!T30.has(team)) continue;
        const lab=(st.names||st.labels||[]).map(x=>String(x).toUpperCase()), ix=k=>lab.indexOf(k);
        const iM=ix('MIN'), iP=ix('PTS'), iFG=ix('FG'), i3=ix('3PT'), iFT=ix('FT'), iR=ix('REB'), iA=ix('AST'), iTO=ix('TO'), iS=ix('STL'), iB=ix('BLK');
        if([iM,iP,iFG,i3,iFT,iR,iA,iTO,iS,iB].some(i=>i<0)){ bad=true; continue; }
        for(const a of st.athletes){ if(!a || a.didNotPlay || !Array.isArray(a.stats) || !a.stats.length || !a.athlete) continue;
          const mn=num(a.stats[iM]); if(!(mn>0)) continue;
          const nm=String(a.athlete.displayName||'').trim(); if(!nkey(nm)) continue;
          const fg=pair(a.stats[iFG]), ft=pair(a.stats[iFT]), tp=pair(a.stats[i3]);
          const line=[Math.round(mn),fg[0],fg[1],ft[0],ft[1],tp[0],num(a.stats[iP]),num(a.stats[iR]),num(a.stats[iA]),num(a.stats[iS]),num(a.stats[iB]),num(a.stats[iTO]),a.starter?1:0];
          out.push({id:find(nm,team),key:nkey(nm),name:nm,team,line}); } }
      await sleep(120);
    }
    if(bad){ failed.push(day); return; }
    rows[day]=out; if(allFinal && day<today) done.add(day);
  };
  const todo=days.filter(d=>!keepDay(d));
  for(let i=0;i<todo.length;i+=3){ await Promise.all(todo.slice(i,i+3).map(readDay)); await sleep(200); }
  // a failed day keeps whatever the old file had for it, so one bad night never empties a player's log
  failed.forEach(day=>{ if(rows[day]) return; const keep=[]; Object.keys(oldP).forEach(id=>(Array.isArray(oldP[id])?oldP[id]:[]).forEach(g=>{ if(Array.isArray(g) && g[0]===day) keep.push({id,line:g.slice(1)}); })); if(keep.length) rows[day]=keep; });
  if(failed.length>Math.max(2,todo.length/2)) stop('games NOT saved. '+failed.length+' of '+todo.length+' days could not be read from ESPN, '+failed.slice(0,6).join(' ')+'. Nothing written.');

  const p={}, nw={};
  Object.keys(rows).sort().reverse().forEach(day=>{ if(day<first) return; rows[day].forEach(r=>{ const g=[day].concat(r.line);
    if(r.id && P[r.id]){ const a=p[r.id]||(p[r.id]=[]); if(a.length<KEEP && !a.some(x=>x[0]===day)) a.push(g); }
    else if(r.key){ const o=nw[r.key]||(nw[r.key]={n:r.name,t:r.team,g:[]}); if(o.g.length<KEEP && !o.g.some(x=>x[0]===day)) o.g.push(g); } }); });
  // a player the site did not know when an older day was read may be known now. His kept games move over to his id
  Object.keys(nw).forEach(k=>{ const o=nw[k], id=find(o.n,o.t); if(!id) return; const a=p[id]||(p[id]=[]); o.g.forEach(g=>{ if(a.length<KEEP && !a.some(x=>x[0]===g[0])) a.push(g); }); a.sort((x,y)=>x[0]<y[0]?1:-1); delete nw[k]; });
  // only the unknown players who matter are kept, 15 minutes or more a night over their last three games
  const n={}; Object.keys(nw).forEach(k=>{ const o=nw[k], l3=o.g.slice(0,3); if(l3.length>=2 && l3.reduce((s,g)=>s+g[1],0)/l3.length>=NEWMIN && o.g[0][0]>=addDays(today,-6)) n[k]=o; });
  const np=Object.keys(p).length;
  if(np<150) stop('games NOT saved. Only '+np+' known players came back with a game, far fewer than expected. Nothing written.');
  const out={made:new Date().toISOString().slice(0,19)+'Z',day:today,src:'ESPN box scores, numbers only',from:first,done:[...done].filter(d=>d>=first).sort(),p,n};
  try{ if(!fs.existsSync(OUT)) fs.mkdirSync(OUT,{recursive:true}); const tmp=f+'.tmp'; fs.writeFileSync(tmp,JSON.stringify(out)); fs.renameSync(tmp,f); }
  catch(e){ stop('games NOT saved. The file games.json could not be written in the output folder.'); }
  if(failed.length) console.log('WARNING, these days could not be read and keep what the old file had, '+failed.join(' ')+'.');
  const nl=Object.keys(n).map(k=>n[k].n+' '+n[k].t+' '+Math.round(n[k].g.slice(0,3).reduce((s,g)=>s+g[1],0)/Math.min(3,n[k].g.length))+' min');
  if(nl.length) console.log('Not on the site yet and playing real minutes, '+nl.slice(0,12).join(', ')+'.');
  const newest=Object.keys(rows).filter(d=>rows[d].length).sort().pop()||'none';
  console.log('games saved, '+np+' players, '+gamesRead+' box scores read, '+todo.length+' days read and '+(days.length-todo.length)+' kept, newest game day '+newest+(live?', '+live+' games not final yet':'')+', '+nl.length+' players not on the site yet');
})().catch(e=>{ if(e instanceof Stop) return; console.log('games NOT saved. '+String(e&&e.message||e).slice(0,120)+'. Nothing written.'); process.exitCode=1; });
