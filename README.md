# Nine Cat War Room

Draft board and in season pickups and trades helper for the Ball Lovers Yahoo league (10 teams, head to head 9 cat, 15 rounds, snake).

Live site at https://ninecatwarroom.vercel.app

## Files

* api holds the small Vercel helpers that connect to Yahoo Fantasy. Your Yahoo sign in is kept only in an encrypted cookie in your browser.

* index.html is the full website that runs on Vercel. It also works if you just open it in a browser.
* draft-room.html is the draft board alone in the format used for the Claude artifact. It does not have the Pickups and trades tab.
* moves.js is the Pickups and trades tab.
* josh-teams.html is the Josh by team page, a plain page with no data files behind it.
* data holds the numbers the tab reads. josh_cats.json holds Josh Lloyd's category calls. scan.json is the daily Yahoo scan, scan_week.json is the snapshot the trade list uses, players.json holds Yahoo player names, league.json holds the fantasy schedule, schedule.json holds the NBA schedule and prior.json holds last season's per game numbers.
* scan holds the daily scan. yahoo-scan.js reads Yahoo inside the browser, ingest.js checks the text and writes the data files, fetch-sched.js refreshes the NBA schedule and README.md is the step by step procedure.
* vercel.json lets the scanner read the data files from the live site.

## Version 12 (branch main), Oct 6 2026

Fixes for the bugs found in the independent audit of Oct 5. The full list with evidence is in audit_report_2026_10_05.md in the fantasy notes folder.

* Trades. Every offer that passes the market value check is now scored in full, with both teams' daily lineups set again. The old quick first pass is gone. It was off by more than its own cut lines and dropped most good trades before the full maths saw them
* Trades. The scoring pauses every 40 thousandths of a second so a slow phone still answers taps while it runs, and the smaller trades box only filters what is already scored. The full scoring takes longer than the old shortcut, about 4 seconds on a normal phone
* Trades. A two for one is credited only for what it adds beyond simply dropping your least useful player for a streamer, whoever the two outgoing players are. Without this the full scoring would fill the list with inflated two for ones
* Lineups. Players are seated best first by per game value, so a questionable star keeps his spot and is credited for the share of the time he is fit. When a starter sits, the best bench player who plays that day steps in, and only a spot that is still empty gets the waiver level fill in. Before, a questionable star was benched all day behind weaker healthy players
* Injury tags. A tag the code does not know now counts as questionable, never as healthy. Doubtful counts 25 percent
* Rest of season. The window stops on the last day of the fantasy playoffs, March 28. Before, the last two weeks counted games played after the season ends
* Pickups. The rest of season lift is worked out with your lineups set again for the new roster. With no adds left the list is scored for next week and says so, also late on Sunday when the list has already moved on by the clock. When the list is for next week and this week still has adds, the card says an add made before the week ends uses this week's count. A waiver date that has passed counts as cleared. A marked add counts against a week only when its day falls in that week, the same as a scanned add
* Board to engine. A move up the board can no longer read as fewer games for a player whose nine numbers sum below zero. The direction comes from the board value and the size from the nine numbers. A rank can lift the games share by 15 points at most, the same room it has to lower it, so Dejounte Murray moves from a 45 percent share to 60 and not to 93
* Josh calls. On a line blended from two seasons a call goes only as far as it takes to reach the number it points at, measured from last season. It never moves a cat further than the call itself and never against it, so a fluke the blend already removed is not removed twice. Kessler's steals stay at the blended 0.66. Before they were cut to 0.40
* Minutes. A blended line with a minutes number from Josh uses that number as its label. Without one the label still shows last season's minutes until the player has played this season, then his own minutes replace it without rescaling the line, and the usual check against the last two weeks runs from there
* Scan timing. A scan taken late in the evening no longer writes off games still being played. The first week still to play is read from the win, loss and tie counts in the scan, so the week that just ended stays in the top four number until Yahoo has put it in the records. After week 18 the top four uses Yahoo's own standings place
* Page safety. If a data file fails to load the tab says which one and shows no numbers, with a Try again button. A file that loads but holds nothing useful, such as a scan with no players on your team, is treated the same way. A damaged saved state is cleaned on load, and a marked add for a player the scan does not know is dropped. Player ids are escaped. A scan more than 2 days old gets a clear warning, and a week whose score is missing from the scan says the numbers cover only the days left
* Words. Cards say plainly when Josh has no rank or call for a player. The adds cell and the scan summary name their week. Before a week has a score the page says cats you are favored in, not cats you lead. A swing cat means 42 to 58 percent everywhere. The help text mismatches listed in the audit are corrected, and the draft help no longer tells you to tap Connect Yahoo
* Scan intake. ingest.js runs every check before it writes anything, and refuses duplicate players, unknown team ids, wrong counts, bad times and scans older than the one on file. fetch-sched.js leaves out the NBA Cup championship game
* Draft board, Teams tab and Josh by team page. Rosters follow the latest Yahoo scan. The draft room page has a proper phone layout and no longer opens blank. The name matcher no longer reads Jaylin Williams as Jalen Williams. Placeholders no longer shift the board. Stale help text, the playoff back to back list, the Cleared chip, five Josh table labels, two Josh category tags and one rebound call are corrected. Board spots are unchanged for all 191 players
* On the Oct 6 scan the week 1 chance goes from 65 to 59 percent, the average week from 62 to 61 and the top four chance from 62 to 61. The trade list now leads with Matas Buzelis and Kyshawn George for Julius Randle and Reed Sheppard at 2.3. Nine trades are listed and 14 smaller ones are hidden, from 5,907 offers scored
* Not changed, by choice. A one week streamer can still score high while its drop costs the season, preseason injury tags still count in full, and the headline is still top four. These are design questions listed in the audit report

## How to fall back to version 11

* The v17 branch holds the site exactly as it was before version 12. It is pushed to GitHub in the same step as version 12.
* `git checkout v17 -- index.html draft-room.html josh-teams.html moves.js scan data/josh_cats.json` then deploy

## Version 11 (branch v17), Oct 5 2026

* The crowded spot rule now knows a player can be slotted where there is room. Each player counts once. He fills a thin spot if he can play one, and he only counts as crowding when every spot he can play is crowded
* Before, a player counted at every position he was eligible for, so a wing like Aaron Nesmith, who is SG and SF, was marked crowded at SG on a guard heavy roster even though he replaces a forward and can play forward
* A thin spot is 3 or fewer eligible players, a crowded one is 6 or more, as before. The 5 to 8 percent size is the same
* The pickup tag now says which it is. Crowded spot means he can only play crowded positions. Leaves SF thin means the drop is the problem
* On the Oct 4 scan Duncan Robinson goes from 66 to 70, Aaron Nesmith from 64 to 68, and Devin Vassell comes onto the list at 63. Pure guards like Miles McBride keep the trim. The trade list is the same
* 140 checks pass

## How to fall back to version 10

* The v16 branch holds the site exactly as it was before version 11.
* `git checkout v16 -- moves.js` then deploy

## Version 10 (branch v16), Oct 5 2026

* Trades are listed by your gain, biggest first. Before, the list followed a hidden score, your gain times the chance they say yes, lifted by Josh's ranks and cut when the deal hurt the other team, so the big number on each card looked out of order
* Groups are unchanged. Do this now first, then trades that add a full cat, then the smaller ones
* The Josh edge number is gone. Each card now says in words whether the deal is even by Josh Lloyd's overall ranks or whether you win by them
* A trade where you give up clearly more than you get by Josh's ranks is never shown. Clearly more means over 6 value points and over a fifth of what you give
* The percent chance they say yes left the card front. It is one sentence in The pitch and no longer moves the order. A trade still needs a 25 percent chance to be listed
* Two new parts in each card. Why it matters for your team says which moved cats are swing cats, which you usually lose and which you can afford to give, with the chance to win each one before and after. Is it fair lists Josh's rank for every player in the deal and how it looks to the other team
* The quick pass now sends the best trades by gain to the exact pass as well as the best by the old score, so a sendable version of each idea is always checked
* Pickups, the week panel and the league race did not change
* 136 checks pass

## How to fall back to version 9

* The v15 branch holds the site exactly as it was before version 10.
* `git checkout v15 -- moves.js` then deploy

## Version 9 (branch v15), Oct 5 2026

* No player is pinned to a board spot by hand any more. Three pins are gone. Donovan Mitchell was held at 9, Cameron Boozer at 52 and Lauri Markkanen at 25
* Every spot now comes from the same blend. 70 percent Josh Lloyd's rank and 30 percent our stats spot, then 15 percent Fantasy Edge
* On the board Mitchell moves from 9 to 11, Markkanen from 23 to 30 and Boozer from 53 to 59. Fifteen players next to them each move up one spot
* The Pickups and trades tab reads a player's worth from his board spot, so it moves too. On the Oct 4 scan the week 1 win chance goes from 39 to 38 percent, the average week from 63 to 62 and the top four chance from 64 to 62
* The pick card calls for Kyrie and Lillard are a different rule and are unchanged
* 133 checks pass

## How to fall back to version 8

* The v14 branch holds the site exactly as it was before version 9.
* `git checkout v14 -- index.html draft-room.html` then deploy

## Version 8 (branch v14), Oct 5 2026

* The last 5 Josh Lloyd shows were read, so the site now rests on 61 and every one of the 30 teams has a show of its own. Four are team shows with a beat reporter, Grizzlies, Blazers, Raptors and Kings. One is Josh's own June reaction to the Giannis trade, the oldest show on file
* The new shows line up with the 56 before them, so no rank moved. 22 notes were reworded, most of them to add what a team reporter said and to say that the reporter said it
* The category table still holds 215 players. Giannis gains Josh's June call of 32 or 33 minutes after 29 and more assists. Quickley gains a small threes bump that is the Raptors reporter's call only. Avdija and LaVine each move one point on assists because Josh repeated the call
* A minutes number a reporter gives never sets a player's minutes. Only Josh's own number does
* An older show never pulls a newer number back. The June guess of 25 minutes for Ware and the August guess of 20 for Henderson are on file but not used
* Max Strus carries an injury flag on the board. He hurt his right foot in the Oct 4 preseason opener and tests are pending. That comes from news, not from a show
* The Josh by team page has new pages for Memphis, Portland, Toronto, Sacramento and Miami, each now built on its own show, and Milwaukee notes what the June trade show got wrong later
* A strength or weakness that only a reporter named is no longer counted as Josh's
* An independent fact check read every reworded note, every changed category row and the six changed team pages against the 5 transcripts. 3 items were wrong and 8 were adjusted, and all fixes are in. 132 checks pass

## How to fall back to version 7

* The v13 branch holds the site exactly as it was before version 8.
* `git checkout v13 -- index.html draft-room.html josh-teams.html data/josh_cats.json` then deploy

## Version 7 (branch v13), Oct 5 2026

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
* New page, josh-teams.html, reached from the Josh by team button in the tab bar. It condenses what Josh has said about all 30 teams, one team per panel, with a search box, a jump bar and my 15 players marked. It is built from josh_team_by_team_2026_27.md in the notes folder by build_team_page.py
* The tab bar now wraps onto a second row on a phone, so five buttons fit
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
