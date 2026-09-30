# Nine Cat War Room

Live draft board for the Ball Lovers Yahoo league (10 teams, head to head 9 cat, 14 rounds, snake).

Live site at https://ninecatwarroom.vercel.app

## Files

* index.html is the full website that runs on Vercel. It also works if you just open it in a browser.
* draft-room.html is the same board in the format used for the Claude artifact.

## Version 1 (branch v1)

* Stats from the 2025 26 season, injury news as of Sept 29, 2026
* Rankings leaned toward Josh Lloyd's 9 cat top 25 and round by round comments
* Playoff schedule flags for weeks 19 to 21, punt guard, late round upside mode
* Compact board that fits without sideways scrolling

## How to fall back to version 1

1. On GitHub, switch to the v1 branch and download index.html. The v1 branch is never changed, so it always holds this version.
2. Put it in the Vercel project folder and run `vercel deploy --prod`.
3. Or, in the Vercel dashboard, open Deployments, find the deployment from Sept 29, 2026 and use Instant Rollback.
