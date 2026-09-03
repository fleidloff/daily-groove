import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import NotFound from "./not-found";
import { routes } from "@/lib/snippets";

describe("the not-found page a dead share link lands on", () => {
  it("says the groove could not be found", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("heading", { name: routes.notFoundTitle }),
    ).toBeInTheDocument();
    expect(screen.getByText(routes.notFoundBody)).toBeInTheDocument();
  });

  it("offers exactly one way back, and it is today's puzzle", () => {
    render(<NotFound />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/");
  });

  it("holds no puzzle, no attempt row, no answer and no audio", () => {
    const { container } = render(<NotFound />);

    expect(screen.queryAllByRole("button")).toEqual([]);
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(container.querySelector("audio")).toBeNull();
  });
});

const source = readFileSync(
  resolve(process.cwd(), "src/app/groove/not-found.tsx"),
  "utf8",
);

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
