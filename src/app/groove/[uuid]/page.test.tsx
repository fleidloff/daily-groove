import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, it, expect, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { PageShell } from "@/components/layout/PageShell";
import { grooveByUuid, isTodaysGroove } from "@/features/daily-groove";

/**
 * The app router. Rendering this page mounts `./SharedGroove`, the route's
 * client half, which reads the router in order to redirect a link that points at
 * today's own groove. Only `useRouter` is stood in: `importOriginal` is spread so
 * the real `notFound()`, whose digest this file reads below, keeps working.
 */
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

import { SharedGroove } from "./SharedGroove";
import type { Groove } from "@/features/daily-groove";
import SharedGroovePage from "./page";

/**
 * The shared route's own tests, and nothing else.
 *
 * Puzzle behaviour is tested inside the feature, beside the code that owns it —
 * this file asserts only what `page.tsx` itself does: resolve the uuid in the
 * URL through the feature's public surface, hand the groove it finds to
 * `GroovePuzzle` in shared mode, and call `notFound()` when nothing holds that
 * uuid. It reaches the feature only through `@/features/daily-groove` and mocks
 * nothing inside it, which `route-boundary.test.ts` enforces by reading this
 * file's source (F12 E1 R15, R17, AC12).
 *
 * The uuids under test are read from `scripts/grooves/catalogue.json` — the
 * generator's input, and by F12 E1 R5 the one place a uuid is stored — rather
 * than hard-coded here, so a retired or re-rendered catalogue can never leave
 * this file asserting against a uuid no groove holds. It is read from disk, not
 * imported: the resolution under test still goes through `grooveByUuid`, the
 * public surface, and no specifier crosses into `scripts/` or past the
 * feature's index.
 */
const CATALOGUE_PATH = "scripts/grooves/catalogue.json";

const catalogueUuids: string[] = (
  JSON.parse(
    readFileSync(resolve(process.cwd(), CATALOGUE_PATH), "utf8"),
  ) as Array<{ uuid: string }>
).map((entry) => entry.uuid);

const grooves: Groove[] = catalogueUuids
  .map((uuid) => grooveByUuid(uuid))
  .filter((groove): groove is Groove => groove !== undefined);

/**
 * The grooves that actually render a puzzle here. A link to the groove `/` is
 * serving today is redirected away by `./SharedGroove` instead, so the two
 * assertions below that read the rendered DOM take their fixtures from this
 * subset — otherwise they would fail once a year each, on the day the rotation
 * happened to reach their entry.
 */
const playable: Groove[] = grooves.filter(
  (groove) => !isTodaysGroove(groove, new Date()),
);

/**
 * A canonical v4 uuid no groove holds. The literal is safe because the test
 * below asserts it resolves to nothing: if a groove ever mints it, that
 * assertion fails rather than this one quietly passing for the wrong reason.
 */
const UNUSED_UUID = "00000000-0000-4000-8000-000000000000";

/** The error `notFound()` throws, taken from `notFound()` rather than spelled out. */
const NOT_FOUND_DIGEST = (() => {
  try {
    notFound();
  } catch (error) {
    return (error as { digest?: string }).digest;
  }
  throw new Error("notFound() did not throw");
})();

/** The children a React element was given, as a flat list. */
function childrenOf(node: ReactNode): ReactNode[] {
  if (!isValidElement(node)) return [];
  const { children } = node.props as { children?: ReactNode };
  if (children === undefined || children === null) return [];
  return Array.isArray(children) ? (children as ReactNode[]) : [children];
}

/**
 * The first element of `type` in the tree the page returned.
 *
 * The page is a server component, so what it returns is an element tree: the
 * composition itself, before any of it is rendered. Reading `SharedGroove`'s
 * props from that tree is how the route's own subject — *which* groove it
 * resolved and handed on — is asserted without driving the puzzle's audio, and
 * without mocking anything inside the feature.
 *
 * `mode="shared"` is no longer the page's to pass: `SharedGroove` sets it, and
 * asserts it in its own test, because it is also the component that may redirect
 * to `/` instead of playing anything at all.
 */
function findElement<P>(node: ReactNode, type: unknown): ReactElement<P> | undefined {
  if (!isValidElement(node)) return undefined;
  if (node.type === type) return node as ReactElement<P>;
  for (const child of childrenOf(node)) {
    const found = findElement<P>(child, type);
    if (found) return found;
  }
  return undefined;
}

type SharedGrooveProps = { groove?: Groove };

async function pageFor(uuid: string): Promise<ReactElement> {
  return (await SharedGroovePage({
    params: Promise.resolve({ uuid }),
  })) as ReactElement;
}

/**
 * No audio mock is needed. The transport builds its player lazily on the first
 * press, so rendering the route never touches jsdom media playback.
 */
async function renderPage(uuid: string) {
  const result = render(await pageFor(uuid));
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  return result;
}

describe("the catalogue this route is tested against", () => {
  it("holds more than one groove, each resolvable by its uuid", () => {
    expect(catalogueUuids.length).toBeGreaterThan(1);
    expect(grooves).toHaveLength(catalogueUuids.length);
  });
});

describe("/groove/<uuid> renders that groove's puzzle", () => {
  /**
   * Every groove, not a chosen one: at most one of them is the groove the
   * rotation is serving today, so asserting all of them necessarily covers
   * grooves whose day is not today — which is AC7's "including on a date whose
   * daily groove is a different one", without this test reading the clock at
   * all (F12 E1 R12, R13, R16, AC7).
   */
  it.each(grooves.map((groove) => [groove.uuid, groove.name] as const))(
    "resolves %s to %s and hands it on",
    async (uuid, name) => {
      const shared = findElement<SharedGrooveProps>(
        await pageFor(uuid),
        SharedGroove,
      );

      expect(shared).toBeDefined();
      expect(shared?.props.groove?.uuid).toBe(uuid);
      expect(shared?.props.groove?.name).toBe(name);
    },
  );

  it("composes the design system around the feature", async () => {
    const element = await pageFor(playable[0].uuid);

    // PageShell supplies the page frame and Container the measure; the route
    // itself decides neither, exactly as `/` does.
    expect(element.type).toBe(PageShell);
    expect(findElement(element, Container)).toBeDefined();

    const { container } = await renderPage(playable[0].uuid);
    expect(container.querySelector(".min-h-screen")).toBeInTheDocument();
    expect(container.querySelector(".max-w-\\[1220px\\]")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("names the groove its own link points at, and no other", async () => {
    const first = playable[0];
    const last = playable[playable.length - 1];
    expect(first.name).not.toBe(last.name);

    for (const [groove, other] of [
      [first, last],
      [last, first],
    ] as const) {
      const { unmount } = await renderPage(groove.uuid);
      expect(
        screen.getByRole("heading", { name: groove.name }),
      ).toBeInTheDocument();
      expect(screen.queryByText(other.name)).toBeNull();
      unmount();
    }
  });
});

describe("an unresolvable uuid is a not-found", () => {
  it("is a uuid no groove holds", () => {
    expect(grooveByUuid(UNUSED_UUID)).toBeUndefined();
  });

  // Guards the comparison below: `notFound()` throws the 404 interrupt, which is
  // what makes the response a genuine not-found rather than a page that looks
  // like one (F12 E3 R11).
  it("is compared against the 404 interrupt notFound() throws", () => {
    expect(NOT_FOUND_DIGEST).toMatch(/404/);
  });

  // Unknown, malformed and empty are one case, not three (F12 E1 R14, R14a,
  // AC8; F12 E3 R9).
  it.each(["not-a-real-uuid", "", UNUSED_UUID])(
    "throws what notFound() throws for %j, and renders nothing",
    async (uuid) => {
      let element: ReactElement | undefined;

      await expect(
        (async () => {
          element = await pageFor(uuid);
        })(),
      ).rejects.toMatchObject({ digest: NOT_FOUND_DIGEST });

      // Nothing else is rendered: the page never produced a tree to render.
      expect(element).toBeUndefined();
    },
  );
});

const source = readFileSync(
  resolve(process.cwd(), "src/app/groove/[uuid]/page.tsx"),
  "utf8",
);

describe("page.tsx is composition only", () => {
  it("holds no class of its own", () => {
    expect(source).not.toMatch(/className/);
  });

  it("composes the page out of design-system primitives", () => {
    expect(source).toMatch(/PageShell/);
    expect(source).toMatch(/Container/);
  });

  it("calls notFound() rather than rendering a not-found of its own", () => {
    expect(source).toMatch(/notFound\(\)/);
  });
});
