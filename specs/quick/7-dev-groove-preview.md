# 7 — Dev groove preview page

## What

* A page that only exists in dev mode, never deployed.
* Every groove in the catalogue is listenable from it.
* The lick variations play in time to the running groove.
* Grooves are ordered by date, so upcoming ones are visible before their day.
* The point is to verify upcoming grooves and catch anything that needs changing.

## Done when

* The page is reachable under `next dev` and absent from a production build.
* The page lists every groove in the catalogue, ordered by date, with each date shown.
* Picking a groove and hitting play sounds that groove.
* Each lick variation for a mode can be triggered over the running groove and lands in time with it.
