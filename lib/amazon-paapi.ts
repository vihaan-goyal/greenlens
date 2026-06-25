/**
 * Amazon Product Advertising API v5 client.
 *
 * Called server-side only — credentials never leave the Next.js process.
 * Results are cached in-process for 1 hour; product metadata changes rarely
 * and PA-API bills per request.
 *
 * Required env vars:
 *   AMAZON_PA_ACCESS_KEY   — PA-API access key (from Associates Central)
 *   AMAZON_PA_SECRET_KEY   — PA-API secret key
 *   AMAZON_PA_PARTNER_TAG  — your Associates tag, e.g. "greenlens-20"
 */

import aws4 from 'aws4';

const HOST = 'webservices.amazon.com';
const REGION = 'us-east-1';
const SERVICE = 'ProductAdvertisingAPI';
// PA-API encodes the operation in both the Content-Type and a separate header.
const TARGET = 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface PaapiItem {
  asin: string;
  title: string;
  brand?: string;
  /** EAN-13 or UPC-A barcode string, unpadded. */
  gtin?: string;
  imageUrl?: string;
  /** Broad Amazon product group, e.g. "Health and Beauty". */
  category?: string;
  priceDisplay?: string;
}

// In-process cache keyed by ASIN.
const _cache = new Map<string, { item: PaapiItem; at: number }>();

/**
 * Fetch a single product from PA-API by ASIN.
 * Returns null when credentials aren't configured or the item isn't found.
 * Never throws — the caller must treat null as "no enrichment available".
 */
export async function fetchPaapiItem(asin: string): Promise<PaapiItem | null> {
  const now = Date.now();
  const hit = _cache.get(asin);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.item;

  const accessKey = process.env.AMAZON_PA_ACCESS_KEY;
  const secretKey = process.env.AMAZON_PA_SECRET_KEY;
  const partnerTag = process.env.AMAZON_PA_PARTNER_TAG;
  if (!accessKey || !secretKey || !partnerTag) return null;

  const body = JSON.stringify({
    ItemIds: [asin],
    Resources: [
      'ItemInfo.Title',
      'ItemInfo.ByLineInfo',
      'ItemInfo.Classifications',
      'ItemInfo.ExternalIds',
      'Images.Primary.Large',
      'Offers.Listings.Price',
    ],
    PartnerTag: partnerTag,
    PartnerType: 'Associates',
    Marketplace: 'www.amazon.com',
  });

  // aws4 signs by mutating the opts.headers object in place.
  const opts = aws4.sign(
    {
      host: HOST,
      method: 'POST',
      path: '/paapi5/getitems',
      service: SERVICE,
      region: REGION,
      headers: {
        'content-type': `application/json; charset=utf-8; x-amz-target=${TARGET}`,
        'x-amz-target': TARGET,
      },
      body,
    },
    { accessKeyId: accessKey, secretAccessKey: secretKey },
  );

  try {
    const res = await fetch(`https://${HOST}/paapi5/getitems`, {
      method: 'POST',
      headers: opts.headers as Record<string, string>,
      body,
    });
    if (!res.ok) {
      console.error('[paapi] error', res.status, await res.text().catch(() => ''));
      return null;
    }
    const json: unknown = await res.json();
    const item = parseItem(json, asin);
    if (item) _cache.set(asin, { item, at: now });
    return item;
  } catch (err) {
    console.error('[paapi] fetch failed', err);
    return null;
  }
}

// ─── Response parsing ────────────────────────────────────────────────────────

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined;
}

function firstStr(v: unknown): string | undefined {
  return Array.isArray(v) ? str(v[0]) : undefined;
}

function parseItem(json: unknown, asin: string): PaapiItem | null {
  const raw = (json as Record<string, unknown> | null)
    ?.ItemsResult as Record<string, unknown> | undefined;
  const items = raw?.Items;
  if (!Array.isArray(items) || !items.length) return null;

  // PA-API may return multiple items; find the one matching our ASIN.
  const r = items.find((i: unknown) =>
    (i as Record<string, unknown>)?.ASIN === asin,
  ) as Record<string, unknown> | undefined;
  if (!r) return null;

  const info = r.ItemInfo as Record<string, unknown> | undefined;
  const title = str((info?.Title as Record<string, unknown>)?.DisplayValue);
  if (!title) return null;

  const byline = info?.ByLineInfo as Record<string, unknown> | undefined;
  const brand =
    str((byline?.Brand as Record<string, unknown>)?.DisplayValue) ??
    str((byline?.Manufacturer as Record<string, unknown>)?.DisplayValue);

  const extIds = info?.ExternalIds as Record<string, unknown> | undefined;
  const eans: string[] =
    ((extIds?.EANs as Record<string, unknown>)?.DisplayValues as string[]) ?? [];
  const upcs: string[] =
    ((extIds?.UPCs as Record<string, unknown>)?.DisplayValues as string[]) ?? [];
  const gtin = firstStr(eans) ?? firstStr(upcs);

  const images = r.Images as Record<string, unknown> | undefined;
  const imageUrl = str(
    ((images?.Primary as Record<string, unknown>)?.Large as Record<string, unknown>)?.URL,
  );

  const classify = info?.Classifications as Record<string, unknown> | undefined;
  const category = str(
    (classify?.ProductGroup as Record<string, unknown>)?.DisplayValue,
  );

  const offers = r.Offers as Record<string, unknown> | undefined;
  const listings = offers?.Listings as unknown[] | undefined;
  const priceDisplay = str(
    ((listings?.[0] as Record<string, unknown>)?.Price as Record<string, unknown>)?.DisplayAmount,
  );

  return { asin, title, brand, gtin, imageUrl, category, priceDisplay };
}
