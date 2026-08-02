# Node detection development harness

This harness turns reports such as “OpenCV was missing” or “React incorrectly
unlocked Next.js” into permanent user-acceptance cases.

## Run it

```powershell
npm run harness:test
```

Run the complete branch gate before finishing an iteration:

```powershell
npm run harness
```

The complete gate runs the existing tests, acceptance corpus, lint, and the
production build.

## Growth-system acceptance loop

`growth-system-cases.ts` protects the MVP node-EXP rules:

- first detection grants 40 EXP to that node;
- each new unique, auditable evidence item grants 10 EXP;
- rescanning identical evidence grants 0 EXP;
- temporarily incomplete API results never remove earned node EXP;
- existing scans establish a baseline without showing fake rewards;
- nodes change to LV.2 at 70 EXP and LV.3 at 100 EXP.

Add a failing growth case before changing the formula or persistence behavior.
The growth harness runs as part of both `npm run harness:test` and
`npm run harness`.

## Scan a real public account

After `gh auth login`, run the guarded scanner:

```powershell
npm run harness:scan -- Hatano123
```

It inspects 10 repositories by default. Development-only expansion is capped at
30 repositories:

```powershell
npm run harness:scan -- Hatano123 --max-repos 30
```

The scanner reads public, non-fork repositories sequentially, fetches at most
one manifest per repository, refuses to start with low API capacity, and stops
on rate-limit responses. Reports are written under `harness/reports/` and are
ignored by Git. AI agents must use this wrapper instead of calling `gh api`
directly.

## Give it to an AI agent

Give the agent `harness/LOOP_PROMPT.md`. Repository-local rules in `AGENTS.md`
define the objective, evidence boundary, iteration steps, and stopping condition.
The loop is intentionally bounded by concrete failing cases; a passing harness
is not permission to invent more signatures.

## Add feedback from a real scan

Add one entry to `node-detection-cases.ts` containing:

- a stable case ID and the user-visible reason;
- GitHub primary languages and file paths;
- raw dependency manifest content when available;
- nodes that must appear in `expected`;
- plausible but wrong nodes that must stay in `forbidden`.

First run the case and confirm that it fails for the reported reason. Then let
the agent adjust the smallest signature or parser rule. Never remove a forbidden
assertion merely to obtain a green result.

Repository names, descriptions, and README text are deliberately absent from
the fixture schema because they are not valid detection evidence.
