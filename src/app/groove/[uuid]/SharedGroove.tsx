"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { GroovePuzzle, isTodaysGroove, type Groove } from "@/features/daily-groove";
import { Text } from "@/components/typography/Text";

/**
 * A shared groove, or a redirect to today's puzzle when it turns out to be the
 * same groove.
 *
 * The redirect lives here, in the route, rather than inside the feature: where
 * to send the player is a routing decision, and the puzzle's job is to play a
 * groove it is handed. The feature only answers which groove belongs to which
 * day, through `isTodaysGroove`.
 *
 * It has to be a client component, and that is the whole reason this file
 * exists beside a server `page.tsx`. The daily pick is the *viewer's* calendar
 * day, so only the browser can say whether this link points at today: a server
 * comparison would redirect a player whose midnight has not arrived, fail to
 * redirect one whose has, and bake a day into a cached response besides. The
 * server page keeps the `notFound()` that makes an unknown uuid an honest 404;
 * this decides the one thing the server cannot.
 *
 * Why redirect at all: a shared page for today's own groove offers nothing. It
 * would be the same groove, played as practice, recording nothing — so a player
 * who solved it would have spent the day's puzzle on a copy that never counted,
 * which is the failure the shared framing exists to prevent rather than a case
 * for it.
 */
export function SharedGroove({ groove }: { groove: Groove }) {
  const router = useRouter();

  /**
   * Read through the client snapshot only. The server snapshot is always
   * `false`, so the server renders the shared puzzle and the browser — the only
   * side that knows what day it is where the player is — takes over after
   * hydration, with no mismatch. It is the same seam `GroovePuzzle` already uses
   * to resolve today's groove.
   */
  const leavingForToday = useSyncExternalStore(
    () => () => {},
    () => isTodaysGroove(groove, new Date()),
    () => false,
  );

  useEffect(() => {
    if (!leavingForToday) return;
    // `replace`, not `push`: the shared URL was never a place the player should
    // end up, so Back must not bounce them into it again.
    router.replace("/");
  }, [leavingForToday, router]);

  // Said plainly rather than left blank, because the player pressed a link and
  // is owed a reason they are somewhere else. No puzzle is mounted, so nothing
  // is fetched and nothing sounds on the way through.
  if (leavingForToday) {
    return <Text tone="muted">Taking you to today&apos;s groove…</Text>;
  }

  return <GroovePuzzle groove={groove} mode="shared" />;
}
