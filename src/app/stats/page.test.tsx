import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import Stats from "./page";

const source = readFileSync(
  resolve(process.cwd(), "src/app/stats/page.tsx"),
  "utf8",
);

function classNameStrings(code: string): string[] {
  const found: string[] = [];
  const re = /className=\{?[`"']([^`"']*)[`"']/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(code)) !== null) found.push(match[1]);
  return found;
}

describe("Stats route", () => {
  it("composes the design system around the feature (V2 D1)", () => {
    expect(typeof Stats).toBe("function");
    expect(source).toMatch(/PageShell/);
    expect(source).toMatch(/Container/);
    expect(source).toMatch(/<main>/);
    expect(source).toMatch(/<StatsPage \/>/);
  });

  it("holds no layout or spacing classes of its own", () => {
    expect(classNameStrings(source)).toEqual([]);
  });
});
