"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { GroovePuzzle, isTodaysGroove, type Groove } from "@/features/daily-groove";
import { Text } from "@/components/typography/Text";
import { routes } from "@/lib/snippets";

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
    return <Text tone="muted">{routes.redirecting}</Text>;
  }

  return <GroovePuzzle groove={groove} mode="shared" />;
}
