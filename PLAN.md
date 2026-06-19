# PLAN.md — Greenlens build order

Architecture, data model, design tokens, and all standing rules live in **CLAUDE.md**. This file is just the build order. Commit at the end of each phase.

## Phases
- **Phase 0** — Scaffold Next.js + TS (strict) + Tailwind + design tokens. Static home screen.
- **Phase 1** — Domain types; `verdict.ts`, `scoring.ts`, `disagreement.ts` with unit tests. Mock repository seeded with two demo products (a vitamin C serum and a moisturizing cream) across three sources (EWG, Yuka, INCI Beauty) with a real disagreement on one axis.
- **Phase 2** — All four screens wired to the mock repo: ScoreRing, PillarBreakdown, RaterList, WeightControls with live composite recompute.
- **Phase 3** — Sonion: face, moods from score, idle animation, slider reactivity, auto-tuck bubble, reduced-motion support.
- **Phase 4** — The matcher module with the full test suite, including the coverage-bias test.
- **Phase 5** — Prisma schema + SQLite, prisma-repository, Open Beauty Facts ingestion for one real product end to end through the matcher.
- **Later** — ✅ recall-by-brand-size measurement (`lib/matcher/recall.ts`, `npm run db:recall`); ✅ logistic-regression matcher trained on labeled pairs (`lib/matcher/logistic.ts` + `labeling.ts` + `eval-pairs.ts`, `npm run matcher:train`; default scorer still the hand weights pending a threshold re-tune); ⬜ MinHash blocking; ⬜ a second product vertical.

## Start here
Read CLAUDE.md, then build **Phase 0 and Phase 1 only**. Stop and show me the folder structure and the passing tests before continuing. If you want to introduce a dependency or pattern not in CLAUDE.md, justify it to me first.