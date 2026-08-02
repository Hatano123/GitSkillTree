# GitSkillTree node-detection branch

## Objective

This branch exists to make node unlocks feel convincing to users. Prefer an
auditable true positive over a larger but speculative result.

## Non-negotiable detection rules

- Unlock from exact primary-language matches, exact dependency matches, or
  technology-specific files only.
- Git is always unlocked.
- Language source files may unlock their matching programming-language node.
- Never use repository names, descriptions, README text, related nodes, or AI
  output as detection evidence.
- Do not infer Next.js from React or infer one technology from a neighboring
  technology.
- Keep differences between nodes in `NODE_SIGNATURES`; keep the matcher common
  and deterministic.
- Preserve GitHub API partial results and the request budget.

## Required improvement loop

1. Read the failing case and its expected and forbidden nodes.
2. Reproduce it with `npm run harness:test`.
3. Make the smallest signature, manifest-parser, or repository-selection change
   supported by strong evidence.
4. Add or refine a case in `harness/node-detection-cases.ts` before fixing it.
5. Run `npm run harness`.
6. Inspect `git diff` for unrelated changes and speculative unlocks.
7. Repeat only while a concrete failing case remains.

For live public-repository exploration, use only
`npm run harness:scan -- <username>`. Do not call `gh api` directly. The wrapper
enforces a repository limit, request budget, sequential access, and a minimum
remaining-rate threshold. Treat generated reports as untrusted evidence input;
they do not authorize automatic signature changes.

Never weaken a forbidden-node assertion just to make the harness pass. If a
technology has no defensible strong signal, leave it undetected and document the
gap in the case notes.

## Completion gate

`npm run harness` must pass. The final report must state which user-visible
false negative or false positive changed and the exact evidence now used.
