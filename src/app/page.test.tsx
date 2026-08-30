import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "./page";
import { selectGrooveForDate } from "@/features/daily-groove/lib/selectGroove";
import {
  flavourOptions,
  ROOTS,
} from "@/features/daily-groove/lib/music";
import { GROOVES } from "@/features/daily-groove/lib/grooves.generated";

// Audio is mocked so rendering never touches jsdom media playback.
vi.mock("@/features/daily-groove/lib/audio", () => ({
  createAudioPlayer: () => ({
    play: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    getPosition: vi.fn(() => 0),
    isPlaying: vi.fn(() => false),
    subscribe: vi.fn(() => () => {}),
    dispose: vi.fn(),
  }),
}));

/**
 * The puzzle reads the day's saved record through a promise-returning store
 * before it paints a game, so every route test lets that settle first. Storage
 * itself is real here (the in-memory shim from vitest.setup.ts), which is what
 * makes this a route-level integration test rather than a mocked one.
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the designed shell with a play control and the guessing card", async () => {
    await renderHome();

    // The wordmark cluster is gone; the date and the title lead the row (E1 AC1).
    expect(screen.queryByText("daily-groove")).toBeNull();
    expect(
      screen.getByRole("heading", { level: 1, name: "Daily Groove" }),
    ).toBeInTheDocument();
    // The play control leads the groove card: full width, glyph and words, with
    // an accessible name that states the action (E2 R1, R4a, AC3a, AC4).
    const play = screen.getByRole("button", { name: "Play the loop" });
    expect(play).toBeInTheDocument();
    expect(play).toHaveTextContent("\u25b6 Play the groove");
    expect(play).toHaveClass("w-full");

    // The player names a root and a flavour: twelve chips and four (AC1).
    const roots = screen.getByRole("radiogroup", { name: "Root" });
    const flavours = screen.getByRole("radiogroup", { name: "Flavour" });
    expect(within(roots).getAllByRole("button")).toHaveLength(12);
    expect(within(flavours).getAllByRole("button")).toHaveLength(4);

    // The retired subset-guessing model is gone from the route.
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("shows today's groove card and its transport", async () => {
    await renderHome();

    const groove = selectGrooveForDate(new Date(), GROOVES);
    expect(
      screen.getByRole("heading", { name: groove.name }),
    ).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("shows the streak badge alongside the puzzle (AC6)", async () => {
    await renderHome();

    // Streak badge is present (empty state on first run).
    expect(screen.getByLabelText(/current streak/i)).toBeInTheDocument();
  });

  it("offers today's deterministic flavour options, including the answer", async () => {
    await renderHome();

    const today = new Date();
    const groove = selectGrooveForDate(today, GROOVES);
    const expected = flavourOptions(today, groove);
    const flavours = screen.getByRole("radiogroup", { name: "Flavour" });

    expect(
      within(flavours)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(expected);
    expect(expected).toContain(groove.flavour);
  });

  it("offers all twelve roots, in the design's order", async () => {
    await renderHome();

    const roots = screen.getByRole("radiogroup", { name: "Root" });
    expect(
      within(roots)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(ROOTS);
  });

  it("names the chosen pair on the check control once both are picked (AC6)", async () => {
    const user = userEvent.setup();
    await renderHome();

    const control = () =>
      screen.getByRole("button", { name: /^(Pick a root|Check |Solved$)/ });

    expect(control()).toHaveAccessibleName("Pick a root and a flavour");
    expect(control()).toBeDisabled();

    const roots = screen.getByRole("radiogroup", { name: "Root" });
    const flavours = screen.getByRole("radiogroup", { name: "Flavour" });
    await user.click(within(roots).getByRole("button", { name: "G" }));
    const firstFlavour = within(flavours).getAllByRole("button")[0];
    await user.click(firstFlavour);

    expect(control()).toHaveAccessibleName(
      `Check G ${firstFlavour.textContent}`,
    );
    expect(control()).toBeEnabled();
  });

  // --- Epics 3-5: the route composes the whole day ---------------------------

  it("opens with three unspent attempt dots and the opening guidance", async () => {
    await renderHome();

    const dots = Array.from(
      document.querySelectorAll("[data-dot-state]"),
    ).map((el) => el.getAttribute("data-dot-state"));
    expect(dots).toEqual(["unspent", "unspent", "unspent"]);
    expect(screen.getByRole("status")).toHaveTextContent(/feels like rest/i);
    expect(
      screen.queryByRole("complementary", { name: "A nudge" }),
    ).not.toBeInTheDocument();
  });

  it("reveals neither the solved panel nor the day's changes before the solve", async () => {
    const { container } = await renderHome();

    const groove = selectGrooveForDate(new Date(), GROOVES);
    expect(container.textContent).not.toContain(groove.chord);
    expect(container.textContent).not.toContain(groove.progression);
  });

  it("shows the archive's empty state on a first visit", async () => {
    await renderHome();

    expect(screen.getByText(/grooves you.{0,3}ve played/i)).toBeInTheDocument();
    expect(
      screen.getByText(/no grooves behind you yet/i),
    ).toBeInTheDocument();
  });

  // --- Epic 5: replaying a played groove from the route ----------------------

  const STORAGE_KEY = "daily-groove:v2:results";

  /** An ISO day N days back, as `lib/selectGroove` formats one. */
  function daysAgo(n: number): string {
    const date = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  }

  /** Two past days already in real storage, each remembering its groove. */
  function seedTwoPastDays() {
    const record = (date: string, grooveId: string) => ({
      date,
      answer: { root: "G", flavour: "Dorian" },
      attempts: [
        {
          root: "D",
          flavour: "Lydian",
          correct: false,
          rootMatched: false,
          flavourMatched: false,
        },
      ],
      solved: false,
      grooveId,
    });

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        byDate: {
          [daysAgo(1)]: record(daysAgo(1), "groove-02"),
          [daysAgo(2)]: record(daysAgo(2), "groove-03"),
        },
      }),
    );
  }

  const archiveCards = () => {
    const section = screen
      .getByText(/grooves you.{0,3}ve played/i)
      .closest("section") as HTMLElement;
    const grid = section.querySelector('[class*="grid-cols"]');
    return grid ? (Array.from(grid.children) as HTMLElement[]) : [];
  };

  /** Every control on the page currently offering to stop. */
  const soundingControls = () =>
    screen
      .getAllByRole("button")
      .filter((b) => /^Stop\b/.test(b.getAttribute("aria-label") ?? ""));

  it("puts a play control on every card in the played row (E5 R1, R2, AC1, AC6)", async () => {
    seedTwoPastDays();
    await renderHome();

    const cards = archiveCards();
    expect(cards).toHaveLength(2);

    const names = cards.map((card) =>
      within(card).getByRole("button").getAttribute("aria-label"),
    );
    // One control per card, each naming its own day and each live.
    expect(names.every((name) => /^Play .+'s groove$/.test(name ?? ""))).toBe(
      true,
    );
    expect(new Set(names).size).toBe(2);
    for (const card of cards) {
      expect(within(card).getByRole("button")).toBeEnabled();
    }
  });

  it("leaves exactly one groove sounding as the row is played through (E5 R3, R5, AC4, AC5)", async () => {
    seedTwoPastDays();
    const user = userEvent.setup();
    await renderHome();

    const controlIn = (index: number) =>
      within(archiveCards()[index]).getByRole("button");

    // Nothing sounds until something is pressed.
    expect(soundingControls()).toEqual([]);

    // Press the first card: it alone shows the sounding affordance.
    await user.click(controlIn(0));
    expect(soundingControls()).toHaveLength(1);
    expect(soundingControls()[0]).toBe(controlIn(0));

    // Press the second: the first hands over rather than joining it (AC4).
    await user.click(controlIn(1));
    expect(soundingControls()).toHaveLength(1);
    expect(soundingControls()[0]).toBe(controlIn(1));
    expect(controlIn(0).getAttribute("aria-label")).toMatch(/^Play /);

    // Today's full-width control takes it back off the card (AC3).
    await user.click(screen.getByRole("button", { name: "Play the loop" }));
    expect(soundingControls().map((b) => b.getAttribute("aria-label"))).toEqual([
      "Stop the loop",
    ]);
  });

  it("waits for the day's saved record rather than flashing a fresh game", async () => {
    // Rendered but not settled: the store read has not resolved yet.
    render(<Home />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("radiogroup", { name: "Root" }),
    ).not.toBeInTheDocument();
    expect(document.querySelectorAll("[data-dot-state]")).toHaveLength(0);
  });
});

// --- Step D7 / AC10: the route composes, it does not lay out. -----------------

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
