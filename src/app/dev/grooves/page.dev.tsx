import { Container } from "@/components/layout/Container";
import { PageShell } from "@/components/layout/PageShell";
import { GroovePreview } from "@/features/daily-groove";

export default function DevGroovesPage() {
  return (
    <PageShell>
      <Container>
        <main>
          <GroovePreview />
        </main>
      </Container>
    </PageShell>
  );
}
