import { Container } from "@/components/layout/Container";
import { PageShell } from "@/components/layout/PageShell";
import { GroovePuzzle } from "@/features/daily-groove";

// Composition only: every structural, spacing and layout decision lives in the
// design system (PageShell, Container) or inside the feature.
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
