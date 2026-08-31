import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { act, render, screen } from "@testing-library/react";
import Home from "./page";
import { APP_NAME } from "@/lib/branding";

/**
 * The route's own tests, and nothing else.
 *
 * Feature behaviour is tested inside the feature, beside the code that owns it —
 * this file asserts only what `page.tsx` itself does: compose the design system
 * around the feature's public surface. It reaches the feature only through
 * `@/features/daily-groove`, which `route-boundary.test.ts` enforces by reading
 * this file's source (E3 R3, AC4).
 *
 * No audio mock is needed. The page transport builds its player lazily on the
 * first press, so rendering the route never touches jsdom media playback.
 */
async function renderHome() {
  const result = render(<Home />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  return result;
}

describe("Home route", () => {
  it("composes the design system around the feature", async () => {
    const { container } = await renderHome();

    // PageShell supplies the page frame and Container the measure; the route
    // itself decides neither (E1 AC7, E3 R3).
    expect(container.querySelector(".min-h-screen")).toBeInTheDocument();
    expect(container.querySelector(".max-w-\\[1220px\\]")).toBeInTheDocument();

    // The feature renders inside the route's <main>, through its index only.
    const main = screen.getByRole("main");
    expect(main).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: APP_NAME }),
    ).toBeInTheDocument();

    // The retired wordmark cluster is gone from the shell (E1 AC1).
    expect(screen.queryByText("daily-groove")).toBeNull();
  });
});

const source = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");

function classNameStrings(code: string): string[] {
  const found: string[] = [];
  const re = /className=\{?[`"']([^`"']*)[`"']/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(code)) !== null) found.push(match[1]);
  return found;
}

const LAYOUT_UTILITIES: Array<[string, RegExp]> = [
  ["flex", /(^|[\s:])flex(-|$|\s)/],
  ["grid", /(^|[\s:])grid(-|$|\s)/],
  ["gap", /(^|[\s:])gap(-x|-y)?-/],
  ["padding", /(^|[\s:])p[xytblrse]?-/],
  ["margin", /(^|[\s:])-?m[xytblrse]?-/],
  ["max-width", /(^|[\s:])max-w-/],
  ["width", /(^|[\s:])w-/],
  ["height", /(^|[\s:])(min-|max-)?h-/],
  ["alignment", /(^|[\s:])(items|justify|self|content|place)-/],
  ["space-between", /(^|[\s:])space-[xy]-/],
];

describe("page.tsx holds no layout or spacing classes", () => {
  it.each(LAYOUT_UTILITIES)("uses no %s utility", (_name, pattern) => {
    const offenders = classNameStrings(source).filter((value) =>
      pattern.test(value),
    );
    expect(offenders).toEqual([]);
  });

  it("composes the page out of design-system primitives", () => {
    expect(source).toMatch(/PageShell/);
    expect(source).toMatch(/Container/);
  });
});
