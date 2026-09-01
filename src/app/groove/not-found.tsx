import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { PageShell } from "@/components/layout/PageShell";
import { Stack } from "@/components/layout/Stack";
import { Heading } from "@/components/typography/Heading";
import { Text } from "@/components/typography/Text";

/**
 * What a dead share link lands on. Next renders it for the `notFound()` thrown
 * in `./[uuid]/page.tsx` — unknown, retired and malformed uuids all arrive here,
 * because they are one case, not three (E3 R8, R9).
 *
 * It lives inside `src/app/groove/`, so it is deleted with the route folder and
 * the removability standard in `docs/architecture.md` still reads "delete the
 * folder and the route folder".
 *
 * It imports nothing from `src/features` at all, and has nothing to: there is no
 * puzzle here, no audio and no groove to know about (E3 R12, AC9). One heading,
 * one calm line, and the single way back to today's puzzle — the only link this
 * page has, and it points at `/` (E3 R10, AC6).
 */
export default function GrooveNotFound() {
  return (
    <PageShell>
      <Container>
        <main>
          <Stack gap="md">
            <Heading level={1} size="lg">
              Groove not found
            </Heading>
            <Text tone="muted">
              We couldn&apos;t find the groove that link points at. It may have
              been mistyped, or the groove may no longer be around.
            </Text>
            <Text>
              <Link href="/">Play today&apos;s groove</Link>
            </Text>
          </Stack>
        </main>
      </Container>
    </PageShell>
  );
}
