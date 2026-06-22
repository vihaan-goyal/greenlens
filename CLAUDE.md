# CLAUDE.md — Greenlens

Standing rules for this project. Obey them on every session. Ask before adding any dependency not listed here.

## Context Navigation
When you need to understand the codebase, docs, or any files in this project:
1. ALWAYS query the knowledge graph first: `/graphify query "your question"`
2. Only read raw files if I explicitly say "read the file" or "look at the raw file"
3. Use `graphify-out/wiki/index.md` as your navigation entrypoint for browsing structure

## What this is
Greenlens lets someone look up a cosmetics product and see what every public rating source says about it, where those sources disagree, and a single overall score **whose weighting the user controls**. It leads with personal safety ("is this safe for me"); sustainability and ethics are secondary benefits.

## The one rule that defines the product
**Never store or display a single blended score that hides disagreement.**
- Blending *conflicting opinions about the same axis* (EWG "concern" vs Yuka "clean" on safety) is **forbidden**. Surface the spread; name who disagrees and why.
- Blending *different axes* (safety + environmental + labor + packaging) into one overall number is allowed **only with user-controlled weights**, computed at read time, **never persisted**.
This is encoded in the data model and domain logic, not just the UI.

## Stack (use exactly this)
Next.js (latest, App Router) · TypeScript (strict) · Tailwind · Framer Motion (Sonion) · Zustand (client state) · Prisma + SQLite (dev, Postgres-ready) · Vitest · Zod (validate external data). No component library required (Radix primitives if needed). No charting library — the score ring is custom SVG.

## Architecture (strict layering)
`/lib/domain` and `/lib/matcher` are **pure** and import nothing from React/Next.
```
/app  page.tsx | /product/[id]/page.tsx | .../alternatives | .../flag/[ingredient]
/lib/domain    types.ts · verdict.ts · scoring.ts · disagreement.ts
/lib/matcher   blocking.ts · features.ts · score.ts · cluster.ts · matcher.ts · matcher.test.ts
/lib/data      repository.ts (interface) · mock-repository.ts · prisma-repository.ts
/lib/ingestion open-beauty-facts.ts
/components     ScoreRing · PillarBreakdown · RaterList · WeightControls · Sonion/ · ui/
/lib/store.ts · /styles/tokens.css · /prisma/schema.prisma
```
Product pages are server components reading from the repository; interactive bits (weights, Sonion) are client components. Composite computation stays in pure functions usable server- and client-side. Data sources are swappable behind the `ProductRepository` interface.

## Data model
Ratings attach to the raw **Listing**, never to the canonical **Product**, so the matcher can be re-run without losing source data.
```
Brand        { id, name, parentId?, aliases[] }
Product      { id, brandId, displayName, category, gtin?, sizeValue?, sizeUnit?, ingredients[] }
Source       { id, name, axis, scaleMin, scaleMax, scaleDirection, fundingModel }
Listing      { id, sourceId, nativeId, rawName, rawBrand, rawGtin?, rawIngredients[], url, payload, fetchedAt }
ListingMatch { listingId, productId, confidence, method, reviewed }
Rating       { id, listingId, scoreRaw, scoreLabel?, ingestedAt }
Axis         = 'ingredient_safety' | 'environmental' | 'labor' | 'packaging'
FundingModel = 'nonprofit' | 'independent' | 'ad_supported' | 'subscription'
```
`fundingModel` and `axis` carry the product's point: show who pays for each opinion; never average across axes blindly. Normalize each source's native scale to 0–100 (respect `scaleDirection`). When an axis has disagreeing ratings, keep all of them; the pillar's representative number is the mean but the spread stays available.

## Domain logic
- **verdict.ts** (pure): `>=85` Excellent · `70–84` Good · `55–69` Fair · `40–54` Poor · `<40` Bad.
- **scoring.ts** (pure): `overall(pillars, weights)` = weighted mean; all-zero weights → null. `marginalEffect(...)`: raising a pillar's weight lifts the overall iff that pillar is above the current weighted mean (so Sonion can truthfully say a pillar "carries" or "drags" the score).
- **disagreement.ts** (pure): detect + describe per-axis source disagreement, including each source's funding model.

## The matcher (pure, fully tested — the real technical core)
Three stages:
1. **Blocking**: normalized GTIN (strip non-digits, left-pad to 14 so UPC-A/EAN-13 collide), `brand + first name token`, coarse brand fallback. Seam for MinHash on ingredients later.
2. **Pairwise**: features = exact GTIN, name similarity (Jaro-Winkler / token-set), brand match after alias canonicalization, ingredient Jaccard, size match. Weighted sum + threshold (Fellegi-Sunter). Normalize only over *available* features so a missing GTIN drops that signal instead of zeroing. Seam to swap hand weights for a learned logistic regression.
3. **Clustering**: union-find over high-confidence edges → canonical products. (Correlation clustering is the later upgrade.)

**Required tests** with seven toy listings (same product in three barcode formats; a no-barcode stripped-name listing; an indie no-barcode product with its brand written two ways):
- Blocking cuts the 21 possible pairs to a handful.
- All seven resolve into the three correct products, including the no-barcode one.
- **Coverage-bias test**: removing only the indie brand's alias fractures the indie product while big brands stay resolved — assert it. Recall is worse on the tail; this is a real fairness finding, surface it, don't hide it.

## Sonion (the guide mascot)
A small **male** character named **Sonion**; his expression is a second readout of the verdict, not decoration.
- SVG seed with a green sprout, defined straight brows (masculine), no blush. Toggleable parts: open/happy eyes, straight/angled brows, smile/flat/frown/talk mouths.
- Moods from overall score: `happy` (≥70), `neutral` (55–69), `concerned` (<55); transitions animated.
- Idle: blink, slow bob, occasional glance; nod + mouth movement when speaking.
- Reactive: on weight change he comments truthfully via `marginalEffect`, naming the pillar and any verdict-band crossing. Small rotation of low-key lines for negligible changes.
- Floats bottom-right; bubble auto-tucks ~5s and on tap. Real `<button>` + aria-label; respect `prefers-reduced-motion`. Short, plain-spoken, honest copy.

## Design tokens (light mode only; sleek, warm beige, nothing neon)
```
--bg #ECE5D8  --card #FBF9F4  --card-2 #F4EFE5
--ink #2E2A22 --ink-2 #6E675A --ink-3 #A79E8C
--line #E4DBCB --espresso #3A342B --sand #E7DFCF --accent #7C8466 (sparingly)
Verdict: Excellent #5E7B53 · Good #8A9A5E · Fair #B5904A · Poor #BC8255 · Bad #B0655A
Font Manrope (ui-rounded/system fallback) · card radius ~18px · soft low shadow
```
Verdict colors are for ratings only; accent/espresso for chrome. Generous whitespace, hairline separators, tabular numbers, hidden scrollbars.

## Screens
1. **Home**: header, search, simulated "Scan a barcode", Recent list with small verdict-colored score circles; Sonion greets.
2. **Product**: hero ScoreRing (user-weighted, animated), PillarBreakdown, RaterList with disagreement callout, collapsible WeightControls that recompute live, actions "See better options" + "What's flagged"; Sonion narrates/reacts.
3. **Alternatives**: cleaner products near the price, **ranked by safety, never affiliate payout**, each naming what's cleaner and its tradeoff. Keep ranking honest even after a revenue model exists — note this in code.
4. **Flag/disagreement**: ingredient explanation, "where each rater lands" with funding tags + reasoning, other notes as colored dots. This screen is the thesis; don't water it down.

## Data integration
Everything behind `ProductRepository`, mock first. Then `open-beauty-facts.ts`: fetch by barcode, validate with Zod, normalize to Listings + Ratings (open data, avoids EWG/Yuka scraping/licensing), feed through the matcher, expose via `prisma-repository.ts`. Swapping mock→real must not change the UI.

## Constraints / non-goals
Cosmetics only. Never average conflicting same-axis ratings; never persist the overall. User owns the weighting (no hidden "objective" defaults). Funding model always visible with a rating. TS strict, no `any` in domain code; `/lib/domain` and `/lib/matcher` import nothing from React/Next. Accessibility and `prefers-reduced-motion` are requirements. Scan is simulated; no camera/barcode hardware yet.