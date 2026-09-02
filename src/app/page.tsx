import { Container } from "@/components/layout/Container";
import { PageShell } from "@/components/layout/PageShell";
import { GroovePuzzle } from "@/features/daily-groove";

export default function Home() {
  return (
    <PageShell>
      <Container>
        <main>
          <GroovePuzzle />
        </main>
      </Container>
    </PageShell>
  );
}
