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
const KEY='ncw_moves_v1';
const ME='11';
const D={};
let ST={marks:[],co:false,at:''};
try{ const j=JSON.parse(localStorage.getItem(KEY)||'null'); if(j&&j.marks) ST=Object.assign(ST,j); }catch(e){}
const save=()=>{ try{ localStorage.setItem(KEY,JSON.stringify(ST)); }catch(e){} };

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const PHI=x=>1/(1+Math.exp(-1.702*x));
const pWin5=probs=>{ let dp=[1]; for(const p of probs){ const nx=new Array(dp.length+1).fill(0); for(let k=0;k<dp.length;k++){ nx[k]+=dp[k]*(1-p); nx[k+1]+=dp[k]*p; } dp=nx; } let s=0; for(let k=5;k<dp.length;k++) s+=dp[k]; return s; };
const r0=x=>Math.round(x), r1=x=>Math.round(x*10)/10;
const pc=x=>Math.round(100*x);
const sgn=x=>(x>=0?'+':'')+r1(x);

/* dates, all in US Eastern because that is how the NBA and Yahoo count game days */
function etParts(dt){ const f=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hour12:false}).formatToParts(dt); const o={}; f.forEach(x=>o[x.type]=x.value); return {date:o.year+'-'+o.month+'-'+o.day,hour:(+o.hour)%24}; }
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

function project(p,scan){
  const b=p.b, pr=priorOf(p.name); let prior=null, pb='none'; p.f=1; p.av=0.85;
  if(b){
    const st=B.STATS[b.name]; const zs=(st&&st.z&&!st.rookie)?st.z:b.z; const av=b.av||0.85; p.av=clamp(av,0.45,0.96);
    const useRef=!!pr && pr[0]>=20 && !(st&&st.rookie) && (!st || st.src==='2025 26');
    const mp=st&&st.line&&(st.line.match(/([\d.]+) min/)||[])[1];
    const base=useRef?lineOfPrior(pr):lineFromZ(zs,mp?+mp:(pr?pr[1]:28));
    const v0=zs.reduce((a,v)=>a+av*v+(1-av)*(-0.25),0), v1=b.ez.reduce((a,v)=>a+v,0);
    const dz=(v1-v0)/av, dv=Math.max(5,1.004*base.tpm+0.169*base.pts+0.440*base.reb+0.495*base.ast+2.823*base.stl+2.065*base.blk-1.274*base.to);
    // the board moves each player 70 percent of the way to Josh's rank. Carry that same value change into his stat line,
    // first as more or less volume, then the rest as an even bump across the counting cats
    p.f=clamp(1+dz/dv,0.75,1.35); prior=scaleLine(base,p.f); p.dz=dz;
    const res=dz-(p.f-1)*dv;
    if(Math.abs(res)>0.05){ const e=res/7, pts0=prior.pts; prior.tpm=Math.max(0,prior.tpm+e/1.004); prior.pts=Math.max(2,prior.pts+e/0.169); prior.reb=Math.max(0.5,prior.reb+e/0.440); prior.ast=Math.max(0.3,prior.ast+e/0.495); prior.stl=Math.max(0.1,prior.stl+e/2.823); prior.blk=Math.max(0,prior.blk+e/2.065); prior.to=Math.max(0.3,prior.to-e/1.274);
      const k=pts0>0?prior.pts/pts0:1; prior.fgm*=k; prior.fga*=k; prior.ftm*=k; prior.fta*=k; }
    pb=useRef?'last':(b.rookie?'est':'older');
  } else if(pr){ prior=lineOfPrior(pr); p.av=clamp(pr[0]/78,0.6,0.93); pb='last'; }
  const s=scan.stats&&scan.stats[p.id]; let cur=null, gp=0; p.g14=null; p.m14=null; p.v14=null;
  if(s){ gp=s[1]||0; cur={mp:s[2]||0}; TK.forEach((k,i)=>cur[k]=s[3+i]||0); p.g14=s[14]; p.m14=s[15]; p.v14=s[16]; }
  if(cur&&gp<1) cur=null;
  let w=0, line=null;
  if(cur){ const pp=prior||REPL_LINE; w=gp/(gp+(prior?12:6)); line=mixLine(pp,cur,w); } else line=prior;
  p.role='';
  if(line && p.m14!=null && p.g14>=3 && line.mp>5){ const r=p.m14/line.mp; if(Math.abs(r-1)>=0.15){ const f=Math.pow(clamp(r,0.6,1.5),0.9); line=scaleLine(line,f); line.mp=p.m14; p.role=r>1?'up':'down'; } }
  p.proj=line; p.w=w; p.gp=gp; p.prior=prior;
  p.basis=!line?'none':gp<2?pb:w>=0.75?'now':'blend';
  p.val=line?valOf(line):-12;
  p.el=elig(p.pos);
  return p;
}
function elig(pos){ const s=[]; SLOTS.forEach((sl,i)=>{ if(sl==='Util' || (sl==='G'&&(pos.includes('PG')||pos.includes('SG'))) || (sl==='F'&&(pos.includes('SF')||pos.includes('PF'))) || pos.includes(sl)) s.push(i); }); return s; }
const isIL=p=>/^IL/.test(p.slot||'');
const isOut=p=>/^(O|INJ|NA|SUSP|OFS)$/.test(p.status||'');
const pNow=p=>isIL(p)||isOut(p)?0:/^(Q|GTD|DTD)$/.test(p.status||'')?0.6:p.status==='P'?0.9:0.96;
const pROS=p=>p.av*(isIL(p)&&isOut(p)?0.6:1);

/* daily lineup, best players first, each one placed if a legal slot can be found for him */
function lineup(ps){
  const owner=[-1,-1,-1,-1,-1,-1,-1,-1,-1,-1]; const started=[];
  const tryP=(i,seen)=>{ const el=ps[i].el; for(let k=0;k<el.length;k++){ const s=el[k]; if(seen[s]) continue; seen[s]=1; if(owner[s]<0 || tryP(owner[s],seen)){ owner[s]=i; return true; } } return false; };
  for(let i=0;i<ps.length && started.length<10;i++){ if(tryP(i,[0,0,0,0,0,0,0,0,0,0])) started.push(ps[i]); }
  return started;
}
const zeroT=()=>({fgm:0,fga:0,ftm:0,fta:0,tpm:0,pts:0,reb:0,ast:0,stl:0,blk:0,to:0,g:0});
const addT=(T,l,m)=>{ for(let i=0;i<TK.length;i++) T[TK[i]]+=l[TK[i]]*m; T.g+=m; };
const sumT=(a,b)=>{ const o=zeroT(); TK.forEach(k=>o[k]=a[k]+b[k]); o.g=a.g+b.g; return o; };
const scaleT=(a,f)=>{ const o=zeroT(); TK.forEach(k=>o[k]=a[k]*f); o.g=a.g*f; return o; };
const playsOn=(team,day)=>{ const s=D.gset[team]; return !!s && s.has(day); };
/* a started player who sits is covered part of the time by a waiver level fill in, the same idea the draft board uses */
function totalsOver(ros,days,prob,fill){
  const T=zeroT(), ug=new Map(), rho=fill?fill.rho:0, repl=fill?fill.line:null;
  for(const day of days){
    const play=[];
    for(const p of ros){ if(!p.proj || !playsOn(p.team,day)) continue; const pr=prob(p); if(pr<=0) continue; p._pr=pr; p._k=(p.val+14)*pr; play.push(p); }
    if(!play.length) continue;
    play.sort((a,b)=>b._k-a._k);
    for(const p of lineup(play)){ addT(T,p.proj,p._pr); if(repl) addT(T,repl,(1-p._pr)*rho); ug.set(p.id,(ug.get(p.id)||0)+1); }
  }
  return {T,ug};
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
  if(isOut(p)) v*=0.75; else if(/^(Q|GTD|DTD)$/.test(p.status||'')) v*=0.96;
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
  Object.keys(scan.avail||{}).forEach(id=>{ const p=mk(id); if(p.own) return; p.fa=scan.avail[id][0]||'F'; p.status=scan.avail[id][1]||''; ctx.avail.push(p); });
  Object.keys(scan.q||{}).forEach(id=>{ const p=ctx.U[id]; if(p){ p.cur=scan.q[id][0]; p.pct=scan.q[id][1]; } });
  // moves you marked since the last scan
  for(const m of ST.marks){
    if(m.type==='add'){ const a=ctx.U[m.add]; if(a && !a.own){ ctx.avail=ctx.avail.filter(x=>x!==a); a.own=ME; a.slot='BN'; a.fa=''; ctx.ros[ME].push(a); }
      if(m.drop){ const d=ctx.U[m.drop]; if(d && d.own===ME){ ctx.ros[ME]=ctx.ros[ME].filter(x=>x!==d); d.own=null; d.slot=''; d.fa='W'; ctx.avail.push(d); } } }
    if(m.type==='trade'){ const o=m.withTeam; if(!ctx.ros[o]) continue; m.give.forEach(id=>{ const p=ctx.U[id]; if(p&&p.own===ME){ ctx.ros[ME]=ctx.ros[ME].filter(x=>x!==p); p.own=o; p.slot='BN'; ctx.ros[o].push(p); } }); m.get.forEach(id=>{ const p=ctx.U[id]; if(p&&p.own===o){ ctx.ros[o]=ctx.ros[o].filter(x=>x!==p); p.own=ME; p.slot='BN'; ctx.ros[ME].push(p); } }); }
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
  if(has){ const se=etParts(new Date(sc.at)); from=se.hour<21?se.date:addDays(se.date,1); act={}; m.rows.forEach(r=>{ const t=zeroT(); TK.forEach(k=>t[k]=r[k]||0); act[r.tid]=t; }); }
  else from=now.date;
  if(from<wk.start) from=wk.start;
  let addDay=now.hour>=19?addDays(now.date,1):now.date; if(addDay<from) addDay=from;
  ctx.now=now; ctx.wk=wk; ctx.from=from; ctx.act=act; ctx.addDay=addDay;
  ctx.days=from<=wk.end?dayList(from,wk.end):[];
  const g=wk.games.find(x=>x.includes(ME)); ctx.opp=g?(g[0]===ME?g[1]:g[0]):null;
  // the week a new pickup can still help
  if(addDay<=wk.end){ ctx.pwk=wk; ctx.pdays=ctx.days; ctx.pact=act; ctx.popp=ctx.opp; }
  else { const nx=weeks.find(w=>w.n===wk.n+1); if(nx){ ctx.pwk=nx; ctx.pdays=dayList(nx.start,nx.end); ctx.pact=null; const g2=nx.games.find(x=>x.includes(ME)); ctx.popp=g2?(g2[0]===ME?g2[1]:g2[0]):null; if(addDay<nx.start) ctx.addDay=nx.start; } else { ctx.pwk=wk; ctx.pdays=[]; ctx.pact=act; ctx.popp=ctx.opp; } }
  // four typical weeks ahead, used for the rest of season numbers
  const ts=from; ctx.tdays=dayList(ts,addDays(ts,27)).filter(d=>d<='2027-04-11'); ctx.tweeks=Math.max(1,ctx.tdays.length/7);
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
}
function oppWeights(ctx,tid){ const w={}; let s=0; Object.keys(ctx.ros).forEach(o=>{ if(o===tid) return; w[o]=0.5+((ctx.rem[tid]||{})[o]||0); s+=w[o]; }); Object.keys(w).forEach(o=>w[o]/=s); return w; }
function strength(ctx,tid,typ){
  const w=oppWeights(ctx,tid); let week=0; const per=new Array(9).fill(0), vs={};
  Object.keys(w).forEach(o=>{ const pr=catProbs(typ[tid],typ[o],ctx.u,ctx.up); const pw=pWin5(pr); vs[o]=pw; week+=w[o]*pw; for(let c=0;c<9;c++) per[c]+=w[o]*pr[c]; });
  return {week,per,vs};
}

/* this week against the real opponent, with the live score once the week has started */
function weekProj(ctx,ros,tid,days,act){ const r=totalsOver(ros,days,pNow,ctx.fillW); const a=act&&act[tid]; return {tot:a?sumT(a,r.T):r.T,rest:r.T,ug:r.ug,games:r.T.g}; }
function thisWeek(ctx){
  if(!ctx.opp) return null;
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
  const mine=ctx.ros[ME], prot=myProtected(ctx), days=ctx.pdays, opp=ctx.popp;
  const out={list:[],note:'',adds:addsLeft(ctx),free:0,ilMove:null,week:ctx.pwk,opp};
  out.wait=Math.round((new Date(ctx.addDay+'T12:00:00Z')-new Date(ctx.now.date+'T12:00:00Z'))/864e5);
  if(!opp || !days.length){ out.note='No games left to add for.'; return out; }
  const active=mine.filter(p=>!isIL(p)); out.free=Math.max(0,15-active.length);
  const ilUsed=mine.filter(isIL).length; const ilCand=active.filter(p=>isOut(p)); if(ilUsed<2 && ilCand.length) out.ilMove=ilCand[0];
  const drops=active.filter(p=>!prot.has(p.id) && !(out.ilMove&&p===out.ilMove));
  const pre=days.filter(d=>d<ctx.addDay), post=days.filter(d=>d>=ctx.addDay);
  const act=ctx.pact;
  const opT=weekProj(ctx,ctx.ros[opp],opp,days,act);
  const preT=totalsOver(mine,pre,pNow,ctx.fillW).T;
  const mk=ros=>{ const r=totalsOver(ros,post,pNow,ctx.fillW); const rest=sumT(preT,r.T); const a=act&&act[ME]; return {tot:a?sumT(a,rest):rest,rest,ug:r.ug}; };
  const base=mk(mine), bp=catProbs(base,opT,ctx.u,ctx.up), bw=pWin5(bp);
  out.base={probs:bp,win:bw};
  const myW=oppWeights(ctx,ME), b0=ctx.base[ME];
  const rosFast=(inP,outP)=>{ const T=sumT(ctx.typ[ME],zeroT()); if(outP) addT(T,outP.eff,-(ctx.ug[outP.id]||0)); addT(T,inP.eff,(ctx.gpw[inP.team]||3.3)*0.9); let wk=0; Object.keys(myW).forEach(o=>{ wk+=myW[o]*pWin5(catProbs(T,ctx.typ[o],ctx.u,ctx.up)); }); return 100*(wk-b0.week); };
  const cands=ctx.avail.filter(p=>p.proj && !isOut(p) && p.team);
  const openSpot=out.free>0 || !!out.ilMove;
  const rows=[];
  for(const c of cands){
    const gl=post.filter(d=>playsOn(c.team,d)).length; const wd=waiverDate(c.fa);
    let best=null;
    const opts=openSpot?[null]:drops;
    for(const d of opts){
      const ros=mine.filter(p=>p!==d && !(out.ilMove && !out.free && p===out.ilMove)).concat([c]);
      const t=mk(ros), pr=catProbs(t,opT,ctx.u,ctx.up), gW=100*(pWin5(pr)-bw);
      const gR=rosFast(c,d||(out.ilMove&&!out.free?null:null));
      const hold=0.4*gW+0.6*gR, stream=0.85*gW; const g=Math.max(hold,stream);
      if(!best || g>best.g) best={drop:d,gW,gR,g,kind:hold>=stream?'hold':'stream',pr,use:t.ug.get(c.id)||0};
    }
    if(!best) continue;
    rows.push(Object.assign({p:c,gl,wd},best));
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
    r.waiver=!!r.wd || p.fa==='W'; if(r.waiver) need-=6;
    if(out.adds<=0) need-=20; else if(out.adds===1 && ctx.pdays.length>=4) need-=4;
    if(out.wait>2) need-=Math.min(15,3*(out.wait-2));
    r.need=clamp(Math.round(need),0,99);
    r.band=r.need>=85?'must':r.need>=65?'strong':r.need>=50?'helps':'skip';
    const dc=r.pr.map((x,c)=>100*(x-bp[c])); r.dc=dc;
    const bestCat=dc.map((v,c)=>[v,c]).sort((a,b)=>b[0]-a[0])[0];
    r.tag=r.cover?'Covers an injury':(r.kind==='stream'&&r.gl>=3&&r.gR<0.2)?'Stream for games':(b&&(b.upside||b.rookie)&&r.gW<0.5)?'Stash for upside':('Boosts '+CATS[bestCat[1]]);
    r.why=why;
  }
  out.list=top.filter(r=>r.g>0.05).sort((a,b)=>b.need-a.need||b.g-a.g).slice(0,14);
  return out;
}
function addsLeft(ctx){ const L=D.league, wk=ctx.wk, tx=ctx.scan.tx||[]; let used=0;
  tx.forEach(x=>{ if(x[1]!==ME) return; const m=String(x[0]).match(/^([A-Za-z]{3})(\d{1,2})$/); if(!m) return; const mo=MON.indexOf(m[1]); if(mo<0) return; const d=(mo>=8?2026:2027)+'-'+String(mo+1).padStart(2,'0')+'-'+String(+m[2]).padStart(2,'0'); if(d>=wk.start && d<=wk.end) used+=(String(x[2]).match(/\+/g)||[]).length; });
  used+=ST.marks.filter(m=>m.type==='add').length; return Math.max(0,(L.adds||4)-used); }

/* trades */
function trades(ctx,done){
  const res={list:[],count:0,base:ctx.base[ME]}; const L=D.league;
  const today=ctx.now.date; if(L.tradeDeadline && today>L.tradeDeadline){ res.note='The trade deadline has passed.'; done(res); return; }
  const mine=ctx.ros[ME].filter(p=>p.proj && !NEVER.has(B.nkey(p.name)) && !(HOLD[B.nkey(p.name)] && today<HOLD[B.nkey(p.name)]));
  const opps=Object.keys(ctx.ros).filter(t=>t!==ME && (ST.co || t!==L.comanaged));
  const combos=(arr,k)=>{ if(k===1) return arr.map(x=>[x]); const o=[]; for(let i=0;i<arr.length;i++) for(let j=i+1;j<arr.length;j++) o.push([arr[i],arr[j]]); return o; };
  const gives={1:combos(mine,1),2:combos(mine,2)};
  const W={}; Object.keys(ctx.ros).forEach(t=>W[t]=oppWeights(ctx,t));
  const weekOf=(tid,typ)=>{ const w=W[tid]; let s=0; Object.keys(w).forEach(o=>{ s+=w[o]*pWin5(catProbs(typ[tid],typ[o],ctx.u,ctx.up)); }); return s; };
  const ugIn=p=>(ctx.gpw[p.team]||3.3)*0.93;
  // what you would gain by simply dropping a player for a streaming spot, so a two for one is never credited for that
  const dropGain={}; ctx.ros[ME].forEach(p=>{ if(!p.proj) return; const T=sumT(ctx.typ[ME],zeroT()); addT(T,p.eff,-(ctx.ug[p.id]||0)); TK.forEach(k=>T[k]+=ctx.stream[k]); const typ=Object.assign({},ctx.typ); typ[ME]=T; dropGain[p.id]=Math.max(0,100*(weekOf(ME,typ)-ctx.base[ME].week)); });
  const out=[]; let oi=0;
  const step=()=>{
    if(oi>=opps.length){ finish(); return; }
    const o=opps[oi++], their=ctx.ros[o].filter(p=>p.proj);
    const gets={1:combos(their,1),2:combos(their,2)};
    const worst=their.slice().sort((a,b)=>(a.val+14)*(ctx.ug[a.id]||0)-(b.val+14)*(ctx.ug[b.id]||0));
    for(const sh of [[1,1],[2,2],[2,1]]){
      for(const give of gives[sh[0]]) for(const get of gets[sh[1]]){
        const recvM=dw(give.map(p=>p.mv)), giveM=dw(get.map(p=>p.mv)); if(giveM<=0||recvM<=0) continue;
        const ratio=recvM/giveM; if(ratio<0.9||ratio>1.45) continue;
        const myC=ctx.ros[ME].filter(isC).length-give.filter(isC).length+get.filter(isC).length; if(myC<3) continue;
        const thC=ctx.ros[o].filter(isC).length-get.filter(isC).length+give.filter(isC).length; if(thC<2) continue;
        const Tm=sumT(ctx.typ[ME],zeroT()), To=sumT(ctx.typ[o],zeroT());
        give.forEach(p=>{ addT(Tm,p.eff,-(ctx.ug[p.id]||0)); addT(To,p.eff,ugIn(p)); });
        get.forEach(p=>{ addT(To,p.eff,-(ctx.ug[p.id]||0)); addT(Tm,p.eff,ugIn(p)); });
        let cut=null, credit=0;
        if(sh[0]>sh[1]){ const s=ctx.stream; TK.forEach(k=>Tm[k]+=s[k]); cut=worst.find(p=>!get.includes(p)); if(cut) addT(To,cut.eff,-(ctx.ug[cut.id]||0)); credit=Math.max(dropGain[give[0].id]||0,dropGain[give[1].id]||0); }
        const typ=Object.assign({},ctx.typ); typ[ME]=Tm; typ[o]=To;
        const myGain=100*(weekOf(ME,typ)-ctx.base[ME].week)-credit; if(myGain<0.3) continue;
        const oGain=100*(weekOf(o,typ)-ctx.base[o].week); if(oGain<-1) continue;
        out.push({o,give,get,ratio,myGain,oGain,cut,credit,two:sh[0]>sh[1]});
      }
    }
    setTimeout(step,0);
  };
  const score=t=>{
    const o=t.o; const top=t.get.some(p=>(pickOf[B.nkey(p.name)]||99)<=20 || LEGEND.has(B.nkey(p.name)));
    t.top=top; t.acc=clamp(1/(1+Math.exp(-(7*(Math.min(t.ratio,1.6)-1.03)+0.3*t.oGain+0.25*(t.need||0)-(top?1:0)-(t.two?0.4:0)))),0.03,0.92);
    t.josh=dw(t.get.map(p=>p.jv))-dw(t.give.map(p=>p.jv));
    t.score=t.myGain*t.acc*(1+clamp(t.josh,-15,15)/60);
  };
  const exact=t=>{
    const o=t.o; const rm=ctx.ros[ME].filter(p=>!t.give.includes(p)).concat(t.get); const ro=ctx.ros[o].filter(p=>!t.get.includes(p) && p!==t.cut).concat(t.give);
    const a=totalsOver(rm,ctx.tdays,pROS,ctx.fillR), b=totalsOver(ro,ctx.tdays,pROS,ctx.fillR);
    const Tm=scaleT(a.T,1/ctx.tweeks), To=scaleT(b.T,1/ctx.tweeks); if(t.two){ const s=ctx.stream; TK.forEach(k=>Tm[k]+=s[k]); }
    const typ=Object.assign({},ctx.typ); typ[ME]=Tm; typ[o]=To;
    const sm=strength(ctx,ME,typ), so=strength(ctx,o,typ);
    t.myGain=100*(sm.week-ctx.base[ME].week)-(t.credit||0); t.oGain=100*(so.week-ctx.base[o].week);
    t.dme=sm.per.map((x,c)=>100*(x-ctx.base[ME].per[c])); t.dop=so.per.map((x,c)=>100*(x-ctx.base[o].per[c]));
    t.after=ctx.base[ME].week+t.myGain/100; t.oafter=so.week;
    const weak=ctx.base[o].per.map((x,c)=>x<0.45?c:-1).filter(c=>c>=0);
    t.weakHelp=weak.filter(c=>t.dop[c]>=1.5); t.need=clamp(weak.reduce((s,c)=>s+t.dop[c],0)/5,-1.5,2.5);
  };
  const finish=()=>{
    out.forEach(score); out.sort((a,b)=>b.score-a.score);
    const seen={}, keep=[];
    const cnt={};
    for(const t of out){ const k=t.o+'|'+t.get.map(p=>p.id).sort().join('+'); const sk=t.give.length+'for'+t.get.length; if((cnt[sk]||0)>=30) continue; seen[k]=(seen[k]||0)+1; if(seen[k]>2) continue; cnt[sk]=(cnt[sk]||0)+1; keep.push(t); }
    keep.forEach(t=>{ exact(t); score(t); });
    const good=keep.filter(t=>t.myGain>=0.3 && t.oGain>=-1.0 && t.acc>=0.25).sort((a,b)=>b.score-a.score);
    const s2={}, fin=[];
    const shape={};
    for(const t of good){ const k=t.o+'|'+t.get.map(p=>p.id).sort().join('+'); if(s2[k]) continue; const sk=t.give.length+'for'+t.get.length; if((shape[sk]||0)>=6) continue; s2[k]=1; shape[sk]=(shape[sk]||0)+1; fin.push(t); if(fin.length>=14) break; }
    const hurt=ctx.ros[ME].filter(p=>isOut(p) && p.val>0 && myProtected(ctx).has(p.id));
    fin.forEach((t,i)=>{ t.urgent=i<2 && t.oGain>=-0.3 && ((t.myGain>=3 && t.acc>=0.6) || (hurt.length>0 && t.myGain>=1.5 && t.acc>=0.5)); });
    fin.sort((a,b)=>(b.urgent?1:0)-(a.urgent?1:0)||b.score-a.score);
    res.list=fin; res.count=out.length; done(res);
  };
  setTimeout(step,0);
}

/* league table and the race for the top four */
function mulberry(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function race(ctx){
  const L=D.league, tids=Object.keys(ctx.ros), rnd=mulberry(82878), N=3000;
  const P={}; tids.forEach(a=>{ P[a]={}; tids.forEach(b=>{ if(a!==b) P[a][b]=pWin5(catProbs(ctx.typ[a],ctx.typ[b],ctx.u,ctx.up)); }); });
  const games=[]; L.weeks.filter(w=>w.n>=ctx.wk.n && w.n<=(L.lastRegularWeek||18)).forEach(w=>w.games.forEach(g=>{ if(P[g[0]]&&P[g[1]]) games.push(g); }));
  const top4={}, wins={}; tids.forEach(t=>{ top4[t]=0; wins[t]=0; });
  // the model can be wrong about how good a team really is, most of all before games are played, so each simulated season nudges every team up or down
  const sig=0.15+0.55*(1-ctx.wbar), gauss=()=>{ let a=0; for(let k=0;k<6;k++) a+=rnd(); return (a-3)*1.4142; }, lg=x=>Math.log(clamp(x,0.02,0.98)/(1-clamp(x,0.02,0.98)));
  for(let i=0;i<N;i++){
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
  let s='Based on last season\'s numbers, shaped by Josh Lloyd\'s ranks. No games have been played this season yet.';
  if(k.has('est')) s+=' Rookie numbers are a preseason estimate.';
  if(k.has('older')) s+=' A player who missed last season uses his most recent full season.';
  return s;
}
const basisChip=p=>p.basis==='now'?'<span class="chip good">This season</span>':p.basis==='blend'?'<span class="chip">Blend, '+p.gp+' games</span>':p.basis==='est'?'<span class="chip warn">Preseason estimate</span>':p.basis==='older'?'<span class="chip warn">Older season</span>':p.basis==='last'?'<span class="chip muted">Last season</span>':'<span class="chip bad">No numbers</span>';
const statusWord=s=>s==='O'?'out':s==='INJ'?'injured':s==='Q'?'questionable':s==='GTD'?'a game time call':s==='DTD'?'day to day':s==='P'?'probable':s==='NA'?'not active':s==='SUSP'?'suspended':'';
const catMoves=(dc,min)=>{ const up=[], dn=[]; dc.map((v,c)=>[v,c]).sort((a,b)=>Math.abs(b[0])-Math.abs(a[0])).forEach(x=>{ if(x[0]>=min) up.push(CATWORD[x[1]]); else if(x[0]<=-min) dn.push(CATWORD[x[1]]); }); return {up,dn}; };
const listWords=a=>a.length<=1?a.join(''):a.slice(0,-1).join(', ')+' and '+a[a.length-1];
const yrank=p=>p.cur||p.pre;
function pickupWhy(ctx,pk,r){
  const p=r.p, wkWord=pk.week.n===ctx.wk.n?'this week':'next week', oppName=(ctx.teams[pk.opp]||{}).name||'your opponent';
  const mv=catMoves(r.dc,1.5); const a=[];
  let s1='Your chance to beat '+oppName+' '+wkWord+' goes from '+pc(pk.base.win)+' to '+pc(pk.base.win+r.gW/100)+' percent.';
  if(mv.up.length) s1+=' He helps most in '+listWords(mv.up.slice(0,3))+'.'; if(mv.dn.length) s1+=' It costs a little in '+listWords(mv.dn.slice(0,2))+'.';
  s1+=' Over the rest of the season your average week moves '+(r.gR>=0?'up ':'down ')+Math.abs(r1(r.gR))+' points.';
  a.push(s1);
  let s2='He has '+r.gl+' game'+(r.gl===1?'':'s')+' left '+wkWord+' and about '+r1(r.use)+' fit in your lineup. ';
  if(r.drop) s2+='Drop '+r.drop.name+', your least useful player for this. ';
  else if(pk.free) s2+='You have an open roster spot, so no drop is needed. ';
  else if(pk.ilMove) s2+='Move '+pk.ilMove.name+' to IL first, he is tagged '+statusWord(pk.ilMove.status)+', then no drop is needed. ';
  if(r.wd) s2+='He is on waivers until '+nice(r.wd)+'. A claim sends you to the back of the waiver line, you are number '+((ctx.teams[ME]||{}).waiver||'?')+' now.';
  else if(r.waiver) s2+='He is on waivers. A claim sends you to the back of the waiver line.';
  else s2+='He is a free agent, so he costs one of your '+pk.adds+' adds left this week and no waiver spot.';
  a.push(s2);
  let s3=basisWords([p]); if(r.josh>0 && p.b) s3+=' Josh has him at '+p.b.josh+', well above his Yahoo rank of '+(yrank(p)||'none')+'.'; if(r.josh<0 && p.b) s3+=' Josh has him at '+p.b.josh+', below his Yahoo rank of '+(yrank(p)||'none')+'.';
  a.push(s3);
  const risk=[]; if(p.status) risk.push('he is tagged '+statusWord(p.status)); if(r.why.includes('hot stretch without extra minutes')) risk.push('his last two weeks look hot but his minutes did not grow'); if(p.role==='down') risk.push('his minutes are down lately'); if(p.basis==='est') risk.push('he is a rookie with no NBA games'); if(r.sim>=4) risk.push('several similar players are sitting there, so you can wait');
  a.push(risk.length?'Risk, '+listWords(risk)+'.':'Risk, nothing unusual. Check his news before you add.');
  return a;
}
function tradeWhy(ctx,t){
  const oName=(ctx.teams[t.o]||{}).name||'them'; const nm=a=>listWords(a.map(p=>p.name)); const a=[];
  const mv=catMoves(t.dme,1.5);
  let s1='You give '+nm(t.give)+' and get '+nm(t.get)+'. Your average week goes from '+pc(ctx.base[ME].week)+' to '+pc(t.after)+' percent.';
  if(mv.up.length) s1+=' You get better in '+listWords(mv.up.slice(0,3))+'.'; if(mv.dn.length) s1+=' You give up some '+listWords(mv.dn.slice(0,3))+'.';
  if(t.two) s1+=' It also opens a roster spot for streaming.';
  a.push(s1);
  a.push(pitch(ctx,t));
  let s3=basisWords(t.give.concat(t.get)); const je=t.josh; if(Math.abs(je)>=4) s3+=' By Josh\'s ranks you '+(je>0?'win':'lose')+' the value in this deal.';
  a.push(s3);
  const risk=[]; t.get.forEach(p=>{ if(p.status) risk.push(p.name+' is tagged '+statusWord(p.status)); if(p.b&&p.b.risk>=2) risk.push(p.name+' carries injury risk'); if(p.basis==='est') risk.push(p.name+' is a rookie estimate'); });
  if(t.top) risk.push('they drafted or prize what you are asking for, so expect a counter'); if(t.o===D.league.comanaged) risk.push('you may help run this team, so keep it clean'); if(t.cut) risk.push('they would have to drop '+t.cut.name);
  a.push(risk.length?'Risk, '+listWords(risk)+'. Check the news before you send it.':'Risk, nothing unusual. Check the news before you send it.');
  return a;
}
function pitch(ctx,t){
  const oName=(ctx.teams[t.o]||{}).name||'them'; const nm=a=>listWords(a.map(p=>p.name+(yrank(p)?' (Yahoo '+yrank(p)+')':'')));
  let s='Why they say yes. ';
  if(t.weakHelp.length) s+='They are weak in '+listWords(t.weakHelp.slice(0,3).map(c=>CATWORD[c]))+' and '+listWords(t.give.map(p=>p.name))+' helps there. ';
  else { const up=catMoves(t.dop,1.5).up; if(up.length) s+='It makes them better in '+listWords(up.slice(0,3))+'. '; }
  s+='They get '+nm(t.give)+' for '+nm(t.get)+'. ';
  s+=t.ratio>=1.12?'On Yahoo ranks and name value it looks like a win for them.':t.ratio>=0.97?'On Yahoo ranks and name value it looks even.':'On Yahoo ranks it looks a touch light, so sell the fit.';
  s+=' Their average week moves '+(t.oGain>=0?'up ':'down ')+Math.abs(r1(t.oGain))+' points by this model.';
  return s;
}
function pitchText(ctx,t){
  const nm=a=>listWords(a.map(p=>p.name)); const up=t.weakHelp.length?t.weakHelp.slice(0,3).map(c=>CATWORD[c]):catMoves(t.dop,1.5).up.slice(0,3);
  let s='Trade idea. I send you '+nm(t.give)+' for '+nm(t.get)+'.';
  if(up.length) s+=' It helps you in '+listWords(up)+', which is where your team is light.';
  if(t.give.length>t.get.length) s+=' You get two useful players for one.';
  s+=' Let me know what you think.';
  return s;
}

/* drawing */
let CTX=null, CTXW=null, TR=null, PK=null, WK=null, RACE=null, busy=false;
function css(){
  if($('mvcss')) return; const s=document.createElement('style'); s.id='mvcss';
  s.textContent='.mv{display:flex;flex-direction:column;gap:16px}.mvgrid{display:grid;grid-template-columns:minmax(0,400px) minmax(0,1fr);gap:16px;align-items:start}@media (max-width:1100px){.mvgrid{grid-template-columns:minmax(0,1fr)}}.mvcol{display:flex;flex-direction:column;gap:16px;min-width:0}'
  +'.mvcells{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:8px;margin:10px 0}.mvc{border:1px solid var(--line);border-radius:8px;padding:8px 10px;background:var(--panel-2)}.mvc .k{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);font-weight:600}.mvc .v{font-family:var(--display);font-size:26px;line-height:1.1}.mvc .s{font-size:12px;color:var(--muted)}'
  +'.mvscan{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px;color:var(--muted)}'
  +'.mvcard{border:1px solid var(--line);border-radius:8px;background:var(--panel-2);margin-bottom:8px}.mvcard[open]{border-color:var(--accent)}.mvcard summary{list-style:none;cursor:pointer;padding:10px 12px;display:grid;grid-template-columns:54px minmax(0,1fr);gap:4px 10px;align-items:center}.mvcard summary::-webkit-details-marker{display:none}'
  +'.mvn{font-family:var(--display);font-size:28px;line-height:1;text-align:center;border-radius:8px;padding:6px 0;background:var(--panel);border:1px solid var(--line)}.mvn small{display:block;font-family:var(--body);font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-top:2px}.mvn.must{background:var(--good-bg);color:var(--good);border-color:var(--good)}.mvn.strong{background:var(--accent-soft);color:var(--accent);border-color:var(--accent)}.mvn.helps{background:var(--warn-bg);color:var(--warn)}.mvn.skip{color:var(--muted)}'
  +'.mvt{min-width:0}.mvt b{font-size:15.5px}.mvt .sub{color:var(--muted);font-size:12.5px}.mvt .meta{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px}.mvbody{padding:0 12px 12px;font-size:14px;display:flex;flex-direction:column;gap:8px;border-top:1px dashed var(--line);margin-top:2px;padding-top:10px}.mvbody p{margin:0;max-width:72ch}.mvbody .lab{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);font-weight:700;display:block}'
  +'.mvact{display:flex;flex-wrap:wrap;gap:8px}.mvtbl{overflow-x:auto}.mvtbl table{font-size:12.5px}.mvtbl td.num,.mvtbl th.num{text-align:right}.mvme td{background:var(--accent-soft)}'
  +'.mvrow{display:grid;grid-template-columns:44px minmax(0,1fr) 108px 44px;align-items:center;gap:8px;font-size:13px;margin-bottom:5px}.mvrow .cn{font-family:var(--mono);font-size:12px}.mvrow .tv{font-family:var(--mono);font-size:11.5px;color:var(--muted);text-align:right;white-space:nowrap}.mvrow .pv{font-family:var(--mono);font-size:12px;text-align:right;font-weight:700}'
  +'.mvbig{font-family:var(--display);font-size:44px;line-height:1}.mvbig small{font-family:var(--body);font-size:13px;color:var(--muted);font-weight:500;margin-left:6px}'
  +'body.moves #quick,body.moves .controls .field,body.moves .controls>.btn{display:none}';
  document.head.appendChild(s);
}
function scanLine(ctx){
  const sc=ctx.scan, at=new Date(sc.at), age=(nowDate()-at)/36e5;
  const when=at.toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  const dot=age<=30?'ok':age<=72?'warn':'bad';
  let basis; if(ctx.wbar<0.02) basis='Numbers are based on last season, shaped by Josh Lloyd\'s ranks. No games have been played yet.'; else if(ctx.wbar<0.75) basis='Numbers blend last season with this season so far, about '+r0(ctx.avgGP)+' games per player.'; else basis='Numbers are based on this season, about '+r0(ctx.avgGP)+' games per player.';
  return '<div class="mvscan"><span class="ydot '+dot+'"></span><span>Yahoo was last scanned '+esc(when)+(age>30?', that is '+r0(age/24)+' day'+(r0(age/24)===1?'':'s')+' old':'')+'. '+basis+' Every number is a model estimate.</span></div>';
}
function render(){
  css(); const root=$('viewMoves'); if(!root) return;
  if(!D.scan || !D.league || !D.sched){ root.innerHTML='<div class="panel"><h2>Pickups and trades</h2><p class="empty">'+(D.loading?'Loading the league data.':'No Yahoo scan is loaded yet. The daily scan puts it here.')+'</p></div>'; return; }
  const ctx=CTX, wk=WK, pk=PK, me=ctx.base[ME], rc=RACE; const mine=rc.rows.find(r=>r.tid===ME);
  const oppName=ctx.opp?((ctx.teams[ctx.opp]||{}).name||''):'';
  let h='<div class="mv">';
  h+='<div class="panel">'+scanLine(ctx);
  h+='<div class="mvcells">';
  h+='<div class="mvc"><div class="k">Week '+ctx.wk.n+' win chance</div><div class="v">'+(wk?pc(wk.win)+'%':'none')+'</div><div class="s">'+(wk?'vs '+esc(oppName):'no matchup')+'</div></div>';
  h+='<div class="mvc"><div class="k">Cats you lead</div><div class="v">'+(wk?wk.fav:0)+' of 9</div><div class="s">you need 5</div></div>';
  h+='<div class="mvc"><div class="k">Average week</div><div class="v">'+pc(me.week)+'%</div><div class="s">rest of season, ranks '+mine.pos+' of 10</div></div>';
  h+='<div class="mvc"><div class="k">Top four chance</div><div class="v">'+pc(mine.top4)+'%</div><div class="s">about '+r1(mine.wins)+' wins by week 18</div></div>';
  h+='<div class="mvc"><div class="k">Adds left</div><div class="v">'+pk.adds+' of '+(D.league.adds||4)+'</div><div class="s">waiver spot '+((ctx.teams[ME]||{}).waiver||'?')+' of 10</div></div>';
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
  let s=wk.fav>=5?'You lead '+wk.fav+' of 9 cats against '+esc((ctx.teams[ctx.opp]||{}).name||'')+'. Hold the lead and protect the close ones.':'You lead only '+wk.fav+' of 9 cats, so you need '+need+' more. Keep adding and trading until this reads 5 or more.';
  const close=wk.probs.map((p,c)=>[Math.abs(p-0.5),c,p]).filter(x=>x[0]<0.12).sort((a,b)=>a[0]-b[0]).slice(0,3).map(x=>CATS[x[1]]);
  if(close.length) s+=' The swing cats are '+listWords(close)+'.';
  if(top) s+=' Best pickup now is '+esc(top.p.name)+' at '+top.need+'.';
  return s;
}
function weekPanel(ctx,wk){
  if(!wk) return '<div class="panel"><h2>This week</h2><p class="empty">No matchup this week.</p></div>';
  const oppName=(ctx.teams[ctx.opp]||{}).name||''; const live=!!ctx.act; const fm=(t,c)=>c===0?(t.fga>0?(100*t.fgm/t.fga).toFixed(1):'0'):c===1?(t.fta>0?(100*t.ftm/t.fta).toFixed(1):'0'):String(r0(t[CK[c-2]]));
  let h='<div class="panel"><h2>Week '+ctx.wk.n+' vs '+esc(oppName)+' <span>'+nice(ctx.wk.start)+' to '+nice(ctx.wk.end)+'</span></h2>';
  h+='<div class="mvbig">'+pc(wk.win)+'%<small>chance to win 5 or more cats, about '+r1(wk.exp)+' cats expected</small></div>';
  h+='<p class="small">'+(live?'Live score from the scan plus the games still to come. ':'Projected totals for the week. ')+'You have '+r0(wk.me.games)+' player games '+(live?'left':'planned')+', they have '+r0(wk.op.games)+'.</p>';
  wk.probs.forEach((p,c)=>{ const col=p>=0.5?'var(--good)':'var(--bad)'; const w=Math.abs(p-0.5)*100; const left=p>=0.5?50:50-w;
    h+='<div class="mvrow"><span class="cn">'+CATS[c]+'</span><span class="bar"><span class="mid"></span><span class="fill" style="left:'+left+'%;width:'+w+'%;background:'+col+'"></span></span><span class="tv">'+fm(wk.me.tot,c)+' vs '+fm(wk.op.tot,c)+'</span><span class="pv" style="color:'+col+'">'+pc(p)+'</span></div>'; });
  h+='<p class="small">The number on the right is your chance to win that cat. Green means you are ahead.</p></div>';
  return h;
}
function pickPanel(ctx,pk){
  let h='<div class="panel"><h2>Pickups <span>updates every day after the Yahoo scan</span></h2>';
  const wkWord=pk.week.n===ctx.wk.n?'this week':'week '+pk.week.n;
  h+='<p class="small">Need score, 85 and up means add him now even if it costs a waiver claim. 65 to 84 means add him once he is a free agent. 50 to 64 helps but keep your waiver spot. Under 50, skip. Scores are for '+wkWord+' against '+esc((ctx.teams[pk.opp]||{}).name||'')+' plus the rest of the season.</p>';
  if(pk.ilMove && !pk.free) h+='<div class="switch">'+esc(pk.ilMove.name)+' is tagged '+statusWord(pk.ilMove.status)+'. Move him to IL and you can add someone without dropping anyone.</div>';
  if(pk.free) h+='<div class="switch">You have '+pk.free+' open roster spot'+(pk.free===1?'':'s')+', so an add needs no drop.</div>';
  if(!pk.list.length) h+='<p class="empty">'+(pk.note||'No pickup helps you right now. Hold your adds and your waiver spot.')+'</p>';
  pk.list.forEach((r,i)=>{
    const p=r.p; const why=pickupWhy(ctx,pk,r);
    h+='<details class="mvcard"><summary><span class="mvn '+r.band+'">'+r.need+'<small>'+(r.band==='must'?'must add':r.band==='strong'?'strong':r.band==='helps'?'helps':'skip')+'</small></span><span class="mvt"><b>'+esc(p.name)+'</b> <span class="sub">'+esc(p.team)+', '+esc(p.pos.join(' '))+(r.drop?', drop '+esc(r.drop.name):'')+'</span>'
      +'<span class="meta"><span class="chip">'+esc(r.tag)+'</span><span class="chip muted">'+r.gl+' games left</span>'+(r.wd?'<span class="chip warn">Waivers until '+nice(r.wd)+'</span>':r.waiver?'<span class="chip warn">On waivers</span>':'<span class="chip good">Free agent</span>')+(r.josh>0?'<span class="chip gem">Josh likes him</span>':'')+(p.status?'<span class="chip bad">'+esc(statusWord(p.status))+'</span>':'')+basisChip(p)+'</span></span></summary>'
      +'<div class="mvbody"><p><span class="lab">What it does for you</span>'+esc(why[0])+'</p><p><span class="lab">What it costs</span>'+esc(why[1])+'</p><p><span class="lab">What it is based on</span>'+esc(why[2])+'</p><p><span class="lab">Risk</span>'+esc(why[3])+'</p>'
      +'<div class="mvact"><button class="btn" type="button" data-add="'+p.id+'" data-drop="'+(r.drop?r.drop.id:'')+'">I made this add</button></div></div></details>';
  });
  h+='</div>'; return h;
}
function tradePanel(ctx){
  let h='<div class="panel"><h2>Trades <span>updates each week and after any roster move in the league</span></h2>';
  const cw=CTXW; const snap=new Date(cw.scan.at).toLocaleDateString(undefined,{month:'short',day:'numeric'});
  h+='<p class="small">Ranked by your gain times the chance they say yes. Your gain is the change in your average week for the rest of the season. Built from the snapshot of '+esc(snap)+'. Kyrie is never offered. Boozer is held until the middle of January. You always keep three centers.</p>';
  if(!TR){ h+='<p class="empty" id="mvtrwait">Scoring trades with all nine teams.</p></div>'; return h; }
  if(TR.note) h+='<p class="empty">'+esc(TR.note)+'</p>';
  else if(!TR.list.length) h+='<p class="empty">No fair trade helps you right now. Checked '+TR.count+' offers.</p>';
  TR.list.forEach((t,i)=>{
    const why=tradeWhy(cw,t); const oName=(cw.teams[t.o]||{}).name||''; const nm=a=>a.map(p=>esc(p.name)).join(' and ');
    const look=t.ratio>=1.12?'Looks like a win for them':t.ratio>=0.97?'Looks even to them':'Looks a bit light to them';
    h+='<details class="mvcard"><summary><span class="mvn '+(t.urgent?'must':t.acc>=0.5?'strong':'helps')+'">'+sgn(t.myGain)+'<small>your gain</small></span><span class="mvt"><b>Get '+nm(t.get)+'</b> <span class="sub">for '+nm(t.give)+', with '+esc(oName)+'</span>'
      +'<span class="meta">'+(t.urgent?'<span class="chip gem">Do this now</span>':'')+'<span class="chip '+(t.acc>=0.6?'good':t.acc>=0.4?'':'warn')+'">'+pc(t.acc)+'% they say yes</span><span class="chip muted">'+look+'</span><span class="chip muted">Their gain '+sgn(t.oGain)+'</span><span class="chip '+(t.josh>=4?'good':t.josh<=-4?'bad':'muted')+'">Josh edge '+sgn(t.josh)+'</span>'+(t.o===D.league.comanaged?'<span class="chip warn">Team you may co manage</span>':'')+'</span></span></summary>'
      +'<div class="mvbody"><p><span class="lab">What it does for you</span>'+esc(why[0])+'</p><p><span class="lab">The pitch</span>'+esc(why[1])+'</p><p><span class="lab">What it is based on</span>'+esc(why[2])+'</p><p><span class="lab">Risk</span>'+esc(why[3])+'</p>'
      +'<div class="mvact"><button class="btn" type="button" data-trade="'+i+'">I made this trade</button><button class="btn" type="button" data-pitch="'+i+'">Copy a message to send</button></div></div></details>';
  });
  h+='<p class="small"><label><input type="checkbox" id="mvco"'+(ST.co?' checked':'')+'> Also show trades with '+esc((cw.teams[D.league.comanaged]||{}).name||'the co managed team')+'</label></p>';
  h+='</div>'; return h;
}
function leaguePanel(ctx,rc){
  let h='<div class="panel"><h2>The league <span>all ten teams, strongest first</span></h2><div class="mvtbl"><table><thead><tr><th>#</th><th>Team</th><th class="num">Record</th><th class="num">Avg week</th><th class="num">Top 4</th></tr></thead><tbody>';
  rc.rows.forEach(r=>{ const strong=r.per.map((p,c)=>p>=0.6?CATS[c]:'').filter(Boolean), weak=r.per.map((p,c)=>p<=0.4?CATS[c]:'').filter(Boolean);
    h+='<tr class="'+(r.tid===ME?'mvme':'')+'"><td>'+r.pos+'</td><td style="white-space:normal"><b>'+esc(r.name)+'</b><div class="small">'+(strong.length?'Strong '+strong.join(' '):'No strong cat')+(weak.length?'. Weak '+weak.join(' '):'')+'</div></td><td class="num">'+(r.rec.w||0)+' '+(r.rec.l||0)+' '+(r.rec.t||0)+'</td><td class="num">'+pc(r.week)+'%</td><td class="num">'+pc(r.top4)+'%</td></tr>'; });
  h+='</tbody></table></div><p class="small">Avg week is the chance to win a typical week against the teams left on the schedule. Top 4 is the chance to finish the regular season in the first four, from 3000 simulated seasons. Record is wins, losses, ties. Weak cats are what that manager needs, so offer those.</p></div>';
  return h;
}
function teamPanel(ctx,wk){
  const mine=ctx.ros[ME].slice().sort((a,b)=>b.val-a.val);
  let h='<div class="panel"><h2>My players <span>what the numbers above use, per game</span></h2><div class="mvtbl"><table><thead><tr><th>Player</th><th class="num">Wk G</th><th class="num">GP</th><th class="num">MIN</th><th class="num">FG%</th><th class="num">FT%</th><th class="num">3PM</th><th class="num">PTS</th><th class="num">REB</th><th class="num">AST</th><th class="num">STL</th><th class="num">BLK</th><th class="num">TO</th><th>Based on</th></tr></thead><tbody>';
  mine.forEach(p=>{ const l=p.proj; const g=wk?(wk.me.ug.get(p.id)||0):0; const n=ctx.days.filter(d=>playsOn(p.team,d)).length;
    h+='<tr><td style="white-space:normal"><b>'+esc(p.name)+'</b> <span class="small">'+esc(p.team)+' '+esc(p.slot)+(p.status?', '+esc(statusWord(p.status)):'')+(p.role?', minutes '+p.role:'')+'</span></td><td class="num">'+r1(g)+' of '+n+'</td><td class="num">'+(p.gp||0)+'</td>';
    if(l) h+='<td class="num">'+r1(l.mp)+'</td><td class="num">'+(l.fga>0?(100*l.fgm/l.fga).toFixed(1):'')+'</td><td class="num">'+(l.fta>0?(100*l.ftm/l.fta).toFixed(1):'')+'</td><td class="num">'+r1(l.tpm)+'</td><td class="num">'+r1(l.pts)+'</td><td class="num">'+r1(l.reb)+'</td><td class="num">'+r1(l.ast)+'</td><td class="num">'+r1(l.stl)+'</td><td class="num">'+r1(l.blk)+'</td><td class="num">'+r1(l.to)+'</td>'; else h+='<td colspan="10" class="small">no numbers yet</td>';
    h+='<td>'+basisChip(p)+'</td></tr>'; });
  h+='</tbody></table></div><p class="small">Wk G is how many of his games this week fit in your starting lineup. Each line blends last season with this season. The weight on this season is games played divided by games played plus 12.</p></div>';
  return h;
}
function wire(){
  const root=$('viewMoves');
  root.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{ ST.marks.push({type:'add',add:b.getAttribute('data-add'),drop:b.getAttribute('data-drop')||null}); ST.at=D.scan.at; save(); compute(true); });
  root.querySelectorAll('[data-trade]').forEach(b=>b.onclick=()=>{ const t=TR.list[+b.getAttribute('data-trade')]; if(!t) return; ST.marks.push({type:'trade',withTeam:t.o,give:t.give.map(p=>p.id),get:t.get.map(p=>p.id)}); ST.at=D.scan.at; save(); compute(true); });
  root.querySelectorAll('[data-pitch]').forEach(b=>b.onclick=()=>{ const t=TR.list[+b.getAttribute('data-pitch')]; if(!t) return; const txt=pitchText(CTXW,t); const ok=()=>{ b.textContent='Copied'; setTimeout(()=>{ b.textContent='Copy a message to send'; },1500); }; try{ navigator.clipboard.writeText(txt).then(ok,()=>{ window.prompt&&0; b.textContent=txt; }); }catch(e){ b.textContent=txt; } });
  const u=$('mvundo'); if(u) u.onclick=()=>{ ST.marks=[]; save(); compute(true); };
  const co=$('mvco'); if(co) co.onchange=()=>{ ST.co=co.checked; save(); compute(true); };
}
function compute(redoTrades){
  if(!D.scan || !D.league || !D.sched){ render(); return; }
  if(ST.at && ST.at!==D.scan.at && ST.marks.length){ ST.marks=[]; ST.at=D.scan.at; save(); }
  CTX=build(D.scan); WK=thisWeek(CTX); PK=pickups(CTX); RACE=race(CTX);
  if(redoTrades || !TR){ TR=null; CTXW=build(D.week||D.scan); render(); trades(CTXW,res=>{ TR=res; render(); }); }
  else render();
}
async function load(){
  if(D.loaded || D.loading) return; D.loading=true; render();
  const get=async f=>{ try{ const r=await fetch('data/'+f,{cache:'no-store'}); if(!r.ok) return null; return await r.json(); }catch(e){ return null; } };
  const a=await Promise.all(['league.json','schedule.json','prior.json','players.json','scan.json','scan_week.json'].map(get));
  D.league=a[0]; D.sched=a[1]; D.prior=a[2]; D.players=a[3]; D.scan=a[4]; D.week=a[5]||a[4];
  D.gset={}; if(D.sched) Object.keys(D.sched.games).forEach(t=>D.gset[t]=new Set(D.sched.games[t]));
  D.loading=false; D.loaded=true; compute(true);
}
window.NCWMoves={show:()=>{ document.body.classList.add('moves'); if(!D.loaded) load(); else render(); }, hide:()=>document.body.classList.remove('moves'), state:()=>({D,CTX,CTXW,TR,PK,WK,RACE,ST}), recompute:()=>compute(true), _fn:{build,thisWeek,pickups,trades,race,catProbs,pWin5,totalsOver,lineup,elig,project,valOf,zLine,lineFromZ}};
})();
