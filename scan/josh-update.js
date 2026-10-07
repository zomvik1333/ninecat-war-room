#!/usr/bin/env node
/* Nine Cat War Room, Josh Lloyd rank updates during the season. Needs Node 18 or later. Makes no network call.
   Use. node scan/josh-update.js --updates <file> [--src <file or folder>] [--out <dir>] [--today YYYY-MM-DD] [--dry]
   It rewrites data/josh_live.json, the newest Josh rank for every player he has moved since the draft.
   --updates  the hand written list of moves. It must sit outside the project, in the notes folder. It is the full list for the season, old entries included.
   --src      the transcripts the moves came from, one file or a folder of text files, outside the project. Every note is checked against them
              so that no note repeats 6 words in a row from a transcript. Leave it off only when there is no transcript text at hand.
   --out      the folder to write josh_live.json to. Left off, it is the data folder of the project.
   --today    test mode clock. Left off, it is today's date in US Eastern time.
   --dry      checks everything and prints the result, writes nothing.
   The updates file is a list. Each entry names a player and gives either a rank or a move.
     {"name":"Kevin Porter Jr.","rank":95,"at":"2026-10-12","show":"Week 1 risers","note":"one line in your own words"}
     {"name":"Josh Hart","move":-10,"at":"2026-10-12","show":"Week 1 fallers","note":"one line in your own words"}
     {"name":"Reed Sheppard","clear":true,"at":"2026-10-20"}
   rank is the spot Josh now gives him. move is how many places he moved, where a negative number is up the board, toward 1.
   clear takes the player back to his draft day rank. soft, when true, marks a passing remark that counts a little less.
   For each player the entry with the newest date wins. Entries with the same date are read in file order, so the later one wins.
   data/josh_live.json is published on a public site. Notes must be in your own words. Josh's sentences never go into it.
   Every check runs first. The file is written only at the very end, after all of them have passed.
   If a check fails one line is printed for each problem, the exit code is 1 and the old file is left as it was. */
const fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..'), DATA=path.join(ROOT,'data');
const NOTE_MAX=200, SHOW_MAX=60, RUN=6, RMAX=400;
const stop=m=>{ console.log(m); process.exit(1); };
// the same name key the site uses, copied from nkey in index.html. Keep the two the same
const nkey = str => String(str||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[.'’`]/g,'').replace(/-/g,' ').replace(/\b(jr|sr|ii|iii|iv)\b/g,' ').replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim();
// known spelling differences. The first of each pair is how the board spells it, the same pairs as BALIAS in moves.js
const PAIRS=[['nic claxton','nicolas claxton'],['alex sarr','alexandre sarr'],['bub carrington','carlton carrington'],['herb jones','herbert jones'],['cam johnson','cameron johnson'],['bones hyland','nahshon hyland'],['gui santos','guilherme santos']];
const TOBOARD=Object.create(null); PAIRS.forEach(p=>{ TOBOARD[p[1]]=p[0]; });
const isDay=s=>typeof s==='string' && /^\d{4}-\d\d-\d\d$/.test(s) && !isNaN(Date.parse(s+'T00:00:00Z')) && new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const etDay=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
const daysOld=(day,today)=>Math.round((Date.parse(today+'T00:00:00Z')-Date.parse(day+'T00:00:00Z'))/864e5);
const readJson=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^﻿/,''));
const real=p=>{ let cur=path.resolve(p); const tail=[]; for(;;){ try{ return path.join(fs.realpathSync(cur),...tail); }catch(e){ const up=path.dirname(cur); if(up===cur) return path.resolve(p); tail.unshift(path.basename(cur)); cur=up; } } };
const inside=(child,parent)=>{ const r=path.relative(real(parent),real(child)); return r==='' || (r!=='..' && r.indexOf('..'+path.sep)!==0 && !path.isAbsolute(r)); };
const words=t=>String(t||'').toLowerCase().replace(/[^a-z0-9' ]+/g,' ').split(/\s+/).filter(Boolean);

// options
const args=process.argv.slice(2), opt={}, KNOWN=['--updates','--src','--out','--today'], FLAGS=['--dry'];
for(let i=0;i<args.length;i++){ const a=args[i];
  if(FLAGS.indexOf(a)>=0){ opt[a.slice(2)]=true; continue; }
  if(KNOWN.indexOf(a)<0) stop('josh NOT saved. The option '+a+' is not one this script knows. Use '+KNOWN.concat(FLAGS).join(', ')+'. Nothing written.');
  if(i+1>=args.length || args[i+1].indexOf('--')===0) stop('josh NOT saved. The option '+a+' needs a value after it. Nothing written.');
  opt[a.slice(2)]=args[++i]; }
const OUT=opt.out?path.resolve(opt.out):DATA, today=opt.today||etDay(new Date());
if(!isDay(today)) stop('josh NOT saved. The date given with --today is not a real date in the form YYYY-MM-DD. Nothing written.');
if(!opt.updates) stop('josh NOT saved. Give the updates file with --updates. Nothing written.');
if(inside(opt.updates,ROOT)) stop('josh NOT saved. The updates file is inside the project folder. The project is public, so keep it in the notes folder. Nothing written.');
if(opt.src && inside(opt.src,ROOT)) stop('josh NOT saved. The transcripts path is inside the project folder. Transcripts must never sit in the project, which is public. Nothing written.');
if(!fs.existsSync(opt.updates)) stop('josh NOT saved. The updates file was not found. Nothing written.');

// the names the site knows. The board's Josh list in index.html, and every Yahoo player
let JOSH=null; try{ const h=fs.readFileSync(path.join(ROOT,'index.html'),'utf8'), i=h.indexOf('const JOSH = {'), j=h.indexOf('};',i); if(i>=0 && j>i) JOSH=JSON.parse(h.slice(i+'const JOSH = '.length,j+1)); }catch(e){}
if(!JOSH || typeof JOSH!=='object' || Object.keys(JOSH).length<50) stop('josh NOT saved. The Josh list in index.html could not be read. Nothing written.');
let P=null; try{ P=readJson(path.join(DATA,'players.json')).p; }catch(e){}
if(!P || typeof P!=='object' || !Object.keys(P).length) stop('josh NOT saved. The file data/players.json could not be read. Nothing written.');
const base=Object.create(null), known=Object.create(null); Object.keys(JOSH).forEach(n=>{ const k=nkey(n), r=Array.isArray(JOSH[n])?JOSH[n][0]:null; if(k){ known[k]=n; if(Number.isInteger(r)) base[k]=r; } });
Object.keys(P).forEach(i=>{ if(!Array.isArray(P[i])) return; const k=nkey(P[i][0]); if(k && !known[k] && !known[TOBOARD[k]]) known[k]=P[i][0]; });
const keyOf=name=>{ const k=nkey(name); return known[k]?k:(TOBOARD[k] && known[TOBOARD[k]])?TOBOARD[k]:null; };
const near=name=>{ const w=nkey(name).split(' '), last=w[w.length-1], first=w[0]; return Object.keys(known).filter(k=>{ const a=k.split(' '); return a[a.length-1]===last || (a[0]===first && first.length>3); }).slice(0,5).map(k=>known[k]); };

// the transcripts, for the copy check
let srcRuns=null, srcN=0;
if(opt.src){ let files=[]; try{ const st=fs.statSync(opt.src); files=st.isDirectory()?fs.readdirSync(opt.src).filter(f=>/\.(txt|md)$/i.test(f)).map(f=>path.join(opt.src,f)):[opt.src]; }catch(e){ stop('josh NOT saved. The transcripts path was not found. Nothing written.'); }
  srcRuns=new Set(); files.forEach(f=>{ let t=''; try{ t=fs.readFileSync(f,'utf8'); }catch(e){ return; } srcN++; const w=words(t); for(let i=0;i+RUN<=w.length;i++) srcRuns.add(w.slice(i,i+RUN).join(' ')); });
  if(!srcN) stop('josh NOT saved. No transcript text could be read from the path given with --src. Nothing written.'); }
const copied=note=>{ if(!srcRuns) return false; const w=words(note); for(let i=0;i+RUN<=w.length;i++) if(srcRuns.has(w.slice(i,i+RUN).join(' '))) return true; return false; };

// the updates
let U=null; try{ U=readJson(opt.updates); }catch(e){ stop('josh NOT saved. The updates file is not valid JSON. '+String(e.message).slice(0,120)+'. Nothing written.'); }
if(!Array.isArray(U)) stop('josh NOT saved. The updates file must be a list of entries. Nothing written.');
const bad=[], rows=[];
U.forEach((u,i)=>{ const at='Entry '+(i+1); if(!u || typeof u!=='object' || Array.isArray(u)){ bad.push(at+' is not an entry.'); return; }
  const who=typeof u.name==='string'?u.name.trim():''; if(!who){ bad.push(at+' has no name.'); return; }
  const k=keyOf(who); if(!k){ const n=near(who); bad.push(at+', the name '+who+' matches no player.'+(n.length?' Close names are '+n.join(', ')+'.':'')); return; }
  if(!isDay(u.at)){ bad.push(at+', '+who+', the date must be a real date in the form YYYY-MM-DD.'); return; }
  const age=daysOld(u.at,today); if(age<-1){ bad.push(at+', '+who+', the date is in the future.'); return; } if(age>400){ bad.push(at+', '+who+', the date is more than 400 days old.'); return; }
  const kinds=(u.clear===true?1:0)+(u.rank!==undefined?1:0)+(u.move!==undefined?1:0);
  if(kinds!==1){ bad.push(at+', '+who+', give exactly one of rank, move or clear.'); return; }
  if(u.rank!==undefined && !(Number.isInteger(u.rank) && u.rank>=1 && u.rank<=RMAX)){ bad.push(at+', '+who+', rank must be a whole number from 1 to '+RMAX+'.'); return; }
  if(u.move!==undefined && !(Number.isInteger(u.move) && u.move!==0 && Math.abs(u.move)<=200)){ bad.push(at+', '+who+', move must be a whole number of places, not zero, 200 at most.'); return; }
  let note='', show='';
  if(u.note!==undefined){ if(typeof u.note!=='string'){ bad.push(at+', '+who+', the note must be text.'); return; } note=u.note.replace(/\s+/g,' ').trim();
    if(note.length>NOTE_MAX){ bad.push(at+', '+who+', the note is longer than '+NOTE_MAX+' characters.'); return; }
    if(/[‐-―]| - |:/.test(note)){ bad.push(at+', '+who+', the note has a dash or a colon. The site uses neither.'); return; }
    if(/["“”]/.test(note)){ bad.push(at+', '+who+', the note has quote marks. Write it in your own words with no quotes.'); return; }
    if(/[<>]/.test(note)){ bad.push(at+', '+who+', the note has an angle bracket. Plain words only.'); return; }
    if(copied(note)){ bad.push(at+', '+who+', the note repeats '+RUN+' words in a row from a transcript. Write it in your own words.'); return; } }
  if(u.show!==undefined){ if(typeof u.show!=='string'){ bad.push(at+', '+who+', the show name must be text.'); return; } show=u.show.replace(/\s+/g,' ').trim(); if(show.length>SHOW_MAX || /[‐-―]|:|[<>"]/.test(show)){ bad.push(at+', '+who+', the show name must be '+SHOW_MAX+' characters or less with no dash, colon, quote mark or angle bracket.'); return; } }
  rows.push({i,k,who:known[k],at:u.at,rank:u.rank,move:u.move,clear:u.clear===true,note,show,soft:u.soft===true}); });

// read in date order, then file order, so a move is applied to the rank that stood before it
rows.sort((a,b)=>a.at<b.at?-1:a.at>b.at?1:a.i-b.i);
const live=Object.create(null);
rows.forEach(r=>{ const cur=live[r.k], was=cur?cur.rank:(base[r.k]||null);
  if(r.clear){ delete live[r.k]; return; }
  let rank=r.rank;
  if(r.move!==undefined){ if(!was){ bad.push('Entry '+(r.i+1)+', '+r.who+', a move needs a rank to move from and he has none. Give a rank.'); return; } rank=Math.max(1,Math.min(RMAX,was+r.move)); }
  const e={n:r.who,rank,at:r.at}; if(was) e.was=was; if(base[r.k]) e.base=base[r.k]; if(r.show) e.show=r.show; if(r.note) e.note=r.note; if(r.soft) e.soft=true; live[r.k]=e; });
if(bad.length){ bad.forEach(x=>console.log(x)); stop('josh NOT saved. '+bad.length+(bad.length===1?' entry needs':' entries need')+' fixing. Nothing written.'); }

const keys=Object.keys(live).sort(), out={made:new Date().toISOString().replace(/\.\d+Z$/,'Z'),src:'Josh Lloyd shows, read by hand',n:keys.length,p:{}}; keys.forEach(k=>{ out.p[k]=live[k]; });
let old=null; try{ old=readJson(path.join(OUT,'josh_live.json')); }catch(e){}
const oldP=Object.create(null); if(old && old.p && typeof old.p==='object' && !Array.isArray(old.p)) Object.keys(old.p).forEach(k=>{ if(old.p[k] && typeof old.p[k]==='object') oldP[k]=old.p[k]; });
const changed=keys.filter(k=>!oldP[k] || oldP[k].rank!==live[k].rank || oldP[k].at!==live[k].at || (oldP[k].note||'')!==(live[k].note||'')), gone=Object.keys(oldP).filter(k=>!live[k]);
keys.forEach(k=>{ const e=live[k]; if(changed.indexOf(k)>=0) console.log((e.n+'                         ').slice(0,26)+' '+(e.was?String(e.was):'none')+' to '+e.rank+(e.base && e.base!==e.was?', draft day '+e.base:'')+', '+e.at+(e.show?', '+e.show:'')); });
gone.forEach(k=>console.log((String(oldP[k].n||k)+'                         ').slice(0,26)+' back to his draft day rank'));
if(!srcRuns) console.log('WARNING, no transcripts were given with --src, so the notes were not checked against them.');
if(opt.dry){ console.log('josh check passed, '+keys.length+' players on file, '+changed.length+' new or changed, '+gone.length+' cleared. Dry run, nothing written.'); process.exit(0); }
try{ fs.mkdirSync(OUT,{recursive:true}); const tmp=path.join(OUT,'josh_live.json.tmp'); fs.writeFileSync(tmp,JSON.stringify(out)); fs.renameSync(tmp,path.join(OUT,'josh_live.json')); }catch(e){ stop('josh NOT saved. The file could not be written. '+String(e.message).slice(0,120)); }
console.log('josh saved, '+keys.length+' players on file, '+changed.length+' new or changed, '+gone.length+' cleared.');
