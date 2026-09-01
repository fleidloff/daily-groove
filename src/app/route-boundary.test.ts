import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The route is the feature's only inbound reference, so it is the one place a
 * deep import can silently reappear. `docs/coding-guidelines.md` says a feature is
 * reached through its `index.ts` and nothing else; this reads the route's own
 * source — the component and its test — and holds it to that (R3, AC4).
 *
 * Source-reading rather than import-graph analysis on purpose: a `vi.mock` of a
 * feature path is not an import at all, and it is exactly as much of a leak.
 */
const ROUTE_FILES = [
  "src/app/page.tsx",
  "src/app/page.test.tsx",
  // Feature-12's shared route: the second inbound reference the feature has, and
  // the one most tempting to test by mocking the puzzle out (E1 R15, R17, AC12).
  "src/app/groove/[uuid]/page.tsx",
  "src/app/groove/[uuid]/page.test.tsx",
  // The client half of that route: it decides whether a shared link points at
  // today's own groove, and reaches the feature for the answer.
  "src/app/groove/[uuid]/SharedGroove.tsx",
  "src/app/groove/[uuid]/SharedGroove.test.tsx",
  // The not-found Next renders for that route's `notFound()`. It should name no
  // feature specifier at all (E3 R12, AC8).
  "src/app/groove/not-found.tsx",
  "src/app/groove/not-found.test.tsx",
];

const PUBLIC_SURFACE = "@/features/daily-groove";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

/** Every `@/features/daily-groove…` specifier a file names, as written. */
function featureSpecifiers(code: string): string[] {
  return [
    ...code.matchAll(/["'](@\/features\/daily-groove[^"']*)["']/g),
  ].map((match) => match[1]);
}

/** Every module path a `vi.mock(…)` call in a file names. */
function mockedPaths(code: string): string[] {
  return [...code.matchAll(/vi\.mock\(\s*["']([^"']+)["']/g)].map(
    (match) => match[1],
  );
}

describe("the route reaches the feature only through its public surface", () => {
  it.each(ROUTE_FILES)(
    "%s names no specifier past the feature's index (R3, AC4)",
    (file) => {
      const deep = featureSpecifiers(read(file)).filter(
        (specifier) => specifier !== PUBLIC_SURFACE,
      );
      expect(deep).toEqual([]);
    },
  );

  it.each(ROUTE_FILES)("%s mocks nothing inside the feature (R3, AC4)", (file) => {
    const inside = mockedPaths(read(file)).filter((path) =>
      path.includes("features/daily-groove"),
    );
    expect(inside).toEqual([]);
  });
});
