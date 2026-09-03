import { describe, it, expect } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { Answer, Attempt, DailyResult } from "../types";
import { createLocalStore } from "../lib/persistence/storage";
import { isoDate, parseIsoDate } from "../lib/puzzle/selectGroove";
import { useProgress } from "./useProgress";

describe("useProgress + createLocalStore (real storage)", () => {
  const ANSWER: Answer = { root: "C", flavour: "Minor" };
  const GROOVE_ID = "groove-05";

  const miss: Attempt = {
    root: "C",
    flavour: "Dorian",
    correct: false,
    rootMatched: true,
    flavourMatched: false,
  };

  it("an attempt recorded mid-game survives a remount with a fresh store (R2, R3, AC1)", async () => {
    const today = isoDate(new Date());

    const firstStore = createLocalStore();
    const first = renderHook(() => useProgress(today, firstStore));
    await waitFor(() => expect(first.result.current.loaded).toBe(true));
    await act(async () => {
      await first.result.current.recordAttempt({
        answer: ANSWER,
        grooveId: GROOVE_ID,
        attempts: [miss],
        solved: false,
      });
    });
    first.unmount();

    const secondStore = createLocalStore();
    const second = renderHook(() => useProgress(today, secondStore));
    await waitFor(() => expect(second.result.current.loaded).toBe(true));

    const expected: DailyResult = {
      date: today,
      answer: ANSWER,
      attempts: [miss],
      solved: false,
      grooveId: GROOVE_ID,
    };
    expect(second.result.current.todayResult).toEqual(expected);
    expect(second.result.current.streak).toBe(0);
    await expect(secondStore.getAll()).resolves.toEqual([expected]);
  });

  it("the groove id survives the reload with the rest of the record (E5 R7, R8, AC7, AC9)", async () => {
    const today = isoDate(new Date());

    const firstStore = createLocalStore();
    const first = renderHook(() => useProgress(today, firstStore));
    await waitFor(() => expect(first.result.current.loaded).toBe(true));
    await act(async () => {
      await first.result.current.recordAttempt({
        answer: ANSWER,
        grooveId: "groove-09",
        attempts: [miss],
        solved: false,
      });
    });
    first.unmount();

    const secondStore = createLocalStore();
    const second = renderHook(() => useProgress(today, secondStore));
    await waitFor(() => expect(second.result.current.loaded).toBe(true));

    expect(second.result.current.todayResult?.grooveId).toBe("groove-09");
    expect((await secondStore.getAll()).map((r) => r.grooveId)).toEqual([
      "groove-09",
    ]);
    expect(second.result.current.todayResult?.attempts).toEqual([miss]);
  });

  it("a record already in storage without a groove id still loads (E5 R8, AC8)", async () => {
    const today = isoDate(new Date());
    localStorage.setItem(
      "daily-groove:v2:results",
      JSON.stringify({
        version: 2,
        byDate: {
          [today]: {
            date: today,
            answer: ANSWER,
            attempts: [miss],
            solved: false,
          },
        },
      }),
    );

    const store = createLocalStore();
    const { result } = renderHook(() => useProgress(today, store));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(result.current.todayResult).toEqual({
      date: today,
      answer: ANSWER,
      attempts: [miss],
      solved: false,
    });
    expect(result.current.todayResult?.grooveId).toBeUndefined();
  });

  it("a solved day survives the reload and counts toward the streak (R4, R7)", async () => {
    const today = isoDate(new Date());
    const winner: Attempt = {
      root: "C",
      flavour: "Minor",
      correct: true,
      rootMatched: true,
      flavourMatched: true,
    };

    const firstStore = createLocalStore();
    const first = renderHook(() => useProgress(today, firstStore));
    await waitFor(() => expect(first.result.current.loaded).toBe(true));
    await act(async () => {
      await first.result.current.recordAttempt({
        answer: ANSWER,
        grooveId: GROOVE_ID,
        attempts: [miss],
        solved: false,
      });
    });
    await act(async () => {
      await first.result.current.recordAttempt({
        answer: ANSWER,
        grooveId: GROOVE_ID,
        attempts: [miss, winner],
        solved: true,
      });
    });
    first.unmount();

    const secondStore = createLocalStore();
    const second = renderHook(() => useProgress(today, secondStore));
    await waitFor(() => expect(second.result.current.loaded).toBe(true));

    expect(second.result.current.todayResult?.solved).toBe(true);
    expect(second.result.current.todayResult?.attempts).toEqual([miss, winner]);
    expect(second.result.current.streak).toBe(1);
  });

  it("brings five attempts back in order after a reload, flags intact (F19 E1 R3, AC4)", async () => {
    const today = isoDate(new Date());
    const spent: Attempt[] = [
      {
        root: "D",
        flavour: "Dorian",
        correct: false,
        rootMatched: false,
        flavourMatched: true,
      },
      {
        root: "C",
        flavour: "Lydian",
        correct: false,
        rootMatched: true,
        flavourMatched: false,
      },
      {
        root: "A",
        flavour: "Aeolian",
        correct: false,
        rootMatched: false,
        flavourMatched: false,
      },
      {
        root: "G",
        flavour: "Dorian",
        correct: false,
        rootMatched: false,
        flavourMatched: false,
      },
      {
        root: "C",
        flavour: "Minor",
        correct: true,
        rootMatched: true,
        flavourMatched: true,
      },
    ];

    const firstStore = createLocalStore();
    const first = renderHook(() => useProgress(today, firstStore));
    await waitFor(() => expect(first.result.current.loaded).toBe(true));
    for (let n = 1; n <= spent.length; n += 1) {
      const soFar = spent.slice(0, n);
      await act(async () => {
        await first.result.current.recordAttempt({
          answer: ANSWER,
          grooveId: GROOVE_ID,
          attempts: soFar,
          solved: soFar[soFar.length - 1].correct,
        });
      });
    }
    first.unmount();

    const secondStore = createLocalStore();
    const second = renderHook(() => useProgress(today, secondStore));
    await waitFor(() => expect(second.result.current.loaded).toBe(true));

    expect(second.result.current.todayResult?.attempts).toEqual(spent);
    expect(second.result.current.todayResult?.solved).toBe(true);
    expect(second.result.current.todayResult?.revealed).toBeUndefined();
    expect((await secondStore.get(today))?.attempts).toEqual(spent);
  });

  it("a solve on the seventh guess moves the streak by one (F19 E1 R4, AC5)", async () => {
    const today = isoDate(new Date());
    const yesterdayDate = parseIsoDate(today);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = isoDate(yesterdayDate);

    const winner: Attempt = {
      root: "C",
      flavour: "Minor",
      correct: true,
      rootMatched: true,
      flavourMatched: true,
    };
    const sevenGuesses: Attempt[] = [
      miss,
      miss,
      miss,
      miss,
      miss,
      miss,
      winner,
    ];

    const seedStore = createLocalStore();
    await seedStore.save({
      date: yesterday,
      answer: ANSWER,
      attempts: [winner],
      solved: true,
      grooveId: "groove-04",
    });

    const firstStore = createLocalStore();
    const first = renderHook(() => useProgress(today, firstStore));
    await waitFor(() => expect(first.result.current.loaded).toBe(true));
    expect(first.result.current.streak).toBe(1);

    await act(async () => {
      await first.result.current.recordAttempt({
        answer: ANSWER,
        grooveId: GROOVE_ID,
        attempts: sevenGuesses,
        solved: true,
      });
    });
    first.unmount();

    const secondStore = createLocalStore();
    const second = renderHook(() => useProgress(today, secondStore));
    await waitFor(() => expect(second.result.current.loaded).toBe(true));

    expect(second.result.current.todayResult?.solved).toBe(true);
    expect(second.result.current.todayResult?.attempts).toHaveLength(7);
    expect(second.result.current.streak).toBe(2);
  });

  it("stores an attempt with exactly its five fields (F19 E1 R3)", async () => {
    const today = isoDate(new Date());

    const firstStore = createLocalStore();
    const first = renderHook(() => useProgress(today, firstStore));
    await waitFor(() => expect(first.result.current.loaded).toBe(true));
    await act(async () => {
      await first.result.current.recordAttempt({
        answer: ANSWER,
        grooveId: GROOVE_ID,
        attempts: [miss],
        solved: false,
      });
    });
    first.unmount();

    const secondStore = createLocalStore();
    const second = renderHook(() => useProgress(today, secondStore));
    await waitFor(() => expect(second.result.current.loaded).toBe(true));

    const loaded = second.result.current.todayResult;
    expect(Object.keys(loaded!.attempts[0]).sort()).toEqual([
      "correct",
      "flavour",
      "flavourMatched",
      "root",
      "rootMatched",
    ]);
    expect(Object.keys(loaded!).sort()).toEqual([
      "answer",
      "attempts",
      "date",
      "grooveId",
      "solved",
    ]);
  });
});
