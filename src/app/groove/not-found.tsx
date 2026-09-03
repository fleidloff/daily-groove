import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { PageShell } from "@/components/layout/PageShell";
import { Stack } from "@/components/layout/Stack";
import { Heading } from "@/components/typography/Heading";
import { Text } from "@/components/typography/Text";
import { routes } from "@/lib/snippets";

export default function GrooveNotFound() {
  return (
    <PageShell>
      <Container>
        <main>
          <Stack gap="md">
            <Heading level={1} size="lg">
              {routes.notFoundTitle}
            </Heading>
            <Text tone="muted">{routes.notFoundBody}</Text>
            <Text>
              <Link href="/">{routes.playTodayLink}</Link>
            </Text>
          </Stack>
        </main>
      </Container>
    </PageShell>
  );
}
