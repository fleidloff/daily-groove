import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { LANGUAGE_STORAGE_KEY } from "./language";
import { LanguageProvider } from "./LanguageContext";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

import { grooveByUuid, isTodaysGroove } from "@/features/daily-groove";
import type { Groove } from "@/features/daily-groove";
import Home from "./page";
import GrooveNotFound from "./groove/not-found";
import SharedGroovePage from "./groove/[uuid]/page";

const source = readFileSync(
  resolve(process.cwd(), "src/app/layout.tsx"),
  "utf8",
);

describe("layout.tsx mounts the language provider and stays on the server", () => {
  it("is not a client component (R7a, AC6b)", () => {
    expect(source).not.toMatch(/^\s*['"]use client['"]/);
  });

  it("still exports its metadata (R7a, AC6b)", () => {
    expect(source).toMatch(/export const metadata\s*:\s*Metadata/);
  });

  it("imports the provider from its sibling module (R7a)", () => {
    expect(source).toMatch(
      /import\s*\{[^}]*\bLanguageProvider\b[^}]*\}\s*from\s*["']\.\/LanguageContext["']/,
    );
  });

  it("wraps children, not something narrower (R7a, R8)", () => {
    expect(source).toMatch(
      /<LanguageProvider>\s*\{children\}\s*<\/LanguageProvider>/,
    );
  });
});

const APP = resolve(process.cwd(), "src/app");

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

describe("one mount covers every entry route", () => {
  it("has exactly one root layout (R8)", () => {
    const layouts = filesUnder(APP)
      .filter((path) => path.endsWith("layout.tsx"))
      .map((path) => relative(process.cwd(), path));

    expect(layouts).toEqual(["src/app/layout.tsx"]);
  });

  it.each([
    "src/app/page.tsx",
    "src/app/groove/[uuid]/page.tsx",
    "src/app/groove/not-found.tsx",
  ])("%s mounts no provider of its own (R8)", (file) => {
    const route = readFileSync(resolve(process.cwd(), file), "utf8");
    expect(route).not.toMatch(/LanguageProvider/);
  });
});

async function renderUnderProvider(node: ReactNode) {
  const result = render(<LanguageProvider>{node}</LanguageProvider>);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  return result;
}

const CATALOGUE_PATH = "scripts/grooves/catalogue.json";

const playableUuid: string = (() => {
  const uuids: string[] = (
    JSON.parse(
      readFileSync(resolve(process.cwd(), CATALOGUE_PATH), "utf8"),
    ) as Array<{ uuid: string }>
  ).map((entry) => entry.uuid);

  const groove = uuids
    .map((uuid) => grooveByUuid(uuid))
    .find(
      (candidate): candidate is Groove =>
        candidate !== undefined && !isTodaysGroove(candidate, new Date()),
    );

  if (!groove) throw new Error("no shareable groove in the catalogue");
  return groove.uuid;
})();

async function sharedGroove(): Promise<ReactElement> {
  return (await SharedGroovePage({
    params: Promise.resolve({ uuid: playableUuid }),
  })) as ReactElement;
}

describe("every entry route leaves en behind", () => {
  it("the daily puzzle (R8, AC7)", async () => {
    await renderUnderProvider(<Home />);
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en");
  });

  it("the not-found route (R8, AC7)", async () => {
    await renderUnderProvider(<GrooveNotFound />);
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en");
  });

  it("the shared-groove route (R8, AC7)", async () => {
    await renderUnderProvider(await sharedGroove());
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en");
  });
});

describe("a route still renders when storage is unusable (R6, AC5)", () => {
  function withThrowingStorage(run: () => Promise<void>): Promise<void> {
    const descriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "localStorage",
    );
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("denied", "SecurityError");
      },
    });
    return run().finally(() => {
      if (descriptor === undefined) delete (globalThis as { localStorage?: unknown }).localStorage;
      else Object.defineProperty(globalThis, "localStorage", descriptor);
    });
  }

  it("the daily puzzle renders and nothing is thrown", async () => {
    await withThrowingStorage(async () => {
      const { container } = await renderUnderProvider(<Home />);
      expect(container.textContent).not.toBe("");
    });
  });

  it("the not-found route renders and nothing is thrown", async () => {
    await withThrowingStorage(async () => {
      const { container } = await renderUnderProvider(<GrooveNotFound />);
      expect(container.textContent).not.toBe("");
    });
  });
});

const STORED = [
  ["absent", null],
  ["en", "en"],
  ["de", "de"],
] as const;

type Rendering = { text: string; labels: (string | null)[] };

function capture(container: HTMLElement): Rendering {
  return {
    text: container.textContent ?? "",
    labels: [...container.querySelectorAll("[aria-label]")].map((el) =>
      el.getAttribute("aria-label"),
    ),
  };
}

async function renderingsOf(node: () => ReactNode): Promise<Rendering[]> {
  const captured: Rendering[] = [];
  for (const [, stored] of STORED) {
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    if (stored !== null) localStorage.setItem(LANGUAGE_STORAGE_KEY, stored);

    const { container, unmount } = await renderUnderProvider(node());
    captured.push(capture(container));
    unmount();
  }
  return captured;
}

describe("nothing a player can see depends on the stored value", () => {
  it("the daily puzzle renders identically in all three states (R10, AC8)", async () => {
    const [absent, english, corrupt] = await renderingsOf(() => <Home />);

    expect(english).toEqual(absent);
    expect(corrupt).toEqual(absent);
    expect(absent.text.length).toBeGreaterThan(0);
  });

  it("the not-found route renders identically in all three states (R10, AC8)", async () => {
    const [absent, english, corrupt] = await renderingsOf(() => (
      <GrooveNotFound />
    ));

    expect(english).toEqual(absent);
    expect(corrupt).toEqual(absent);
    expect(absent.text.length).toBeGreaterThan(0);
  });
});
