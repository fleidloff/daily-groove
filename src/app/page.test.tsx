import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "./page";
import {
  selectGrooveForDate,
  isoDate,
} from "@/features/daily-groove/lib/selectGroove";
import { buildOptions } from "@/features/daily-groove/lib/options";
import { GROOVES, SCALE_POOL } from "@/features/daily-groove/lib/seed";

// Audio is mocked so rendering never touches jsdom media playback.
vi.mock("@/features/daily-groove/lib/audio", () => ({
  createAudioPlayer: () => ({
    play: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    dispose: vi.fn(),
  }),
}));

describe("Home route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Daily Groove layout with a play control and the attribute selector", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: /daily groove/i }),
    ).toBeInTheDocument();
    // Play control present.
    expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();

    // The player opts in per attribute; all three toggles are offered and no
    // picker is shown until one is selected.
    for (const label of ["Scale", "Chord", "Progression"]) {
      expect(
        screen.getByRole("checkbox", { name: label }),
      ).toBeInTheDocument();
    }
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });

  it("shows the streak badge and history alongside the puzzle (AC6)", () => {
    render(<Home />);

    // Streak badge is present (empty state on first run).
    expect(screen.getByLabelText(/current streak/i)).toBeInTheDocument();
    // History is present in its empty state with no saved results.
    expect(
      screen.getByText(/no games yet/i),
    ).toBeInTheDocument();
  });

  it("reveals today's deterministic scale options once scale is selected", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.click(screen.getByRole("checkbox", { name: "Scale" }));

    // The picker now shows the deterministic options for today's groove.
    const today = new Date();
    const groove = selectGrooveForDate(today, GROOVES);
    const options = buildOptions(
      groove.scale,
      SCALE_POOL,
      `${isoDate(today)}:scale`,
    );
    for (const option of options) {
      expect(screen.getByText(option)).toBeInTheDocument();
    }
  });
});
