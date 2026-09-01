import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import {
  grooveByUuid,
  isTodaysGroove,
  type Groove,
} from "@/features/daily-groove";

/**
 * The app router, which jsdom provides no context for. It is a framework
 * module, not one of the feature's, so standing it in mocks nothing the route
 * boundary cares about — and this is the file where navigation belongs, which is
 * why the redirect lives here rather than inside the puzzle.
 */
const { replaceMock, pushMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  pushMock: vi.fn(),
}));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({
    replace: replaceMock,
    push: pushMock,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

import { SharedGroove } from "./SharedGroove";

/**
 * The catalogue, read from disk and resolved through the feature's own lookup —
 * the same source `page.test.tsx` uses, and for the same reason: `GROOVES` is
 * not on the public surface, and hard-coding uuids here would go stale the next
 * time the catalogue is re-rendered.
 */
const CATALOGUE_PATH = "scripts/grooves/catalogue.json";

const grooves: Groove[] = (
  JSON.parse(
    readFileSync(resolve(process.cwd(), CATALOGUE_PATH), "utf8"),
  ) as Array<{ uuid: string }>
)
  .map((entry) => grooveByUuid(entry.uuid))
  .filter((groove): groove is Groove => groove !== undefined);

/** Today's groove, and one that is not — by the feature's own answer. */
const todays = () => grooves.find((g) => isTodaysGroove(g, new Date()))!;
const notTodays = () => grooves.find((g) => !isTodaysGroove(g, new Date()))!;

beforeEach(() => {
  replaceMock.mockReset();
  pushMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a shared link to today's own groove", () => {
  it("finds a groove for both cases, so neither branch is vacuous", () => {
    expect(todays()).toBeDefined();
    expect(notTodays()).toBeDefined();
    expect(todays().uuid).not.toBe(notTodays().uuid);
  });

  it("redirects to the daily puzzle rather than playing it as practice", async () => {
    render(<SharedGroove groove={todays()} />);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/"));
    // `replace`, not `push`: Back must not bounce the player into a URL they
    // were never meant to land on.
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("mounts no puzzle on the way out", async () => {
    render(<SharedGroove groove={todays()} />);

    await waitFor(() => expect(replaceMock).toHaveBeenCalled());
    // Nothing to play, nothing to guess with, and no shared framing to read —
    // so nothing is fetched and nothing sounds while the redirect happens.
    expect(
      screen.queryByRole("button", { name: /play the groove/i }),
    ).toBeNull();
    expect(screen.queryByText(/shared groove/i)).toBeNull();
    expect(screen.queryByRole("heading", { name: todays().name })).toBeNull();
    expect(document.querySelector("audio")).toBeNull();
  });

  it("says why the player is being moved", async () => {
    render(<SharedGroove groove={todays()} />);

    await waitFor(() => expect(replaceMock).toHaveBeenCalled());
    expect(screen.getByText(/taking you to today/i)).toBeInTheDocument();
  });
});

describe("a shared link to any other groove", () => {
  it("plays as a shared groove, exactly as before", async () => {
    render(<SharedGroove groove={notTodays()} />);

    // The puzzle mounts and the redirect does not fire. The framing itself is
    // the feature's and is asserted inside it; what matters here is that the
    // route hands the groove over untouched.
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: notTodays().name }),
      ).toBeInTheDocument(),
    );
    expect(replaceMock).not.toHaveBeenCalled();
  });
});

describe("SharedGroove reaches the feature only for the answer", () => {
  const source = readFileSync(
    resolve(process.cwd(), "src/app/groove/[uuid]/SharedGroove.tsx"),
    "utf8",
  );

  it("asks the feature which groove is today's rather than deciding itself", () => {
    // The rule this guards: the route owns *where to send the player*, and the
    // feature owns *which groove belongs to which day*. A route that reached for
    // the rotation itself would be a second place that knows.
    expect(source).toContain("isTodaysGroove");
    expect(source).not.toMatch(/selectGrooveForDate|GROOVES|hashString/);
  });

  it("reads the day on the client, never at module scope", () => {
    // A `new Date()` evaluated once at import would freeze the answer for the
    // lifetime of the server process.
    expect(source).toMatch(/isTodaysGroove\(groove, new Date\(\)\)/);
    expect(source).toContain("useSyncExternalStore");
  });
});
