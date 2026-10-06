#!/usr/bin/env node
/* Nine Cat War Room, injury news. Run on a computer with open internet access.
   Use. node scan/fetch-news.js [--out <dir>] [--from <file>] [--raw <file>] [--tags <file>] [--today YYYY-MM-DD]
   It rewrites data/news.json from the ESPN injuries feed with one request.
   --out    the folder to write news.json to. Left off, it is the data folder of the project.
   --from   test mode. Reads the injuries feed from a local JSON file and makes no network call.
   --raw    also writes the private raw file there. It holds ESPN's comment text, so the path must be outside the project.
   --tags   merges the hand written tags in that file. Left off, tags still fresh in the old news.json are kept.
   --today  test mode clock. Left off, it is today's date in US Eastern time.
   data/news.json is published on a public site. It holds facts only, which are status, body part, return date and dates.
   ESPN's written comment text never goes into it. That text goes only into the raw file.
   Every check runs first. The files are written only at the very end, after all of them have passed.
   If a check fails one line is printed, the exit code is 1 and the old files are left as they were. */
const fs=require('fs'), path=require('path');
const FEED='https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries';
const ROOT=path.join(__dirname,'..'), DATA=path.join(ROOT,'data');
const MAP={GS:'GSW',NO:'NOP',NY:'NYK',SA:'SAS',UTAH:'UTA',WSH:'WAS'};
// ESPN team ids. The feed groups players under their current team by id, and that is more up to date than the team named inside each player
const TID={1:'ATL',2:'BOS',3:'NOP',4:'CHI',5:'CLE',6:'DAL',7:'DEN',8:'DET',9:'GSW',10:'HOU',11:'IND',12:'LAC',13:'LAL',14:'MIA',15:'MIL',16:'MIN',17:'BKN',18:'NYK',19:'ORL',20:'PHI',21:'PHX',22:'POR',23:'SAC',24:'SAS',25:'OKC',26:'UTA',27:'WAS',28:'TOR',29:'MEM',30:'CHA'};
const FRESH=10, NOTE_MAX=200, DIRS=['good','bad','neutral'];
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
const daysOld=(day,today)=>Math.round((Date.parse(today+'T00:00:00Z')-Date.parse(day+'T00:00:00Z'))/864e5);
const txt=(x,max)=>{ if(typeof x!=='string') return null; const s=x.replace(/\s+/g,' ').trim(); return s&&s.length<=max?s:null; };
const readJson=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^﻿/,''));
const DASH=/[–—]/;
// the true place of a path, with links followed as far as the path exists
const real=p=>{ let cur=path.resolve(p); const tail=[]; for(;;){ try{ return path.join(fs.realpathSync(cur),...tail); }catch(e){ const up=path.dirname(cur); if(up===cur) return path.resolve(p); tail.unshift(path.basename(cur)); cur=up; } } };
const inside=(child,parent)=>{ const r=path.relative(real(parent),real(child)); return r==='' || (r!=='..' && r.indexOf('..'+path.sep)!==0 && !path.isAbsolute(r)); };

// options
const args=process.argv.slice(2), opt={}, KNOWN=['--out','--from','--raw','--tags','--today'];
for(let i=0;i<args.length;i++){ const a=args[i];
  if(KNOWN.indexOf(a)<0) stop('news NOT saved. The option '+a+' is not one this script knows. Use '+KNOWN.join(', ')+'. Nothing written.');
  if(i+1>=args.length || args[i+1].indexOf('--')===0) stop('news NOT saved. The option '+a+' needs a value after it. Nothing written.');
  opt[a.slice(2)]=args[++i]; }
const OUT=opt.out?path.resolve(opt.out):DATA;
const today=opt.today||etDay(new Date());
if(!isDay(today)) stop('news NOT saved. The date given with --today is not a real date in the form YYYY-MM-DD. Nothing written.');

// the raw file holds copyrighted comment text. It must never sit in the project, which is published, or in the output folder
const RAW=opt.raw?path.resolve(opt.raw):null;
if(RAW){
  if(inside(RAW,ROOT)) stop('news NOT saved. The raw file path is inside the project folder. The raw file holds ESPN comment text and the project is public, so give a path outside the project. Nothing written.');
  if(inside(RAW,OUT)) stop('news NOT saved. The raw file path is inside the output folder. Give a path outside it. Nothing written.');
  let ok=false; try{ ok=fs.statSync(path.dirname(RAW)).isDirectory(); }catch(e){}
  if(!ok) stop('news NOT saved. The folder for the raw file does not exist. Nothing written.');
  if(opt.tags && real(opt.tags)===real(RAW)) stop('news NOT saved. The raw file and the tags file are the same file. Nothing written.');
}

// the players the site knows
let P=null; try{ P=readJson(path.join(DATA,'players.json')).p; }catch(e){}
if(!P || typeof P!=='object' || !Object.keys(P).length) stop('news NOT saved. The file data/players.json could not be read. Nothing written.');
const idx={}; Object.keys(P).forEach(i=>{ if(!Array.isArray(P[i])) return; const k=nkey(P[i][0]); if(k) (idx[k]||(idx[k]=[])).push(i); });

// tags. Every tag in the file is checked, old ones too. A tag is fresh when its date is today or up to 10 days back. One day ahead is allowed for a clock in another time zone
const say=[]; let tags=null, carried=false;
const freshAge=d=>{ const n=daysOld(d,today); return n>=-1 && n<=FRESH; };
if(opt.tags){
  if(!fs.existsSync(opt.tags)){ say.push('WARNING, the tags file was not found. Tags that are still fresh in the old news file are kept.'); }
  else {
    try{ tags=readJson(opt.tags); }catch(e){ stop('news NOT saved. The tags file is not valid JSON. Nothing written.'); }
    if(!tags || typeof tags!=='object' || Array.isArray(tags)) stop('news NOT saved. The tags file must hold one object with a player id for each tag. Nothing written.');
  }
}
const bad=[]; const use={}; let oldTags=0;
if(tags){
  Object.keys(tags).forEach(id=>{ const t=tags[id], e=[];
    if(!has(P,id) || !Array.isArray(P[id])) e.push('that id is not a player in data/players.json');
    if(!t || typeof t!=='object' || Array.isArray(t)){ e.push('the tag is not an object'); bad.push('Player id '+id+', '+e.join(' and ')); return; }
    if(DIRS.indexOf(t.dir)<0) e.push('dir must be good, bad or neutral');
    let note=null;
    if(t.note!=null){
      if(typeof t.note!=='string') e.push('the note is not text');
      else { note=t.note.trim()||null;
        if(note && note.length>NOTE_MAX) e.push('the note is longer than '+NOTE_MAX+' characters');
        if(note && DASH.test(note)) e.push('the note has a dash character in it');
        if(note && /[\r\n]/.test(note)) e.push('the note runs over more than one line'); }
    }
    if(!isDay(t.at)) e.push('the date is not a real date in the form YYYY-MM-DD');
    else if(daysOld(t.at,today)<-1) e.push('the date is more than one day after today');
    let src=null;
    if(t.src!=null){ src=txt(t.src,30); if(!src || DASH.test(src)) e.push('the source name must be a short name of 30 characters or less'); }
    if(e.length){ bad.push('Player id '+id+', '+e.join(' and ')); return; }
    if(!freshAge(t.at)){ oldTags++; return; }
    use[id]={dir:t.dir,note:note,tagAt:t.at,tagSrc:src};
  });
  if(bad.length) stop('news NOT saved. The tags file has '+bad.length+' bad tag'+(bad.length>1?'s':'')+'. '+bad.join('. ')+'. Fix the tags file and run it again. Nothing written.');
} else {
  // no tags file, so carry over the tags that are still fresh in the news file already on disk. A rerun never loses them
  carried=true; let old=null; const f=path.join(OUT,'news.json');
  if(fs.existsSync(f)){ try{ old=readJson(f); }catch(e){ say.push('WARNING, the old news file could not be read, so no tags were carried over.'); } }
  const op=old&&old.p&&typeof old.p==='object'?old.p:{};
  Object.keys(op).forEach(id=>{ const t=op[id]; if(!t || typeof t!=='object' || t.dir==null) return;
    const note=t.note==null?null:txt(t.note,NOTE_MAX), src=t.tagSrc==null?null:txt(t.tagSrc,30);
    if(!has(P,id) || !Array.isArray(P[id]) || DIRS.indexOf(t.dir)<0 || !isDay(t.tagAt) || daysOld(t.tagAt,today)<-1 || (t.note!=null && (!note || DASH.test(note)))){ say.push('WARNING, the old tag for player id '+id+' is not in the right shape and was left out.'); return; }
    if(!freshAge(t.tagAt)){ oldTags++; return; }
    use[id]={dir:t.dir,note:note,tagAt:t.tagAt,tagSrc:src};
  });
}

// one GET to ESPN, tried up to 4 times with a short wait. It never follows a redirect, so no other host is ever called
async function get(url){
  for(let k=0;k<4;k++){
    try{ const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(20000)}); if(r.ok) return await r.json(); }catch(e){}
    if(k<3) await sleep(700*(k+1));
  }
  return null;
}

(async()=>{
  // step 1, the feed
  let feed=null;
  if(opt.from){ try{ feed=readJson(opt.from); }catch(e){ stop('news NOT saved. The file given with --from could not be read as JSON. Nothing written.'); } }
  else feed=await get(FEED);
  if(!feed || typeof feed!=='object' || Array.isArray(feed)) stop('news NOT saved. '+(opt.from?'The file given with --from does not hold':'ESPN did not answer with')+' a valid injuries feed. Nothing written.');
  if(!Array.isArray(feed.injuries)) stop('news NOT saved. The feed has no injuries list. Nothing written.');
  if(!opt.from && !feed.injuries.length) stop('news NOT saved. ESPN sent zero teams. Nothing written.');

  // step 2, read every item. Only the listed facts are copied into the news entry. The comment text goes into the raw items and nowhere else
  const p={}, meta={}, unmatched=new Set(), rawItems=[], odd={}, grams=new Set(); let items=0, nameless=0;
  const words=s=>String(s||'').toLowerCase().match(/[a-z0-9']+/g)||[];
  const addGrams=s=>{ const w=words(s); for(let i=0;i+8<=w.length;i++) grams.add(w.slice(i,i+8).join(' ')); };
  feed.injuries.forEach(t=>{
    if(!t || typeof t!=='object' || !Array.isArray(t.injuries)) return;
    t.injuries.forEach(it=>{
      if(!it || typeof it!=='object') return; items++;
      const a=(it.athlete&&typeof it.athlete==='object')?it.athlete:{}, d=(it.details&&typeof it.details==='object')?it.details:{};
      const name=txt(a.displayName,60)||txt([a.firstName,a.lastName].filter(x=>typeof x==='string').join(' '),60);
      if(!name || !nkey(name)){ nameless++; return; }
      const ab=String((a.team&&a.team.abbreviation)||'').toUpperCase(), team=TID[String(t.id)]||MAP[ab]||(ab.length<=5?ab:'')||null;
      const s=typeof it.status==='string'?it.status.trim().toLowerCase():'';
      const st=s==='out'?'Out':s==='day-to-day'?'Day-To-Day':null;
      if(s && !st){ const w=txt(it.status,30)||'a long text'; odd[w]=(odd[w]||0)+1; }
      const f=d.fantasyStatus&&txt(d.fantasyStatus.abbreviation,8), fsv=f&&/^[A-Za-z0-9+]+$/.test(f)?f:null;
      const part=txt(d.type,40);
      const ret=typeof d.returnDate==='string'&&isDay(d.returnDate.slice(0,10))?d.returnDate.slice(0,10):null;
      // the date of the item as a US Eastern date, the same clock the site uses
      const time=typeof it.date==='string'?Date.parse(it.date):NaN;
      const at=isDay(it.date)?it.date:isNaN(time)?null:etDay(new Date(time));
      // match to a Yahoo id by name key, then by NBA team when the name is shared
      const k=nkey(name), ids=idx[k]||idx[ALIAS[k]]||[]; let id=null;
      if(ids.length===1) id=ids[0];
      else if(ids.length>1){ const h=ids.filter(i=>P[i][1]===team); if(h.length===1) id=h[0]; else say.push('WARNING, the name '+name+' matches '+ids.length+' players in data/players.json and the NBA team '+(team||'unknown')+' does not pick exactly one. It is listed as unmatched.'); }
      const sc=typeof it.shortComment==='string'?it.shortComment:null, lc=typeof it.longComment==='string'?it.longComment:null;
      addGrams(sc); addGrams(lc);
      rawItems.push({id:id,n:name,team:team,st:txt(it.status,30),part:part,ret:ret,at:at,short:sc,long:lc});
      if(id==null){ unmatched.add(name); return; }
      // two items for one player. Keep the one on the player's own team, then the newer one
      const m={teamOk:P[id][1]===team?1:0,time:isNaN(time)?0:time}, o=meta[id];
      if(o && (o.teamOk>m.teamOk || (o.teamOk===m.teamOk && o.time>=m.time))) return;
      meta[id]=m;
      p[id]={n:String(P[id][0]),st:st,fs:fsv,part:part,ret:ret,at:at,dir:null,note:null,tagAt:null,tagSrc:null};
    });
  });
  if(items && nameless===items) stop('news NOT saved. None of the '+items+' items in the feed carried a player name, so the shape of the feed may have changed. Nothing written.');
  Object.keys(odd).forEach(w=>say.push('WARNING, ESPN used the status "'+w+'" for '+odd[w]+' player'+(odd[w]>1?'s':'')+' and this script only knows Out and Day-To-Day. That status is saved as empty.'));
  if(nameless) say.push('WARNING, '+nameless+' item'+(nameless>1?'s':'')+' in the feed had no player name and '+(nameless>1?'were':'was')+' skipped.');

  // step 3, the tags. A note that repeats ESPN's own words is refused, since comment text must never reach the data folder
  if(!carried){
    const copied=Object.keys(use).filter(id=>{ const w=words(use[id].note); for(let i=0;i+8<=w.length;i++) if(grams.has(w.slice(i,i+8).join(' '))) return true; return false; });
    if(copied.length) stop('news NOT saved. The note for player id '+copied.join(' and ')+' repeats 8 or more words in a row from the ESPN comment text. Write it again in your own words. Nothing written.');
  }
  Object.keys(use).forEach(id=>{ if(!p[id]) p[id]={n:String(P[id][0]),st:null,fs:null,part:null,ret:null,at:null,dir:null,note:null,tagAt:null,tagSrc:null}; Object.assign(p[id],use[id]); });
  if(oldTags) say.push(oldTags+' tag'+(oldTags>1?'s are':' is')+' older than '+FRESH+' days and '+(oldTags>1?'were':'was')+' left out');

  // step 4, the writes. The raw file goes first. If it cannot be written the data folder is not touched
  const made=new Date().toISOString().slice(0,19)+'Z';
  const news={made:made,src:'ESPN injuries feed',p:p,unmatched:[...unmatched].sort()};
  if(RAW){ try{ fs.writeFileSync(RAW,JSON.stringify({made:made,items:rawItems},null,1)); }catch(e){ stop('news NOT saved. The raw file could not be written. Nothing written in the data folder.'); } }
  try{ if(!fs.existsSync(OUT)) fs.mkdirSync(OUT,{recursive:true}); fs.writeFileSync(path.join(OUT,'news.json'),JSON.stringify(news)); }
  catch(e){ stop('news NOT saved. The file news.json could not be written in the output folder.'); }
  say.forEach(m=>console.log(m));
  const v=Object.keys(p).map(i=>p[i]);
  console.log('news saved, '+v.filter(x=>x.st).length+' players with a status, '+v.filter(x=>x.ret).length+' with a return date, '+v.filter(x=>x.dir).length+' tags, '+news.unmatched.length+' unmatched');
})();
