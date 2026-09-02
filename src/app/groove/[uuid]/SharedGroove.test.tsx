import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import {
  grooveByUuid,
  isTodaysGroove,
  type Groove,
} from "@/features/daily-groove";

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

const CATALOGUE_PATH = "scripts/grooves/catalogue.json";

const grooves: Groove[] = (
  JSON.parse(
    readFileSync(resolve(process.cwd(), CATALOGUE_PATH), "utf8"),
  ) as Array<{ uuid: string }>
)
  .map((entry) => grooveByUuid(entry.uuid))
  .filter((groove): groove is Groove => groove !== undefined);

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
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("mounts no puzzle on the way out", async () => {
    render(<SharedGroove groove={todays()} />);

    await waitFor(() => expect(replaceMock).toHaveBeenCalled());
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
    expect(source).toContain("isTodaysGroove");
    expect(source).not.toMatch(/selectGrooveForDate|GROOVES|hashString/);
  });

  it("reads the day on the client, never at module scope", () => {
    expect(source).toMatch(/isTodaysGroove\(groove, new Date\(\)\)/);
    expect(source).toContain("useSyncExternalStore");
  });
});
