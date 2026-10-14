#!/usr/bin/env node
/* Nine Cat War Room, deploy guard. Run it right before every data deploy. It makes no network call and changes nothing.
   It refuses the deploy when any file outside the data folder is changed, added or deleted, or when main is ahead of origin/main.
   A daily scan only ever changes files inside data, so anything else means code would go live without a yes.
   Use. node scan/check-deploy.js   Prints deploy ok and exits 0, or deploy NOT ok with the reason and exits 1 */
const cp=require('child_process'), path=require('path');
const ROOT=path.join(__dirname,'..');
const run=a=>cp.execFileSync('git',a,{cwd:ROOT,encoding:'utf8'});
let st; try{ st=run(['status','--porcelain=v1','--branch','--untracked-files=all']); }catch(e){ console.log('deploy NOT ok. git status could not run here.'); process.exit(1); }
const lines=st.split('\n').filter(Boolean), head=lines[0]||'', bad=[];
if(!/^## main(\.\.\.origin\/main)?/.test(head)) bad.push('the folder is not on main ('+head.slice(3)+')');
if(/ahead \d+/.test(head)) bad.push('main is ahead of origin/main, so a commit is not pushed yet');
lines.slice(1).forEach(l=>{ const f=l.slice(3).replace(/^"|"$/g,'').split(' -> ').pop(); if(!/^data\/[^/]+\.json$/.test(f)) bad.push('changed outside data, '+l.trim()); });
if(bad.length){ console.log('deploy NOT ok. '+bad.join('. ')+'. Do not deploy. Say the scan is saved but not live and why.'); process.exit(1); }
console.log('deploy ok, only data files differ from main');
