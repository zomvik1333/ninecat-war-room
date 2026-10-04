# Daily Yahoo scan for Nine Cat War Room

This is the procedure for the daily scan. It is written so a fresh Claude session can follow it with no other context.

## What the scan does
* Reads the Ball Lovers league pages on Yahoo through Claude in Chrome on Vik's computer
* Saves the result as data files in the project folder on that computer
* Deploys the project to Vercel so the Pickups and trades tab shows fresh numbers
* It only reads Yahoo. It never adds, drops, trades or sets a lineup

## Hard rules
* Read only on Yahoo. Never click add, drop, trade, claim or any lineup control
* Never ask for or handle passwords or secrets. The file named .env.local in the project folder is off limits
* Do not change code. The only files this job may change are inside the data folder, plus the raw scan text
* If something is broken, stop and say so in plain words. Do not improvise around it
* Replies to Vik use plain English, bullet points, no dashes and no colons, bold only for section titles

## Places
* Yahoo league page, https://basketball.fantasysports.yahoo.com/nba/82878/11
* Project folder on the computer, C:\Users\vikas\Projects\ninecat-war-room
* Raw scan text goes in C:\Users\vikas\Claude\Personal\Fantasy Basketball 2026_27\app_data\scan_raw
* Live site, https://ninecatwarroom.vercel.app
* In the computer's Linux shell the two folders are $HOME/mnt/ninecat-war-room and "$HOME/mnt/Fantasy Basketball 2026_27"

## Steps
1. Check the tools. You need the Claude in Chrome tools and the linked computer tools. If either is missing, report that the scan could not run and stop
2. Open a new Chrome tab and go to the Yahoo league page. If Yahoo shows a sign in page, report that Yahoo is signed out and stop
3. Load and start the scanner with one JavaScript call in that tab
   ```
   const t=await (await fetch('https://ninecatwarroom.vercel.app/scan/yahoo-scan.js',{cache:'no-store'})).text(); (0,eval)(t); window.__p=NCWSCAN.run({limit:12000}); 'started'
   ```
4. Every 15 seconds or so run `JSON.stringify(NCWSCAN.status())` until done is true. It takes about one minute. If err is not empty, start it once more. If it fails twice, report the error text and stop
5. For each page k from 0 to pages minus 1, run `NCWSCAN.show(k)` and then read the page text. Copy every line exactly, from the first line after the heading through the last line, into a file named page1.txt, page2.txt and so on in the raw scan folder. Each line ends with a space and a tilde. Do not fix, reorder or tidy anything
6. Run the ingest in the project folder
   ```
   node scan/ingest.js <page files in order>
   ```
   * It prints scan saved when every line checks out
   * If it prints CHECK FAILED it names the bad lines. Show that page again, read those lines again, fix the file and run it again. Try at most three times, then report and stop. Nothing is written when a check fails
   * If it warns about player ids with no name, run the scan once more with `NCWSCAN.run({all:true,limit:12000})` and ingest again
7. On Mondays also refresh the NBA schedule with `node scan/fetch-sched.js` in the project folder. If it says the schedule was not saved, leave the old file and mention it
8. Deploy from the project folder on Windows
   ```
   cmd /c "cd /d C:\Users\vikas\Projects\ninecat-war-room && vercel deploy --prod --yes"
   ```
   * If it prints Not authorized or any other error, run the same command one more time. On Oct 4 the first try failed that way and the second worked
9. Check the live site. In the Chrome tab run
   ```
   (await (await fetch('https://ninecatwarroom.vercel.app/data/scan.json',{cache:'no-store'})).json()).at
   ```
   It must match the time in the scan saved line
10. Go to https://ninecatwarroom.vercel.app/#moves in the same tab, wait about ten seconds, and run `NCWMoves.summary()`. If it says not ready, wait and try again
11. Close the tab you opened
12. Report to Vik in a few short bullets
    * That the scan ran and what time Yahoo was read
    * Week win chance and cats led
    * Any pickup with a need score of 85 or more, with who to drop
    * Any trade the summary lists. It only lists trades that add a full cat, so most days it will say no trade adds a full cat, and that is fine to report as is
    * Any roster change in the league since yesterday, from the X lines of the scan
    * Anything that failed
    * Remind him the numbers are model estimates and that he makes every move himself

## The scan text format, for reference
* H is the header, T a team, R a roster, A available players, Q ranks and percent rostered, S a player's stats this season, M the live matchup score, G games remaining, X a transaction, P a player name, K a week of the league schedule, E the end line
* The last field of every line is a checksum. The E line holds the line count and a checksum of the whole scan

## One time and occasional jobs
* League schedule. Run the scanner with `NCWSCAN.run({mode:'sched'})` and ingest it the same way. It rewrites data/league.json
* If code changes are pulled from GitHub and git complains about the data files, run `git checkout -- data` first, pull, then run the daily scan again
