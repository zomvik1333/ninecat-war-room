#!/usr/bin/env node
/* Nine Cat War Room, NBA schedule refresh. Run on a computer with open internet access.
   Use: node scan/fetch-sched.js   It rewrites data/schedule.json from the ESPN scoreboard, one request per day of the season. */
const fs=require('fs'), path=require('path');
const MAP={GS:'GSW',NO:'NOP',NY:'NYK',SA:'SAS',UTAH:'UTA',WSH:'WAS'};
const T30=new Set('ATL BOS BKN CHA CHI CLE DAL DEN DET GSW HOU IND LAC LAL MEM MIA MIL MIN NOP NYK OKC ORL PHI PHX POR SAC SAS TOR UTA WAS'.split(' '));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const days=[]; for(let d=new Date(Date.UTC(2026,9,20)); d<=new Date(Date.UTC(2027,3,18)); d=new Date(d.getTime()+864e5)) days.push(d.toISOString().slice(0,10));
  const games={}; let n=0, tbd=0, cup=0; const fail=[];
  async function one(day){
    for(let k=0;k<4;k++){
      try{ const r=await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates='+day.replace(/-/g,''));
        if(r.ok){ const j=await r.json();
          for(const e of (j.events||[])){
            if(!(e.season&&e.season.type===2)) continue;
            // ESPN lists the NBA Cup championship game as regular season, but it does not count in the standings, in NBA stats or in fantasy. Leave it out.
            // The Cup quarterfinals and semifinals DO count as regular season games, so only a note or name with both "cup" and "championship" is skipped.
            const c0=(e.competitions&&e.competitions[0])||{};
            const note=[e.name,e.shortName].concat([].concat(e.notes||[],c0.notes||[]).map(x=>x&&x.headline)).join(' ');
            if(/championship/i.test(note)&&/cup/i.test(note)){ cup++; continue; }
            const cs=c0.competitors||[];
            const ab=cs.map(c=>{const x=(c.team&&c.team.abbreviation||'').toUpperCase(); return MAP[x]||x;});
            if(ab.length!==2 || !ab.every(x=>T30.has(x))){ tbd++; continue; }
            ab.forEach(t=>{ (games[t]||(games[t]=[])).push(day); }); n++;
          }
          return; }
      }catch(e){}
      await sleep(700*(k+1));
    }
    fail.push(day);
  }
  for(let i=0;i<days.length;i+=5){ await Promise.all(days.slice(i,i+5).map(one)); await sleep(250); }
  if(fail.length || Object.keys(games).length!==30 || n<1100){ console.log('schedule NOT saved. games '+n+', teams '+Object.keys(games).length+', failed days '+fail.join(' ')); process.exit(1); }
  Object.keys(games).forEach(t=>{ games[t]=[...new Set(games[t])].sort(); });
  fs.writeFileSync(path.join(__dirname,'..','data','schedule.json'),JSON.stringify({src:'ESPN scoreboard, regular season games listed under each US date',made:new Date().toISOString().slice(0,10),games}));
  console.log('schedule saved, '+n+' games, '+tbd+' games with teams not set yet'+(cup?', '+cup+' NBA Cup championship game left out because it does not count':''));
})();
