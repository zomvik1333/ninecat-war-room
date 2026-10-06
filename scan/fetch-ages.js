#!/usr/bin/env node
/* Nine Cat War Room, player ages. Run on a computer with open internet access.
   Use. node scan/fetch-ages.js [--out <dir>] [--from <dir>]
   It rewrites data/ages.json from the ESPN team rosters, one request for the team list and then one per team.
   --out is the folder to write to. Left off, it is the data folder of the project.
   --from is test mode. It reads roster files named roster_<team id>.json from that folder and makes no network call.
   Every check runs first. The file is written only at the very end, after all of them have passed.
   If a check fails one line is printed, the exit code is 1 and the old file is left as it was. */
const fs=require('fs'), path=require('path');
const API='https://site.api.espn.com/apis/site/v2/sports/basketball/nba/';
const MAP={GS:'GSW',NO:'NOP',NY:'NYK',SA:'SAS',UTAH:'UTA',WSH:'WAS'};
const MIN_TEAMS=28, MIN_PLAYERS=380;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const stop=m=>{ console.log(m); process.exit(1); };
// the same name key the site uses, copied from nkey in index.html. Keep the two the same
const nkey = str => String(str||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[.'’`]/g,'').replace(/-/g,' ').replace(/\b(jr|sr|ii|iii|iv)\b/g,' ').replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim();
// known spelling differences, the same pairs as PALIAS and BALIAS in moves.js. Used only for the match count printed at the end
const PAIRS=[['nic claxton','nicolas claxton'],['alex sarr','alexandre sarr'],['bub carrington','carlton carrington'],['herb jones','herbert jones'],['cam johnson','cameron johnson'],['bones hyland','nahshon hyland'],['gg jackson','gregory jackson'],['moe wagner','moritz wagner'],['gui santos','guilherme santos']];
const ALIAS={}; PAIRS.forEach(p=>{ ALIAS[p[0]]=p[1]; ALIAS[p[1]]=p[0]; });
const isDay=s=>typeof s==='string' && /^\d{4}-\d\d-\d\d$/.test(s) && !isNaN(Date.parse(s+'T00:00:00Z')) && new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const etDay=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);

const args=process.argv.slice(2), opt={};
for(let i=0;i<args.length;i++){ const a=args[i];
  if(a!=='--out' && a!=='--from') stop('ages NOT saved. The option '+a+' is not one this script knows. Use --out or --from.');
  if(i+1>=args.length || args[i+1].indexOf('--')===0) stop('ages NOT saved. The option '+a+' needs a folder after it.');
  opt[a.slice(2)]=args[++i]; }
const OUT=opt.out?path.resolve(opt.out):path.join(__dirname,'..','data');
const today=etDay(new Date());

// one GET to ESPN, tried up to 4 times with a short wait. It never follows a redirect, so no other host is ever called
async function get(url){
  for(let k=0;k<4;k++){
    try{ const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(20000)}); if(r.ok) return await r.json(); }catch(e){}
    if(k<3) await sleep(700*(k+1));
  }
  return null;
}

(async()=>{
  // step 1, the rosters. rosters maps a team id to the parsed roster, or to null when that team did not answer
  const rosters={}; let ids=[];
  if(opt.from){
    let names; try{ names=fs.readdirSync(opt.from); }catch(e){ stop('ages NOT saved. The folder given with --from could not be read.'); }
    names.forEach(f=>{ const m=/^roster_(\d+)\.json$/.exec(f); if(!m) return; ids.push(m[1]); try{ rosters[m[1]]=JSON.parse(fs.readFileSync(path.join(opt.from,f),'utf8')); }catch(e){ rosters[m[1]]=null; } });
  } else {
    const tj=await get(API+'teams?limit=40');
    const tl=tj && tj.sports && tj.sports[0] && tj.sports[0].leagues && tj.sports[0].leagues[0] && tj.sports[0].leagues[0].teams;
    if(!Array.isArray(tl)) stop('ages NOT saved. ESPN did not send the list of teams.');
    ids=[...new Set(tl.map(x=>x&&x.team).filter(t=>t && !t.isAllStar && /^\d+$/.test(String(t.id))).map(t=>String(t.id)))];
    if(ids.length<MIN_TEAMS) stop('ages NOT saved. The ESPN team list held '+ids.length+' teams and at least '+MIN_TEAMS+' are needed.');
    const one=async id=>{ rosters[id]=await get(API+'teams/'+id+'/roster'); };
    for(let i=0;i<ids.length;i+=5){ await Promise.all(ids.slice(i,i+5).map(one)); await sleep(250); }
  }
  ids.sort((a,b)=>a-b);

  // step 2, read every player. Nothing is written yet
  const p={}, who={}, seen=new Set(), warn=[]; let teams=0, noAge=0;
  ids.forEach(id=>{
    const j=rosters[id]; let list=j&&j.athletes; if(!Array.isArray(list)) return;
    // some ESPN rosters come grouped by position with the players under items. Flatten that shape too
    list=[].concat(...list.map(a=>a&&Array.isArray(a.items)?a.items:[a])).filter(a=>a&&typeof a==='object');
    if(!list.length) return;
    teams++;
    const ab=String((j.team&&j.team.abbreviation)||'').toUpperCase(), team=MAP[ab]||ab||('team '+id);
    list.forEach(a=>{
      const name=String(a.fullName||a.displayName||'').trim(), k=nkey(name); if(!k) return;
      if(a.id!=null){ if(seen.has(String(a.id))) return; seen.add(String(a.id)); }
      const born=typeof a.dateOfBirth==='string' && isDay(a.dateOfBirth.slice(0,10)) ? a.dateOfBirth.slice(0,10) : null;
      // the age is worked out from the birth date as of today in US Eastern time, so the two always agree. ESPN's own age is used only when there is no birth date
      let age=born ? (+today.slice(0,4))-(+born.slice(0,4))-(today.slice(5)<born.slice(5)?1:0) : (typeof a.age==='number' && isFinite(a.age)) ? Math.floor(a.age) : null;
      if(age==null || age<15 || age>60){ noAge++; return; }
      const y=a.experience&&a.experience.years, yrs=(typeof y==='number' && isFinite(y) && y>0) ? Math.floor(y) : 0;
      const old=p[k];
      if(old){
        const keepNew=yrs>old[2];
        const yy=n=>n+(n===1?' year':' years'), neu=name+' of '+team+' with '+yy(yrs), was=who[k]+' with '+yy(old[2]), kept=keepNew?neu:was, lost=keepNew?was:neu;
        warn.push('WARNING, two players share the name key "'+k+'". Kept '+kept+' and left out '+lost+'.');
        if(!keepNew) return;
      }
      p[k]=[age,born,yrs]; who[k]=name+' of '+team;
    });
  });

  // step 3, the checks
  const n=Object.keys(p).length;
  if(teams<MIN_TEAMS) stop('ages NOT saved. '+(opt.from?'Only '+teams+' roster files could be read':'Only '+teams+' of '+ids.length+' teams answered')+' and at least '+MIN_TEAMS+' are needed. The old file is left as it was.');
  if(n<MIN_PLAYERS) stop('ages NOT saved. Only '+n+' players came with an age and at least '+MIN_PLAYERS+' are needed. The old file is left as it was.');

  // step 4, the write. Keys are sorted so two runs on the same day give the same file
  const sorted={}; Object.keys(p).sort().forEach(k=>{ sorted[k]=p[k]; });
  try{ if(!fs.existsSync(OUT)) fs.mkdirSync(OUT,{recursive:true}); fs.writeFileSync(path.join(OUT,'ages.json'),JSON.stringify({made:today,src:'ESPN team rosters',p:sorted})); }
  catch(e){ stop('ages NOT saved. The file ages.json could not be written in the output folder.'); }
  warn.forEach(m=>console.log(m));
  console.log('ages saved, '+n+' players from '+teams+' teams'+(noAge?', '+noAge+' players left out because ESPN gave no age for them':''));

  // information only. How many players the site knows that got no age
  let pl=null; try{ pl=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','players.json'),'utf8')).p; }catch(e){}
  if(!pl || typeof pl!=='object'){ console.log('data/players.json could not be read, so the count of players with no age is skipped'); return; }
  const all=Object.keys(pl).filter(i=>Array.isArray(pl[i])), miss=[]; let byAlias=0;
  all.forEach(i=>{ const k=nkey(pl[i][0]); if(p[k]) return; if(ALIAS[k]&&p[ALIAS[k]]){ byAlias++; return; } miss.push(pl[i][0]); });
  console.log((all.length-miss.length)+' of the '+all.length+' players in data/players.json have an age, '+miss.length+' have no age match'+(miss.length?', '+(miss.length>15?'the first 15 are ':'they are ')+miss.slice(0,15).join(', '):''));
  if(byAlias) console.log(byAlias+' of those matches needed a known other spelling of the name, the same list as PALIAS and BALIAS in moves.js');
})();
