import { readdirSync } from "node:fs";
import { join } from "node:path";

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const rootDir = import.meta.dirname;

// The feature slices that exist right now. Reading the folder rather than
// hard-coding names means a new feature gets the boundaries for free — in
// particular the "no feature imports another feature" zone, which would
// silently stop existing if the list were written by hand and not updated.
const features = readdirSync(join(rootDir, "src", "features"), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

// Everything that is not a feature slice, and therefore may only see a
// feature through its public surface.
const outsideFeatures = ["src/app", "src/components", "src/lib", "scripts"];

// The module map inside the one slice that has grown one: unlike the feature
// boundaries above, these arrows are this feature's own concerns, so the path
// is named rather than derived.
const F = "src/features/daily-groove";

const moduleMapZones = [
  {
    target: `${F}/lib`,
    from: ["src/components", `${F}/components`, `${F}/hooks`, `${F}/state`],
    message:
      "A lib/ module must not import UI, a hook or the store. lib/ is where " +
      "the feature's logic lives so it can be tested as plain functions and " +
      "reused by any component; importing what renders it makes it " +
      "untestable in isolation and couples the seam to the screen. Take what " +
      "you need as an argument, or move the logic into the component.",
  },
  {
    target: `${F}/lib/audio`,
    from: [`${F}/lib/presentation`, `${F}/lib/puzzle`, `${F}/lib/persistence`],
    message:
      "lib/audio/ must not import coaching or the puzzle module. Audio plays " +
      "sound; it does not know the rules of the game or how they are " +
      "described. Its one arrow out is to theory — lib/audio/lick.ts takes " +
      "ScheduledNote from src/lib/theory/phrase — and a second arrow would " +
      "make the player unusable outside this puzzle.",
  },
  {
    target: [`${F}/lib/puzzle`, `${F}/lib/persistence`],
    from: [`${F}/lib/presentation`, `${F}/lib/audio`],
    message:
      "The puzzle module must not import coaching or audio. lib/puzzle/ and " +
      "lib/persistence/ are the rules of the game and the record of it; how " +
      "a state is described (lib/presentation/) and how it sounds " +
      "(lib/audio/) both depend on those rules, never the other way. If a " +
      "coaching helper is what you want to assert against, the assertion " +
      "belongs in the coaching module's own test.",
  },
];

const featureBoundaryZones = features.flatMap((feature) => {
  const others = features.filter((other) => other !== feature);

  return [
    // A feature is a black box from the outside: only its index.ts is
    // importable. The zone binds consumers, never the feature's own files —
    // `target` deliberately excludes `src/features/<feature>/`, so modules
    // inside the slice keep importing each other by relative path.
    {
      target: [...outsideFeatures, ...others.map((o) => `src/features/${o}`)],
      from: `src/features/${feature}`,
      except: ["index.ts"],
      message:
        `A feature is a black box: import "${feature}" only through ` +
        `src/features/${feature}/index.ts, never a file inside it. ` +
        `Deep imports freeze the slice's internal layout into its consumers, ` +
        `so the feature can no longer be moved, refactored or deleted in one ` +
        `step. Add what you need to the feature's index.ts instead. ` +
        `(Files inside src/features/${feature}/ may import each other freely.)`,
    },
    // No feature may import another feature — not even through its index.ts.
    {
      target: others.map((o) => `src/features/${o}`),
      from: `src/features/${feature}`,
      message:
        `No feature may import another feature. Every slice has to stay ` +
        `independently deletable, so "${feature}" must not become a ` +
        `dependency of a sibling. Anything two features need moves up into ` +
        `src/lib (logic) or src/components (UI) — never sideways.`,
    },
  ];
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Specs are documentation, not app code. The design canvas under
    // specs/feature-2/ vendors a bundled support.js that is not ours to fix.
    "specs/**",
  ]),
  {
    name: "daily-groove/import-boundaries",
    // No `files` key on purpose: the boundaries apply to tests exactly as
    // they apply to source. Both violations that motivated these rules were
    // in test files.
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          basePath: rootDir,
          zones: [
            // The design system may not know about features.
            {
              target: "src/components",
              from: "src/features",
              message:
                "The design system must not know about features. " +
                "src/components/ is generic, prop-driven UI that any feature " +
                "can reuse; importing a feature makes it un-reusable and " +
                "stops that feature from being deleted. Take the data in as " +
                "props, or keep the domain-aware component inside the feature.",
            },
            // One pair of zones per feature: public surface, and no sideways
            // imports between features.
            ...featureBoundaryZones,
            // src/lib is a leaf.
            {
              target: "src/lib",
              from: ["src/features", "src/components"],
              message:
                "src/lib is a leaf: shared logic may not import the app. " +
                "Depending on a feature or on the design system would make " +
                "src/lib un-shareable and cyclic — and it is precisely " +
                "src/lib's independence that lets the groove generator under " +
                "scripts/ import it from outside the @/ alias. Push the " +
                "dependency the other way: let the caller pass what it needs.",
            },
            // The generator's one channel into the app.
            {
              target: "scripts",
              from: ["src/features", "src/components"],
              message:
                "The groove generator's only channel into the app is " +
                "src/lib. scripts/ is a build-time tool, not an app module: " +
                "reaching into a feature or into the design system couples " +
                "the generator to UI that can change without it. Put the " +
                "shared contract in src/lib/ (see src/lib/groove.ts) and " +
                "import it from there.",
            },
            // The module map inside the daily-groove slice.
            ...moduleMapZones,
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
