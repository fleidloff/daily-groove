import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, it, expect, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { PageShell } from "@/components/layout/PageShell";
import { grooveByUuid, isTodaysGroove } from "@/features/daily-groove";

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

const CATALOGUE_PATH = "scripts/grooves/catalogue.json";

const catalogueUuids: string[] = (
  JSON.parse(
    readFileSync(resolve(process.cwd(), CATALOGUE_PATH), "utf8"),
  ) as Array<{ uuid: string }>
).map((entry) => entry.uuid);

const grooves: Groove[] = catalogueUuids
  .map((uuid) => grooveByUuid(uuid))
  .filter((groove): groove is Groove => groove !== undefined);

const playable: Groove[] = grooves.filter(
  (groove) => !isTodaysGroove(groove, new Date()),
);

const UNUSED_UUID = "00000000-0000-4000-8000-000000000000";

const NOT_FOUND_DIGEST = (() => {
  try {
    notFound();
  } catch (error) {
    return (error as { digest?: string }).digest;
  }
  throw new Error("notFound() did not throw");
})();

function childrenOf(node: ReactNode): ReactNode[] {
  if (!isValidElement(node)) return [];
  const { children } = node.props as { children?: ReactNode };
  if (children === undefined || children === null) return [];
  return Array.isArray(children) ? (children as ReactNode[]) : [children];
}

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

  it("is compared against the 404 interrupt notFound() throws", () => {
    expect(NOT_FOUND_DIGEST).toMatch(/404/);
  });

  it.each(["not-a-real-uuid", "", UNUSED_UUID])(
    "throws what notFound() throws for %j, and renders nothing",
    async (uuid) => {
      let element: ReactElement | undefined;

      await expect(
        (async () => {
          element = await pageFor(uuid);
        })(),
      ).rejects.toMatchObject({ digest: NOT_FOUND_DIGEST });

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
