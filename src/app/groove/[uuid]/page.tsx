import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { PageShell } from "@/components/layout/PageShell";
import { grooveByUuid } from "@/features/daily-groove";
import { SharedGroove } from "./SharedGroove";

/**
 * A groove opened by its own link.
 *
 * A server component, and deliberately so. `notFound()` works by throwing, and
 * throwing it here — before anything is rendered — is what produces a genuine
 * not-found response for an unknown, retired or malformed uuid rather than a
 * page that merely looks like one (E1 R14, R14a, AC8; E3 R11). A client-side
 * "no such groove" branch would render with a 200.
 *
 * `params` is a Promise in this version of Next and must be awaited; the type is
 * written out rather than taken from the generated `PageProps<'/groove/[uuid]'>`
 * helper so the route type-checks before `next typegen` has seen this file.
 *
 * Composition only, exactly as `src/app/page.tsx` is: every structural, spacing
 * and layout decision lives in the design system or inside the feature, and the
 * feature is reached through `@/features/daily-groove` alone (E1 R15, R16).
 *
 * The puzzle goes in through `./SharedGroove`, a client component, because one
 * decision here needs the viewer's own clock: a link to the groove `/` is
 * already serving today redirects to `/` instead of playing as practice. That
 * cannot be settled on the server without answering for the wrong day. Both
 * files are inside this folder, so the route is still one folder to delete.
 */
export default async function SharedGroovePage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = await params;

  // Resolution reads no clock, so the same link is the same groove on any day
  // (E1 R12, R13, AC7).
  const groove = grooveByUuid(uuid);
  if (!groove) notFound();

  return (
    <PageShell>
      <Container>
        <main>
          <SharedGroove groove={groove} />
        </main>
      </Container>
    </PageShell>
  );
}
