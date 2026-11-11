# Nine Cat War Room

Draft board and in season pickups and trades helper for the Ball Lovers Yahoo league (10 teams, head to head 9 cat, 15 rounds, snake).

Live site at https://ninecatwarroom.vercel.app

## Files

* api holds the small Vercel helpers that connect to Yahoo Fantasy. Your Yahoo sign in is kept only in an encrypted cookie in your browser.

* index.html is the full website that runs on Vercel. It also works if you just open it in a browser.
* draft-room.html is the draft board alone in the format used for the Claude artifact. It does not have the Pickups and trades tab.
* moves.js is the Pickups and trades tab.
* josh-teams.html is the Josh by team page, a plain page with no data files behind it. Since version 13 no tab links to it. The page is still there by its address.
* data holds the numbers the tab reads. josh_cats.json holds Josh Lloyd's category calls. scan.json is the daily Yahoo scan, scan_week.json is the snapshot the trade list uses, players.json holds Yahoo player names, league.json holds the fantasy schedule, schedule.json holds the NBA schedule and prior.json holds last season's per game numbers.
* scan holds the daily scan. yahoo-scan.js reads Yahoo inside the browser, ingest.js checks the text and writes the data files, fetch-sched.js refreshes the NBA schedule, fetch-news.js writes the injury news file, fetch-ages.js writes the player ages file, josh-update.js writes Josh's newest ranks and README.md is the step by step procedure.
* Six small extra files in data. plan.json is the season plan for every device, news.json holds injury facts and hand written news tags, ages.json holds player ages, josh_live.json holds Josh's newest ranks, starts.json holds the first scan of each fantasy week for the Monday call and results.json holds the final score of every matchup in every finished week. The tab still works if any of them is missing.
* vercel.json lets the scanner read the data files from the live site.
* scan/fetch-games.js reads ESPN box scores into data/games.json each night, numbers only.

## Version 26.22 (branch main), Nov 11 2026, the page searches every variation itself, on the last scan

Vikas asked that every variation with a manager be current on the stats of the last scan without asking for a search, that the scan date sit above the trades, and that a deal which breaks a lock by a lot be left off while a small slip is shown with a label.

* A line above the trades on both tabs names the day and time of the scan every trade is scored on
* Checked deals is now searched by the page. For a manager marked fair in the notes it tries every deal of one, two or three of your players for one or two of his, about 64,000 to 88,000 offers, drops the ones the room would not call fair with a cheap check and scores the rest with checkOffer. It works in short slices, shows how far along it is, and takes a few seconds
* Kept are deals that gain half a point or more, are fair to the room and have no hard stop. Deals that keep every lock are listed first. Deals where every lock touched slips by 3 points of that cat's win chance or less are listed after under Checked deals with a lock at risk, each card labeled with the slip. A bigger break is not shown
* The result is saved in the browser as player ids with a stamp of the scan, the plan and the notes, so the next visit only scores the kept deals again. A new scan, a changed plan or changed notes starts a fresh search. Search again forces one
* checkOffer returns slips, the win chance of each lock it breaks before and after
* The ideas kept by hand in the notes still join the list. A player your notes say a manager keeps is left out, and one he prizes needs 110 percent on the box score, as in the main lists
* data/plan.json holds Grayson Allen until Nov 25 on his word that he wants to try him out, so no deal sends him
* The words under Best trades no longer say Kyrie is never offered and Boozer is held, which stopped being true in 26.19
* Fixed in passing, two searches running side by side could each save over the other
* No change to any score formula, the room, the plan cats or the main lists
* Tested on the local copy on the Nov 11 18.23 scan with his notes. Keeps every lock, Haziq 111, Anshu 57, Nitin 18, Chris 17, Rishi 16, Vinny 10, the same deals the offline search found. A reload scored the saved list in a third of a second. 360 random offers with no error, every button tapped with no console error, lint unchanged at the same eight old warnings
* Fallback branch fallback-v26-22-before-live-search

## Version 26.21 (branch main), Nov 11 2026, every checked variation on each manager page

Vikas asked whether every deal named in chat was on the By manager pages and said he wants all the variations there, not a short pick of them.

* The private notes may now hold up to 150 ideas a manager, up from 40
* Checked deals shows the ten biggest gains and folds the rest under Show the other, so a long list does not bury the page
* Ideas that gain for you and are fair to the room but break a lock get their own list, Checked deals that break a lock, since those are pivots. Their card says which lock
* The lists were rebuilt on the Nov 11 18.23 scan from every combination of the six shapes. Kept, every deal that gains half a point or more, breaks no lock, is fair to the room and has no hard stop, with no cut for how light it reads on the value scale, plus the 30 biggest lock breaking deals a manager and every deal named in chat that is still fair to the room
* No change to any score formula, the room, the plan cats or the main lists
* Tested on the local copy, every button tapped with no console error, lint unchanged at the same eight old warnings
* Fallback branch fallback-v26-21-before-all-variations

## Version 26.20 (branch main), Nov 11 2026, checked deals of any shape on each manager page

Vikas asked for every variation of a deal with the managers he trades with, one for one, two for one, three for one, three for two and one for two, that gains for him, breaks no lock and sits inside the room's fair band, and asked for them on the site.

* checkOffer now scores up to three players a side. When you send more players than you get, the other team drops as many of its least useful players as its roster needs and each spot you open is filled by a streamer unless your own bench fills it. One extra player scores exactly as before. The site's own search still tries one or two players a side
* The private notes can carry ideas for a manager, deals you had checked, each a give list and a get list. His page under By manager gains a Checked deals section. Every idea is scored again by checkOffer on each load and shows only while it still gains 0.3 or more, keeps every lock and is fair to the room, biggest gain first. A card says Passes every check or Has a catch and spells the catch out, who drops whom, and what the deal does to his average week
* How the list was made. Every combination of the six shapes was run through checkOffer on a local copy, about 64,000 offers a manager, 384,000 in all, in 20 seconds. Kept were deals that gain a point or more, break no lock, are fair to the room, carry no hard stop, and are no worse than 45 percent light on the value scale
* What it found on the Nov 11 scan. No deal with any of the six passes every check without breaking a lock. No two for one, three for one or one for two qualifies with anyone. The deals that meet his three tests are one for one, two for two and three for two, and nearly all read light for the other manager on the value scale
* No change to any score formula, the room, the plan cats or the main lists
* Tested on the local copy. 360 random offers and 40 random adds and drops with no error, every button tapped with no console error, lint unchanged at the same eight old warnings
* Fallback branch fallback-v26-20-before-checked-deals

## Version 26.19 (branch main), Nov 11 2026, a shorter trades page, equal value prices and how you deal with each manager

Vikas asked for the trades page to show only the trades that stay on plan, the pivots and the By manager view, said Kyrie, Boozer and Yaxel may be traded as long as he gets equal value, and set which managers he trades straight with and which he only deals with when he clearly wins.

* Best trades no longer shows In talks and worth closing or Most likely to happen. It is now Sell high and keep, Stays on plan and Pivots. Deals in talks stay on each manager's page under By manager, as before
* A price of own in data/plan.json means equal value. The player may be traded, but one player ranked as high as him or better on the value scale has to come back, his own match as with any price. It follows his rank, so it never needs resetting. Kyrie, Boozer and Yaxel are priced this way now. The never trade rule on Kyrie and the hold on Boozer are lifted, and Kyrie is on keep so he is never suggested as a drop
* An empty never list in data/plan.json now clears the built in default. Before this an empty list was read as no list, so Kyrie could not be unlocked without a code change
* The private notes can carry deal for a manager, fair or win. Like every note it lives only in the browser, and the code holds no names
* fair is a manager who trades straight. His page says so and gains a Good for both section, up to three deals that lift your plan and his average week by 0.3 points or more each and are fair to the room. Smaller gains are allowed there, since the point is that both teams get better
* win is a manager you only deal with when you clearly win. A deal with him is left off every list unless your gain is 3 points or more, and his page says so. The count of deals left off by your notes includes these
* Fixed, Make this my plan on a manager's page. The button carried only the card's place in that manager's list and the page looked it up in the main pivot list, so it adopted a different pivot or did nothing. It now adopts the pivot on the card
* Tiers in data/plan.json on his word. Kyrie joined trade only, Larsson moved up to floating with a five game review, Hayes is the first drop
* No change to any score formula, the room, the face value check or the plan cats
* Tested on the local copy on the Nov 11 scan with his notes loaded. The three win only managers list nothing today, the best deal their notes allow gains 2.0. The main list shows the two Anshu deals and two Haziq deals as pivots. A deal that sends Kyrie now scores with no stop, a deal that sends Yaxel for a lesser player is stopped with the equal value line. 360 random offers and 40 random adds and drops with no error, every button tapped with no console error, lint unchanged at the same eight old warnings
* Fallback branch fallback-v26-19-before-manager-stance

## Version 26.18 (branch main), Nov 11 2026, box scores, deeper free agents and every live matchup

Vikas asked what the scan does not read and then asked for all three gaps to be closed and fed into the numbers, with any good current source for the games.

* Game by game box scores. A new nightly script, scan/fetch-games.js, reads ESPN's scoreboard and box scores and keeps each player's last ten games in data/games.json, numbers only. The first run reads 16 days in about 15 seconds, a nightly run reads only the last two days
* The log moves a projection gently. Only when his minutes over his last five games, three at least, sit 12 percent or more away from the minutes his line already uses, and two of his last three games sit on that same side, so one blowout or foul trouble night moves nothing. With five games the highest and lowest are left out, so an early exit with an injury does not carry it. The move follows the minutes and is capped at 15 percent. A player who is out or on IL is left alone. Because every list reads the same projection, trades, pickups, long term calls and trade chips all move with it
* More minutes in the box scores now counts as proof for a pickup after three games, where the two week line needed about six. The pickup card says how many minutes he played over his last games, and a trade chip gets a small lift or cut for it
* Deeper free agents. The scanner also reads the best 100 available players over the last seven days, names and status only. A free agent Yahoo gave no numbers for gets his line from his games in the log, three at least in the last 14 days. The script also names players with real minutes who are not on the site yet
* Every live matchup. The scanner reads the live score of all five matchups this week as N lines, the same pages as last week's finals, and ingest keeps them as scan.live when all ten teams came. The standings forecast now plays the week in progress from its live score plus the days left, for every matchup it has a score for, yours included. Before this it played the current week as a typical full week
* The calibration key moved to 26.18 since projections changed, so the past week checks are worked out again in each browser
* The summary has a box scores line, the newest game day, how many lines moved, yours by name, and how many live matchups the standings count
* Tested on the local copy. On the Nov 10 data 48 lines moved, none on his roster, the top three pickups and the top three trades stayed the same. On the Nov 11 scan his week chance read 41 where it read 35 without the box scores, because Yahoo's two week minutes had Bam Adebayo at 40 a night and Giannis at 39 and their last five games say 35 and 33. 360 random offers and 40 random adds and drops with no error, every listed card matches checkOffer, 54 buttons tapped with no console error, clock set to four dates. Ingest took a scan with ten N lines and the standings counted five live matchups. The seven day list and the five live matchup pages were read in the Yahoo tab, read only
* The rostered percent fix of 26.17, the seven day list and the live matchups all start with the first scan run with this scanner
* Fallback branch fallback-v26-18-before-box-scores

## Version 26.17 (branch main), Nov 10 2026, fixes from the Nov 10 code review

Vikas asked for a full review of the code base for bugs. Every script and page was checked for syntax and linted, the scan scripts were read line by line, and the engine was run on a local copy with 360 random offers, 40 random adds and drops, every tab and button, and the clock set to eight dates through the season. Five bugs were found and fixed. The password gate was read only and is unchanged.

* Rostered percent was the wrong Yahoo number for every player on a roster. A team page shows % Start, the share of leagues that start him today, where the players list shows % Ros. The scanner took the team page number, so Luka read 71 while he is rostered in every league, Quickley read 35 while hurt, and the number swung with the day's schedule. Since 26.16 that number moves face value and the room score, so an injured player was marked down twice and every trade's fairness moved a little each day. The scanner now reads the rostered percent of every rostered player from Yahoo's taken players list, and drops the team page number. A player that list does not show keeps no number, which the site reads as no change. On the Nov 10 data Randle goes from 53 to 95, Quickley 35 to 87 and Mitchell 73 to 100, and Mitchell and Randle for Flagg and Acuff moves from 92 to 94 on the box score and from 90 to 93 in the room
* The scanner read one page of league transactions, 25 moves, about four days in this league. The site counts your adds for the whole fantasy week and keeps a seven day memory of your own adds and drops, so late in a week an add from Monday could fall off the page and the adds left count would read one too many. The scanner now reads up to three pages, about two weeks, and keeps a row once if it shows on two pages
* checkOffer read the team id as given. A number in place of text, 2 for '2', marked every player you get as not on that team, and an unknown team id threw an error. The id is now read as text, and an unknown team, your own team, a list that is not a list or a player named twice gets a plain answer
* fetch-news.js, fetch-depth.js, fetch-ages.js and fetch-sched.js called process.exit after a network call when a check failed, which trips a libuv assertion on Windows and prints a crash line after the real message. It showed on Nov 10 when a tag was refused. They now end on their own after a network call, the same fix check-live.js got in 26.13. The message, the exit code and the rule that nothing is written stay the same
* ingest.js stamped data/players.json only when a scan carried a player line. check-live.js compares that stamp with the live site, so on a night with no player lines (Nov 11) it printed LIVE OK without proving the new scan was live. The stamp now moves on every daily scan
* No change to any rule, plan cat, tier, score formula or page text
* Tested on the local copy on the Nov 10 data. The new scanner ran in the Yahoo tab, read only, 443 lines, no errors, all 164 rostered players got a rostered percent, 77 transactions back to Oct 26. 360 random offers and 40 random adds and drops with no error and no bad number, every listed card matches checkOffer, 50 buttons tapped with no console error, summary reads the same twice in a row
* The trade snapshot keeps the old numbers until the first scan after a roster change in the league, or one run of ingest with --snapshot
* Known and left alone. In the fantasy playoffs, weeks 19 to 21, the league schedule on file has no matchups, so the week view says no matchup found until the schedule scan is run again
* Fallback branch fallback-v26-17-before-review-fixes

## Version 26.16 (branch main), Nov 6 2026, swap by swap, rostered percent, notes fit and every shape

Vikas pointed out that Randle and Larsson for George and Reid had come out as fair at room 98 when the second swap, Larsson for Reid, insults any manager. Reid is rostered in most Yahoo leagues and Larsson is a waiver pickup, and the totals hid it. He also asked for the trade engine to try one for two as well, to pair the swaps on every card, and to lean on what each manager has told him.

* Swap by swap both ways. The players in a two for two are paired by room score, best for best and lesser for lesser. A second swap where the lesser player you get is worth 25 percent or more above the lesser player you give, in the room's eyes with the name and the rostered percent counted, is an insult to him and the deal is never listed, the same as a second swap that is a straight downgrade for you. Every card spells the swaps out with the room number on each, and checkOffer returns them as swaps
* Yahoo's rostered percent is status. 100 percent carries 5 percent more on face value and the room score, 75 is even, 50 carries 5 less and 20 carries 11 less. Reid at 85 percent now reads as a real player and Larsson at 17 as a waiver pickup, so the pair comes out at 68 on its own
* Teammate due back cuts a role player only when the teammate plays his spot. Guards are one group, forwards another, centers a third. A guard coming back no longer cuts a center
* One for two. The search tries one for one, two for two, two for one and one for two. In a one for two your least useful player the drop rules allow is dropped to make room, the deal is scored with that drop made, the card names him with a Drop chip, and marking it made drops him too. checkOffer picks the same drop and returns it as myDrop, so a one for two no longer needs a second run
* Profile fit from your notes, 0 to 100 on every card with that manager. He gets a player he said he likes, 30 each up to 60. You get a player he said he would move, 20 each up to 40, read from move in managers.json, or a plain name under yes, which is how Anshu's were written. It helps a cat he is chasing, 15 each up to 30, a player at a spot he needs, 10, and a player he does not rate on your side takes 30 off. At 50 or more the deal fits his notes, shows a Fits his notes chip, sits higher in every list by up to half again, needs 4 points less on the value scale and may lose by Josh's ranks by half again the usual margin. The room band and the box score never soften. By manager has a He would take section with the deals that fit, best fit first, and says so when none do. The workers get only the likes, moves, needs and dislikes, never the notes file
* The real nine cat change sits beside the plan gain on every card as a Nine cat chip
* A tap on a manager's pivot on the By manager tab now marks and pitches that pivot. Before this it took the trade with the same number from the Best trades list
* Loading a notes file now scores the trades again, so the fit shows at once
* Tested on the local copy on the Nov 6 data. Randle and Larsson for George and Reid now stops on the second swap, Larsson is 68 percent of Reid. Yaxel and Mitchell for Murray and Hart stays a veto at 119 with the Hart swap at 162. Every listed card matches checkOffer, 768 offers scored, 13 of them one for two, no console errors, no dash or colon in page text on the trades and By manager tabs. 37 offers kept against 39 on 26.15 with the same data
* Fallback branch fallback-v26-16-before-fit-swaps-shapes

## Version 26.15 (branch main), Nov 6 2026, no selling points to fix a lock

Vikas saw Yaxel and Mitchell for Murray and Hart listed first at plus 3.7 and asked why. The engine was giving up 8 points a game because PTS already sat at a 30 percent chance and is cheap on the win curve, and Hart was bolted on only to keep the STL lock. The fixes below are on his yes. Production stays the room's business, a deal that gives up points is judged by the room band and not turned into a pivot, since he is not chasing points, he only needs the league not to veto. Projections and the week forecast did not change, CALV stays 26.13.

* No filler. In a two for two each swap has to stand on its own. When the lesser player you give is worth 25 percent or more above the lesser player you get on the box score, the deal is never listed, and checkOffer names the swap and what share comes back
* Asking price per player. Each priced player you give needs his own match at or above the price on the other side. Yaxel at 30 is no longer satisfied by Murray being in the deal while Yaxel goes for Hart
* By manager shows that manager's pivots under their own heading, fair to him, gain 1.5 or more, each costs one cat, with the notes applied the same way as the fair deals. The empty message says pivots below when there are any
* The room counts steals at three quarters and threes at a quarter, nothing for turnovers or percentages, this season at about 58 percent by game 7 (the value scale stays slow), and a top 10 draft pick carries 10 percent. The Nov 5 veto replays at 118, the Hart deal at 117
* Every trade card shows up on last season or down on last season for the players you get, a buy low chip for a player out with a return date whose last season line was solid, and buying high now costs a deal 15 percent of its place in the list
* Tested on the local copy on the Nov 6 data. Every listed card matches checkOffer, workers and page score the same 3031 offers, no console errors, no dash or colon in page text on the trades and By manager tabs with the notes loaded
* Fallback branch fallback-v26-15-before-plan-gain-fixes

## Version 26.14 (branch main), Nov 5 2026, the room judges every trade

On Nov 5 the league vetoed Mitchell and Randle for Murray and Robinson as unfair to Vikas, a deal the site had listed as fair for his build. The room judges a trade like a points league, points, rebounds and assists, plus the name, and this version judges every deal that way too. Nothing about projections, the plan cats, locks, pickups or the week forecast changed, so CALV stays 26.13.

* Room score for every player. Points plus rebounds plus assists a game, nothing for turnovers, percentages, threes, steals or blocks. It starts from last season the same way face value does and this season moves it the same way. Name status on top. A top 10 player on that line last season or this season counts 15 percent more than his line, top 25 counts 10 more, top 50 counts 5 more, a top 40 draft pick or a legend 6 more. Age and missed games cut it as they cut face value. Each teammate due back from injury cuts a role player 8 percent, up to 16. A top 50 name is not cut for that
* Room look on every deal, what they get over what they give with the best player weighted most, the same as face value, judged on the whole number the card shows. Fair is 94 to 106 both ways. Easy sell needs 100 to 106 on the room look and on the box score. Over 106 their way on either is an Overpay, its own tag with the chip Overpay, room may veto, never called fair or easy, scored at 40 percent so it sits low. From 112 the room vetoes it and the deal is never scored. Under 94 it is light to the room and at best a hard sell, under 86 it is never scored. Star for parts, the biggest name in the deal (a top 50 name) going for players none of whom is within 85 percent of him, is never scored, whichever side gives the star
* The box score cap drops from 120 to 110 percent their way. Easy sell on the box score is now 100 to 106, not 106 and up
* Every trade card, stretch card and talk card carries a Room chip with the number, a Light to the room chip under 94, and the sell lines say how the room sees it in its own words. Talk cards say veto, may veto, star for parts or light, and a deal the room would veto shows a third of its chance to happen. tradeFair names the top 50 names in a deal and any teammate markdown
* checkOffer returns room, roomFair, roomEasy and roomWhy, and a deal that fails the room is a stop. The Nov 5 veto replayed on the Nov 5 data comes out at 127 percent their way, veto, and Randle for Naz Reid at 142, veto
* Wins on fit needs the room to agree as well as the box score. summary says overpay, room may veto, and prints the room number on each trade
* How this works on the trades tab explains the room lens. NCWMoves._fn exports roomOf, roomValues, faceOf and the room constants
* Tested on the local copy on the Nov 5 data. Every listed card matches checkOffer, workers and page score the same 2850 offers and list the same deals, no console errors, no dash or colon in page text on the trades and By manager tabs with the manager notes loaded
* Fallback branch fallback-v26-14-before-room-fairness

## Version 26.13 (branch main), Nov 5 2026, fixes from the Nov 5 deep audit

The audit report is bug_reports\audit_2026-11-05.md in the notes folder. Every item in it was fixed on Vikas's yes. Nothing about the plan cats, locks or how out players are counted this week changed.

* Top four chance and wins by week 18 use the cat record. This league keeps a category record, nine decisions a week, and the old sim added one win a week to it. Every future matchup is now played cat by cat and the first week to simulate is read from the record divided by 9. The league table and the Teams tab say cat record and the header says cat wins by week 18
* The value scale no longer sells an established player short after a cold start. This season climbs at half speed, 85 percent of (1 minus e to the minus games over 20), about 25 at game 7, 45 at 15 and 66 at 30. A player far below his draft spot loses it only after 15 games, and a breakout up needs two weeks of 3 games or more. On the Nov 5 data Mitchell moves from 21st to 18th, Tatum 30th to 22nd, Randle 115th to 91st, Siakam 110th to 88th, and the replay of the 13 logged talks stays 10 of 13. The injury prone cut reaches its full 10 percent at 50 of 82 games, as the comment always said
* The season view counts every team at 15 active players. A team with more counts its best 15 by value and games share, the rest sit out as if dropped, and a roster change keeps the count at 15, a player leaving lets the best one sitting out step back in. A two for one filled from your own bench gets no streamer credit. With this the average week no longer swings with the roster count, 61.3 with 17 players against 61.4 with Larsson dropped, where it was 62.7 against 57.7. The 60 percent hedge for a player on IL who is out now applies only with no return date in the news
* Players of yours who are out, on IL or waiting on a return date are never offered in a trade, and checkOffer says so. Tatum is not sold while hurt
* Overpay warnings. A deal 6 percent or more their way on the box score, or 6 points above what they need on the value scale, carries an Overpays chip, a line under News and risk and a checkOffer stop
* Buying high. A player you would get whose box score runs 20 percent or more above a modest record with no new role carries a buying high chip and a risk line. A starter on his NBA team who is out with a return date is named as due back. And while such a starter is out, a hot start is moved a third of the way back toward the preseason line
* A marked trade counts for this week from the day Yahoo processes it, two days after the mark. The banner says the day. The season view moves the players at once as before
* Pickup cards print the calibrated week chance, the same number as the header
* The trade off table never prints a hyphen as a minus sign, keeps Jr. and III with a last name, and on a two for one shows the streamer as its own column
* In a two for one the other team never drops a player on its IL, and nobody when it has an open spot
* The manager notes rule deals out before Best trades is picked, so the list refills and the routes agree. Out are a deal a note rules out, a deal that asks for a prized player unless it favors him by 110 percent or more on the box score, and a deal with two or more injury prone players. The page says how many were left off. In talks shows only deals that help you
* A damaged saved value in the browser can no longer blank the page. The board state is checked piece by piece and reset when wrong, and old calibration keys are cleared
* The Teams tab shows the scan numbers only while its cards hold today's rosters, finds a team by draft slot so a renamed team keeps its numbers, and says cat record
* A two week line Yahoo left empty later in the season is filled from the season line, marked as not shown, so the minutes check still runs without counting as proof, a role change or a breakout
* A replay of an older scan ignores moves you marked today, so the Monday call is built from what was known then
* The Draft board in season hides the draft cells, the quick bar and the draft panels, the Teams tab hides the draft controls, and on a phone the board comes before the rail with 16 pixel inputs
* Wording. Goal line names a best pickup only when it scores 50 or more, the IL move named first is the player out longest, the held until date reads as words, the My players note gives the real blend weights
* ingest.js no longer warns that most players have no two week numbers from week 3 on. Only a line Yahoo left empty counts as a gap, so the nightly 30 minute reread stops and a clean scan can replace a flagged snapshot again
* scan/check-live.js reads the open /data/players.json on the live site and prints LIVE OK or LIVE STALE with both stamps, so a blocked deploy is loud
* Dead code out. sgn, tradeWhy, the old value scale weights, effLine, gpw, the hidden Game plan tab and its 172 lines, pickLabel, lean and bestLean
* Calibration restarts under CALV 26.13. Tested on the local copy, 47 cards all match checkOffer, workers and page score the same 5824 offers, no console errors on any tab, no dash or colon in page text, no horizontal overflow on a 390 pixel phone
* Fallback branch fallback-v26-13-before-audit-fixes

## Version 26.11 (branch main), Nov 4 2026, trade engine rework

* What if on your real roster. NCWMoves.setRoster([[id,slot,status],...]) rebuilds every number from your roster as Yahoo shows it today, the trade snapshot too. Nothing is saved, a reload goes back to the last scan. NCWMoves.whatIf([add ids],[drop ids]) scores a move for this week and the season without changing anything
* Every trade card opens with The trade off, a game. What you give and what you get per game for all 9 cats and minutes, side by side, each cat marked lock, build, half weight, bonus or punt, with helps or costs. Each player's rank on the value scale, breakout and injury prone flags are under it. checkOffer returns the same table as perGame
* Asking prices in data/plan.json under ask. A trade that sends one of these players must bring back a player ranked that high or better on the value scale. Lendeborg 30, Boozer 40. Trades below the price are never listed and checkOffer names it as a stop
* The value scale is led by this season. This season's share is 85 percent of (1 minus e to the minus games over 11), about 40 at game 7, 63 at 15 and 79 at 30. The rest is Josh 47, last season 21, Yahoo's preseason rank 17 and draft spot 15. This season is three quarters the site's own rank and a quarter Yahoo's current rank once he has 5 games. A late pick still moves half its draft share to Josh and Yahoo
* Breakout rule. A player 20 or more spots better than his draft spot, with 5 games and 26 minutes over two weeks, has his draft spot fade to nothing by 60 spots and last season by half. A player far below his draft spot loses it the same way after 5 games
* Injury prone. Games over the last two seasons (60 and 40 percent) blended with this season. Under 65 of 82 is prone and is marked down up to 10 percent at 50 of 82. Taking on 2 or more prone players is a checkOffer stop and sits 30 percent lower in the list
* A player who has played every one of his team's games has his games share learn faster, like 15 games of the old figure instead of 25. FG% and FT% lean on the old line one and a half times as long, was twice. Calibration restarts under CALV 26.11
* By manager. managers.json may hold open, deals a manager offered himself, in the talks give and get order. They show under In talks as His own idea even when the value scale says light. A manager's page flags notes older than 14 days
* Tested on the local copy. No console errors on any tab, checkOffer matches every listed card. Replay of the 12 logged talks at the Oct 22 scan, new scale 9 of 12 right, old 10 of 12, both miss the same two
* Fallback branch fallback-v26-11-before-trade-rework

## Version 26.10 (branch main), Nov 4 2026, fixes from the Nov 3 bug check

* The week card no longer says Cats you lead for a forecast. It says Cats on track by Sunday, shows how many cats you lead right now apart from that, and says Hold the lead only when you really lead 5 or more. The nightly summary says the same
* The Monday call. The first scan of each fantasy week is kept in data/starts.json, and the site works out the week forecast from it with only the news known by then. It stays put all week, and the page says how far today's number has moved from it and which cats moved it
* The forecast learns. Each nightly scan reads the final score of every matchup last week into data/results.json. The site checks the Monday calls for all five matchups of every finished week against them and fits one factor for how sure the chances should be, held near 1 while results are few. Weeks 1 and 2 are on file, 89 cat results, and the raw chances were too sure, factor 1.21
* A player on IL who is no longer tagged out is flagged at the top of Pickups and in the summary, with the drop the tiers allow that costs the least over the season (a floating player may go here) and the week chance with him back. Yahoo may refuse adds while he sits there
* This season counts more. A player's line is half this season by game 7 (a real last season now counts like 7 games, was 12). FG% and FT% lean on the old line twice as long. Josh's pull on the board is cut from 70 to 50 percent of the way, so he is about a quarter of a line by game 7 and less after
* Games played now come from games really played. Josh's rank no longer cuts a player's games share, and this season's share joins slowly, like 25 games of the old figure. Mitchell goes from 74 to 88 percent of games, Trey Murphy from 62 to 80, Quickley from 63 to 79
* ingest.js marks a scan read while Yahoo was still updating. Such a scan never stays as the trade list's weekly snapshot, the next clean scan replaces it. --snapshot forces a refresh, recovery only
* fetch-news.js drops a tag about missed games once the player has played again, and names it in a NOTE line
* josh-update.js warns when one player's moves stack past 40 places since his last named rank
* check-deploy.js prints a NOTE when data/plan.json goes live with a data deploy
* data/plan.json, Devin Vassell and Kris Dunn floating, Pelle Larsson droppable, a review for Dunn at game 9
* Fallback branch fallback-v26-10-before-bug-fixes

## Version 26.8, Oct 28 2026, steadier week forecast

* Found by replaying every saved scan from weeks 1 and 2. Around midnight Pacific Yahoo has added last night's minutes to the two week split but not the game, so anyone who played last night read a third to a half too many minutes (LaVine 47.7 at 12.05 am, 36.0 at 1.54 am). That one glitch moved the week 2 forecast from 65 to 48 and back
* scan/ingest.js now sets a two week line that disagrees with the season line back to the season line while every game a player has played is inside the two weeks, and warns when any two week line shows more than 44 minutes
* The nightly scan moves from 12.05 am to 2.05 am Pacific, after Yahoo finishes
* Replayed with the guard, week 2 reads 65, 64, 79, 83 instead of 65, 48, 77, 83. What is left is real, Anthony Edwards going on IL, a strong Tuesday and the Watson pickup
* Fallback branch fallback-v26-8-before-mid-update-guard

## Version 26.7, Oct 28 2026, fixes from the full test run

* No projection goes above 40 minutes a game. A short two week sample with overtime games had Austin Reaves, Zach LaVine and six others at 42 to 48 minutes, which inflated every trade with them
* A player whose waiver date is today still shows as a waiver claim, not a free agent. The nightly scan runs before Yahoo clears claims and another manager may claim him first. Pickups, the waiver list and trade chips all follow this
* Sell high no longer lists injured or IL players, and each card says what really changed, a move into the starting five, minutes up or down, or same minutes and role
* checkOffer warns when you get more players than you send, since the drop you would need is not counted in the gain yet
* Names in the plan tiers or reviews who are no longer on your roster are flagged in My tiers and in the summary
* A lock a hair under its floor shows 59.9 and just under, never 60
* An empty pickups list says why
* data/plan.json, Naji Marshall and Neemias Queta taken out of the tiers and reviews after they were dropped
* Fallback branch fallback-v26-7-before-test-fixes

## Version 26.6, Oct 24 2026

* My tiers is now a small box of its own under The league, showing only floating and droppable players. Trade only players are left off
* The long explanations on pickups, long term, trade chips, trades, By manager and the league table sit behind a closed How this works toggle
* Sell high has three tabs, Sell high, Rising keep and Contract year, each with a count
* The Teams tab shows every team's place, average week, top four chance and record, with each cat's chance in an average week, green 60 percent or better and red 40 or under, sorted strongest first. Your plan locks are marked. It follows the newest scan
* Fallback branch fallback-v26-5-before-layout

## Version 26.5, Oct 24 2026, contract years on

* Roster tiers, set by Vikas. data/plan.json has tiers with three lists. trade is trade only, moved only in trades and dropped only when out for the season or, for a non top pick, out more than 6 weeks with no IL spot. float is earning his spot, never dropped for a stream and dropped for a long term add only in a slump. drop goes for any clear upgrade. A pickup on no list counts as droppable
* review in data/plan.json names the games after which a player's spot is checked again, with a note for anything else to watch. The new My tiers tab under Pickups shows every player's group and review. A review says move down when the best long term free agent would add 1 point or more to the average week in his place. A droppable player earns a move up after 10 games once his box score rating matches the lowest on the trade only list, with 26 or more minutes
* Rui left the keep list and is now droppable, as the first drop once Brandon Ingram is back
* Streams that also last rank first. A stream now adds 30 percent of any rest of season lift to its week score
* Contract years. data/contracts.json lists players whose deals can end after the season, from Hoops Rumors. A free agent or restricted free agent aged 27 or younger counts as playing for a deal, 6 to 7 percent better, more for a better player, and everyone else 3 percent. Turnovers and minutes are left alone. The bump is a trial for his first 5 games. From game 6 it stays only while his numbers this season are at or above his usual level, and comes back if he climbs above it later. It runs only while on is true in the file. Sell high adds Contract year, sell before he signs for a hot contract year player of yours
* The nightly summary has a tiers line with any review flags
* Fallback branch fallback-v26-4-before-tiers

## Version 26.4, Oct 22 2026

* Deals in talks. The notes file can list deals a manager has talked about, each marked yes, maybe or no, with a date and a short note. Any size works, three for three included, and every number comes from checkOffer
* By manager shows an In talks section at the top for that manager, with your gain, your average week before and after, whether it keeps your locks, how it looks to him on box scores, and the chance it happens (about 80 percent for a yes in principle, about 55 for considering)
* Best trades shows In talks and worth closing only for deals that gain at least 1 point, keep every lock and lift your average week
* A deal a manager turned down never shows for him again, and a deal in talks is not listed twice
* Up to 30 tips per manager, up from 16
* Fallback branch fallback-v26-3-before-talks

## Version 26.3, Oct 22 2026

* The whole site is behind a password. A sign in page asks for the password and nothing else. After the right password the browser keeps a cookie for 400 days, the longest Chrome allows
* The password is never in the code. Vercel keeps only its hash in the SITE_PASS_HASH setting. Changing that setting signs every browser out, which is how to lock someone out later
* Only /data/players.json stays open, since the Yahoo scanner reads it from a Yahoo tab and it is just the public player list
* Sign out at /__gate?out=1
* The scan steps now load the scanner from the project folder and check the live data from the site tab, since a Yahoo tab cannot get past the password
* Fallback branch fallback-v26-2-before-login

## Version 26.2, Oct 22 2026

* Trade cards are about a fifth the size. Three sections. What it does for me, one table with the locks always and any cat that moves 1.5 or more. How to sell it, what the other team gains, said about that team. News and risk, a few short lines
* Gone from trade cards. How it looks to them, For your eyes only, Josh on the cats, and What they will say unless a profile on that manager is loaded
* Pickup cards keep Why him, What it does for me and What it costs, with News and risk in one line. What it is based on and Josh on the cats are gone
* To fall back, `git checkout fallback-v26-1-before-cards -- moves.js README.md` then deploy

## Version 26.1, Oct 22 2026

* Pickups has three tabs, This week, Long term and Trade chips. Trade chips used to sit under a tab named Waivers, so a free agent like Brook Lopez read as a waiver claim. Each chip card still says Free agent, or Waiver claim with the day he clears
* To fall back, `git checkout fallback-v26-before-tabs -- moves.js README.md` then deploy

## Version 26, Oct 22 2026

Built after the full audit of version 25 and after Vikas pointed out that the top trades would get him laughed at. Other managers judge a trade by the box score and the name, not by minutes or nine cat math. Every trade is still scored for you the deep way.

**Trades, judged the way they see it**
* Face value. Each player gets a box score rating that leads with points, then rebounds and assists, plus threes, steals and blocks. It starts from last season, or the season before for a player who missed last season, or the projection for a rookie
* This season moves it fast only when the start backs up the record, a hot start from a solid player or a cold start from a weak one. Otherwise it reads as one good or bad night and moves slowly. Missed games, age 33 and up, injuries and a big name move it a little
* A listed trade has to look about even to them on face value and may be at most a little light on the value scale. It never hands them more than 20 percent extra
* Insult guard. A deal under 80 percent of even on face value is never shown anywhere. A manager your notes say calls out lowballs never sees a light deal, not even as a long shot
* The pitch, How it looks to them, the sell rating, the yes chance and the By manager views all use face value. The rankings claim in the pitch is only made when Josh's ranks agree
* Yes chances without notes start lower, about a third for an easy deal
* No more than 3 trades with one manager in Best trades. By manager still shows them all
* Hold. When no trade passes both checks the list says hold. Before about 5 games a player a note says holding is a fair choice
* Sell high. Your players running hot on a modest record, with no change in minutes or role, after 3 or more games, with the best fair deals for them. Rising players whose record backs the start are listed as keep
* Trade totals start two days after the scan, for Yahoo's trade review. A trade with this week's opponent says it barely changes this week
* The center minimums count only centers who can play, not centers on IL or out
* Hurt or IL players you would get carry a red chip, a risk line and a warning in the daily summary. An injury status always beats the tone of a news note

**Pickups**
* Why him on every pickup and waiver card. Both seasons, this season so far, the trend, his minutes against last season, his depth chart spot, the plan cats he adds and costs, and a plain verdict
* Ends a trade on pickup cards when the drop is in a top trade
* The bigger ask on a trade card and the stash card for a hurt free agent now follow the drop rules, so Rui and other protected players are never named as the drop
* Real minutes count from the first game, a game weighing like a quarter of the starting guess
* A day to day player's return date sets his injury class and how long a backup fills in
* Notes from before opening night show as preseason news and no longer move a chip score
* Trade chips use the day a waiver claim clears, ignore Yahoo's season rank before 3 games, and a chip that costs your season more than 2 points is a trade piece at best
* The waiver level leaves out your own recent drops

**Scan and data**
* ingest.js fills a missing two week line from the season line in weeks 1 and 2, when they are the same thing. From week 3 it warns when more than 10 percent are missing. On Oct 22, 95 of 230 lines were missing
* The live game refusal says to wait until the last game ends and that the site keeps the last good scan
* fetch-depth.js keeps a date for each team, so a team that failed to load ages out after 10 days
* Kyrie, Boozer's hold and Rui's keep can be changed in data/plan.json with no code change. The code keeps the same defaults
* Season years come from the league file, so the site rolls over next season
* Page text has no dash or colon characters. Negative numbers in text read up or down, and a score badge uses a true minus sign

**Checked**
* Every owner rule tested on the Oct 22 scan against pickups, waivers, chips and trades. Workers and the page give the same trades. The trade search is about a quarter faster because insults are skipped before scoring

## How to fall back to version 25

* The fallback-v25-before-v26 branch holds the site exactly as it was before version 26
* `git checkout fallback-v25-before-v26 -- index.html moves.js scan README.md` then deploy
* data/plan.json gained the never, hold and keep fields. Version 25 ignores them

## Version 16, Oct 9 2026

Built after Vikas tried the pitch on a real manager. Josh's ranks mean nothing to another manager, and most managers do not know their own stats well. The pitch now tells them what their team gets. No trade changed in how good it is for you or in which trades are found.

**How to sell it**
* The card now has How it looks to them, the value scale, and then How to sell it, the talking points
* Stars first. A player other managers value at 60 or more, about the top 25, is a star. Two stars coming to them is said plainly, with each one's real stat line when one exists. One better player than any they give is the best player in the deal
* What their team is already good at, top 3 among the ten, and that it stays there after the deal. A cat they send from is extra they can spare
* Where their numbers go up. Their place among the ten teams before and after, and about how many more a week, or fewer turnovers, or the new percentage
* How the roster fits. When they give a center, how many they still have. When they are thin at guard or forward, that it fills that spot
* Risk that moves off their team, and two players for one, as before
* The draft pick line and the box score line are gone. Josh's ranks moved to For your eyes only
* What they will say adds a line on giving up a center, and when they give the best player for two stars, to sell the two stars
* The message to send uses the same lines, stars, the first two bumps and the center line
* What it is based on is gone from the trade cards. It stays on the pickup cards

**Checked**
* Trades are scored against all nine other teams. On the Oct 8 scan 5,532 fair offers were checked and every team had offers scored. A team can still show no card when nothing from it is good enough for you

## How to fall back to version 15

* The v21 branch holds the site exactly as it was before version 16
* `git checkout v21 -- index.html moves.js scan README.md` then deploy
* The data files are the same in both versions

## Version 15 (branch v21), Oct 7 2026

Built after Vikas tried the version 14 trades on a real manager. Bench swaps he would have been laughed at for were tagged easy, and his best trade was tagged easy while the other manager pushed back on it. No trade changed in how good it is for you. He also asked that injury tags weigh on pickups, less so for better players. Three parts.

**How a late pick looks to other managers**
* A pick after 80 is one manager's reach, not the league's view, so the draft counts less there and Josh's rank and Yahoo's rank count more
* Picks 80 and earlier, before a player has played, are as before. Draft 45 percent, Josh 25, last season 20 and Yahoo 10
* Picks 100 and later, and players nobody drafted, are Josh 40 and 20 each for the draft, last season and Yahoo
* Picks 81 to 99 get a mix of the two, a little more of the late pick weights with each pick, so two players drafted one spot apart are never valued by different rules
* Both groups slide with each player's own games and end on the same split at his 41st game. This season 40, Josh 20, draft 15, last season 15 and Yahoo 10
* For picks 80 and earlier Josh and the draft now meet half way, at about 20 games, with 26.25 percent each. In version 14 the draft was still at 30 there and Josh at 22.5
* Last season was not given more weight for late picks. It is the number that flatters a player whose role shrank, which is what made Kevin Porter Jr. and Reed Sheppard read as good as CJ McCollum and Fred VanVleet

**The easy sell tag**
* Helping two cats they are short in still makes a sell easier, but only when the deal does not leave their team 2 points or more worse
* Three things now hold a tag at fair ask at best. They are caps, not steps down, so they never stack and push a decent deal to a hard sell
* Player for player. When the best player on each side is within 15 percent and their second player is worth at least 40 percent and 5 points more than yours, a manager feels he lost the deal whatever the totals say
* Damage. A deal that costs their team 5 points or more
* Bench swaps. Every player in the deal is worth 20 or less on the value scale, where the scale can not tell players apart well and managers go by their own read
* For your eyes only on the card gives the reason, but only when these rules are what took the tag down from easy. A deal that was never easy for other reasons says nothing
* Their change is judged to one decimal, the way the card shows it, so a card never says 5 points under an easy sell chip
* The tag still does not ask that a trade helps them. It only stops calling a deal easy when a manager who checks would see what it costs him

**Pickups and injury tags**
* A tag counts twice. First in the games. Each game counts 96 percent with no tag, 90 for probable, 75 for a game time call or day to day, 60 for questionable or any tag the page does not know, 25 for doubtful and nothing for out. Version 14 counted a game time call the same as questionable
* Then the score itself is cut, for the risk that an add is wasted while he sits. A one week stream loses 10 percent for a game time call, 25 for questionable and 60 for doubtful. A keep loses half of that
* The better the player, the smaller that cut. Inside the top 60 of the blended rank it is nothing, from 140 on it is all of it, and it slides one rank at a time between. The games are not scaled, since a questionable star misses the same share of games as anyone else
* A player who is out can now be listed, but only as a keep, only when the news gives a return date, and only when he scores 50 or more. He has no week of his own, so his score is the whole rest of season lift, counted from the day he is due back with the player he would replace dropped, less 40 percent of what a drop costs that week when one is needed. A stash is a season move. On the 40 and 60 split of a normal keep, one week of a bench player's games would hide a star who is back in two weeks. A known side effect is that a star tagged doubtful, who is scored as a normal keep, can score a little under the same star tagged out with an IL spot open. With an IL spot open the card says to stash him there and nothing is dropped now, and marking the add puts him on IL. An open roster spot or an IL move of your own also means no drop for now. Without any of those the drop costs its games this week
* Out players are scored apart from the fit ones. They never push a fit player off the list and never count as a similar player sitting there
* Two labels replace This week only and Helps the season. Stream for games when the week alone moves 2 points or more, Keep long term when your season gets better with him by 0.3 or more. A card can carry both. The label of the reading that gave the score is always shown, so the chips never disagree with the words on the card
* The first chip no longer says Stream for games. It names the cat he helps most, or Covers an injury, Stash for upside, Stash on IL or Out for now

## How to fall back to version 14

* The v20 branch holds the site exactly as it was before version 15
* `git checkout v20 -- index.html moves.js scan README.md` then deploy
* The data files are the same in both versions

## Version 14 (branch v20), Oct 7 2026

Built after Vikas read the version 13 trades and found two faults. Some offers handed over far more value than they brought back, and one offer the tab called fair would have been laughed at. Four parts.

**How a player looks to other managers**
* Five ranks are blended. This season's production, last season's, this league's draft spot, Josh's rank and Yahoo's rank
* Before a player has played it is draft 45 percent, Josh 25, last season 20 and Yahoo 10
* By his 41st game it is this season 40, Josh 20, draft 15, last season 15 and Yahoo 10. It moves a little with every game he plays
* It goes by each player's own games. A player who has missed most of the year still leans on the draft and last season
* Games missed count. Each season is ranked by value above a replacement player times the share of games played. This season is measured against his team's games so far, counted from the NBA schedule, last season against 72 games, and an older season counts as 6 games in 10
* An older season still marks a player down 15 percent in rank and an age of 32 or more by 8 percent
* This fixed the fault where 38 good games made Kevin Porter Jr. read like a top 20 player

**Which trades are offered**
* An offer has to look even or better to them, 2 percent short at most. If they give the best player it must lean 2 percent their way, and 10 percent when he is better by a quarter or more
* An offer never hands them more than 15 percent extra value, 10 if you give the best player and 5 if he is clearly the best. Version 13 allowed 45
* When you give the clearly best player the offer may lean up to 8 percent your way
* The order no longer rewards paying over the odds. A fair ask is marked down 10 percent and a hard sell by half. Each point of value you hand over beyond an even deal takes 0.03 off the score, and each point you get back adds it
* A weaker version of a deal with the same team is not listed. Weaker means you give at least as much, get no more and gain no more, give or take 0.05 of a point
* Trades that gain under 1 point are hidden behind a box under the list
* A bigger opening ask. Where one exists the card says Start higher and names it, with the listed deal as the fallback. It is one of two things. An offer with the same main player each way that looks up to 12 percent short of fair and gains you more. Or the listed deal plus one more low tier player from their side, with your least useful player dropped to make room, scored in full with both lineups set again
* A bigger ask may take one guarded cat up to 3 points under its floor. It then has to gain a full point more than the listed deal, and the card says what it costs
* The player you drop for a bigger ask is your least useful one that other managers do not value above the player you ask for, or above 10 points of value

**Josh's ranks during the season**
* data/josh_live.json holds the newest Josh rank for each player he has moved since the draft. scan/josh-update.js writes it from a hand written list kept in the notes folder
* The board reads it, calibrates again and the numbers on the tab follow. A player taken out of the file goes back to his draft day rank. A stat line stays put when a minutes call from Josh already holds it
* A player who is not on the board keeps his rank from this file for how he looks to other managers and for the check that you do not lose a deal by Josh's ranks. His stat line does not move
* Cards name each move with its date and a one line reason in our own words. The summary names the moves on your roster. Josh's sentences never go into the project
* His category calls are not changed by this file. They fade by themselves as real games replace last season's numbers
* The steps are in scan/README.md under Josh updates

**Layout**
* Trade cards. What it does for you, Stats it helps and costs and Why it matters for your team are now one section named What it does for you. It has a short summary and then one line per cat that moves 1.5 points or more, with the change, the before and after and what it means under the plan
* Trade cards. How it looks to them and How to sell it are now one section. The long note on how the value blend works is left off the card, since the top of the Trades panel says it once
* Pickups scored under 50 and marked skip are hidden. A box under the list shows them
* The My players table is hidden. A box in its place shows it
* All three boxes are remembered on the device
* The board panel Your 9 cats now shows the scan numbers on every device. In version 13 a board saved during the draft, or a mock left on the board, kept the old draft tool numbers there, which rate your average player against an average top 140 player and know nothing of the other nine teams

**What was checked**
* See the audit log in the notes folder for the test list and the independent check

**Known limits**
* The weights are a model of how other managers think. They will be wrong for some managers
* Every in season state was made up for testing. No real games exist yet, so the slide from draft to this season's numbers has only been tested on made up games
* A bigger ask with three players coming back assumes they fill their open spot with a streamer
* Tested in Chromium only. No real phone and no Safari

## How to fall back to version 13

* The v19 branch holds the site exactly as it was before version 14
* `git checkout v19 -- index.html moves.js scan README.md` then deploy
* data/josh_live.json can stay. Version 13 does not read it

## Version 13 (branch v19), Oct 6 2026

Built after Vikas read the version 12 numbers and asked for trades that follow a plan and look fair to the other manager. Three parts shipped together.

**The season plan**
* Every cat has a role. Locks are 3PM, STL and TO. The build pool is PTS, REB and AST, and any two of them finish the plan. FT% is a bonus cat and counts 65 percent. FG% is low and counts half. BLK is the punt
* A lock holds while you win it 60 percent of the time and are favored against at least 7 of the 9 other teams. Anything above that floor is room a trade may spend
* The punt is frozen at today's chance, so no move is paid for adding blocks or blamed for losing them
* A new Season plan panel shows each cat's role, win chance, league rank, how many teams you are favored against and its room, plus a Plan check that says when something has drifted
* Routes to five. Each pair from the build pool is a route. The panel shows where each route stands, its best fair trade or pair of trades, what it can reach and its best pickup. The leading route is the one that ends closest to 60 percent in its cats after its best fair trade. Routes within a point of each other are tied and the bigger gain wins
* Once two build cats are on target that pair is guarded like the locks

**Trades**
* Your gain is the change in your chance to win five or more cats in an average week, counted the way the plan counts cats. The card also shows the real nine cat number
* Stays on plan. No guarded cat goes under its floor and the trade builds a route or at least leaves the build cats alone
* Pivots. A trade that gives up one guarded cat, or leans on a cat the plan counts low. Its gain is scored under the exact plan it would turn into, so the number on the card is the number you see after you adopt it. It shows only when that gain beats the best trade that stays on plan by 2 points or more. Make this my plan saves the new plan on that device and ranks everything again. The plan for every device is data/plan.json. A plan picked on a device is dropped by itself when that file's date or roles change, so the newest saved plan always wins. The trade behind a pivot you adopt stays pinned at the top of the list. A full rebuild shows only when the plan week is under 50 percent or two locks are at risk
* Looks fair replaces the old Yahoo value check and the yes percent. How they see a player blends what he really produced 40 percent, this league's draft spot 30, Josh's rank 20 and Yahoo's rank 10. Production is this season first, then last season, then the season before marked down. Age 32 or more and a season under 50 games are marked down too, and the card says why. The draft spot fades as games are played. A hot or cold last two weeks moves the value by up to 8 percent, carried over from the old value. A return date costs value by three quarters of the share of the rest of the season it takes away, so a player who is done for the year keeps a quarter
* The value curve never reaches zero and the gap is measured against at least 40 points of value, so two bench players can not read as a blowout. That was the fault behind the Jaquez and VanVleet offer, which no longer passes
* An offer may look at most 5 percent light to them. If they give a player clearly better than your best one in the deal, it must look at least 2 percent in their favor, and 10 percent when he is better by a quarter or more. An offer that hands them 45 percent more than they give is never made. Nothing asks that the trade helps their team. Their real change is shown to you only, and a trade that looks fair and makes them worse is tagged Steal
* Easy sell, Fair ask or Hard sell. A hard sell is marked down by half in the order and a fair ask by 15 percent
* Each card has How to sell it, What they will say, the next offer if they say no, and a short message to copy. Every talking point comes from real stat lines, league ranks or the draft. A real stat line means this season after 10 games or a last season of 20 games or more. A player whose numbers are rebuilt from an older season gets no stat sentence. A point that is not true for that deal is left out
* The one cat rule and the smaller trades box are gone. The plan replaces them
* Trade scoring runs in background workers, one for each core up to four, so the page stays free and the list arrives sooner. Without workers the same code runs on the page with pauses. Both give the same list

**Pickups**
* A hold is still 40 percent this week and 60 percent rest of season, and a stream is still this week alone
* The rest of season part now follows the plan. The week part uses the real scoreboard against that week's opponent, every cat included
* Each card says This week only or Helps the season, and names the build cats it lifts when the season really gets better with him

**News and ages in the daily scan**
* scan/fetch-news.js reads ESPN's injury feed and writes data/news.json with facts only. The scanning chat adds one line tags in its own words. ESPN's own sentences never go into the project
* A player ESPN lists as Out with a return date still ahead is counted as out until that date, and the games he is expected to play are packed into the days after it. Nothing else in the news moves a number
* scan/fetch-ages.js writes data/ages.json on Mondays
* News shows on pickup and trade cards, in the talking points, in the Plan check and in the scan summary

**Draft board**
* With the real league on the board, Your 9 cats now shows the same numbers as the Pickups and trades tab. Winning is 60 percent or more, losing is under 45 percent, the rest are toss ups. In a mock draft it stays a draft tool
* The Josh by team tab is hidden

**Numbers on the Oct 6 scan**
* Plan cats on target 3 of 5. Plan week 62 percent
* 9,813 fair offers scored and 860 kept. 14 listed on plan. No pivot beats the plan
* Top trade on plan is Jamal Murray and Josh Hart for Donovan Mitchell and Reed Sheppard, gain 4.5
* The average week reads 62 percent, up from 61, because return dates from the news now count for players on other teams

**Known limits**
* Every in season state was made up for testing. No real games exist yet
* How they see a player is a model of other managers, not a fact. It will be wrong for some managers
* ESPN return dates for long injuries are rough, and the numbers lean on them
* Tested in Chromium only. No real phone and no Safari

## How to fall back to version 12

* The v18 branch holds the site exactly as it was before version 13
* `git checkout v18 -- index.html draft-room.html josh-teams.html moves.js scan data/josh_cats.json README.md` then deploy
* data/news.json, data/ages.json and data/plan.json can stay. Version 12 does not read them

## Version 12 (branch v18), Oct 6 2026

Fixes for the bugs found in the independent audit of Oct 5. The full list with evidence is in audit_report_2026_10_05.md in the fantasy notes folder.

* Trades. Every offer that passes the market value check is now scored in full, with both teams' daily lineups set again. The old quick first pass is gone. It was off by more than its own cut lines and dropped most good trades before the full maths saw them
* Trades. The scoring pauses every 40 thousandths of a second so a slow phone still answers taps while it runs, and the smaller trades box only filters what is already scored. The full scoring takes longer than the old shortcut, a few seconds on a computer and roughly 10 to 20 seconds on a slow phone, measured with a slowed down browser and not on a real phone
* Trades. A two for one is credited only for what it adds beyond simply dropping your least useful player for a streamer, whoever the two outgoing players are. Without this the full scoring would fill the list with inflated two for ones
* Lineups. Players are seated best first by per game value, so a questionable star keeps his spot and is credited for the share of the time he is fit. When a starter sits, the best bench player who plays that day steps in, and only a spot that is still empty gets the waiver level fill in. Before, a questionable star was benched all day behind weaker healthy players
* Injury tags. A tag the code does not know now counts as questionable, never as healthy. Doubtful counts 25 percent
* Rest of season. The window stops on the last day of the fantasy playoffs, March 28. Before, the last two weeks counted games played after the season ends
* Pickups. The rest of season lift is worked out with your lineups set again for the new roster. With no adds left the list is scored for next week and says so, also late on Sunday when the list has already moved on by the clock. When the list is for next week and this week still has adds, the card says an add made before the week ends uses this week's count. A waiver date that has passed counts as cleared. A marked add counts against a week only when its day falls in that week, the same as a scanned add
* Board to engine. A move up the board can no longer read as fewer games for a player whose nine numbers sum below zero. The direction comes from the board value and the size from the nine numbers. A rank can lift the games share by 15 points at most, the same room it has to lower it, so Dejounte Murray moves from a 45 percent share to 60 and not to 93. This limit also applies to 15 players who were not part of the bug, Embiid and Markkanen among them. Version 11 gave them up to 93 percent of games. They now get fewer games and up to 15 percent more per game, which is closer to how they are really valued
* Josh calls. On a line blended from two seasons a call goes only as far as it takes to reach the number it points at, measured from last season. It never moves a cat further than the call itself and never against it, so a fluke the blend already removed is not removed twice. Kessler's steals stay at the blended 0.66. Before they were cut to 0.40. For 12 of the 15 calls on blended lines today the blend is already past the number the call points at, so the call changes nothing, and the card still quotes it
* Minutes. A blended line with a minutes number from Josh uses that number as its label. Without one the label still shows last season's minutes until the player has played this season, then his own minutes replace it without rescaling the line, and the usual check against the last two weeks runs from there. For these six players a minutes cut from opening night shows only through the normal blend with this season's games
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
