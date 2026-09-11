import { Container } from "@/components/layout/Container";
import { PageShell } from "@/components/layout/PageShell";
import { StatsPage } from "@/features/daily-groove";

export default function Stats() {
  return (
    <PageShell>
      <Container>
        <main>
          <StatsPage />
        </main>
      </Container>
    </PageShell>
  );
}
