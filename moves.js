/* Nine Cat War Room, Pickups and Trades tab.
   Reads the daily Yahoo scan in data/scan.json, the weekly snapshot in data/scan_week.json, the NBA schedule, last season's numbers and the board's own player model.
   Everything here is read only. It never talks to Yahoo. All numbers are model estimates. */
(function(){
'use strict';
const B=window.NCW; if(!B) return;
const $=id=>document.getElementById(id);
const esc=B.esc;
const CATS=['FG%','FT%','3PM','PTS','REB','AST','STL','BLK','TO'];
const CATWORD=['field goal percentage','free throw percentage','threes','points','rebounds','assists','steals','blocks','turnovers'];
const CK=['tpm','pts','reb','ast','stl','blk','to'];
const TK=['fgm','fga','ftm','fta','tpm','pts','reb','ast','stl','blk','to'];
const SLOTS=['PG','SG','G','SF','PF','F','C','C','Util','Util'];
const KAP={tpm:1.3,pts:2.6,reb:1.3,ast:1.3,stl:1.1,blk:1.2,to:1.1};
const LEGEND=new Set(['lebron james','stephen curry','kevin durant','giannis antetokounmpo','nikola jokic','joel embiid','kawhi leonard','james harden','damian lillard','kyrie irving','anthony davis','luka doncic','jimmy butler','paul george','victor wembanyama','shai gilgeous alexander','jayson tatum','anthony edwards']);
const NEVER=new Set(['kyrie irving']);
const HOLD={'cameron boozer':'2027-01-15'};
const REPL_LINE={mp:22,fgm:3.2,fga:7.2,ftm:1.2,fta:1.6,tpm:1.0,pts:8.6,reb:3.6,ast:2.0,stl:0.7,blk:0.4,to:1.1};
const PALIAS={'nic claxton':'nicolas claxton','alex sarr':'alexandre sarr','bub carrington':'carlton carrington','herb jones':'herbert jones','cam johnson':'cameron johnson','bones hyland':'nahshon hyland','gg jackson':'gregory jackson','moe wagner':'moritz wagner'};
/* how much each cat counts when a move is judged. Order is FG%, FT%, 3PM, PTS, REB, AST, STL, BLK, TO.
   Trades lean on the seven solid cats. The waiver wire is closer to normal. This week's matchup, the league table and every win chance on screen use normal scoring. */
const WT=[0.5,0.65,1,1,1,1,1,1,1];
const WP=[0.8,0.9,1,1,1,1,1,1,1];
const KEY='ncw_moves_v1';
const ME='11';
const D={};
let ST={marks:[],small:false,at:''};
// a saved state that is damaged is cleaned on load, so one bad entry can never break the tab
const okMark=m=>!!m && typeof m==='object' && ((m.type==='add' && typeof m.add==='string' && m.add!=='') || (m.type==='trade' && m.withTeam!=null && Array.isArray(m.give) && Array.isArray(m.get)));
try{ const j=JSON.parse(localStorage.getItem(KEY)||'null'); if(j && typeof j==='object'){ ST.marks=Array.isArray(j.marks)?j.marks.filter(okMark):[]; ST.small=!!j.small; ST.at=typeof j.at==='string'?j.at:''; } }catch(e){}
const save=()=>{ try{ localStorage.setItem(KEY,JSON.stringify(ST)); }catch(e){} };

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const PHI=x=>1/(1+Math.exp(-1.702*x));
// a weighted cat is pulled toward a coin flip, so a 10 point edge in a half weight cat counts as 5
const wPr=(pr,w)=>pr.map((p,c)=>0.5+w[c]*(p-0.5));
const pWin5=probs=>{ let dp=[1]; for(const p of probs){ const nx=new Array(dp.length+1).fill(0); for(let k=0;k<dp.length;k++){ nx[k]+=dp[k]*(1-p); nx[k+1]+=dp[k]*p; } dp=nx; } let s=0; for(let k=5;k<dp.length;k++) s+=dp[k]; return s; };
const r0=x=>Math.round(x), r1=x=>Math.round(x*10)/10;
const pc=x=>Math.round(100*x);
const sgn=x=>(x>=0?'+':'')+r1(x);

/* dates, all in US Eastern because that is how the NBA and Yahoo count game days */
function etParts(dt){ const f=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(dt); const o={}; f.forEach(x=>o[x.type]=x.value); return {date:o.year+'-'+o.month+'-'+o.day,hour:(+o.hour)%24,min:+o.minute||0}; }
const nowDate=()=>window.NCW_NOW?new Date(window.NCW_NOW):new Date();
const addDays=(s,n)=>{ const d=new Date(s+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); };
const dayList=(a,b)=>{ const o=[]; for(let d=a; d<=b; d=addDays(d,1)) o.push(d); return o; };
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const nice=iso=>{ const m=+iso.slice(5,7), d=+iso.slice(8,10); return MON[m-1]+' '+d; };
function waiverDate(code){ const m=String(code||'').match(/^W([A-Za-z]{3})(\d{1,2})$/); if(!m) return null; const mo=MON.indexOf(m[1]); if(mo<0) return null; return (mo>=8?2026:2027)+'-'+String(mo+1).padStart(2,'0')+'-'+String(+m[2]).padStart(2,'0'); }

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
const jcOf=name=>{ const k=B.nkey(name); return JCI[k]||JCI[BALIAS[k]]||JCI[PALIAS[k]]||null; };
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
  const s=scan.stats&&scan.stats[p.id]; let cur=null, gp=0; p.g14=null; p.m14=null; p.v14=null;
  if(s){ gp=s[1]||0; cur={mp:s[2]||0}; TK.forEach((k,i)=>cur[k]=s[3+i]||0); p.g14=s[14]; p.m14=s[15]; p.v14=s[16]; }
  if(cur&&gp<1) cur=null;
  let w=0, line=null;
  // a real last season counts like 12 games, an older season like 9, a rookie guess like 6
  if(cur){ const pp=prior||REPL_LINE; w=gp/(gp+(!prior?6:pb==='est'?6:pb==='older'?9:12)); line=mixLine(pp,cur,w); if(mpSoft && cur.mp>5){ line.mp=cur.mp; mpSoft=false; } } else line=prior;
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
// a tag this code does not know is read as questionable, never as healthy
const pNow=p=>isIL(p)||isOut(p)?0:!p.status?0.96:/^P$/i.test(p.status)?0.9:isDoubt(p)?0.25:0.6;
const pROS=p=>p.av*(isIL(p)&&isOut(p)?0.6:1);

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
    addT(T,p.proj,p._pr*w); if(ug) ug.set(p.id,(ug.get(p.id)||0)+w); }
  T.s+=n*w;
  if(!m) return;
  // _vd[k] is the chance that k starting spots are open. Bench players take them in order when they are fit
  for(let i=0;i<ps.length;i++){ const p=ps[i]; if(p._st) continue; const open=1-_vd[0]; if(open<1e-9) break; const a=p._pr, c=a*open;
    addT(T,p.proj,c*w); if(ug) ug.set(p.id,(ug.get(p.id)||0)+c*w);
    for(let k=1;k<=m;k++){ _vd[k-1]+=a*_vd[k]; _vd[k]*=(1-a); } }
  if(repl){ let left=0; for(let k=1;k<=m;k++) left+=k*_vd[k]; if(left>1e-9) addT(T,repl,left*rho*w); }
}
function totalsOver(ros,days,prob,fill,dayW){
  const T=zeroT(), ug=new Map(), rho=fill?fill.rho:0, repl=fill?fill.line:null;
  if(!ros) return {T,ug};
  for(const day of days){
    const w=dayW&&dayW[day]!=null?dayW[day]:1;
    const play=[];
    for(const p of ros){ if(!p.proj || !playsOn(p.team,day)) continue; const pr=prob(p); if(pr<=0) continue; p._pr=pr; play.push(p); }
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
  Object.keys(ctx.ros).forEach(t=>{ ctx.dl[t]=days.map(d=>ctx.ros[t].filter(p=>p.proj && pROS(p)>0 && playsOn(p.team,d)).sort((a,b)=>b.val-a.val)); ctx.dT[t]=new Array(days.length).fill(null); });
}
function playDays(ctx,p){ let a=ctx.pd.get(p.id); if(!a){ a=new Uint8Array(ctx.tdays.length); if(p.proj && pROS(p)>0) for(let d=0;d<a.length;d++) if(playsOn(p.team,ctx.tdays[d])) a[d]=1; ctx.pd.set(p.id,a); } return a; }
function seasonTotals(ctx,tid,outs,ins){
  const T=zeroT(), L=ctx.dl[tid], C=ctx.dT[tid], repl=ctx.fillR.line, rho=ctx.fillR.rho, nd=ctx.tdays.length;
  const insS=ins.slice().sort((a,b)=>b.val-a.val), po=outs.map(p=>playDays(ctx,p)), pi=insS.map(p=>playDays(ctx,p));
  for(let d=0;d<nd;d++){
    let hit=false; for(let j=0;j<po.length;j++) if(po[j][d]){ hit=true; break; } if(!hit) for(let j=0;j<pi.length;j++) if(pi[j][d]){ hit=true; break; }
    const base=L[d];
    if(!hit){ let c=C[d]; if(!c){ c=C[d]=zeroT(); for(let i=0;i<base.length;i++) base[i]._pr=pROS(base[i]); dayAdd(c,null,base,1,repl,rho); }
      T.fgm+=c.fgm; T.fga+=c.fga; T.ftm+=c.ftm; T.fta+=c.fta; T.tpm+=c.tpm; T.pts+=c.pts; T.reb+=c.reb; T.ast+=c.ast; T.stl+=c.stl; T.blk+=c.blk; T.to+=c.to; T.g+=c.g; T.s+=c.s; continue; }
    const list=[]; let ii=0;
    for(let i=0;i<base.length;i++){ const p=base[i]; if(outs.indexOf(p)>=0) continue; while(ii<insS.length && insS[ii].val>p.val){ if(pi[ii][d]) list.push(insS[ii]); ii++; } list.push(p); }
    while(ii<insS.length){ if(pi[ii][d]) list.push(insS[ii]); ii++; }
    for(let i=0;i<list.length;i++) list[i]._pr=pROS(list[i]);
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

/* market value, how a player looks to the average manager in the Yahoo app */
const vr=r=>100*Math.exp(-(Math.max(1,r)-1)/40); const REPLV=vr(140);
function marketRank(p,ctx){ const pick=pickOf[B.nkey(p.name)]; const pre=pick?0.6*pick+0.4*(p.pre||pick):(p.pre||185); const wc=clamp(ctx.avgGP/25,0,0.7); return (1-wc)*pre+wc*(p.cur||pre); }
function vm(p,ctx){ const k=B.nkey(p.name); const pts=p.proj?p.proj.pts:0; let v=vr(marketRank(p,ctx))*(LEGEND.has(k)?1.15:1)*(pts>=25?1.10:pts>=20?1.05:1);
  if(p.v14!=null && p.g14>=3) v*=1+clamp((p.v14-p.val)/40,-0.08,0.08);
  if(isOut(p)) v*=0.75; else if(p.status && !/^P$/i.test(p.status)) v*=0.96;
  return Math.max(0,v-REPLV); }
function vj(p,ctx){ const b=p.b; if(!b) return vm(p,ctx); return Math.max(0,vr(b.josh||b.tgt||b.rank)-REPLV); }
const dw=arr=>arr.slice().sort((a,b)=>b-a).reduce((s,x,i)=>s+x*([1,0.75,0.5][i]||0.4),0);
const isC=p=>p.pos.includes('C');

/* build the league from a scan */
function build(scan){
  const ctx={scan,U:{},ros:{},avail:[],teams:{},notes:[]};
  const P=(D.players&&D.players.p)||{};
  const mk=id=>{ if(ctx.U[id]) return ctx.U[id]; const a=P[id]||['Player '+id,'','',null]; const p={id,name:a[0],team:a[1],pos:String(a[2]||'').split(',').filter(Boolean),pre:a[3],own:null,slot:'',status:'',fa:''}; ctx.U[id]=p; return p; };
  (scan.teams||[]).forEach(t=>{ ctx.teams[t.id]=t; });
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
  Object.values(ctx.U).forEach(p=>{ p.mv=vm(p,ctx); p.jv=vj(p,ctx); });
  // waiver level in this league, the average of the free agents ranked 3rd to 10th right now
  const fas=ctx.avail.filter(p=>p.proj&&!isOut(p)).sort((a,b)=>b.val-a.val).slice(2,10); const rl=zeroT(); if(fas.length>=4) fas.forEach(p=>addT(rl,p.proj,1/fas.length)); else addT(rl,REPL_LINE,1);
  ctx.repl=rl; ctx.fillR={rho:0.8,line:rl}; ctx.fillW={rho:0.5,line:rl};
  Object.values(ctx.U).forEach(p=>{ if(p.proj) p.eff=effLine(p,pROS(p),ctx.fillR); });
  timeline(ctx); typical(ctx);
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
  ctx.tdays=from<=last?dayList(from,last):[]; ctx.tweeks=Math.max(1,ctx.tdays.length/7);
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
  const myW=oppWeights(ctx,ME), b0=strength(ctx,ME,ctx.typ,WP), myCn=active.filter(isC).length;
  // the rest of season lift, with your daily lineups set again for the changed roster, so a player who cannot get into your lineup adds little
  const rosLift=(inP,outP)=>{ const T=scaleT(seasonTotals(ctx,ME,outP?[outP]:[],[inP]),1/ctx.tweeks); let wk=0; Object.keys(myW).forEach(o=>{ wk+=myW[o]*pWin5(wPr(catProbs(T,ctx.typ[o],ctx.u,ctx.up),WP)); }); return 100*(wk-b0.week); };
  const cands=ctx.avail.filter(p=>p.proj && !isOut(p) && p.team);
  const openSpot=out.free>0 || !!out.ilMove;
  const rows=[];
  for(const c of cands){
    const wd=waiverDate(c.fa), start=wd&&wd>ctx.addDay?wd:ctx.addDay; const gl=days.filter(d=>d>=start&&playsOn(c.team,d)).length;
    let best=null;
    const opts=openSpot?[null]:drops;
    for(const d of opts){
      if(d && isC(d) && !isC(c) && myCn<=3) continue; // never drop below three centers
      const ros=mine.filter(p=>p!==d && !(out.ilMove && !out.free && p===out.ilMove)).concat([c]);
      const t=mk(ros,start), pr=catProbs(t,opT,ctx.u,ctx.up), gW=100*(pWin5(wPr(pr,WP))-bwW), gWt=100*(pWin5(pr)-bw);
      const gR=rosLift(c,d);
      const hold=0.4*gW+0.6*gR, stream=0.85*gW; const g=Math.max(hold,stream);
      if(!best || g>best.g) best={drop:d,gW,gWt,gR,g,kind:hold>=stream?'hold':'stream',pr,use:t.ug.get(c.id)||0};
    }
    if(!best) continue;
    rows.push(Object.assign({p:c,gl,wd,il:(!best.drop && !out.free && out.ilMove)?out.ilMove.id:null},best));
  }
  rows.sort((a,b)=>b.g-a.g);
  const top=rows.slice(0,40);
  const urgent=mine.filter(p=>prot.has(p.id) && (isOut(p)));
  for(const r of top){
    const p=r.p, b=p.b; let need=100*(1-Math.exp(-Math.max(0,r.g)/3.5)); const why=[];
    if(p.role==='up'){ need+=6; why.push('minutes are up'); } else if((p.m14||0)>=28 || (p.gp<3 && p.prior && p.prior.mp>=28)){ need+=4; why.push('steady starter minutes'); }
    if(p.v14!=null && p.g14>=3 && p.role!=='up' && p.v14-p.val>4){ need-=6; why.push('hot stretch without extra minutes'); }
    r.josh=0; if(b && b.josh){ const yr=p.cur||p.pre||200; if(yr-b.josh>=25){ need+=6; r.josh=1; } else if(b.josh-yr>=30){ need-=6; r.josh=-1; } }
    if(b && (b.upside||b.gem)) need+=3;
    r.cover=null; for(const u of urgent){ if(u.pos.some(x=>p.pos.includes(x))){ need+=8; r.cover=u; break; } }
    const sim=top.filter(o=>o!==r && o.g>=0.8*r.g && r.g>0.3).length; r.sim=sim; if(sim>=4) need-=8; else if(sim>=2) need-=4;
    // a waiver date that has already passed means he has cleared and is a free agent
    if(r.wd && r.wd<=ctx.now.date) r.wd=null;
    r.waiver=!!r.wd || p.fa==='W'; if(r.waiver) need-=6;
    if(out.adds<=0) need-=20; else if(out.adds===1 && ctx.pdays.length>=4) need-=4;
    if(out.wait>2) need-=Math.min(15,3*(out.wait-2));
    r.bal=balance(ctx,r.drop?[r.drop]:[],[p]); need*=r.bal.mult;
    r.need=clamp(Math.round(need),0,99);
    const dc=r.pr.map((x,c)=>100*(x-bp[c])); r.dc=dc;
    const bestCat=dc.map((v,c)=>[v,c]).sort((a,b)=>b[0]-a[0])[0];
    r.tag=r.cover?'Covers an injury':(r.kind==='stream'&&r.gR<0.2)?'Stream for games':(b&&(b.upside||b.rookie)&&r.gW<0.5)?'Stash for upside':('Boosts '+CATS[bestCat[1]]);
    r.early=r.tag==='Stream for games' && out.wait>3; if(r.early) r.need=Math.min(r.need,60);
    r.band=r.need>=85?'must':r.need>=65?'strong':r.need>=50?'helps':'skip';
    r.why=why;
  }
  out.list=top.filter(r=>r.g>0.05).sort((a,b)=>b.need-a.need||b.g-a.g).slice(0,14);
  return out;
}
function addsLeft(ctx,week){ const L=D.league, wk=week||ctx.wk, tx=ctx.scan.tx||[]; let used=0;
  tx.forEach(x=>{ if(x[1]!==ME) return; const m=String(x[0]).match(/^([A-Za-z]{3})(\d{1,2})$/); if(!m) return; const mo=MON.indexOf(m[1]); if(mo<0) return; const d=(mo>=8?2026:2027)+'-'+String(mo+1).padStart(2,'0')+'-'+String(+m[2]).padStart(2,'0'); if(d>=wk.start && d<=wk.end) used+=(String(x[2]).match(/\+/g)||[]).length; });
  // an add you marked counts the same way a scanned one does, only when its day falls inside that week
  used+=ST.marks.filter(m=>m.type==='add' && (m.day?(m.day>=wk.start && m.day<=wk.end):(wk.n===ctx.wk.n && ctx.now.date>=wk.start))).length; return Math.max(0,(L.adds||4)-used); }

/* trades */
function trades(ctx,done,live){
  const res={list:[],count:0,hidden:0,pass:0,base:ctx.base[ME]}; const L=D.league;
  const today=ctx.now.date; if(L.tradeDeadline && today>L.tradeDeadline){ res.note='The trade deadline has passed.'; done(res); return; }
  const mine=ctx.ros[ME].filter(p=>p.proj && !NEVER.has(B.nkey(p.name)) && !(HOLD[B.nkey(p.name)] && today<HOLD[B.nkey(p.name)]));
  const opps=Object.keys(ctx.ros).filter(t=>t!==ME);
  const combos=(arr,k)=>{ if(k===1) return arr.map(x=>[x]); const o=[]; for(let i=0;i<arr.length;i++) for(let j=i+1;j<arr.length;j++) o.push([arr[i],arr[j]]); return o; };
  const gives={1:combos(mine,1),2:combos(mine,2)};
  const W={}; Object.keys(ctx.ros).forEach(t=>W[t]=oppWeights(ctx,t));
  // my side is judged with the solid cat weights, their side on normal scoring since that is how they see it
  const baseN=ctx.base[ME], baseW=strength(ctx,ME,ctx.typ,WT);
  const mineOf=typ=>{ const w=W[ME]; let s=0; const per=new Array(9).fill(0); for(const o in w){ const pr=catProbs(typ[ME],typ[o],ctx.u,ctx.up); s+=w[o]*pWin5(wPr(pr,WT)); for(let c=0;c<9;c++) per[c]+=w[o]*pr[c]; } return {week:s,per}; };
  const weekOf=(tid,typ)=>{ const w=W[tid]; let s=0; Object.keys(w).forEach(o=>{ s+=w[o]*pWin5(catProbs(typ[tid],typ[o],ctx.u,ctx.up)); }); return s; };
  // what you would gain by simply dropping a player for a streaming spot, so a two for one is never credited for that
  const dcache={};
  const dropEx=p=>{ if(dcache[p.id]!=null) return dcache[p.id]; const T=scaleT(seasonTotals(ctx,ME,[p],[]),1/ctx.tweeks); TK.forEach(k=>T[k]+=ctx.stream[k]); const typ=Object.assign({},ctx.typ); typ[ME]=T; return dcache[p.id]=Math.max(0,100*(strength(ctx,ME,typ,WT).week-baseW.week)); };
  // An open roster spot is worth something on its own, and you can open one any day by dropping your least useful player for a streamer.
  // So a two for one is credited only for what it adds beyond that, whoever the two outgoing players are
  const spotOf=()=>{ let b=0; ctx.ros[ME].forEach(p=>{ const k=B.nkey(p.name); if(p.proj && !isIL(p) && !NEVER.has(k) && !(HOLD[k] && today<HOLD[k])) b=Math.max(b,dropEx(p)); }); return b; }; let spotV=null;
  // by Josh's overall ranks, do you give up clearly more than you get. Such a deal is never shown, so it is not scored either
  const joshOf=(give,get)=>{ const gJ=dw(give.map(p=>p.jv)), rJ=dw(get.map(p=>p.jv)), j=rJ-gJ; return {j,side:j<-Math.max(6,0.2*gJ)?'lose':j>Math.max(4,0.15*Math.max(gJ,rJ))?'win':'even'}; };
  // Scoring every offer takes a few seconds on a slow phone, so the work stops every 40 thousandths of a second to let the page answer a tap, then picks up where it left off.
  // live says whether this run is still the newest one. An older run stops quietly
  const out=[]; let seen=0; const clock=()=>(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();
  const work=function*(){ let t0=clock();
   for(const o of opps){
    const their=ctx.ros[o].filter(p=>p.proj);
    const gets={1:combos(their,1),2:combos(their,2)};
    const worst=their.slice().sort((a,b)=>(a.val+14)*(ctx.ug[a.id]||0)-(b.val+14)*(ctx.ug[b.id]||0));
    for(const sh of [[1,1],[2,2],[2,1]]){
      for(const give of gives[sh[0]]) for(const get of gets[sh[1]]){
        const recvM=dw(give.map(p=>p.mv)), giveM=dw(get.map(p=>p.mv)); if(giveM<=0||recvM<=0) continue;
        const ratio=recvM/giveM; if(ratio<0.9||ratio>1.45) continue;
        const myC=ctx.ros[ME].filter(isC).length-give.filter(isC).length+get.filter(isC).length; if(myC<3) continue;
        const thC=ctx.ros[o].filter(isC).length-get.filter(isC).length+give.filter(isC).length; if(thC<2) continue;
        if(joshOf(give,get).side==='lose') continue;
        seen++;
        if(clock()-t0>40){ yield; t0=clock(); }
        // every offer that gets this far is scored exactly, with both teams' daily lineups set again for the new rosters. No shortcut decides what is dropped
        const two=sh[0]>sh[1]; let cut=null, credit=0;
        if(two){ cut=worst.find(p=>!get.includes(p))||null; if(spotV==null) spotV=spotOf(); credit=spotV; }
        const Tm=scaleT(seasonTotals(ctx,ME,give,get),1/ctx.tweeks); if(two){ const s=ctx.stream; TK.forEach(k=>Tm[k]+=s[k]); }
        // your chance against every other team is known once your side is set. Against this team it can be at most 100 percent, so an offer that cannot reach the bar even then is dropped here
        const typ=Object.assign({},ctx.typ); typ[ME]=Tm;
        { const w=W[ME]; let s=0; for(const x in w) s+=w[x]*(x===o?1:pWin5(wPr(catProbs(Tm,ctx.typ[x],ctx.u,ctx.up),WT))); if(100*(s-baseW.week)-credit<0.3) continue; }
        const To=scaleT(seasonTotals(ctx,o,cut?get.concat([cut]):get,give),1/ctx.tweeks); typ[o]=To;
        const myGain=100*(mineOf(typ).week-baseW.week)-credit; if(myGain<0.3) continue;
        const oGain=100*(weekOf(o,typ)-ctx.base[o].week); if(oGain<-1) continue;
        out.push({o,give,get,ratio,myGain,oGain,cut,credit,two,Tm,To});
      }
    }
   }
  };
  const it=work(); const pump=()=>{ if(live && !live()) return; if(it.next().done) finish(); else setTimeout(pump,0); };
  const score=t=>{
    const top=t.get.some(p=>(pickOf[B.nkey(p.name)]||99)<=20 || LEGEND.has(B.nkey(p.name)));
    t.top=top; t.acc=clamp(1/(1+Math.exp(-(7*(Math.min(t.ratio,1.6)-1.03)+0.3*t.oGain+0.25*(t.need||0)-(top?1:0)-(t.two?0.4:0)))),0.03,0.92);
    const gJ=dw(t.give.map(p=>p.jv)), rJ=dw(t.get.map(p=>p.jv)); t.josh=rJ-gJ;
    // fairness by Josh Lloyd's overall ranks. Even means the two sides are close in his value. A deal where you give up clearly more than you get is never shown
    t.jside=t.josh<-Math.max(6,0.2*gJ)?'lose':t.josh>Math.max(4,0.15*Math.max(gJ,rJ))?'win':'even';
    t.bal=balance(ctx,t.give,t.get);
    // a deal that also helps them by the numbers ranks ahead of one that only looks good to them. Position balance moves the score 5 to 8 percent
    t.score=t.myGain*t.acc*(1+clamp(t.josh,-15,15)/60)*(t.oGain>=0?1:0.6)*t.bal.mult;
  };
  // the full picture for an offer that passed, from the totals already worked out for it
  const exact=t=>{
    const o=t.o, Tm=t.Tm, To=t.To;
    const typ=Object.assign({},ctx.typ); typ[ME]=Tm; typ[o]=To;
    const sm=strength(ctx,ME,typ,WT), so=strength(ctx,o,typ);
    t.myGain=100*(sm.week-baseW.week)-(t.credit||0); t.oGain=100*(so.week-ctx.base[o].week);
    t.dme=sm.per.map((x,c)=>100*(x-baseN.per[c])); t.dop=so.per.map((x,c)=>100*(x-ctx.base[o].per[c]));
    t.after=sm.weekN; t.oafter=so.week;
    const f=flipNet(baseN.per,sm.per,WT); t.cats=f.n; t.up=f.up; t.dn=f.dn; t.pass=f.n>=0.999;
    const weak=ctx.base[o].per.map((x,c)=>x<0.45?c:-1).filter(c=>c>=0);
    t.weakHelp=weak.filter(c=>t.dop[c]>=1.5); t.need=clamp(weak.reduce((s,c)=>s+t.dop[c],0)/5,-1.5,2.5);
  };
  const finish=()=>{
    // listed by your gain, biggest first. The chance they say yes, Josh's ranks and balance decide what is shown, not the order
    const shown=t=>t.acc>=0.25 && t.jside!=='lose', byGain=(a,b)=>b.myGain-a.myGain||b.score-a.score;
    out.forEach(t=>{ exact(t); score(t); t.Tm=t.To=null; });
    const good=out.filter(t=>t.myGain>=0.3 && t.oGain>=-1.0 && shown(t)).sort(byGain);
    const pick=list=>{ const s2={}, shape={}, o=[]; for(const t of list){ const k=t.o+'|'+t.get.map(p=>p.id).sort().join('+'); if(s2[k]) continue; const sk=t.give.length+'for'+t.get.length; if((shape[sk]||0)>=6) continue; s2[k]=1; shape[sk]=(shape[sk]||0)+1; o.push(t); if(o.length>=14) break; } return o; };
    // the one cat rule. A trade is shown only if it leaves you favored in at least one more cat, counting the weights
    const pass=pick(good.filter(t=>t.pass)), small=pick(good.filter(t=>!t.pass));
    const hurt=ctx.ros[ME].filter(p=>isOut(p) && p.val>0 && myProtected(ctx).has(p.id));
    pass.forEach((t,i)=>{ t.urgent=i<2 && t.oGain>=-0.3 && ((t.myGain>=3 && t.acc>=0.6) || (hurt.length>0 && t.myGain>=1.5 && t.acc>=0.5)); });
    pass.sort((a,b)=>(b.urgent?1:0)-(a.urgent?1:0)||byGain(a,b));
    // the box that shows the smaller trades only changes which of these are listed, so it never has to score anything again
    res.relist=()=>{ res.pass=pass.length; res.hidden=ST.small?0:small.length; res.small=small.length; res.list=ST.small?pass.concat(small).slice(0,14):pass; }; res.relist();
    res.count=seen; res.pool=out.map(t=>t.o+'|'+t.give.map(p=>p.id).join('+')+'|'+t.get.map(p=>p.id).join('+')+'|'+t.myGain.toFixed(4)+'|'+t.oGain.toFixed(4)); done(res);
  };
  setTimeout(pump,0);
}

/* league table and the race for the top four */
function mulberry(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function race(ctx){
  const L=D.league, tids=Object.keys(ctx.ros), rnd=mulberry(82878), N=3000;
  const P={}; tids.forEach(a=>{ P[a]={}; tids.forEach(b=>{ if(a!==b) P[a][b]=pWin5(catProbs(ctx.typ[a],ctx.typ[b],ctx.u,ctx.up)); }); });
  // the records in the scan stop at the week the scan was taken in. A week that has ended since then is in no record yet, so it is played out here too
  // Each team's wins, losses and ties add up to the weeks already in the records, so the first week still to play is read from the records themselves.
  // That holds when the scan is a day old on a Monday and when Yahoo has named the new week but not yet closed the old one
  const recW=tids.length?Math.min.apply(null,tids.map(t=>{ const x=ctx.teams[t]||{}; return Math.round((+x.w||0)+(+x.l||0)+(+x.t||0)); })):0;
  // Records that run ahead of the calendar would mean they are not one win a week, so in that case the week named in the scan is used as before
  const w0=recW<=ctx.wk.n?recW+1:((ctx.scan.week && ctx.scan.week<ctx.wk.n)?ctx.scan.week:ctx.wk.n);
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
  let s='Based on last season\'s numbers'+(noJ.length<ps.length?', shaped by Josh Lloyd\'s ranks'+(hasJC()?' and his category calls':''):'')+'. No games have been played this season yet.';
  if(noJ.length) s+=' Josh Lloyd has no rank and no category call for '+listWords(noJ.map(p=>p.name))+'.';
  if(k.has('est')) s+=' Rookie numbers are a preseason estimate.';
  if(k.has('older')) s+=' A player who missed last season uses his most recent full season.';
  return s;
}
const basisChip=p=>p.basis==='now'?'<span class="chip good">This season</span>':p.basis==='blend'?'<span class="chip">Blend, '+p.gp+' games</span>':p.basis==='est'?'<span class="chip warn">Preseason estimate</span>':p.basis==='older'?'<span class="chip warn">Older season</span>':p.basis==='last'?'<span class="chip muted">Last season</span>':'<span class="chip bad">No numbers</span>';
const statusWord=s=>s==='O'||/^OUT$/i.test(s||'')?'out':/^(D|DOUBT|DOUBTFUL)$/i.test(s||'')?'doubtful':s==='IR'?'on injured reserve':s==='INJ'?'injured':s==='Q'?'questionable':s==='GTD'?'a game time call':s==='DTD'?'day to day':s==='P'?'probable':s==='NA'?'not active':s==='SUSP'?'suspended':s==='OFS'?'out for the season':s?'flagged':'';
const catMoves=(dc,min)=>{ const up=[], dn=[]; dc.map((v,c)=>[v,c]).sort((a,b)=>Math.abs(b[0])-Math.abs(a[0])).forEach(x=>{ if(x[0]>=min) up.push(CATWORD[x[1]]); else if(x[0]<=-min) dn.push(CATWORD[x[1]]); }); return {up,dn}; };
const listWords=a=>a.length<=1?a.join(''):a.slice(0,-1).join(', ')+' and '+a[a.length-1];
/* the cats a trade moves for me. A cat counts when my chance to win it in an average week moves 1.5 points or more. Biggest move first */
const tradeCats=t=>{ const up=[], dn=[]; (t.dme||[]).map((v,c)=>[v,c]).sort((x,y)=>Math.abs(y[0])-Math.abs(x[0])).forEach(x=>{ if(x[0]>=1.5) up.push(x[1]); else if(x[0]<=-1.5) dn.push(x[1]); }); return {up,dn}; };
const tradeCatLine=t=>{ const tc=tradeCats(t); const w=c=>CATS[c]+' '+(t.dme[c]>0?'up ':'down ')+Math.abs(r1(t.dme[c])); if(!tc.up.length && !tc.dn.length) return 'No cat moves by 1.5 points or more.'; return (tc.up.length?'Helps '+tc.up.map(w).join(', ')+'. ':'Helps no cat by 1.5 points or more. ')+(tc.dn.length?'Costs '+tc.dn.map(w).join(', ')+'. ':'Costs you nothing of that size. ')+'Each number is the change in your chance to win that cat in an average week, in points.'; };
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
  let s1='Your chance to beat '+oppName+' '+wkWord+' goes from '+pc(pk.base.win)+' to '+pc(pk.base.win+r.gWt/100)+' percent on normal scoring.';
  if(mv.up.length) s1+=' He helps most in '+listWords(mv.up.slice(0,3))+'.'; if(mv.dn.length) s1+=' It costs a little in '+listWords(mv.dn.slice(0,2))+'.';
  s1+=' Over the rest of the season your average week moves '+(r.gR>=0?'up ':'down ')+Math.abs(r1(r.gR))+' points.';
  a.push(s1);
  let s2='He has '+r.gl+' game'+(r.gl===1?'':'s')+(wkWord==='this week'?' left this week':' '+wkWord)+' and about '+r1(r.use)+' fit in your lineup. ';
  if(r.drop) s2+='Drop '+r.drop.name+', your least useful player for this. ';
  else if(pk.free) s2+='You have an open roster spot, so no drop is needed. ';
  else if(pk.ilMove) s2+='Move '+pk.ilMove.name+' to IL first, he is tagged '+statusWord(pk.ilMove.status)+', then no drop is needed. ';
  if(r.wd) s2+='He is on waivers until '+nice(r.wd)+'. A claim sends you to the back of the waiver line, you are number '+((ctx.teams[ME]||{}).waiver||'?')+' now.';
  else if(r.waiver) s2+='He is on waivers. A claim sends you to the back of the waiver line.';
  else s2+='He is a free agent, so he costs no waiver spot. '+(pk.adds<=0?'You have no adds left for that week, so Yahoo will not take the add.':pk.adds===1?'It would use your last add for that week.':(pk.week && pk.week.n!==ctx.wk.n && !ctx.noAdds && ctx.now.date>=ctx.wk.start)?'Added before week '+ctx.wk.n+' ends, it uses one of your '+ctx.addsNow+' adds left for week '+ctx.wk.n+'. Added after that, it uses one of the '+pk.adds+' for week '+pk.week.n+'.':'It uses one of your '+pk.adds+' adds left for that week.');
  if(r.bal.mult>1) s2+=' He also helps your position balance at '+listWords(r.bal.good)+'.'; else if(r.bal.mult<1){ const w=[]; if(r.bal.crowd.length) w.push('he can only play '+listWords(r.bal.crowd)+', where you are already crowded'); if(r.bal.thin.length) w.push('the drop leaves you thin at '+listWords(r.bal.thin)); s2+=' For position balance, '+w.join(' and ')+', so his score is trimmed a little.'; }
  a.push(s2);
  let s3=basisWords([p]); if(r.josh>0 && p.b) s3+=' Josh has him at '+p.b.josh+', well above his Yahoo rank of '+(yrank(p)||'none')+'.'; if(r.josh<0 && p.b) s3+=' Josh has him at '+p.b.josh+', below his Yahoo rank of '+(yrank(p)||'none')+'.';
  a.push(s3);
  const risk=[]; if(p.status) risk.push('he is tagged '+statusWord(p.status)); if(r.why.includes('hot stretch without extra minutes')) risk.push('his last two weeks look hot but his minutes did not grow'); if(p.role==='down') risk.push('his minutes are down lately'); if(p.basis==='est') risk.push('he is a rookie with no NBA games'); if(r.sim>=4 && r.band!=='must') risk.push('several similar players are sitting there, so you can wait'); if(r.early) risk.push('his games are more than three days away, so a streaming add can wait until that week');
  a.push(risk.length?'Risk, '+listWords(risk)+'.':'Risk, nothing unusual. Check his news before you add.');
  { const js=jcSay(r.drop?[p,r.drop]:[p]), tg=jcTags(p); a.push(((js?js+' ':'')+(tg?'On '+p.name+', '+tg+'.':'')).trim()); }
  return oneDot(a);
}
function tradeWhy(ctx,t){
  const oName=(ctx.teams[t.o]||{}).name||'them'; const nm=a=>listWords(a.map(p=>p.name)); const a=[];
  const mv=catMoves(t.dme,1.5);
  let s1='You give '+nm(t.give)+' and get '+nm(t.get)+'. On normal scoring your average week goes from '+pc(ctx.base[ME].week)+' to '+pc(t.after)+' percent. With your solid cats weighted first the gain is '+r1(t.myGain)+(r1(t.myGain)===1?' point.':' points.');
  if(t.up.length) s1+=' It makes you the favorite in '+listWords(t.up.map(c=>CATWORD[c]))+'.'; if(t.dn.length) s1+=' It costs you the edge in '+listWords(t.dn.map(c=>CATWORD[c]))+'.';
  if(t.bal.mult>1) s1+=' It helps your position balance at '+listWords(t.bal.good)+'.'; else if(t.bal.mult<1) s1+=' It hurts your position balance at '+listWords(t.bal.bad)+'.';
  if(mv.up.length) s1+=' You get better in '+listWords(mv.up.slice(0,3))+'.'; if(mv.dn.length) s1+=' You give up some '+listWords(mv.dn.slice(0,3))+'.';
  if(t.two) s1+=' It also opens a roster spot. These numbers assume you fill that spot with a good streamer every week, so the gain is smaller if you leave it empty or fill it poorly.';
  a.push(s1);
  a.push(pitch(ctx,t));
  let s3=basisWords(t.give.concat(t.get));
  a.push(s3);
  const risk=[]; t.get.forEach(p=>{ if(p.status) risk.push(p.name+' is tagged '+statusWord(p.status)); if(p.b&&p.b.risk>=2) risk.push(p.name+' carries injury risk'); if(p.basis==='est') risk.push(p.name+' is a rookie estimate'); });
  if(t.top) risk.push('they drafted or prize what you are asking for, so expect a counter'); if(t.cut) risk.push('they would have to drop '+t.cut.name);
  a.push(risk.length?'Risk, '+listWords(risk)+'. Check the news before you send it.':'Risk, nothing unusual. Check the news before you send it.');
  { const js=jcSay(t.give.concat(t.get)); const tg=t.get.map(p=>{ const x=jcTags(p); return x?'On '+p.name+', '+x+'.':''; }).filter(Boolean).join(' '); a.push(((js?js+' ':'')+tg).trim()); }
  return oneDot(a);
}
/* why the cats a trade moves matter for my team. A swing cat sits between 42 and 58 percent, where a few points decide the week */
function tradeMatter(ctx,t){
  const per=ctx.base[ME].per, aft=c=>clamp(per[c]+t.dme[c]/100,0,1), st=x=>x<0.42?0:x<=0.58?1:2, tc=tradeCats(t), a=[];
  const cap=c=>CATWORD[c].charAt(0).toUpperCase()+CATWORD[c].slice(1);
  let sw=0;
  tc.up.slice(0,3).forEach(c=>{ const b=per[c], n=aft(c), go='from '+pc(b)+' to '+pc(n)+' percent';
    if(st(b)===1) a.push(cap(c)+(sw++?' is also a swing cat.':' is a swing cat for you, so this is where the trade pays most.')+' Your chance to win it goes '+go+'.');
    else if(st(b)===0) a.push(cap(c)+' is a cat you usually lose. Your chance to win it goes '+go+(n>0.5?', which makes you the favorite.':n>=0.42?', which turns it into a real fight.':', so you are still the underdog there.'));
    else a.push(cap(c)+' is already a strength and goes '+go+', so it adds less.'); });
  tc.dn.slice(0,3).forEach(c=>{ const b=per[c], n=aft(c), go='from '+pc(b)+' to '+pc(n)+' percent';
    if(st(n)===2) a.push('You can afford the hit in '+CATWORD[c]+', where you stay a clear favorite, '+go+'.');
    else if(st(n)===1) a.push('Watch '+CATWORD[c]+'. It '+(st(b)===2?'becomes':'stays')+' a swing cat, '+go+'.');
    else if(st(b)===0) a.push('You were already losing '+CATWORD[c]+', so the drop '+go+' costs little.');
    else a.push('The real cost is '+CATWORD[c]+', which falls '+go+' and becomes a cat you usually lose.'); });
  const fb=per.filter(x=>x>0.5).length, fa=per.map((x,c)=>aft(c)).filter(x=>x>0.5).length;
  if(!a.length) a.push('No single cat moves by 1.5 points or more. The gain comes from small lifts across several cats.');
  a.push('In an average week you are favored in '+fb+' of 9 cats now and '+fa+' after.');
  return a.join(' ');
}
/* is it fair. Judged by Josh Lloyd's overall ranks for my side and by how it looks on Yahoo for theirs */
function tradeFair(ctx,t){
  const jr=p=>p.name+(p.b&&p.b.josh?' ('+p.b.josh+')':' (no Josh rank)');
  let s='By Josh\'s overall ranks you give '+listWords(t.give.map(jr))+' and get '+listWords(t.get.map(jr))+'. ';
  s+=t.jside==='win'?'By his ranks you get the better side of it.':'By his ranks it is about even.';
  s+=' For them it '+(t.ratio>=1.12?'looks like a win':t.ratio>=0.97?'looks even':'looks a touch light')+' on Yahoo ranks and name value, and their average week moves '+(t.oGain>=0?'up ':'down ')+Math.abs(r1(t.oGain))+' points by this model.';
  s+=' A trade never shows here if you give up clearly more than you get by Josh\'s ranks, if their numbers drop by more than a point, or if the chance they say yes is under 25 percent.';
  return s;
}
function pitch(ctx,t){
  const oName=(ctx.teams[t.o]||{}).name||'them'; const nm=a=>listWords(a.map(p=>p.name+(yrank(p)?' (Yahoo '+yrank(p)+')':'')));
  let s='Why they say yes. ';
  if(t.weakHelp.length) s+='They are weak in '+listWords(t.weakHelp.slice(0,3).map(c=>CATWORD[c]))+' and '+listWords(t.give.map(p=>p.name))+(t.give.length>1?' help':' helps')+' there. ';
  else { const up=catMoves(t.dop,1.5).up; if(up.length) s+='It makes them better in '+listWords(up.slice(0,3))+'. '; }
  s+='They get '+nm(t.give)+' for '+nm(t.get)+'. ';
  s+=t.ratio>=1.12?'On Yahoo ranks and name value it looks like a win for them.':t.ratio>=0.97?'On Yahoo ranks and name value it looks even.':'On Yahoo ranks it looks a touch light, so sell the fit.';
  s+=' This model puts the chance they say yes '+(t.acc>=0.92?'at 92 percent or more, the highest it shows.':'near '+pc(t.acc)+' percent.');
  return s;
}
function pitchText(ctx,t){
  const nm=a=>listWords(a.map(p=>p.name)); const up=t.weakHelp.length?t.weakHelp.slice(0,3).map(c=>CATWORD[c]):catMoves(t.dop,1.5).up.slice(0,3);
  let s='Trade idea. I send you '+nm(t.give)+' for '+nm(t.get)+'.';
  if(up.length) s+=' It helps you in '+listWords(up)+', which is where your team is light.';
  if(t.give.length>t.get.length) s+=' You get two useful players for one.';
  s+=' Let me know what you think.';
  return oneDot([s])[0];
}

/* drawing */
let CTX=null, CTXW=null, TR=null, PK=null, WK=null, RACE=null, ERR='', TRUN=0;
function css(){
  if($('mvcss')) return; const s=document.createElement('style'); s.id='mvcss';
  s.textContent='.mv{display:flex;flex-direction:column;gap:16px}.mvgrid{display:grid;grid-template-columns:minmax(0,400px) minmax(0,1fr);gap:16px;align-items:start}@media (max-width:1100px){.mvgrid{grid-template-columns:minmax(0,1fr)}}.mvcol{display:flex;flex-direction:column;gap:16px;min-width:0}'
  +'.mvcells{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:8px;margin:10px 0}.mvc{border:1px solid var(--line);border-radius:8px;padding:8px 10px;background:var(--panel-2)}.mvc .k{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);font-weight:600}.mvc .v{font-family:var(--display);font-size:26px;line-height:1.1}.mvc .s{font-size:12px;color:var(--muted)}'
  +'.mvscan{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px;color:var(--muted)}'
  +'.mvcard{border:1px solid var(--line);border-radius:8px;background:var(--panel-2);margin-bottom:8px}.mvcard[open]{border-color:var(--accent)}.mvcard summary{list-style:none;cursor:pointer;padding:10px 12px;display:grid;grid-template-columns:54px minmax(0,1fr);gap:4px 10px;align-items:center}.mvcard summary::-webkit-details-marker{display:none}'
  +'.mvn{font-family:var(--display);font-size:28px;line-height:1;text-align:center;border-radius:8px;padding:6px 0;background:var(--panel);border:1px solid var(--line)}.mvn small{display:block;font-family:var(--body);font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-top:2px}.mvn.must{background:var(--good-bg);color:var(--good);border-color:var(--good)}.mvn.strong{background:var(--accent-soft);color:var(--accent);border-color:var(--accent)}.mvn.helps{background:var(--warn-bg);color:var(--warn)}.mvn.skip{color:var(--muted)}'
  +'.mvt{min-width:0}.mvt b{font-size:15.5px}.mvt .sub{color:var(--muted);font-size:12.5px}.mvt .meta{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px}.mvbody{padding:0 12px 12px;font-size:14px;display:flex;flex-direction:column;gap:8px;border-top:1px dashed var(--line);margin-top:2px;padding-top:10px}.mvbody p{margin:0;max-width:72ch}.mvbody .lab{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);font-weight:700;display:block}'
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
  let basis; if(ctx.wbar<0.02) basis='Numbers are based on last season, shaped by Josh Lloyd\'s ranks'+(hasJC()?' and his category calls':'')+'. No games have been played yet.'; else if(ctx.wbar<0.75) basis='Numbers blend last season with this season so far, about '+r0(ctx.avgGP)+' games per player.'; else basis='Numbers are based on this season, about '+r0(ctx.avgGP)+' games per player.';
  return '<div class="mvscan"><span class="ydot '+dot+'"></span><span>Yahoo was last scanned '+esc(when)+(age>30?', that is '+(age<48?r0(age)+' hours':Math.floor(age/24)+' days')+' old':'')+'. '+basis+' Every number is a model estimate.</span></div>'
    +(age>48?'<div class="switch" style="margin-top:8px">The last Yahoo scan is '+Math.floor(age/24)+' days old. Rosters, injury tags, pickups and trades below may be out of date. Run a fresh scan before you act on them.</div>':'');
}
function render(){
  css(); const root=$('viewMoves'); if(!root) return;
  if(D.miss && D.miss.length && !D.loading){ root.innerHTML='<div class="panel"><h2>Pickups and trades</h2><p class="empty">'+(D.miss.length===1?'One data file did not load properly, ':'Some data files did not load properly, ')+esc(D.miss.join(', '))+'. No numbers are shown because they would be wrong without '+(D.miss.length===1?'it':'them')+'. Check your connection and try again.</p><div class="mvact"><button class="btn" id="mvretry" type="button">Try again</button></div></div>'; const b=$('mvretry'); if(b) b.onclick=()=>{ D.miss=null; load(); }; return; }
  if(!D.scan || !D.league || !D.sched){ root.innerHTML='<div class="panel"><h2>Pickups and trades</h2><p class="empty">'+(D.loading?'Loading the league data.':'No Yahoo scan is loaded yet. The daily scan puts it here.')+'</p></div>'; return; }
  const ctx=CTX, wk=WK, pk=PK, me=ctx.base[ME], rc=RACE; const mine=rc.rows.find(r=>r.tid===ME);
  const oppName=ctx.opp?((ctx.teams[ctx.opp]||{}).name||''):'';
  let h='<div class="mv">';
  h+='<div class="panel">'+scanLine(ctx);
  h+='<div class="mvcells">';
  h+='<div class="mvc"><div class="k">Week '+ctx.wk.n+' win chance</div><div class="v">'+(wk?pc(wk.win)+'%':'none')+'</div><div class="s">'+(wk?'vs '+esc(oppName)+(ctx.partial?', days left only':''):'no matchup')+'</div></div>';
  h+='<div class="mvc"><div class="k">'+(ctx.act?'Cats you lead':'Cats you are favored in')+'</div><div class="v">'+(wk?wk.fav:0)+' of 9</div><div class="s">you need 5</div></div>';
  h+='<div class="mvc"><div class="k">Average week</div><div class="v">'+pc(me.week)+'%</div><div class="s">rest of season, ranks '+mine.pos+' of 10</div></div>';
  h+='<div class="mvc"><div class="k">Top four chance</div><div class="v">'+pc(mine.top4)+'%</div><div class="s">about '+r1(mine.wins)+' wins by week 18</div></div>';
  h+='<div class="mvc"><div class="k">Adds left, week '+ctx.wk.n+'</div><div class="v">'+ctx.addsNow+' of '+(D.league.adds||4)+'</div><div class="s">waiver spot '+((ctx.teams[ME]||{}).waiver||'?')+' of 10'+(pk.week && pk.week.n!==ctx.wk.n?', week '+pk.week.n+' has '+pk.adds+' left':'')+'</div></div>';
  h+='</div>';
  h+='<div class="final">'+goalLine(ctx,wk,pk)+'</div>';
  if(ST.marks.length) h+='<div class="switch" style="margin-top:10px">You marked '+ST.marks.length+' move'+(ST.marks.length===1?'':'s')+' since the last Yahoo scan, so the lists below already count '+(ST.marks.length===1?'it':'them')+'. The next scan replaces this with what Yahoo shows.<div><button class="btn" id="mvundo" type="button">Undo my marked moves</button></div></div>';
  h+='</div>';
  h+='<div class="mvgrid"><div class="mvcol">'+weekPanel(ctx,wk)+leaguePanel(ctx,rc)+'</div><div class="mvcol">'+pickPanel(ctx,pk)+tradePanel(ctx)+teamPanel(ctx,wk)+'</div></div>';
  h+='</div>';
  root.innerHTML=h; wire();
}
function goalLine(ctx,wk,pk){
  if(!wk) return 'No matchup found for this week.';
  const need=5-wk.fav; const top=pk.list[0];
  // before the week has a score nobody leads anything yet, so the words say favored. A swing cat is the same thing everywhere on this page, a cat between 42 and 58 percent
  const lead=ctx.act?'lead':'are favored in';
  let s=wk.fav>=5?'You '+lead+' '+wk.fav+' of 9 cats against '+esc((ctx.teams[ctx.opp]||{}).name||'')+'. '+(ctx.act?'Hold the lead':'Keep it that way')+' and protect the close ones.':'You '+lead+' only '+wk.fav+' of 9 cats, so you need '+need+' more. Keep adding and trading until this reads 5 or more.';
  const close=wk.probs.map((p,c)=>[Math.abs(p-0.5),c,p]).filter(x=>x[0]<=0.08).sort((a,b)=>a[0]-b[0]).slice(0,3).map(x=>CATS[x[1]]);
  if(close.length) s+=close.length===1?' The swing cat is '+close[0]+'.':' The swing cats are '+listWords(close)+'.';
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
function pickPanel(ctx,pk){
  let h='<div class="panel"><h2>Pickups <span>updates every day after the Yahoo scan</span></h2>';
  const wkWord=weekWord(ctx,pk.week).replace(/^in /,'');
  if(pk.standIn) h+='<div class="switch">No matchup is set for that week yet, so these scores use '+esc((ctx.teams[pk.opp]||{}).name||'the strongest team')+' as a stand in.</div>';
  h+='<p class="small">Need score, 85 and up means add him now even if it costs a waiver claim. 65 to 84 means add him once he is a free agent. 50 to 64 helps but keep your waiver spot. Under 50, skip. Solid cats count in full, FT% counts 90 percent and FG% 80 percent. Scores are for '+wkWord+' against '+esc((ctx.teams[pk.opp]||{}).name||'')+' and for the rest of the season. Each score takes the better of two readings. A hold counts 40 percent of the lift for that week and 60 percent of the lift to your average week for the rest of the season. A one week stream counts 85 percent of that week\'s lift alone, so read the rest of season line on the card before you drop someone for it. A stream whose add day is more than 3 days away is capped at 60. The top score is 99.</p>';
  if(ctx.noAdds) h+='<div class="switch">You have used all '+(D.league.adds||4)+' adds for week '+ctx.wk.n+', so Yahoo will not take another add this week. These pickups are scored for week '+pk.week.n+'.</div>';
  if(pk.ilMove && !pk.free) h+='<div class="switch">'+esc(pk.ilMove.name)+' is tagged '+statusWord(pk.ilMove.status)+'. Move him to IL and you can add someone without dropping anyone.</div>';
  if(pk.free) h+='<div class="switch">You have '+pk.free+' open roster spot'+(pk.free===1?'':'s')+', so an add needs no drop.</div>';
  if(!pk.list.length) h+='<p class="empty">'+(pk.note||'No pickup helps you right now. Hold your adds and your waiver spot.')+'</p>';
  pk.list.forEach((r,i)=>{
    const p=r.p; const why=pickupWhy(ctx,pk,r);
    h+='<details class="mvcard"><summary><span class="mvn '+r.band+'">'+r.need+'<small>'+(r.band==='must'?'must add':r.band==='strong'?'strong':r.band==='helps'?'helps':'skip')+'</small></span><span class="mvt"><b>'+esc(p.name)+'</b> <span class="sub">'+esc(p.team)+', '+esc(p.pos.join(' '))+(r.drop?', drop '+esc(r.drop.name):'')+'</span>'
      +'<span class="meta"><span class="chip">'+esc(r.tag)+'</span><span class="chip muted">'+r.gl+(r.gl===1?' game':' games')+(weekWord(ctx,pk.week)==='this week'?' left':' '+weekWord(ctx,pk.week))+'</span>'+(r.wd?'<span class="chip warn">Waivers until '+nice(r.wd)+'</span>':r.waiver?'<span class="chip warn">On waivers</span>':'<span class="chip good">Free agent</span>')+(r.early?'<span class="chip muted">Wait for game week</span>':'')+(r.bal.mult>1?'<span class="chip good">Helps balance</span>':r.bal.mult<1?'<span class="chip warn">'+(r.bal.crowd.length?'Crowded spot':'Leaves '+r.bal.thin.join(' ')+' thin')+'</span>':'')+(r.josh>0?'<span class="chip gem">Josh likes him</span>':'')+(p.status?'<span class="chip bad">'+esc(statusWord(p.status))+'</span>':'')+basisChip(p)+'</span></span></summary>'
      +'<div class="mvbody"><p><span class="lab">What it does for you</span>'+esc(why[0])+'</p><p><span class="lab">What it costs</span>'+esc(why[1])+'</p><p><span class="lab">What it is based on</span>'+esc(why[2])+'</p>'+(why[4]?'<p><span class="lab">Josh on the cats</span>'+esc(why[4])+'</p>':'')+'<p><span class="lab">Risk</span>'+esc(why[3])+'</p>'
      +'<div class="mvact"><button class="btn" type="button" data-add="'+esc(p.id)+'" data-drop="'+esc(r.drop?r.drop.id:'')+'" data-il="'+esc(r.il||'')+'">I made this add</button></div></div></details>';
  });
  h+='</div>'; return h;
}
function tradePanel(ctx){
  let h='<div class="panel"><h2>Trades <span>updates each week and after any roster move in the league</span></h2>';
  const cw=CTXW; const snap=new Date(cw.scan.at).toLocaleDateString(undefined,{month:'short',day:'numeric'});
  h+='<p class="small">A trade shows here only if it leaves you favored in at least one more cat in an average week. A cat counts as gained when your chance to win it goes from under to over 50 percent and rises at least 5 points. Solid cats count in full, FT% counts 65 percent and FG% counts half. Listed by your gain, biggest first, with an urgent trade on top and the smaller trades after the ones that add a cat. Your gain is how many points your chance to win an average week goes up, with your solid cats counted first. For a two for one, what you would gain by simply dropping a player for a streamer is taken off first. Every offer is scored in full with both teams\' lineups set again, and every trade here is one you could fairly send. On Yahoo ranks and name value what you give is worth between 0.9 and 1.45 times what you get, their numbers do not drop by more than a point, the chance they say yes is 25 percent or more, your gain is at least 0.3 points, and by Josh\'s overall ranks you do not give up clearly more than you get. They always keep two centers. At most 14 trades show, one per team and set of players you get. Open a card to see which cats it moves, why those cats matter for your team and whether it is fair. The Helps and Costs tags name the cats where your chance to win that cat moves by 1.5 points or more, biggest first. Built from the snapshot of '+esc(snap)+'. Kyrie is never offered. Boozer is held until the middle of January. You always keep three centers.</p>';
  if(!TR){ h+='<p class="empty" id="mvtrwait">Scoring trades with all nine teams.</p></div>'; return h; }
  if(TR.note) h+='<p class="empty">'+esc(TR.note)+'</p>';
  else if(!TR.list.length) h+='<p class="empty">No trade adds a full cat right now, so there is nothing worth sending. Checked '+TR.count+' offers.'+(TR.hidden?' '+TR.hidden+' smaller trades are hidden.':'')+'</p>';
  else if(TR.hidden) h+='<p class="small">'+TR.hidden+' smaller trades are hidden.</p>';
  TR.list.forEach((t,i)=>{
    const why=tradeWhy(cw,t); const tc=tradeCats(t); const oName=(cw.teams[t.o]||{}).name||''; const nm=a=>a.map(p=>esc(p.name)).join(' and ');
    const look=t.ratio>=1.12?'Looks like a win for them':t.ratio>=0.97?'Looks even to them':'Looks a bit light to them';
    h+='<details class="mvcard"><summary><span class="mvn '+(t.urgent?'must':t.myGain>=1?'strong':'helps')+'">+'+Math.abs(r1(t.myGain))+'<small>your gain</small></span><span class="mvt"><b>Get '+nm(t.get)+'</b> <span class="sub">for '+nm(t.give)+', with '+esc(oName)+'</span>'
      +'<span class="meta">'+(t.urgent?'<span class="chip gem">Do this now</span>':'')+(t.pass?'<span class="chip gem">Adds '+t.up.map(c=>CATS[c]).join(' ')+'</span>':'<span class="chip muted">Under one cat</span>')+(t.dn.length?'<span class="chip bad">Loses '+t.dn.map(c=>CATS[c]).join(' ')+'</span>':'')+(tc.up.length?'<span class="chip good">Helps '+tc.up.map(c=>CATS[c]).join(' ')+'</span>':'')+(tc.dn.length?'<span class="chip warn">Costs '+tc.dn.map(c=>CATS[c]).join(' ')+'</span>':'')+(t.bal.mult>1?'<span class="chip good">Helps balance</span>':t.bal.mult<1?'<span class="chip warn">Hurts balance</span>':'')+(t.jside==='win'?'<span class="chip good">You win by Josh\'s ranks</span>':'<span class="chip muted">Even by Josh\'s ranks</span>')+'<span class="chip muted">'+look+'</span>'+'</span></span></summary>'
      +'<div class="mvbody"><p><span class="lab">What it does for you</span>'+esc(why[0])+'</p><p><span class="lab">Stats it helps and costs</span>'+esc(tradeCatLine(t))+'</p><p><span class="lab">Why it matters for your team</span>'+esc(tradeMatter(cw,t))+'</p><p><span class="lab">Is it fair</span>'+esc(tradeFair(cw,t))+'</p><p><span class="lab">The pitch</span>'+esc(why[1])+'</p><p><span class="lab">What it is based on</span>'+esc(why[2])+'</p>'+(why[4]?'<p><span class="lab">Josh on the cats</span>'+esc(why[4])+'</p>':'')+'<p><span class="lab">Risk</span>'+esc(why[3])+'</p>'
      +'<div class="mvact"><button class="btn" type="button" data-trade="'+i+'">I made this trade</button><button class="btn" type="button" data-pitch="'+i+'">Copy a message to send</button></div></div></details>';
  });
  h+='<p class="small"><label><input type="checkbox" id="mvsmall"'+(ST.small?' checked':'')+'> Show the smaller trades too, the ones under one cat</label></p>';
  h+='</div>'; return h;
}
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
  let h='<div class="panel"><h2>My players <span>what the numbers above use, per game</span></h2><div class="mvtbl"><table><thead><tr><th>Player</th><th class="num">Wk G</th><th class="num">GP</th><th class="num">MIN</th><th class="num">FG%</th><th class="num">FT%</th><th class="num">3PM</th><th class="num">PTS</th><th class="num">REB</th><th class="num">AST</th><th class="num">STL</th><th class="num">BLK</th><th class="num">TO</th><th>Based on</th></tr></thead><tbody>';
  mine.forEach(p=>{ const l=p.proj; const g=wk?(wk.me.ug.get(p.id)||0):0; const n=ctx.days.filter(d=>playsOn(p.team,d)).length;
    h+='<tr><td class="mvnm" style="white-space:normal"><b>'+esc(p.name)+'</b> <span class="small">'+esc(p.team)+' '+esc(p.slot)+(p.status?', '+esc(statusWord(p.status)):'')+(p.role?', minutes '+p.role:'')+'</span>'+(jcCall(p)?'<div class="small mvjc">'+esc(jcCall(p))+'</div>':'')+(jcTags(p)?'<div class="small mvjc">'+esc(jcTags(p))+'</div>':'')+'</td><td class="num">'+r1(g)+' of '+n+'</td><td class="num">'+(p.gp||0)+'</td>';
    if(l) h+='<td class="num">'+r1(l.mp)+'</td><td class="num">'+(l.fga>0?(100*l.fgm/l.fga).toFixed(1):'')+'</td><td class="num">'+(l.fta>0?(100*l.ftm/l.fta).toFixed(1):'')+'</td><td class="num">'+r1(l.tpm)+'</td><td class="num">'+r1(l.pts)+'</td><td class="num">'+r1(l.reb)+'</td><td class="num">'+r1(l.ast)+'</td><td class="num">'+r1(l.stl)+'</td><td class="num">'+r1(l.blk)+'</td><td class="num">'+r1(l.to)+'</td>'; else h+='<td colspan="10" class="small">no numbers yet</td>';
    h+='<td>'+basisChip(p)+'</td></tr>'; });
  h+='</tbody></table></div><p class="small">Wk G is how many of his games this week fit in your starting lineup. The best players are seated first, so a questionable player keeps his spot. A bench player shows the share of starts he is expected to pick up when a starter sits. Each line blends last season with this season. The weight on this season is games played divided by games played plus 12. Rookie guesses and older seasons fade faster.'+(hasJC()?' The line under a name is the category call Josh Lloyd made for that player. His rank sets how much the player is worth and how many games he gets. The call sets which cats that value sits in. A normal call moves a cat about 5 to 8 percent and a strong one about double. Where he gave real numbers the cat moves most of the way to them. FG% or FT% moves about a point, more where he gave numbers. A minutes call only lets the rank move the whole line as far as his minutes number.':'')+'</p></div>';
  return h;
}
function wire(){
  const root=$('viewMoves');
  root.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{ ST.marks.push({type:'add',add:b.getAttribute('data-add'),drop:b.getAttribute('data-drop')||null,il:b.getAttribute('data-il')||null,day:CTX?CTX.now.date:null}); ST.at=D.scan.at; save(); compute(true); });
  root.querySelectorAll('[data-trade]').forEach(b=>b.onclick=()=>{ const t=TR.list[+b.getAttribute('data-trade')]; if(!t) return; ST.marks.push({type:'trade',withTeam:t.o,give:t.give.map(p=>p.id),get:t.get.map(p=>p.id),cut:t.cut?t.cut.id:null}); ST.at=D.scan.at; save(); compute(true); });
  root.querySelectorAll('[data-pitch]').forEach(b=>b.onclick=()=>{ const t=TR.list[+b.getAttribute('data-pitch')]; if(!t) return; const txt=pitchText(CTXW,t); const ok=()=>{ b.textContent='Copied'; setTimeout(()=>{ b.textContent='Copy a message to send'; },1500); }; try{ navigator.clipboard.writeText(txt).then(ok,()=>{ window.prompt&&0; b.textContent=txt; }); }catch(e){ b.textContent=txt; } });
  const u=$('mvundo'); if(u) u.onclick=()=>{ ST.marks=[]; save(); compute(true); };
  const sm=$('mvsmall'); if(sm) sm.onchange=()=>{ ST.small=sm.checked; save(); if(TR && TR.relist){ TR.relist(); render(); } else compute(true); };
}
function compute(redoTrades){
  try{ ERR=''; computeInner(redoTrades); }
  catch(e){ ERR=String(e&&e.message||e); const root=$('viewMoves'); if(root) root.innerHTML='<div class="panel"><h2>Pickups and trades</h2><p class="empty">The numbers could not be built from the last scan. The next scan should fix it. Detail for the fixer, '+esc(ERR)+'</p></div>'; }
}
function computeInner(redoTrades){
  if(!D.scan || !D.league || !D.sched){ render(); return; }
  if(ST.at!==D.scan.at && ST.marks.length){ ST.marks=[]; ST.at=D.scan.at; save(); }
  // a marked add must be a player the scan knows, so a damaged saved mark can never put a made up player on your roster or use up an add
  if(ST.marks.length){ const known=new Set(Object.keys(D.scan.avail||{})); Object.keys(D.scan.rosters||{}).forEach(t=>(D.scan.rosters[t]||[]).forEach(e=>known.add(String(e[0])))); const keep=ST.marks.filter(m=>m.type!=='add' || known.has(m.add)); if(keep.length!==ST.marks.length){ ST.marks=keep; save(); } }
  CTX=build(D.scan); WK=thisWeek(CTX); PK=pickups(CTX); RACE=race(CTX);
  if(redoTrades || !TR){ TR=null; CTXW=build(D.week||D.scan); render(); const run=++TRUN; trades(CTXW,res=>{ if(run!==TRUN) return; TR=res; try{ render(); }catch(e){ ERR=String(e&&e.message||e); } },()=>run===TRUN); }
  else render();
}
async function load(){
  if(D.loaded || D.loading) return; D.loading=true; render();
  const get=async f=>{ try{ const r=await fetch('data/'+f,{cache:'no-store'}); if(!r.ok) return null; return await r.json(); }catch(e){ return null; } };
  const files=['league.json','schedule.json','prior.json','players.json','scan.json','scan_week.json','josh_cats.json'];
  const a=await Promise.all(files.map(get));
  // every file but the weekly snapshot is needed for the numbers to be right. If one did not arrive, say so and draw nothing, because numbers built without it look normal and are wrong
  // A file that arrives but holds nothing useful is treated the same way, for example a scan with no players on your team or a schedule with no games
  const obj=x=>!!x && typeof x==='object' && !Array.isArray(x), full=x=>obj(x) && Object.keys(x).length>0;
  const okShape=[x=>obj(x)&&Array.isArray(x.weeks)&&x.weeks.length>0&&x.weeks.every(w=>w&&Array.isArray(w.games))&&full(x.teams),
    x=>obj(x)&&full(x.games)&&Object.keys(x.games).some(t=>Array.isArray(x.games[t])&&x.games[t].length>0),
    x=>obj(x)&&full(x.p), x=>obj(x)&&full(x.p),
    x=>obj(x)&&typeof x.at==='string'&&isFinite(Date.parse(x.at))&&obj(x.rosters)&&Array.isArray(x.rosters[ME])&&x.rosters[ME].length>0&&Object.keys(x.rosters).every(t=>Array.isArray(x.rosters[t])),
    ()=>true, x=>obj(x)&&obj(x.p)];
  D.miss=files.filter((f,i)=>!okShape[i](a[i]));
  if(D.miss.length){ D.loading=false; D.loaded=false; render(); return; }
  D.league=a[0]; D.sched=a[1]; D.prior=a[2]; D.players=a[3]; D.scan=a[4]; D.week=(a[5]&&a[5].rosters)?a[5]:a[4]; D.jc=a[6]; loadJC();
  D.gset={}; if(D.sched) Object.keys(D.sched.games).forEach(t=>D.gset[t]=new Set(D.sched.games[t]));
  D.loading=false; D.loaded=true; compute(true);
}
/* a short plain summary for the daily scan report */
function summary(){
  if(!CTX || !PK || !TR) return ERR?'error, '+ERR:'not ready';
  const c=CTX, me=RACE.rows.find(r=>r.tid===ME), o=[];
  o.push('scan '+c.scan.at+', week '+c.wk.n+' vs '+((c.teams[c.opp]||{}).name||'none'));
  if(WK) o.push('week win chance '+pc(WK.win)+' percent, leading '+WK.fav+' of 9 cats, cat chances '+WK.probs.map((p,i)=>CATS[i]+' '+pc(p)).join(', ')); else o.push('no matchup found for this week');
  o.push('average week '+pc(c.base[ME].week)+' percent, rank '+me.pos+' of 10, top four chance '+pc(me.top4)+' percent, record '+(me.rec.w||0)+' wins '+(me.rec.l||0)+' losses');
  o.push('adds left for week '+c.wk.n+' '+c.addsNow+(PK.week && PK.week.n!==c.wk.n?', pickups below are scored for week '+PK.week.n+' which has '+PK.adds+' adds left':', pickups below are scored for week '+c.wk.n)+', waiver spot '+((c.teams[ME]||{}).waiver||'unknown')+(PK.ilMove&&!PK.free?', IL move open for '+PK.ilMove.name:'')+(PK.free?', open roster spots '+PK.free:''));
  PK.list.slice(0,4).forEach((r,i)=>o.push('pickup '+(i+1)+', need '+r.need+', '+r.p.name+(r.drop?', drop '+r.drop.name:', no drop')+', '+r.tag+', '+(r.wd?'waivers until '+nice(r.wd):r.waiver?'on waivers':'free agent')));
  if(!TR.list.length) o.push('no trade adds a full cat right now'+(TR.hidden?', '+TR.hidden+' smaller ones hidden':''));
  TR.list.slice(0,3).forEach((t,i)=>o.push('trade '+(i+1)+(t.urgent?' urgent':'')+(t.pass?', adds '+t.up.map(c=>CATS[c]).join(' '):', under one cat')+', with '+((CTXW.teams[t.o]||{}).name||'')+', give '+t.give.map(p=>p.name).join(' and ')+', get '+t.get.map(p=>p.name).join(' and ')+(tradeCats(t).up.length?', helps '+tradeCats(t).up.map(c=>CATS[c]).join(' '):'')+(tradeCats(t).dn.length?', costs '+tradeCats(t).dn.map(c=>CATS[c]).join(' '):'')+', my gain '+r1(t.myGain)+', their gain '+r1(t.oGain)+', yes chance '+pc(t.acc)+' percent'));
  const out=c.ros[ME].filter(p=>p.status).map(p=>p.name+' '+statusWord(p.status)); if(out.length) o.push('my injury tags, '+out.join(', '));
  return o.join(' ~ ');
}
window.NCWMoves={summary,show:()=>{ document.body.classList.add('moves'); if(!D.loaded) load(); else render(); }, hide:()=>document.body.classList.remove('moves'), state:()=>({D,CTX,CTXW,TR,PK,WK,RACE,ST}), recompute:()=>compute(true), _fn:{build,thisWeek,pickups,trades,race,seasonTotals,dayAdd,seat,pNow,pROS,addsLeft,tradeMatter,tradeFair,catProbs,pWin5,totalsOver,lineup,elig,project,valOf,zLine,lineFromZ,wPr,flipNet,balance,strength,WT,WP,applyJC,jcOf,loadJC,jcCall,jcTags,tradeCats,tradeCatLine}};
})();
