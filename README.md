# Nine Cat War Room

Draft board and in season pickups and trades helper for the Ball Lovers Yahoo league (10 teams, head to head 9 cat, 15 rounds, snake).

Live site at https://ninecatwarroom.vercel.app

## Files

* api holds the small Vercel helpers that connect to Yahoo Fantasy. Your Yahoo sign in is kept only in an encrypted cookie in your browser.

* index.html is the full website that runs on Vercel. It also works if you just open it in a browser.
* draft-room.html is the draft board alone in the format used for the Claude artifact. It does not have the Pickups and trades tab.
* moves.js is the Pickups and trades tab.
* data holds the numbers the tab reads. josh_cats.json holds Josh Lloyd's category calls. scan.json is the daily Yahoo scan, scan_week.json is the snapshot the trade list uses, players.json holds Yahoo player names, league.json holds the fantasy schedule, schedule.json holds the NBA schedule and prior.json holds last season's per game numbers.
* scan holds the daily scan. yahoo-scan.js reads Yahoo inside the browser, ingest.js checks the text and writes the data files, fetch-sched.js refreshes the NBA schedule and README.md is the step by step procedure.
* vercel.json lets the scanner read the data files from the live site.

## Version 7 (branch main), Oct 5 2026

* 17 more Josh Lloyd shows were read, so the site now rests on 56. Two are his own fantasy previews, Pistons and Clippers. One is the late round flyers show from Oct 3, the newest view on file. One is a July bounce back show. Thirteen are team shows with a beat reporter
* Board ranks moved. Down are Brandon Ingram 50 to 103, Derik Queen 75 to 102, Kristaps Porzingis 105 to 136, Darius Garland 28 to 36, Myles Turner 107 to 117, John Collins 104 to 111, Paul Reed 136 to 151, Jalen Duren 40 to 44 and Kel'el Ware 73 to 76. Up are Rui Hachimura 160 to 135, Quentin Grimes 161 to 144, Daniel Gafford 141 to 126, Egor Demin 137 to 124, Ausar Thompson 71 to 63 and Khaman Maluach 115 to 108. New are Yves Missi at 138 and Max Strus at 142. Everyone else only shifted a spot or two to keep ranks unique
* Ingram carries a partially torn Achilles flag on the board, out until about Christmas or January, about 41 games
* 25 notes were rewritten without a rank change, most of them to add what a team reporter said and to say that the reporter said it
* The category table went from 176 players to 215, with 109 that change a stat line. Hand checked rows added for Hachimura, Ausar Thompson, Maxey, Trae Young, Strus, Gafford, Isaiah Jackson, Jalen Green and others. Each carries a note in data/josh_cats.json
* A lone reporter call counts 60 percent and the sentence on the card names the reporter
* A what if is not a projection. Minutes that only hold if a player starts, or only for a month, are left out or set to a season number
* When shows disagree the newer one wins. The July bounce back show does not override September or October
* Trade cards have two new tags. Helps lists the cats where your chance to win that cat in an average week rises 1.5 points or more. Costs lists the cats where it falls that much. Biggest move first. A new part in the card, Stats it helps and costs, gives the number for each
* The log line the daily scan writes now carries the helps and costs for each trade
* An independent fact check read every changed rank and every changed category row against the transcripts. 40 rank claims, none wrong, 13 adjusted. 50 category rows, 2 wrong and 27 adjusted. All fixes are in. 132 checks pass
* The scripts and the fact check files are in the fantasy notes folder under app_data/josh_cats

## How to fall back to version 6

* The v12 branch holds the site exactly as it was before version 7.
* `git checkout v12 -- index.html draft-room.html moves.js data/josh_cats.json` then deploy

## Version 6 (branch v12), Oct 4 2026

* Small change later on Oct 4. The box that hid trades with Rohan and Vikas CoManaged Team is gone. It was a guess that Vik helps run that team. He does not, so it is now treated like every other team. Branch v11 holds the site as it was just before this change

* Josh Lloyd's category calls now shape every stat line. They come from all 39 of his shows on file and sit in data/josh_cats.json, 176 players, 85 of them with a change to the line
* His rank still decides how much a player is worth and how many games he is given. The calls decide which cats that value sits in. A call never changes games played
* A normal call moves a counting cat 5 percent when he said it in one show and up to 8 percent when he repeated it in five or more. A strong call counts double. Where he gave real numbers the cat moves 60 percent of the change he quoted, capped at 20 percent
* A short list of hand checked rows goes further because he gave a firm projection. Nembhard, Coby White, Kessler, Sabonis, Daniels, Sarr, Siakam, Jaylen Brown, Nesmith and Beringer. Each carries a note in the file
* FG% moves about 1 point per call and FT% about 1.3 points, both capped, more only on the hand checked rows
* After a call bends the line, the rank may give back at most 5 percent of volume. So a small call only moves value between cats and a big call really changes the player
* A minutes number from Josh does not move the line by itself. It widens how far the rank may move the whole line, toward his number and no further. Vucevic at 21 minutes can now be cut below the old 12 percent limit. A backup with a low rank is not lifted just because Josh gave him minutes
* Minutes calls only apply when the line is a real last season of 20 games or more
* A player who is not on the draft board has no rank to lean on, so a minutes call scales his line directly. Melton and Hunter are the two today
* Once a player has three games in the last two weeks his real minutes beat any call. The minutes up or down tag is judged against his minutes without the call
* A guest reporter's call counts 60 percent of a Josh call and the card says who made it
* The calls only bend last season's numbers. As real games come in they fade with the same weight as before, games played over games played plus 12. The text is hidden once this season carries 75 percent of the line
* The My players table shows each call under the player's name, with the cats Josh rates him for and where he sees him weakest
* Trade and pickup cards have a new part, Josh on the cats
* Board ranks updated from the new shows. Up are Kyrie Irving 36 to 32, Alexander Walker 49 to 43, Porter Jr. 63 to 54, Rollins 67 to 59, Hartenstein 71 to 65, Naz Reid 75 to 69, Queen 84 to 75, Edgecombe 90 to 85, Watson 124 to 108, Grayson Allen 169 to 117, Nesmith 156 to 125, Diabate 158 to 132 and P.J. Washington 168 to 140. Down are Harden 28 to 34, Jalen Johnson 16 to 18, Boozer 51 to 58, Clingan 73 to 83, Harper 89 to 97 and Dybantsa 121 to 149. Gafford is new at 141. Others shift a spot or two to make room
* Eight of those ranks used to rest on one passing remark and counted 40 percent. He has now given a range for each, so they count the usual 70 percent
* draft-room.html carries the same ranks
* The site still works if data/josh_cats.json is missing or badly shaped. It just uses the plain lines
* The table was checked twice by separate reviewers, once against the transcripts and once for code errors. 127 checks pass

## How to fall back to version 5

* The v10 branch holds the site exactly as it was before version 6.

## Version 5 (branch v10), Oct 4 2026

* Trades lean on the seven solid cats. Threes, points, rebounds, assists, steals, blocks and turnovers count in full. FT% counts 65 percent and FG% counts half
* The waiver wire is closer to normal. FT% counts 90 percent and FG% 80 percent
* This week's matchup, the league table and every win chance on screen stay on normal scoring, all nine cats the same
* One cat rule. A trade shows only if it leaves you favored in at least one more cat in an average week, after counting any cat it costs. A cat counts as gained when it moves from under to over 50 percent by at least 5 points. A box shows the smaller trades when you want to look
* Position balance moves a pickup or trade score by 5 to 8 percent. A spot with 3 or fewer eligible players is thin, 6 or more is crowded
* The three center rule now also covers pickup drops
* Trade and pickup cards say which cats are gained or lost and whether the move helps or hurts balance

## How to fall back to version 4

* The v9 branch holds the site exactly as it was before version 5.

## Version 4 (branch v9), Oct 2 2026

* New tab, Pickups and trades. The goal is to win 5 of 9 cats each week and finish in the top four
* A daily Yahoo scan feeds it. The scan only reads. It runs through Claude in Chrome on your computer at 4.30 pm and then deploys the fresh numbers
* This week panel. Your chance to win 5 or more cats against the real opponent, cat by cat, with the live score once the week starts
* Pickups, refreshed daily. Every available player is tested in place of each player you could drop. Each one gets a need score from 0 to 100, the drop, his games left and a plain reason
* Need bands. 85 and up is a must add even at the cost of a waiver claim. 65 to 84 is a strong add once he is a free agent. 50 to 64 helps but hold your waiver spot. Under 50 is a skip
* Trades, refreshed each week and after any roster move in the league. Every one for one, two for two and two for one where you send two is scored. Ranked by your gain times the chance they say yes
* Each trade shows your gain, their gain, how it looks to them on Yahoo ranks and name value, the chance they say yes and the Josh edge
* Guard rails. Kyrie is never offered. Boozer is held until the middle of January. You always keep three centers. Trades with the co managed team were hidden behind a box until Oct 4, when that rule was removed
* Every card opens to a plain reason with what it does, what it costs or the pitch, what the numbers are based on and the main risk
* What the numbers are based on is always stated. Last season before games are played, a blend once games start, this season once the blend passes 75 percent. The weight on this season is games played divided by games played plus 12
* Josh's rank is carried in from the board. A higher or lower rank counts first as more or fewer games played, then as a small change in volume
* The league table rates all ten teams, shows their strong and weak cats and the chance each one finishes top four. Tap a team to see its roster as Yahoo shows it
* My players shows the per game line the numbers use for each of your players and how many of his games fit in your lineup this week
* I made this add and I made this trade move the players right away and rerank both lists. The next Yahoo scan replaces your marks with what Yahoo shows
* The NBA schedule comes from ESPN. Usable games are counted by setting the best legal Yahoo lineup for every day, so a crowded position costs games by itself

## How to fall back to version 3

* The v8 branch holds the site exactly as it was before version 4.

## Version 3 (branch v8), Oct 2 2026

* Opens on the real Ball Lovers draft. All 150 picks from the Yahoo draft results are on the right team, with team names, and the Oct 1 swap of LaMelo Ball and Walker Kessler is applied
* Load league draft brings that board back at any time. Reset draft gives a clean board for a mock
* The five drafted players who were missing are on the board now (Collin Gillespie, Paul Reed, Quentin Grimes, Wendell Carter Jr. and Ben Simmons)
* A player who is not on the board can be added by typing his first and last name and pressing Enter, so a pick is never skipped
* Every pick keeps its own pick number. Undo on any row takes out only that pick, and the next player you mark fills the open spot
* Marking a pick never changes your draft slot
* Search ignores accents, dots, apostrophes and dashes
* The board stops at 150 picks
* The Yahoo button tells the truth when Yahoo refuses the sync
* Josh Lloyd rankings rebuilt from the 20 show transcripts for 2026 to 27. 168 players have a Josh spot. His top 25 is his own list and the rest are read from his tier shows, the numbers he states and his category mock picks
* Each player sits 70 percent of the way from the stats spot to Josh's spot. A spot that rests on one passing remark counts 40 percent
* Positions for drafted players match what Yahoo shows for this league
* Saved boards are stored under a new key, so the board from draft night is left alone in the browser

## How to fall back to version 2

* The v7 branch holds the site exactly as it was before version 3.

## Version 2 (branch v7)

* Every pick is credited to the team whose turn it was, so all 10 rosters build themselves
* Teams tab with each roster, open starting spots and cat strengths
* Before your turn panel with what each team ahead of you needs and who they will likely take
* Survive numbers and plan projections now account for what the teams ahead of you need
* Optional Yahoo sync on the Vercel site that marks every pick from the Yahoo draft room by itself

### Yahoo setup, one time

1. Create an app at developer.yahoo.com/apps/create with redirect URI https://ninecatwarroom.vercel.app/api/callback and Fantasy Sports Read permission.
2. In Vercel, Project ninecatwarroom, Settings, Environment Variables, add YAHOO_CLIENT_ID and YAHOO_CLIENT_SECRET, then redeploy.
3. Open the site and tap Connect Yahoo.

## Version 1 (branch v1)

* Stats from the 2025 26 season, injury news as of Sept 29, 2026
* Rankings leaned toward Josh Lloyd's 9 cat top 25 and round by round comments
* Playoff schedule flags for weeks 19 to 21, punt guard, late round upside mode
* Compact board that fits without sideways scrolling

## How to fall back to version 1

1. On GitHub, switch to the v1 branch and download index.html. The v1 branch is never changed, so it always holds this version.
2. Put it in the Vercel project folder and run `vercel deploy --prod`.
3. Or, in the Vercel dashboard, open Deployments, find the deployment from Sept 29, 2026 and use Instant Rollback.
