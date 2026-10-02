#!/usr/bin/env node
/* Nine Cat War Room, scan ingest.
   Turns the text printed by scan/yahoo-scan.js into the data files the Pickups and Trades tab reads.
   Use: node scan/ingest.js raw1.txt [raw2.txt ...]
        node scan/ingest.js --partial players_only.txt     (skips the end of scan check, for player name lines only)
   Every line carries a checksum. If any line is wrong nothing is written and the bad lines are listed. */
const fs=require('fs'), path=require('path');
const DIR=path.join(__dirname,'..','data');
const ck=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return ('000'+((h>>>0)%1679616).toString(36)).slice(-4)};
const args=process.argv.slice(2); const partial=args.includes('--partial'); const files=args.filter(a=>a.indexOf('--')!==0);
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
const wr=(f,o)=>fs.writeFileSync(path.join(DIR,f),JSON.stringify(o));
if(!fs.existsSync(DIR)) fs.mkdirSync(DIR,{recursive:true});
const F=body.map(l=>{ const p=l.split('|'); p.pop(); return p; });
const of=t=>F.filter(f=>f[0]===t);
const n=x=>x===''||x==null?null:+x, t10=x=>x===''||x==null?null:+x/10;

// player names
const players=rd('players.json',{p:{}}); let newP=0;
of('P').forEach(f=>{ if(!players.p[f[1]]) newP++; players.p[f[1]]=[f[2],f[3],f[4],n(f[5])]; });
if(of('P').length){ players.updated=new Date().toISOString().slice(0,16); wr('players.json',players); }

// league schedule, one time
const K=of('K');
if(K.length){
  const TEAMS={1:{name:"Vinny's Team",slot:2},2:{name:"Shu's Heard of Goats",slot:7},3:{name:'Extraterrestrial',slot:10},4:{name:"Haziq's Dandy Team",slot:3},5:{name:'Registered Nurse',slot:4},6:{name:'Lickmylulu',slot:8},7:{name:'The Jokic On You',slot:1},8:{name:'Rohan and Vikas CoManaged Team',slot:9},11:{name:'Vik in a Box',slot:6},12:{name:"LeGM's Team",slot:5}};
  const iso=md=>{ const m=md.split('/'); if(m.length<2) return ''; const mo=+m[0], d=+m[1]; return (mo>=9?2026:2027)+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0'); };
  const league={league:'Ball Lovers',id:82878,me:'11',comanaged:'8',teams:TEAMS,adds:4,tradeDeadline:'2027-03-04',lastRegularWeek:18,playoffTeams:8,
    weeks:K.map(f=>({n:+f[1],start:iso(f[2]),end:iso(f[3]),games:(f[5]||'').split(',').filter(Boolean).map(x=>x.split('v'))}))};
  wr('league.json',league); console.log('league schedule saved, '+league.weeks.length+' weeks');
}

// daily scan
const H=partial?null:of('H')[0];
if(H){
  const scan={v:1,at:H[2]+'Z',week:n(H[3]),mode:H[4],me:'11',teams:[],rosters:{},avail:{},q:{},stats:{},matchup:null,tx:[]};
  of('T').forEach(f=>scan.teams.push({id:f[1],name:f[2],rank:n(f[3]),w:n(f[4])||0,l:n(f[5])||0,t:n(f[6])||0,waiver:n(f[7]),moves:n(f[8])||0}));
  of('R').forEach(f=>{ scan.rosters[f[1]]=(f[3]||'').split(',').filter(Boolean).map(x=>x.split(':')); if(scan.rosters[f[1]].length!==+f[2]) console.log('warning, roster count mismatch for team '+f[1]); });
  of('A').forEach(f=>(f[1]||'').split(',').filter(Boolean).forEach(x=>{ const a=x.split(':'); scan.avail[a[0]]=[a[1]||'F',a[2]||'']; }));
  of('Q').forEach(f=>(f[1]||'').split(',').filter(Boolean).forEach(x=>{ const a=x.split(':'); scan.q[a[0]]=[n(a[1]),n(a[2])]; }));
  of('S').forEach(f=>{ scan.stats[f[1]]=[f[2],n(f[3])||0].concat(f.slice(4,16).map(t10),[n(f[16]),t10(f[17]),t10(f[18])]); scan.q[f[1]]=[n(f[19]),n(f[20])]; });
  const M=of('M'); if(M.length){ scan.matchup={week:n(M[0][1]),rows:M.map(f=>({tid:f[2],fgm:n(f[3]),fga:n(f[4]),ftm:n(f[5]),fta:n(f[6]),tpm:n(f[7]),pts:n(f[8]),reb:n(f[9]),ast:n(f[10]),stl:n(f[11]),blk:n(f[12]),to:n(f[13])})),rem:(of('G')[0]||[]).slice(1).map(n)}; }
  of('X').forEach(f=>scan.tx.push([f[1],f[2],f[3]]));
  if(scan.teams.length!==10) console.log('warning, expected 10 teams, saw '+scan.teams.length);
  const ids=new Set(); Object.values(scan.rosters).forEach(r=>r.forEach(x=>ids.add(x[0]))); Object.keys(scan.avail).forEach(i=>ids.add(i));
  const missing=[...ids].filter(i=>!players.p[i]);
  if(missing.length) console.log('warning, no name on file for player ids '+missing.join(' ')+'. Run the scan again with NCWSCAN.run({all:true}) to get them.');
  const sig=s=>Object.keys(s.rosters).sort().map(t=>t+':'+s.rosters[t].map(x=>x[0]).sort().join('.')).join('|');
  const prev=rd('scan.json',null); if(prev && prev.at!==scan.at) wr('scan_prev.json',prev);
  wr('scan.json',scan);
  const wk=rd('scan_week.json',null); let wmsg='trade list keeps this week\'s snapshot';
  if(!wk || wk.week!==scan.week || sig(wk)!==sig(scan)){ wr('scan_week.json',scan); wmsg=!wk?'first weekly snapshot saved':wk.week!==scan.week?'new fantasy week, trade snapshot refreshed':'a roster changed in the league, trade snapshot refreshed'; }
  const rostered=Object.values(scan.rosters).reduce((a,r)=>a+r.length,0);
  console.log('scan saved, '+scan.at+', week '+scan.week+', '+scan.mode+' mode, '+scan.teams.length+' teams, '+rostered+' rostered, '+Object.keys(scan.avail).length+' available, '+Object.keys(scan.stats).length+' stat lines, '+scan.tx.length+' transactions, '+newP+' new players. '+wmsg+'.');
} else if(!K.length){ console.log('player names saved, '+of('P').length+' lines, '+newP+' new, no scan written'); }
