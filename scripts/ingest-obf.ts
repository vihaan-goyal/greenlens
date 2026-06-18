// Open Beauty Facts ingest job.
//
// Two modes:
//   • Barcodes  — fetch specific products one at a time (precise, low volume).
//   • Bulk      — page the OBF search API, pulling full product records 100 at a
//                 time with only the fields we consume, and run each through the
//                 ingestion → matcher pipeline. This is how we load *thousands*
//                 of products without an HTTP round-trip per item.
//
// Persists each result (Listing + Ratings, attached to an existing canonical
// Product or a newly minted one) into the SQLite catalog via
// PrismaProductRepository. Swapping mock→real for the UI is just
// `GREENLENS_REPO=prisma`; this is how that catalog gets real data.
//
// Run (needs DATABASE_URL from .env, and the .ts resolution hook):
//   npm run db:ingest -- 301871239019 3600542525237        # specific barcodes
//   npm run db:ingest -- --search "serum" --limit 2000      # bulk by search term
//   npm run db:ingest -- --packaging --limit 5000           # bulk, packaging-dense
//   npm run db:ingest -- --packaging --page-start 21 --limit 8000  # resume past an earlier run
//   npm run db:ingest -- --filter states_tags=en:packaging-completed --limit 3000
//   npm run db:ingest -- --dry --limit 200                  # resolve only, persist nothing
//
// Idempotent: re-running the same products updates in place rather than
// duplicating. Be a polite OBF citizen — pages are spaced out and carry a
// descriptive User-Agent.

import type { Brand } from '../lib/domain/types';
import type { CatalogEntry } from '../lib/matcher/matcher';
import {
  ingestBarcode,
  ingestProduct,
  obfProductSchema,
  type ObfProduct,
} from '../lib/ingestion/open-beauty-facts';
import { prismaRepository } from '../lib/data/prisma-repository';
import { prisma } from '../lib/data/prisma';

const OBF_SEARCH = 'https://world.openbeautyfacts.org/api/v2/search';
const USER_AGENT = 'Greenlens/0.1 (ingest script; https://github.com/greenlens)';
const REQUEST_SPACING_MS = 250;
const MAX_PAGE_SIZE = 100; // OBF caps search pages at 100.

// Only the fields the schema actually consumes — keeps each page small and fast.
const SEARCH_FIELDS = [
  'code',
  'product_name',
  'brands',
  'quantity',
  'ingredients_text',
  'ingredients',
  'categories',
  'categories_tags',
  'ecoscore_score',
  'ecoscore_grade',
  'packagings',
  'packaging_materials_tags',
  'packaging_tags',
].join(',');

/** fetch with a descriptive UA, as OBF asks of API consumers. */
const politeFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, headers: { ...(init?.headers ?? {}), 'User-Agent': USER_AGENT } });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Args {
  barcodes: string[];
  search: string | null;
  /** Extra OBF search filters as [key, value] pairs (repeatable --filter k=v). */
  filters: Array<[string, string]>;
  /** Total products to pull in bulk mode. */
  limit: number;
  pageSize: number;
  /** First search page to fetch (1-based). Use to resume deep pagination past an
   *  earlier run instead of re-fetching products already in the catalog. */
  pageStart: number;
  dry: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { barcodes: [], search: null, filters: [], limit: 25, pageSize: MAX_PAGE_SIZE, pageStart: 1, dry: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === undefined) continue;
    if (a === '--search') args.search = argv[++i] ?? null;
    else if (a === '--limit') args.limit = Number(argv[++i]) || args.limit;
    else if (a === '--page-size') args.pageSize = Math.min(MAX_PAGE_SIZE, Number(argv[++i]) || args.pageSize);
    else if (a === '--page-start') args.pageStart = Math.max(1, Number(argv[++i]) || args.pageStart);
    else if (a === '--filter') {
      const kv = argv[++i] ?? '';
      const eq = kv.indexOf('=');
      if (eq > 0) args.filters.push([kv.slice(0, eq), kv.slice(eq + 1)]);
    } else if (a === '--packaging') {
      // Convenience: bias the batch toward products with packaging filled in.
      args.filters.push(['states_tags', 'en:packaging-completed']);
    } else if (a === '--dry') args.dry = true;
    else args.barcodes.push(a);
  }
  return args;
}

/** One page of full product records from the OBF search API. */
async function searchPage(
  term: string | null,
  filters: ReadonlyArray<[string, string]>,
  page: number,
  pageSize: number,
): Promise<{ products: ObfProduct[]; pageCount: number; invalid: number }> {
  const params = new URLSearchParams({ fields: SEARCH_FIELDS, page_size: String(pageSize), page: String(page) });
  if (term) params.set('search_terms', term);
  for (const [k, v] of filters) params.set(k, v);

  const res = await politeFetch(`${OBF_SEARCH}?${params}`);
  if (!res.ok) throw new Error(`OBF search failed: ${res.status}`);
  const json = (await res.json()) as { products?: unknown[]; page_count?: number };

  const products: ObfProduct[] = [];
  let invalid = 0;
  for (const raw of json.products ?? []) {
    // External data is never trusted; skip anything that doesn't validate rather
    // than aborting the whole run over one malformed record.
    const parsed = obfProductSchema.safeParse(raw);
    if (parsed.success) products.push(parsed.data);
    else invalid++;
  }
  return { products, pageCount: json.page_count ?? 0, invalid };
}

interface Summary {
  fetched: number;
  notFound: number;
  invalid: number;
  matched: number;
  created: number;
  ratings: number;
  errors: number;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const bulk = args.search !== null || args.filters.length > 0 || args.barcodes.length === 0;

  // Load the canonical catalog once; extend it in memory as we mint products so
  // later items in this run can match products created earlier — no DB round-trip.
  const { catalog, brands } = await prismaRepository.loadMatchContext();
  const liveCatalog: CatalogEntry[] = [...catalog];
  const liveBrands: Brand[] = [...brands];

  const summary: Summary = { fetched: 0, notFound: 0, invalid: 0, matched: 0, created: 0, ratings: 0, errors: 0 };

  // Process one already-resolved {product, raw} through persist (or dry-run).
  const persist = async (product: ObfProduct, raw: unknown) => {
    summary.fetched++;
    const result = ingestProduct(product, raw, liveCatalog, liveBrands);
    summary.ratings += result.ratings.length;
    const name = result.listing.rawName || '(unnamed)';
    if (args.dry) {
      const where = result.match
        ? `→ ${result.match.productId} (${result.match.confidence.toFixed(2)})`
        : '→ would mint new product';
      console.log(`  ?  ${product.code ?? '?'}  ${name}  ${where}`);
      return;
    }
    const { productId, created, newBrand, newEntry } = await prismaRepository.persistIngestResult(result, liveBrands);
    if (newBrand) liveBrands.push(newBrand);
    if (newEntry) liveCatalog.push(newEntry);
    if (created) summary.created++;
    else summary.matched++;
  };

  // ── Specific barcodes (one fetch each) ──────────────────────────────────────
  for (const barcode of args.barcodes) {
    try {
      const result = await ingestBarcode(barcode, liveCatalog, liveBrands, { fetchImpl: politeFetch });
      if (!result) {
        summary.notFound++;
      } else {
        // Re-run through persist via its product? ingestBarcode already resolved;
        // persist its result directly.
        summary.fetched++;
        summary.ratings += result.ratings.length;
        if (args.dry) {
          const where = result.match ? `→ ${result.match.productId}` : '→ would mint';
          console.log(`  ?  ${barcode}  ${result.listing.rawName || '(unnamed)'}  ${where}`);
        } else {
          const { created, newBrand, newEntry } = await prismaRepository.persistIngestResult(result, liveBrands);
          if (newBrand) liveBrands.push(newBrand);
          if (newEntry) liveCatalog.push(newEntry);
          if (created) summary.created++;
          else summary.matched++;
        }
      }
    } catch (e) {
      summary.errors++;
      console.error(`  !  ${barcode}  ${(e as Error).message}`);
    }
    await sleep(REQUEST_SPACING_MS);
  }

  // ── Bulk pagination over the search API ─────────────────────────────────────
  if (bulk) {
    const pageSize = Math.min(args.pageSize, MAX_PAGE_SIZE);
    let collected = 0;
    let page = args.pageStart;
    let lastLog = Date.now();
    while (collected < args.limit) {
      let pageResult;
      try {
        pageResult = await searchPage(args.search, args.filters, page, pageSize);
      } catch (e) {
        summary.errors++;
        console.error(`  !  page ${page}  ${(e as Error).message}`);
        break;
      }
      summary.invalid += pageResult.invalid;
      if (pageResult.products.length === 0) break; // ran out of results

      for (const product of pageResult.products) {
        if (collected >= args.limit) break;
        try {
          await persist(product, { status: 1, product });
          collected++;
        } catch (e) {
          summary.errors++;
          console.error(`  !  ${product.code ?? '?'}  ${(e as Error).message}`);
        }
      }

      // Progress heartbeat at most every ~2s so thousands of items don't spam.
      if (Date.now() - lastLog > 2000) {
        console.log(`  …  page ${page}/${pageResult.pageCount || '?'}  ${collected}/${args.limit} processed`);
        lastLog = Date.now();
      }

      if (pageResult.pageCount && page >= pageResult.pageCount) break; // no more pages
      page++;
      await sleep(REQUEST_SPACING_MS);
    }
  }

  console.log('\nIngest summary:', summary);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
