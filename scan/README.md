# Daily Yahoo scan for Nine Cat War Room

This is the procedure for the daily scan. It is written so a fresh Claude session can follow it with no other context.

## What the scan does
* Reads the Ball Lovers league pages on Yahoo through Claude in Chrome on Vik's computer
* Saves the result as data files in the project folder on that computer
* Refreshes the injury news file from ESPN every day, and the player ages file on Mondays
* Deploys the project to Vercel so the Pickups and trades tab shows fresh numbers
* It only reads Yahoo. It never adds, drops, trades or sets a lineup

## Hard rules
* Read only on Yahoo. Never click add, drop, trade, claim or any lineup control
* Never ask for or handle passwords or secrets. The file named .env.local in the project folder is off limits
* Do not change code. The only files this job may change are inside the data folder, plus the raw scan text, the news raw file and the news tags file in the notes folder
* Never copy ESPN's or RotoWire's sentences into any file in the project folder. The whole project is public
* If something is broken, stop and say so in plain words. Do not improvise around it
* Replies to Vik use plain English, bullet points, no dashes and no colons, bold only for section titles

## Places
* Yahoo league page, https://basketball.fantasysports.yahoo.com/nba/82878/11
* Project folder on the computer, C:\Users\vikas\Projects\ninecat-war-room
* Raw scan text goes in C:\Users\vikas\Claude\Personal\Fantasy Basketball 2026_27\app_data\scan_raw
* The notes folder is C:\Users\vikas\Claude\Personal\Fantasy Basketball 2026_27. The news raw file and the news tags file are news_raw.json and news_tags.json in its app_data folder
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
   * A line that starts with WARNING does not stop the save. Read it and pass it on in the report
   * If it says the scan on file is newer, the page files are from an older scan. Only to recover on purpose, run `node scan/ingest.js --force <page files in order>`. That skips this one check and no other
7. Refresh the injury news in the project folder. The command is
   ```
   node scan/fetch-news.js --raw "$HOME/mnt/Fantasy Basketball 2026_27/app_data/news_raw.json" --tags "$HOME/mnt/Fantasy Basketball 2026_27/app_data/news_tags.json"
   ```
   * Run it once first so that news_raw.json holds today's news. The raw file is the only place ESPN's own words are kept, and it stays in the notes folder
   * If news_tags.json is not there yet, the script says so with a WARNING line and carries on. That is fine on the first day
   * Read news_raw.json. Look up the players on Vikas's roster, the players in the trades the live site lists right now and the top free agents
   * Also read the latest player news page at https://www.rotowire.com/basketball/news.php with the web fetch tool, for news that is not an injury, such as a new starting job or a cut in minutes. Only the players on his roster, in the listed trades and on the pickup list matter
   * For each of those players with news that matters, write a one line tag in your own words into news_tags.json. Never copy ESPN's or RotoWire's sentences, not even part of one
   * A note may not repeat 5 words in a row from an ESPN comment. The script refuses a new tag that does and drops an old one
   * A tag looks like this. The key is the Yahoo player id from data/players.json, and the same id is in news_raw.json
     ```
     {"<player id>":{"dir":"bad","note":"<one line in your own words>","at":"2026-10-06","src":"ESPN"}}
     ```
   * dir is good, bad or neutral for the player's fantasy value. note is one line of 200 characters or less with no dash characters. at is the day the news came out. src is a short name for where the news came from, such as ESPN or RotoWire
   * news_tags.json is the full list of tags. Keep the tags from earlier days in it. The script leaves out any tag older than 10 days by itself
   * Then run the command again. It prints news saved when every check passes
   * If it prints news NOT saved it gives the reason and nothing is written. For a bad tag it names the player id. Fix news_tags.json and run it again, at most three times
   * A line that starts with WARNING does not stop the save. Read it and pass it on in the report
   * If the news step still fails, the scan goes on. Leave the old news file as it is, carry on with the next step and say in the report that the news was not refreshed
8. On Mondays also refresh the NBA schedule with `node scan/fetch-sched.js` in the project folder. If it says the schedule was not saved, leave the old file and mention it
   * On Mondays also run `node scan/fetch-ages.js` in the project folder. It prints ages saved when it worked. If it prints ages NOT saved, leave the old file and mention it
9. Deploy from the project folder on Windows
   ```
   cmd /c "cd /d C:\Users\vikas\Projects\ninecat-war-room && vercel deploy --prod --yes"
   ```
   * If it prints Not authorized or any other error, run the same command one more time. On Oct 4 the first try failed that way and the second worked
10. Check the live site. In the Chrome tab run
   ```
   (await (await fetch('https://ninecatwarroom.vercel.app/data/scan.json',{cache:'no-store'})).json()).at
   ```
   It must match the time in the scan saved line
11. Go to https://ninecatwarroom.vercel.app/#moves in the same tab, wait about ten seconds, and run `NCWMoves.summary()`. If it says not ready, wait and try again
12. Close the tab you opened
13. Report to Vik in a few short bullets
    * That the scan ran and what time Yahoo was read
    * Week win chance and cats led or favored
    * The season plan line from the summary. Plan cats on target, any lock at risk and the leading route
    * Any pickup with a need score of 85 or more, with who to drop
    * The top trade that stays on plan, with how hard the sell is. Any pivot the summary lists. Most days it will say no pivot beats the plan, and that is fine to report as is
    * One news line. Any news on his players, or that there is none
    * Any roster change in the league since yesterday, from the X lines of the scan
    * Anything that failed
    * Remind him the numbers are model estimates and that he makes every move himself

## The season plan file
* data/plan.json holds the season plan for every device. It is a list of nine roles in the order FG%, FT%, 3PM, PTS, REB, AST, STL, BLK, TO. The roles are lock, build, bonus, low, punt and swing
* The scan never changes this file by itself. Change it only when Vikas says in chat that a pivot is now his plan, then deploy
* A plan he picks on the site with Make this my plan is saved on that device only, until he asks for it to be saved here

## News and ages files
* The scan may write data/news.json and data/ages.json, the same as the other files in the data folder
* Both scripts need Node 18 or later
* data/news.json comes from the ESPN injuries feed. It holds facts only. Those are the status, the body part, the return date, the date of the news and the hand written tags
* data/ages.json comes from the ESPN team rosters. It holds each player's age, birth date and years in the NBA
* News never changes a number on the site by itself. The one exception is a player ESPN lists as Out with a return date in the future. He is counted as out until that date
* ESPN's written comments never go into the data folder. They go only into news_raw.json in the notes folder. The script refuses to run if the raw file path is inside the project folder
* When `--tags` is left off, the script keeps the tags that are still fresh in the old data/news.json, so a plain rerun never loses them

## The scan text format, for reference
* H is the header, T a team, R a roster, A available players, Q ranks and percent rostered, S a player's stats this season, M the live matchup score, G games remaining, X a transaction, P a player name, K a week of the league schedule, E the end line
* The last field of every line is a checksum. The E line holds the line count and a checksum of the whole scan

## One time and occasional jobs
* League schedule. Run the scanner with `NCWSCAN.run({mode:'sched'})` and ingest it the same way. It rewrites data/league.json
* If code changes are pulled from GitHub and git complains about the data files, run `git checkout -- data` first, pull, then run the daily scan again. Copy data/plan.json somewhere safe first if it was changed and not yet pushed, because that command puts it back to the pushed version
