# Greenlens

Look up a cosmetics product and see what **every public rating source** says about it,
where those sources **disagree**, and a single overall score **whose weighting you
control**. Greenlens leads with personal safety ("is this safe for me?"); sustainability
and ethics are surfaced as secondary benefits.

## The one rule that defines the product

**Never store or display a single blended score that hides disagreement.**

- Blending *conflicting opinions about the same axis* (EWG "concern" vs. Yuka "clean" on
  safety) is **forbidden**. Greenlens surfaces the spread and names who disagrees and why.
- Blending *different axes* (safety + environmental + labor + packaging) into one overall
  number is allowed **only with user-controlled weights**, computed at read time, and
  **never persisted**.

This is enforced in the data model and domain logic, not just the UI. Every rating is
shown with the **funding model** of the source that produced it — so you can see who pays
for each opinion.

## How it works

```
 Public sources ──▶ Listings (raw, per-source)
 (EWG, Yuka,         │
  INCI Beauty,       ▼
  Open Beauty     The matcher ──▶ canonical Products
  Facts …)        (blocking →        │
                   pairwise →        ▼
                   clustering)   Per-axis pillars (mean + preserved spread)
                                     │
                                     ▼
                            overall(pillars, weights)  ← you control the weights
                                     │
                                     ▼
                            ScoreDial · PillarBars · RaterSpread · Sonion
```

Ratings attach to the raw **Listing**, never to the canonical **Product**, so the matcher
can be re-run without ever losing source data.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind · Zustand (client
state) · Prisma + SQLite (dev, Postgres-ready) · Zod (validates all external data) ·
Vitest. The score dial and Sonion mascot are hand-built SVG — no charting or component
library.

`/lib/domain` and `/lib/matcher` are **pure**: they import nothing from React or Next and
run identically on server and client.

## Project layout

```
app/                     Next.js App Router
  (app)/                 Web screens
    browse/                home / search
    product/[id]/          product breakdown (ScoreDial, pillars, rater spread)
      alternatives/        cleaner options, ranked by safety — never affiliate payout
      flag/[ingredient]/   per-ingredient: where each rater lands + funding tags
  api/resolve/           live matcher endpoint for the browser extension

lib/
  domain/                pure: types · verdict · scoring · disagreement (+ tests)
  matcher/               pure: blocking · features · score · cluster · matcher
                         + logistic (learned scorer) · recall (fairness eval)
  data/                  repository interface · mock-repository · prisma-repository
  ingestion/             open-beauty-facts + hazard / brand-ethics / packaging derivation
  store.ts               Zustand weight state

components/              ScoreDial · PillarBars · RaterSpread · WeightControls · Sonion …
extension/               Chrome extension (content scripts, service worker, popup)
prisma/                  schema.prisma · seed.ts
scripts/                 ingestion, derivation, matcher training, recall eval
```

## Domain logic

- **verdict.ts** — score bands: `>=85` Excellent · `70–84` Good · `55–69` Fair ·
  `40–54` Poor · `<40` Bad.
- **scoring.ts** — `overall(pillars, weights)` is the weighted mean (all-zero weights →
  `null`). `marginalEffect(...)` knows that raising a pillar's weight lifts the overall
  *iff* that pillar is above the current weighted mean — so Sonion can truthfully say a
  pillar "carries" or "drags" the score.
- **disagreement.ts** — detects and describes per-axis source disagreement, including each
  source's funding model.

## The matcher

The real technical core. Pure and fully tested. Three stages:

1. **Blocking** — normalized GTIN (strip non-digits, left-pad to 14 so UPC-A/EAN-13
   collide), `brand + first name token`, and a coarse brand fallback.
2. **Pairwise** — features: exact GTIN, name similarity (Jaro-Winkler / token-set), brand
   match after alias canonicalization, ingredient Jaccard, size match, and a
   `variantConflict` signal for sibling products (SPF / shade / concentration / AM-PM /
   scent / color / pack-count). Normalized only over *available* features, then thresholded
   (Fellegi-Sunter style).
3. **Clustering** — union-find over high-confidence edges → canonical products.

The hand-weighted scorer has been replaced by a **learned logistic-regression model**
(`lib/matcher/logistic.ts`, trained via `npm run matcher:train`) that is now the live
`score.ts` scorer.

**Fairness is measured, not assumed.** `lib/matcher/recall.ts` (`npm run db:recall`)
reports resolution recall by brand size — a coverage-bias test asserts that removing an
indie brand's alias fractures *that* product while big brands stay resolved. Recall on the
tail is a real fairness finding; Greenlens surfaces it rather than hiding it.

## Screens

1. **Home / Browse** — search, a simulated "Scan a barcode", and recent products with
   small verdict-colored score circles. Sonion greets you.
2. **Product** — hero ScoreDial (user-weighted, animated), pillar breakdown, rater list
   with a disagreement callout, and collapsible weight controls that recompute the
   composite live. Sonion narrates and reacts.
3. **Alternatives** — cleaner products near the price, **ranked by safety, never affiliate
   payout** — each naming what's cleaner and its tradeoff.
4. **Flag / disagreement** — an ingredient explanation plus "where each rater lands" with
   funding tags and reasoning. This screen is the thesis; it isn't watered down.

## Sonion

A small **male** guide mascot whose expression is a second readout of the verdict, not
decoration. Moods come from the overall score — `happy` (≥70), `neutral` (55–69),
`concerned` (<55) — with animated transitions, idle blink/bob, and reactive comments on
weight changes driven truthfully by `marginalEffect`. Real `<button>` + aria-label;
respects `prefers-reduced-motion`.

## Browser extension

`extension/` is a Chrome extension (Vite + CRXJS) that detects a cosmetics product on a
supported retail page (Amazon adapter today; the adapter interface is pluggable), POSTs the
sighting to the app's `/api/resolve` endpoint, and shows the Greenlens verdict inline with
a deep link to the full breakdown. The service worker can't run Prisma, so resolution
happens server-side against the **same** catalog the web UI renders.

## Getting started

Requires Node 22+ (the scripts use `--experimental-strip-types`).

```bash
npm install                  # also runs prisma generate (postinstall)
cp .env.example .env         # DATABASE_URL + optional GREENLENS_REPO
npm run dev                  # http://localhost:3000  (in-memory mock repository)
```

By default the app reads from the **mock repository** — no database needed. To run against
the seeded SQLite catalog instead:

```bash
npm run db:push              # create the SQLite schema
npm run db:seed              # seed the demo catalog
npm run dev:full             # dev server with GREENLENS_REPO=prisma
```

Swapping mock → Prisma must never change the UI — data sources live behind the
`ProductRepository` interface.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next dev server (mock repository) |
| `npm run dev:full` | Dev server against the full Prisma catalog |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` / `npm run test:watch` | Vitest (domain + matcher suites) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:push` / `db:seed` / `db:reset` | Prisma schema / seed / force-reset + seed |
| `npm run db:ingest` | Ingest products from Open Beauty Facts |
| `npm run db:hazard` / `db:ethics` / `db:packaging` | Derive per-axis ratings |
| `npm run db:recall` | Resolution-recall-by-brand-size fairness eval |
| `npm run matcher:train` | Train the logistic matcher and write the model |
| `npm run ext:dev` / `ext:build` | Run / build the browser extension |

## Data integration

Everything lives behind `ProductRepository` (mock first). `lib/ingestion/open-beauty-facts.ts`
fetches by barcode, validates with Zod, and normalizes the response into Listings + Ratings
(open data — avoids EWG/Yuka scraping and licensing), which then flow through the matcher
and are exposed via `prisma-repository.ts`. Hazard, brand-ethics, and packaging derivations
turn raw product data into the four axes (`ingredient_safety`, `environmental`, `labor`,
`packaging`).

## Constraints / non-goals

Cosmetics only. Never average conflicting same-axis ratings. Never persist the overall
score. The user owns the weighting — there is no hidden "objective" default. A rating's
funding model is always visible. TypeScript strict with no `any` in domain code;
`/lib/domain` and `/lib/matcher` import nothing from React/Next. Accessibility and
`prefers-reduced-motion` are requirements, not nice-to-haves. The barcode scan is
simulated — no camera/barcode hardware yet.
