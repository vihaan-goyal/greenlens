// Open Beauty Facts ingest job.
//
// Fetches products by barcode from OBF, runs each through the ingestion →
// matcher pipeline, and persists the result (Listing + Ratings, attached to an
// existing canonical Product or a newly minted one) into the SQLite catalog via
// PrismaProductRepository. Swapping mock→real for the UI is just
// `GREENLENS_REPO=prisma`; this is how that catalog gets real data.
//
// Run (needs DATABASE_URL from .env, and the .ts resolution hook):
//   npm run db:ingest -- 301871239019 3600542525237
//   npm run db:ingest -- --search "serum" --limit 30
//   npm run db:ingest -- --dry 301871239019      # resolve only, persist nothing
//
// Idempotent: re-running the same barcodes updates in place rather than
// duplicating. Be a polite OBF citizen — requests are spaced out and carry a
// descriptive User-Agent.

import type { Brand } from '../lib/domain/types';
import type { CatalogEntry } from '../lib/matcher/matcher';
import { ingestBarcode } from '../lib/ingestion/open-beauty-facts';
import { prismaRepository } from '../lib/data/prisma-repository';
import { prisma } from '../lib/data/prisma';

const OBF_SEARCH = 'https://world.openbeautyfacts.org/api/v2/search';
const USER_AGENT = 'Greenlens/0.1 (ingest script; https://github.com/greenlens)';
const REQUEST_SPACING_MS = 250;

/** fetch with a descriptive UA, as OBF asks of API consumers. */
const politeFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, headers: { ...(init?.headers ?? {}), 'User-Agent': USER_AGENT } });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Args {
  barcodes: string[];
  search: string | null;
  limit: number;
  dry: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { barcodes: [], search: null, limit: 25, dry: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === undefined) continue;
    if (a === '--search') args.search = argv[++i] ?? null;
    else if (a === '--limit') args.limit = Number(argv[++i]) || args.limit;
    else if (a === '--dry') args.dry = true;
    else args.barcodes.push(a);
  }
  return args;
}

/** Pull a page of barcodes from the OBF search API. */
async function searchCodes(term: string | null, limit: number): Promise<string[]> {
  const params = new URLSearchParams({ fields: 'code', page_size: String(limit) });
  if (term) params.set('search_terms', term);
  const res = await politeFetch(`${OBF_SEARCH}?${params}`);
  if (!res.ok) throw new Error(`OBF search failed: ${res.status}`);
  const json = (await res.json()) as { products?: Array<{ code?: string }> };
  return (json.products ?? []).map((p) => p.code).filter((c): c is string => !!c);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const barcodes = [...args.barcodes];
  if (args.search !== null || args.barcodes.length === 0) {
    const found = await searchCodes(args.search, args.limit);
    barcodes.push(...found);
  }
  if (barcodes.length === 0) {
    console.error('Nothing to ingest. Pass barcodes, or --search <term> [--limit N].');
    process.exit(1);
  }

  // Load the canonical catalog once; extend it in memory as we mint products so
  // later barcodes in this run can match products created earlier.
  const { catalog, brands } = await prismaRepository.loadMatchContext();
  const liveCatalog: CatalogEntry[] = [...catalog];
  const liveBrands: Brand[] = [...brands];

  const summary = { fetched: 0, notFound: 0, matched: 0, created: 0, ratings: 0, errors: 0 };

  for (const barcode of barcodes) {
    try {
      const result = await ingestBarcode(barcode, liveCatalog, liveBrands, {
        fetchImpl: politeFetch,
      });
      if (!result) {
        summary.notFound++;
        console.log(`  ·  ${barcode}  not in OBF`);
        await sleep(REQUEST_SPACING_MS);
        continue;
      }
      summary.fetched++;
      summary.ratings += result.ratings.length;

      const name = result.listing.rawName || '(unnamed)';
      if (args.dry) {
        const where = result.match
          ? `→ ${result.match.productId} (${result.match.confidence.toFixed(2)})`
          : '→ would mint new product';
        console.log(`  ?  ${barcode}  ${name}  ${where}`);
      } else {
        const { productId, created, newBrand, newEntry } = await prismaRepository.persistIngestResult(
          result,
          liveBrands,
        );
        if (newBrand) liveBrands.push(newBrand);
        if (newEntry) liveCatalog.push(newEntry);
        if (created) summary.created++;
        else summary.matched++;
        const verb = created ? 'minted ' : 'matched';
        console.log(
          `  ${created ? '+' : '='}  ${barcode}  ${name}  ${verb} ${productId}` +
            `  (+${result.ratings.length} rating${result.ratings.length === 1 ? '' : 's'})`,
        );
      }
    } catch (e) {
      summary.errors++;
      console.error(`  !  ${barcode}  ${(e as Error).message}`);
    }
    await sleep(REQUEST_SPACING_MS);
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
