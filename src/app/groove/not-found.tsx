import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { PageShell } from "@/components/layout/PageShell";
import { Stack } from "@/components/layout/Stack";
import { Heading } from "@/components/typography/Heading";
import { Text } from "@/components/typography/Text";

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
