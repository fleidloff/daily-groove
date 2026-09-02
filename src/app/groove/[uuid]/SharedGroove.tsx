"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { GroovePuzzle, isTodaysGroove, type Groove } from "@/features/daily-groove";
import { Text } from "@/components/typography/Text";

export function SharedGroove({ groove }: { groove: Groove }) {
  const router = useRouter();

  const leavingForToday = useSyncExternalStore(
    () => () => {},
    () => isTodaysGroove(groove, new Date()),
    () => false,
  );

  useEffect(() => {
    if (!leavingForToday) return;
    router.replace("/");
  }, [leavingForToday, router]);

  if (leavingForToday) {
    return <Text tone="muted">Taking you to today&apos;s groove…</Text>;
  }

  return <GroovePuzzle groove={groove} mode="shared" />;
}
