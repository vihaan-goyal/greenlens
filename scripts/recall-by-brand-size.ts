// Recall-by-brand-size: is the matcher's recall worse on the tail?
//
// The coverage-bias *unit test* (matcher.test.ts) proves the mechanism on a toy
// corpus. This script measures the same fairness property on the *real* ingested
// catalog. It groups products by how many products their canonical brand has —
// a data-derived proxy for brand size — then round-trips an Amazon-style sighting
// (brand-prefixed, marketing-suffixed, GTIN dropped, as a real product page would
// be) through the live `resolveItem` and reports, per size bucket:
//   • recall: how often a product resolves back to itself, confidently;
//   • the failure breakdown (ambiguous / wrong / unresolved);
//   • a data-richness profile (GTIN coverage, ingredient depth, name length).
//
// Recall is measured over a *stratified* sample (so the small tail is actually
// represented) but each probe is always scored against the *whole* catalog. The
// richness profile is computed over the full catalog. This is the number that
// tells us whether a learned matcher would be worth it — and whether it should be
// tuned to help the tail (see CLAUDE.md: surface the gap, don't average it away).
//
// Run (needs DATABASE_URL from .env, and the .ts resolution hook):
//   npm run db:recall
//   npm run db:recall -- --per-bucket 400          # bigger sample per bucket
//   npm run db:recall -- --per-bucket 5000         # whole catalog (no sampling)
//   npm run db:recall -- --keep-gtin               # sightings carry the barcode
//   npm run db:recall -- --seed 7                  # different reproducible sample

import { prismaRepository } from '../lib/data/prisma-repository';
import { mulberry32 } from '../lib/matcher/labeling';
import type { CatalogEntry } from '../lib/matcher/matcher';
import {
  aggregateByBucket,
  brandSizeByProduct,
  bucketForCount,
  measureRecall,
  profileByBucket,
  SIZE_BUCKETS,
  type BucketProfile,
  type BucketRecall,
  type SizeBucket,
} from '../lib/matcher/recall';

const DEFAULT_PER_BUCKET = 250;

interface Args {
  perBucket: number;
  keepGtin: boolean;
  seed: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { perBucket: DEFAULT_PER_BUCKET, keepGtin: false, seed: 1234 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--per-bucket') args.perBucket = Number(argv[++i]) || DEFAULT_PER_BUCKET;
    else if (a === '--keep-gtin') args.keepGtin = true;
    else if (a === '--seed') args.seed = Number(argv[++i]) || args.seed;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { catalog, brands } = await prismaRepository.loadMatchContext();
  const sizeByProduct = brandSizeByProduct(catalog, brands);

  // Stratified sample: up to `perBucket` probes from each bucket so the tail is
  // represented even though it's a minority of the catalog.
  const byBucket = new Map<SizeBucket, CatalogEntry[]>();
  for (const b of SIZE_BUCKETS) byBucket.set(b, []);
  for (const e of catalog) {
    byBucket.get(bucketForCount(sizeByProduct.get(e.productId) ?? 1))!.push(e);
  }
  // Seeded shuffle so the stratified sample — and therefore the reported numbers —
  // is reproducible run to run. Without this, two runs draw different samples and a
  // before/after comparison is confounded by sampling noise rather than the matcher.
  const rng = mulberry32(args.seed);
  const probes = SIZE_BUCKETS.flatMap((b) => shuffle(byBucket.get(b)!, rng).slice(0, args.perBucket));

  const outcomes = measureRecall(probes, catalog, brands, sizeByProduct, {
    keepGtin: args.keepGtin,
  });
  const recall = aggregateByBucket(outcomes);
  const profile = profileByBucket(catalog, brands, sizeByProduct);

  printReport(catalog.length, probes.length, args, recall, profile);

  await disconnect();
}

function printReport(
  catalogSize: number,
  sampled: number,
  args: Args,
  recall: BucketRecall[],
  profile: BucketProfile[],
) {
  const profByBucket = new Map(profile.map((p) => [p.bucket, p]));
  const BUCKET_DESC: Record<SizeBucket, string> = {
    tail: 'tail (1 SKU)',
    small: 'small (2-4)',
    mid: 'mid (5-19)',
    head: 'head (20+)',
  };

  console.log(
    `\nRECALL-BY-BRAND-SIZE  |  catalog ${catalogSize} products  |  sampled ${sampled}  |  ` +
      `sighting GTIN ${args.keepGtin ? 'kept' : 'dropped'}\n`,
  );
  console.log(
    pad('bucket', 14) + pad('products', 10) + pad('brands', 8) +
      pad('recall', 9) + pad('ambig', 8) + pad('wrong', 8) + pad('unres', 8) +
      pad('gtin%', 8) + pad('ing.', 7) + 'name',
  );
  console.log('-'.repeat(94));

  for (const b of SIZE_BUCKETS) {
    const r = recall.find((x) => x.bucket === b)!;
    const p = profByBucket.get(b)!;
    console.log(
      pad(BUCKET_DESC[b], 14) +
        pad(String(p.products), 10) +
        pad(String(p.brands), 8) +
        pad(r.total === 0 ? '—' : pct(r.recall), 9) +
        pad(String(r.ambiguous), 8) +
        pad(String(r.wrong), 8) +
        pad(String(r.unresolved), 8) +
        pad(pct(p.gtinCoverage), 8) +
        pad(p.meanIngredients.toFixed(1), 7) +
        p.meanNameTokens.toFixed(1),
    );
  }

  // Surface the spread honestly, in whichever direction it falls: best vs worst
  // populated bucket, plus where the ambiguity (the precision risk) concentrates.
  const populated = recall.filter((r) => r.total > 0);
  if (populated.length > 0) {
    const worst = populated.reduce((a, b) => (b.recall < a.recall ? b : a));
    const best = populated.reduce((a, b) => (b.recall > a.recall ? b : a));
    const gap = best.recall - worst.recall;
    const ambiguous = populated.reduce((a, b) =>
      b.ambiguous / b.total > a.ambiguous / a.total ? b : a,
    );
    console.log('');
    if (gap > 0.02) {
      console.log(
        `GAP: recall ranges ${pct(worst.recall)} (${worst.bucket}) … ${pct(best.recall)} (${best.bucket}) ` +
          `— a ${pct(gap)} spread by brand size. Surfaced, not averaged away.`,
      );
    } else {
      console.log(`No material recall gap by brand size (≤2pts across buckets).`);
    }
    console.log(
      `Ambiguity concentrates in the ${ambiguous.bucket} bucket ` +
        `(${ambiguous.ambiguous}/${ambiguous.total} near-ties) — lookalike same-brand SKUs, ` +
        `the failure mode the tail (single-SKU brands) can't hit.`,
    );
  }
  console.log('');
}

// ── formatting helpers ────────────────────────────────────────────────────────

function pad(s: string, w: number): string {
  return s.length >= w ? s + ' ' : s + ' '.repeat(w - s.length);
}

function pct(x: number): string {
  return `${(x * 100).toFixed(0)}%`;
}

function shuffle<T>(a: T[], rng: () => number): T[] {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [x[i], x[j]] = [x[j]!, x[i]!];
  }
  return x;
}

async function disconnect() {
  const { prisma } = await import('../lib/data/prisma');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
