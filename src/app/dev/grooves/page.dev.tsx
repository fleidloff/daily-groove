import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Container } from "@/components/layout/Container";
import { PageShell } from "@/components/layout/PageShell";
import { GroovePreview } from "@/features/daily-groove";

// The catalogue is the generator's input, not app data: a groove's feel narrows
// its answer, so it is read here at request time and never shipped in the
// manifest. This route is built only under `next dev` (see next.config.ts).
const CATALOGUE = resolve(process.cwd(), "scripts", "grooves", "catalogue.json");

type CatalogueEntry = { uuid: string; template: string };

function stylesByUuid(): Record<string, string> {
  const entries = JSON.parse(
    readFileSync(CATALOGUE, "utf8"),
  ) as CatalogueEntry[];
  return Object.fromEntries(
    entries.map((entry) => [entry.uuid, entry.template]),
  );
}

export default function DevGroovesPage() {
  return (
    <PageShell>
      <Container>
        <main>
          <GroovePreview styles={stylesByUuid()} />
        </main>
      </Container>
    </PageShell>
  );
}
