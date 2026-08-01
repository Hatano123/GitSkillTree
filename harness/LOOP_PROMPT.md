# Node detection improvement loop

Work autonomously on this branch toward one goal: users should agree with the
nodes that GitSkillTree unlocks.

Start by reading `AGENTS.md`, then run `npm run harness`. Treat failures in
`harness/node-detection-cases.ts` as the work queue. For each failure:

1. Explain the false negative or false positive in one sentence.
2. Confirm that the proposed evidence is an exact language, exact dependency,
   or technology-specific file.
3. Make the smallest deterministic change.
4. Run `npm run harness` and inspect the diff.

Do not browse random repositories or expand signatures without a concrete case.
When the user supplies a public GitHub account, collect it only through
`npm run harness:scan -- <username>` and review the generated report offline.
Never invoke `gh api` directly.
Do not use README, descriptions, repository names, related-node state, or AI as
evidence. Do not deploy, commit, push, or change secrets.

Stop when the full harness passes and no concrete failing case remains. Report
the changed cases, evidence, request-budget impact, and verification results.
