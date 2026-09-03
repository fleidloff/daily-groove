import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { act, render, screen } from "@testing-library/react";
import Home from "./page";
import { branding } from "@/lib/snippets";
const { appName: APP_NAME } = branding;

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

    expect(container.querySelector(".min-h-screen")).toBeInTheDocument();
    expect(container.querySelector(".max-w-\\[1220px\\]")).toBeInTheDocument();

    const main = screen.getByRole("main");
    expect(main).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: APP_NAME }),
    ).toBeInTheDocument();

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
