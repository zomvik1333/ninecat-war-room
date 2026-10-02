/* Nine Cat War Room, Yahoo league scanner.
   Read only. It runs inside a signed in Yahoo fantasy basketball page and only fetches pages you can already see.
   It never clicks, adds, drops, trades or sets a lineup.
   Use: load this file in the page, then call NCWSCAN.run() for the daily scan or NCWSCAN.run({mode:'sched'}) once for the league schedule.
   Progress is in window.__ncw. When __ncw.done is true call NCWSCAN.show(0), NCWSCAN.show(1) ... and read the page text. */
(function(){
  const LID='82878', ME='11', BASE='/nba/'+LID; let SEASON='2026';
  const SITE='https://ninecatwarroom.vercel.app';
  const st={log:[],lines:[],pages:[],done:false,err:'',step:'',mode:''};
  window.__ncw=st;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  async function get(u){
    for(let k=0;k<3;k++){
      try{ const r=await fetch(u,{credentials:'include'}); if(r.ok){ const t=await r.text(); return new DOMParser().parseFromString(t,'text/html'); } }catch(e){}
      await sleep(900*(k+1));
    }
    throw new Error('fetch failed '+u.slice(0,60));
  }
  const clean=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\u2018\u2019\u02bc]/g,"'").replace(/[^\x20-\x7e]/g,' ').replace(/[|~=;?&]/g,' ').replace(/\s+/g,' ').trim();
  const ck=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return ('000'+((h>>>0)%1679616).toString(36)).slice(-4)};
  const num=s=>{const v=parseFloat(String(s).replace(/[^0-9.\-]/g,''));return isFinite(v)?v:null};
  const x10=s=>{const v=num(s);return v==null?'':String(Math.round(v*10))};
  const mins=s=>{s=String(s||'').trim();const m=s.match(/^(\d+):(\d+)$/);return m?String(Math.round((+m[1]+m[2]/60)*10)):x10(s)};
  const pair=s=>{const m=String(s||'').match(/([\d.]+)\s*\/\s*([\d.]+)/);return m?[x10(m[1]),x10(m[2])]:['','']};
  const digits=s=>String(s||'').replace(/\D/g,'');

  function grid(doc, sel){
    const one=sel?doc.querySelector(sel):null;
    const tables=one?[one]:[...doc.querySelectorAll('table')];
    for(const t of tables){
      const hr=[...t.querySelectorAll('thead tr')].find(r=>/Player/.test(r.textContent)&&/PTS/.test(r.textContent));
      if(!hr) continue;
      const H={}; let i=0;
      [...hr.cells].forEach(c=>{ const k=c.textContent.replace(/\*/g,'').replace(/\s+/g,' ').trim(); const key=/^Opp/.test(k)?'Opp':k; if(key && !(key in H)) H[key]=i; i+=c.colSpan||1; });
      return {H,rows:[...t.tBodies].flatMap(b=>[...b.rows])};
    }
    return null;
  }
  function pcell(td){
    if(!td) return null;
    const a=td.querySelector('a.name')||td.querySelector('a[href*="/nba/players/"]');
    if(!a) return null;
    const holder=td.querySelector('[data-ys-playerid]');
    const id=(holder&&holder.getAttribute('data-ys-playerid'))||((a.getAttribute('href')||'').match(/players\/(\d+)/)||[])[1];
    if(!id) return null;
    const tp=[...td.querySelectorAll('span')].map(x=>clean(x.textContent)).find(x=>/^[A-Za-z]{2,4} - [A-Z,]+$/.test(x))||'';
    const m=tp.match(/^([A-Za-z]{2,4}) - ([A-Z,]+)$/);
    const s=td.querySelector('.ysf-player-status');
    return {id, nm:clean(a.getAttribute('title')||a.textContent), team:m?m[1].toUpperCase():'', pos:m?m[2]:'', status:clean(s?s.textContent:'')};
  }
  function statsOf(cells,H){
    const g=k=>{const i=H[k];return (i==null||!cells[i])?'':cells[i].textContent.trim()};
    const fg=pair(g('FGM/A')), ft=pair(g('FTM/A'));
    return {gp:digits(g('GP')), mpg:mins(g('MPG')), fgm:fg[0], fga:fg[1], ftm:ft[0], fta:ft[1], tpm:x10(g('3PTM')), pts:x10(g('PTS')), reb:x10(g('REB')), ast:x10(g('AST')), stl:x10(g('ST')), blk:x10(g('BLK')), to:x10(g('TO')),
      pre:digits(g('Pre-Season')), cur:digits(g('Current')), pct:digits(g('% Start')||g('% Ros')), own:clean(g('Roster Status')), slot:clean(g('Pos'))};
  }
  // nine cat value of a per game line, used only to flag who is running hot or cold over 14 days
  function val(s){
    const f=k=>s[k]===''?null:+s[k]/10;
    const pts=f('pts'); if(pts==null) return '';
    const fga=f('fga'), fta=f('fta');
    const fgp=fga>0?f('fgm')/fga*100:48.5, ftp=fta>0?f('ftm')/fta*100:80.5;
    const z=[0.010226*(fgp-48.5)*pts+0.008824*(fgp-48.5)-0.12296, 0.0075475*(ftp-80.5)*pts-0.0061865*(ftp-80.5)+0.02054,
      1.004*(f('tpm')||0)-1.689, 0.169*pts-2.850, 0.440*(f('reb')||0)-2.621, 0.495*(f('ast')||0)-1.872, 2.823*(f('stl')||0)-3.004, 2.065*(f('blk')||0)-1.446, -1.274*(f('to')||0)+2.406];
    return String(Math.round(z.reduce((a,b)=>a+b,0)*10));
  }
  const sline=s=>[s.gp,s.mpg,s.fgm,s.fga,s.ftm,s.fta,s.tpm,s.pts,s.reb,s.ast,s.stl,s.blk,s.to].join('|');

  async function runSched(){
    const out=[];
    for(let n=1;n<=21;n++){
      st.step='week '+n;
      let pairs='';
      try{ const d=await get(BASE+'?matchup_week='+n+'&module=matchups&lhst=matchups');
        pairs=[...new Set([...d.querySelectorAll('a[href*="/matchup?week="]')].map(a=>{const m=(a.getAttribute('href')||'').match(/week=(\d+)&mid1=(\d+)&mid2=(\d+)/);return m&&+m[1]===n?m[2]+'v'+m[3]:''}).filter(Boolean))].join(',');
      }catch(e){ st.log.push('no pairs week '+n); }
      let first='', last='';
      try{ const d=await get(BASE+'/matchup?week='+n+'&mid1='+ME);
        const days=[...d.body.textContent.matchAll(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (\d{1,2})\/(\d{1,2})/g)].map(m=>m[1]+'/'+m[2]);
        const uniq=[...new Set(days)]; first=uniq[0]||''; last=uniq[uniq.length-1]||'';
        out.push('K|'+n+'|'+first+'|'+last+'|'+uniq.length+'|'+pairs);
      }catch(e){ out.push('K|'+n+'|||0|'+pairs); }
      await sleep(250);
    }
    return out;
  }

  async function runDaily(opts){
    if(opts.season) SEASON=String(opts.season);
    const out=[]; const P={}, S={}, L={}, OWN={}, PCT={}, CUR={};
    let known={};
    try{ const r=await fetch(SITE+'/data/players.json',{cache:'no-store'}); if(r.ok){ const j=await r.json(); known=j.p||{}; } }catch(e){ st.log.push('known players file not loaded'); }
    if(opts.all) known={};
    const see=(pc,pre)=>{ if(!pc) return; const o=P[pc.id]||(P[pc.id]={}); o.nm=pc.nm||o.nm; o.team=pc.team||o.team; o.pos=pc.pos||o.pos; if(pre) o.pre=pre; };

    st.step='home';
    const home=await get(BASE);
    const teams=[];
    const stt=home.querySelector('#standingstable');
    if(stt){
      const hc=[...stt.querySelectorAll('thead th')].map(c=>c.textContent.replace(/\s+/g,' ').trim());
      const ix=k=>hc.findIndex(h=>h.indexOf(k)===0);
      [...stt.tBodies[0].rows].forEach((r,ri)=>{
        const a=r.querySelector('a[href*="'+BASE+'/"]'); if(!a) return;
        const tid=((a.getAttribute('href')||'').match(/\/(\d+)$/)||[])[1]; if(!tid) return;
        const c=[...r.cells].map(x=>x.textContent.replace(/\s+/g,' ').trim());
        const wlt=(c[ix('W-L-T')]||'').split('-');
        teams.push({tid,nm:clean(c[ix('Team')]),rank:digits(c[ix('Rank')])||String(ri+1),w:digits(wlt[0])||'0',l:digits(wlt[1])||'0',t:digits(wlt[2])||'0',wv:digits(c[ix('Waiver')]),mv:digits(c[ix('Moves')])||'0'});
      });
    }
    if(teams.length<10) st.log.push('standings rows '+teams.length);
    const wk=(([...home.querySelectorAll('a[href*="/matchup?week="]')].map(a=>(a.getAttribute('href')||'').match(/week=(\d+)/)).filter(Boolean)[0])||[])[1]||'';
    teams.forEach(t=>out.push(['T',t.tid,t.nm,t.rank,t.w,t.l,t.t,t.wv,t.mv].join('|')));

    let season=false;
    const order=teams.map(t=>t.tid); if(order.indexOf(ME)>0){ order.splice(order.indexOf(ME),1); order.unshift(ME); }
    for(const tid of order){
      st.step='team '+tid;
      const d=await get(BASE+'/'+tid+'?stat1=AS&stat2=AS_'+SEASON);
      const g=grid(d,'#statTable0')||grid(d);
      if(!g){ st.log.push('no roster table team '+tid); continue; }
      const ros=[];
      g.rows.forEach(r=>{ const pc=pcell(r.cells[g.H['Players']]||r.cells[2]); if(!pc) return; const s=statsOf(r.cells,g.H); see(pc,s.pre); ros.push(pc.id+':'+s.slot+':'+pc.status); if(+s.gp>0){ season=true; S[pc.id]=s; } CUR[pc.id]=s.cur; PCT[pc.id]=s.pct; });
      out.push('R|'+tid+'|'+ros.length+'|'+ros.join(','));
      if(season){
        const d2=await get(BASE+'/'+tid+'?stat1=AS&stat2=AL14'); const g2=grid(d2,'#statTable0')||grid(d2);
        if(g2) g2.rows.forEach(r=>{ const pc=pcell(r.cells[g2.H['Players']]||r.cells[2]); if(!pc) return; const s=statsOf(r.cells,g2.H); if(+s.gp>0) L[pc.id]=s; });
      }
      await sleep(250);
    }

    const list=async(stat,sort,pages,into)=>{
      for(let k=0;k<pages;k++){
        st.step='players '+stat+' '+sort+' '+k;
        const d=await get(BASE+'/players?status=A&pos=P&cut_type=33&stat1='+stat+'&myteam=0&sort='+sort+'&sdir=1&count='+(k*25));
        const g=grid(d); if(!g){ st.log.push('no players table '+stat+' '+sort+' '+k); break; }
        let n=0;
        g.rows.forEach(r=>{ const pc=pcell(r.cells[g.H['Players']]||r.cells[2]); if(!pc) return; n++; const s=statsOf(r.cells,g.H); see(pc,s.pre);
          const w=s.own.match(/^W \((\w+) (\d+)\)/); OWN[pc.id]=w?('W'+w[1]+w[2]):(/^FA/.test(s.own)?'F':(s.own||'F'));
          if(s.pct!=='') PCT[pc.id]=s.pct; if(pc.status) P[pc.id].st=pc.status; else if(!('st' in P[pc.id])) P[pc.id].st='';
          if(into==='S'){ CUR[pc.id]=s.cur; if(+s.gp>0) S[pc.id]=s; } else if(into==='L'){ if(+s.gp>0) L[pc.id]=s; } });
        if(n<25) break; await sleep(250);
      }
    };
    if(season){
      await list('S_AS_'+SEASON,'AR',opts.deep?6:4,'S');
      await list('S_AL14','AR',opts.deep?8:6,'L');
      await list('S_AS_'+SEASON,'R_PO',2,'S');
    } else {
      await list('S_AS_'+SEASON,'OR',4,'S');
      await list('S_AS_'+SEASON,'R_PO',2,'S');
    }
    const avail=Object.keys(OWN);
    for(let i=0;i<avail.length;i+=16) out.push('A|'+avail.slice(i,i+16).map(id=>id+':'+OWN[id]+':'+(P[id].st||'')).join(','));

    const qs=[];
    Object.keys(P).forEach(id=>{
      const s=S[id], l=L[id];
      if(s||l){ const b=s||l; out.push('S|'+id+'|'+(s?'s':'r')+'|'+sline(b)+'|'+(l?l.gp:'')+'|'+(l?l.mpg:'')+'|'+(l?val(l):'')+'|'+(CUR[id]||'')+'|'+(PCT[id]||'')); }
      else if(CUR[id]||PCT[id]) qs.push(id+':'+(CUR[id]||'')+':'+(PCT[id]||''));
    });
    for(let i=0;i<qs.length;i+=14) out.push('Q|'+qs.slice(i,i+14).join(','));

    if(wk){
      st.step='matchup';
      try{ const d=await get(BASE+'/matchup?week='+wk+'&mid1='+ME);
        const t=[...d.querySelectorAll('table')].find(x=>x.rows.length&&/FGM\/A/.test(x.rows[0].textContent)&&/Team/.test(x.rows[0].textContent));
        if(t){ const hc=[...t.rows[0].cells].map(c=>c.textContent.replace(/\*/g,'').trim());
          [...t.rows].slice(1,3).forEach(r=>{ const c=[...r.cells].map(x=>x.textContent.trim()); const g=k=>c[hc.indexOf(k)]||''; const fg=g('FGM/A').split('/'), ft=g('FTM/A').split('/');
            const tm=teams.find(x=>x.nm===clean(c[0])); out.push(['M',wk,tm?tm.tid:clean(c[0]),digits(fg[0]),digits(fg[1]),digits(ft[0]),digits(ft[1]),digits(g('3PTM')),digits(g('PTS')),digits(g('REB')),digits(g('AST')),digits(g('ST')),digits(g('BLK')),digits(g('TO'))].join('|')); }); }
        const rem=[...d.body.textContent.replace(/\s+/g,' ').matchAll(/(\d+) Remaining/g)].map(m=>m[1]).slice(0,2); if(rem.length) out.push('G|'+rem.join('|'));
      }catch(e){ st.log.push('matchup not read'); }
    }

    st.step='transactions';
    try{ const d=await get(BASE+'/transactions');
      const t=d.querySelector('table[class*="transaction"]')||d.querySelector('table');
      let n=0;
      if(t) [...t.rows].forEach(r=>{ if(n>=30) return;
        const moves=[]; const icons=[...r.querySelectorAll('span[title]')].map(x=>x.getAttribute('title'));
        [...r.querySelectorAll('a[href*="/nba/players/"]')].forEach(a=>{ const m=(a.getAttribute('href')||'').match(/players\/(\d+)$/); if(!m) return; const h=a.parentElement&&a.parentElement.querySelector('h6'); const txt=clean(h?h.textContent:'');
          const sign=/Add/i.test(txt)?'+':/Drop/i.test(txt)?'-':/Trade/i.test(txt)?'t':(/Add/i.test(icons[moves.length]||'')?'+':/Drop/i.test(icons[moves.length]||'')?'-':'t');
          moves.push(sign+m[1]); if(!P[m[1]]&&!known[m[1]]){ const sp=a.parentElement&&a.parentElement.querySelector('span'); const mm=clean(sp?sp.textContent:'').match(/^([A-Za-z]{2,4}) - ([A-Z,]+)$/); P[m[1]]={nm:clean(a.textContent),team:mm?mm[1].toUpperCase():'',pos:mm?mm[2]:''}; } });
        if(!moves.length) return;
        const ta=r.querySelector('a[href*="'+BASE+'/"]'); const tid=ta?((ta.getAttribute('href')||'').match(/\/(\d+)$/)||[])[1]||'':'';
        const when=(r.textContent.replace(/\s+/g,' ').match(/([A-Z][a-z]{2}) (\d{1,2}), (\d{1,2}):(\d{2}) ([ap]m)/)||[]);
        out.push('X|'+(when[1]||'')+(when[2]||'')+'|'+tid+'|'+moves.join(',')); n++; });
    }catch(e){ st.log.push('transactions not read'); }

    const plines=[];
    if(!opts.noP) Object.keys(P).forEach(id=>{ const p=P[id], k=known[id]; if(!k || k[1]!==p.team || k[2]!==p.pos || (p.pre && String(k[3]||'')!==String(p.pre))) plines.push(['P',id,p.nm,p.team,p.pos,p.pre||''].join('|')); });
    const head=['H','NCW1',new Date().toISOString().slice(0,16),wk,season?'season':'pre',teams.length,Object.keys(P).length].join('|');
    return [head].concat(plines,out);
  }

  function finish(body){
    const lines=body.map(x=>x+'|'+ck(x));
    lines.push('E|'+lines.length+'|'+ck(lines.join('')));
    st.lines=lines;
    const pages=[]; let cur=[], size=0; const LIM=(st.limit||9000);
    lines.forEach(l=>{ if(size+l.length>LIM && cur.length){ pages.push(cur); cur=[]; size=0; } cur.push(l); size+=l.length+3; });
    if(cur.length) pages.push(cur);
    st.pages=pages;
  }
  function show(k){
    const pg=st.pages[k]; if(!pg) return 'no page '+k;
    document.title='NCW scan page '+(k+1)+' of '+st.pages.length;
    document.body.innerHTML='<article><h1>NCW scan page '+(k+1)+' of '+st.pages.length+'</h1><pre id="ncwout" style="white-space:pre-wrap;font:12px monospace"></pre></article>';
    document.getElementById('ncwout').textContent=pg.join(' ~\n')+' ~';
    return 'page '+(k+1)+' of '+st.pages.length+', '+pg.length+' lines';
  }
  async function run(opts){
    opts=opts||{}; st.done=false; st.err=''; st.log=[]; st.lines=[]; st.pages=[]; st.mode=opts.mode||'daily'; st.limit=opts.limit||9000;
    try{ const body=st.mode==='sched'?await runSched():await runDaily(opts); finish(body); st.step='done'; }
    catch(e){ st.err=String(e&&e.message||e); }
    st.done=true; return st.pages.length;
  }
  window.NCWSCAN={run,show,status:()=>({done:st.done,err:st.err,step:st.step,lines:st.lines.length,pages:st.pages.length,log:st.log.join(', ')})};
})();
