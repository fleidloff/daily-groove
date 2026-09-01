import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import NotFound from "./not-found";

/**
 * The not-found page's own tests.
 *
 * Next renders `src/app/groove/not-found.tsx` for the `notFound()` thrown in
 * `src/app/groove/[uuid]/page.tsx`, so this page is what a dead share link
 * shows. It has no puzzle, no audio and no groove to know about, and the
 * assertions below are as much about what it does *not* hold as about what it
 * says (F12 E3 R8, R9, R10, R12, AC6, AC7, AC9).
 */
describe("the not-found page a dead share link lands on", () => {
  it("says the groove could not be found", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("heading", { name: /not found/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/couldn't find the groove/i)).toBeInTheDocument();
  });

  it("offers exactly one way back, and it is today's puzzle", () => {
    render(<NotFound />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/");
  });

  it("holds no puzzle, no attempt row, no answer and no audio", () => {
    const { container } = render(<NotFound />);

    // No play control, no root or mode chips, no check control: the page has no
    // controls at all, only the link out.
    expect(screen.queryAllByRole("button")).toEqual([]);
    // No attempt dots and no transport track.
    expect(screen.queryByRole("progressbar")).toBeNull();
    // No answer panel — SolvedPanel announces itself as a status region.
    expect(screen.queryByRole("status")).toBeNull();
    expect(container.querySelector("audio")).toBeNull();
  });
});

const source = readFileSync(
  resolve(process.cwd(), "src/app/groove/not-found.tsx"),
  "utf8",
);

/** Every module specifier the file imports from, as written. */
function importSpecifiers(code: string): string[] {
  return [...code.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
}

describe("not-found.tsx is composition only", () => {
  it("imports nothing from a feature", () => {
    const fromFeatures = importSpecifiers(source).filter((specifier) =>
      specifier.includes("features"),
    );
    expect(fromFeatures).toEqual([]);
  });

  it("composes the page out of design-system primitives", () => {
    expect(source).toMatch(/PageShell/);
    expect(source).toMatch(/Container/);
  });

  it("holds no class of its own", () => {
    expect(source).not.toMatch(/className/);
  });
});
