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
    pause: vi.fn(),
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

    // The brand mark and the page title come from the feature's header.
    expect(screen.getByText("daily-groove")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Today's groove" }),
    ).toBeInTheDocument();
    // Play control present.
    expect(
      screen.getByRole("button", { name: "Play the loop" }),
    ).toBeInTheDocument();

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
    expect(screen.getByText(String(groove.bpm))).toBeInTheDocument();
    expect(screen.getByText("BPM")).toBeInTheDocument();
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
