#!/usr/bin/env node
/* Nine Cat War Room, scan ingest.
   Turns the text printed by scan/yahoo-scan.js into the data files the Pickups and Trades tab reads.
   Use: node scan/ingest.js raw1.txt [raw2.txt ...]
        node scan/ingest.js --partial players_only.txt     (skips the end of scan check, for player name lines only)
        node scan/ingest.js --force raw1.txt               (recovery only, loads a scan that is older than the one on file)
   Every line carries a checksum. If any line is wrong nothing is written and the bad lines are listed.
   Every check runs first. The data files are written only at the very end, after all of them have passed. */
const fs=require('fs'), path=require('path');
const DIR=path.join(__dirname,'..','data');
const ck=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return ('000'+((h>>>0)%1679616).toString(36)).slice(-4)};
const args=process.argv.slice(2); const partial=args.includes('--partial'), force=args.includes('--force'); const files=args.filter(a=>a.indexOf('--')!==0);
if(!files.length){ console.log('give one or more raw scan text files'); process.exit(2); }
const raw=files.map(f=>fs.readFileSync(f,'utf8')).join('\n');
const lines=raw.split('~').map(s=>s.replace(/\s+/g,' ').trim()).filter(s=>/^[A-Z]\d?\|/.test(s));
const bad=[]; let end=null; const body=[];
lines.forEach((l,i)=>{ const k=l.lastIndexOf('|'); if(l[0]==='E'&&l[1]==='|'){ end=l; return; } if(ck(l.slice(0,k))!==l.slice(k+1)) bad.push((i+1)+'  '+l.slice(0,70)); body.push(l); });
if(bad.length){ console.log('CHECK FAILED on '+bad.length+' line(s), nothing written. Read these lines again from the scan page and fix them.'); bad.forEach(b=>console.log('  line '+b)); process.exit(1); }
if(!partial){
  if(!end){ console.log('CHECK FAILED, the end line (E) is missing, so part of the scan was not copied. Nothing written.'); process.exit(1); }
  const e=end.split('|');
  if(+e[1]!==body.length){ console.log('CHECK FAILED, the scan had '+e[1]+' lines but '+body.length+' were copied. Nothing written.'); process.exit(1); }
  if(ck(body.join(''))!==e[2]){ console.log('CHECK FAILED, lines are out of order or duplicated. Nothing written.'); process.exit(1); }
}
const rd=(f,d)=>{ try{ return JSON.parse(fs.readFileSync(path.join(DIR,f),'utf8')); }catch(e){ return d; } };
// nothing is written and nothing is reported as saved until every check has passed. wr and say only queue, done() at the end does the work
const out=[], say=[]; const wr=(f,o)=>out.push([f,JSON.stringify(o)]);
const stop=m=>{ console.log(m); process.exit(1); };
const done=()=>{ if(out.length && !fs.existsSync(DIR)) fs.mkdirSync(DIR,{recursive:true}); out.forEach(o=>fs.writeFileSync(path.join(DIR,o[0]),o[1])); say.forEach(m=>console.log(m)); };
const F=body.map(l=>{ const p=l.split('|'); p.pop(); return p; });
const of=t=>F.filter(f=>f[0]===t);
const n=x=>x===''||x==null?null:+x, t10=x=>x===''||x==null?null:+x/10;
const asc=s=>String(s||'').replace(/[\u2018\u2019\u02bc]/g,"'");

// player names
const players=rd('players.json',{p:{}}); let newP=0;
of('P').forEach(f=>{ const old=players.p[f[1]]; if(!old) newP++; players.p[f[1]]=[asc(f[2])||(old&&old[0])||('Player '+f[1]),f[3]||(old&&old[1])||'',f[4]||(old&&old[2])||'',f[5]!==''?n(f[5]):(old?old[3]:null)]; });
const sched=rd('schedule.json',null);
if(sched&&sched.games) of('P').forEach(f=>{ if(f[3]&&!sched.games[f[3]]) say.push('WARNING, player '+f[1]+' '+asc(f[2])+' has the NBA team code '+f[3]+' and that is not a team in data/schedule.json. Fine for an NBA free agent, otherwise read that line again.'); });
if(of('P').length) players.updated=new Date().toISOString().slice(0,16);
const saveP=()=>{ if(of('P').length) wr('players.json',players); };

// league schedule, one time
const K=partial?[]:of('K');
if(K.length && (K.length!==21 || K.some(f=>!f[2]||!f[3]))) stop('CHECK FAILED, the league schedule needs 21 weeks with dates and this copy has '+K.length+'. Nothing written. Run the schedule scan again.');
let league=null;
if(K.length){
  const TEAMS={1:{name:"Vinny's Team",slot:2},2:{name:"Shu's Heard of Goats",slot:7},3:{name:'Extraterrestrial',slot:10},4:{name:"Haziq's Dandy Team",slot:3},5:{name:'Registered Nurse',slot:4},6:{name:'Lickmylulu',slot:8},7:{name:'The Jokic On You',slot:1},8:{name:'Rohan and Vikas CoManaged Team',slot:9},11:{name:'Vik in a Box',slot:6},12:{name:"LeGM's Team",slot:5}};
  const iso=md=>{ const m=md.split('/'); if(m.length<2) return ''; const mo=+m[0], d=+m[1]; return (mo>=9?2026:2027)+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0'); };
  league={league:'Ball Lovers',id:82878,me:'11',teams:TEAMS,adds:4,tradeDeadline:'2027-03-04',lastRegularWeek:18,playoffTeams:8,
    weeks:K.map(f=>({n:+f[1],start:iso(f[2]),end:iso(f[3]),games:(f[5]||'').split(',').filter(Boolean).map(x=>x.split('v'))}))};
}
const saveK=()=>{ if(league){ wr('league.json',league); say.push('league schedule saved, '+league.weeks.length+' weeks'); } };

// daily scan
const H=partial?null:of('H')[0];
if(H){
  const scan={v:1,at:H[2]+'Z',week:n(H[3]),mode:H[4],me:'11',teams:[],rosters:{},avail:{},q:{},stats:{},matchup:null,tx:[]};
  of('T').forEach(f=>scan.teams.push({id:f[1],name:asc(f[2]),rank:n(f[3]),w:n(f[4])||0,l:n(f[5])||0,t:n(f[6])||0,waiver:n(f[7]),moves:n(f[8])||0}));
  of('R').forEach(f=>{ scan.rosters[f[1]]=(f[3]||'').split(',').filter(Boolean).map(x=>x.split(':')); if(scan.rosters[f[1]].length!==+f[2]) say.push('WARNING, roster count mismatch for team '+f[1]+', the line says '+f[2]+' players and lists '+scan.rosters[f[1]].length+'.'); });
  of('A').forEach(f=>(f[1]||'').split(',').filter(Boolean).forEach(x=>{ const a=x.split(':'); scan.avail[a[0]]=[a[1]||'F',a[2]||'']; }));
  of('Q').forEach(f=>(f[1]||'').split(',').filter(Boolean).forEach(x=>{ const a=x.split(':'); scan.q[a[0]]=[n(a[1]),n(a[2])]; }));
  of('S').forEach(f=>{ scan.stats[f[1]]=[f[2],n(f[3])||0].concat(f.slice(4,16).map(t10),[n(f[16]),t10(f[17]),t10(f[18])]); scan.q[f[1]]=[n(f[19]),n(f[20])]; });
  // checks on the shape of the scan. A scan can carry valid checksums and still be wrong, so all of these run before anything is written
  const wrong=[], tid=scan.teams.map(t=>t.id), rid=of('R').map(f=>f[1]), dup=a=>a.filter((x,i)=>a.indexOf(x)!==i);
  const who=i=>(players.p[i]?players.p[i][0]+' ':'')+'(id '+i+')', nm=s=>asc(s).toLowerCase().replace(/\s+/g,' ').trim();
  // live score rows. The scanner writes the team NAME in place of the id when the name on the matchup page did not match the standings. Map it back or refuse
  const M=of('M');
  M.forEach(f=>{ if(tid.indexOf(f[2])>=0) return; const a=nm(f[2]); let hit=scan.teams.filter(t=>nm(t.name)===a); if(!hit.length) hit=scan.teams.filter(t=>nm(t.name)&&(' '+a+' ').indexOf(' '+nm(t.name)+' ')>=0);
    if(a&&hit.length===1){ say.push('WARNING, a live score row came with the team name "'+f[2]+'" in place of a team id. It was matched by name to team '+hit[0].id+' '+hit[0].name+'.'); f[2]=hit[0].id; } else wrong.push('the live score row for "'+f[2]+'" does not match exactly one team'); });
  if(dup(M.map(f=>f[2])).length) wrong.push('two live score rows are for the same team');
  if(M.length){ scan.matchup={week:n(M[0][1]),rows:M.map(f=>({tid:f[2],fgm:n(f[3]),fga:n(f[4]),ftm:n(f[5]),fta:n(f[6]),tpm:n(f[7]),pts:n(f[8]),reb:n(f[9]),ast:n(f[10]),stl:n(f[11]),blk:n(f[12]),to:n(f[13])})),rem:(of('G')[0]||[]).slice(1).map(n)}; }
  of('X').forEach(f=>scan.tx.push([f[1],f[2],f[3]]));
  const probs=[]; if(scan.teams.length!==10) probs.push('expected 10 teams and saw '+scan.teams.length); if(Object.keys(scan.rosters).length!==10) probs.push('expected 10 rosters and saw '+Object.keys(scan.rosters).length); if(!scan.rosters['11']||scan.rosters['11'].length<10) probs.push('my roster is missing or short'); if(Object.values(scan.rosters).some(r=>r.length<10)) probs.push('a roster has fewer than 10 players'); if(!Object.keys(scan.avail).length) probs.push('no available players were read');
  if(scan.mode==='season' && scan.week && scan.week<=18 && (!scan.matchup || scan.matchup.rows.length!==2)) probs.push('the live matchup score was not read');
  if(probs.length) stop('CHECK FAILED, the scan is incomplete, '+probs.join(', ')+'. Nothing written. Run the scan again.');
  const at=Date.parse(H[2]+':00Z'), atOk=/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(H[2]) && !isNaN(at) && new Date(at).toISOString().slice(0,16)===H[2];
  if(!atOk) wrong.push('the scan time "'+H[2]+'" is not a valid time'); else if(at>Date.now()+36*3600e3) wrong.push('the scan time '+H[2]+' is more than 36 hours ahead of the clock on this computer');
  if(scan.mode==='season' && !scan.week) wrong.push('a season mode scan has no week number');
  dup(tid).forEach(t=>wrong.push('team '+t+' has two team lines')); dup(rid).forEach(t=>wrong.push('team '+t+' has two roster lines'));
  rid.filter(t=>tid.indexOf(t)<0).forEach(t=>wrong.push('the roster line for team '+t+' has no team line')); tid.filter(t=>rid.indexOf(t)<0).forEach(t=>wrong.push('team '+t+' has no roster line'));
  const lg=league||rd('league.json',null); if(lg&&lg.teams) tid.filter(t=>Object.keys(lg.teams).indexOf(t)<0).forEach(t=>wrong.push('team id '+t+' is not a team in data/league.json'));
  const on=Object.create(null); Object.keys(scan.rosters).forEach(t=>scan.rosters[t].forEach(x=>{ if(on[x[0]]===t) wrong.push('player '+who(x[0])+' is listed twice on the roster of team '+t); else if(on[x[0]]) wrong.push('player '+who(x[0])+' is on two rosters, teams '+on[x[0]]+' and '+t); else on[x[0]]=t; }));
  Object.keys(scan.avail).filter(i=>on[i]).forEach(i=>wrong.push('player '+who(i)+' is on the roster of team '+on[i]+' and also in the available list'));
  // the H line counts. The scanner counts its team lines, and every player it met: all rostered, all available, plus players seen only in transactions
  if(+H[5]!==tid.length) wrong.push('the head line says '+H[5]+' teams and there are '+tid.length+' team lines');
  const met=new Set(Object.keys(on).concat(Object.keys(scan.avail))), txOnly=new Set(); scan.tx.forEach(x=>(x[2]||'').split(',').filter(Boolean).forEach(m=>{ const i=m.slice(1); if(!met.has(i)) txOnly.add(i); }));
  if(!(+H[6]>=met.size && +H[6]<=met.size+txOnly.size)) wrong.push('the head line says '+H[6]+' players and the lines hold '+met.size+(txOnly.size?' (plus '+txOnly.size+' seen only in transactions)':'')+', so a roster or available line is missing or extra');
  if(wrong.length) stop('CHECK FAILED, the scan does not add up, '+wrong.join(', ')+'. Run the scan again. Nothing written.');
  const prev=rd('scan.json',null), pat=prev?Date.parse(prev.at):NaN;
  if(!force && at<pat) stop('CHECK FAILED, this scan was taken '+scan.at+' and the scan on file is newer, '+prev.at+'. To load the older scan anyway run it again with --force. Nothing written.');
  // things that can really happen. The scan still saves and each one gets a loud line
  const SLOT=['PG','SG','G','SF','PF','F','C','Util','BN','IL','IL+'];
  Object.keys(scan.rosters).forEach(t=>{ const r=scan.rosters[t]; if(r.length<13) say.push('WARNING, team '+t+' has only '+r.length+' players on its roster. Check that the roster was read in full.');
    r.forEach(x=>{ if(SLOT.indexOf(x[1])<0) say.push('WARNING, team '+t+' player '+who(x[0])+' has the roster slot "'+(x[1]||'')+'" and that is not a slot this league uses.'); if((x[2]||'').length>5) say.push('WARNING, team '+t+' player '+who(x[0])+' has an injury tag that is too long, "'+x[2]+'".'); }); });
  Object.keys(scan.avail).forEach(i=>{ if(scan.avail[i][1].length>5) say.push('WARNING, available player '+who(i)+' has an injury tag that is too long, "'+scan.avail[i][1]+'".'); });
  of('T').forEach(f=>{ const e=[]; if(f[3]===''||f[3]==null) e.push('rank'); if(f[7]===''||f[7]==null) e.push('waiver spot'); if(e.length) say.push('WARNING, team '+f[1]+' came with an empty '+e.join(' and ')+'.'); });
  const ids=new Set(); Object.values(scan.rosters).forEach(r=>r.forEach(x=>ids.add(x[0]))); Object.keys(scan.avail).forEach(i=>ids.add(i));
  const missing=[...ids].filter(i=>!players.p[i]);
  if(missing.length) say.push('WARNING, no name on file for player ids '+missing.join(' ')+'. Run the scan again with NCWSCAN.run({all:true}) to get them.');
  const sig=s=>Object.keys(s.rosters).sort().map(t=>t+':'+s.rosters[t].map(x=>x[0]).sort().join('.')).join('|');
  saveP(); saveK();
  if(prev && prev.at!==scan.at) wr('scan_prev.json',prev);
  wr('scan.json',scan);
  const wk=rd('scan_week.json',null); let wmsg='trade list keeps this week\'s snapshot';
  if(!wk || wk.week!==scan.week || sig(wk)!==sig(scan)){ wr('scan_week.json',scan); wmsg=!wk?'first weekly snapshot saved':wk.week!==scan.week?'new fantasy week, trade snapshot refreshed':'a roster changed in the league, trade snapshot refreshed'; }
  const rostered=Object.values(scan.rosters).reduce((a,r)=>a+r.length,0);
  say.push('scan saved, '+scan.at+', week '+scan.week+', '+scan.mode+' mode, '+scan.teams.length+' teams, '+rostered+' rostered, '+Object.keys(scan.avail).length+' available, '+Object.keys(scan.stats).length+' stat lines, '+scan.tx.length+' transactions, '+newP+' new players. '+wmsg+'.');
} else { saveP(); saveK(); if(!K.length) say.push('player names saved, '+of('P').length+' lines, '+newP+' new, no scan written'); }
done();
