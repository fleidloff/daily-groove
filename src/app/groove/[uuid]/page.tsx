import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { PageShell } from "@/components/layout/PageShell";
import { grooveByUuid } from "@/features/daily-groove";
import { SharedGroove } from "./SharedGroove";

export default async function SharedGroovePage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = await params;

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
