/* Nine Cat War Room, Pickups and Trades tab.
   Reads the daily Yahoo scan in data/scan.json, the weekly snapshot in data/scan_week.json, the NBA schedule, last season's numbers and the board's own player model.
   Everything here is read only. It never talks to Yahoo. All numbers are model estimates. */
(function(){
'use strict';
// this same file also runs inside background workers that score trades. There is no page there, so the board is replaced by a small stand in
const INW=typeof window==='undefined';
const NK={};
const B=INW?(self.NCW={nkey:n=>NK[n]||String(n||'').toLowerCase(),esc:x=>String(x),PLAYERS:[],STATS:{},JOSH:{},LEAGUE_DRAFT:[],LEAGUE_TEAMS:{}}):window.NCW; if(!B) return;
const SELF_SRC=(!INW && document.currentScript && document.currentScript.src)||'';
const $=id=>document.getElementById(id);
const esc=B.esc;
const CATS=['FG%','FT%','3PM','PTS','REB','AST','STL','BLK','TO'];
const CATWORD=['field goal percentage','free throw percentage','threes','points','rebounds','assists','steals','blocks','turnovers'];
const CK=['tpm','pts','reb','ast','stl','blk','to'];
const TK=['fgm','fga','ftm','fta','tpm','pts','reb','ast','stl','blk','to'];
const SLOTS=['PG','SG','G','SF','PF','F','C','C','Util','Util'];
const KAP={tpm:1.3,pts:2.6,reb:1.3,ast:1.3,stl:1.1,blk:1.2,to:1.1};
const LEGEND=new Set(['lebron james','stephen curry','kevin durant','giannis antetokounmpo','nikola jokic','joel embiid','kawhi leonard','james harden','damian lillard','kyrie irving','anthony davis','luka doncic','jimmy butler','paul george','victor wembanyama','shai gilgeous alexander','jayson tatum','anthony edwards']);
// players who are never traded or dropped, and players held from trades until a date. These are the defaults. data/plan.json can replace them without a code change
const NEVER=new Set(['kyrie irving']);
const HOLD={'cameron boozer':'2027-01-15'};
const TRADELAG=2;
const REPL_LINE={mp:22,fgm:3.2,fga:7.2,ftm:1.2,fta:1.6,tpm:1.0,pts:8.6,reb:3.6,ast:2.0,stl:0.7,blk:0.4,to:1.1};
const PALIAS={'nic claxton':'nicolas claxton','alex sarr':'alexandre sarr','bub carrington':'carlton carrington','herb jones':'herbert jones','cam johnson':'cameron johnson','bones hyland':'nahshon hyland','gg jackson':'gregory jackson','moe wagner':'moritz wagner'};
/* how much each cat counts when a move is judged. Order is FG%, FT%, 3PM, PTS, REB, AST, STL, BLK, TO.
   Trades lean on the seven solid cats. The waiver wire is closer to normal. This week's matchup, the league table and every win chance on screen use normal scoring. */
const WT=[0.5,0.65,1,1,1,1,1,1,1];
const WP=[0.8,0.9,1,1,1,1,1,1,1];
const KEY='ncw_moves_v1';
const ME='11';
const D={};
let ST={marks:[],small:false,at:'',plan:null,planMade:'',pin:'',lead:'',showSkip:false,showMine:false,tteam:'',trTab:'best',pkTab:'week'};
// a saved state that is damaged is cleaned on load, so one bad entry can never break the tab
const okMark=m=>!!m && typeof m==='object' && ((m.type==='add' && typeof m.add==='string' && m.add!=='') || (m.type==='trade' && m.withTeam!=null && Array.isArray(m.give) && Array.isArray(m.get)));
try{ const j=JSON.parse(localStorage.getItem(KEY)||'null'); if(j && typeof j==='object'){ ST.marks=Array.isArray(j.marks)?j.marks.filter(okMark):[]; ST.small=j.small===true; ST.at=typeof j.at==='string'?j.at:''; ST.plan=Array.isArray(j.plan)?j.plan:null; ST.planMade=typeof j.planMade==='string'?j.planMade:''; ST.pin=typeof j.pin==='string'?j.pin:''; ST.lead=typeof j.lead==='string'?j.lead:''; ST.showSkip=j.showSkip===true; ST.showMine=j.showMine===true; ST.trTab=j.trTab==='mgr'?'mgr':'best'; ST.pkTab=j.pkTab==='wav'?'wav':j.pkTab==='chips'?'chips':'week'; if(typeof location!=='undefined' && location.hash==='#mgr') ST.trTab='mgr'; ST.tteam=typeof j.tteam==='string' && /^\d{1,2}$/.test(j.tteam)?j.tteam:''; } }catch(e){}
const save=()=>{ try{ localStorage.setItem(KEY,JSON.stringify(ST)); }catch(e){} };
/* private manager notes. Vikas keeps notes on the other managers in his own notes folder and can load them on his own device.
   They are kept in this browser's storage only and never travel with the site, which is public. The code here holds no names and no notes.
   They change only how a trade is pitched, how hard the sell is rated and which deals look most likely, on this device. Without them the page is the same for everyone */
const MGKEY='ncw_mgr_v1'; let MG=null;
const MGSTYLE=['cats','ai','simple','numbers','explain'], MGREPLY=['normal','days','slow'];
function okMgr(j){
  if(!j || typeof j!=='object' || Array.isArray(j) || !j.teams || typeof j.teams!=='object') return null;
  const arr=(x,m)=>Array.isArray(x)?x.filter(v=>typeof v==='string' && v.trim()).slice(0,m).map(v=>v.trim().slice(0,200)):[];
  const keys=x=>arr(x,30).map(v=>B.nkey(v)), o={made:typeof j.made==='string'?j.made.slice(0,10):'',teams:{}};
  Object.keys(j.teams).forEach(id=>{ const t=j.teams[id]; if(!/^\d{1,2}$/.test(id) || id===ME || !t || typeof t!=='object' || Array.isArray(t)) return;
    o.teams[id]={name:(typeof t.name==='string' && t.name.trim()?t.name.trim().slice(0,30):'This manager'),ease:isFinite(+t.ease)?clamp(+t.ease,-2,2):0,
      reply:MGREPLY.indexOf(t.reply)>=0?t.reply:'normal',style:MGSTYLE.indexOf(t.style)>=0?t.style:'',edge:t.edge===true,callout:t.callout===true,noTwo:t.noTwo===true,byDraft:t.valueBy==='draft',pairs:t.pairs===true,noLate:t.noLate===true,
      needPos:arr(t.needPos,5).filter(p=>/^(PG|SG|SF|PF|C)$/.test(p)),needCats:arr(t.needCats,9).map(c=>CATS.indexOf(c)).filter(c=>c>=0),
      keep:keys(t.keep),prize:keys(t.prize),like:keys(t.like),dislike:keys(t.dislike),doubt:keys(t.doubt),
      yes:(Array.isArray(t.yes)?t.yes:[]).slice(0,10).filter(y=>y && typeof y==='object' && Array.isArray(y.give) && Array.isArray(y.get)).map(y=>({give:keys(y.give).slice(0,3),get:keys(y.get).slice(0,3),at:isDay(y.at)?y.at:''})).filter(y=>y.give.length && y.get.length),
      tips:arr(t.tips,16)}; });
  return Object.keys(o.teams).length?o:null; }
function loadMg(){ MG=null; try{ MG=okMgr(JSON.parse(localStorage.getItem(MGKEY)||'null')); }catch(e){ MG=null; } }
function setMg(text){ let j=null; try{ j=JSON.parse(text); }catch(e){ return 'That is not a valid notes file.'; } const m=okMgr(j); if(!m) return 'That file has no manager notes in it.'; try{ localStorage.setItem(MGKEY,JSON.stringify(j)); }catch(e){ return 'This browser would not save the notes.'; } MG=m; return ''; }
function clearMg(){ try{ localStorage.removeItem(MGKEY); }catch(e){} MG=null; }
const sameSet=(a,b)=>a.length===b.length && a.every(x=>b.indexOf(x)>=0);
const mgYes=(m,t)=>m.yes.find(y=>sameSet(y.give,t.give.map(p=>B.nkey(p.name))) && sameSet(y.get,t.get.map(p=>B.nkey(p.name))))||null;
// how the notes change one trade. Starts from the site's own sell rating and moves it for what this manager has said and needs
function mgOf(t){ const m=MG && MG.teams[t.o]; if(!m) return null;
  const k=p=>B.nkey(p.name), N=m.name, why=[]; let s=t.sell==='easy'?2:t.sell==='fair'?1:0, force=null; const s0=s;
  if(m.ease>0) why.push(N+' is open to trading'); else if(m.ease<0) why.push(N+' is a tough sell in general'); s+=m.ease;
  t.get.forEach(p=>{ if(m.keep.indexOf(k(p))>=0){ force=0; why.push(N+' said '+p.name+' is not for trade'); } else if(m.prize.indexOf(k(p))>=0){ s-=1; why.push(N+' rates '+p.name+' highly'); } });
  t.give.forEach(p=>{ if(m.dislike.indexOf(k(p))>=0){ s-=1; why.push(N+' does not rate '+p.name); } else if(m.doubt.indexOf(k(p))>=0){ s-=0.5; why.push(N+' has doubts about '+p.name); } else if(m.like.indexOf(k(p))>=0){ s+=1; why.push(N+' likes '+p.name); } });
  if(m.needPos.length){ const fit=t.give.filter(p=>p.pos.some(x=>m.needPos.indexOf(x)>=0)); if(fit.length){ s+=1; why.push('it gives '+N+' '+fit[0].name+' at a spot '+N+' needs'); } else if(m.needPos.indexOf('C')>=0 && t.get.some(isC) && !t.give.some(isC)){ s-=0.5; why.push('it takes a center from '+N+', who wants one'); } else { s-=0.5; why.push('it gives '+N+' nothing at the spots '+N+' needs'); } }
  if(m.needCats.length){ const up=m.needCats.filter(c=>t.dop[c]>=1.5), dn=m.needCats.filter(c=>t.dop[c]<=-1.5); if(up.length){ s+=0.5; why.push('it helps '+listWords(up.map(c=>CATS[c]))+', which '+N+' is chasing'); } if(dn.length){ s-=1; why.push('it costs '+N+' in '+listWords(dn.map(c=>CATS[c]))+', which '+N+' is chasing'); } }
  if(m.edge && (t.face||faceOf(t.give,t.get)).look<1.02){ s-=1; why.push(N+' wants a small visible edge and this looks even or light'); }
  if(m.callout && (t.face||faceOf(t.give,t.get)).look<(t.face||faceOf(t.give,t.get)).need){ force=0; why.push('it looks light to '+N+', who calls out lowballs in the group chat'); }
  if(m.noTwo && t.two){ force=0; why.push(N+' has no roster room for a two for one right now'); }
  let lv=force!=null?force:clamp(Math.round(s),0,2); const yes=mgYes(m,t);
  if(yes){ lv=2; why.unshift(N+' already said yes in principle'+(yes.at?' on '+nice(yes.at):'')); }
  const rf=m.reply==='slow'?0.4:m.reply==='days'?0.9:1; if(m.reply==='slow') why.push(N+' is slow to answer, so the odds are low for now'); else if(m.reply==='days') why.push(N+' takes a few days to decide');
  return {m,lv,adj:s-s0,force:force===0,yes:!!yes,rf,sell:lv===2?'easy':lv===1?'fair':'hard',chance:Math.min(0.9,(lv===2?0.7:lv===1?0.45:0.2)*rf*(yes?1.25:1)),why}; }
// the chance a trade happens, from the notes when there are any for that team, otherwise from the site's own rating
const chanceOf=t=>{ const g=mgOf(t); return g?g.chance:(t.sell==='easy'?0.6:t.sell==='fair'?0.4:0.2); };

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
/* the chance a manager says yes to one trade, for the team by team list. It starts from the numbers every manager can see.
   How the deal looks to him on the value scale, what it does to his own team's average week, Josh's ranks and whether he has to drop a player.
   Then, when your private notes have this manager, it moves for what he has told you, the same things the notes rating reads.
   It is a rough guide to sort by, not a forecast */
function acceptOf(t){
  // a rough base from how the deal looks on face value. Most fair offers in a league still get a no, so even an easy one starts near a third
  const fc=t.face||faceOf(t.give,t.get), mv=t.mview, look=mv?mv.look:fc.look, need=mv?1.0:fc.need, why=[]; let c=mv?(mv.ok?(look>=1.06?0.35:look>=1.02?0.28:0.22):(look>=0.9?0.10:0.04)):(look>=1.06?0.35:look>=1.0?0.28:look>=need?0.22:look>=need-FACE_ASK?0.10:0.04);
  if(t.oGain>=1){ c+=0.1; why.push('his team gets better'); } else if(t.oGain<=-6){ c-=0.15; why.push('his team gets clearly worse'); } else if(t.oGain<=-3){ c-=0.08; why.push('his team gets a little worse'); }
  if(t.weakHelp && t.weakHelp.length){ c+=0.05; why.push('it helps a cat he is short in'); }
  if(t.jside==='win'){ c-=0.05; why.push('he loses by Josh\'s ranks'); }
  if(t.cut){ c-=0.1; why.push('he has to drop a player'); }
  const g=mgOf(t);
  if(g){ c+=0.18*clamp(g.adj,-4,4); c*=g.rf; if(g.force) c=Math.min(c,0.04); if(g.yes) c=Math.max(c,0.8); }
  return {c:clamp(c,0.02,0.85),why,g}; }
const PHI=x=>1/(1+Math.exp(-1.702*x));
// a weighted cat is pulled toward a coin flip, so a 10 point edge in a half weight cat counts as 5
const wPr=(pr,w)=>pr.map((p,c)=>0.5+w[c]*(p-0.5));
const pWin5=probs=>{ let dp=[1]; for(const p of probs){ const nx=new Array(dp.length+1).fill(0); for(let k=0;k<dp.length;k++){ nx[k]+=dp[k]*(1-p); nx[k+1]+=dp[k]*p; } dp=nx; } let s=0; for(let k=5;k<dp.length;k++) s+=dp[k]; return s; };
const r0=x=>Math.round(x), r1=x=>Math.round(x*10)/10;
const pc=x=>Math.round(100*x);
const sgn=x=>(x>=0?'+':'')+r1(x);
// signed numbers in words, so page text never shows a hyphen as a minus sign. A score badge uses the true minus sign instead
const updn=x=>(r1(x)>=0?'up ':'down ')+Math.abs(r1(x)), bsg=x=>(r1(x)>=0?'+':'\u2212')+Math.abs(r1(x));

/* dates, all in US Eastern because that is how the NBA and Yahoo count game days */
function etParts(dt){ const f=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(dt); const o={}; f.forEach(x=>o[x.type]=x.value); return {date:o.year+'-'+o.month+'-'+o.day,hour:(+o.hour)%24,min:+o.minute||0}; }
const nowDate=()=>(!INW && window.NCW_NOW)?new Date(window.NCW_NOW):new Date();
const addDays=(s,n)=>{ const d=new Date(s+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); };
const dayList=(a,b)=>{ const o=[]; for(let d=a; d<=b; d=addDays(d,1)) o.push(d); return o; };
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const nice=iso=>{ const m=+iso.slice(5,7), d=+iso.slice(8,10); return MON[m-1]+' '+d; };
function waiverDate(code){ const m=String(code||'').match(/^W([A-Za-z]{3})(\d{1,2})$/); if(!m) return null; const mo=MON.indexOf(m[1]); if(mo<0) return null; return (mo>=7?seasonYear():seasonYear()+1)+'-'+String(mo+1).padStart(2,'0')+'-'+String(+m[2]).padStart(2,'0'); }

/* stat lines */
const zLine=l=>{ const fgp=l.fga>0?100*l.fgm/l.fga:48.5, ftp=l.fta>0?100*l.ftm/l.fta:80.5;
  return [0.010226*(fgp-48.5)*l.pts+0.008824*(fgp-48.5)-0.12296, 0.0075475*(ftp-80.5)*l.pts-0.0061865*(ftp-80.5)+0.02054, 1.004*l.tpm-1.689, 0.169*l.pts-2.850, 0.440*l.reb-2.621, 0.495*l.ast-1.872, 2.823*l.stl-3.004, 2.065*l.blk-1.446, -1.274*l.to+2.406]; };
const valOf=l=>zLine(l).reduce((a,b)=>a+b,0);
function lineFromZ(z,mp){
  const pts=Math.max(2,(z[3]+2.850)/0.169), tpm=Math.max(0,(z[2]+1.689)/1.004), reb=Math.max(0.5,(z[4]+2.621)/0.440), ast=Math.max(0.3,(z[5]+1.872)/0.495), stl=Math.max(0.1,(z[6]+3.004)/2.823), blk=Math.max(0,(z[7]+1.446)/2.065), to=Math.max(0.3,(2.406-z[8])/1.274);
  const fgp=clamp(48.5+(z[0]+0.12296)/(0.010226*pts+0.008824),38,68), ftp=clamp(80.5+(z[1]-0.02054)/(0.0075475*pts-0.0061865),50,93);
  const fta=0.22*pts, ftm=fta*ftp/100, fgm=Math.max(0.5,(pts-ftm-tpm)/2), fga=fgm/(fgp/100);
  return {mp:mp||28,fgm,fga,ftm,fta,tpm,pts,reb,ast,stl,blk,to};
}
const lineOfPrior=a=>({mp:a[1],fgm:a[2],fga:a[3],ftm:a[4],fta:a[5],tpm:a[6],pts:a[7],reb:a[8],ast:a[9],stl:a[10],blk:a[11],to:a[12]});
const scaleLine=(l,f)=>{ const o={mp:l.mp}; TK.forEach(k=>o[k]=l[k]*f); return o; };
const mixLine=(a,b,w)=>{ const o={mp:a.mp*(1-w)+b.mp*w}; TK.forEach(k=>o[k]=a[k]*(1-w)+b[k]*w); return o; };
function priorOf(name){ if(!D.prior) return null; const k=B.nkey(name); return D.prior.p[k]||D.prior.p[PALIAS[k]]||null; }

const pickOf={}; (B.LEAGUE_DRAFT||[]).forEach((nm,i)=>{ pickOf[B.nkey(nm)]=i+1; });
// days from the first day of the fantasy season to the day of the scan, in US Eastern
const seasonAge=scan=>{ const L=D.league, t=Date.parse(scan&&scan.at); if(!L || !Array.isArray(L.weeks) || !L.weeks.length || !isFinite(t)) return 999; return (Date.parse(etParts(new Date(t)).date+'T12:00:00Z')-Date.parse(L.weeks[0].start+'T12:00:00Z'))/864e5; };
/* board players by exact name only, so Jaylin Williams is never read as Jalen Williams */
const BALIAS={'nicolas claxton':'nic claxton','alexandre sarr':'alex sarr','carlton carrington':'bub carrington','herbert jones':'herb jones','cameron johnson':'cam johnson','nahshon hyland':'bones hyland','guilherme santos':'gui santos'};
const BIDX={}; B.PLAYERS.forEach(p=>{ if(!p.stub) BIDX[B.nkey(p.name)]=p; });
const boardOf=name=>{ const k=B.nkey(name); return BIDX[k]||BIDX[BALIAS[k]]||null; };

/* Josh Lloyd's category calls, from data/josh_cats.json. His rank still decides how much a player is worth.
   These calls decide which cats that value sits in. m is the change to last season per game, FG% and FT% in points then seven multipliers.
   mp is the minutes he projects. A call with no last season number next to it, mpu, can only raise minutes. */
const JCI={};
function loadJC(){ Object.keys(JCI).forEach(k=>delete JCI[k]); const j=D.jc&&D.jc.p; if(!j || typeof j!=='object') return;
  const cats=a=>Array.isArray(a)?a.filter(c=>Number.isInteger(c)&&c>=0&&c<9):[];
  const str=x=>typeof x==='string'?x.trim().replace(/\.+$/,''):'';
  Object.keys(j).forEach(k=>{ const r=j[k]; if(!r || !Array.isArray(r.m) || r.m.length!==9 || r.m.some(x=>x===null||x===''||typeof x==='boolean')) return; const m=r.m.map(Number); if(!m.every(isFinite)) return; const mp=Number(r.mp);
    JCI[B.nkey(r.n||k)]={n:String(r.n||k),m,mp:isFinite(mp)&&mp>0?mp:0,mpu:r.mpu?1:0,why:str(r.why),why0:r.why0==null?null:str(r.why0),help:cats(r.help),hurt:cats(r.hurt)}; }); }
const hasJC=()=>Object.keys(JCI).length>0;
/* Josh's newest ranks, from data/josh_live.json. One entry per player he has moved since the draft. Each field is checked by itself, so a damaged file can not break the tab.
   A board player's new rank is handed to the board, which calibrates again. A player who is not on the board keeps the rank here, for how he looks to other managers */
const JLI={};
function loadJL(){ Object.keys(JLI).forEach(k=>delete JLI[k]); const j=D.jl&&D.jl.p;
  if(j && typeof j==='object' && !Array.isArray(j)) Object.keys(j).forEach(k=>{ const r=j[k]; if(!r || typeof r!=='object' || Array.isArray(r) || !Number.isInteger(r.rank) || r.rank<1 || r.rank>400) return;
    const str=(x,m)=>typeof x==='string' && x.trim()?x.trim().slice(0,m):'', int=x=>Number.isInteger(x) && x>=1 && x<=400?x:null;
    JLI[B.nkey(typeof r.n==='string' && r.n?r.n:k)]={rank:r.rank,was:int(r.was),base:int(r.base),at:typeof r.at==='string' && /^\d{4}-\d{2}-\d{2}$/.test(r.at) && !isNaN(Date.parse(r.at+'T12:00:00Z'))?r.at:'',show:str(r.show,60),note:str(r.note,200).replace(/\.+$/,''),soft:r.soft===true}; });
  // the board spells a few names its own way, so each entry is handed over under both spellings
  if(!INW && typeof B.applyJosh==='function'){ const m=Object.create(null); Object.keys(JLI).forEach(k=>{ m[k]=JLI[k]; if(typeof BALIAS[k]==='string') m[BALIAS[k]]=JLI[k]; }); try{ B.applyJosh(m); }catch(e){} } }
const jlOf=name=>aliasIn(JLI,B.nkey(name));
// one line on a player Josh has moved since the draft
const joshMove=p=>{ const u0=p.jl; if(!u0) return ''; const u=(p.b && p.b.jlive && p.b.jlive.rank)?Object.assign({},u0,{rank:p.b.jlive.rank}):u0; const from=u.was||u.base; return 'Josh '+(from && from!==u.rank?'moved '+p.name+' from '+from+' to '+u.rank:'has '+p.name+' at '+u.rank)+(u.at?' on '+nice(u.at):'')+(u.note?'. '+u.note:'')+'.'; };
const aliasIn=(T,k)=>{ const has=x=>typeof x==='string' && Object.prototype.hasOwnProperty.call(T,x); return has(k)?T[k]:has(BALIAS[k])?T[BALIAS[k]]:has(PALIAS[k])?T[PALIAS[k]]:null; };
const jcOf=name=>aliasIn(JCI,B.nkey(name));
/* ref is last season's own line, given only when l is a blend of two seasons. A call is written as a change to last season.
   On a blended line it goes only as far as it takes to reach the number the call points at, so a fluke the blend already took out is not taken out twice.
   It never moves a cat further than the call itself would, and never the other way from what the call says */
function applyJC(l,jc,useMin,ref){
  const o={mp:l.mp}; TK.forEach(k=>o[k]=l[k]); const m=jc.m;
  if(useMin && jc.mp>0 && l.mp>5){ let r=jc.mp/l.mp; if(jc.mpu && r<1) r=1; r=clamp(r,0.7,2.2); if(Math.abs(r-1)>=0.04){ const f=Math.pow(r,0.9); TK.forEach(k=>o[k]*=f); o.mp=l.mp*r; } }
  const rel=(k,v)=>{ const x=clamp(v,0.6,1.5); if(ref && ref[k]>0 && l[k]>0) return clamp(x*ref[k]/l[k],Math.min(1,x),Math.max(1,x)); return x; };
  const mul=(k,v)=>{ if(v>0 && v!==1) o[k]*=rel(k,v); };
  if(m[3]>0 && m[3]!==1){ const v=rel('pts',m[3]); o.pts*=v; o.fgm*=v; o.fga*=v; o.ftm*=v; o.fta*=v; }
  mul('tpm',m[2]); mul('reb',m[4]); mul('ast',m[5]); mul('stl',m[6]); mul('blk',m[7]); mul('to',m[8]);
  const shift=(old,d,a,b)=>d>0?Math.min(Math.max(old,b),old+d):Math.max(Math.min(old,a),old+d);
  const dOf=(d,mk,ak)=>{ d=clamp(d,-5,5); if(ref && ref[ak]>0 && l[ak]>0) d=clamp(100*ref[mk]/ref[ak]+d-100*l[mk]/l[ak],Math.min(0,d),Math.max(0,d)); return d; };
  if(m[0] && o.fga>0){ const d=dOf(m[0],'fgm','fga'); if(d){ const fg=shift(100*o.fgm/o.fga,d,30,75), nm=o.fga*fg/100; o.pts+=2.1*(nm-o.fgm); o.fgm=nm; } }
  if(m[1] && o.fta>0){ const d=dOf(m[1],'ftm','fta'); if(d){ const ft=shift(100*o.ftm/o.fta,d,40,96), nm=o.fta*ft/100; o.pts+=nm-o.ftm; o.ftm=nm; } }
  if(o.tpm>o.fgm) o.tpm=o.fgm;
  return o;
}
function project(p,scan){
  const b=p.b, pr=priorOf(p.name); let prior=null, pb='none'; p.f=1; p.av=0.85;
  const jc=jcOf(p.name); p.jc=jc; p.jcOn=false; p.jcMin=false; let mpPlain=null, mpSoft=false;
  if(b){
    const st=B.STATS[b.name]; const zk=!!(st&&st.z&&!st.rookie); const av0=clamp(b.av||0.85,0.45,0.96);
    const useRef=!!pr && pr[0]>=20 && !b.rookie && !(st&&st.rookie) && (!st || st.src==='2025 26');
    const mp=st&&st.line&&(st.line.match(/([\d.]+) min/)||[])[1];
    // the board moves each player 70 percent of the way to Josh's rank. Carry that same change in value over here.
    // A higher or lower rank is read first as more or fewer games played, then as a small change in per game volume, so stat lines stay believable.
    // The board reaches a spot by scaling or shifting his nine numbers. Scaling makes a sum that is below zero more negative, so the plain sum can read a move up as a move down.
    // The board value itself always moves the right way, so the direction is read from it and the size stays what the nine numbers say.
    // A rank can lift the games share by 15 points at most, the same room it has to lower it, so a player the board expects to miss time is not handed a full season
    const ezs1=b.ez.reduce((a,v)=>a+v,0);
    const v1=(b.ezs0!=null && b.bv0!=null && b.bv1!=null)?b.ezs0+(b.bv1>b.bv0?1:b.bv1<b.bv0?-1:0)*Math.abs(ezs1-b.ezs0):ezs1;
    if(useRef || zk){
      // a line blended from two seasons has no minutes of its own. Last season's minutes come from the short sample, so they are not used as its label.
      // Josh's minutes number is used when he gave one. Without it the label is soft. It shows last season's minutes until he has played this season,
      // then this season's own minutes take its place and the usual check against the last two weeks runs from there
      const blend=!useRef && !!st && st.src==='blend', jmp=blend && jc && jc.mp>0;
      if(blend && !mp && !jmp) mpSoft=true;
      const base0=useRef?lineOfPrior(pr):lineFromZ(st.z,mp?+mp:(jmp?jc.mp:(pr?pr[1]:28)));
      // games played come from the rank alone, exactly as before the category calls existed, so a call never moves how many games a player is given
      const Z0=zk?st.z.reduce((a,v)=>a+v,0):valOf(base0);
      let av=av0; if(Z0+2.25>0.5) av=clamp((v1+2.25)/(Z0+2.25),Math.max(0.5,av0-0.15),Math.max(av0,Math.min(0.93,av0+0.15)));
      const Z1=(v1+2.25*(1-av))/av;
      const dvOf=l=>Math.max(5,1.004*l.tpm+0.169*l.pts+0.440*l.reb+0.495*l.ast+2.823*l.stl+2.065*l.blk-1.274*l.to);
      // a minutes number from Josh widens how far the rank may move the volume, toward his number and no further. Only for a real last season
      let ms=1; if(jc && useRef && jc.mp>0 && base0.mp>5){ let r=jc.mp/base0.mp; if(jc.mpu && r<1) r=1; r=clamp(r,0.7,2.2); if(Math.abs(r-1)>=0.04) ms=Math.pow(r,0.9); }
      const lo=Math.min(0.88,ms), hi=Math.max(1.15,ms);
      const f0=clamp(1+(Z1-Z0)/dvOf(base0),lo,hi);
      // his category calls bend the line. The rank may give back at most 5 percent of volume to make up for them, so a big call really changes the player
      const base=jc?applyJC(base0,jc,false,blend&&pr?lineOfPrior(pr):null):base0; if(jc) p.jcOn=true;
      const Z=Z0+(jc?valOf(base)-valOf(base0):0);
      p.av=av; p.dz=Z1-Z; p.f=jc?clamp(clamp(1+(Z1-Z)/dvOf(base),f0-0.05,f0+0.05),lo,hi):f0;
      prior=scaleLine(base,p.f);
      if(ms!==1){ const want=base0.mp*Math.pow(p.f,1/0.9); prior.mp=ms>1?clamp(want,base0.mp,Math.min(jc.mp,base0.mp*2.2)):clamp(want,Math.max(jc.mp,base0.mp*0.7),base0.mp); p.jcMin=Math.abs(prior.mp/base0.mp-1)>=0.04; if(p.jcMin) mpPlain=base0.mp; }
      pb=useRef?'last':'older';
    } else {
      // no usable season on file, a rookie or a player the board only graded by eye
      const zs=b.z, Z=zs.reduce((a,v)=>a+v,0), v0=av0*Z-2.25*(1-av0), sh=clamp((v1-v0)/av0/9,-0.6,0.6); p.av=av0; p.dz=sh*9;
      prior=lineFromZ(zs.map(v=>v+sh),mp?+mp:(pr?pr[1]:26)); pb='est';
      if(jc){ prior=applyJC(prior,jc,false); p.jcOn=true; }
    }
  } else if(pr){ prior=lineOfPrior(pr); if(jc){ prior=applyJC(prior,jc,pr[0]>=20); p.jcOn=true; p.jcMin=Math.abs(prior.mp/pr[1]-1)>=0.04; if(p.jcMin) mpPlain=pr[1]; } p.av=clamp(pr[0]/78,0.6,0.93); pb='last'; }
  // the depth chart, see DBAND
  p.dep=null; p.mpNoDepth=prior?prior.mp:null; const dp=depthOf(p.id); p.ds=dp?dp.s:null; p.dsWas=dp?dp.was:null; p.dsSince=dp?dp.since:null;
  if(prior && dp && prior.mp>3 && !mpSoft && !(jc && jc.mp>0)){
    const bd=DBAND[Math.min(dp.s,3)], m0=prior.mp; let r=clamp(clamp(m0,bd[0],bd[1])/m0,1-DCAP,1+DCAP);
    if(r<1 && hurt(p)) r=1;
    if(Math.abs(r-1)>=0.03){ let fv=Math.pow(r,0.9); const pf=p.f||1; if(fv>1 && pf>1) fv=Math.max(1,fv/pf); else if(fv<1 && pf<1) fv=Math.min(1,fv/pf);
      if(Math.abs(fv-1)>=0.01){ prior=scaleLine(prior,fv); prior.mp=m0*r; p.dep={s:dp.s,from:m0,to:m0*r,f:fv}; } } }
  const s=scan.stats&&scan.stats[p.id]; let cur=null, gp=0; p.g14=null; p.m14=null; p.v14=null;
  if(s){ gp=s[1]||0; cur={mp:s[2]||0}; TK.forEach((k,i)=>cur[k]=s[3+i]||0); p.g14=s[14]; p.m14=s[15]; p.v14=s[16]; }
  if(cur&&gp<1) cur=null;
  // in the first 14 days of the season every game he has played is inside the last two weeks. Yahoo's two week split can lag a night behind
  // its season numbers, so when it is missing or shows fewer games, the season line stands in for it
  if(cur && seasonAge(scan)<=14 && (p.g14==null || p.g14<gp)){ p.g14=gp; p.m14=cur.mp; p.v14=valOf(cur); p.l14fill=true; }
  let w=0, line=null, mpReal=false;
  // a real last season counts like 12 games, an older season like 9, a rookie guess like 6
  if(cur){ const pp=prior||REPL_LINE; w=gp/(gp+(!prior?6:pb==='est'?6:pb==='older'?9:12)); line=mixLine(pp,cur,w); if(mpSoft && cur.mp>5){ line.mp=cur.mp; mpSoft=false; mpReal=true; }
    // minutes settle much faster than per minute rates, so real minutes count from the first game, a game weighing like a quarter of the starting guess
    if(!mpReal && cur.mp>5 && line.mp>5 && pp.mp>5){ const wm=gp/(gp+3), want=pp.mp*(1-wm)+cur.mp*wm, r=clamp(want/line.mp,0.75,1.25);
      if(Math.abs(r-1)>=0.03){ const m0=line.mp; line=scaleLine(line,Math.pow(r,0.9)); line.mp=m0*r; } } } else line=prior;
  p.role='';
  // real minutes over the last two weeks beat any projection. The up or down tag is judged against the minutes without Josh's call, so playing last season's minutes is never tagged as a change
  if(line && mpSoft && p.m14!=null && p.g14>=3){ line=scaleLine(line,1); line.mp=p.m14; }
  else if(line && p.m14!=null && p.g14>=3 && line.mp>5){ const r=p.m14/line.mp; const mp0=mpPlain==null?line.mp:(cur?mpPlain*(1-w)+cur.mp*w:mpPlain), r0=p.m14/mp0;
    if(Math.abs(r-1)>=0.15){ const f=Math.pow(clamp(r,0.6,1.5),0.9); line=scaleLine(line,f); line.mp=p.m14; p.jcMin=false; }
    if(Math.abs(r0-1)>=0.15) p.role=r0>1?'up':'down'; }
  p.proj=line; p.w=w; p.gp=gp; p.prior=prior;
  p.basis=!line?'none':gp<2?pb:w>=0.75?'now':'blend';
  p.val=line?valOf(line):-12;
  p.el=elig(p.pos);
  return p;
}
function elig(pos){ const s=[]; SLOTS.forEach((sl,i)=>{ if(sl==='Util' || (sl==='G'&&(pos.includes('PG')||pos.includes('SG'))) || (sl==='F'&&(pos.includes('SF')||pos.includes('PF'))) || pos.includes(sl)) s.push(i); }); return s; }
const isIL=p=>/^IL/.test(p.slot||'');
const isOut=p=>/^(O|OUT|INJ|NA|SUSP|OFS|IR)$/i.test(p.status||'');
const isDoubt=p=>/^(D|DOUBT|DOUBTFUL)$/i.test(p.status||'');
// a game time call or day to day, the mildest tag
const isGTD=p=>/^(GTD|DTD)$/i.test(p.status||'');
// a tag this code does not know is read as questionable, never as healthy
// a player the news lists as out with a return date counts as out on every day before that date
const outYet=(p,day)=>!!(p.ret && day && day<p.ret);
const pNow=(p,day)=>outYet(p,day)||isIL(p)||isOut(p)?0:!p.status?0.96:/^P$/i.test(p.status)?0.9:isDoubt(p)?0.25:isGTD(p)?0.75:0.6;
// Pickups take a further cut for a tag, for the risk that the add is wasted while he sits. It is the cut for a one week stream. A keep takes half of it.
// A tag this code does not know is cut like questionable. Probable and out take none. Out is handled by the return date instead
const tagCut=p=>!p.status||/^P$/i.test(p.status)||isOut(p)?0:isDoubt(p)?0.60:isGTD(p)?0.10:0.25;
// The better the player, the less a tag should scare you off. Inside the top 60 of the blended rank the cut is nothing, from 140 on it is all of it, and it slides one rank at a time between
const RANK0=60, RANK1=140;
const rankShare=r=>Math.min(1,Math.max(0,((r||RANK1)-RANK0)/(RANK1-RANK0)));
// the share of each game the tag counts, in whole percent, for the words on the card
const tagPct=p=>Math.round(100*(/^P$/i.test(p.status||'')?0.9:isDoubt(p)?0.25:isGTD(p)?0.75:0.6));
// after his return date the games he is expected to play are packed into the days that are left, so the missed time is not counted twice
/* age. Players 33 and older are counted for a few percent fewer games over the rest of the season, for rest days, small injuries and late season shutdowns.
   3 percent at the start of the season, growing to 8 percent by the playoff weeks, and half again as much at 36 and older.
   Per game numbers are left alone, since last season's line already shows most of the slide, and this week's numbers are left alone too.
   It is kept small because Josh's ranks and the injury history already carry some of this */
const AGE0=33, AGE_OLD=36, AGEC0=0.03, AGEC1=0.08, AGR={};
const ageRamp=day=>{ const d=day||etParts(nowDate()).date; if(AGR[d]!=null) return AGR[d]; const L=D.league; let r=0.5;
  if(L && Array.isArray(L.weeks) && L.weeks.length){ const a=Date.parse(L.weeks[0].start+'T12:00:00Z'), po=L.weeks.find(w=>w.n>(L.lastRegularWeek||18)), b=Date.parse((po?po.start:L.weeks[L.weeks.length-1].start)+'T12:00:00Z');
    r=clamp((Date.parse(d+'T12:00:00Z')-a)/Math.max(1,b-a),0,1); if(!isFinite(r)) r=0.5; }
  return AGR[d]=r; };
const ageCut=(p,day)=>!(p.age>=AGE0)?0:(AGEC0+(AGEC1-AGEC0)*ageRamp(day))*(p.age>=AGE_OLD?1.5:1);
const pROS=(p,day)=>outYet(p,day)?0:(p.avRet||p.av)*(isIL(p)&&isOut(p)?0.6:1)*(1-ageCut(p,day));
/* depth charts. ESPN's order at each position, read each morning into data/depth.json. Spot 0 is a starter, 1 is first off the bench at his best position.
   Each spot has a usual range of minutes. A line from last season whose minutes sit outside that range moves toward it, at most 15 percent either way.
   Josh's minutes number wins where he gave one, a player tagged out is never marked down for being moved down while he is hurt, and where the rank already
   moved his volume the same way only the part beyond that counts, so one piece of news is never counted twice.
   This only shapes the line from before the season. It fades as games come in, and real minutes over the last two weeks beat it outright.
   A chart more than 10 days old is not used */
const DBAND=[[24,38],[15,30],[8,22],[0,14]], DCAP=0.15, DFRESH=10, DFILL=1.3;
let DP=null;
const dPlus=(day,n)=>new Date(Date.parse(day+'T12:00:00Z')+n*864e5).toISOString().slice(0,10);
function loadDepth(){ DP=null; const d=D.depth; if(!d || typeof d!=='object' || !d.p || typeof d.p!=='object' || !d.t || typeof d.t!=='object' || !isDay(d.day)) return;
  const age=(Date.parse(etParts(nowDate()).date+'T12:00:00Z')-Date.parse(d.day+'T12:00:00Z'))/864e5; if(age>DFRESH || age<-2) return; DP=d; }
// a team whose own chart is more than 10 days old is not used, even when the file itself is fresh
const teamFresh=code=>{ const d=DP && DP.td && DP.td[code]; if(!isDay(d)) return true; const age=(Date.parse(etParts(nowDate()).date+'T12:00:00Z')-Date.parse(d+'T12:00:00Z'))/864e5; return age<=DFRESH; };
const depthOf=id=>{ const a=DP && DP.p[id]; return Array.isArray(a) && Number.isInteger(a[1]) && a[1]>=0 && teamFresh(a[0])?{t:a[0],s:a[1],was:Number.isInteger(a[2])?a[2]:null,since:isDay(a[3])?a[3]:null}:null; };
const hurt=p=>!!(p.ret || isOut(p) || isIL(p));
// the line a player brings on one day. A backup who steps in for an injured starter brings his bigger line on the days before that starter is due back
const lineOn=(p,day)=>(p.fill && day && day<p.fill.until)?p.fill.line:p.proj;
/* the next man up. When a starter is out, the first healthy player behind him at that position who is not a starter somewhere else takes about half
   of the minutes between the two of them, at most 30 percent more than his own, until the starter's return date. With no return date it runs one week
   and the next morning's scan looks again. If the next man is someone the site does not track, the minutes go to him and nobody here moves.
   A backup whose real minutes already show the jump is left alone */
function depthFill(ctx){
  Object.values(ctx.U).forEach(p=>{ p.fill=null; }); if(!DP) return;
  const today=etParts(nowDate()).date;
  Object.keys(DP.t).forEach(code=>{ const T=DP.t[code]; if(!Array.isArray(T) || !teamFresh(code)) return;
    T.forEach(list=>{ if(!Array.isArray(list) || !list[0]) return; const sp=ctx.U[list[0]]; if(!sp || !sp.proj || sp.team!==code || !hurt(sp)) return;
      const until=sp.ret || sp.dtdRet || dPlus(today,7);
      for(let i=1;i<list.length;i++){ const id=list[i]; if(!id) return; const q=ctx.U[id], dq=depthOf(id);
        if(!q || !q.proj || q.team!==code) return;
        if(dq && dq.s===0) continue;
        if(hurt(q)) continue;
        const m0=q.proj.mp, ms=sp.proj.mp; if(!(m0>3) || ms<=m0) return;
        const want=m0+0.5*(ms-m0); if(q.m14!=null && q.g14>=3 && q.m14>=0.9*want) return;
        const r=clamp(want/m0,1,DFILL); if(r<1.03) return;
        if(!q.fill || q.fill.r<r){ const ln=scaleLine(q.proj,Math.pow(r,0.9)); ln.mp=m0*r; q.fill={line:ln,until,who:sp,r,from:m0}; }
        return; } }); }); }

/* daily lineup, best players first, each one placed if a legal slot can be found for him */
const _own=new Int16Array(10), _seen=new Int32Array(10); let _stamp=0;
function _try(ps,i){ const el=ps[i].el; for(let k=0;k<el.length;k++){ const s=el[k]; if(_seen[s]===_stamp) continue; _seen[s]=_stamp; if(_own[s]<0 || _try(ps,_own[s])){ _own[s]=i; return true; } } return false; }
// seats the list in order, marks each seated player with _st and returns how many were seated
function seat(ps){ _own.fill(-1); let n=0; if(_stamp>2e9){ _seen.fill(0); _stamp=0; } for(let i=0;i<ps.length;i++){ ps[i]._st=false; if(n<10){ _stamp++; if(_try(ps,i)){ ps[i]._st=true; n++; } } } return n; }
function lineup(ps){ seat(ps); return ps.filter(p=>p._st); }
const zeroT=()=>({fgm:0,fga:0,ftm:0,fta:0,tpm:0,pts:0,reb:0,ast:0,stl:0,blk:0,to:0,g:0,s:0});
const addT=(T,l,m)=>{ T.fgm+=l.fgm*m; T.fga+=l.fga*m; T.ftm+=l.ftm*m; T.fta+=l.fta*m; T.tpm+=l.tpm*m; T.pts+=l.pts*m; T.reb+=l.reb*m; T.ast+=l.ast*m; T.stl+=l.stl*m; T.blk+=l.blk*m; T.to+=l.to*m; T.g+=m; };
const sumT=(a,b)=>{ const o=zeroT(); TK.forEach(k=>o[k]=a[k]+b[k]); o.g=a.g+b.g; o.s=(a.s||0)+(b.s||0); return o; };
const scaleT=(a,f)=>{ const o=zeroT(); TK.forEach(k=>o[k]=a[k]*f); o.g=a.g*f; o.s=(a.s||0)*f; return o; };
const playsOn=(team,day)=>{ const s=D.gset[team]; return !!s && s.has(day); };
/* one day of games. ps holds the players who play that day, best first by per game value, each with his chance to play in _pr.
   The best players are seated first, so a questionable star keeps his spot and is credited for the share of the time he is fit.
   When a starter sits, the best bench player who plays that day steps in. Only a spot that is still empty after that is covered,
   part of the time, by a waiver level fill in, the same idea the draft board uses. T.s counts lineup starts, T.g counts player games credited */
const _vd=new Float64Array(12);
function dayAdd(T,ug,ps,w,repl,rho){
  const n=seat(ps); if(!n) return;
  _vd.fill(0); _vd[0]=1; let m=0;
  for(let i=0;i<ps.length;i++){ const p=ps[i]; if(!p._st) continue; const q=1-p._pr;
    if(q>1e-12){ for(let k=m+1;k>=1;k--) _vd[k]=_vd[k]*(1-q)+_vd[k-1]*q; _vd[0]*=(1-q); m++; }
    addT(T,p._ln||p.proj,p._pr*w); if(ug) ug.set(p.id,(ug.get(p.id)||0)+w); }
  T.s+=n*w;
  if(!m) return;
  // _vd[k] is the chance that k starting spots are open. Bench players take them in order when they are fit
  for(let i=0;i<ps.length;i++){ const p=ps[i]; if(p._st) continue; const open=1-_vd[0]; if(open<1e-9) break; const a=p._pr, c=a*open;
    addT(T,p._ln||p.proj,c*w); if(ug) ug.set(p.id,(ug.get(p.id)||0)+c*w);
    for(let k=1;k<=m;k++){ _vd[k-1]+=a*_vd[k]; _vd[k]*=(1-a); } }
  if(repl){ let left=0; for(let k=1;k<=m;k++) left+=k*_vd[k]; if(left>1e-9) addT(T,repl,left*rho*w); }
}
function totalsOver(ros,days,prob,fill,dayW){
  const T=zeroT(), ug=new Map(), rho=fill?fill.rho:0, repl=fill?fill.line:null;
  if(!ros) return {T,ug};
  for(const day of days){
    const w=dayW&&dayW[day]!=null?dayW[day]:1;
    const play=[];
    for(const p of ros){ if(!p.proj || !playsOn(p.team,day)) continue; const pr=prob(p,day); if(pr<=0) continue; p._pr=pr; p._ln=lineOn(p,day); play.push(p); }
    if(!play.length) continue;
    play.sort((a,b)=>b.val-a.val);
    dayAdd(T,ug,play,w,repl,rho);
  }
  return {T,ug};
}
/* rest of season totals for one team after a roster change, worked out with the same daily lineups as totalsOver.
   Each team's list of players for every day is built once, best first, so thousands of trades can be scored exactly.
   outs leave the roster, ins join it. Days where none of them plays reuse the totals already worked out for that day */
function seasonPrep(ctx){
  const days=ctx.tdays; ctx.dl={}; ctx.dT={}; ctx.pd=new Map();
  Object.keys(ctx.ros).forEach(t=>{ ctx.dl[t]=days.map(d=>ctx.ros[t].filter(p=>p.proj && pROS(p,d)>0 && playsOn(p.team,d)).sort((a,b)=>b.val-a.val)); ctx.dT[t]=new Array(days.length).fill(null); });
}
function playDays(ctx,p){ let a=ctx.pd.get(p.id); if(!a){ a=new Uint8Array(ctx.tdays.length); if(p.proj) for(let d=0;d<a.length;d++) if(playsOn(p.team,ctx.tdays[d]) && pROS(p,ctx.tdays[d])>0) a[d]=1; ctx.pd.set(p.id,a); } return a; }
function seasonTotals(ctx,tid,outs,ins){
  const T=zeroT(), L=ctx.dl[tid], C=ctx.dT[tid], repl=ctx.fillR.line, rho=ctx.fillR.rho, nd=ctx.tdays.length;
  const insS=ins.slice().sort((a,b)=>b.val-a.val), po=outs.map(p=>playDays(ctx,p)), pi=insS.map(p=>playDays(ctx,p));
  for(let d=0;d<nd;d++){
    let hit=false; for(let j=0;j<po.length;j++) if(po[j][d]){ hit=true; break; } if(!hit) for(let j=0;j<pi.length;j++) if(pi[j][d]){ hit=true; break; }
    const base=L[d];
    if(!hit){ let c=C[d]; if(!c){ c=C[d]=zeroT(); for(let i=0;i<base.length;i++){ base[i]._pr=pROS(base[i],ctx.tdays[d]); base[i]._ln=lineOn(base[i],ctx.tdays[d]); } dayAdd(c,null,base,1,repl,rho); }
      T.fgm+=c.fgm; T.fga+=c.fga; T.ftm+=c.ftm; T.fta+=c.fta; T.tpm+=c.tpm; T.pts+=c.pts; T.reb+=c.reb; T.ast+=c.ast; T.stl+=c.stl; T.blk+=c.blk; T.to+=c.to; T.g+=c.g; T.s+=c.s; continue; }
    const list=[]; let ii=0;
    for(let i=0;i<base.length;i++){ const p=base[i]; if(outs.indexOf(p)>=0) continue; while(ii<insS.length && insS[ii].val>p.val){ if(pi[ii][d]) list.push(insS[ii]); ii++; } list.push(p); }
    while(ii<insS.length){ if(pi[ii][d]) list.push(insS[ii]); ii++; }
    for(let i=0;i<list.length;i++){ list[i]._pr=pROS(list[i],ctx.tdays[d]); list[i]._ln=lineOn(list[i],ctx.tdays[d]); }
    dayAdd(T,null,list,1,repl,rho);
  }
  return T;
}
const effLine=(p,pr,fill)=>{ const o={}; TK.forEach(k=>o[k]=p.proj[k]*pr+fill.line[k]*(1-pr)*fill.rho); return o; };
function catProbs(A,B2,u,up){
  const at=A.tot||A, bt=B2.tot||B2, ar=A.rest||at, br=B2.rest||bt, out=new Array(9);
  const pv=(t,r,m,a,d)=>{ const p=t[a]>0?t[m]/t[a]:d; const v=t[a]>0?(r[a]*p*(1-p))/(t[a]*t[a])+Math.pow(r[a]/t[a]*up,2):0.0009; return [p,v]; };
  const fa=pv(at,ar,'fgm','fga',0.47), fb=pv(bt,br,'fgm','fga',0.47); out[0]=PHI((fa[0]-fb[0])/Math.sqrt(fa[1]+fb[1]+1e-9));
  const ta=pv(at,ar,'ftm','fta',0.78), tb=pv(bt,br,'ftm','fta',0.78); out[1]=PHI((ta[0]-tb[0])/Math.sqrt(ta[1]+tb[1]+1e-9));
  for(let i=0;i<CK.length;i++){ const k=CK[i]; const v=KAP[k]*(ar[k]+br[k])+u*u*(ar[k]*ar[k]+br[k]*br[k])+1e-6; let z=(at[k]-bt[k])/Math.sqrt(v); if(k==='to') z=-z; out[i+2]=PHI(z); }
  return out;
}

const vr=r=>100*Math.exp(-(Math.max(1,r)-1)/40); const REPLV=vr(140);
// Josh's value for a player, from his overall rank. A player he does not rank falls back on how the league sees him
function vj(p,ctx){ const b=p.b; if(!b) return Math.max(0,vr(p.jr||p.seenRank||185)-REPLV); return Math.max(0,vr(b.josh||b.tgt||b.rank)-REPLV); }
const dw=arr=>arr.slice().sort((a,b)=>b-a).reduce((s,x,i)=>s+x*([1,0.75,0.5][i]||0.4),0);
const isC=p=>p.pos.includes('C');
// a center who can play now. The center minimums in trades count only these, so a center on IL or out does not hold up a roster
const isCA=p=>isC(p) && !/^IL/.test(p.slot||'') && !/^(O|OUT|INJ|NA|SUSP|OFS|IR)$/i.test(p.status||'');
/* the game plan. Every cat has one role.
   A lock is a cat you count on. A build cat is one you are trying to add, and you need enough of them to reach five with your locks.
   A bonus cat is nice to win and can be spent. A low cat counts half. A punt is written off and frozen at today's value, so no move is paid for adding it or blamed for losing it.
   A swing cat counts in full but is never chased. Order is FG%, FT%, 3PM, PTS, REB, AST, STL, BLK, TO */
const ROLES=['lock','build','bonus','low','punt','swing'];
const PLAN0=['low','bonus','lock','build','build','build','lock','punt','lock'];
const ROLEW={lock:1,build:1,swing:1,bonus:0.65,low:0.5,punt:0};
const ROLEWORD={lock:'Lock',build:'Build',bonus:'Bonus',low:'Low',punt:'Punt',swing:'Swing'};
// a lock holds when you win it 60 percent of the time on average and are favored in it against at least 7 of the 9 other teams. A build cat is on target at 60 percent
const FLOOR=0.60, FAVMIN=7, TARGET=0.60;
const okPlan=a=>Array.isArray(a) && a.length===9 && a.every(r=>ROLES.indexOf(r)>=0) && a.filter(r=>r==='lock').length<=5 && a.some(r=>r==='lock'||r==='build');
function mkPlan(roles){ const pl={roles:roles.slice(),lock:[],build:[],bonus:[],low:[],punt:[],swing:[]}; roles.forEach((r,c)=>pl[r].push(c)); pl.w=roles.map(r=>ROLEW[r]); pl.wp=roles.map(r=>r==='bonus'||r==='low'?1:ROLEW[r]);
  // you need five cats. The locks count first and the build pool has to supply the rest, as far as it can
  pl.need=Math.min(pl.build.length,Math.max(0,5-pl.lock.length)); pl.shy=Math.max(0,5-pl.lock.length-pl.build.length); pl.start=roles.every((r,c)=>r===PLAN0[c]); return pl; }
// the plan you chose on this device comes first, then the plan saved for every device in data/plan.json, then the starting plan
const planSig=()=>(D.plan && okPlan(D.plan.roles))?String(D.plan.made||'')+'|'+D.plan.roles.join(','):'';
// one trade can be pinned, the trade behind a pivot you adopted, so it stays on the list after the plan changes
const pinKey=(o,give,get)=>o+'|'+give.map(p=>p.id).sort().join('+')+'|'+get.map(p=>p.id).sort().join('+');
function planOf(){ const file=(D.plan && okPlan(D.plan.roles))?D.plan:null;
  // a plan picked on this device is kept only while the plan saved for every device is the very one it was picked over. A saved plan with a new date or new roles wins.
  // A saved plan that failed to load changes nothing, so one bad connection never throws your pick away
  if(!INW && ST.plan!=null && (!okPlan(ST.plan) || (file && (ST.planMade||'')!==planSig()))){ ST.plan=null; ST.planMade=''; ST.pin=''; save(); }
  return mkPlan(okPlan(ST.plan)?ST.plan:file?file.roles:PLAN0); }
// a punt cat stays at today's chance against that team. Every other cat is pulled toward a coin flip by its weight. piv counts bonus and low cats in full, which is how a pivot toward one of them is judged
const planPr=(pr,base,pl,piv)=>{ const w=piv?pl.wp:pl.w, o=new Array(9); for(let c=0;c<9;c++) o[c]=pl.roles[c]==='punt'?base[c]:0.5+w[c]*(pr[c]-0.5); return o; };
/* my chances against every other team with weekly totals T. over swaps in new totals for a team that changed. Returns the nine chances against each team, the weighted average for each cat,
   how many teams I am favored against in each cat, and the plain chance to win an average week */
function myView(ctx,T,over){ const w=ctx.myW, per=new Array(9).fill(0), fav=new Array(9).fill(0), prs={}; let weekN=0;
  for(const o in w){ const pr=catProbs(T,(over&&over[o])||ctx.typ[o],ctx.u,ctx.up); prs[o]=pr; weekN+=w[o]*pWin5(pr); for(let c=0;c<9;c++){ per[c]+=w[o]*pr[c]; if(pr[c]>0.5) fav[c]++; } }
  return {prs,per,fav,weekN}; }
function planWeekOf(ctx,prs,pl,piv){ const w=ctx.myW; let s=0; for(const o in prs) s+=w[o]*pWin5(planPr(prs[o],ctx.vs0[o],pl,piv)); return s; }
const catVal=(T,c)=>c===0?(T.fga>0?T.fgm/T.fga:0):c===1?(T.fta>0?T.ftm/T.fta:0):c===8?-T.to:T[CK[c-2]];
// place of a team in one cat among the ten, 1 is best. over swaps in new totals for teams that changed
function rankIn(ctx,tid,T,c,over){ let r=1; const v=catVal(T,c); for(const x in ctx.typ){ if(x===tid) continue; if(catVal((over&&over[x])||ctx.typ[x],c)>v+1e-12) r++; } return r; }
const ORD=['1st','2nd','3rd','4th','5th','6th','7th','8th','9th','10th'];
const ordW=n=>ORD[n-1]||(n+'th');
// every way to pick the build cats you still need from the build pool. With three locks that is every pair of the pool
function routeSets(pl){ const b=pl.build, k=Math.min(pl.need,b.length); if(k<=0) return []; if(k>=b.length) return [b.slice()]; const o=[]; const rec=(i,cur)=>{ if(cur.length===k){ o.push(cur.slice()); return; } for(let j=i;j<b.length;j++){ cur.push(b[j]); rec(j+1,cur); cur.pop(); } }; rec(0,[]); return o; }
const routeName=R=>listWords(R.map(c=>CATWORD[c]));
// a move serves a route when the route's cats rise by 2 points or more together and none of them falls by more than 1
const fitsRoute=(R,d)=>{ let s=0, mn=1e9; for(const c of R){ s+=d[c]; if(d[c]<mn) mn=d[c]; } return s>=2 && mn>=-1; };
// a pickup moves less than a trade, so it serves a route when the route's cats rise by 1 point together and none falls by more than half a point
const pickFits=(R,d)=>{ let s=0, mn=1e9; for(const c of R){ s+=d[c]; if(d[c]<mn) mn=d[c]; } return s>=1 && mn>=-0.5; };
/* where the plan stands today, one row for each cat */
function planTable(ctx,pl){ const v=ctx.view0, rows=[];
  for(let c=0;c<9;c++){ const role=pl.roles[c], p=v.per[c], fav=v.fav[c]; let st;
    if(role==='lock') st=(p>=FLOOR && fav>=FAVMIN)?'Holding':'At risk'; else if(role==='build') st=p>=TARGET?'On target':p>=0.5?'Close':'Behind'; else st=role==='bonus'?'Nice to win':role==='low'?'Counts half':role==='punt'?'Written off':'Counts, not chased';
    rows.push({c,role,p,fav,rank:ctx.rank[ME][c],st,room:role==='lock'?100*(p-FLOOR):null}); }
  const locks=rows.filter(r=>r.role==='lock'), builds=rows.filter(r=>r.role==='build'), on=builds.filter(r=>r.p>=TARGET);
  const risk=locks.filter(r=>r.st==='At risk');
  const week=planWeekOf(ctx,v.prs,pl,false);
  return {rows,hit:locks.filter(r=>r.p>=TARGET).length+Math.min(pl.need,on.length),of:locks.length+pl.need,set:pl.need>0 && on.length>=pl.need,risk,week,weekN:v.weekN,critical:week<0.5 || risk.length>=2}; }

/* how a player looks to the other managers. Five things are blended as ranks. This season's production, last season's, where he went in this league's draft,
   Josh Lloyd's rank and a small part Yahoo's own rank. Before a player has played, the draft counts 45, Josh 25, last season 20 and Yahoo 10.
   By his 41st game it is this season 40, Josh 20, draft 15, last season 15 and Yahoo 10, moving faster early. Most of the move comes in his first 20 games and games 20 to 41 only fine tune it, since a role shows early and managers react to it early. It goes by his own games,
   so a player who has missed most of the year still leans on the draft and last season. Games missed count against both seasons */
// Players drafted in the first 80 picks. Before games the draft leads. Josh and the draft meet at 26.25 percent each at the half way mark, about 20 games, and from there the draft keeps falling to 15
const SEENW=s=>{ const h=s<=0.5, t=h?s/0.5:(s-0.5)/0.5, mix=(a,b)=>a+(b-a)*t; return {cur:0.40*s,draft:h?mix(0.45,0.2625):mix(0.2625,0.15),josh:h?mix(0.25,0.2625):mix(0.2625,0.20),last:0.20-0.05*s,yahoo:0.10}; };
// Players drafted at pick 100 or later, and players nobody drafted. A late pick is one manager's reach, not the league's view, so the draft counts 20 and Josh's rank leads. It ends on the same mid season split
const SEENWL=s=>({cur:0.40*s,draft:0.20-0.05*s,josh:0.40-0.20*s,last:0.20-0.05*s,yahoo:0.20-0.10*s});
// Picks 81 to 99 get a mix of the two, a little more of the late pick weights with each pick, so two players drafted one spot apart are never valued by different rules
const LATE0=80, LATE1=100;
// how far a player is along the way from preseason to mid season, from his games played. A curve that rises fast early, 1 minus (1 minus g/41) squared,
// so about 43 percent of the way at 10 games and 74 at 20. The first 3 games stay on the straight line and the curve takes over fully by game 6, so one hot night does not swing the blend
const SEEN_G=41;
const seenOf=gp=>{ const lin=clamp((gp||0)/SEEN_G,0,1), cur=1-Math.pow(1-lin,2), r=clamp(((gp||0)-3)/3,0,1); return lin+(cur-lin)*r; };
const seenW=(s,pick)=>{ const L=pick?Math.min(1,Math.max(0,(pick-LATE0)/(LATE1-LATE0))):1, a=SEENW(s), b=SEENWL(s), o={}; for(const k in a) o[k]=a[k]+(b[k]-a[k])*L; return o; };
function realOf(p,scan){ const pr=priorOf(p.name), b=p.b, st=b?B.STATS[b.name]:null, s=scan.stats&&scan.stats[p.id], gp=s?(s[1]||0):0;
  let cur=null; if(s && gp>=1){ cur={mp:s[2]||0}; TK.forEach((k,i)=>cur[k]=s[3+i]||0); }
  let prev=null, pb=''; if(pr && pr[0]>=20){ prev=lineOfPrior(pr); pb='last'; } else if(st && st.z && !st.rookie){ prev=lineFromZ(st.z,pr?pr[1]:28); pb='older'; } else if(pr){ prev=lineOfPrior(pr); pb='short'; }
  return {cur,gp,prev,pb,lastG:pr?pr[0]:null}; }
function seenValues(ctx){ const all=Object.values(ctx.U), tg={}, most={};
  // games each NBA team has played so far. The NBA schedule up to the day before the scan is the count. A player traded in with more games than that can not stretch it.
  // Only when the schedule has nothing for a team is the most any of its players has played used
  const sday=(()=>{ const t=Date.parse(ctx.scan.at); return isFinite(t)?etParts(new Date(t)).date:''; })();
  all.forEach(p=>{ const s=ctx.scan.stats&&ctx.scan.stats[p.id], g=s?(s[1]||0):0; if(g>(most[p.team]||0)) most[p.team]=g; });
  Object.keys(most).forEach(t=>{ const sc=D.sched&&D.sched.games&&Array.isArray(D.sched.games[t])?D.sched.games[t]:null, n=sc&&sday?sc.filter(d=>d<sday).length:0; tg[t]=n>0?n:most[t]; });
  all.forEach(p=>{ const r=p.rl=realOf(p,ctx.scan);
    p.cv0=r.cur?valOf(r.cur):null; p.lv0=r.prev?valOf(r.prev):null;
    // the share of games he played. This season against his team's games so far, last season against 72, and a season before that counts as 6 games in 10
    p.avC=r.cur?clamp(r.gp/Math.max(1,tg[p.team]||r.gp),0.3,1):null;
    p.avL=r.prev?(r.pb!=='older' && r.lastG!=null?clamp(r.lastG/72,0.3,1):0.6):null;
    // an older season and an old player both make a manager trust the numbers less
    let m=1, mc=1; const why=[], early=r.gp<20;
    if(r.pb==='older' || r.pb==='short'){ m*=1.15; if(early) why.push('his numbers come from before last season'); }
    if(p.age>=32){ m*=1.08; mc*=1.08; why.push('he is '+p.age); }
    if(r.pb==='last' && r.lastG!=null && r.lastG<50 && early) why.push('he played only '+r.lastG+' games last season');
    p.seenMult=m; p.seenMultC=mc; p.seenWhy=why; p.lastRank=null; p.curRank=null; });
  // each season is ranked by what he was worth above a replacement player, times the share of games he played. Half a season of star numbers is not a star season
  const rankBy=(vk,ak,rk)=>{ const have=all.filter(p=>p[vk]!=null); if(!have.length) return; const R=have.slice().sort((a,b)=>b[vk]-a[vk])[Math.min(have.length-1,139)][vk];
    have.forEach(p=>{ p.tv=p[vk]>R?R+(p[vk]-R)*p[ak]:p[vk]; }); have.sort((a,b)=>b.tv-a.tv||(a.id<b.id?-1:1)).forEach((p,i)=>{ p[rk]=i+1; }); };
  rankBy('lv0','avL','lastRank'); rankBy('cv0','avC','curRank');
  const wy=clamp(ctx.avgGP/25,0,0.7);
  all.forEach(p=>{ const k=B.nkey(p.name), b=p.b, parts=[], sg=seenOf(p.rl.gp), W=seenW(sg,pickOf[k]); p.seenS=sg;
    if(p.curRank && W.cur>0) parts.push([W.cur,Math.min(260,p.curRank*p.seenMultC)]);
    if(p.lastRank) parts.push([W.last,Math.min(260,p.lastRank*p.seenMult)]);
    const pick=pickOf[k]; parts.push(pick?[W.draft,pick]:[W.draft/2,165]);
    const jr=(b && b.josh)||p.jr||null; if(jr) parts.push([W.josh,jr]);
    // Yahoo's rank for this season joins only once he has 5 games, before that it is one or two nights of noise
    const yc=(p.cur && p.rl.gp>=5)?p.cur:null, y=(p.pre||yc)?(1-wy)*(p.pre||yc)+wy*(yc||p.pre):null; if(y) parts.push([W.yahoo,y]);
    const ws=parts.reduce((a,x)=>a+x[0],0); p.seenRank=parts.reduce((a,x)=>a+x[0]*x[1],0)/ws;
    const pts=p.proj?p.proj.pts:0;
    // the curve never reaches zero, so two bench players can not read as a blowout
    let v=(100*Math.exp(-(Math.max(1,p.seenRank)-1)/45)+3)*(LEGEND.has(k)?1.15:1)*(pts>=25?1.10:pts>=20?1.05:1);
    if(p.v14!=null && p.g14>=3) v*=1+clamp((p.v14-p.val)/40,-0.08,0.08);
    // a return date costs value by the share of the rest of the season it takes away, from nothing for a date before opening night to three quarters for a player who is done for the year
    const miss=(p.ret && ctx.tdays && ctx.tdays.length)?ctx.tdays.filter(d=>d<p.ret).length/ctx.tdays.length:0;
    if(miss>0) v*=1-0.75*miss; else if(isOut(p)) v*=0.75; else if(p.status && !/^P$/i.test(p.status)) v*=0.96;
    p.mv=v; });
}
/* does an offer look fair to them. A is what they get, B is what they give, both on the value above. Small deals are judged by the gap, not the ratio,
   so the gap is measured against at least 40 points of value, about one good starter. Two bench players can then never read as a blowout.
   An offer has to look even or better to them. If they give the best player in the deal they expect to be paid for it.
   It never hands them more than 15 percent extra value, 10 if you give the best player and 5 if he is clearly the best, so you do not sell low.
   When you give the clearly best player the offer may lean up to 8 percent your way, because the side that gets the star usually feels it won.
   An offer that falls just short of looking fair is kept apart as an opening ask. It is never listed by itself */
const FAIRLOW=0.98, ASKROOM=0.12, STRETCHROOM=0.27, BENCHV=20;
function fairOf(give,get){ const A=dw(give.map(p=>p.mv)), Bv=dw(get.map(p=>p.mv)), look=1+(A-Bv)/Math.max(Bv,40);
  const bg=Math.max.apply(null,give.map(p=>p.mv)), br=Math.max.apply(null,get.map(p=>p.mv)), best=br>bg*1.25?2:br>bg*1.02?1:0, mine=bg>br*1.25?2:bg>br*1.02?1:0;
  const need=best===2?1.10:best===1?1.02:mine===2?0.92:FAIRLOW, cap=mine===2?1.05:mine===1?1.10:1.15, ok=look>=need && look<=cap;
  const ask=!ok && look<need && look>=need-ASKROOM;
  // a stretch. Light to them by more than an opening ask, up to about 25 percent. Only for the team by team list, where it sits at the bottom and leans on your pitch
  return {A,B:Bv,look,best,mine,need,cap,ok,ask,str:!ok && !ask && look<need && look>=need-STRETCHROOM}; }

/* face value. How a player looks to a normal manager, who goes by the box score and the name, not by minutes or nine cat math.
   It is a box score rating that leads with points the way managers do. Points count 1, rebounds 0.8, assists 1, threes half, steals 1.5 and blocks 1.
   It starts from last season, or the season before for a player who missed last season, or the projection for a rookie.
   This season moves it fast only when the start backs up the record. A hot start from a player who was solid last season is believed,
   and so is a cold start from a player who was weak. A hot start from a weak player, or a cold start from a solid one, reads as one good
   or bad night and moves it slowly. Missed games, age, injuries and a big name move it a little */
const fpOf=l=>l?l.pts+0.8*l.reb+l.ast+0.5*l.tpm+1.5*l.stl+l.blk:0;
const FACE_FAST=4, FACE_SLOW=15, FACE_SOLID=120;
function faceValues(ctx){ const all=Object.values(ctx.U), P2=D.prior2&&D.prior2.p;
  all.forEach(p=>{ const pr=priorOf(p.name), k=B.nkey(p.name), p2=P2?(P2[k]||P2[PALIAS[k]]||null):null; let L=null, src='', g=null, m=1;
    if(pr && pr[0]>=20){ L=lineOfPrior(pr); src='last'; g=pr[0]; }
    else if(p2 && p2[0]>=20){ L=lineOfPrior(p2); src='two'; g=p2[0]; m*=0.9; }
    else if(p.prior){ L=p.prior; src='proj'; m*=0.9; }
    else if(p.proj){ L=p.proj; src='proj'; m*=0.85; }
    p.fvBase=L; p.fvSrc=src; p.fvG=g; p.fvL=L?fpOf(L)*m*(g!=null?0.85+0.15*Math.min(1,g/65):1):0; });
  // the line between a solid player and a weak one is the 120th best record in the league
  const ls=all.map(p=>p.fvL).filter(x=>x>0).sort((a,b)=>b-a), solid=ls[Math.min(ls.length-1,FACE_SOLID-1)]||25; ctx.fvSolid=solid;
  all.forEach(p=>{ const k=B.nkey(p.name), cur=p.rl&&p.rl.cur, gp=p.rl?p.rl.gp:0; let v=p.fvL; p.fvC=cur?fpOf(cur):null; p.fvTrend='';
    if(cur && gp>=1 && p.fvL>0){ const hot=p.fvC>p.fvL*1.1, cold=p.fvC<p.fvL*0.9, weak=p.fvL<solid, real=(hot && !weak) || (cold && weak) || (!hot && !cold);
      const wc=Math.min(0.75,gp/(gp+(real?FACE_FAST:FACE_SLOW))); v=p.fvL*(1-wc)+p.fvC*wc;
      p.fvTrend=hot?(real?'hot, backed by his record':'hot, but his record says one good stretch'):cold?(real?'cold, in line with his record':'cold, but his record says it will pass'):'in line with his record'; }
    else if(cur && gp>=1){ v=p.fvC*Math.min(0.75,gp/(gp+FACE_FAST)); }
    if(p.age>=36) v*=0.9; else if(p.age>=33) v*=0.95;
    if((pickOf[k] && pickOf[k]<=40) || LEGEND.has(k)) v*=1.06;
    const miss=(p.ret && ctx.tdays && ctx.tdays.length)?ctx.tdays.filter(d=>d<p.ret).length/ctx.tdays.length:0;
    if(miss>0) v*=1-0.6*miss; else if(isOut(p)) v*=0.8; else if(isIL(p)) v*=0.9; else if(p.status && !/^P$/i.test(p.status)) v*=0.97;
    p.fv=Math.max(1,v); });
  const fs=all.map(p=>p.fv).sort((a,b)=>b-a); ctx.fvStar=fs[Math.min(fs.length-1,29)]||42; }
/* does an offer look fair to them on face value. A is what they get, B is what they give, best player weighted most, the same way as the value scale.
   It has to look even to them, a little better when they give the best player. A deal under 80 percent of even is an insult and is never shown anywhere.
   It never hands them more than 20 percent extra, so you do not sell low */
const FACE_INSULT=0.80, FACE_ASK=0.06;
function faceOf(give,get){ const A=dw(give.map(p=>p.fv)), Bv=dw(get.map(p=>p.fv)), look=A/Math.max(1,Bv);
  const bg=Math.max.apply(null,give.map(p=>p.fv)), br=Math.max.apply(null,get.map(p=>p.fv)), best=br>bg*1.25?2:br>bg*1.05?1:0, mine=bg>br*1.25?2:bg>br*1.05?1:0;
  const need=best===2?1.05:best===1?1.0:mine>=1?0.93:0.96, cap=1.20, ok=look>=need && look<=cap;
  return {A,B:Bv,look,best,mine,need,cap,ok,insult:look<FACE_INSULT,ask:!ok && look<need && look>=need-FACE_ASK}; }


/* a news entry is only trusted field by field. Anything that is not the right kind of value is dropped, so a damaged news file can never break a card or move a number */
const isDay=x=>{ if(typeof x!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false; const d=new Date(x+'T12:00:00Z'); return !isNaN(d) && d.toISOString().slice(0,10)===x; };
function cleanNews(nw){ if(!nw || typeof nw!=='object' || Array.isArray(nw)) return null; const str=(x,m)=>typeof x==='string' && x.trim()?x.trim().slice(0,m):null;
  const o={st:nw.st==='Out'||nw.st==='Day-To-Day'?nw.st:null,part:str(nw.part,40),ret:isDay(nw.ret)?nw.ret:null,at:isDay(nw.at)?nw.at:null,dir:nw.dir==='good'||nw.dir==='bad'||nw.dir==='neutral'?nw.dir:null,note:str(nw.note,200),tagAt:isDay(nw.tagAt)?nw.tagAt:null,tagSrc:str(nw.tagSrc,30)};
  return (o.st || o.note)?o:null; }
/* build the league from a scan */
function build(scan,opt){
  // lag is the days before a roster change can count. Trades take about two days to clear Yahoo's review, so the trade league starts its season totals that much later
  const ctx={scan,U:{},ros:{},avail:[],teams:{},notes:[],lag:(opt&&opt.lag)||0};
  const P=(D.players&&D.players.p)||{};
  const today0=etParts(nowDate()).date, NW=(D.news&&D.news.p)||{}, AG=(D.ages&&D.ages.p)||{};
  const mk=id=>{ if(ctx.U[id]) return ctx.U[id]; const a=P[id]||['Player '+id,'','',null]; const p={id,name:a[0],team:a[1],pos:String(a[2]||'').split(',').filter(Boolean),pre:a[3],own:null,slot:'',status:'',fa:''};
    // news and age are optional extras. A player ESPN lists as out with a return date still ahead is counted as out until that date
    p.news=cleanNews(NW[id]); p.ret=(p.news && p.news.st==='Out' && p.news.ret && p.news.ret>today0)?p.news.ret:null;
    // a day to day player with a return date still ahead. He is not counted out, but the date sets his injury class and how long a backup fills in
    p.dtdRet=(p.news && p.news.st==='Day-To-Day' && p.news.ret && p.news.ret>today0)?p.news.ret:null;
    // a hand written note from before opening night is preseason context. It keeps its words on the card but no longer moves a score
    { const L0=D.league && Array.isArray(D.league.weeks) && D.league.weeks[0] && D.league.weeks[0].start; if(p.news && p.news.tagAt && L0 && p.news.tagAt<L0 && today0>=L0) p.news.pre=true; }
    p.jl=jlOf(p.name); p.jr=p.jl?p.jl.rank:null;
    const ag=AG[B.nkey(p.name)]; p.age=(Array.isArray(ag) && Number.isInteger(ag[0]) && ag[0]>=15 && ag[0]<=60)?ag[0]:null;
    ctx.U[id]=p; return p; };
  // wins, losses and ties are read as numbers, so a record saved as text can never turn the win counts into nonsense
  (scan.teams||[]).forEach(t=>{ if(t && t.id!=null) ctx.teams[t.id]=Object.assign({},t,{w:+t.w||0,l:+t.l||0,t:+t.t||0}); });
  Object.keys(scan.rosters||{}).forEach(tid=>{ ctx.ros[tid]=scan.rosters[tid].map(e=>{ const p=mk(e[0]); p.own=tid; p.slot=e[1]||'BN'; p.status=e[2]||''; return p; }); if(!ctx.teams[tid]) ctx.teams[tid]={id:tid,name:(D.league&&D.league.teams[tid]&&D.league.teams[tid].name)||('Team '+tid),w:0,l:0,t:0}; });
  Object.keys((D.league&&D.league.teams)||{}).forEach(t=>{ if(!ctx.ros[t]){ ctx.ros[t]=[]; if(!ctx.teams[t]) ctx.teams[t]={id:t,name:D.league.teams[t].name,w:0,l:0,t:0}; } });
  Object.keys(scan.avail||{}).forEach(id=>{ const p=mk(id); if(p.own) return; p.fa=scan.avail[id][0]||'F'; p.status=scan.avail[id][1]||''; ctx.avail.push(p); });
  Object.keys(scan.q||{}).forEach(id=>{ const p=ctx.U[id]; if(p){ p.cur=scan.q[id][0]; p.pct=scan.q[id][1]; } });
  // moves you marked since the last scan
  for(const m of ST.marks){
    if(m.type==='add'){ const a=mk(m.add); if(a.own && a.own!==ME) continue; if(!a.own){ ctx.avail=ctx.avail.filter(x=>x!==a); a.own=ME; a.slot='BN'; a.fa=''; ctx.ros[ME].push(a); }
      if(m.il){ const q=ctx.U[m.il]; if(q && q.own===ME) q.slot='IL'; }
      if(m.drop){ const d=ctx.U[m.drop]; if(d && d.own===ME){ ctx.ros[ME]=ctx.ros[ME].filter(x=>x!==d); d.own=null; d.slot=''; d.fa='W'; ctx.avail.push(d); } } }
    if(m.type==='trade'){ const o=m.withTeam; if(!ctx.ros[o]) continue; m.give.forEach(id=>{ const p=ctx.U[id]; if(p&&p.own===ME){ ctx.ros[ME]=ctx.ros[ME].filter(x=>x!==p); p.own=o; p.slot='BN'; ctx.ros[o].push(p); } }); m.get.forEach(id=>{ const p=ctx.U[id]; if(p&&p.own===o){ ctx.ros[o]=ctx.ros[o].filter(x=>x!==p); p.own=ME; p.slot='BN'; ctx.ros[ME].push(p); } });
      if(m.cut){ const c=ctx.U[m.cut]; if(c && c.own===o){ ctx.ros[o]=ctx.ros[o].filter(x=>x!==c); c.own=null; c.slot=''; c.fa='W'; ctx.avail.push(c); } } }
  }
  let gsum=0, gn=0;
  Object.values(ctx.U).forEach(p=>{ p.b=boardOf(p.name); project(p,scan); if(p.own){ gsum+=p.gp; gn++; } });
  ctx.avgGP=gn?gsum/gn:0;
  let ws=0, wn=0; Object.keys(ctx.ros).forEach(t=>ctx.ros[t].forEach(p=>{ if(p.proj){ ws+=p.w; wn++; } }));
  ctx.wbar=wn?ws/wn:0; ctx.u=0.06+0.07*(1-ctx.wbar); ctx.up=0.006+0.008*(1-ctx.wbar);

  // waiver level in this league, the average of the free agents ranked 3rd to 10th right now
  // the waiver level is made of players you can really add, so your own drops from the last 7 days are left out
  ctx.now=etParts(nowDate()); const gone0=myRecentDrops(ctx);
  const fas=ctx.avail.filter(p=>p.proj&&!isOut(p)&&!gone0.has(p.id)).sort((a,b)=>b.val-a.val).slice(2,10); const rl=zeroT(); if(fas.length>=4) fas.forEach(p=>addT(rl,p.proj,1/fas.length)); else addT(rl,REPL_LINE,1);
  ctx.repl=rl; ctx.fillR={rho:0.8,line:rl}; ctx.fillW={rho:0.5,line:rl};
  Object.values(ctx.U).forEach(p=>{ if(p.proj) p.eff=effLine(p,pROS(p),ctx.fillR); });
  timeline(ctx);
  seenValues(ctx); faceValues(ctx); Object.values(ctx.U).forEach(p=>{ p.jv=vj(p,ctx); });
  Object.values(ctx.U).forEach(p=>{ p.avRet=0; if(p.ret && ctx.tdays.length){ const nd=ctx.tdays.length, na=ctx.tdays.filter(d=>d>=p.ret).length; if(na>0 && na<nd) p.avRet=clamp(p.av*nd/na,p.av,0.9); } });
  depthFill(ctx);
  typical(ctx);
  return ctx;
}
function timeline(ctx){
  const L=D.league, now=etParts(nowDate()), weeks=L.weeks;
  let wk=weeks.find(w=>w.end>=now.date)||weeks[weeks.length-1];
  const sc=ctx.scan, m=sc.matchup; let from, act=null;
  const has=m && m.week===wk.n && m.rows && m.rows.length===2 && m.rows.some(r=>r.pts!=null);
  ctx.dayW=null;
  if(has){ const se=etParts(new Date(sc.at)), t=se.hour+se.min/60; from=se.date;
    // a scan taken while that night's games are being played already holds part of them, so that day counts only for the part still to come.
    // Late games run past midnight Eastern, so the day is never written off while they may still be on
    if(t>=19){ ctx.dayW={}; ctx.dayW[se.date]=clamp(0.95-0.2*(t-19),0.15,0.95); }
    else if(t<2){ const y=addDays(se.date,-1); if(y>=wk.start){ from=y; ctx.dayW={}; ctx.dayW[y]=0.1; } }
    act={}; m.rows.forEach(r=>{ const tt=zeroT(); TK.forEach(k=>tt[k]=r[k]||0); act[r.tid]=tt; }); }
  else from=now.date;
  if(from<wk.start) from=wk.start;
  // the week has started but the scan holds no score for it, so the days already played are unknown and only the days left can be counted
  ctx.partial=!has && from>wk.start && from<=wk.end;
  let addDay=now.hour>=19?addDays(now.date,1):now.date; if(addDay<from) addDay=from;
  ctx.now=now; ctx.wk=wk; ctx.from=from; ctx.act=act; ctx.addDay=addDay;
  ctx.days=from<=wk.end?dayList(from,wk.end):[];
  const oppOf=w=>{ const g=w.games.find(x=>x.includes(ME)); return g?(g[0]===ME?g[1]:g[0]):null; };
  ctx.opp=oppOf(wk);
  // playoff weeks are not in the saved schedule, so read the opponent from the scan's matchup
  if(!ctx.opp && m && m.week===wk.n && m.rows){ const r=m.rows.find(x=>String(x.tid)!==ME && ctx.ros[x.tid]); if(r) ctx.opp=String(r.tid); }
  // the week a new pickup can still help
  if(addDay<=wk.end){ ctx.pwk=wk; ctx.pdays=ctx.days; ctx.pact=act; ctx.popp=ctx.opp; }
  else { const nx=weeks.find(w=>w.n===wk.n+1); if(nx){ ctx.pwk=nx; ctx.pdays=dayList(nx.start,nx.end); ctx.pact=null; ctx.popp=oppOf(nx); if(addDay<nx.start) ctx.addDay=nx.start; } else { ctx.pwk=wk; ctx.pdays=[]; ctx.pact=act; ctx.popp=ctx.opp; } }
  // with no adds left this week a pickup can only help from next week on, so the list is scored for next week
  ctx.addsNow=addsLeft(ctx,wk); ctx.noAdds=false;
  // The same holds late on the last day of the week, when the list has already moved on by the clock. Yahoo still counts an add made that night against this week
  if(ctx.addsNow<=0 && now.date>=wk.start && now.date<=wk.end){ const nx=weeks.find(w=>w.n===wk.n+1); if(nx && (ctx.pwk===wk || ctx.pwk===nx)){ ctx.noAdds=true; ctx.pwk=nx; ctx.pdays=dayList(nx.start,nx.end); ctx.pact=null; ctx.popp=oppOf(nx); ctx.addDay=nx.start; } }
  // every day from now to the last day of the fantasy playoffs, used for the rest of season numbers. Nothing after the final counts
  const last=weeks[weeks.length-1].end;
  const t0=ctx.lag?addDays(from,ctx.lag):from; ctx.tdays=t0<=last?dayList(t0,last):[]; ctx.tweeks=Math.max(1,ctx.tdays.length/7);
  // who each team still has to play in the regular season
  ctx.rem={}; Object.keys(ctx.ros).forEach(t=>ctx.rem[t]={});
  weeks.filter(w=>w.n>=wk.n && w.n<=(L.lastRegularWeek||18)).forEach(w=>w.games.forEach(gm=>{ const a=gm[0], b=gm[1]; if(ctx.rem[a]&&ctx.rem[b]){ ctx.rem[a][b]=(ctx.rem[a][b]||0)+1; ctx.rem[b][a]=(ctx.rem[b][a]||0)+1; } }));
}
function typical(ctx){
  ctx.typ={}; ctx.ug={}; ctx.gpw={};
  Object.keys(D.gset).forEach(t=>{ let n=0; for(const d of ctx.tdays) if(D.gset[t].has(d)) n++; ctx.gpw[t]=n/ctx.tweeks; });
  Object.keys(ctx.ros).forEach(tid=>{ const r=totalsOver(ctx.ros[tid],ctx.tdays,pROS,ctx.fillR); ctx.typ[tid]=scaleT(r.T,1/ctx.tweeks); r.ug.forEach((v,id)=>{ ctx.ug[id]=v/ctx.tweeks; }); });
  ctx.stream=scaleT(ctx.repl,2.9);
  ctx.base={}; Object.keys(ctx.ros).forEach(t=>ctx.base[t]=strength(ctx,t,ctx.typ));
  // my own picture against every team, and every team's place in each cat. The plan, the floors and the talking points all read from these
  ctx.myW=oppWeights(ctx,ME); ctx.view0=myView(ctx,ctx.typ[ME]); ctx.vs0=ctx.view0.prs;
  ctx.rank={}; Object.keys(ctx.typ).forEach(t=>{ ctx.rank[t]=CATS.map((_,c)=>rankIn(ctx,t,ctx.typ[t],c)); });
  seasonPrep(ctx);
}
function oppWeights(ctx,tid){ const w={}; let s=0; Object.keys(ctx.ros).forEach(o=>{ if(o===tid) return; w[o]=0.5+((ctx.rem[tid]||{})[o]||0); s+=w[o]; }); Object.keys(w).forEach(o=>w[o]/=s); return w; }
function strength(ctx,tid,typ,wt){
  const w=oppWeights(ctx,tid); let week=0, weekN=0; const per=new Array(9).fill(0), vs={};
  Object.keys(w).forEach(o=>{ const pr=catProbs(typ[tid],typ[o],ctx.u,ctx.up); const pn=pWin5(pr); vs[o]=pn; weekN+=w[o]*pn; week+=w[o]*(wt?pWin5(wPr(pr,wt)):pn); for(let c=0;c<9;c++) per[c]+=w[o]*pr[c]; });
  return {week,weekN,per,vs};
}
/* a cat is gained when it goes from under to over 50 percent by at least 5 points, and lost when it goes the other way by at least 2 */
function flipNet(before,after,w){ let n=0; const up=[], dn=[]; for(let c=0;c<9;c++){ const b=before[c]>0.5, a=after[c]>0.5; if(!b && a && after[c]-before[c]>=0.05){ n+=w[c]; up.push(c); } else if(b && !a && before[c]-after[c]>=0.02){ n-=w[c]; dn.push(c); } } return {n,up,dn}; }
/* position balance. A spot with 3 or fewer eligible players is thin, 6 or more is crowded. Each player counts once, at the spot where he matters.
   A player who can play a thin spot fills it. A player is only crowding when every spot he can play is crowded, because otherwise he can be slotted somewhere with room.
   Going out works the same way in reverse. A move that helps balance lifts its score 5 to 8 percent, one that hurts it cuts the score the same way */
function balance(ctx,outs,ins){
  const c={PG:0,SG:0,SF:0,PF:0,C:0}; ctx.ros[ME].forEach(p=>{ if(isIL(p)) return; p.pos.forEach(x=>{ if(x in c) c[x]++; }); });
  const elig=p=>(p.pos||[]).filter(x=>x in c), thinOf=ps=>ps.filter(x=>c[x]<=3).sort((a,b)=>c[a]-c[b])[0], allFull=ps=>ps.length>0 && ps.every(x=>c[x]>=6);
  const tn={}, cin=[], cout=[];
  ins.forEach(p=>{ const ps=elig(p), t=thinOf(ps); if(t) tn[t]=(tn[t]||0)+1; else if(allFull(ps)) cin.push(ps); });
  outs.forEach(p=>{ const ps=elig(p), t=thinOf(ps); if(t) tn[t]=(tn[t]||0)-1; else if(allFull(ps)) cout.push(ps); });
  const uniq=a=>[...new Set([].concat(...a))], order=['PG','SG','SF','PF','C'], srt=a=>a.sort((x,y)=>order.indexOf(x)-order.indexOf(y));
  const filled=srt(Object.keys(tn).filter(x=>tn[x]>0)), thin=srt(Object.keys(tn).filter(x=>tn[x]<0)), cn=cout.length-cin.length;
  const crowd=cn<0?srt(uniq(cin)):[], eased=cn>0?srt(uniq(cout)):[];
  const b=Object.keys(tn).reduce((s,x)=>s+tn[x],0)+cn;
  return {b,good:srt(uniq([filled,eased])),bad:srt(uniq([crowd,thin])),crowd,thin,mult:b>=2?1.08:b>=1?1.05:b<=-2?0.92:b<=-1?0.95:1};
}

/* this week against the real opponent, with the live score once the week has started */
function weekProj(ctx,ros,tid,days,act){ const r=totalsOver(ros,days,pNow,ctx.fillW,ctx.dayW); const a=act&&act[tid]; return {tot:a?sumT(a,r.T):r.T,rest:r.T,ug:r.ug,games:r.T.g}; }
function thisWeek(ctx){
  if(!ctx.opp || !ctx.ros[ctx.opp] || !ctx.ros[ME]) return null;
  const me=weekProj(ctx,ctx.ros[ME],ME,ctx.days,ctx.act), op=weekProj(ctx,ctx.ros[ctx.opp],ctx.opp,ctx.days,ctx.act);
  const probs=catProbs(me,op,ctx.u,ctx.up);
  return {me,op,probs,win:pWin5(probs),fav:probs.filter(x=>x>0.5).length,exp:probs.reduce((a,b)=>a+b,0)};
}

/* pickups */
function myProtected(ctx){
  const mine=ctx.ros[ME]; const today=ctx.now.date; const set=new Set();
  mine.filter(p=>p.proj).slice().sort((a,b)=>(b.val+14)*pROS(b)-(a.val+14)*pROS(a)).slice(0,8).forEach(p=>set.add(p.id));
  mine.forEach(p=>{ const k=B.nkey(p.name); if(NEVER.has(k)) set.add(p.id); if(HOLD[k] && today<HOLD[k]) set.add(p.id); });
  return set;
}
/* who may be dropped, Vikas's rules from Oct 21.
   Top picks (rounds 1 to 4) go only when out for the season. Mid picks (rounds 5 to 12) never go for a stream. They go for a long term add only when
   slumping, out for the season, or out more than 6 weeks with no IL spot. Late picks (rounds 13 to 15) and players picked up off waivers can go for
   any clear upgrade. Injuries are sorted by the return date in the news. Under 2 weeks he is kept and moved to IL, 2 to 6 weeks a late pick may go when
   no IL spot is open, over 6 weeks a late pick may go, and out for the season anyone may go */
const TIER_TOP=40, TIER_MID=120, PICKNOW=1.0;
// players Vikas has said he wants to keep, never suggested as a drop for a pickup. Trades can still include them
const KEEP=new Set(['rui hachimura']);
// rules from data/plan.json. never and keep are lists of names, hold maps a name to the day the hold ends. A missing or damaged field keeps the default
function setRules(j){ if(!j || typeof j!=='object') return; const names=x=>Array.isArray(x)?x.filter(s=>typeof s==='string' && s.trim()).map(s=>B.nkey(s)):null;
  const nv=names(j.never); if(nv && nv.length){ NEVER.clear(); nv.forEach(k=>NEVER.add(k)); }
  const kp=names(j.keep); if(kp){ KEEP.clear(); kp.forEach(k=>KEEP.add(k)); }
  if(j.hold && typeof j.hold==='object' && !Array.isArray(j.hold)){ const h={}; Object.keys(j.hold).forEach(n=>{ if(isDay(j.hold[n])) h[B.nkey(n)]=j.hold[n]; }); Object.keys(HOLD).forEach(k=>delete HOLD[k]); Object.assign(HOLD,h); } }
const tierOf=p=>{ const k=pickOf[B.nkey(p.name)]; return !k?'pickup':k<=TIER_TOP?'top':k<=TIER_MID?'mid':'late'; };
const tierWord=t=>t==='top'?'a top pick':t==='mid'?'a mid round pick':t==='late'?'a late pick':'a waiver pickup';
const seasonEndOf=()=>{ const L=D.league; const w=L&&Array.isArray(L.weeks)?L.weeks.find(x=>x.n===(L.lastRegularWeek||18)):null; return (w&&w.end)||null; };
function injClass(ctx,p){ const out=isOut(p)||isIL(p), n=p.news||{}, txt=String((n.note||'')+' '+(n.part||'')), se=seasonEndOf(), ret=p.ret||((n.st==='Out'&&n.ret)?n.ret:null)||p.dtdRet||null;
  if(out && (/out for the (rest of the )?season|season[ -]ending/i.test(txt) || (ret && se && ret>se))) return 'season';
  if(!out) return '';
  if(!ret) return 'mid';
  const wks=(Date.parse(ret+'T12:00:00Z')-Date.parse(ctx.now.date+'T12:00:00Z'))/(7*864e5);
  return wks<2?'short':wks<=6?'mid':'long'; }
// a slump needs two weeks of real games, and two of three signs
function slumpOf(ctx,p){ const why=[]; if(!(p.gp>=6)) return {on:false,why};
  if(p.v14!=null && p.g14>=4 && p.v14<p.val-4) why.push('his last two weeks are well below his projection');
  const u=p.jl; if(u){ const from=u.was||u.base, to=(p.b&&p.b.jlive&&p.b.jlive.rank)||u.rank; if(from && to && to-from>=15) why.push('Josh moved him down from '+from+' to '+to); }
  if(p.cur && p.pre && p.cur-p.pre>=30) why.push('his Yahoo rank fell from '+p.pre+' to '+p.cur);
  return {on:why.length>=2,why}; }
// may this player of yours be dropped, for a stream or for a long term add
function dropOK(ctx,d,kind,ilOpen){ const t=tierOf(d), inj=injClass(ctx,d), low=t==='late'||t==='pickup';
  if(NEVER.has(B.nkey(d.name))) return {ok:false,why:'never dropped'};
  if(KEEP.has(B.nkey(d.name))) return {ok:false,why:'on your keep list'};
  if(inj==='season') return {ok:true,why:'out for the season',inj:true,t};
  if(inj==='short') return {ok:false,why:'short injury, move him to IL instead',t};
  if(inj==='mid') return low && !ilOpen?{ok:true,why:tierWord(t)+' out 2 to 6 weeks with no IL spot open',inj:true,t}:{ok:false,why:'out 2 to 6 weeks, keep him on IL',t};
  if(inj==='long') return low?{ok:true,why:tierWord(t)+' out more than 6 weeks',inj:true,t}:(t==='mid' && !ilOpen && kind!=='stream')?{ok:true,why:'a mid round pick out more than 6 weeks with no IL spot open',inj:true,t}:{ok:false,why:'out a while, keep him on IL',t};
  if(low && kind==='stream' && recentAdds(ctx).has(d.id)) return {ok:false,why:'added in the last 7 days, not dropped for a stream',t};
  if(low) return {ok:true,why:tierWord(t),t};
  if(kind==='stream') return {ok:false,why:tierWord(t)+', never dropped for a stream',t};
  if(t==='mid'){ const sl=slumpOf(ctx,d); if(sl.on) return {ok:true,why:'a mid round pick who is slumping, '+sl.why.join(' and '),t}; }
  return {ok:false,why:tierWord(t)+', protected',t}; }
// proof that a free agent is for real. Two weeks of real production, more minutes than before, or filling in for an injured starter
const proofOf=p=>(p.gp>=6 && p.g14>=4 && p.v14!=null && p.v14>=p.val-1) || p.role==='up' || !!p.fill;
// your own drops from the last 7 days are never suggested back to you
function myRecentDrops(ctx,sign){ const out=new Set(), now=Date.parse(ctx.now.date+'T12:00:00Z'), sg=sign||'-';
  (ctx.scan.tx||[]).forEach(t=>{ if(String(t[1])!==ME) return; const m=String(t[0]).match(/^([A-Za-z]{3})(\d{1,2})$/); if(!m) return; const mo=MON.indexOf(m[1]); if(mo<0) return;
    const d=Date.parse((mo>=7?seasonYear():seasonYear()+1)+'-'+String(mo+1).padStart(2,'0')+'-'+String(+m[2]).padStart(2,'0')+'T12:00:00Z'); if(now-d>7*864e5) return;
    String(t[2]||'').split(',').forEach(x=>{ if(x[0]===sg) out.add(x.slice(1)); }); });
  return out; }
// a player you added in the last 7 days is never churned for a stream
const recentAdds=ctx=>ctx._radd||(ctx._radd=myRecentDrops(ctx,'+'));
function pickups(ctx){
  const mine=ctx.ros[ME], prot=myProtected(ctx), days=ctx.pdays; let opp=ctx.popp, standIn=false;
  // no matchup set yet, as in the fantasy playoffs, so measure against the strongest other team
  if(!opp || !ctx.ros[opp]){ opp=Object.keys(ctx.ros).filter(t=>t!==ME).sort((a,b)=>ctx.base[b].week-ctx.base[a].week)[0]||null; standIn=!!opp; }
  const out={list:[],note:'',adds:addsLeft(ctx,ctx.pwk),free:0,ilMove:null,week:ctx.pwk,opp,standIn};
  out.wait=Math.round((new Date(ctx.addDay+'T12:00:00Z')-new Date(ctx.now.date+'T12:00:00Z'))/864e5);
  if(!opp || !days.length){ out.note='No games left to add for.'; return out; }
  const active=mine.filter(p=>!isIL(p)); out.free=Math.max(0,15-active.length);
  const ilUsed=mine.filter(isIL).length; const ilCand=active.filter(p=>isOut(p)); if(ilUsed<2 && ilCand.length) out.ilMove=ilCand[0];
  const drops=active.filter(p=>!prot.has(p.id) && !(out.ilMove&&p===out.ilMove));
  const act=ctx.pact;
  const opT=weekProj(ctx,ctx.ros[opp],opp,days,act);
  // a new player only counts from the first day he can play, today for a free agent, the day he clears for a waiver player
  const split={};
  const mk=(ros,start)=>{ let sp=split[start]; if(!sp) sp=split[start]={post:days.filter(d=>d>=start),preT:totalsOver(mine,days.filter(d=>d<start),pNow,ctx.fillW,ctx.dayW).T};
    const r=totalsOver(ros,sp.post,pNow,ctx.fillW,ctx.dayW); const rest=sumT(sp.preT,r.T); const a=act&&act[ME]; return {tot:a?sumT(a,rest):rest,rest,ug:r.ug}; };
  const base=mk(mine,ctx.addDay), bp=catProbs(base,opT,ctx.u,ctx.up), bw=pWin5(bp), bwW=pWin5(wPr(bp,WP));
  out.base={probs:bp,win:bw};
  const myCn=active.filter(isC).length, pl=planOf(), b0p=planWeekOf(ctx,ctx.view0.prs,pl,false), rts=routeSets(pl); out.plan=pl;
  // the rest of season lift, with your daily lineups set again for the changed roster, so a player who cannot get into your lineup adds little.
  // It is counted the way the game plan counts cats, so the punt earns nothing here. The week part below uses the real scoreboard against that week's opponent
  const rosLift=(inP,outP)=>{ const T=scaleT(seasonTotals(ctx,ME,outP?[outP]:[],[inP]),1/ctx.tweeks), v=myView(ctx,T); return {g:100*(planWeekOf(ctx,v.prs,pl,false)-b0p),ds:v.per.map((x,c)=>100*(x-ctx.view0.per[c]))}; };
  // a player who is out can still be worth keeping, but only when the news gives a return date. He is never a stream
  const mineGone=myRecentDrops(ctx);
  const cands=ctx.avail.filter(p=>p.proj && p.team && (!isOut(p) || p.ret) && !mineGone.has(p.id));
  const openSpot=out.free>0 || !!out.ilMove;
  // an IL spot nobody is using or about to use, counting every out player of yours who is not on IL yet. An out free agent goes there, so nothing is dropped until he is back.
  // Failing that, an open roster spot or a pending IL move of your own lets you add him without a drop for now
  const ilOpen=ilUsed+ilCand.length<2, noDrop=ilOpen||openSpot;
  const rows=[];
  for(const c of cands){
    const wd=waiverDate(c.fa), start=wd&&wd>ctx.addDay?wd:ctx.addDay; const gl=days.filter(d=>d>=start&&playsOn(c.team,d)).length;
    let best=null;
    if(isOut(c)){
      // the season lift is counted with the player he would replace once he is back. With an IL spot open the week costs nothing, without one the drop costs its games this week
      for(const d of drops){
        if(isC(d) && !isC(c) && myCn<=3) continue;
        // the player he replaces once he is back has to be a drop your rules allow, even when no drop is needed today
        const dk=dropOK(ctx,d,'long',ilOpen); if(!dk.ok) continue;
        const lr=rosLift(c,d); let gW=0, gWt=0, pr=bp, use=0;
        if(!noDrop){ const t=mk(mine.filter(p=>p!==d).concat([c]),start); pr=catProbs(t,opT,ctx.u,ctx.up); gW=100*(pWin5(wPr(pr,WP))-bwW); gWt=100*(pWin5(pr)-bw); use=t.ug.get(c.id)||0; }
        // he has no week of his own, so the score is the whole rest of season lift, less 40 percent of what a drop costs that week when one is needed now.
        // A stash is a season move. Scored on the 40 and 60 split of a normal keep, one week of a bench player's games would hide a star who is back in two weeks
        const g=0.4*gW+lr.g;
        if(!best || g>best.g) best={drop:noDrop?null:d,later:d,stash:ilOpen,gW,gWt,gR:lr.g,g,kind:'hold',pr,use,ds:lr.ds,dropWhy:noDrop?null:dk};
      }
      // marking the add puts him on IL when that is the plan, or moves your own out player there first when that is what opens the spot
      if(best) rows.push(Object.assign({p:c,gl:0,wd,il:best.stash?c.id:(!best.drop && !out.free && out.ilMove)?out.ilMove.id:null,away:true},best));
      continue;
    }
    const opts=openSpot?[null]:drops;
    for(const d of opts){
      if(d && isC(d) && !isC(c) && myCn<=3) continue; // never drop below three centers
      const ros=mine.filter(p=>p!==d && !(out.ilMove && !out.free && p===out.ilMove)).concat([c]);
      const t=mk(ros,start), pr=catProbs(t,opT,ctx.u,ctx.up), gW=100*(pWin5(wPr(pr,WP))-bwW), gWt=100*(pWin5(pr)-bw);
      const lr=rosLift(c,d), gR=lr.g;
      // a stream still costs the player you drop for good, so any rest of season loss counts in full against it. A stream may win the week, never at the cost of the season
      const hold=0.4*gW+0.6*gR, stream=0.85*gW+Math.min(0,gR);
      // the drop rules. A stream may only drop a late pick or a pickup, a long term add follows the full rules
      let okH=true, okS=true, dk=null; if(d){ const kh=dropOK(ctx,d,'long',ilOpen), ks=dropOK(ctx,d,'stream',ilOpen); okH=kh.ok; okS=ks.ok; dk=kh.ok?kh:ks; }
      const g=Math.max(okH?hold:-Infinity, okS?stream:-Infinity); if(!isFinite(g)) continue;
      if(!best || g>best.g) best={drop:d,gW,gWt,gR,g,kind:(okH && (hold>=stream || !okS))?'hold':'stream',pr,use:t.ug.get(c.id)||0,ds:lr.ds,dropWhy:dk};
    }
    if(!best) continue;
    rows.push(Object.assign({p:c,gl,wd,il:(!best.drop && !out.free && out.ilMove)?out.ilMove.id:null},best));
  }
  rows.sort((a,b)=>b.g-a.g);
  // out players ride along with the 40 best fit players. They never push one out and never count as a similar player sitting there
  const top=rows.filter(r=>!r.away).slice(0,40).concat(rows.filter(r=>r.away).slice(0,10));
  const urgent=mine.filter(p=>prot.has(p.id) && (isOut(p)));
  for(const r of top){
    const p=r.p, b=p.b; let need=100*(1-Math.exp(-Math.max(0,r.g)/3.5)); const why=[];
    if(p.role==='up'){ need+=6; why.push('minutes are up'); } else if((p.m14||0)>=28 || (p.gp<3 && p.mpNoDepth>=28)){ need+=4; why.push('steady starter minutes'); }
    if(p.v14!=null && p.g14>=3 && p.role!=='up' && p.v14-p.val>4){ need-=6; why.push('hot stretch without extra minutes'); }
    r.josh=0; if(b && b.josh){ const yr=p.cur||p.pre||200; if(yr-b.josh>=25){ need+=6; r.josh=1; } else if(b.josh-yr>=30){ need-=6; r.josh=-1; } }
    if(b && (b.upside||b.gem)) need+=3;
    r.cover=null; for(const u of urgent){ if(u.pos.some(x=>p.pos.includes(x))){ need+=8; r.cover=u; break; } }
    const sim=r.away?0:top.filter(o=>o!==r && !o.away && o.g>=0.8*r.g && r.g>0.3).length; r.sim=sim; if(sim>=4) need-=8; else if(sim>=2) need-=4;
    // a waiver date that has already passed means he has cleared and is a free agent
    if(r.wd && r.wd<=ctx.now.date) r.wd=null;
    r.waiver=!!r.wd || p.fa==='W'; if(r.waiver) need-=6;
    if(out.adds<=0) need-=20; else if(out.adds===1 && ctx.pdays.length>=4) need-=4;
    if(out.wait>2) need-=Math.min(15,3*(out.wait-2));
    { const bd=r.away?r.later:r.drop; r.bal=balance(ctx,bd?[bd]:[],[p]); } need*=r.bal.mult;
    r.need=clamp(Math.round(need),0,99);
    const dc=r.pr.map((x,c)=>100*(x-bp[c])); r.dc=dc;
    const bestCat=dc.map((v,c)=>[v,c]).sort((a,b)=>b[0]-a[0])[0];
    // what the pickup is for. A card can carry both labels. Stream for games when the week alone moves by 2 points or more or the score came from the week,
    // Keep long term when your season gets better with him or the score came from the hold reading
    r.pure=!r.away && !r.cover && r.kind==='stream' && r.gR<0.2;
    // the label of the reading that gave the score is always there, so the chips never disagree with the words on the card
    r.labels=[]; if(!r.away && (r.gW>=2 || r.kind==='stream')) r.labels.push('Stream for games'); if(r.gR>=0.3 || r.kind==='hold') r.labels.push('Keep long term');
    r.tag=r.away?(r.stash?'Stash on IL':'Out for now'):r.cover?'Covers an injury':(!r.pure&&b&&(b.upside||b.rookie)&&r.gW<0.5)?'Stash for upside':('Boosts '+CATS[bestCat[1]]);
    r.early=r.pure && out.wait>3; if(r.early) r.need=Math.min(r.need,60);
    // the tag cut. Full for a stream, half for a keep, and scaled down for a player ranked inside the top 140. A cut that rounds to under 1 percent is no cut
    r.need0=r.need; r.cut0=tagCut(p); r.share=rankShare(p.seenRank); r.cut=r.cut0*r.share*(r.kind==='stream'?1:0.5); if(Math.round(100*r.cut)<1) r.cut=0; if(r.cut>0) r.need=clamp(Math.round(r.need*(1-r.cut)),0,99);
    // Vikas's rules for the top band. A pure stream tops out at 80. Must add needs a season lift of 1 or more, no loss this week, and proof in real games
    // or a new role, except when it replaces a long term injury. Nothing but an injury fill in reaches it in the first two weeks of the season
    // an injury fill in, either the drop is hurt long term or the add uses the IL spot of a player out 2 weeks or more
    const ilc=(!r.drop && r.il && out.ilMove && r.il===out.ilMove.id)?injClass(ctx,out.ilMove):'';
    r.proof=proofOf(p); r.injRep=!!(r.dropWhy && r.dropWhy.inj) || ilc==='mid' || ilc==='long' || ilc==='season'; const early=ctx.wk.n<=2;
    if(r.kind==='stream' && !(r1(r.gR)>=PICKNOW)) r.need=Math.min(r.need,80);
    r.mustOK=!r.away && r1(r.gR)>=PICKNOW && r.gW>=0 && (r.injRep || (!early && r.proof));
    if(!r.mustOK) r.need=Math.min(r.need,84);
    r.band=r.need>=85?'must':r.need>=65?'strong':r.need>=50?'helps':'skip';
    // a pickup only counts as building the plan when the season, counted the plan's way, really gets better with him on the roster
    const lifts=r.gR>=0.3; r.routes=lifts?rts.filter(R=>pickFits(R,r.ds)):[]; r.built=lifts?pl.build.filter(c=>r.ds[c]>=0.7).sort((x,y)=>r.ds[y]-r.ds[x]):[];
    r.why=why;
  }
  // an out player has to score 50 or more to be listed at all
  out.list=top.filter(r=>r.g>0.05 && !(r.away && r.need<50)).sort((a,b)=>b.need-a.need||b.g-a.g).slice(0,14);
  return out;
}
/* the waiver wire, the longer term view. A claim takes days to clear and a free agent you add is meant to stay, so these are scored on the rest of the
   season only, counted the way your plan counts cats, so your punt earns nothing. This week's games do not count here, that is the Pickups tab.
   Every player on waivers right now is shown, even one who does not help, with who dropped him and when, so nothing is left out without a word */
const WPICK=1.0;
function waivers(ctx){
  const mine=ctx.ros[ME], prot=myProtected(ctx), active=mine.filter(p=>!isIL(p)), free=Math.max(0,15-active.length);
  const ilUsed=mine.filter(isIL).length, ilOpen=ilUsed+active.filter(p=>isOut(p)).length<2, mineGone=myRecentDrops(ctx);
  const drops=active.filter(p=>!prot.has(p.id) && dropOK(ctx,p,'long',ilOpen).ok), myCn=active.filter(isC).length, pl=planOf(), b0p=planWeekOf(ctx,ctx.view0.prs,pl,false);
  const lift=(inP,outP)=>{ const T=scaleT(seasonTotals(ctx,ME,outP?[outP]:[],[inP]),1/ctx.tweeks), v=myView(ctx,T); return {g:100*(planWeekOf(ctx,v.prs,pl,false)-b0p),ds:v.per.map((x,c)=>100*(x-ctx.view0.per[c]))}; };
  // the newest drop of each player in the league's transaction lines, which come newest first
  const by={}; (ctx.scan.tx||[]).forEach(t=>String(t[2]||'').split(',').forEach(x=>{ if(x[0]==='-'){ const id=x.slice(1); if(!by[id]) by[id]={team:String(t[1]),day:String(t[0])}; } }));
  const cands=ctx.avail.filter(p=>p.proj && p.team && (!isOut(p) || p.ret) && !mineGone.has(p.id));
  const rows=[];
  for(const c of cands){
    let best=null;
    for(const d of (free>0?[null]:drops)){ if(d && isC(d) && !isC(c) && myCn<=3) continue; const l=lift(c,d); if(!best || l.g>best.gR) best={drop:d,gR:l.g,ds:l.ds}; }
    if(!best) continue;
    const wd0=waiverDate(c.fa), wd=wd0 && wd0>ctx.now.date?wd0:null, onW=!!wd || c.fa==='W';
    const r=Object.assign({p:c,wd,waiver:onW,by:by[c.id]||null},best); r.dropWhy=best.drop?dropOK(ctx,best.drop,'long',ilOpen):null;
    let need=100*(1-Math.exp(-Math.max(0,r.gR)/3.5)); const b=c.b; r.josh=0;
    if(b && b.josh){ const yr=c.cur||c.pre||200; if(yr-b.josh>=25){ need+=6; r.josh=1; } else if(b.josh-yr>=30){ need-=6; r.josh=-1; } }
    r.cut=tagCut(c)*rankShare(c.seenRank)*0.5; if(Math.round(100*r.cut)<1) r.cut=0; if(r.cut>0) need*=1-r.cut;
    r.need=clamp(Math.round(need),0,99); r.band=r.gR>=1.5?'strong':r.gR>=0.7?'helps':r.gR>=0.3?'small':'none';
    r.built=r.gR>=0.3?pl.build.filter(k=>r.ds[k]>=0.7).sort((x,y)=>r.ds[y]-r.ds[x]):[];
    r.hurt=pl.lock.concat(pl.build).filter(k=>r.ds[k]<=-0.7);
    rows.push(r);
  }
  // the call on each player. Pick up now only when the season lift is worth a roster spot and does not hang on minutes he has not shown yet.
  // A player with no real games yet who is not a starter on the depth chart is tested again at lower minutes, to find the minutes he needs.
  // If he clears the bar even at 18 minutes the minutes do not matter. Otherwise the card says Watch and names the minutes to look for
  const setMp=(p,mp)=>{ const o=p.proj, f=mp/o.mp, q={}; for(const k in o) q[k]=typeof o[k]==='number'?o[k]*f:o[k]; q.mp=mp; p.proj=q; return o; };
  for(const r of rows){ const p=r.p; r.need=null;
    if(r1(r.gR)<WPICK){ r.call='skip'; continue; }
    if(isOut(p)){ r.call='watch'; r.watch='back'; continue; }
    const shown=(p.g14>=3 && p.m14!=null) || p.ds===0;
    if(shown || !(p.proj.mp>18)){ r.call='pick'; continue; }
    let need=null; const o=p.proj;
    try{ for(let mp=18; mp<=Math.ceil(o.mp); mp+=2){ setMp(p,Math.min(mp,o.mp)); if(lift(p,r.drop).g>=WPICK){ need=Math.min(mp,Math.ceil(o.mp)); break; } p.proj=o; } } finally { p.proj=o; }
    if(need!=null && need<=18) r.call='pick'; else { r.call='watch'; r.watch='mins'; r.need=need||Math.ceil(o.mp); }
  }
  // a pick up now also needs proof in real games or a new role, unless it replaces a long term injury. Nothing else in the first two weeks
  const early=ctx.wk.n<=2;
  for(const r of rows){ if(r.call!=='pick') continue; const inj=!!(r.dropWhy && r.dropWhy.inj); if(inj) continue; if(early){ r.call='watch'; r.watch='early'; } else if(!proofOf(r.p)){ r.call='watch'; r.watch='proof'; } }
  const order={pick:0,watch:1,skip:2};
  rows.sort((a,b)=>order[a.call]-order[b.call] || b.gR-a.gR);
  // players on waivers who cannot be scored still get a line, so you can see the site looked at them
  const inC=new Set(cands), skipped=ctx.avail.filter(p=>!inC.has(p) && !mineGone.has(p.id) && ((waiverDate(p.fa)||'')>ctx.now.date || p.fa==='W')).map(p=>({p,by:by[p.id]||null,why:/^NA$/i.test(p.status||'')||!p.team?'is not with an NBA team right now':isOut(p)?'is out with no return date in the news':'has no projection yet'}));
  return {plan:pl,free,skipped,onW:rows.filter(r=>r.waiver),longer:rows.filter(r=>!r.waiver && r.gR>=0.3).slice(0,10),n:cands.length};
}
/* trade chips. A free agent whose stock is rising, picked up to hold for a week or two and use in a trade, even when he does not fit the plan.
   Six parts, weighted the way Vikas set them on Oct 21. The spike 25, his track record over the last two seasons 20, his role and how long it lasts 20,
   market heat on Yahoo 15, how many managers in the league would pay for him 10, and what he does for you while you hold him 10.
   One game counts 40 percent of a spike, two 60, three 80, four 90 and five or more in full, so one hot night cannot carry a player.
   The drop follows the stream rules, so only a late pick or a waiver pickup that was not just added, never a protected player */
const CHW={spike:25,track:20,role:20,heat:15,appeal:10,fit:10};
const SAMPLE=[0,0.4,0.6,0.8,0.9,1];
let SEASONRANK=null;
function seasonRanks(){ if(SEASONRANK) return SEASONRANK; const one=(P,minG)=>{ const r={}; if(!P) return r; Object.keys(P.p).map(k=>[k,P.p[k]]).filter(x=>Array.isArray(x[1]) && x[1][0]>=minG).map(x=>[x[0],valOf(lineOfPrior(x[1]))]).sort((a,b)=>b[1]-a[1]).forEach((x,i)=>{ r[x[0]]=i+1; }); return r; };
  SEASONRANK={last:one(D.prior,15),two:one(D.prior2,15)}; return SEASONRANK; }
const seasonLine=(P,k)=>{ const a=P&&(P.p[k]||P.p[PALIAS[k]]); return Array.isArray(a)?a:null; };
function chips(ctx){
  const mine=ctx.ros[ME], prot=myProtected(ctx), active=mine.filter(p=>!isIL(p)), ilOpen=mine.filter(isIL).length+active.filter(p=>isOut(p)).length<2, gone=myRecentDrops(ctx);
  const drops=active.filter(p=>!prot.has(p.id) && dropOK(ctx,p,'stream',ilOpen).ok), myCn=active.filter(isC).length, pl=planOf(), b0p=planWeekOf(ctx,ctx.view0.prs,pl,false);
  const lift=(inP,outP)=>{ const T=scaleT(seasonTotals(ctx,ME,outP?[outP]:[],[inP]),1/ctx.tweeks), v=myView(ctx,T); return 100*(planWeekOf(ctx,v.prs,pl,false)-b0p); };
  const R=seasonRanks(), prevQ=(D.prev&&D.prev.q)||{}, day=ctx.addDay, now=ctx.now.date;
  const cands=ctx.avail.filter(p=>p.proj && p.team && !isOut(p) && !gone.has(p.id) && p.gp>=1);
  const rows=cands.map(p=>{ const k=B.nkey(p.name), why={};
    // the spike, real games against what he was expected to do
    const w=SAMPLE[Math.min(5,p.gp||0)], base=p.prior?p.prior.mp:p.proj.mp;
    const sv=(p.v14!=null && p.g14>=1)?clamp((p.v14-p.val)/5,0,1):0, sm=(p.m14!=null && p.g14>=1)?clamp((p.m14-base)/8,0,1):0;
    const spike=w*(0.7*sv+0.3*sm);
    // track record, his best of the last two seasons by rank, from games he actually played
    const l1=seasonLine(D.prior,k), l2=seasonLine(D.prior2,k), r1s=R.last[k]||R.last[PALIAS[k]]||null, r2s=R.two[k]||R.two[PALIAS[k]]||null;
    const best=Math.min(r1s||999,r2s||999), track=best<999?clamp((220-best)/180,0,1):0.3;
    // role, the depth chart, more minutes, filling in for a starter, and the news
    let role=p.ds===0?1:p.ds===1?0.6:p.ds===2?0.35:p.ds==null?0.3:0.15; if(p.role==='up') role+=0.25; if(p.fill) role+=0.25;
    if(p.news && !p.news.pre && p.news.dir==='good') role+=0.1; if(p.news && !p.news.pre && p.news.dir==='bad') role-=0.25; role=clamp(role,0,1);
    // market heat, his Yahoo rank this season and whether more teams are picking him up
    const pct=p.pct||0, pq=prevQ[p.id], pct0=Array.isArray(pq)?(pq[1]||0):pct;
    // Yahoo's own rank for this season is noise for the first few games and lags a night behind, so it counts only from his third game
    const heat=0.4*(p.cur && p.gp>=3?clamp((150-p.cur)/140,0,1):0)+0.3*clamp(pct/50,0,1)+0.3*clamp((pct-pct0)/8,0,1);
    // who in the league would pay for him. A manager who counts waiver pickups as nothing is never a buyer
    const z=zLine(p.proj), buyers=[]; if(MG) Object.keys(MG.teams).forEach(t=>{ const m=MG.teams[t]; if(m.noLate) return; let sc=0; if(m.needPos.some(x=>p.pos.indexOf(x)>=0)) sc++; if(m.needCats.some(c=>z[c]>0.5)) sc++; if(m.dislike.indexOf(k)>=0) sc=0; if(sc>0) buyers.push(m.name); });
    const general=clamp((p.proj.pts-8)/14,0,1), appeal=0.5*general+0.5*(MG?Math.min(1,buyers.length/2):0.5);
    const pre=CHW.spike*spike+CHW.track*track+CHW.role*role+CHW.heat*heat+CHW.appeal*appeal;
    return {p,k,spike,track,role,heat,appeal,buyers,pre,l1,l2,r1s,r2s,best,pct,pct0,w}; });
  rows.sort((a,b)=>b.pre-a.pre);
  const top=rows.slice(0,12);
  for(const r of top){ let best=null; for(const d of drops){ if(isC(d) && !isC(r.p) && myCn<=3) continue; const g=lift(r.p,d); if(!best || g>best.g) best={d,g}; }
    // a waiver claim can first play the day he clears, not tonight
    const wd=waiverDate(r.p.fa); r.wd=wd && wd>now?wd:null; r.day=r.wd && r.wd>day?r.wd:day;
    r.drop=best?best.d:null; r.gR=best?best.g:null; r.tom=playsOn(r.p.team,r.day);
    r.fit=clamp(0.7*clamp(((r.gR==null?-1.5:r.gR)+1.5)/3,0,1)+(r.tom?0.3:0),0,1);
    r.score=Math.round(r.pre+CHW.fit*r.fit);
    const hot=r.spike>=0.35 || r.heat>=0.5;
    // a chip that costs your season more than 2 points to hold is a trade piece at best, never a grab tonight
    r.costly=r.gR!=null && r.gR<-2;
    r.call=(r.score>=60 && hot && r.drop && !r.costly)?'grab':r.score>=45?'watch':'pass';
    r.bail=Math.max(20,Math.round((r.p.m14||r.p.proj.mp)-3)); }
  top.sort((a,b)=>b.score-a.score);
  return {list:top.filter(r=>r.call!=='pass').slice(0,3),all:top,hasMg:!!MG,day}; }
function addsLeft(ctx,week){ const L=D.league, wk=week||ctx.wk, tx=ctx.scan.tx||[]; let used=0;
  tx.forEach(x=>{ if(x[1]!==ME) return; const m=String(x[0]).match(/^([A-Za-z]{3})(\d{1,2})$/); if(!m) return; const mo=MON.indexOf(m[1]); if(mo<0) return; const d=(mo>=7?seasonYear():seasonYear()+1)+'-'+String(mo+1).padStart(2,'0')+'-'+String(+m[2]).padStart(2,'0'); if(d>=wk.start && d<=wk.end) used+=(String(x[2]).match(/\+/g)||[]).length; });
  // an add you marked counts the same way a scanned one does, only when its day falls inside that week
  used+=ST.marks.filter(m=>m.type==='add' && (m.day?(m.day>=wk.start && m.day<=wk.end):(wk.n===ctx.wk.n && ctx.now.date>=wk.start))).length; return Math.max(0,(L.adds||4)-used); }

/* trades */
/* trades. The scoring of every fair offer is the slow part, so it runs in background workers when the browser allows it, one or more opponents to each worker.
   If workers are not available the same scoring runs on the page itself, pausing often so the page still answers taps. Both paths run the very same code */
function tradeEnv(ctx,pl){
  const today=ctx.now.date, pt=planTable(ctx,pl), routes=routeSets(pl), w=ctx.myW, v0=ctx.view0, per0=v0.per, fav0=v0.fav;
  // your gain is the change in your chance to win five or more cats in an average week, counted the way the plan counts cats. The pivot number counts bonus and low cats in full
  const basePlan=planWeekOf(ctx,v0.prs,pl,false), basePiv=planWeekOf(ctx,v0.prs,pl,true);
  // the cats that must hold. Your locks, and once enough build cats are on target, those too
  const guard=pl.lock.concat(pt.set?pl.build.filter(c=>per0[c]>=TARGET):[]);
  // a guarded cat is broken when it ends under its floor. One that is already under its floor is broken when it falls further
  const hit=(c,pa,fa)=>(per0[c]>=FLOOR && fav0[c]>=FAVMIN)?(pa<FLOOR || fa<FAVMIN):(pa<per0[c]-0.005);
  const shapeOk=d=>{ if(!routes.length || pt.set) return true; for(const R of routes) if(fitsRoute(R,d)) return true; return pl.build.every(c=>d[c]>=-1); };
  const mine=ctx.ros[ME].filter(p=>p.proj && !NEVER.has(B.nkey(p.name)) && !(HOLD[B.nkey(p.name)] && today<HOLD[B.nkey(p.name)]));
  return {today,pt,routes,w,v0,per0,fav0,basePlan,basePiv,guard,hit,shapeOk,mine,spotV:0,pin:''};
}
// An open roster spot is worth something on its own, and you can open one any day by dropping your least useful player for a streamer.
// So a two for one is credited only for what it adds beyond that, whoever the two outgoing players are
function spotValue(ctx,pl,env){ let b=0; ctx.ros[ME].forEach(p=>{ const k=B.nkey(p.name); if(!(p.proj && !isIL(p) && !NEVER.has(k) && !(HOLD[k] && env.today<HOLD[k]))) return;
  const T=scaleT(seasonTotals(ctx,ME,[p],[]),1/ctx.tweeks); TK.forEach(q=>T[q]+=ctx.stream[q]); b=Math.max(b,100*(planWeekOf(ctx,myView(ctx,T).prs,pl,false)-env.basePlan)); }); return b; }
const combos2=(arr,k)=>{ if(k===1) return arr.map(x=>[x]); const o=[]; for(let i=0;i<arr.length;i++) for(let j=i+1;j<arr.length;j++) o.push([arr[i],arr[j]]); return o; };
// by Josh's overall ranks, do you give up clearly more than you get. Such a deal is never shown, so it is not scored either
const joshSide=(give,get)=>{ const gJ=dw(give.map(p=>p.jv)), rJ=dw(get.map(p=>p.jv)), j=rJ-gJ; return j<-Math.max(6,0.2*gJ)?'lose':j>Math.max(4,0.15*Math.max(gJ,rJ))?'win':'even'; };
function* scoreOffers(ctx,pl,env,opps){
  const {w,per0,basePlan,basePiv,guard,hit,shapeOk,pt}=env, gives={1:combos2(env.mine,1),2:combos2(env.mine,2)}, out=[]; let seen=0;
  const clock=()=>(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now(); let t0=clock();
  const viewOf=prs=>{ const per=new Array(9).fill(0), fav=new Array(9).fill(0); let weekN=0; for(const x in prs){ const pr=prs[x]; weekN+=w[x]*pWin5(pr); for(let c=0;c<9;c++){ per[c]+=w[x]*pr[c]; if(pr[c]>0.5) fav[c]++; } } return {per,fav,weekN}; };
  for(const o of opps){
    const their=ctx.ros[o].filter(p=>p.proj), gets={1:combos2(their,1),2:combos2(their,2)};
    const worst=their.slice().sort((a,b)=>(a.val+14)*(ctx.ug[a.id]||0)-(b.val+14)*(ctx.ug[b.id]||0));
    const myCs=ctx.ros[ME].filter(isCA).length, thCs=ctx.ros[o].filter(isCA).length; let k=0;
    for(const sh of [[1,1],[2,2],[2,1]]){
      for(const give of gives[sh[0]]) for(const get of gets[sh[1]]){
        // it has to look fair to them before anything else. Nothing here asks whether it really helps them.
        // Two checks. Face value, the box score and the name, which is how most managers judge a trade, and the value scale, which also carries the draft and Josh.
        // An offer that would insult them on face value is never scored at all
        const fair=fairOf(give,get); if(!fair.ok && !fair.ask && !fair.str) continue;
        const face=faceOf(give,get); if(face.insult || face.look>face.cap) continue;
        if(myCs-give.filter(isCA).length+get.filter(isCA).length<3) continue;
        if(thCs-get.filter(isCA).length+give.filter(isCA).length<2) continue;
        if(joshSide(give,get)==='lose') continue;
        seen++;
        if(clock()-t0>40){ yield seen; t0=clock(); }
        // every offer that gets this far is scored exactly, with both teams' daily lineups set again for the new rosters. No shortcut decides what is dropped
        const two=sh[0]>sh[1]; let cut=null, credit=0;
        if(two){ cut=worst.find(p=>!get.includes(p))||null; credit=env.spotV; }
        const Tm=scaleT(seasonTotals(ctx,ME,give,get),1/ctx.tweeks); if(two){ const s=ctx.stream; TK.forEach(q=>Tm[q]+=s[q]); }
        // your chance against every other team is known once your side is set. Against this team it can be at most 100 percent, so an offer that cannot reach the bar even then is dropped here
        const prs={}; let sP=0, sV=0;
        for(const x in w){ if(x===o) continue; const pr=catProbs(Tm,ctx.typ[x],ctx.u,ctx.up); prs[x]=pr; sP+=w[x]*pWin5(planPr(pr,ctx.vs0[x],pl,false)); sV+=w[x]*pWin5(planPr(pr,ctx.vs0[x],pl,true)); }
        if(100*(sP+w[o]-basePlan)-credit<0.3 && 100*(sV+w[o]-basePiv)-credit<0.3) continue;
        const To=scaleT(seasonTotals(ctx,o,cut?get.concat([cut]):get,give),1/ctx.tweeks);
        const pro=catProbs(Tm,To,ctx.u,ctx.up); prs[o]=pro;
        const planGain=100*(sP+w[o]*pWin5(planPr(pro,ctx.vs0[o],pl,false))-basePlan)-credit, pivGain=100*(sV+w[o]*pWin5(planPr(pro,ctx.vs0[o],pl,true))-basePiv)-credit;
        if(planGain<0.3 && pivGain<0.3) continue;
        const v=viewOf(prs), dme=v.per.map((x,c)=>100*(x-per0[c]));
        const broke=guard.filter(c=>hit(c,v.per[c],v.fav[c]));
        // On plan means no guarded cat breaks and the trade builds toward a route or at least leaves the build cats alone.
        // A pivot gives up one guarded cat, or leans on a cat the plan counts low. More than one broken cat is a rebuild and only shows at a critical moment.
        // The two numbers above only decide what is kept. A pivot's real gain is worked out later, under the exact plan it would turn into
        let kind=null;
        if(!broke.length){ if(planGain>=0.3 && (shapeOk(dme) || (env.pin && pinKey(o,give,get)===env.pin))) kind='plan'; else if(pivGain>=0.3 && pivGain>planGain+0.5) kind='pivot'; }
        else if(broke.length===1) kind='pivot';
        else if(pt.critical) kind='rebuild';
        if(!kind) continue;
        // listed only when it is fair on face value and the value scale does not call it more than a little light. Anything else is a long shot for the By manager tab.
        // A near miss on both is an opening ask, a place to start talking that you fall back from
        const ok2=face.ok && fair.look>=fair.need-ASKROOM && fair.look<=fair.cap, opening=!ok2 && face.look>=face.need-FACE_ASK && face.look<=face.cap && fair.look>=fair.need-ASKROOM && fair.look<=fair.cap;
        out.push({o,k:k++,give,get,fair,face,ratio:face.look,planGain,pivGain,myGain:kind==='plan'?planGain:pivGain,weekN:v.weekN,per:v.per,fav:v.fav,dme,broke,kind,cut,credit,two,Tm,To,ask:!ok2,str:!ok2 && !opening});
      }
    }
  }
  return {out,seen};
}
let LIVEW=[];
function trades(ctx,done,live){
  LIVEW.forEach(x=>{ try{ x.terminate(); }catch(e){} }); LIVEW=[];
  const pl=planOf(), env=tradeEnv(ctx,pl), {pt,routes,per0,basePlan,guard,hit}=env;
  const res={list:[],pivots:[],routes:[],alt:[],count:0,kept:0,hidden:0,pass:0,base:ctx.base[ME],plan:pl,pt,how:''}; const L=D.league;
  if(L.tradeDeadline && env.today>L.tradeDeadline){ res.note='The trade deadline has passed.'; done(res); return; }
  const opps=Object.keys(ctx.ros).filter(t=>t!==ME);
  const W={}; Object.keys(ctx.ros).forEach(t=>W[t]=oppWeights(ctx,t));
  env.spotV=spotValue(ctx,pl,env); env.pin=(!pl.start && typeof ST.pin==='string')?ST.pin:'';
  let out=[], seen=0;
  // the plan a pivot would turn into, with its own starting point and its own value for an open roster spot. Worked out once for each new plan
  const npc={}; const newPlan=roles=>{ const k=roles.join(','); if(!npc[k]){ const np=mkPlan(roles), base=planWeekOf(ctx,env.v0.prs,np,false); npc[k]={pl:np,base,spot:spotValue(ctx,np,{today:env.today,basePlan:base})}; } return npc[k]; };
  // the full picture for an offer that passed, from the totals already worked out for it
  const exact=t=>{
    const o=t.o, typ=Object.assign({},ctx.typ); typ[ME]=t.Tm; typ[o]=t.To; const so=strength(ctx,o,typ);
    t.oGain=100*(so.week-ctx.base[o].week); t.dop=so.per.map((x,c)=>100*(x-ctx.base[o].per[c])); t.oafter=so.week; t.after=t.weekN;
    const over={}; over[ME]=t.Tm; t.orank=ctx.rank[o].slice(); t.orankA=t.orank.map((r,c)=>rankIn(ctx,o,t.To,c,over));
    const f=flipNet(per0,t.per,pl.w); t.up=f.up; t.dn=f.dn;
    // the cats they are short in. A trade that helps one of those is easier to sell
    const weak=[]; for(let c=0;c<9;c++) if(ctx.base[o].per[c]<0.45 || ctx.rank[o][c]>=7) weak.push(c);
    t.weakHelp=weak.filter(c=>t.dop[c]>=1.5).sort((a,b)=>t.dop[b]-t.dop[a]);
    // their week in each cat before and after, for the sell lines. Percent cats as a share, turnovers as a negative so up is always better
    t.owk=[]; for(let c=0;c<9;c++) t.owk.push([catVal(ctx.typ[o],c),catVal(t.To,c)]);
    // their roster shape before and after. Centers, guards and forwards
    const shp=(f)=>{ const b=ctx.ros[o].filter(f).length; return [b,b-t.get.filter(f).length+t.give.filter(f).length-(t.cut&&f(t.cut)?1:0)]; };
    t.oC=shp(isCA); t.oGd=shp(p=>p.pos.some(x=>x==='PG'||x==='SG'||x==='G')); t.oFw=shp(p=>p.pos.some(x=>x==='SF'||x==='PF'||x==='F'));
    t.built=pl.build.filter(c=>t.dme[c]>=2).sort((a,b)=>t.dme[b]-t.dme[a]); t.spent=guard.filter(c=>t.dme[c]<=-1.5).sort((a,b)=>t.dme[a]-t.dme[b]);
    t.routes=routes.filter(R=>fitsRoute(R,t.dme));
    if(t.kind!=='plan'){ // the plan this trade would turn into. The cat that breaks becomes a swing cat. A low or bonus cat that jumps becomes a build cat
      const nr=pl.roles.slice(); t.broke.forEach(c=>{ nr[c]='swing'; }); let bc=-1, bv=5; for(let c=0;c<9;c++) if((pl.roles[c]==='bonus'||pl.roles[c]==='low') && t.dme[c]>=bv){ bv=t.dme[c]; bc=c; } if(bc>=0) nr[bc]='build'; t.newRoles=nr; t.target=bc;
      // the gain shown for a pivot is the gain under that new plan, the same number you would see after tapping Make this my plan
      const np=newPlan(nr), ov={}; ov[o]=t.To; t.myGain=100*(planWeekOf(ctx,myView(ctx,t.Tm,ov).prs,np.pl,false)-np.base)-(t.two?np.spot:0); }
  };
  const score=t=>{
    const top=t.get.some(p=>(pickOf[B.nkey(p.name)]||99)<=20 || LEGEND.has(B.nkey(p.name))); t.top=top;
    const gJ=dw(t.give.map(p=>p.jv)), rJ=dw(t.get.map(p=>p.jv)); t.josh=rJ-gJ; t.jside=joshSide(t.give,t.get);
    t.bal=balance(ctx,t.give,t.get);
    // how hard the sell is. It starts from how the deal looks to them, gets easier if you give the clearly best player, then gets harder if they give the best player, if you ask for a player they prize,
    // if it does nothing for a cat they are short in, or if they would have to drop someone. Two weak cats helped makes it easier
    // judged on face value, the box score and the name, which is what the other manager actually looks at
    const fc=t.face||faceOf(t.give,t.get); t.face=fc;
    const look=fc.look; let lv=look>=1.06?2:look>=0.99?1:0; if(fc.mine===2) lv++; if(fc.best===2) lv--; if(top) lv--; if(!t.weakHelp.length) lv--; if(t.cut) lv--;
    // helping two cats they are short in only makes the sell easier when the deal does not leave their team clearly worse
    // their change is judged the way the card shows it, to one decimal, so a card never says 5 points under an easy sell chip
    const og=Math.round(10*t.oGain)/10, bonus=t.weakHelp.length>=2 && look>=1.02, was=lv+(bonus?1:0);
    if(bonus && og>-2) lv++;
    // three things hold the tag at a fair ask at best. They are caps, not steps down, so they never stack and push a decent deal to a hard sell.
    // Player for player. When the best player on each side is within 15 percent and they clearly lose the second pair, a manager feels he lost the deal whatever the totals say.
    // Damage. A deal that costs their team 5 points or more is noticed by any manager who checks his cats.
    // Bench swaps. When every player in the deal is bench level the value scale can not tell them apart well, and managers go by their own read
    const gs=t.give.slice().sort((a,b)=>b.fv-a.fv), rs=t.get.slice().sort((a,b)=>b.fv-a.fv); t.sellWhy=[];
    if(gs.length>=2 && rs.length>=2 && Math.max(gs[0].fv,rs[0].fv)<=1.15*Math.min(gs[0].fv,rs[0].fv) && rs[1].fv>=1.25*gs[1].fv) t.sellWhy.push('player for player they lose '+rs[1].name+' for '+gs[1].name);
    if(og<=-5) t.sellWhy.push('the deal costs their team 5 points or more');
    if(t.give.concat(t.get).every(p=>p.mv<=BENCHV && p.fv<(ctx.fvSolid||25))) t.sellWhy.push('every player in it is bench level, where managers trust their own read');
    if(t.sellWhy.length && lv>1) lv=1;
    // the card only gives a reason when these rules are what took the tag down from easy. A deal that was never easy for other reasons says nothing here
    if(!(was>=2 && lv<2)) t.sellWhy=[]; else if(!t.sellWhy.length) t.sellWhy.push('it leaves their team 2 points or more worse');
    t.sell=lv>=2?'easy':lv>=1?'fair':'hard'; t.acc=t.sell==='easy'?0.75:t.sell==='fair'?0.5:0.3;
    t.steal=t.oGain<=-0.5;
    // listed by your gain. A hard sell is marked down by half so it sits lower, a fair ask by 10 percent. Position balance moves the score 5 to 8 percent.
    // Value you hand over beyond an even deal counts a little against a trade, and value you get back beyond it counts a little for it, so of two equal gains the cheaper one leads
    t.over=t.fair.A-t.fair.B; t.score=(t.myGain-0.03*t.over)*(t.sell==='easy'?1:t.sell==='fair'?0.9:0.5)*t.bal.mult;
  };
  // two trades with two different teams, scored together exactly
  const both=(a,b)=>{ const give=a.give.concat(b.give), get=a.get.concat(b.get), k=(a.two?1:0)+(b.two?1:0);
    if(new Set(give.map(p=>p.id)).size!==give.length) return null;
    if(ctx.ros[ME].filter(isCA).length-give.filter(isCA).length+get.filter(isCA).length<3) return null;
    const Tm=scaleT(seasonTotals(ctx,ME,give,get),1/ctx.tweeks); for(let i=0;i<k;i++) TK.forEach(q=>Tm[q]+=ctx.stream[q]);
    const over={}; over[a.o]=a.To; over[b.o]=b.To; const v=myView(ctx,Tm,over);
    if(guard.some(c=>hit(c,v.per[c],v.fav[c]))) return null;
    return {a,b,gain:100*(planWeekOf(ctx,v.prs,pl,false)-basePlan)-k*env.spotV,per:v.per,weekN:v.weekN}; };
  const finish=()=>{
    out.sort((a,b)=>opps.indexOf(a.o)-opps.indexOf(b.o)||a.k-b.k);
    out.forEach(t=>{ exact(t); score(t); });
    const ok=t=>t.jside!=='lose', byScore=(a,b)=>b.score-a.score||b.myGain-a.myGain, byGain=(a,b)=>b.myGain-a.myGain;
    const planAll=out.filter(t=>t.kind==='plan' && !t.ask && ok(t)).sort(byScore), pivAll=out.filter(t=>t.kind!=='plan' && !t.ask && ok(t) && t.myGain>=0.3 && t.newRoles.join()!==pl.roles.join()).sort(byScore);
    // opening asks. Offers that look a little light to them. They are never listed. A card may name one as the place to start
    const askAll=out.filter(t=>t.ask && !t.str && t.kind==='plan' && ok(t) && t.myGain>=0.3).sort(byGain);
    // a weaker version of a deal with the same team. You give at least as much, get no more, and gain no more
    const idl=a=>a.map(p=>p.id), within=(a,b)=>a.every(x=>b.indexOf(x)>=0);
    const beaten=u=>planAll.some(v=>v!==u && v.o===u.o && v.myGain>=u.myGain-0.05 && (v.give.length<u.give.length || v.get.length>u.get.length) && within(idl(v.give),idl(u.give)) && within(idl(u.get),idl(v.get)));
    const bestPlan=planAll.reduce((m,t)=>Math.max(m,t.myGain),0);
    // perTeam caps how many deals one manager can fill. You can only make one deal with him at a time, so the main list spreads across the league
    const pick=(list,max,key,perTeam)=>{ const s2={}, shape={}, team={}, o=[]; for(const t of list){ const k=key(t); if(s2[k]) continue; const sk=t.give.length+'for'+t.get.length; if((shape[sk]||0)>=6) continue; if(perTeam && (team[t.o]||0)>=perTeam) continue; s2[k]=1; shape[sk]=(shape[sk]||0)+1; team[t.o]=(team[t.o]||0)+1; o.push(t); if(o.length>=max) break; } return o; };
    const gk=t=>t.o+'|'+t.get.map(p=>p.id).sort().join('+');
    res.list=pick(planAll.filter(t=>!beaten(t)),14,gk,3);
    // the trade behind the pivot you adopted leads the list, even when its sell is hard or it costs a build cat
    const pinT=env.pin?out.find(t=>t.kind==='plan' && !t.ask && pinKey(t.o,t.give,t.get)===env.pin):null; if(pinT){ pinT.pinned=true; res.list=[pinT].concat(res.list.filter(t=>t!==pinT)).slice(0,14); }
    // a pivot has to beat the best trade that stays on plan by 2 points or more, or it is not worth changing course for
    res.pivots=pick(pivAll.filter(t=>t.myGain>=bestPlan+2),6,t=>t.broke.join('+')+'|'+(t.target==null?'':t.target)+'|'+gk(t));
    res.bestPlan=bestPlan;
    // the routes. For each one, the best trade that stays on plan, the best two trades with two teams scored together, and failing that the best pivot that would open it.
    // A trade is picked for a route by how close it leaves that route's cats to the target, not by gains elsewhere. short is the points still missing, added over the route's cats.
    // It is compared in whole points, so trades that leave a route equally close, or both on target, are split by the bigger gain
    const short=(R,per)=>R.reduce((s,c)=>s+Math.max(0,TARGET-per[c]),0);
    res.routes=routes.map(R=>{ const pp=per=>-Math.round(100*short(R,per)), byProg=(x,y)=>pp(y.per)-pp(x.per)||y.myGain-x.myGain;
      const a=planAll.filter(t=>fitsRoute(R,t.dme)).sort(byProg), b=pivAll.filter(t=>fitsRoute(R,t.dme)).sort(byProg);
      const best=a[0]||null; let pair=null;
      // pairs are tried among the trades that leave this route closest to the target and the ones that gain the most, up to 28 in all
      const pickN=(list,max)=>{ const s2={}, o=[]; for(const t of list){ const k=gk(t); if(s2[k]) continue; s2[k]=1; o.push(t); if(o.length>=max) break; } return o; };
      const top=pickN(a,14); pickN(a.slice().sort(byGain),14).forEach(t=>{ if(top.indexOf(t)<0) top.push(t); });
      for(let i=0;i<top.length;i++) for(let j=i+1;j<top.length;j++){ if(top[i].o===top[j].o) continue; const x=both(top[i],top[j]); if(x && x.gain>=0.3 && fitsRoute(R,x.per.map((p,c)=>100*(p-per0[c]))) && (!pair || pp(x.per)>pp(pair.per) || (pp(x.per)===pp(pair.per) && x.gain>pair.gain))) pair=x; }
      // two trades are shown only when they get the route further than the best single trade, or just as far for a clearly bigger gain
      if(pair && best && !(pp(pair.per)>pp(best.per) || (pp(pair.per)===pp(best.per) && pair.gain>best.myGain+0.3))) pair=null;
      const via=!best && b.length?b[0]:null, g=pair?pair.gain:best?best.myGain:null, perA=pair?pair.per:best?best.per:via?via.per:null;
      return {R,now:R.map(c=>per0[c]),sum:R.reduce((s,c)=>s+per0[c],0),best,pair,via,gain:g,reach:perA?R.map(c=>perA[c]):null,week:g!=null?basePlan+g/100:null,n:a.length,short:short(R,(best||pair)?perA:per0)}; });
    // the leading route is the one that ends closest to the target after its best fair trade or pair of trades. Routes within one point of each other count as tied, and a tie goes to the bigger gain
    let lead=null; res.routes.forEach(r=>{ if(!lead || r.short<lead.short-0.01 || (Math.abs(r.short-lead.short)<=0.01 && (r.gain||0)>(lead.gain||0))) lead=r; });
    res.routes.forEach(r=>{ r.lead=r===lead; }); res.lead=lead?lead.R:null;
    const hurt=ctx.ros[ME].filter(p=>(isOut(p)||p.ret) && p.val>0 && myProtected(ctx).has(p.id));
    // Do this now is rare. It needs an easy sell and either a very large gain or a key player of yours being out
    res.list.forEach((t,i)=>{ t.urgent=i<2 && t.sell==='easy' && (t.myGain>=6 || (hurt.length>0 && t.myGain>=2)); });
    res.list.sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0)||(b.urgent?1:0)-(a.urgent?1:0)||byScore(a,b));
    res.alt=planAll.slice(0,300).concat(pivAll.slice(0,150)); res.asks=askAll.slice(0,400);
    // a bigger ask to open with. One more low tier player from their side, with your least useful player dropped to make room. It is scored exactly like any other trade,
    // with both teams' lineups set again. They are left with an open spot, which is filled with a streamer. Only tried for the trades that are listed, and only for an even swap of players
    // the player you drop to make room follows the same drop rules as a long term pickup, so the keep list, the draft tiers and injuries all hold here too
    const ilOpenT=ctx.ros[ME].filter(isIL).length+ctx.ros[ME].filter(p=>!isIL(p) && isOut(p)).length<2;
    const canGo=p=>{ const k=B.nkey(p.name); return !!p.proj && !isIL(p) && !NEVER.has(k) && !(HOLD[k] && env.today<HOLD[k]) && dropOK(ctx,p,'long',ilOpenT).ok; };
    res.list.forEach(t=>{ t.plus=null; if(t.kind!=='plan' || t.give.length!==t.get.length) return;
      const gi=new Set(t.give.map(p=>p.id)), ge=new Set(t.get.map(p=>p.id));
      const drops=ctx.ros[ME].filter(p=>!gi.has(p.id) && canGo(p)).sort((a,b)=>(a.val+14)*(ctx.ug[a.id]||0)-(b.val+14)*(ctx.ug[b.id]||0)); if(!drops.length) return;
      const myC0=ctx.ros[ME].filter(isCA).length-t.give.filter(isCA).length+t.get.filter(isCA).length, thC=ctx.ros[t.o].filter(isCA).length-t.get.filter(isCA).length+t.give.filter(isCA).length;
      ctx.ros[t.o].filter(p=>p.proj && !ge.has(p.id) && p.mv<=20).sort((a,b)=>b.mv-a.mv).slice(0,8).forEach(x=>{
        // the player you drop is your least useful one that other managers do not value above the player you ask for, or above 10 points of value
        const d=drops.find(p=>p.mv<=Math.max(10,x.mv)); if(!d) return; const myC=myC0-(isCA(d)?1:0);
        if(myC+(isCA(x)?1:0)<3 || thC-(isCA(x)?1:0)<2) return;
        // the bigger ask may look a little light, never insulting. It is the opening, and the listed deal is where you fall back to
        const get=t.get.concat([x]), f=fairOf(t.give,get), fc=faceOf(t.give,get); if(f.look<f.need-ASKROOM || f.look>f.cap || fc.look<fc.need-FACE_ASK) return;
        const Tm=scaleT(seasonTotals(ctx,ME,t.give.concat([d]),get),1/ctx.tweeks), To=scaleT(seasonTotals(ctx,t.o,get,t.give),1/ctx.tweeks); TK.forEach(q=>To[q]+=ctx.stream[q]);
        const over={}; over[t.o]=To; const v=myView(ctx,Tm,over), brk=guard.filter(c=>hit(c,v.per[c],v.fav[c]));
        // a bigger ask may dip one guarded cat up to 3 points under its floor. It then has to gain a full point more, and the card says what it costs
        if(brk.length>1 || (brk.length===1 && v.per[brk[0]]<FLOOR-0.03)) return;
        const gain=100*(planWeekOf(ctx,v.prs,pl,false)-basePlan), soft=brk.length?brk[0]:-1, rate=gain-(soft>=0?50*Math.max(0,FLOOR-v.per[soft]):0);
        if(gain<t.myGain+(soft>=0?1:0.3)) return;
        if(!t.plus || (soft<0 && t.plus.soft>=0) || ((soft<0)===(t.plus.soft<0) && rate>t.plus.rate)) t.plus={x,d,gain,fair:f,face:fc,soft,per:soft>=0?v.per[soft]:null,fav:soft>=0?v.fav[soft]:null,rate}; }); });
    // team by team. For each manager, the fair trades that stay on plan and gain at least a point, ranked by your gain times the chance he says yes.
    // Then the stretch trades, light to him, ranked by your gain alone. Both keep your locks and your three centers
    res.byTeam={}; opps.forEach(o=>{
      // a fair deal that gives more and gets no more than another with the same team is left out. Up to 40 are kept and ranked when the panel is drawn, so loading notes reorders them at once
      const fair=pick(planAll.filter(t=>t.o===o && t.myGain>=1 && !beaten(t)),40,gk);
      const sAll=out.filter(t=>t.o===o && t.ask && t.kind==='plan' && ok(t) && t.myGain>=1).sort(byGain);
      res.byTeam[o]={fair,stretch:pick(sAll,40,gk),nStr:sAll.length}; });
    const kept=out.filter(t=>!t.ask);
    res.pass=res.list.length; res.count=seen; res.kept=kept.length; res.askN=askAll.length; res.basePlan=basePlan; res.spot=env.spotV;
    res.relist=()=>{};
    res.pool=kept.map(t=>t.kind+'|'+t.o+'|'+t.give.map(p=>p.id).join('+')+'|'+t.get.map(p=>p.id).join('+')+'|'+t.myGain.toFixed(4)+'|'+t.oGain.toFixed(4)+'|'+t.planGain.toFixed(4)+'|'+t.pivGain.toFixed(4));
    out.forEach(t=>{ t.Tm=t.To=null; });
    done(res);
  };
  // the slow path, on the page itself. It stops every 40 thousandths of a second so the page can answer a tap. live says whether this run is still the newest one
  const onPage=()=>{ res.how='page'; const it=scoreOffers(ctx,pl,env,opps); const pump=()=>{ if(live && !live()) return; const r=it.next(); if(r.done){ out=r.value.out; seen=r.value.seen; try{ finish(); }catch(e){ failed(e); } } else setTimeout(pump,0); }; setTimeout(pump,0); };
  // the fast path, in background workers. Each one gets a copy of the league and a share of the opponents, and sends back plain numbers with player ids
  const inWorkers=()=>{
    if(typeof Worker==='undefined' || !SELF_SRC || (typeof window!=='undefined' && window.NCW_NO_WORKERS)) return false;
    // the page itself only waits while the workers run, so every core up to four gets one
    const nW=clamp((typeof navigator!=='undefined' && navigator.hardwareConcurrency)||2,1,4), parts=[]; for(let i=0;i<nW;i++) parts.push([]); opps.forEach((o,i)=>parts[i%nW].push(o));
    const nk={}; Object.values(ctx.U).forEach(p=>{ nk[p.name]=B.nkey(p.name); });
    const ws=[]; let left=0, dead=false;
    const stop=()=>{ ws.forEach(x=>{ try{ x.terminate(); }catch(e){} }); };
    const fail=()=>{ if(dead) return; dead=true; stop(); out=[]; seen=0; onPage(); };
    try{ parts.filter(a=>a.length).forEach(part=>{ const wk=new Worker(SELF_SRC); ws.push(wk); LIVEW.push(wk); left++;
        wk.onmessage=e=>{ if(dead) return; if(live && !live()){ dead=true; stop(); return; } const m=e.data; if(!m || m.err || !Array.isArray(m.out)){ fail(); return; }
          seen+=m.seen; for(const t of m.out){ t.give=t.give.map(id=>ctx.U[id]); t.get=t.get.map(id=>ctx.U[id]); t.cut=t.cut?ctx.U[t.cut]:null; if(t.give.some(x=>!x) || t.get.some(x=>!x)){ fail(); return; } out.push(t); }
          if(--left===0){ dead=true; stop(); res.how='workers '+ws.length; try{ finish(); }catch(e2){ failed(e2); } } };
        wk.onerror=()=>fail();
        wk.postMessage({ctx,opps:part,roles:pl.roles,league:D.league,gset:D.gset,nk,pickOf,spotV:env.spotV,pin:env.pin,rules:{never:[...NEVER],hold:Object.assign({},HOLD),keep:[...KEEP]}}); });
    }catch(e){ fail(); }
    return true; };
  if(!inWorkers()) onPage();
}
/* inside a background worker. It only scores offers. It never draws, never reads saved state and never talks to the network */
function workerMain(){
  self.onmessage=e=>{ try{ const m=e.data; Object.assign(NK,m.nk); Object.keys(m.pickOf||{}).forEach(k=>{ pickOf[k]=m.pickOf[k]; }); D.league=m.league; D.gset=m.gset;
      if(m.rules) setRules(m.rules);
      const pl=mkPlan(m.roles), env=tradeEnv(m.ctx,pl); env.spotV=m.spotV; env.pin=typeof m.pin==='string'?m.pin:'';
      const it=scoreOffers(m.ctx,pl,env,m.opps); let r=it.next(); while(!r.done) r=it.next();
      self.postMessage({seen:r.value.seen,out:r.value.out.map(t=>Object.assign({},t,{give:t.give.map(p=>p.id),get:t.get.map(p=>p.id),cut:t.cut?t.cut.id:null}))});
    }catch(err){ self.postMessage({err:String(err&&err.message||err)}); } };
}

/* league table and the race for the top four */
function mulberry(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function race(ctx){
  const L=D.league, tids=Object.keys(ctx.ros), rnd=mulberry(82878), N=3000;
  const P={}; tids.forEach(a=>{ P[a]={}; tids.forEach(b=>{ if(a!==b) P[a][b]=pWin5(catProbs(ctx.typ[a],ctx.typ[b],ctx.u,ctx.up)); }); });
  // the records in the scan stop at the week the scan was taken in. A week that has ended since then is in no record yet, so it is played out here too
  // Each team's wins, losses and ties add up to the weeks already in the records, so the first week still to play is read from the records themselves.
  // That holds when the scan is a day old on a Monday and when Yahoo has named the new week but not yet closed the old one
  const recs=tids.map(t=>{ const x=ctx.teams[t]||{}; return Math.round((x.w||0)+(x.l||0)+(x.t||0)); }), recW=recs.length?recs[0]:0, recOk=recs.every(n=>n===recW) && recW<=ctx.wk.n;
  // Records that run ahead of the calendar, or that differ from team to team, are not a clean one win a week count, so in that case the week named in the scan is used as before
  const w0=recOk?recW+1:((ctx.scan.week && ctx.scan.week<ctx.wk.n)?ctx.scan.week:ctx.wk.n);
  const games=[]; L.weeks.filter(w=>w.n>=w0 && w.n<=(L.lastRegularWeek||18)).forEach(w=>w.games.forEach(g=>{ if(P[g[0]]&&P[g[1]]) games.push(g); }));
  const top4={}, wins={}; tids.forEach(t=>{ top4[t]=0; wins[t]=0; });
  // once the regular season is over the standings are final, so Yahoo's own place decides the first four
  const played=tids.some(t=>{ const x=ctx.teams[t]||{}; return (x.w||0)+(x.l||0)+(x.t||0)>0; });
  const fin=!games.length && played && tids.every(t=>ctx.teams[t] && ctx.teams[t].rank>=1) && new Set(tids.map(t=>ctx.teams[t].rank)).size===tids.length;
  // the model can be wrong about how good a team really is, most of all before games are played, so each simulated season nudges every team up or down
  const sig=0.15+0.55*(1-ctx.wbar), gauss=()=>{ let a=0; for(let k=0;k<6;k++) a+=rnd(); return (a-3)*1.4142; }, lg=x=>Math.log(clamp(x,0.02,0.98)/(1-clamp(x,0.02,0.98)));
  if(fin) tids.forEach(t=>{ const x=ctx.teams[t]; top4[t]=x.rank<=4?N:0; wins[t]=N*((x.w||0)+0.5*(x.t||0)); });
  else for(let i=0;i<N;i++){
    const w={}, e={}; tids.forEach(t=>{ const x=ctx.teams[t]||{}; w[t]=(x.w||0)+0.5*(x.t||0)+rnd()*0.01; e[t]=sig*gauss(); });
    for(const g of games){ const q=1/(1+Math.exp(-(lg(P[g[0]][g[1]])+e[g[0]]-e[g[1]]))); if(rnd()<q) w[g[0]]++; else w[g[1]]++; }
    const ord=tids.slice().sort((a,b)=>w[b]-w[a]); for(let k=0;k<4;k++) top4[ord[k]]++; tids.forEach(t=>wins[t]+=w[t]);
  }
  const rows=tids.map(t=>({tid:t,name:(ctx.teams[t]||{}).name||t,rec:ctx.teams[t]||{},week:ctx.base[t].week,per:ctx.base[t].per,top4:top4[t]/N,wins:wins[t]/N}));
  rows.sort((a,b)=>b.week-a.week); rows.forEach((r,i)=>r.pos=i+1);
  return {rows,left:games.length/5};
}

/* words */
function basisWords(ps){
  const k=new Set(ps.map(p=>p.basis)); const gps=ps.map(p=>p.gp||0); const lo=Math.min.apply(null,gps), hi=Math.max.apply(null,gps);
  if(k.has('blend') || (k.has('now') && (k.has('last')||k.has('est')||k.has('older')))) return 'Based on a blend of last season and this season so far, with '+(lo===hi?lo:lo+' to '+hi)+' games played this season.';
  if(k.size===1 && k.has('now')) return 'Based on this season\'s numbers, '+(lo===hi?lo:lo+' to '+hi)+' games played.';
  // only say Josh shaped the numbers for players he has a rank or a category call for
  const noJ=ps.filter(p=>!(p.b&&p.b.josh) && !p.jcOn);
  // with no games played, say whether his team has played without him, so a player who sat is never described as waiting for opening night
  const tgs=ps.map(teamGames), sat=hi===0 && Math.max.apply(null,tgs)>0;
  let s='Based on last season\'s numbers'+(noJ.length<ps.length?', shaped by Josh Lloyd\'s ranks'+(hasJC()?' and his category calls':''):'')+'.'+(hi>0?' Only '+(lo===hi?lo:lo+' to '+hi)+' game'+(hi===1?'':'s')+' played this season, so last season still carries most of the weight.':sat?(ps.length===1?' He has not played yet this season, though his team has played '+tgs[0]+' game'+(tgs[0]===1?'':'s')+'.':' None of them has played yet this season, though their teams have started.'):' No games have been played this season yet.');
  if(noJ.length) s+=' Josh Lloyd has no rank and no category call for '+listWords(noJ.map(p=>p.name))+'.';
  if(k.has('est')) s+=' Rookie numbers are a preseason estimate.';
  if(k.has('older')) s+=' A player who missed last season uses his most recent full season.';
  return s;
}
// what the depth chart did to a player's numbers, in plain words. Empty when it changed nothing
const spotWord=s=>s===0?'as a starter':s===1?'first off the bench':s===2?'third in line at his spot':'deep on the bench';
function depthLine(p){ const a=[];
  if(p.fill) a.push(p.name+' is next up behind '+p.fill.who.name+', who is out'+(p.fill.who.ret?' until about '+nice(p.fill.who.ret):' with no return date, so this runs for one week and is checked each morning')+'. Until then he is counted at about '+Math.round(p.fill.line.mp)+' minutes a game instead of '+Math.round(p.fill.from)+'.');
  if(p.dep) a.push('ESPN\'s depth chart lists '+p.name+' '+spotWord(p.dep.s)+(p.dsWas!=null && p.dsWas!==p.dep.s && p.dsSince?' since '+nice(p.dsSince):'')+', so his minutes from last season move from about '+Math.round(p.dep.from)+' to '+Math.round(p.dep.to)+' until real games show his role.');
  return a.join(' '); }
const spotShort=p=>p.ds==null?'':p.ds===0?'NBA starter':p.ds<=2?'NBA bench':'NBA deep bench';
const basisChip=p=>p.basis==='now'?'<span class="chip good">This season</span>':p.basis==='blend'?'<span class="chip">Blend, '+p.gp+' games</span>':p.basis==='est'?'<span class="chip warn">Preseason estimate</span>':p.basis==='older'?'<span class="chip warn">Older season</span>':p.basis==='last'?'<span class="chip muted">Last season</span>':'<span class="chip bad">No numbers</span>';
const statusWord=s=>s==='O'||/^OUT$/i.test(s||'')?'out':/^(D|DOUBT|DOUBTFUL)$/i.test(s||'')?'doubtful':s==='IR'?'on injured reserve':s==='INJ'?'injured':s==='Q'?'questionable':s==='GTD'?'a game time call':s==='DTD'?'day to day':s==='P'?'probable':s==='NA'?'not active':s==='SUSP'?'suspended':s==='OFS'?'out for the season':s?'flagged':'';
const catMoves=(dc,min)=>{ const up=[], dn=[]; dc.map((v,c)=>[v,c]).sort((a,b)=>Math.abs(b[0])-Math.abs(a[0])).forEach(x=>{ if(x[0]>=min) up.push(CATWORD[x[1]]); else if(x[0]<=-min) dn.push(CATWORD[x[1]]); }); return {up,dn}; };
const capF=x=>x.charAt(0).toUpperCase()+x.slice(1);
const listWords=a=>a.length<=1?a.join(''):a.slice(0,-1).join(', ')+' and '+a[a.length-1];
/* the cats a trade moves for me. A cat counts when my chance to win it in an average week moves 1.5 points or more. Biggest move first */
const tradeCats=t=>{ const up=[], dn=[]; (t.dme||[]).map((v,c)=>[v,c]).sort((x,y)=>Math.abs(y[0])-Math.abs(x[0])).forEach(x=>{ if(x[0]>=1.5) up.push(x[1]); else if(x[0]<=-1.5) dn.push(x[1]); }); return {up,dn}; };
/* what Josh said about a player's cats, in plain words. The call fades as real games come in, so it is only shown while it still moves the numbers. */
const jcLive=p=>!!(p.jc && p.jcOn && (p.w||0)<0.75);
const jcCall=p=>{ if(!jcLive(p)) return ''; const j=p.jc; return (p.jcMin||j.why0==null)?j.why:j.why0; };
const jcTags=p=>{ if(!p.jc) return ''; const h=(p.jc.help||[]).map(c=>CATS[c]), u=(p.jc.hurt||[]).map(c=>CATS[c]); return h.length&&u.length?'Josh rates his '+h.join(', ')+' and sees him weakest in '+u.join(', '):h.length?'Josh rates his '+h.join(', '):u.length?'Josh sees him weakest in '+u.join(', '):''; };
const jcSay=ps=>{ const a=[]; ps.forEach(p=>{ const c=jcCall(p); if(c) a.push('For '+p.name+', '+c.replace(/^The /,'the ')+'.'); }); return a.join(' '); };
const oneDot=a=>a.map(x=>String(x).replace(/\.\.(?=\s|$)/g,'.'));
const yrank=p=>p.cur||p.pre;
const weekWord=(ctx,wk)=>(wk.n===ctx.wk.n && ctx.now.date>=wk.start)?'this week':'in week '+wk.n;
function pickupWhy(ctx,pk,r){
  const p=r.p, wkWord=weekWord(ctx,pk.week), oppName=(ctx.teams[pk.opp]||{}).name||'your opponent';
  const mv=catMoves(r.dc,1.5); const a=[];
  const wkPlain=wkWord==='this week'?'this week':wkWord, w0=pc(pk.base.win), w1=pc(pk.base.win+r.gWt/100), backIn=!!(r.away && pk.week && p.ret<=pk.week.end);
  let s1;
  if(r.away){ s1=(backIn?'He is due back '+wkPlain+', but no games are counted for him while Yahoo still tags him out. ':'He does not play '+wkPlain+'. ')+(r.drop && w0!==w1?'Dropping '+r.drop.name+' for him moves your chance to beat '+oppName+' from '+w0+' to '+w1+' percent.':'Your chance to beat '+oppName+' stays at '+w0+' percent.'); }
  else { s1='Your chance to beat '+oppName+' '+wkWord+' goes from '+w0+' to '+w1+' percent on normal scoring.';
    if(mv.up.length) s1+=' He helps most in '+listWords(mv.up.slice(0,3))+'.'; if(mv.dn.length) s1+=' It costs a little in '+listWords(mv.dn.slice(0,2))+'.'; }
  s1+=' Over the rest of the season, counted the way your plan counts cats, your average week moves '+(r.gR>=0?'up ':'down ')+Math.abs(r1(r.gR))+' points'+(r.drop?' with '+r.drop.name+' dropped':'')+'.';
  if(r.built.length) s1+=' For the plan he builds '+listWords(r.built.map(c=>CATWORD[c]))+'.';
  if(r.away) s1+=' He is out until about '+niceLong(p.ret)+', so he is a keep and never a stream. He has no week of his own, so the score is the whole rest of season lift, counted from the day he is due back'+(r.drop?', less 40 percent of what the drop costs '+wkPlain:'')+'.';
  else s1+=r.kind==='stream'?' This is a one week add. The score comes from this week alone.':' This is a hold. The score is 40 percent this week and 60 percent rest of season.';
  if(r.cut0>0){ s1+=' He is tagged '+statusWord(p.status)+', so each of his games counts '+tagPct(p)+' percent'+(p.ret?' from '+nice(p.ret)+', the day the news has him back':'')+'.';
    s1+=Math.round(100*r.cut)>=1?' The score is cut a further '+Math.round(100*r.cut)+' percent for the risk that he sits'+(r.kind==='stream'?'':', half of what a stream would lose')+(r.share<1?', and less than usual because he ranks about '+Math.round(p.seenRank):'')+'.':' There is no further cut, because a player ranked about '+Math.round(p.seenRank)+' is worth the wait.'; }
  a.push(s1);
  let s2=r.away?'':'He has '+r.gl+' game'+(r.gl===1?'':'s')+(wkWord==='this week'?' left this week':' '+wkWord)+' and about '+r1(r.use)+' fit in your lineup. ';
  if(r.stash) s2+='He is out, so he belongs on IL and you have a spot open there. If Yahoo still asks for a drop, drop '+r.later.name+', add him, move him to IL and you get the spot back. Once he plays again he would take the place of '+r.later.name+'. ';
  else if(r.drop) s2+='Drop '+r.drop.name+', your least useful player for this. ';
  else if(pk.free) s2+='You have an open roster spot, so no drop is needed'+(r.away?' now. Once he plays again he would take the place of '+r.later.name:'')+'. ';
  else if(pk.ilMove) s2+='Move '+pk.ilMove.name+' to IL first, he is tagged '+statusWord(pk.ilMove.status)+', then no drop is needed'+(r.away?' now. Once he plays again he would take the place of '+r.later.name:'')+'. ';
  if(r.wd) s2+='He is on waivers until '+nice(r.wd)+'. A claim sends you to the back of the waiver line, you are number '+((ctx.teams[ME]||{}).waiver||'?')+' now.';
  else if(r.waiver) s2+='He is on waivers. A claim sends you to the back of the waiver line.';
  else s2+='He is a free agent, so he costs no waiver spot. '+(pk.adds<=0?'You have no adds left for that week, so Yahoo will not take the add.':pk.adds===1?'It would use your last add for that week.':(pk.week && pk.week.n!==ctx.wk.n && !ctx.noAdds && ctx.now.date>=ctx.wk.start)?'Added before week '+ctx.wk.n+' ends, it uses '+(ctx.addsNow===1?'your last add':'one of your '+ctx.addsNow+' adds left')+' for week '+ctx.wk.n+'. Added after that, it uses one of the '+pk.adds+' for week '+pk.week.n+'.':'It uses one of your '+pk.adds+' adds left for that week.');
  if(r.bal.mult>1) s2+=' He also helps your position balance at '+listWords(r.bal.good)+'.'; else if(r.bal.mult<1){ const w=[]; if(r.bal.crowd.length) w.push('he can only play '+listWords(r.bal.crowd)+', where you are already crowded'); if(r.bal.thin.length) w.push('the drop leaves you thin at '+listWords(r.bal.thin)); s2+=' For position balance, '+w.join(' and ')+', so his score is trimmed a little.'; }
  a.push(s2);
  let s3=basisWords([p]); { const dl=depthLine(p); if(dl) s3+=' '+dl; } if(r.josh>0 && p.b) s3+=' Josh has him at '+p.b.josh+', well above his Yahoo rank of '+(yrank(p)||'none')+'.'; if(r.josh<0 && p.b) s3+=' Josh has him at '+p.b.josh+', below his Yahoo rank of '+(yrank(p)||'none')+'.';
  a.push(s3);
  const risk=[]; if(p.status) risk.push('he is tagged '+statusWord(p.status)); if(r.why.includes('hot stretch without extra minutes')) risk.push('his last two weeks look hot but his minutes did not grow'); if(p.role==='down') risk.push('his minutes are down lately'); if(p.dep && p.dep.f<1) risk.push('the depth chart has him in a smaller role than last season'); if(p.fill && p.fill.who.ret) risk.push('part of his score comes from filling in until '+p.fill.who.name+' is back'); if(p.basis==='est') risk.push('he is a rookie with no NBA games'); if(r.sim>=4 && r.band!=='must') risk.push('several similar players are sitting there, so you can wait'); if(r.early) risk.push('his games are more than three days away, so a streaming add can wait until that week');
  a.push(risk.length?'Risk, '+listWords(risk)+'.':'Risk, nothing unusual. Check his news before you add.');
  { const js=jcSay(r.drop?[p,r.drop]:[p]), tg=jcTags(p), jm=(r.drop?[p,r.drop]:[p]).map(joshMove).filter(Boolean).join(' '); a.push(oneDot([((jm?jm+' ':'')+(js?js+' ':'')+(tg?'On '+p.name+', '+tg+'.':'')).trim()])[0]); }
  a.push(newsLine(p));
  return oneDot(a);
}
/* news from the daily scan. Facts come from ESPN's injury feed, the short note is written by hand during the scan */
// a short phrase for the reason ESPN gives, such as a knee issue, an illness or rest
const partWord=x=>{ const w=String(x||'').toLowerCase().trim(); if(!w) return ''; if(w==='rest') return ' for rest'; if(w==='undisclosed') return ' for a reason that was not given'; if(w==='personal') return ' for a personal reason'; if(w==='illness') return ' with an illness'; return ' with '+(/^[aeiou]/.test(w)?'an ':'a ')+w+' issue'; };
const niceLong=iso=>nice(iso)+(iso.slice(0,4)!==String(nowDate().getUTCFullYear())?' '+iso.slice(0,4):'');
function newsLine(p){ const n=p.news; if(!n) return ''; const a=[];
  if(n.st==='Out') a.push('ESPN lists him as out'+partWord(n.part)+(n.ret?', back around '+niceLong(n.ret):'')+'.'+(p.ret?' He is counted as out until then.':''));
  else if(n.st) a.push('ESPN lists him as day to day'+partWord(n.part)+'.');
  if(n.note) a.push((n.pre?'Preseason note. ':'')+String(n.note).replace(/\.+$/,'')+'.'+(n.tagSrc?' Source '+n.tagSrc+(n.tagAt?', '+nice(n.tagAt):'')+'.':''));
  return a.join(' '); }
// games his NBA team has played before the day of the scan, and a short warning for a player you would get who is hurt or has not played
const teamGames=p=>{ const g=D.sched && D.sched.games && D.sched.games[p.team], t=D.scan && Date.parse(D.scan.at); if(!Array.isArray(g) || !isFinite(t)) return 0; const sd=etParts(new Date(t)).date; return g.filter(d=>d<sd).length; };
const getWarn=p=>isIL(p)?p.name+' is on their IL':isOut(p)?p.name+' is out':(!(p.gp>0) && teamGames(p)>0)?p.name+' has not played yet':'';
// an injury status always wins over the tone of a note, so a hurt player is never shown with a green chip. A note from before opening night is shown as preseason news
const newsChip=p=>{ const n=p.news; if(!n) return ''; return n.st==='Out'?'<span class="chip bad">News, out</span>':n.st?'<span class="chip warn">News, day to day</span>':n.pre?'<span class="chip muted">Preseason news</span>':n.dir==='bad'?'<span class="chip bad">News, bad</span>':n.dir==='good'?'<span class="chip good">News, good</span>':n.note?'<span class="chip muted">News</span>':''; };
/* what a trade does for me, in plan words */
function tradeWhy(ctx,t){
  const risk=[]; t.get.forEach(p=>{ if(isIL(p)) risk.push(p.name+' is on their IL'); if(!(p.gp>0) && teamGames(p)>0) risk.push(p.name+' has not played in any of his team\'s '+teamGames(p)+' game'+(teamGames(p)===1?'':'s')); if(p.status) risk.push(p.name+' is tagged '+statusWord(p.status)); if(p.b&&p.b.risk>=2) risk.push(p.name+' carries injury risk'); if(p.basis==='est') risk.push(p.name+' is a rookie estimate'); if(p.age>=AGE0) risk.push(p.name+' is '+p.age+', so he is counted for a few percent fewer games, more by March'); if(p.fvSrc==='two') risk.push(p.name+' missed most of last season, so his minutes are a guess until he plays more. Your gain falls if he plays less than projected'); if(p.dep && p.dep.f<1) risk.push(p.name+' sits lower on the depth chart than his minutes last season'); });
  if(t.top) risk.push('they drafted or prize what you are asking for, so expect a counter'); if(t.cut) risk.push('they would have to drop '+t.cut.name);
  const jm=t.give.concat(t.get).map(joshMove).filter(Boolean).join(' ');
  const js=jcSay(t.give.concat(t.get)), tg=t.get.map(p=>{ const x=jcTags(p); return x?'On '+p.name+', '+x+'.':''; }).filter(Boolean).join(' ');
  const nw=t.get.concat(t.give).map(p=>{ const x=newsLine(p); return x?p.name+'. '+x:''; }).filter(Boolean).join(' ');
  const dw=t.give.concat(t.get).map(depthLine).filter(Boolean).join(' ');
  return {basis:basisWords(t.give.concat(t.get))+(dw?' '+dw:''),risk:oneDot([risk.length?'Risk, '+listWords(risk)+'. Check the news before you send it.':'Risk, nothing unusual. Check the news before you send it.'])[0],josh:oneDot([((jm?jm+' ':'')+(js?js+' ':'')+tg).trim()])[0],news:nw};
}
/* what a trade does for me, all in one place. A short summary, then one line for each cat it moves by 1.5 points or more. Each line holds the change, the before and after,
   and what that means under the plan. A close cat sits between 42 and 58 percent, where a few points decide the week. Swing is kept for the plan role */
function tradeForYou(ctx,t){
  const pl=TR.plan, per=ctx.view0.per, nm=a=>listWords(a.map(p=>p.name)), st=x=>x<0.42?0:x<=0.58?1:2, tc=tradeCats(t);
  const cap1=x=>x.charAt(0).toUpperCase()+x.slice(1), near=x=>Math.abs(x-FLOOR)<0.01?(100*x).toFixed(1):String(pc(x));
  let s='You give '+nm(t.give)+' and get '+nm(t.get)+'. ';
  if(t.kind==='plan'){ s+='Under your plan the gain is '+r1(t.myGain)+(r1(t.myGain)===1?' point.':' points.');
    const nr=routeSets(pl).length; if(t.routes.length && t.routes.length===nr && nr>1) s+=' It moves you along every route.'; else if(t.routes.length) s+=' It moves you along the '+listWords(t.routes.map(routeName).map(x=>x+' route'))+'.'; else if(!t.built.length) s+=' It does not build a route. It firms up the rest of the plan.'; }
  else { const b=t.broke;
    const under=c=>cap1(CATWORD[c])+' goes from '+pc(per[c])+' to '+near(t.per[c])+' percent and you would be favored against '+t.fav[c]+' of 9 teams. '+(t.per[c]<FLOOR?'That is under the floor of '+pc(FLOOR)+' percent.':'That is fewer than the '+FAVMIN+' teams a lock needs.');
    s+=b.length?'This is a pivot. You give up '+listWords(b.map(c=>CATWORD[c]))+' as a guarded cat. '+b.map(under).join(' '):'This is a pivot toward a cat your plan counts low. No lock is given up.';
    if(t.target>=0) s+=' '+cap1(CATWORD[t.target])+' would become a build cat.';
    s+=' Scored under the plan it would turn into, the gain is '+r1(t.myGain)+' points, against '+r1(TR.bestPlan||0)+' for the best trade that stays on your plan today.'; }
  const fb=per.filter(x=>x>0.5).length, fa=t.per.filter(x=>x>0.5).length;
  s+=' On the real nine cat scoreboard your average week goes from '+pc(ctx.view0.weekN)+' to '+pc(t.after)+' percent, and you are favored in '+fb+' of 9 cats now and '+fa+' after.';
  if(t.bal.mult>1) s+=' It helps your position balance at '+listWords(t.bal.good)+'.'; else if(t.bal.mult<1) s+=' It hurts your position balance at '+listWords(t.bal.bad)+'.';
  if(t.o===ctx.opp) s+=' He is also your opponent this week. Yahoo takes about two days to clear a trade, so it barely changes this week\'s matchup, and the gain here is for the rest of the season.';
  if(t.two) s+=' It also opens a roster spot. These numbers assume you fill that spot with a good streamer every week, so the gain is smaller if you leave it empty or fill it poorly.';
  let close=0;
  const row=c=>{ const b=per[c], a=t.per[c], d=t.dme[c], up=d>0, role=pl.roles[c], brk=t.broke.indexOf(c)>=0; let m;
    if(role==='punt') m=up?'Your punt, so the plan gives no credit for it':'Your punt, so the plan does not count the loss';
    else if(brk) m='This is the guarded cat the pivot gives up';
    else if(up){ m=st(b)===1?(close++?'also close':'close, so this is where the trade pays most'):st(b)===0?(a>0.5?'usually a loss, and now you are the favorite':a>=0.42?'usually a loss, and now a real fight':'you are still the underdog there'):'already a strength, so it adds less';
      m=cap1((role==='build'?'build cat, ':role==='lock'?'lock, ':'')+m); if(role==='build' && b<TARGET && a>=TARGET) m+='. It reaches the target of '+pc(TARGET); }
    else if(t.spent.indexOf(c)>=0) m=(role==='lock'?'Lock':'Guarded cat')+', and it stays above the floor of '+pc(FLOOR);
    else { m=st(a)===2?'you stay a clear favorite, so you can afford it':st(a)===1?'watch it, it '+(st(b)===2?'becomes':'stays')+' a close cat':st(b)===0?'you were already losing it, so this costs little':'the real cost, it becomes a cat you usually lose';
      m=cap1((role==='build'?'build cat, ':'')+m); }
    return CATS[c]+' '+(up?'up ':'down ')+Math.abs(r1(d))+', from '+pc(b)+' to '+(brk||t.spent.indexOf(c)>=0?near(a):pc(a))+' percent. '+m+'.'; };
  return {head:oneDot([s])[0],rows:tc.up.map(row).concat(tc.dn.map(row))};
}
/* the blend behind how a player looks, in words, at the league's average games played */
function seenWords(ctx){ const g=Math.round(ctx.avgGP||0), W0=SEENW(seenOf(ctx.avgGP||0)), W={}, n=x=>x;
  // whole percents that add to 100. Each share is rounded down and the points left over go to the shares that were closest to the next whole number
  { const ks=Object.keys(W0); let left=100; ks.forEach(k=>{ W[k]=Math.floor(100*W0[k]+1e-9); left-=W[k]; }); ks.slice().sort((a,b)=>(100*W0[b]-W[b])-(100*W0[a]-W[a])).slice(0,left).forEach(k=>{ W[k]++; }); }
  const late=' A player drafted after pick 80, or not drafted at all, leans less on the draft and more on Josh and Yahoo, fully so from pick 100, because a late pick is one manager\'s reach and not the league\'s view.';
  if(g<1) return 'How a player looks to them is a blend of ranks. Before any games it is this league\'s draft 45 percent, Josh\'s rank 25, last season 20 and Yahoo\'s rank 10.'+late+' From pick 100 on it is Josh 40 and 20 each for the draft, last season and Yahoo. Once games start, this season\'s numbers take a growing share, fastest early. About 17 percent by his 10th game, 30 by his 20th and 40 by his 41st. Games missed count against him.';
  return 'How a player looks to them is a blend of ranks. For a player with '+g+(g===1?' game':' games')+', about the league average today, it is this season '+n(W.cur)+' percent, this league\'s draft '+n(W.draft)+', Josh\'s rank '+n(W.josh)+', last season '+n(W.last)+' and Yahoo\'s rank '+n(W.yahoo)+'.'+late+' It moves with each player\'s own games until his 41st, when it is this season 40, Josh 20, draft 15, last season 15 and Yahoo 10 for everyone. Games missed count against him.'; }
/* how the offer looks from their side, and by Josh's ranks from mine */
function tradeFair(ctx,t){
  const f=t.fair, fc=t.face||faceOf(t.give,t.get);
  let s='Most managers judge a deal by the box score and the name, not by minutes. Going by that, a box score rating that leads with points, then rebounds and assists, they get '+r0(fc.A)+' and give '+r0(fc.B)+'. ';
  s+=fc.look>=1.10?'That looks like a clear win for them.':fc.look>=1.02?'That looks a little in their favor.':fc.look>=0.97?'That looks even.':fc.look>=0.90?'That looks a touch light for them.':'That looks light for them, so expect a no.';
  s+=fc.best===2?' They give the best player in the deal by a wide margin, so the offer has to pay for that.':fc.best===1?' They give the best player in the deal.':fc.mine>=1?' You give the best player in the deal.':' The best player on each side is about the same.';
  s+=' '+t.give.concat(t.get).map(faceWords).join(' ');
  s+=' On the value scale, which also counts this league\'s draft and Josh\'s ranks, they get '+r0(f.A)+' and give '+r0(f.B)+'.';
  const md=t.give.concat(t.get).filter(p=>p.seenWhy&&p.seenWhy.length).map(p=>p.name+' is marked down because '+listWords(p.seenWhy)); if(md.length) s+=' '+md.join('. ')+'.';
  return s;
}
/* by Josh's ranks, for your eyes only. A rank alone does not sell a trade, so it never goes in the pitch */
function tradeJosh(t){ const jr=p=>{ const r=(p.b&&p.b.josh)||p.jr; return p.name+(r?' ('+r+')':' (no Josh rank)'); };
  return 'By Josh\'s overall ranks you give '+listWords(t.give.map(jr))+' and get '+listWords(t.get.map(jr))+'. '+(t.jside==='win'?'By his ranks you get the better side of it.':'By his ranks it is about even.'); }
/* talking points. Every number comes from real stat lines, league ranks or the draft, never from a guess. A point that is not true for this deal is simply left out */
// only a real stat line counts here. This season after 10 games, or a last season of 20 games or more. A line rebuilt from an older season or a blend is not a real line, so no stat sentence is written from it
const rline=p=>{ const r=p.rl; if(!r) return null; if(r.cur && r.gp>=10) return {l:r.cur,b:0}; if(r.prev && r.pb==='last') return {l:r.prev,b:1}; return null; };
const f1=x=>(Math.round(x*10)/10).toFixed(1);
// a deal a plain value check calls even or better for them, that still gains you 2 points or more because of how it fits your build
const fitWin=t=>!!t.face && t.face.ok && t.myGain>=2;
// the season names, from the league's first week, so they roll over by themselves next year
const seasonYear=()=>{ const s=D.league && Array.isArray(D.league.weeks) && D.league.weeks[0] && D.league.weeks[0].start; return s?+s.slice(0,4):2026; };
const seasonLabel=back=>{ const y=seasonYear()-back; return y+' to '+String(y+1).slice(2); };
// one player's face value in words, what a manager sees when he looks him up
function faceWords(p){ const l=p.fvBase, a=[];
  const box=x=>f1(x.pts)+' points, '+f1(x.reb)+' rebounds and '+f1(x.ast)+' assists';
  if(p.fvSrc==='last' && l) a.push(box(l)+' last season'+(p.fvG!=null && p.fvG<60?' in '+p.fvG+' games':''));
  else if(p.fvSrc==='two' && l) a.push(box(l)+' in '+seasonLabel(2)+', since he missed most of last season');
  else a.push('no NBA record to go by, so a projection');
  if(p.rl && p.rl.gp>=1 && p.rl.cur) a.push(box(p.rl.cur)+' a game over '+p.rl.gp+' game'+(p.rl.gp===1?'':'s')+' this season'+(p.fvTrend?', '+p.fvTrend:''));
  else if(p.rl && !(p.rl.gp>=1) && teamGames(p)>0) a.push('no games yet this season');
  if(p.age>=33) a.push('he is '+p.age);
  if(isIL(p) || isOut(p) || p.ret) a.push('he is hurt');
  return p.name+', about '+r0(p.fv)+'. '+capF(listWords(a))+'.'; }
function sellKit(ctx,t){
  const o=t.o, G0=t.give.map(rline), R0=t.get.map(rline), real=G0.every(Boolean) && R0.every(Boolean), pts=[], used=new Set();
  const sum=ls=>{ const T={}; TK.forEach(k=>T[k]=ls.reduce((a,x)=>a+x.l[k],0)); return T; };
  const G=real?sum(G0):null, R=real?sum(R0):null, bs=real?new Set(G0.concat(R0).map(x=>x.b)):null;
  const when=!real?'':bs.size===1?(bs.has(0)?'this season':'last season'):'in the most recent season for each', goBy=!real?'':bs.size===1?'Going by '+(bs.has(0)?'this':'last')+' season\'s numbers':'Going by the most recent season for each player';
  const gN=listWords(t.give.map(p=>p.name)), rN=t.get.length>1?'the '+(t.get.length===2?'two':'players')+' you send':t.get[0].name, n=t.give.length;
  const stat=c=>{ if(!real) return '';
    if(c<2){ const m=c===0?['fgm','fga']:['ftm','fta']; if(!(G[m[1]]>0 && R[m[1]]>0)) return ''; const g=100*G[m[0]]/G[m[1]], r=100*R[m[0]]/R[m[1]]; if(g<r+0.5) return ''; return gN+' shot '+f1(g)+' percent '+(c===0?'from the field ':'at the line ')+when+', against '+f1(r)+' for '+rN+'.'; }
    const k=CK[c-2], g=G[k], r=R[k];
    if(c===8){ if(!(g<r*0.95)) return ''; return gN+' turned it over '+f1(g)+' times a game '+(n>1?'between them ':'')+when+', against '+f1(r)+' for '+rN+'.'; }
    if(!(g>r*1.05)) return ''; return gN+(c===2?' made ':' put up ')+f1(g)+' '+CATWORD[c]+' a game '+(n>1?'between them ':'')+when+', against '+f1(r)+' for '+rN+'.'; };
  // the pitch is about their team. What they get, what their team is already good at, where their numbers go up and how the roster fits. No ranks of players
  // 1. the stars they get, with their real numbers. A star is a player other managers value at 60 or more, about the top 25 in the league
  // a star is a player whose face value is about top 30 in the league
  const fc=t.face||faceOf(t.give,t.get), STAR=ctx.fvStar||42, byMv=t.give.slice().sort((x,y)=>y.fv-x.fv), stars=byMv.filter(p=>p.fv>=STAR), star=byMv[0];
  const lineOf=p=>{ let sl=rline(p); if(!sl && p.fvSrc==='two' && p.fvBase) sl={l:p.fvBase,b:2}; if(!sl) return ''; const l=sl.l, bits=[f1(l.pts)+' points',f1(l.reb)+' rebounds',f1(l.ast)+' assists'], ex=[];
    if(l.tpm>=2.3) ex.push(f1(l.tpm)+' threes'); if(l.stl>=1.4) ex.push(f1(l.stl)+' steals'); if(l.blk>=1.4) ex.push(f1(l.blk)+' blocks');
    return listWords(bits.concat(ex.slice(0,1)))+' a game '+(sl.b===2?'in '+seasonLabel(2):sl.b?'last season':'this season'); };
  let starS='';
  if(stars.length>=2){ starS='You get two stars, '+listWords(stars.map(p=>p.name))+'.'; stars.forEach(p=>{ const l=lineOf(p); if(l) starS+=' '+p.name+' put up '+l+'.'; }); }
  else if(star && (fc.mine>=1 || fc.best<1)){ starS=fc.mine>=1?'You get the best player in the deal, '+star.name+'.':'You get '+star.name+'.'; const l=lineOf(star); if(l) starS+=' He put up '+l+'.'; else if(fc.mine<1) starS=''; }
  else if(star && star.fv>=STAR){ starS='You get '+star.name+' back, a star in his own right.'; const l=lineOf(star); if(l) starS+=' He put up '+l+'.'; }
  if(starS) pts.push(starS);
  // 2. what their team is already good at, and that it stays good there. A cat they send from is spare
  const strong=[]; for(let c=0;c<9;c++) if(t.orank[c]<=3 && t.orankA[c]<=3) strong.push(c); strong.sort((x,y)=>t.orank[x]-t.orank[y]);
  const spare=strong.filter(c=>t.dop[c]<=-1.5);
  const goodAt=c=>c===8?'keeping turnovers low':CATWORD[c];
  let strongS=''; if(strong.length){ const ss=strong.slice(0,3); strongS='Your team is already good at '+listWords(ss.map(goodAt))+(ss.length>1?', top 3 in each,':', top 3 in the league,')+' and stays there after this deal.'+(spare.length?' What you send in '+listWords(spare.slice(0,2).map(c=>CATWORD[c]))+' is extra you can spare.':''); pts.push(strongS); }
  // 3. where their numbers go up. Their place among the ten teams and the change in an average week
  const amt=c=>{ const v=t.owk[c], b0=v[0], a0=v[1]; if(c<2){ const d=100*(a0-b0); return Math.abs(d)<0.1?'':', from '+f1(100*b0)+' to '+f1(100*a0)+' percent'; }
    const d=a0-b0, n=Math.round(Math.abs(d)); if(n<1) return ''; return c===8?', about '+n+' fewer a week':', about '+n+' more a week'; };
  const ups=[]; for(let c=0;c<9;c++){ const d=t.orank[c]-t.orankA[c]; if(d>=1 && t.dop[c]>=1) ups.push([d,c]); }
  ups.sort((x,y)=>y[0]-x[0]||t.dop[y[1]]-t.dop[x[1]]);
  const upS=ups.slice(0,3).map(x=>{ const c=x[1]; return 'Your '+CATWORD[c]+(c===8?' go down':c<2?' goes up':' go up')+'. You move from '+ordW(t.orank[c])+' to '+ordW(t.orankA[c])+' of 10'+amt(c)+'.'; });
  upS.forEach(x=>pts.push(x));
  if(!ups.length){ const lift=[]; for(let c=0;c<9;c++) if(t.dop[c]>=1.5) lift.push(c); if(lift.length) pts.push('It adds to your '+listWords(lift.slice(0,3).map(c=>CATWORD[c]))+', even if your place among the teams stays the same.'); }
  // 4. how the roster fits. Centers first, since managers guard them, then a thin spot it fills
  const cB=t.oC[0], cA=t.oC[1]; let cenS='';
  if(t.get.some(isC)) cenS='You still have '+cA+' center'+(cA===1?'':'s')+' after this, so your big man spots stay covered.'; else if(cA>cB) cenS='You get a center back, so you go from '+cB+' to '+cA+'.';
  if(cenS) pts.push(cenS);
  const thin=[[t.oGd,'guards'],[t.oFw,'forwards']].filter(x=>x[0][0]<=4 && x[0][1]>x[0][0]);
  if(thin.length) pts.push('It fills out your '+thin[0][1]+'. You go from '+thin[0][0][0]+' to '+thin[0][0][1]+'.');
  // 5. true facts about the players they would send
  const rk=[]; t.get.forEach(p=>{ const f=[]; if(p.news && p.news.st==='Out') f.push('is listed as out by ESPN'+(p.news.ret?' until around '+niceLong(p.news.ret):'')); else if(p.status) f.push('is tagged '+statusWord(p.status)); if(p.age>=32) f.push('is '+p.age); if(p.rl && p.rl.pb==='last' && p.rl.lastG<60 && !(p.rl.gp>=10)) f.push('played '+p.rl.lastG+' games last season'); if(p.ds!=null && p.ds>=1 && !p.fill) f.push('comes off the bench on the current depth chart'); if(f.length) rk.push(p.name+' '+listWords(f)); });
  const riskS=rk.length?'I am the one taking on the risk here. '+listWords(rk.slice(0,3))+'.':'';
  if(riskS) pts.push(riskS);
  // 6. the depth chart for what they get. A starter they get, or a backup stepping in for an injured starter
  const dep=t.give.filter(p=>p.ds===0 || p.fill).slice(0,2).map(p=>p.fill?p.name+' is next up while '+p.fill.who.name+' is out':p.name+' starts for '+p.team+' on the current depth chart');
  const depS=dep.length?listWords(dep)+'.':'';
  if(depS) pts.push(depS);
  // 7. why it is fair, in a way they can check. Only said when the value scale really has it even or in their favor
  // the claim about rankings is only made when Josh's ranks agree, so the pitch never promises something a check would not back up
  const fairS=fc.look>=Math.min(0.97,fc.need)?'Going by points, rebounds, assists, steals and blocks a game, this is '+(fc.look>=1.02?'in your favor':'even')+(t.jside==='even'?', and it holds up to the rankings you check it against.':'.'):'';
  if(fairS) pts.unshift(fairS);
  // 8. the cats their team is shortest in that this deal helps
  const shown=ups.slice(0,2).map(x=>x[1]), weakN=(t.weakHelp||[]).filter(c=>shown.indexOf(c)<0), weakS=weakN.length?'It helps where your team is shortest, '+listWords(weakN.slice(0,3).map(c=>CATWORD[c]))+'.':'';
  if(weakS) pts.unshift(weakS);
  if(t.give.length>t.get.length) pts.push('You get two players for one'+(t.cut?', and would drop '+t.cut.name+' to make room':'')+'.');
  // what they will say back
  let push; const worst=t.dop.map((v,c)=>[v,c]).sort((a,b)=>a[0]-b[0])[0];
  const cenP=t.get.some(isC)?' If they balk at giving up a center, remind them they still have '+cA+' after this and point to where their numbers go up.':'';
  if(fc.best>=1){ const bp=t.get.slice().sort((a,b)=>b.fv-a.fv)[0]; push='They will say '+bp.name+' is the best player in the deal. He is, '+(stars.length>=2?'but they get two stars back for him, so sell that and the fit.':'so sell fit and depth, not star power.'); }
  else if(worst[0]<=-2) push='They will point at '+CATWORD[worst[1]]+', where this costs them about '+r0(-worst[0])+' points of win chance. '+(t.orankA[worst[1]]<=3?'They are still '+ordW(t.orankA[worst[1]])+' of 10 there after the deal.':'That cost is real, so lead with what they gain.');
  else push='Expect little pushback. The deal looks even or better from their side and costs them no cat by 2 points or more.';
  push+=cenP;
  // the next offer if they say no. Same team, shares a player you get, looks better to them, still good for you
  const ids=new Set(t.get.map(p=>p.id)); let alt=null;
  (TR.alt||[]).forEach(u=>{ if(u===t || u.o!==o || u.kind!==t.kind || !u.face || u.face.look<fc.look+0.05 || !u.get.some(p=>ids.has(p.id))) return; if(u.give.length!==t.give.length || u.get.length!==t.get.length || u.fair.B>t.fair.B*1.5+5 || u.fair.B<t.fair.B*0.6 || (t.kind!=='plan' && String(u.newRoles)!==String(t.newRoles))) return; if(u.give.map(p=>p.id).sort().join()===t.give.map(p=>p.id).sort().join()) return; if(!alt || u.myGain>alt.myGain) alt=u; });
  const nm=a=>listWords(a.map(p=>p.name));
  // the opening ask. Same team, the same main player each way, you give no more and get no less, it leans your way and gains you more. Start there and fall back to this deal
  let opn=null; if(t.kind==='plan' && !t.ask){ const by=a=>a.slice().sort((x,y)=>y.fv-x.fv)[0].id, tg=by(t.give), tr=by(t.get);
    (TR.asks||[]).forEach(u=>{ if(u.o!==o || u.myGain<t.myGain+0.3 || u.give.length>t.give.length || u.get.length<t.get.length || u.fair.B>t.fair.B*1.5+5 || !u.give.some(p=>p.id===tg) || !u.get.some(p=>p.id===tr)) return; if(!opn || u.myGain>opn.myGain) opn=u; }); }
  const lean=f=>{ const d=Math.round(100*(f.look-1)); return d<=-1?'looks about '+(-d)+' percent light to them':d>=1?'still leans '+d+' percent their way'+(f.best>=1?', less than they will want for giving the best player':''):'looks about even to them'; };
  let openS=opn?'Start higher. Offer '+nm(opn.give)+' for '+nm(opn.get)+' first. It gains you '+r1(opn.myGain)+' points and '+lean(opn.face||opn.fair)+'. If they say no, come back to this deal.':'';
  if(t.plus && (!opn || t.plus.gain>=opn.myGain)) openS='Start higher. Ask for '+t.plus.x.name+' as well, so it is '+nm(t.give)+' for '+nm(t.get.concat([t.plus.x]))+'. You would drop '+t.plus.d.name+' to make room. It gains you '+r1(t.plus.gain)+' points and '+lean(t.plus.face||t.plus.fair)+'.'+(t.plus.soft>=0?' It takes '+CATWORD[t.plus.soft]+' to '+(100*t.plus.per).toFixed(1)+' percent'+(t.plus.fav<FAVMIN?' and favored against '+t.plus.fav+' of 9 teams':'')+', a little under what your plan asks of a guarded cat. Only go this far if you accept that.':'')+' If they say no, come back to this deal.';
  const altS=alt?'If they say no, try '+nm(alt.give)+' for '+nm(alt.get)+' next. It looks better to them and still gains you '+r1(alt.myGain)+' points.':'If they say no, there is no cheap sweetener that keeps this good for you. Let it go.';
  const eyes='By my numbers their average week moves '+(Math.abs(t.oGain)<0.15?'almost nowhere':(t.oGain>0?'up ':'down ')+Math.abs(r1(t.oGain))+' points')+'. '+(t.steal?'It looks fair and makes them worse, so it is a steal if they take it.':t.oGain>=0.3?'It helps them a little too, which makes it easier to defend.':'It is close to neutral for them.')+' Nothing on this page needs their team to get better. '+tradeJosh(t)+(t.sell!=='easy' && t.sellWhy && t.sellWhy.length?' On value alone this would be an easy sell. It is held back because '+listWords(t.sellWhy)+'.':'')+(fitWin(t)?' Fit check. On the box score this is even or in their favor, so a neutral check or an AI will likely call it fair. It wins for you because it fits your build, which a box score does not show.':'');
  const parts={head:'Trade idea. I send you '+nm(t.give)+' for '+nm(t.get)+'.',weak:weakS,star:starS,ups:upS.length?'It bumps your numbers. '+upS.slice(0,2).join(' '):strongS,cen:cenS && t.get.some(isC)?cenS:'',dep:depS,fair:fairS,risk:riskS,end:'Let me know what you think.'};
  const msg=[parts.head,parts.weak,parts.star,parts.dep,parts.ups,parts.cen,parts.fair,parts.risk,parts.end].filter(Boolean).join(' ');
  return {pts:oneDot(pts),push:oneDot([push])[0],alt:oneDot([altS])[0],open:oneDot([openS])[0],eyes:oneDot([eyes])[0],msg:oneDot([msg])[0],parts};
}
function pitchText(ctx,t){ const kit=sellKit(ctx,t), g=mgOf(t); if(!g || !g.m.style) return kit.msg; const P=kit.parts; let a;
  // the same true facts, ordered and trimmed for how this manager likes to be pitched
  if(g.m.style==='simple') a=[P.head,P.weak||P.ups,P.star,P.fair,P.end];
  else if(g.m.style==='cats') a=[P.head,P.weak,P.ups,P.cen,P.star,P.dep,P.risk,P.end];
  else if(g.m.style==='numbers') a=[P.head,P.star,P.ups,P.weak,P.fair,P.risk,P.dep,'Happy to walk through any of the numbers.'];
  else if(g.m.style==='ai') a=[P.head,P.weak,P.star,P.dep,P.ups,P.fair,P.risk,P.fair?'Feel free to run it past an AI or any rankings, the numbers hold up.':'',P.end];
  else a=[P.head,P.fair,P.weak,P.star,P.ups,P.dep,P.risk,P.end];
  return oneDot([a.filter(Boolean).join(' ')])[0]; }

/* drawing */
let CTX=null, CTXW=null, TR=null, PK=null, WV=null, CH=null, WK=null, RACE=null, ERR='', TRUN=0, LITE=false;
function css(){
  if($('mvcss')) return; const s=document.createElement('style'); s.id='mvcss';
  s.textContent='.mvh{font-size:12px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);font-weight:700;margin:14px 0 6px}.mvnone{opacity:.75}.mvsub{display:flex;gap:6px;margin:8px 0 10px}.mvsub .btn.on{background:var(--accent,#2b6cb0);color:#fff;border-color:transparent}.mvlist{margin:6px 0 0 18px;padding:0}.mvlist li{margin:3px 0;font-size:13.5px}.mv{display:flex;flex-direction:column;gap:16px}.mvgrid{display:grid;grid-template-columns:minmax(0,400px) minmax(0,1fr);gap:16px;align-items:start}@media (max-width:1100px){.mvgrid{grid-template-columns:minmax(0,1fr)}}.mvcol{display:flex;flex-direction:column;gap:16px;min-width:0}'
  +'.mvcells{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:8px;margin:10px 0}.mvc{border:1px solid var(--line);border-radius:8px;padding:8px 10px;background:var(--panel-2)}.mvc .k{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);font-weight:600}.mvc .v{font-family:var(--display);font-size:26px;line-height:1.1}.mvc .s{font-size:12px;color:var(--muted)}'
  +'.mvscan{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px;color:var(--muted)}'
  +'.mvcard{border:1px solid var(--line);border-radius:8px;background:var(--panel-2);margin-bottom:8px}.mvcard[open]{border-color:var(--accent)}.mvcard summary{list-style:none;cursor:pointer;padding:10px 12px;display:grid;grid-template-columns:54px minmax(0,1fr);gap:4px 10px;align-items:center}.mvcard summary::-webkit-details-marker{display:none}'
  +'.mvn{font-family:var(--display);font-size:28px;line-height:1;text-align:center;border-radius:8px;padding:6px 0;background:var(--panel);border:1px solid var(--line)}.mvn small{display:block;font-family:var(--body);font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-top:2px}.mvn.must{background:var(--good-bg);color:var(--good);border-color:var(--good)}.mvn.strong{background:var(--accent-soft);color:var(--accent);border-color:var(--accent)}.mvn.helps{background:var(--warn-bg);color:var(--warn)}.mvn.skip{color:var(--muted)}'
  +'.mvt{min-width:0}.mvt b{font-size:15.5px}.mvt .sub{color:var(--muted);font-size:12.5px}.mvt .meta{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px}.mvbody{padding:0 12px 12px;font-size:14px;display:flex;flex-direction:column;gap:8px;border-top:1px dashed var(--line);margin-top:2px;padding-top:10px}.mvbody p{margin:0;max-width:72ch}.mvbody .lab{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);font-weight:700;display:block}'
  +'.mvbody ul{margin:4px 0 0;padding-left:18px;max-width:72ch}.mvbody li{margin:3px 0}.mvbody ul+p{margin-top:4px}.mv .mvskip,.mv .mvmine,.mv .mvtiny{display:none}.mv.showskip .mvskip,.mv.showmine .mvmine,.mv.showsmall .mvtiny{display:block}.mvchk{display:flex;gap:8px;align-items:center;font-size:13px;color:var(--muted);margin-top:10px;cursor:pointer}.mvchk input{width:16px;height:16px;flex:none}.mv .panel h2+h2{margin-top:14px}'
  +'.mvact{display:flex;flex-wrap:wrap;gap:8px}.mvtbl{overflow-x:auto}.mvtbl table{font-size:12.5px}.mvtbl td.num,.mvtbl th.num{text-align:right}.mvme td{background:var(--accent-soft)}.mvjc{color:var(--muted);max-width:46ch;margin-top:2px}.mvnm{min-width:210px}'
  +'.mvrow{display:grid;grid-template-columns:44px minmax(0,1fr) 108px 44px;align-items:center;gap:8px;font-size:13px;margin-bottom:5px}.mvrow .cn{font-family:var(--mono);font-size:12px}.mvrow .tv{font-family:var(--mono);font-size:11.5px;color:var(--muted);text-align:right;white-space:nowrap}.mvrow .pv{font-family:var(--mono);font-size:12px;text-align:right;font-weight:700}'
  +'.mvbig{font-family:var(--display);font-size:44px;line-height:1}.mvbig small{font-family:var(--body);font-size:13px;color:var(--muted);font-weight:500;margin-left:6px}'
  +'.mvscan{flex-wrap:nowrap;align-items:flex-start}.mvscan .ydot{margin-top:5px}.mvteam summary{cursor:pointer;list-style:none}.mvteam summary::-webkit-details-marker{display:none}.mvteam[open] summary b{color:var(--accent)}.mvteam ul{list-style:none;margin:6px 0 2px;padding:0;display:flex;flex-direction:column;gap:2px;font-size:12px}.mvteam li{display:flex;justify-content:space-between;gap:8px}.mvteam li span:last-child{font-family:var(--mono);font-size:11px;color:var(--muted);white-space:nowrap}'
  +'body.moves #quick,body.moves .controls .field,body.moves .controls>.btn,body.moves .score .cells{display:none}';
  document.head.appendChild(s);
}
function scanLine(ctx){
  const sc=ctx.scan, at=new Date(sc.at), age=(nowDate()-at)/36e5;
  const hh=at.getHours(); const when=at.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})+' at '+((hh%12)||12)+'.'+String(at.getMinutes()).padStart(2,'0')+(hh<12?' am':' pm');
  const dot=age<=30?'ok':age<=72?'warn':'bad';
  let basis; if(ctx.wbar<0.02) basis='Numbers are based on last season, shaped by Josh Lloyd\'s ranks'+(hasJC()?' and his category calls':'')+'. No games have been played yet.'; else if(ctx.wbar<0.75) basis='Numbers blend last season with this season so far, about '+r0(ctx.avgGP)+(r0(ctx.avgGP)===1?' game':' games')+' per player.'; else basis='Numbers are based on this season, about '+r0(ctx.avgGP)+' games per player.';
  return '<div class="mvscan"><span class="ydot '+dot+'"></span><span>Yahoo was last scanned '+esc(when)+(age>30?', that is '+(age<48?r0(age)+' hours':Math.floor(age/24)+' days')+' old':'')+'. '+basis+' Every number is a model estimate.</span></div>'
    +(age>48?'<div class="switch" style="margin-top:8px">The last Yahoo scan is '+Math.floor(age/24)+' days old. Rosters, injury tags, pickups and trades below may be out of date. Run a fresh scan before you act on them.</div>':'');
}
let MODE='moves';
function render(){
  css(); if(MODE==='mgr'){ const rm=$('viewMgr'); if(!rm) return; rm.innerHTML=(D.scan&&CTXW?'<div class="mv"><div class="panel">'+scanLine(CTXW)+'</div>'+mgrPage(CTXW)+notesPanel()+'</div>':'<div class="panel"><h2>Trades by manager</h2><p class="empty">'+(D.loading?'Loading the league data.':'Scoring trades.')+'</p></div>'); wire(rm); return; }
  const root=$('viewMoves'); if(!root) return;
  if(D.miss && D.miss.length && !D.loading){ root.innerHTML='<div class="panel"><h2>Pickups and trades</h2><p class="empty">'+(D.miss.length===1?'One data file did not load properly, ':'Some data files did not load properly, ')+esc(D.miss.join(', '))+'. No numbers are shown because they would be wrong without '+(D.miss.length===1?'it':'them')+'. Check your connection and try again.</p><div class="mvact"><button class="btn" id="mvretry" type="button">Try again</button></div></div>'; const b=$('mvretry'); if(b) b.onclick=()=>{ D.miss=null; load(); }; return; }
  if(!D.scan || !D.league || !D.sched){ root.innerHTML='<div class="panel"><h2>Pickups and trades</h2><p class="empty">'+(D.loading?'Loading the league data.':'No Yahoo scan is loaded yet. The daily scan puts it here.')+'</p></div>'; return; }
  const ctx=CTX, wk=WK, pk=PK, me=ctx.base[ME], rc=RACE; const mine=rc.rows.find(r=>r.tid===ME);
  const oppName=ctx.opp?((ctx.teams[ctx.opp]||{}).name||''):'';
  let h='<div class="mv'+(ST.showSkip?' showskip':'')+(ST.showMine?' showmine':'')+(ST.small?' showsmall':'')+'">';
  h+='<div class="panel">'+scanLine(ctx);
  h+='<div class="mvcells">';
  h+='<div class="mvc"><div class="k">Week '+ctx.wk.n+' win chance</div><div class="v">'+(wk?pc(wk.win)+'%':'none')+'</div><div class="s">'+(wk?'vs '+esc(oppName)+(ctx.partial?', days left only':''):'no matchup')+'</div></div>';
  h+='<div class="mvc"><div class="k">'+(ctx.act?'Cats you lead':'Cats you are favored in')+'</div><div class="v">'+(wk?wk.fav:0)+' of 9</div><div class="s">you need 5</div></div>';
  { const pt0=planTable(ctx,planOf()); h+='<div class="mvc"><div class="k">Plan cats on target</div><div class="v">'+pt0.hit+' of '+pt0.of+'</div><div class="s">at '+pc(TARGET)+' percent or better</div></div>'; }
  h+='<div class="mvc"><div class="k">Average week</div><div class="v">'+pc(me.week)+'%</div><div class="s">rest of season, ranks '+mine.pos+' of 10</div></div>';
  h+='<div class="mvc"><div class="k">Top four chance</div><div class="v">'+pc(mine.top4)+'%</div><div class="s">about '+r1(mine.wins)+' wins by week 18</div></div>';
  h+='<div class="mvc"><div class="k">Adds left, week '+ctx.wk.n+'</div><div class="v">'+ctx.addsNow+' of '+(D.league.adds||4)+'</div><div class="s">waiver spot '+((ctx.teams[ME]||{}).waiver||'?')+' of 10'+(pk.week && pk.week.n!==ctx.wk.n?', week '+pk.week.n+' has '+pk.adds+' left':'')+'</div></div>';
  h+='</div>';
  h+='<div class="final">'+goalLine(ctx,wk,pk)+'</div>';
  if(ST.marks.length) h+='<div class="switch" style="margin-top:10px">You marked '+ST.marks.length+' move'+(ST.marks.length===1?'':'s')+' since the last Yahoo scan, so the lists below already count '+(ST.marks.length===1?'it':'them')+'. The next scan replaces this with what Yahoo shows.<div><button class="btn" id="mvundo" type="button">Undo my marked moves</button></div></div>';
  h+='</div>';
  h+=planPanel(ctx,pk);
  h+='<div class="mvgrid"><div class="mvcol">'+weekPanel(ctx,wk)+leaguePanel(ctx,rc)+'</div><div class="mvcol">'+pickPanel(ctx,pk)+tradePanel(ctx)+teamPanel(ctx,wk)+notesPanel()+'</div></div>';
  h+='</div>';
  root.innerHTML=h; wire(root);
}
function goalLine(ctx,wk,pk){
  if(!wk) return 'No matchup found for this week.';
  const need=5-wk.fav; const top=pk.list[0];
  // before the week has a score nobody leads anything yet, so the words say favored. A swing cat is the same thing everywhere on this page, a cat between 42 and 58 percent
  const lead=ctx.act?'lead':'are favored in';
  let s=wk.fav>=5?'You '+lead+' '+wk.fav+' of 9 cats against '+esc((ctx.teams[ctx.opp]||{}).name||'')+'. '+(ctx.act?'Hold the lead':'Keep it that way')+' and protect the close ones.':'You '+lead+' only '+wk.fav+' of 9 cats, so you need '+need+' more. Keep adding and trading until this reads 5 or more.';
  const close=wk.probs.map((p,c)=>[Math.abs(p-0.5),c,p]).filter(x=>x[0]<=0.08).sort((a,b)=>a[0]-b[0]).slice(0,3).map(x=>CATS[x[1]]);
  if(close.length) s+=close.length===1?' The close cat is '+close[0]+'.':' The close cats are '+listWords(close)+'.';
  if(top) s+=(ctx.noAdds?' You have no adds left this week. Best pickup for week '+pk.week.n+' is ':' Best pickup now is ')+esc(top.p.name)+' at '+top.need+'.';
  return s;
}
function weekPanel(ctx,wk){
  if(!wk) return '<div class="panel"><h2>This week</h2><p class="empty">No matchup this week.</p></div>';
  const oppName=(ctx.teams[ctx.opp]||{}).name||''; const live=!!ctx.act; const fm=(t,c)=>c===0?(t.fga>0?(100*t.fgm/t.fga).toFixed(1):'0'):c===1?(t.fta>0?(100*t.ftm/t.fta).toFixed(1):'0'):String(r0(t[CK[c-2]]));
  let h='<div class="panel"><h2>Week '+ctx.wk.n+' vs '+esc(oppName)+' <span>'+nice(ctx.wk.start)+' to '+nice(ctx.wk.end)+'</span></h2>';
  h+='<div class="mvbig">'+pc(wk.win)+'%<small>chance to win 5 or more cats'+(ctx.partial?' over the days left':'')+', about '+r1(wk.exp)+' cats expected</small></div>';
  if(ctx.partial) h+='<div class="switch">The last scan holds no score for this week, so the days already played are missing. These numbers cover only the games from '+nice(ctx.from)+' on and are not the real state of the week. Run a fresh scan to see it.</div>';
  h+='<p class="small">'+(live?'Live score from the scan plus the games still to come. ':ctx.partial?'Projected totals for the days left. ':'Projected totals for the week. ')+'Your lineup has '+r0(wk.me.rest.s)+(r0(wk.me.rest.s)===1?' player start ':' player starts ')+(live||ctx.partial?'left':'planned')+', theirs has '+r0(wk.op.rest.s)+'.</p>';
  wk.probs.forEach((p,c)=>{ const col=p>=0.5?'var(--good)':'var(--bad)'; const w=Math.abs(p-0.5)*100; const left=p>=0.5?50:50-w;
    h+='<div class="mvrow"><span class="cn">'+CATS[c]+'</span><span class="bar"><span class="mid"></span><span class="fill" style="left:'+left+'%;width:'+w+'%;background:'+col+'"></span></span><span class="tv">'+fm(wk.me.tot,c)+' vs '+fm(wk.op.tot,c)+'</span><span class="pv" style="color:'+col+'">'+pc(p)+'</span></div>'; });
  h+='<p class="small">The number on the right is your chance to win that cat. Green means you are ahead.</p></div>';
  return h;
}
/* the Long term sub tab, real waiver claims and the best long term free agents */
function wavCard(ctx,r){
  const p=r.p, pl=WV.plan, cats=r.ds.map((v,c)=>[v,c]).filter(x=>Math.abs(x[0])>=0.3 && !pl.punt.includes(x[1])).sort((a,b)=>Math.abs(b[0])-Math.abs(a[0])).slice(0,5);
  const word=r.call==='pick'?'pick up now':r.call==='watch'?'watch':'skip';
  const tr=(TR && TR.list || []).slice(0,3).find(t=>r.drop && t.give.some(x=>x.id===r.drop.id));
  const by=r.by?(ctx.teams[r.by.team]||{}).name||'a team':'';
  const day=r.by?r.by.day.replace(/^([A-Za-z]{3})(\d+)$/,'$1 $2'):'';
  let does='Your average week for the rest of the season goes '+(r.gR>=0?'up ':'down ')+r1(Math.abs(r.gR))+' points, counted the way your plan counts cats.';
  does+=cats.length?' The cats that move most over the season are '+cats.map(x=>CATS[x[1]]+' '+updn(x[0])).join(', ')+'.':' No plan cat moves by much.';
  let call;
  if(r.call==='pick') call='Pick him up now'+(r.wd?'. Put in a claim today and he joins you when he clears on '+nice(r.wd)+'.':'. He is a free agent, so he joins you right away.');
  else if(r.call==='watch' && r.watch==='mins') call='Not yet. '+(p.gp>0?'He has played only '+p.gp+' game'+(p.gp===1?'':'s')+' this season, about '+Math.round(p.m14!=null?p.m14:p.proj.mp)+' minutes a game,':'He has no real games this season')+' and is not a starter, so his minutes are still a guess. Pick him up if he plays '+r.need+' minutes or more a game over his next two or three games. Below that he is not worth the spot.'+(p.ds!=null && p.ds>=1 && r.need>(p.m14!=null?p.m14:p.proj.mp)+4?' That is well above what he is playing, so it is unlikely while the players ahead of him are healthy.':'');
  else if(r.call==='watch' && r.watch==='early') call='Not yet. It is the first two weeks of the season, so there are not enough real games to trust anyone yet. If he keeps this up through week 2 he becomes a pick up now.';
  else if(r.call==='watch' && r.watch==='proof') call='Not yet. He has not shown it in real games. Pick him up once he has two weeks of production at this level, or his role grows.';
  else if(r.call==='watch') call='Not yet. He is out'+(p.ret?' until about '+nice(p.ret):'')+'. Pick him up a few days before he is due back, so he does not take a roster spot while he sits.';
  else call=r.gR>=0.3?'Skip. He helps your season a little, but not enough to give up a roster spot for.':'Skip. He does not make your season better.';
  const costs=r.drop?'You drop '+r.drop.name+' for him, the drop that leaves your season best'+(r.dropWhy&&r.dropWhy.why?'. He can go because he is '+r.dropWhy.why:'')+'.'+(tr?' '+r.drop.name+' is also in one of your top trades, '+tr.give.map(x=>x.name).join(' and ')+' for '+tr.get.map(x=>x.name).join(' and ')+', so dropping him ends that deal.':''):WV.free?'You have an open roster spot, so no drop is needed.':'No drop is needed.';
  const claim=r.wd?'He clears waivers on '+nice(r.wd)+'. A claim puts you at the back of the waiver line, you are number '+((ctx.teams[ME]||{}).waiver||'?')+' now.':r.waiver?'He is on waivers. A claim puts you at the back of the waiver line.':'He is a free agent, so he needs no claim and can play right away.';
  const news=(p.news&&p.news.note?p.news.note:'')+(isOut(p)&&p.ret?(p.news&&p.news.note?' ':'')+'He is out now and counted from about '+nice(p.ret)+', when he is due back.':'');
  return '<details class="mvcard'+(r.call==='skip'?' mvnone':'')+'"><summary><span class="mvn '+(r.call==='pick'?'must':r.call==='watch'?'helps':'skip')+'">'+bsg(r.gR)+'<small>'+word+'</small></span><span class="mvt"><b>'+esc(p.name)+'</b> <span class="sub">'+esc(p.team)+', '+esc(p.pos.join(' '))+(r.drop?', drop '+esc(r.drop.name):'')+'</span>'
    +'<span class="meta"><span class="chip muted">Season '+updn(r.gR)+'</span>'+(r.built.length?'<span class="chip gem">Builds '+r.built.map(c=>CATS[c]).join(' ')+'</span>':'')+(r.hurt.length?'<span class="chip bad">Hurts '+r.hurt.map(c=>CATS[c]).join(' ')+'</span>':'')
    +(r.wd?'<span class="chip warn">Waiver claim, clears '+nice(r.wd)+'</span>':r.waiver?'<span class="chip warn">Waiver claim</span>':'<span class="chip good">Free agent</span>')
    +(r.call==='watch'&&r.watch==='mins'?'<span class="chip warn">Needs '+r.need+' minutes</span>':'')+(r.call==='watch'&&r.watch==='early'?'<span class="chip warn">Too early to tell</span>':'')+(r.call==='watch'&&r.watch==='proof'?'<span class="chip warn">Needs real games</span>':'')+(tr&&r.call!=='skip'?'<span class="chip bad">Ends a trade</span>':'')
    +(isOut(p)&&p.ret?'<span class="chip warn">Back about '+nice(p.ret)+'</span>':'')    +(r.by?'<span class="chip muted">Dropped by '+esc(by)+' '+esc(day)+'</span>':'')+newsChip(p)+(r.josh>0?'<span class="chip gem">Josh likes him</span>':'')+(p.status?'<span class="chip bad">'+esc(statusWord(p.status))+'</span>':'')+'</span></span></summary>'
    +'<div class="mvbody"><p><span class="lab">Why him</span>'+esc(whyHim(ctx,p,r.ds,call))+'</p><p><span class="lab">What to do</span>'+esc(call)+'</p><p><span class="lab">What it does for your season</span>'+esc(does)+'</p><p><span class="lab">What it costs</span>'+esc(costs)+'</p><p><span class="lab">How you get him</span>'+esc(claim)+'</p>'
    +(r.by?'<p><span class="lab">Who dropped him</span>'+esc(by+' dropped him on '+day+'.')+'</p>':'')+(news?'<p><span class="lab">News</span>'+esc(news)+'</p>':'')
    +(r.call==='pick'?'<div class="mvact"><button class="btn" type="button" data-add="'+esc(p.id)+'" data-drop="'+esc(r.drop?r.drop.id:'')+'" data-il="">I made this add</button></div>':'')+'</div></details>';
}
/* a trade chip card */
function chipCard(ctx,r){
  const p=r.p, n1=v=>Math.round(v), sl=(l,lab,rk)=>l?lab+' '+l[0]+' games, '+r1(l[1])+' minutes, '+r1(l[7])+' points, '+r1(l[6])+' threes, '+r1(l[8])+' rebounds, '+r1(l[9])+' assists'+(rk?', rank '+rk+' that season':'')+'.':lab+' no NBA games on file.';
  const word=r.call==='grab'?'grab tonight':r.call==='watch'?'watch':'pass';
  const g14=p.g14||0, s14=p.v14!=null?(p.v14>=p.val?'above':'below'):'';
  let now='He has '+(p.gp||0)+' game'+(p.gp===1?'':'s')+' this season'+(p.m14!=null?', playing about '+n1(p.m14)+' minutes':'')+(s14?', '+s14+' what he was expected to do':'')+'. A spike from '+(p.gp||0)+' game'+(p.gp===1?'':'s')+' counts '+Math.round(100*r.w)+' percent, so one hot night cannot carry him.';
  let trend=''; if(r.r1s && r.r2s) trend=r.r1s<r.r2s-25?' He was better last season than the year before, so the trend is up.':r.r2s<r.r1s-25?' He was better two seasons ago, so last season was a dip and he has shown more before.':' His last two seasons were about the same level.';
  const track=sl(r.l2,'2024 to 25,',r.r2s)+' '+sl(r.l1,'2025 to 26,',r.r1s)+trend;
  const role=(p.ds===0?'He starts on the depth chart.':p.ds===1?'He is first off the bench at his spot.':p.ds!=null?'He is deeper on the bench.':'He is not on the depth chart.')+(p.role==='up'?' His minutes are up.':'')+(p.fill?' He is filling in for '+p.fill.who.name+', who is out.':'')+(p.news&&p.news.note?' '+p.news.note:'');
  const mkt='Yahoo has him at '+(p.cur||'no')+' in its rank for this season and '+r.pct+' percent rostered'+(r.pct>r.pct0?', up from '+r.pct0+' at the last scan, so other managers are noticing':'')+'.';
  const buy=!CH.hasMg?'Load the manager notes in this browser to see which managers would pay for him.':r.buyers.length?'Managers whose needs he fits, '+r.buyers.join(', ')+'.':'No manager in the notes needs what he does right now. A manager who counts waiver pickups as nothing is never counted.';
  const hold=(r.gR==null?'There is no drop allowed by your rules, so he cannot be added without breaking them.':'While you hold him your season goes '+(r.gR>=0?'up ':'down ')+r1(Math.abs(r.gR))+' points with '+r.drop.name+' dropped.')+(r.wd?' He is on waivers until '+nice(r.wd)+(r.tom?' and plays that day.':' and does not play that day.'):(r.tom?' He plays on '+nice(r.day)+', the first day an add can play.':' He does not play on '+nice(r.day)+'.'));
  const what=r.call==='grab'?(r.wd?'Put in a claim tonight before another manager does, he clears on '+nice(r.wd):'Pick him up tonight before another manager does')+(r.drop?', dropping '+r.drop.name:'')+'. Shop him once he keeps it up. If he plays under '+r.bail+' minutes a game over his next 3 games, drop him and move on.':r.call==='watch'?(r.costly?'Not yet, and only as a trade piece. Holding him costs your season '+r1(-r.gR)+' points, so he is worth adding only with a buyer lined up.':'Not yet. Check again after his next game. If he keeps the minutes and the production, he becomes a grab.'):'Pass.';
  const parts=[['Spike',r.spike,CHW.spike],['Track record',r.track,CHW.track],['Role',r.role,CHW.role],['Market',r.heat,CHW.heat],['Buyers',r.appeal,CHW.appeal],['Fit',r.fit,CHW.fit]].map(x=>'<span class="chip muted">'+x[0]+' '+Math.round(x[1]*x[2])+' of '+x[2]+'</span>').join('');
  return '<details class="mvcard"><summary><span class="mvn '+(r.call==='grab'?'must':r.call==='watch'?'helps':'skip')+'">'+r.score+'<small>'+word+'</small></span><span class="mvt"><b>'+esc(p.name)+'</b> <span class="sub">'+esc(p.team)+', '+esc(p.pos.join(' '))+(r.drop?', drop '+esc(r.drop.name):'')+'</span>'
    +'<span class="meta"><span class="chip gem">Trade chip</span>'+(r.wd?'<span class="chip warn">Waiver claim, clears '+nice(r.wd)+'</span>':p.fa==='W'?'<span class="chip warn">Waiver claim</span>':'<span class="chip good">Free agent</span>')+parts+'</span></span></summary>'
    +'<div class="mvbody"><p><span class="lab">What to do</span>'+esc(what)+'</p><p><span class="lab">This season</span>'+esc(now)+'</p><p><span class="lab">Track record</span>'+esc(track)+'</p><p><span class="lab">Role</span>'+esc(role)+'</p><p><span class="lab">Market</span>'+esc(mkt)+'</p><p><span class="lab">Who might buy</span>'+esc(buy)+'</p><p><span class="lab">While you hold him</span>'+esc(hold)+'</p>'
    +(r.call==='grab'&&r.drop?'<div class="mvact"><button class="btn" type="button" data-add="'+esc(p.id)+'" data-drop="'+esc(r.drop.id)+'" data-il="">I made this add</button></div>':'')+'</div></details>';
}
/* the Trade chips tab. Free agents and waiver claims whose stock is rising. Each card says plainly which one he is */
function chipPage(ctx){
  let h='<p class="small">Players you can add whose stock is rising, worth grabbing before another manager does and holding for a trade, even when they do not fit your plan. Most are free agents you can add right away. A waiver claim is marked on his card with the day he clears. The score out of 100 adds up the spike in real games 25, track record over the last two seasons 20, role 20, market heat on Yahoo 15, managers who would pay for him 10, and what he does for you while you hold him 10. Grab tonight needs 60 or more, a real spike or a hot market, and a drop your rules allow.</p>';
  if(!CH || !CH.list.length) h+='<p class="empty">No trade chip worth chasing right now.</p>'; else CH.list.forEach(r=>{ h+=chipCard(ctx,r); });
  return h; }
function wavPage(ctx){
  if(!WV) return '<p class="empty">Waivers load with the pickups.</p>';
  let h='<p class="small">These are longer term adds. A waiver claim takes days to clear, so this week\'s games count for nothing here. Each player is scored only on the rest of the season, counted the way your plan counts cats, so your punt earns nothing. The number is how many points your average week goes up with him in place of the drop that leaves your season best. Every card ends in one call. Pick up now means do it today. Watch means he is worth it only once something happens, the card says what, either real minutes or his return from injury. Skip means he is not worth a roster spot. Pick up now needs a season lift of '+r1(WPICK)+' or more, and a player with no real games who is not a starter has to clear that bar at 18 minutes, or he is a Watch. Drops follow your rules. Your top 8 players, Kyrie, your keep list (Rui for now) and picks from rounds 1 to 12 are not dropped here, unless a mid round pick is slumping or out long with no IL spot, or anyone is out for the season. In the first two weeks of the season only an injury replacement can be a pick up now, since there are too few real games to trust.</p>';
  h+='<h3 class="mvh">On waivers now</h3>';
  if(!WV.onW.length && !WV.skipped.length) h+='<p class="empty">Nobody is on waivers right now.</p>'; else WV.onW.forEach(r=>{ h+=wavCard(ctx,r); });
  WV.skipped.forEach(x=>{ h+='<p class="small">'+esc(x.p.name)+' is also on waivers'+(x.by?', dropped by '+esc((ctx.teams[x.by.team]||{}).name||'a team')+' '+esc(x.by.day.replace(/^([A-Za-z]{3})(\d+)$/,'$1 $2')):'')+', but he '+x.why+', so he is not scored.</p>'; });
  h+='<h3 class="mvh">Best long term adds from free agents</h3>';
  if(!WV.longer.length) h+='<p class="empty">No free agent lifts your season by 0.3 points or more right now.</p>'; else WV.longer.forEach(r=>{ h+=wavCard(ctx,r); });
  return h;
}

/* why him. The full read on a player before you add him. Both seasons, this season so far, the trend, his minutes, his spot on the depth chart,
   what he does for your plan, and one plain verdict. Every number comes from the stat files or the scan */
function whyHim(ctx,p,ds,verdict){ const a=[], k=B.nkey(p.name), l1=priorOf(p.name), l2=seasonLine(D.prior2,k);
  const box=(x,g,mp)=>f1(x[7])+' points, '+f1(x[8])+' rebounds, '+f1(x[9])+' assists, '+f1(x[6])+' threes and '+f1(x[10])+' steals'+(mp?' in '+r0(mp)+' minutes':'')+(g?' over '+g+' games':'');
  a.push(l1?'Last season '+box(l1,l1[0],l1[1])+'.':'No NBA games last season.');
  if(l2) a.push('The season before '+box(l2,l2[0],l2[1])+'.');
  const c=p.rl && p.rl.cur;
  if(c && p.rl.gp>=1) a.push('This season '+f1(c.pts)+' points, '+f1(c.reb)+' rebounds and '+f1(c.ast)+' assists a game in '+r0(c.mp)+' minutes over '+p.rl.gp+' game'+(p.rl.gp===1?'':'s')+'.');
  else a.push(teamGames(p)>0?'No games yet this season, though his team has played '+teamGames(p)+'.':'No games yet this season.');
  if(p.fvTrend) a.push('Trend, '+p.fvTrend+(p.rl.gp<3?', from a small sample':'')+'.');
  const mpL=l1?l1[1]:null, mpN=(p.m14!=null && p.g14>=1)?p.m14:(c?c.mp:null);
  if(mpN!=null && mpL) a.push('Minutes, '+r0(mpN)+' this season against '+r0(mpL)+' last season, '+(mpN>=mpL*1.15?'up':mpN<=mpL*0.85?'down':'about the same')+'. The model counts him at '+r0(p.proj.mp)+'.');
  else if(p.proj) a.push('Minutes, the model counts him at '+r0(p.proj.mp)+'.');
  if(p.fill) a.push('Depth chart, next up behind '+p.fill.who.name+', who is out.'); else if(p.ds!=null) a.push('Depth chart, '+spotWord(p.ds)+(p.dsWas!=null && p.dsWas!==p.ds && p.dsSince?', moved there '+nice(p.dsSince):'')+'.'); else a.push('Depth chart, not listed.');
  if(ds){ const pl=planOf(), up=[], dn=[]; ds.forEach((v,ci)=>{ if(pl.roles[ci]==='punt') return; if(v>=0.7) up.push(ci); else if(v<=-0.7) dn.push(ci); });
    a.push(up.length||dn.length?'For your plan he '+(up.length?'adds '+listWords(up.map(ci=>CATS[ci])):'adds no plan cat')+(dn.length?' and costs '+listWords(dn.map(ci=>CATS[ci])):'')+' over the season.':'For your plan no cat moves much over the season.'); }
  if(verdict) a.push('Verdict, '+verdict);
  return a.join(' '); }
/* sell high. Your players whose box score is running well above a modest record while their minutes and role have not changed, so the market is paying for a hot stretch.
   And rising players, whose hot start is backed by a solid record, so their price is real and they are worth keeping */
function sellHigh(ctx){ const solid=ctx.fvSolid||25, today=ctx.now.date, sell=[], rise=[];
  ctx.ros[ME].forEach(p=>{ const k=B.nkey(p.name); if(NEVER.has(k) || (HOLD[k] && today<HOLD[k]) || !p.rl || !p.fvC || !p.fvL) return;
    if(p.rl.gp>=3 && p.fvC>=1.2*p.fvL && p.fvL<solid && p.role!=='up' && !p.fill) sell.push(p);
    else if(p.rl.gp>=1 && p.fvC>=1.15*p.fvL && p.fvL>=solid) rise.push(p); });
  return {sell,rise}; }
function sellPanel(cw){ const ctx=CTX; if(!ctx) return ''; const sh=sellHigh(ctx); let h='<h2 style="margin-top:6px">Sell high <span>hot stretches the market will pay for</span></h2>';
  const deals=p=>(TR.alt||[]).filter(t=>t.kind==='plan' && t.give.some(x=>x.id===p.id) && t.get.every(x=>x.fvL>=x.fv*0.9)).sort((a,b)=>b.score-a.score).slice(0,2);
  if(!sh.sell.length) h+='<p class="small">Nobody yet. A sell high needs 3 or more games of a hot stretch from a player with a modest record, since managers will call one big night just that.</p>';
  sh.sell.forEach(p=>{ const d=deals(p); h+='<div class="switch">'+esc(p.name+' has a box score rating of about '+r0(p.fvC)+' a game over '+p.rl.gp+' games, against '+r0(p.fvL)+' last season. His minutes and role have not changed, so this looks like a hot stretch. Sell while the box score looks good.'+(d.length?' Best fair deals with him, '+d.map(t=>listWords(t.give.map(x=>x.name))+' for '+listWords(t.get.map(x=>x.name))+' with '+((cw.teams[t.o]||{}).name||'')+', gain '+r1(t.myGain)).join('. ')+'.':' No fair deal with him helps your plan yet.'))+'</div>'; });
  if(sh.rise.length) h+='<p class="small">Rising, keep. '+esc(sh.rise.map(p=>p.name+' has a box score rating of about '+r0(p.fvC)+' a game this season against '+r0(p.fvL)+' last season, and his record backs it up').join('. '))+'. Their price is real, so keep them or move them only for a clear upgrade.</p>';
  return h; }
// a top trade that gives away the player a card would drop
const endsTrade=d=>d?((TR && TR.list || []).slice(0,3).find(t=>t.give.some(x=>x.id===d.id))||null):null;
// the verdict on a pickup card, from its band and how it scores
const pickVerdict=r=>r.away?'a stash for when he is back, not a player for this week.':r.band==='must'?'add him now, he is a real long term upgrade.':r.band==='strong'?(r.kind==='stream'?'a strong add for this week\'s games, not a keeper.':'a strong add that also helps your season.'):r.band==='helps'?'helps a little, keep your waiver spot unless nothing better comes.':'skip him for now.';
function pickPanel(ctx,pk){
  let h='<div class="panel"><h2>Pickups <span>updates every day after the Yahoo scan</span></h2>';
  // three tabs. This week, the long term list with real waiver claims and free agents, and trade chips, so a free agent chip never sits under a tab named for waivers
  const tb=(id,key,label)=>'<button type="button" role="tab" class="btn'+(ST.pkTab===key?' on':'')+'" id="'+id+'" aria-selected="'+(ST.pkTab===key)+'">'+label+'</button>';
  h+='<div class="mvsub" role="tablist">'+tb('mvpkweek','week','This week')+tb('mvpkwav','wav','Long term')+tb('mvpkchip','chips','Trade chips')+'</div>';
  if(ST.pkTab==='wav'){ h+=wavPage(ctx)+'</div>'; return h; }
  if(ST.pkTab==='chips'){ h+=chipPage(ctx)+'</div>'; return h; }
  const wkWord=weekWord(ctx,pk.week).replace(/^in /,'');
  if(pk.standIn) h+='<div class="switch">No matchup is set for that week yet, so these scores use '+esc((ctx.teams[pk.opp]||{}).name||'the strongest team')+' as a stand in.</div>';
  h+='<p class="small">Week is how many points the move adds to your chance to win this week. Season is the same for the rest of the season, counted the way your plan counts cats. A red tag means the drop costs you for the season, and a stream now pays that cost in full. Drops follow your rules. Picks from rounds 1 to 12 are never dropped for a stream, a top pick goes only when out for the season, and a mid round pick goes for a long term add only when slumping or out long with no IL spot. A stream tops out at 80. Need score, 85 and up means add him now, and it needs a season lift of 1 or more, no loss this week, and proof in real games or a new role, unless it replaces a long term injury. Nothing but an injury fill in reaches 85 in the first two weeks. 65 to 84 means add him once he is a free agent. 50 to 64 helps but keep your waiver spot. Under 50, skip. Those stay hidden until you tick the box under the list. Solid cats count in full, FT% counts 90 percent and FG% 80 percent. Scores are for '+wkWord+' against '+esc((ctx.teams[pk.opp]||{}).name||'')+' and for the rest of the season. Each score takes the better of two readings. A hold counts 40 percent of the lift for that week and 60 percent of the lift to your average week for the rest of the season. The rest of season part follows your season plan, so your punt earns nothing there. The week part uses the real scoreboard against that week\'s opponent, every cat included, because any close cat can win a week. A one week stream counts 85 percent of that week\'s lift alone, so read the rest of season line on the card before you drop someone for it. A stream whose add day is more than 3 days away is capped at 60. The top score is 99. An injury tag counts twice. Each game counts 75 percent for a game time call or day to day, 60 for questionable and 25 for doubtful. Then the score itself is cut, by 10, 25 or 60 percent for a stream and half of that for a keep, because an add is wasted while he sits. The better the player the smaller that cut. It is nothing inside the top 60 of the blended rank and all of it from 140 on. A player who is out is listed only as a keep, only when the news gives a return date, and only when he scores 50 or more. He has no week of his own, so his score is the whole rest of season lift, counted from the day he is due back, less 40 percent of what a drop costs that week when one is needed. A card says Stream for games when the week alone moves 2 points or more, Keep long term when your season gets better with him, and both when both are true. The label of the reading that gave the score is always shown.</p>';
  if(ctx.noAdds) h+='<div class="switch">You have used all '+(D.league.adds||4)+' adds for week '+ctx.wk.n+', so Yahoo will not take another add this week. These pickups are scored for week '+pk.week.n+'.</div>';
  if(pk.ilMove && !pk.free) h+='<div class="switch">'+esc(pk.ilMove.name)+' is tagged '+statusWord(pk.ilMove.status)+'. Move him to IL and you can add someone without dropping anyone.</div>';
  if(pk.free) h+='<div class="switch">You have '+pk.free+' open roster spot'+(pk.free===1?'':'s')+', so an add needs no drop.</div>';
  const nSkip=pk.list.filter(r=>r.band==='skip').length;
  if(!pk.list.length) h+='<p class="empty">'+(pk.note||'No pickup helps you right now. Hold your adds and your waiver spot.')+'</p>';
  else if(nSkip===pk.list.length) h+='<p class="empty">No pickup scores 50 or more right now. Hold your adds and your waiver spot.</p>';
  pk.list.forEach((r,i)=>{
    const p=r.p; const why=pickupWhy(ctx,pk,r);
    h+='<details class="mvcard'+(r.band==='skip'?' mvskip':'')+'"><summary><span class="mvn '+r.band+'">'+r.need+'<small>'+(r.band==='must'?'must add':r.band==='strong'?'strong':r.band==='helps'?'helps':'skip')+'</small></span><span class="mvt"><b>'+esc(p.name)+'</b> <span class="sub">'+esc(p.team)+', '+esc(p.pos.join(' '))+(r.drop?', drop '+esc(r.drop.name):'')+'</span>'
      +'<span class="meta"><span class="chip">'+esc(r.tag)+'</span>'+(r.dropWhy&&r.dropWhy.why&&r.drop?'<span class="chip muted">Drop is '+esc(r.dropWhy.why.replace(/^(a |an )/,''))+'</span>':'')+(r.away?'':'<span class="chip muted">Week '+updn(r.gW)+'</span>')+'<span class="chip muted">Season '+updn(r.gR)+'</span>'+(r.gR<=-0.3?'<span class="chip bad">Costs you long term, '+r1(-r.gR)+' pts</span>':'')+r.labels.map(x=>'<span class="chip '+(x==='Stream for games'?'warn':'good')+'">'+x+'</span>').join('')+(r.built.length?'<span class="chip gem">Builds '+r.built.map(c=>CATS[c]).join(' ')+'</span>':'')+newsChip(p)+(r.away?'':'<span class="chip muted">'+r.gl+(r.gl===1?' game':' games')+(weekWord(ctx,pk.week)==='this week'?' left':' '+weekWord(ctx,pk.week))+'</span>')+(r.wd?'<span class="chip warn">Waivers until '+nice(r.wd)+'</span>':r.waiver?'<span class="chip warn">On waivers</span>':'<span class="chip good">Free agent</span>')+(r.early?'<span class="chip muted">Wait for game week</span>':'')+(r.bal.mult>1?'<span class="chip good">Helps balance</span>':r.bal.mult<1?'<span class="chip warn">'+(r.bal.crowd.length?'Crowded spot':'Leaves '+r.bal.thin.join(' ')+' thin')+'</span>':'')+(r.josh>0?'<span class="chip gem">Josh likes him</span>':'')+(p.status?'<span class="chip bad">'+esc(statusWord(p.status))+'</span>':'')+(endsTrade(r.drop)?'<span class="chip bad">Ends a trade</span>':'')+basisChip(p)+'</span></span></summary>'
      +'<div class="mvbody"><p><span class="lab">Why him</span>'+esc(whyHim(ctx,p,r.ds,pickVerdict(r)))+'</p>'+(endsTrade(r.drop)?'<p><span class="lab">Ends a trade</span>'+esc(r.drop.name+' is in one of your top trades, '+(t=>t.give.map(x=>x.name).join(' and ')+' for '+t.get.map(x=>x.name).join(' and '))(endsTrade(r.drop))+', so dropping him ends that deal.')+'</p>':'')+'<p><span class="lab">What it does for you</span>'+esc(why[0])+'</p><p><span class="lab">What it costs</span>'+esc(why[1])+'</p><p><span class="lab">What it is based on</span>'+esc(why[2])+'</p>'+(why[4]?'<p><span class="lab">Josh on the cats</span>'+esc(why[4])+'</p>':'')+(why[5]?'<p><span class="lab">News</span>'+esc(why[5])+'</p>':'')+'<p><span class="lab">Risk</span>'+esc(why[3])+'</p>'
      +'<div class="mvact"><button class="btn" type="button" data-add="'+esc(p.id)+'" data-drop="'+esc(r.drop?r.drop.id:'')+'" data-il="'+esc(r.il||'')+'">I made this add</button></div></div></details>';
  });
  if(nSkip) h+='<label class="mvchk"><input type="checkbox" id="mvshowskip"'+(ST.showSkip?' checked':'')+'> Show the '+nSkip+' pickup'+(nSkip===1?'':'s')+' scored under 50 and marked skip</label>';
  h+='</div>'; return h;
}
/* the season plan panel. The table comes from the daily scan. The routes come from the trade scoring, so they fill in a few seconds later */
function planCheck(ctx,pl,pt,pk){
  const a=[], per=ctx.view0.per;
  pt.risk.forEach(r=>{ let s=CATS[r.c]+' is a lock that has slipped under its floor. You win it '+(Math.abs(r.p-FLOOR)<0.01?(100*r.p).toFixed(1):pc(r.p))+' percent of the time and are favored against '+r.fav+' of 9 teams.';
    const fx=TR&&TR.list?TR.list.filter(t=>t.dme[r.c]>=2).sort((x,y)=>y.dme[r.c]-x.dme[r.c])[0]:null, fp=pk&&pk.list?pk.list.filter(x=>x.ds && x.ds[r.c]>=1).sort((x,y)=>y.ds[r.c]-x.ds[r.c])[0]:null;
    if(fx) s+=' The best trade fix below is '+fx.get.map(p=>p.name).join(' and ')+' for '+fx.give.map(p=>p.name).join(' and ')+'.'; if(fp) s+=' The best pickup fix is '+fp.p.name+'.'; if(!fx && !fp) s+=' Nothing on the lists fixes it today.'; a.push(s); });
  const fixDots=x=>oneDot([x])[0];
  ctx.ros[ME].forEach(p=>{ if(p.ret) a.push(p.name+' is listed as out until around '+niceLong(p.ret)+' by ESPN, so every number here counts him as out until then.'); else if(p.news && p.news.note && p.news.dir==='bad') a.push(p.name+'. '+String(p.news.note).replace(/\.+$/,'')+'.'); });
  if(pt.set) a.push('Enough build cats are on target, so they are now guarded like locks and the last build cat is free to swing.');
  if(pt.critical) a.push('The plan is in trouble. '+(pt.week<0.5?'Your plan week is down to '+pc(pt.week)+' percent. ':'')+(pt.risk.length>=2?pt.risk.length+' locks are at risk. ':'')+'A full rebuild may show under Pivots.');
  if(TR && TR.lead && ST.lead && ST.lead!==TR.lead.join(',')){ const old=ST.lead.split(',').map(Number).filter(c=>c>=0&&c<9); if(old.length) a.push('The leading route changed since you last looked. It was '+routeName(old)+' and is now '+routeName(TR.lead)+'.'); }
  return a.map(fixDots);
}
function planPanel(ctx,pk){
  const pl=planOf(), pt=planTable(ctx,pl), order=['lock','build','bonus','low','swing','punt'];
  let h='<div class="panel"><h2>Season plan <span>checked after every Yahoo scan</span></h2>';
  const cl=a=>listWords(a.map(c=>CATS[c])), nw=n=>['no','one','two','three','four','five'][n]||String(n);
  let ex='You win a week with 5 of 9 cats. The plan is '+nw(pl.lock.length)+' lock'+(pl.lock.length===1?'':'s')+(pl.need?' plus '+(pl.need>=pl.build.length?(pl.build.length===1?'the build cat':'all '+nw(pl.build.length)+' build cats'):'any '+nw(pl.need)+' of the '+nw(pl.build.length)+' build cats'):'')+'.';
  if(pl.shy) ex+=' That is '+(pl.lock.length+pl.need)+' plan cats, so '+nw(pl.shy)+' more has to come from a swing or bonus cat.';
  ex+=' A lock holds while you win it '+pc(FLOOR)+' percent of the time and are favored against at least '+FAVMIN+' of the 9 other teams. Room is how many points a lock sits above that floor, which is what a trade may spend. A build cat is on target at '+pc(TARGET)+' percent.';
  if(pl.punt.length) ex+=' '+cl(pl.punt)+(pl.punt.length===1?' is the punt. It is':' are the punts. They are')+' frozen, so no move is paid for adding there or blamed for losing there.';
  if(pl.bonus.length) ex+=' '+cl(pl.bonus)+(pl.bonus.length===1?' is a bonus cat and counts':' are bonus cats and count')+' 65 percent.'; if(pl.low.length) ex+=' '+cl(pl.low)+(pl.low.length===1?' is a low cat and counts':' are low cats and count')+' half.'; if(pl.swing.length) ex+=' '+cl(pl.swing)+(pl.swing.length===1?' is a swing cat. It counts':' are swing cats. They count')+' in full but no trade is asked to protect or build '+(pl.swing.length===1?'it':'them')+'.';
  ex+=' Nothing here changes the plan by itself. You change it with a pivot below.';
  h+='<p class="small">'+ex+'</p>';
  h+='<div class="mvbig">'+pt.hit+' of '+pt.of+'<small>plan cats at '+pc(TARGET)+' percent or better. Plan week '+pc(pt.week)+' percent, real nine cat week '+pc(pt.weekN)+' percent</small></div>';
  h+='<div class="mvtbl"><table><thead><tr><th>Cat</th><th>Role</th><th class="num">Win chance</th><th class="num">League rank</th><th class="num">Favored vs</th><th class="num">Room</th><th>Status</th></tr></thead><tbody>';
  pt.rows.slice().sort((a,b)=>order.indexOf(a.role)-order.indexOf(b.role)||b.p-a.p).forEach(r=>{ const cls=r.role==='lock'?(r.st==='Holding'?'good':'bad'):r.role==='build'?(r.st==='On target'?'good':r.st==='Close'?'warn':'bad'):'muted';
    h+='<tr><td><b>'+CATS[r.c]+'</b></td><td>'+ROLEWORD[r.role]+'</td><td class="num">'+pc(r.p)+'%</td><td class="num">'+ordW(r.rank)+'</td><td class="num">'+r.fav+' of 9</td><td class="num">'+(r.room==null?'':r.room>=0?r0(r.room)+' pts':'under by '+r0(-r.room))+'</td><td><span class="chip '+cls+'">'+r.st+'</span></td></tr>'; });
  h+='</tbody></table></div>';
  // routes
  h+='<h2 style="margin-top:14px">Routes to five <span>'+(pl.need && pl.build.length?(pl.need>=pl.build.length?'needs '+cl(pl.build):'any '+pl.need+' of '+cl(pl.build)):'no build cats')+'</span></h2>';
  if(!pl.need || !pl.build.length) h+='<p class="empty">This plan needs no build cats.</p>';
  else if(!TR) h+='<p class="empty">Scoring trades with all nine teams to rank the routes.</p>';
  else if(TR.note) h+='<p class="empty">'+esc(TR.note)+'</p>';
  else { h+='<div class="mvtbl"><table><thead><tr><th>Route</th><th>Now</th><th>Best fair trade</th><th>Can reach</th><th>Best pickup</th></tr></thead><tbody>';
    TR.routes.forEach(r=>{ const now=r.R.map((c,i)=>CATS[c]+' '+pc(r.now[i])).join(', '), nm=a=>a.map(p=>esc(p.name)).join(' and ');
      let bt, rc='';
      if(r.pair){ bt='Two trades together. '+nm(r.pair.a.get)+' for '+nm(r.pair.a.give)+', and '+nm(r.pair.b.get)+' for '+nm(r.pair.b.give)+', gain '+r1(r.gain); }
      else if(r.best){ bt=nm(r.best.get)+' for '+nm(r.best.give)+', gain '+r1(r.gain); }
      else if(r.via){ bt='Needs a pivot'+(r.via.broke.length?' that gives up '+r.via.broke.map(c=>CATS[c]).join(' and '):'')+', '+nm(r.via.get)+' for '+nm(r.via.give); }
      else bt='No fair trade builds this today';
      if(r.reach) rc=r.R.map((c,i)=>CATS[c]+' '+pc(r.reach[i])).join(', ')+(r.week!=null?', plan week '+pc(r.week):'');
      const bp=pk&&pk.list?pk.list.filter(x=>x.ds && x.gR>=0.3 && pickFits(r.R,x.ds)).sort((x,y)=>r.R.reduce((s,c)=>s+y.ds[c]-x.ds[c],0))[0]:null;
      h+='<tr'+(r.lead?' class="mvme"':'')+'><td style="white-space:normal"><b>'+r.R.map(c=>CATS[c]).join(' and ')+'</b>'+(r.lead?' <span class="chip gem">Leading</span>':'')+'</td><td>'+now+'</td><td style="white-space:normal">'+bt+'</td><td style="white-space:normal">'+rc+'</td><td style="white-space:normal">'+(bp?esc(bp.p.name):'None today')+'</td></tr>'; });
    h+='</tbody></table></div><p class="small">The leading route is the one that ends closest to '+pc(TARGET)+' percent in its cats after its best fair trade. Routes within a point of each other are tied and the bigger gain wins. You are not tied to it. Once '+nw(pl.need)+' build cat'+(pl.need===1?' is':'s are')+' on target, '+(pl.need===1?'it is':'they are')+' guarded like your locks.</p>'; }
  const chk=planCheck(ctx,pl,pt,pk);
  h+='<h2 style="margin-top:14px">Plan check</h2>'+(chk.length?chk.map(x=>'<div class="switch">'+esc(x)+'</div>').join(''):'<p class="small">Nothing has drifted. The plan holds.</p>');
  if(!pl.start) h+='<div class="switch">You are on a changed plan. '+(okPlan(ST.plan)?'It is saved on this device only. Tell Claude in the scan chat to save it for all devices.':'It is saved for all devices.')+(okPlan(ST.plan)?'<div><button class="btn" id="mvplanreset" type="button">Back to the saved plan</button></div>':'')+'</div>';
  h+='</div>'; return h;
}
const tinyTrade=t=>t.kind==='plan' && !t.pinned && !t.urgent && t.myGain<1;
function tradeCard(cw,t,i,grp){
  let h0='';
  const why=tradeWhy(cw,t), fy=tradeForYou(cw,t), kit=sellKit(cw,t), tc=tradeCats(t), oName=(cw.teams[t.o]||{}).name||'', nm=a=>a.map(p=>esc(p.name)).join(' and '), pl=TR.plan;
  const sellChip=t.sell==='easy'?'<span class="chip good">Easy sell</span>':t.sell==='fair'?'':'<span class="chip warn">Hard sell</span>';
  let h='<details class="mvcard'+(grp==='p' && tinyTrade(t)?' mvtiny':'')+'"><summary><span class="mvn '+(t.urgent?'must':t.myGain>=1?'strong':'helps')+'">+'+Math.abs(r1(t.myGain))+'<small>your gain</small></span><span class="mvt"><b>Get '+nm(t.get)+'</b> <span class="sub">for '+nm(t.give)+', with '+esc(oName)+'</span>'
    +'<span class="meta">'+(t.pinned?'<span class="chip gem">Your pivot trade</span>':'')+(t.urgent?'<span class="chip gem">Do this now</span>':'')
    +(t.kind!=='plan'?'<span class="chip bad">'+(t.broke.length?'Gives up '+t.broke.map(c=>CATS[c]).join(' '):'Pivot')+'</span>':'')
    +(t.built.length?'<span class="chip gem">Builds '+t.built.map(c=>CATS[c]).join(' ')+'</span>':'')
    +(t.kind==='plan'&&t.spent.length?'<span class="chip warn">Spends '+t.spent.map(c=>CATS[c]).join(' ')+'</span>':'')
    +(tc.up.filter(c=>t.built.indexOf(c)<0 && pl.roles[c]!=='punt').length?'<span class="chip good">Helps '+tc.up.filter(c=>t.built.indexOf(c)<0 && pl.roles[c]!=='punt').map(c=>CATS[c]).join(' ')+'</span>':'')
    +(tc.dn.filter(c=>t.spent.indexOf(c)<0 && t.broke.indexOf(c)<0 && pl.roles[c]!=='punt').length?'<span class="chip warn">Costs '+tc.dn.filter(c=>t.spent.indexOf(c)<0 && t.broke.indexOf(c)<0 && pl.roles[c]!=='punt').map(c=>CATS[c]).join(' ')+'</span>':'')
    +(t.acc2!=null && (grp==='t'||grp==='s'||grp==='h')?accTag(t.acc2)+'<span class="chip muted">about '+pc(t.acc2)+'% yes</span>'+'':'')+(grp==='s'?(sh=>'<span class="chip bad">Stretch'+(sh>=1?', '+sh+'% short':'')+'</span>')(Math.round(100*(t.mview?1-t.mview.look:t.face.need-t.face.look)))+(t.mview&&t.mview.pair?'<span class="chip bad">He loses on the '+t.mview.pair+' player</span>':'')+(t.mview&&t.mview.late&&t.mview.late.length?'<span class="chip bad">'+(t.mview.lateCap>0.001?'Little credit for ':'No credit for ')+esc(listWords(t.mview.late))+'</span>':''):'')+((grp==='t'||grp==='s'||grp==='h')?'':sellChip+(mgOf(t)?(g=>'<span class="chip '+(g.lv===2?'good':g.lv===1?'muted':'warn')+'">'+esc(g.m.name)+', '+(g.lv===2?'easy':g.lv===1?'fair':'hard')+'</span>')(mgOf(t)):''))+(fitWin(t)?'<span class="chip good">Wins on fit</span>':'')
    +(t.bal.mult>1?'<span class="chip good">Helps balance</span>':t.bal.mult<1?'<span class="chip warn">Hurts balance</span>':'')
    +t.get.map(p=>{ const w=getWarn(p); return w?'<span class="chip bad">'+esc(w)+'</span>':''; }).join('')+t.get.map(newsChip).join('')+'</span></span></summary>';
  // the by manager tab says plainly what the deal does to your locks. Before and after are your chance to win that cat in an average week
  if((grp==='t'||grp==='s'||grp==='h') && pl && pl.lock){ const lk=pl.lock.map(c=>({c,a:t.per[c],b:t.per[c]-t.dme[c]/100})), dip=lk.filter(x=>t.dme[x.c]<=-1.5), up=lk.filter(x=>t.dme[x.c]>=1.5);
    const w=x=>CATS[x.c]+' from '+pc(x.b)+' to '+pc(x.a)+' percent';
    h0='<p><span class="lab">Your locks</span>'+(t.broke && t.broke.length?'Breaks '+esc(listWords(t.broke.map(c=>CATS[c])))+'. ':dip.length?'Keeps all your locks above the floor, but dips '+esc(listWords(dip.map(w)))+'. ':'Keeps all your locks. ')+(up.length?'Lifts '+esc(listWords(up.map(w)))+'. ':'')+(dip.length||up.length?'':'None of them moves by 1.5 points or more.')+'</p>'; }
  h+='<div class="mvbody">'+h0+'<div><span class="lab">What it does for you</span><p>'+esc(fy.head)+'</p>'+(fy.rows.length?'<ul>'+fy.rows.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul><p class="small">Each line is the change in your chance to win that cat in an average week, in points. Cats that move less than 1.5 are left out.</p>':'<p>No single cat moves by 1.5 points or more. The gain comes from small lifts across several cats.</p>')+'</div>'
    +'<p><span class="lab">How it looks to them</span>'+esc(tradeFair(cw,t))+'</p>'
    +'<div><span class="lab">How to sell it</span>'+(kit.open?'<p>'+esc(kit.open)+'</p>':'')+(kit.pts.length?'<ul>'+kit.pts.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'<p>No strong selling point is true for this deal, which is why it is marked a hard sell.</p>')+'</div>'
    +'<p><span class="lab">What they will say</span>'+esc(kit.push)+' '+esc(kit.alt)+'</p>'
    +'<p><span class="lab">For your eyes only</span>'+esc(kit.eyes)+'</p>'
    +(mgOf(t)?(g=>'<div><span class="lab">From your notes on '+esc(g.m.name)+'</span>'+((grp==='t'||grp==='s'||grp==='h') && t.acc2!=null?'<p>About '+pc(t.acc2)+' percent he says yes, from the numbers and your notes'+(t.mview?', judged his way. On his view he gets '+Math.round(100*t.mview.look)+' percent of what he gives'+(t.mview.pair?', and he loses on the '+t.mview.pair+' player':''):'')+'.</p>':'<p>With your notes this is a'+(g.lv===2?'n easy sell':g.lv===1?' fair ask':' hard sell')+', about '+pc(g.chance)+' percent to happen.</p>')+(g.why.length?'<ul>'+g.why.map(x=>'<li>'+esc(capF(x))+'.</li>').join('')+'</ul>':'')+(g.m.tips.length?'<p class="small">'+esc(g.m.tips.map(x=>x.replace(/\.+$/,'')).join('. ')+'.')+'</p>':'')+'</div>')(mgOf(t)):'')
    +(why.josh?'<p><span class="lab">Josh on the cats</span>'+esc(why.josh)+'</p>':'')+(why.news?'<p><span class="lab">News</span>'+esc(why.news)+'</p>':'')+'<p><span class="lab">Risk</span>'+esc(why.risk)+'</p>'
    +'<div class="mvact"><button class="btn" type="button" data-trade="'+grp+i+'">I made this trade</button><button class="btn" type="button" data-pitch="'+grp+i+'">Copy a message to send</button>'+(t.kind!=='plan'?'<button class="btn" type="button" data-pivot="'+i+'">Make this my plan</button>':'')+'</div></div></details>';
  return h;
}
function tradePanel(ctx){
  let h='<div class="panel"><h2>Trades <span>updates each week and after any roster move in the league</span></h2>';
  const cw=CTXW; const snap=new Date(cw.scan.at).toLocaleDateString(undefined,{month:'short',day:'numeric'});
  // two views of the same trades. Best trades is the list as it has always been. By manager ranks each manager's deals the way he values players
  h+='<div class="mvsub" role="tablist"><button type="button" role="tab" class="btn'+(ST.trTab!=='mgr'?' on':'')+'" id="mvtrbest" aria-selected="'+(ST.trTab!=='mgr')+'">Best trades</button><button type="button" role="tab" class="btn'+(ST.trTab==='mgr'?' on':'')+'" id="mvtrmgr" aria-selected="'+(ST.trTab==='mgr')+'">By manager</button></div>';
  if(ST.trTab!=='mgr') h+='<p class="small">Every trade here is good for you first. Your gain is how many points your chance to win an average week goes up, counted the way your plan counts cats. The card also shows the real nine cat number. A trade has to look fair to the other manager, and nothing asks that it helps their team. Fair is judged two ways. First the box score and the name, the way most managers judge a deal. Each player gets a box score rating that leads with points, then rebounds and assists, from last season, or the season before if he missed last season, moved by this season. A hot start counts fast when his record backs it up, and slowly when it does not, since managers will call it one good night. Missed games, age over 33, injuries and a big name move it a little. A listed deal has to look about even to them on that, a little better when they give the best player, and it never hands them more than 20 percent extra. A deal under 80 percent of even is an insult and is never shown anywhere. Second the value scale, which also carries this league\'s draft and Josh\'s ranks. '+seenWords(cw)+' A listed deal may be at most a little light on that scale. Every deal listed passes both, so only Easy sell and Hard sell are marked, to say how the pitch should go, and each card lists talking points that are true for that deal. Where a bigger ask is worth trying first, the card names it. Listed by your gain, with a hard sell marked down by half and a fair ask by 10 percent so they sit lower. Value you give away beyond an even deal counts a little against a trade. For a two for one, what you would gain by simply dropping a player for a streamer is taken off first. They always keep two centers and you keep three. At most 14 trades show, no more than 3 with any one manager, and one per team and set of players you get. The By manager tab has the rest. Trades that gain under 1 point stay hidden until you tick the box under the list. Built from the snapshot of '+esc(snap)+'. Kyrie is never offered. Boozer is held until the middle of January.</p>';
  if(ST.trTab==='mgr'){ h+=mgrPage(cw,true)+'</div>'; return h; }
  if(!TR){ h+='<p class="empty" id="mvtrwait">Scoring trades with all nine teams.</p></div>'; return h; }
  if(TR.note){ h+='<p class="empty">'+esc(TR.note)+'</p></div>'; return h; }
  if(MG) h+=likelyPanel(cw);
  h+=sellPanel(cw);
  h+='<h2 style="margin-top:6px">Stays on plan <span>builds a route, spends only room, breaks no floor</span></h2>';
  // early in the season most of any gain rests on guesses about minutes, and managers have little to go on either, so holding is a real option
  const early=(cw.avgGP||0)<5;
  if(!TR.list.length) h+='<div class="switch">Hold. No trade both helps your plan and looks fair to the other manager on the box score right now, so there is nothing worth pitching. Check back after a few more games. The By manager tab still shows the long shots. Checked '+TR.count+' offers.</div>';
  else if(early) h+='<div class="switch">Early season, about '+r0(cw.avgGP||0)+' game'+(r0(cw.avgGP||0)===1?'':'s')+' a player so far. The trades below pass both checks, but most of your gain still rests on guesses about minutes. Holding until about 5 games is a fair choice unless one of these is clearly worth it to you.</div>';
  const nTiny=TR.list.filter(tinyTrade).length;
  if(TR.list.length && nTiny===TR.list.length) h+='<p class="empty">No fair trade gains a full point right now.</p>';
  TR.list.forEach((t,i)=>{ h+=tradeCard(cw,t,i,'p'); });
  if(nTiny) h+='<label class="mvchk"><input type="checkbox" id="mvshowsmall"'+(ST.small?' checked':'')+'> Show the '+nTiny+' smaller trade'+(nTiny===1?'':'s')+' that gain under 1 point</label>';
  h+='<h2 style="margin-top:14px">Pivots <span>give up one guarded cat for a bigger gain</span></h2>';
  h+='<p class="small">A pivot shows only when it beats the best trade that stays on plan by 2 points or more. Each one gives up a single lock, or leans on a cat the plan counts low. A full rebuild shows only when the plan is in trouble. Tap Make this my plan and the trades and pickups rank again under the new plan.</p>';
  if(!TR.pivots.length) h+='<p class="empty">No pivot beats the plan today. Stay the course.</p>';
  TR.pivots.forEach((t,i)=>{ h+=tradeCard(cw,t,i,'v'); });
  h+='</div>'; return h;
}
/* how one manager sees a deal, from your notes. A manager who values by draft judges a player mostly by where he went in this league's draft,
   60 percent draft and 40 percent his current rank, with no lift for late picks. A manager who judges player for player lines up the best player on each side,
   then the second best, at full weight, with no credit for consolidating. Without either setting the site's own fair check stands */
const draftVal=p=>{ const pk=pickOf[B.nkey(p.name)]||165, now=(p.curRank && p.rl && p.rl.gp>=5)?p.curRank:(p.seenRank||165); return 100*Math.exp(-(Math.max(1,0.6*pk+0.4*now)-1)/45)+3; };
const LATEPICK=130, isLate=p=>{ const pk=pickOf[B.nkey(p.name)]; return !pk || pk>LATEPICK; };
function mgView(t,m){ if(!m || !(m.byDraft||m.pairs||m.noLate)) return null;
  // a manager who wants no late pieces counts a player you give as nothing when he went in the last two rounds or was picked up after the draft,
  // unless he sends back one of his own late pieces in the same deal
  // a late piece is only good to him as a swap for one of his own late pieces, so your late pieces together count for no more than his late pieces in the deal
  const v0=p=>m.byDraft?draftVal(p):p.fv, myLate=m.noLate?t.give.filter(isLate):[], hisLate=m.noLate?t.get.filter(isLate):[];
  const mS=myLate.reduce((x,p)=>x+v0(p),0), hS=hisLate.reduce((x,p)=>x+v0(p),0), lk=mS>0?Math.min(1,hS/mS):1, zero=lk<0.999?myLate:[];
  const v=p=>myLate.indexOf(p)>=0?v0(p)*lk:v0(p), inn=t.give.map(v).sort((a,b)=>b-a), out=t.get.map(v).sort((a,b)=>b-a);
  const sum=a=>a.reduce((x,y)=>x+y,0), A=m.pairs?sum(inn):dw(inn), Bv=m.pairs?sum(out):dw(out), look=A/Math.max(Bv,1); let ok=look>=1.0, pair='';
  if(m.pairs) for(let i=0;i<Math.max(inn.length,out.length);i++){ const a=inn[i]||0, b=out[i]||0; if(b>0 && a<0.85*b && b-a>(m.byDraft?4:2)){ ok=false; pair=i===0?'best':'second'; break; } }
  return {look,ok,pair,A,B:Bv,late:zero.map(p=>p.name),lateCap:lk}; }
function teamRank(o){ const b=TR && TR.byTeam && TR.byTeam[o]; if(!b) return null; const m=MG && MG.teams[o], hasMg=!!m;
  let fair=b.fair.slice(), str=b.stretch.slice();
  fair.concat(str).forEach(t=>{ t.mview=mgView(t,m); });
  if(m && (m.byDraft||m.pairs||m.noLate)){ const all=fair.concat(str); fair=all.filter(t=>t.mview.ok && t.face.look>=FACE_INSULT); str=all.filter(t=>!t.mview.ok && t.mview.look>=0.80); }
  // the insult guard. A manager who calls out lowballs never sees a deal that looks light to him, not even as a long shot
  if(m && m.callout){ str=str.filter(t=>t.face.look>=t.face.need-FACE_ASK); }
  fair.concat(str).forEach(t=>{ const a=acceptOf(t); t.acc2=a.c; t.accWhy=a.why; t.accG=a.g; t.ev=t.myGain*a.c; });
  // a deal your notes rule out, a player he said is not for trade, a shape he has no room for, or a light offer to a manager who calls those out, is left off
  const live=t=>!(t.accG && t.accG.force && !t.accG.yes); fair=fair.filter(live); str=str.filter(live);
  const likely=fair.slice().sort((x,y)=>y.ev-x.ev||y.myGain-x.myGain).filter(t=>t.acc2>=0.1).slice(0,5);
  const helpful=fair.filter(t=>likely.indexOf(t)<0).sort((x,y)=>y.myGain-x.myGain).slice(0,5);
  str.sort((x,y)=>y.myGain-x.myGain);
  return {likely,helpful,stretch:str.slice(0,6),hasMg,m,nFair:fair.length,nStr:str.length,view:!!(m && (m.byDraft||m.pairs||m.noLate))}; }
const accTag=c=>c>=0.5?'<span class="chip good">Likely yes</span>':c>=0.25?'<span class="chip muted">Worth a try</span>':'<span class="chip warn">Long shot</span>';
function mgrPage(cw,inner){
  const E=inner?'':'</div>'; let h=inner?'':'<div class="panel"><h2>Trades by manager <span>ranked by what each manager values</span></h2>';
  if(!TR){ return h+'<p class="empty">Scoring trades with all nine teams.</p>'+E; }
  if(TR.note || !TR.byTeam){ return h+'<p class="empty">'+esc(TR.note||'No trades right now.')+'</p>'+E; }
  const opps=Object.keys(TR.byTeam), o=opps.indexOf(ST.tteam)>=0?ST.tteam:opps[0], r=teamRank(o), tn=x=>((cw.teams[x]||{}).name||('Team '+x)), mn=x=>MG && MG.teams[x]?MG.teams[x].name:'';
  h+='<div style="display:flex;gap:6px;align-items:center;flex-wrap:nowrap"><button class="btn" type="button" id="mvtprev" aria-label="Previous manager">Prev</button><select id="mvtsel" class="btn" aria-label="Manager" style="flex:1;min-width:0">'+opps.map(x=>'<option value="'+esc(x)+'"'+(x===o?' selected':'')+'>'+(mn(x)?esc(mn(x))+', ':'')+esc(tn(x))+'</option>').join('')+'</select><button class="btn" type="button" id="mvtnext" aria-label="Next manager">Next</button></div>';
  const m=r.m;
  if(m && m.tips.length) h+='<details class="mvteam" style="margin-top:8px"><summary class="small"><b>Your notes on '+esc(m.name)+'</b>, '+m.tips.length+' tips</summary><ul class="mvlist">'+m.tips.map(x=>'<li>'+esc(x.replace(/\.+$/,''))+'.</li>').join('')+'</ul></details>';
  h+='<p class="small">'+(r.view?esc(m.name)+(m.byDraft?' values players mostly by draft spot':'')+(m.byDraft&&m.pairs?' and':'')+(m.pairs?' judges player for player':'')+(m.noLate?((m.byDraft||m.pairs)?', and':'')+' gives no credit for players taken after pick '+LATEPICK+' or picked up after the draft':'')+', so a deal counts as fair only if it holds up his way. ':r.hasMg?'Fair uses the site\'s usual check, and the yes chance uses your notes on '+esc(m.name)+'. ':'No notes on this manager, so fair uses the site\'s usual check and the yes chance comes from the numbers alone. ')+'Likely yes is about 50 percent or better, Worth a try 25 to 50, Long shot under 25. The chance is a rough guide, not a forecast.</p>';
  if(!r.likely.length && !r.helpful.length) h+='<p class="empty">No helpful trades at this time.'+(r.stretch.length?' Stretch trades only, below.':'')+'</p>';
  else {
    h+='<h2 style="margin-top:10px">Most likely <span>your gain times the chance he says yes</span></h2>';
    if(!r.likely.length) h+='<p class="empty">None with a real chance right now.</p>';
    r.likely.forEach((t,i)=>{ h+=tradeCard(cw,t,i,'t'); });
    if(r.helpful.length){ h+='<h2 style="margin-top:14px">Most helpful <span>biggest gain for you, fair to him</span></h2>'; r.helpful.forEach((t,i)=>{ h+=tradeCard(cw,t,i,'h'); }); }
  }
  if(r.stretch.length){ h+='<h2 style="margin-top:14px">Stretch trades <span>short of fair to him, lean on your pitch</span></h2><p class="small">These fall short of fair to him, so they lean on your selling. They still keep your locks and three centers. Pitch what is really true for him, like role, games, age or a cat he needs.</p>'; r.stretch.forEach((t,i)=>{ h+=tradeCard(cw,t,i,'s'); }); }
  h+=E; return h; }
/* most likely to happen. Only drawn when your private notes are loaded on this device. Your gain times the chance they say yes */
function likelyPanel(cw){
  let h='<h2 style="margin-top:6px">Most likely to happen <span>your gain times the chance they say yes, from your notes</span></h2>';
  const rows=TR.list.concat(TR.pivots).map(t=>({t,c:chanceOf(t)})).map(x=>Object.assign(x,{ev:x.t.myGain*x.c})).filter(x=>x.ev>0).sort((a,b)=>b.ev-a.ev).slice(0,5);
  const nm=a=>a.map(p=>esc(p.name)).join(' and '), who=t=>esc((MG.teams[t.o]&&MG.teams[t.o].name)||((cw.teams[t.o]||{}).name)||'');
  h+=rows.length?'<ol class="mvlist">'+rows.map(x=>'<li><b>Get '+nm(x.t.get)+'</b> for '+nm(x.t.give)+', with '+who(x.t)+'. Gain '+r1(x.t.myGain)+', about '+pc(x.c)+' percent to happen'+(x.t.kind!=='plan'?', a pivot':'')+'.</li>').join('')+'</ol>':'<p class="empty">No listed trade has a real chance right now.</p>';
  // deals a manager already said yes to. They are checked with the same rules as the list, since a deal that looks very good for you never shows there
  const ys=[]; Object.keys(MG.teams).forEach(o=>{ const m=MG.teams[o]; m.yes.forEach(y=>{ const byKey=(list,ks)=>ks.map(k=>list.find(p=>B.nkey(p.name)===k)); const give=byKey(cw.ros[ME]||[],y.give), get=byKey(cw.ros[o]||[],y.get);
    if(give.some(p=>!p) || get.some(p=>!p)){ ys.push(esc(m.name)+' said yes'+(y.at?' on '+nice(y.at):'')+' to a deal whose players have moved since, so it no longer applies.'); return; }
    const r=checkOffer(o,give.map(p=>p.id),get.map(p=>p.id)); const big=r.look<=-15;
    let line=esc(m.name)+' said yes in principle'+(y.at?' on '+nice(y.at):'')+' to '+nm(give)+' for '+nm(get)+'. Your average week goes from '+r.nineCatBefore+' to '+r.nineCatAfter+' percent and your plan moves '+(r.planGain>=0?'up ':'down ')+Math.abs(r.planGain)+' points.';
    const real=(r.stops||[]).filter(x=>!(big && /^(fails|overpays)/.test(x)) && !/^plan gain under/.test(x));
    line+=big?' It looks about '+Math.round(-r.look)+' percent in your favor, more than the list allows, which is why it does not show there.':'';
    line+=real.length?' Watch out, '+esc(listWords(real))+'.':(r.nineCatAfter>=r.nineCatBefore?' Nothing in the rules stops it. Take it if it is still on the table.':'');
    ys.push(line); }); });
  if(ys.length) h+='<p class="small" style="margin-top:6px"><b>Already said yes</b></p><ul class="mvlist">'+ys.map(x=>'<li>'+x+'</li>').join('')+'</ul>';
  return h; }
function notesPanel(){
  let h='<div class="panel"><h2>Your private manager notes <span>kept in this browser only</span></h2>';
  h+=MG?'<p>Notes loaded for '+esc(listWords(Object.values(MG.teams).map(m=>m.name)))+(MG.made?', made '+esc(nice(MG.made)):'')+'. Trade cards with those managers show a rating from your notes, a pitch in their style and a Most likely to happen list.</p>':'<p>Load your managers.json file from your notes folder to rate each trade by what that manager has told you. It stays in this browser and is never sent anywhere.</p>';
  h+='<div class="mvact"><label class="btn" style="cursor:pointer">Load notes file<input type="file" id="mvmgfile" accept=".json,application/json" style="display:none"></label>'+(MG?'<button class="btn" type="button" id="mvmgclear">Remove notes from this browser</button>':'')+'</div><p class="small" id="mvmgmsg"></p></div>';
  return h; }
function leaguePanel(ctx,rc){
  let h='<div class="panel"><h2>The league <span>all ten teams, strongest first</span></h2><div class="mvtbl"><table><thead><tr><th>#</th><th>Team</th><th class="num">Record</th><th class="num">Avg week</th><th class="num">Top 4</th></tr></thead><tbody>';
  rc.rows.forEach(r=>{ const strong=r.per.map((p,c)=>p>=0.6?CATS[c]:'').filter(Boolean), weak=r.per.map((p,c)=>p<=0.4?CATS[c]:'').filter(Boolean);
    const ros=ctx.ros[r.tid].slice().sort((a,b)=>b.val-a.val).map(p=>'<li><span>'+esc(p.name)+' <span class="small">'+esc(p.team)+' '+esc(p.pos.join(' '))+(p.status?', '+esc(statusWord(p.status)):'')+'</span></span><span>'+(p.proj?r1(p.proj.pts)+' pts '+r1(p.proj.reb)+' reb '+r1(p.proj.ast)+' ast':'no numbers')+'</span></li>').join('');
    h+='<tr class="'+(r.tid===ME?'mvme':'')+'"><td>'+r.pos+'</td><td style="white-space:normal"><details class="mvteam"><summary><b>'+esc(r.name)+'</b><div class="small">'+(strong.length?'Strong '+strong.join(' '):'No strong cat')+(weak.length?'. Weak '+weak.join(' '):'')+'</div></summary><ul>'+ros+'</ul></details></td><td class="num">'+(r.rec.w||0)+' '+(r.rec.l||0)+' '+(r.rec.t||0)+'</td><td class="num">'+pc(r.week)+'%</td><td class="num">'+pc(r.top4)+'%</td></tr>'; });
  h+='</tbody></table></div><p class="small">Avg week is the chance to win a typical week against the teams left on the schedule. Top 4 is the chance to finish the regular season in the first four, from 3000 simulated seasons. Eight teams make the playoffs, so the first four is about seeding. Record is wins, losses, ties. Weak cats are what that manager needs, so offer those. Tap a team to see its roster as of the last scan, with any moves you marked.</p></div>';
  return h;
}
function teamPanel(ctx,wk){
  const mine=ctx.ros[ME].slice().sort((a,b)=>b.val-a.val);
  let h='<div class="panel"><label class="mvchk" style="margin-top:0"><input type="checkbox" id="mvshowmine"'+(ST.showMine?' checked':'')+'> Show my players, the per game numbers this page uses</label><div class="mvmine"><h2 style="margin-top:12px">My players <span>what the numbers above use, per game</span></h2><div class="mvtbl"><table><thead><tr><th>Player</th><th class="num">Wk G</th><th class="num">GP</th><th class="num">MIN</th><th class="num">FG%</th><th class="num">FT%</th><th class="num">3PM</th><th class="num">PTS</th><th class="num">REB</th><th class="num">AST</th><th class="num">STL</th><th class="num">BLK</th><th class="num">TO</th><th>Based on</th></tr></thead><tbody>';
  mine.forEach(p=>{ const l=p.proj; const g=wk?(wk.me.ug.get(p.id)||0):0; const n=ctx.days.filter(d=>playsOn(p.team,d)).length;
    h+='<tr><td class="mvnm" style="white-space:normal"><b>'+esc(p.name)+'</b> <span class="small">'+esc(p.team)+' '+esc(p.slot)+(p.status?', '+esc(statusWord(p.status)):'')+(p.role?', minutes '+p.role:'')+(spotShort(p)?', '+spotShort(p):'')+(p.fill?', filling in':'')+'</span>'+(jcCall(p)?'<div class="small mvjc">'+esc(jcCall(p))+'</div>':'')+(jcTags(p)?'<div class="small mvjc">'+esc(jcTags(p))+'</div>':'')+'</td><td class="num">'+r1(g)+' of '+n+'</td><td class="num">'+(p.gp||0)+'</td>';
    if(l) h+='<td class="num">'+r1(l.mp)+'</td><td class="num">'+(l.fga>0?(100*l.fgm/l.fga).toFixed(1):'')+'</td><td class="num">'+(l.fta>0?(100*l.ftm/l.fta).toFixed(1):'')+'</td><td class="num">'+r1(l.tpm)+'</td><td class="num">'+r1(l.pts)+'</td><td class="num">'+r1(l.reb)+'</td><td class="num">'+r1(l.ast)+'</td><td class="num">'+r1(l.stl)+'</td><td class="num">'+r1(l.blk)+'</td><td class="num">'+r1(l.to)+'</td>'; else h+='<td colspan="10" class="small">no numbers yet</td>';
    h+='<td>'+basisChip(p)+'</td></tr>'; });
  h+='</tbody></table></div><p class="small">Wk G is how many of his games this week fit in your starting lineup. The best players are seated first, so a questionable player keeps his spot. A bench player shows the share of starts he is expected to pick up when a starter sits. Each line blends last season with this season. The weight on this season is games played divided by games played plus 12. Rookie guesses and older seasons fade faster.'+(DP?' NBA starter, NBA bench or NBA deep bench is his spot on ESPN\'s depth chart from '+nice(DP.day)+'. Where that spot does not fit his minutes from last season, they move up to 15 percent toward the usual range for that spot, unless Josh gave a minutes number. Filling in means a starter ahead of him is out, so he is counted with more minutes until that starter is due back.':'')+' Players 33 and older are counted for 3 percent fewer games early in the season, rising to 8 percent by the playoff weeks, and half again as much at 36 and older. Their per game numbers are not changed.'+(hasJC()?' The line under a name is the category call Josh Lloyd made for that player. His rank sets how much the player is worth and how many games he gets. The call sets which cats that value sits in. A normal call moves a cat about 5 to 8 percent and a strong one about double. Where he gave real numbers the cat moves most of the way to them. FG% or FT% moves about a point, more where he gave numbers. A minutes call only lets the rank move the whole line as far as his minutes number.':'')+'</p></div></div>';
  return h;
}
function wire(root){
  root=root||$('viewMoves');
  [['mvshowskip','showSkip','showskip'],['mvshowmine','showMine','showmine'],['mvshowsmall','small','showsmall']].forEach(x=>{ const b=$(x[0]); if(b) b.onchange=()=>{ ST[x[1]]=!!b.checked; save(); const m=root.querySelector('.mv'); if(m) m.classList.toggle(x[2],ST[x[1]]); }; });
  root.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{ ST.marks.push({type:'add',add:b.getAttribute('data-add'),drop:b.getAttribute('data-drop')||null,il:b.getAttribute('data-il')||null,day:CTX?CTX.now.date:null}); ST.at=D.scan.at; save(); compute(true); });
  const trOf=k=>{ const i=+String(k).slice(1), g=String(k).charAt(0); if(!TR) return null; if(g==='t'||g==='s'||g==='h'){ const ks=Object.keys(TR.byTeam||{}), o=ks.indexOf(ST.tteam)>=0?ST.tteam:ks[0], r=o?teamRank(o):null; return r?(g==='t'?r.likely:g==='h'?r.helpful:r.stretch)[i]:null; } return (g==='v'?TR.pivots:TR.list)[i]; };
  const goTeam=d=>{ const ks=Object.keys((TR&&TR.byTeam)||{}); if(!ks.length) return; let i=ks.indexOf(ST.tteam); if(i<0) i=0; ST.tteam=typeof d==='string'?d:ks[(i+d+ks.length)%ks.length]; save(); render();  };
  { const pw=$('mvpkweek'), pv=$('mvpkwav'), pc0=$('mvpkchip'); if(pw) pw.onclick=()=>{ ST.pkTab='week'; save(); render(); }; if(pv) pv.onclick=()=>{ ST.pkTab='wav'; save(); render(); }; if(pc0) pc0.onclick=()=>{ ST.pkTab='chips'; save(); render(); }; }
  { const tb=$('mvtrbest'), tm=$('mvtrmgr'); if(tb) tb.onclick=()=>{ ST.trTab='best'; save(); render(); }; if(tm) tm.onclick=()=>{ ST.trTab='mgr'; save(); render(); }; }
  { const a=$('mvtprev'), b=$('mvtnext'), sl=$('mvtsel'); if(a) a.onclick=()=>goTeam(-1); if(b) b.onclick=()=>goTeam(1); if(sl) sl.onchange=()=>goTeam(sl.value); }
  root.querySelectorAll('[data-trade]').forEach(b=>b.onclick=()=>{ const t=trOf(b.getAttribute('data-trade')); if(!t) return; ST.marks.push({type:'trade',withTeam:t.o,give:t.give.map(p=>p.id),get:t.get.map(p=>p.id),cut:t.cut?t.cut.id:null}); ST.at=D.scan.at; save(); compute(true); });
  root.querySelectorAll('[data-pitch]').forEach(b=>b.onclick=()=>{ const t=trOf(b.getAttribute('data-pitch')); if(!t) return; const txt=pitchText(CTXW,t); const ok=()=>{ b.textContent='Copied'; setTimeout(()=>{ b.textContent='Copy a message to send'; },1500); }; try{ navigator.clipboard.writeText(txt).then(ok,()=>{ b.textContent=txt; }); }catch(e){ b.textContent=txt; } });
  // a pivot becomes the plan only when you tap it. The trades and pickups are then ranked again under the new plan
  root.querySelectorAll('[data-pivot]').forEach(b=>b.onclick=()=>{ const t=TR&&TR.pivots[+b.getAttribute('data-pivot')]; if(!t || !okPlan(t.newRoles)) return; ST.plan=t.newRoles.slice(); ST.planMade=planSig(); ST.pin=pinKey(t.o,t.give,t.get); ST.lead=''; save(); compute(true); });
  const pr0=$('mvplanreset'); if(pr0) pr0.onclick=()=>{ ST.plan=null; ST.planMade=''; ST.pin=''; ST.lead=''; save(); compute(true); };
  const u=$('mvundo'); if(u) u.onclick=()=>{ ST.marks=[]; save(); compute(true); };
  const mf=$('mvmgfile'); if(mf) mf.onchange=()=>{ const f=mf.files&&mf.files[0]; if(!f) return; const rd=new FileReader(); rd.onload=()=>{ const e=setMg(String(rd.result||'')); if(e){ const m=$('mvmgmsg'); if(m) m.textContent=e; } else render(); }; rd.readAsText(f); };
  const mc=$('mvmgclear'); if(mc) mc.onclick=()=>{ clearMg(); render(); };
}
function compute(redoTrades){
  try{ ERR=''; computeInner(redoTrades); }
  catch(e){ failed(e); }
}
function failed(e){ ERR=String(e&&e.message||e); const root=$('viewMoves'); if(root) root.innerHTML='<div class="panel"><h2>Pickups and trades</h2><p class="empty">The numbers could not be built from the last scan. The next scan should fix it. Detail for the fixer, '+esc(ERR)+'</p></div>'; }
/* the trade list keeps the weekly roster snapshot so it stays steady through the week, but injury tags change daily.
   So every player in the snapshot takes his tag from the newest daily scan when the daily scan has him on the same team */
function weekTags(week,scan){ if(!week || week===scan || !scan || !scan.rosters) return week||scan;
  const now={}; Object.keys(scan.rosters).forEach(t=>(scan.rosters[t]||[]).forEach(e=>{ now[t+'|'+e[0]]=e[2]||''; }));
  const w=Object.assign({},week,{rosters:{}}); Object.keys(week.rosters||{}).forEach(t=>{ w.rosters[t]=(week.rosters[t]||[]).map(e=>{ const k=t+'|'+e[0]; return k in now?[e[0],e[1],now[k]]:e; }); });
  return w; }
function computeInner(redoTrades){
  if(!D.scan || !D.league || !D.sched){ render(); return; }
  if(ST.at!==D.scan.at && ST.marks.length){ ST.marks=[]; ST.at=D.scan.at; save(); }
  // a marked add must be a player the scan knows, so a damaged saved mark can never put a made up player on your roster or use up an add
  if(ST.marks.length){ const known=new Set(Object.keys(D.scan.avail||{})); Object.keys(D.scan.rosters||{}).forEach(t=>(D.scan.rosters[t]||[]).forEach(e=>known.add(String(e[0])))); const keep=ST.marks.filter(m=>m.type!=='add' || known.has(m.add)); if(keep.length!==ST.marks.length){ ST.marks=keep; save(); } }
  CTX=build(D.scan); WK=thisWeek(CTX); PK=pickups(CTX); WV=waivers(CTX); CH=chips(CTX); RACE=race(CTX);
  if(redoTrades || !TR){ TR=null; CTXW=build(weekTags(D.week,D.scan),{lag:TRADELAG}); render(); const run=++TRUN; trades(CTXW,res=>{ if(run!==TRUN) return; TR=res; try{ render(); }catch(e){ failed(e); return; } if(TR.lead){ const k=TR.lead.join(','); if(ST.lead!==k){ ST.lead=k; save(); } } },()=>run===TRUN); }
  else render();
}
async function load(){
  if(D.loaded || D.loading) return; D.loading=true; render();
  const get=async f=>{ try{ const r=await fetch('data/'+f,{cache:'no-store'}); if(!r.ok) return null; return await r.json(); }catch(e){ return null; } };
  const files=['league.json','schedule.json','prior.json','players.json','scan.json','scan_week.json','josh_cats.json'];
  // news, ages, a saved plan and Josh's newest ranks are extras. The tab works without them, so a missing one is never an error
  const extra=['news.json','ages.json','plan.json','josh_live.json','depth.json','prior2.json','scan_prev.json'];
  const all=await Promise.all(files.concat(extra).map(get)), a=all.slice(0,files.length), ex=all.slice(files.length);
  // every file but the weekly snapshot is needed for the numbers to be right. If one did not arrive, say so and draw nothing, because numbers built without it look normal and are wrong
  // A file that arrives but holds nothing useful is treated the same way, for example a scan with no players on your team or a schedule with no games
  const obj=x=>!!x && typeof x==='object' && !Array.isArray(x), full=x=>obj(x) && Object.keys(x).length>0;
  const okShape=[x=>obj(x)&&Array.isArray(x.weeks)&&x.weeks.length>0&&x.weeks.every(w=>w&&Array.isArray(w.games))&&full(x.teams),
    x=>obj(x)&&full(x.games)&&Object.keys(x.games).some(t=>Array.isArray(x.games[t])&&x.games[t].length>0),
    x=>obj(x)&&full(x.p), x=>obj(x)&&full(x.p),
    x=>obj(x)&&typeof x.at==='string'&&isFinite(Date.parse(x.at))&&obj(x.rosters)&&Array.isArray(x.rosters[ME])&&x.rosters[ME].length>0&&Object.keys(x.rosters).every(t=>Array.isArray(x.rosters[t])),
    ()=>true, x=>obj(x)&&full(x.p)];
  D.miss=files.filter((f,i)=>!okShape[i](a[i]));
  if(D.miss.length){ D.loading=false; D.loaded=false; render(); return; }
  D.league=a[0]; D.sched=a[1]; D.prior=a[2]; D.players=a[3]; D.scan=a[4]; D.week=(a[5]&&a[5].rosters)?a[5]:a[4]; D.jc=a[6]; loadJC();
  D.news=(obj(ex[0])&&obj(ex[0].p))?ex[0]:null; D.ages=(obj(ex[1])&&obj(ex[1].p))?ex[1]:null; D.plan=(obj(ex[2])&&okPlan(ex[2].roles))?ex[2]:null; if(D.plan) setRules(D.plan); D.jl=(obj(ex[3])&&obj(ex[3].p))?ex[3]:null; D.depth=(obj(ex[4])&&obj(ex[4].p)&&obj(ex[4].t))?ex[4]:null; D.prior2=(obj(ex[5])&&obj(ex[5].p))?ex[5]:null; D.prev=(obj(ex[6])&&obj(ex[6].q))?ex[6]:null; loadDepth(); loadMg();
  D.gset={}; if(D.sched) Object.keys(D.sched.games).forEach(t=>D.gset[t]=new Set(D.sched.games[t]));
  D.loading=false; D.loaded=true;
  // Josh's newest ranks go to the board before anything is built from it. This comes after the load is marked done, because the board draws again and asks this tab for its numbers
  loadJL();
  // the draft board only needs the nine cat picture, so the heavy trade scoring waits until the tab is opened
  if(LITE && !document.body.classList.contains('moves')) return;
  compute(true);
}
/* a short plain summary for the daily scan report */
function summary(){
  if(!CTX || !PK || !TR) return ERR?'error, '+ERR:'not ready';
  const c=CTX, me=RACE.rows.find(r=>r.tid===ME), o=[], pl=planOf(), pt=planTable(c,pl), nm=a=>a.map(p=>p.name).join(' and '), cl=a=>a.map(x=>CATS[x]).join(' ');
  o.push('scan '+c.scan.at+', week '+c.wk.n+' vs '+((c.teams[c.opp]||{}).name||'none'));
  if(WK) o.push('week win chance '+pc(WK.win)+' percent, '+(c.act?'leading ':'favored in ')+WK.fav+' of 9 cats, cat chances '+WK.probs.map((p,i)=>CATS[i]+' '+pc(p)).join(', ')); else o.push('no matchup found for this week');
  o.push('average week '+pc(c.base[ME].week)+' percent, rank '+me.pos+' of 10, top four chance '+pc(me.top4)+' percent, record '+(me.rec.w||0)+' wins '+(me.rec.l||0)+' losses');
  o.push('plan'+(pl.start?'':' (changed)')+', locks '+cl(pl.lock)+', build pool '+cl(pl.build)+', punt '+(cl(pl.punt)||'none')+', plan cats on target '+pt.hit+' of '+pt.of+', plan week '+pc(pt.week)+' percent'+(pt.risk.length?', locks at risk '+cl(pt.risk.map(r=>r.c)):'')+(TR.lead?', leading route '+cl(TR.lead):''));
  o.push('adds left for week '+c.wk.n+' '+c.addsNow+(PK.week && PK.week.n!==c.wk.n?', pickups below are scored for week '+PK.week.n+' which has '+PK.adds+' adds left':', pickups below are scored for week '+c.wk.n)+', waiver spot '+((c.teams[ME]||{}).waiver||'unknown')+(PK.ilMove&&!PK.free?', IL move open for '+PK.ilMove.name:'')+(PK.free?', open roster spots '+PK.free:''));
  { const U=Object.values(c.U), dm=U.filter(p=>p.dep), fl=U.filter(p=>p.fill); o.push(DP?'depth chart '+DP.day+', '+dm.length+' lines moved by it'+(fl.length?', filling in '+fl.map(p=>p.name+' for '+p.fill.who.name).join(', '):', nobody filling in'):'no depth chart in use'); }
  PK.list.slice(0,4).forEach((r,i)=>o.push('pickup '+(i+1)+', need '+r.need+', '+r.p.name+(r.drop?', drop '+r.drop.name:', no drop')+', '+r.tag+', '+r.labels.join(' and ').toLowerCase()+(Math.round(100*r.cut)>=1?', tag cut '+Math.round(100*r.cut)+' percent':'')+(r.built.length?', builds '+cl(r.built):'')+', '+(r.wd?'waivers until '+nice(r.wd):r.waiver?'on waivers':'free agent')));
  if(CH) o.push('trade chips, '+(CH.list.length?CH.list.map(r=>r.p.name+' '+r.score+' '+(r.call==='grab'?'grab tonight':'watch')+(r.call==='grab'&&r.drop?' drop '+r.drop.name:'')+(r.call==='grab'?' bail under '+r.bail+' minutes':'')).join(', '):'none worth chasing'));
  if(WV){ o.push('waivers, '+(WV.onW.length?WV.onW.map(r=>r.p.name+' '+(r.call==='pick'?'pick up now':r.call==='watch'?'watch'+(r.watch==='mins'?' for '+r.need+' minutes':' for his return'):'skip')+' season '+(r.gR>=0?'+':'')+r1(r.gR)+(r.wd?' clears '+nice(r.wd):'')+(r.by?' dropped by '+((c.teams[r.by.team]||{}).name||r.by.team):'')).join(', '):'nobody on waivers')+(WV.longer.length?', best long term free agent '+WV.longer[0].p.name+' '+(WV.longer[0].call==='pick'?'pick up now':WV.longer[0].call==='watch'?'watch':'skip')+' season +'+r1(WV.longer[0].gR)+(WV.longer[0].drop?' drop '+WV.longer[0].drop.name:''):', no long term free agent lifts the season')); }
  if(TR.note) o.push(TR.note);
  else { if(!TR.list.length) o.push('hold, no trade both helps the plan and looks fair on the box score, '+TR.count+' offers checked');
    TR.list.slice(0,3).forEach((t,i)=>{ const wn=t.get.map(p=>getWarn(p)||(p.status?p.name+' is tagged '+statusWord(p.status):'')).filter(Boolean); o.push('on plan trade '+(i+1)+(t.urgent?' urgent':'')+', '+t.sell+' sell'+', with '+((CTXW.teams[t.o]||{}).name||'')+', give '+nm(t.give)+', get '+nm(t.get)+(t.built.length?', builds '+cl(t.built):'')+(t.spent.length?', spends '+cl(t.spent):'')+', plan gain '+r1(t.myGain)+', their change '+r1(t.oGain)+', on the box score they get '+pc(t.face.look)+' percent of what they give'+(wn.length?', warning '+listWords(wn):'')); });
    if(!TR.pivots.length) o.push('no pivot beats the plan');
    TR.pivots.slice(0,2).forEach((t,i)=>o.push('pivot '+(i+1)+', '+(t.broke.length?'gives up '+cl(t.broke):'leans on a low cat')+', with '+((CTXW.teams[t.o]||{}).name||'')+', give '+nm(t.give)+', get '+nm(t.get)+', gain '+r1(t.myGain)+' against '+r1(TR.bestPlan||0)+' on plan')); }
  const out=c.ros[ME].filter(p=>p.status).map(p=>p.name+' '+statusWord(p.status)); if(out.length) o.push('my injury tags, '+out.join(', '));
  const nw=c.ros[ME].filter(p=>p.news && (p.news.st || p.news.note)).map(p=>p.name+(p.news.st==='Out'?' out'+(p.ret?' until '+p.ret:''):p.news.st?' day to day':'')+(p.news.note?' ('+(p.news.dir||'neutral')+') '+p.news.note:'')); if(nw.length) o.push('my news, '+nw.join(' ; ')); else if(D.news) o.push('no news items on my roster, news file made '+(typeof D.news.made==='string'?D.news.made:'at an unknown time')); else o.push('no news file loaded');
  { const all=Object.keys(JLI), mine=c.ros[ME].filter(p=>p.jl).map(p=>p.name+' '+(p.jl.was||p.jl.base||'none')+' to '+p.jl.rank+(p.jl.at?' on '+p.jl.at:''));
    if(all.length) o.push('josh updates on file for '+all.length+' players, newest '+(all.map(k=>JLI[k].at).filter(Boolean).sort().pop()||'undated')+(mine.length?', on my roster '+mine.join(' ; '):', none on my roster')); else o.push('no josh updates on file'); }
  return o.join(' ~ ');
}
/* the nine cat picture for the draft board panel. It loads the data if needed, builds the numbers without scoring trades, and hands back one row for each cat */
function cats(cb){
  const go=()=>{ try{ if(!CTX) CTX=build(D.scan); const pl=planOf(), pt=planTable(CTX,pl); cb({at:D.scan.at,hit:pt.hit,of:pt.of,week:pt.week,weekN:pt.weekN,rows:pt.rows.map(r=>({c:r.c,name:CATS[r.c],role:ROLEWORD[r.role],p:r.p,rank:r.rank,fav:r.fav,st:r.st}))}); }catch(e){ cb(null); } };
  if(D.loaded) go(); else if(D.miss && D.miss.length) cb(null); else { LITE=true; load().then(()=>{ if(D.loaded) go(); else cb(null); },()=>cb(null)); }
}
/* checkOffer scores any offer with every rule the trade search uses, and says which rule would stop it.
   Use it in chat before quoting any trade number. NCWMoves.checkOffer('4',[giveIds],[getIds]) */
function checkOffer(o,giveIds,getIds){ const ctx=CTXW, U=ctx.U, give=giveIds.map(i=>U[String(i)]), get=getIds.map(i=>U[String(i)]); if(give.some(p=>!p)||get.some(p=>!p)) return {err:'unknown player id'};
  const pl=planOf(), env=tradeEnv(ctx,pl); env.spotV=TR?TR.spot:spotValue(ctx,pl,env); const stops=[];
  if(give.length>2||get.length>2||give.length<get.length) stops.push('the search only tries one for one, two for two and two for one where you send two');
  give.forEach(p=>{ const k=B.nkey(p.name); if(p.own!==ME) stops.push(p.name+' is not yours'); if(NEVER.has(k)) stops.push('Kyrie is never offered'); if(HOLD[k] && env.today<HOLD[k]) stops.push(p.name+' is held until '+HOLD[k]); });
  get.forEach(p=>{ if(p.own!==o) stops.push(p.name+' is not on that team'); });
  const fair=fairOf(give,get), face=faceOf(give,get);
  if(face.insult) stops.push('insults them on face value, they get '+pc(face.look)+' percent of what they give'); else if(!face.ok) stops.push(face.look>face.cap?'overpays on face value, they get '+pc(face.look)+' percent of what they give':'fails face value, they get '+pc(face.look)+' percent of what they give and need '+pc(face.need));
  if(fair.look<fair.need-ASKROOM || fair.look>fair.cap) stops.push('fails the value scale, look '+r1(100*(fair.look-1))+' percent their way');
  if(ctx.ros[ME].filter(isCA).length-give.filter(isCA).length+get.filter(isCA).length<3) stops.push('leaves you under 3 centers');
  if(ctx.ros[o].filter(isCA).length-get.filter(isCA).length+give.filter(isCA).length<2) stops.push('leaves them under 2 centers');
  const js=joshSide(give,get); if(js==='lose') stops.push('you lose by Josh ranks');
  const two=give.length>get.length; let cut=null; if(two){ const worst=ctx.ros[o].filter(p=>p.proj).sort((a,b)=>(a.val+14)*(ctx.ug[a.id]||0)-(b.val+14)*(ctx.ug[b.id]||0)); cut=worst.find(p=>!get.includes(p))||null; }
  const Tm=scaleT(seasonTotals(ctx,ME,give,get),1/ctx.tweeks); if(two) TK.forEach(q=>Tm[q]+=ctx.stream[q]);
  const To=scaleT(seasonTotals(ctx,o,cut?get.concat([cut]):get,give),1/ctx.tweeks); const over={}; over[o]=To; const v=myView(ctx,Tm,over);
  const gain=100*(planWeekOf(ctx,v.prs,pl,false)-env.basePlan)-(two?env.spotV:0); const broke=env.guard.filter(c=>env.hit(c,v.per[c],v.fav[c]));
  if(gain<0.3) stops.push('plan gain under 0.3'); if(broke.length) stops.push('breaks '+broke.map(c=>CATS[c]).join(' ')+', so at best a pivot');
  const typ=Object.assign({},ctx.typ); typ[ME]=Tm; typ[o]=To;
  return {planGain:r1(gain),nineCatBefore:pc(ctx.view0.weekN),nineCatAfter:pc(v.weekN),theirChange:r1(100*(strength(ctx,o,typ).week-ctx.base[o].week)),look:r1(100*(fair.look-1)),face:pc(face.look),faceNeed:pc(face.need),josh:js,broke:broke.map(c=>CATS[c]),cut:cut?cut.name:null,listed:!stops.length,stops}; }
if(INW){ workerMain(); return; }
window.NCWMoves={summary,cats,show:()=>{ MODE='moves'; document.body.classList.add('moves'); LITE=false; if(!D.loaded) load(); else if(!PK) compute(true); else render(); }, hide:()=>document.body.classList.remove('moves'), showMgr:()=>{ MODE='mgr'; document.body.classList.add('moves'); LITE=false; if(!D.loaded) load(); else if(!PK) compute(true); else render(); }, state:()=>({D,CTX,CTXW,TR,PK,WV,CH,WK,RACE,ST}), recompute:()=>compute(true), checkOffer, _fn:{waivers,chips,seasonRanks,tierOf,dropOK,injClass,slumpOf,proofOf,pitchText,mgOf,okMgr,sellKit,fitWin,weekTags,build,thisWeek,pickups,trades,race,planOf,mkPlan,planTable,planPr,planWeekOf,myView,routeSets,fitsRoute,fairOf,seenValues,sellKit,rankIn,catVal,PLAN0,FLOOR,FAVMIN,TARGET,seasonTotals,dayAdd,seat,pNow,pROS,addsLeft,tradeForYou,tradeFair,seenWords,seenOf,acceptOf,teamRank,setMg,mgrPage,mgView,SEENW,SEENWL,seenW,tagCut,rankShare,loadJL,joshMove,catProbs,pWin5,totalsOver,lineup,elig,project,valOf,zLine,lineFromZ,wPr,flipNet,balance,strength,WT,WP,applyJC,jcOf,loadJC,jcCall,jcTags,tradeCats}};
})();
