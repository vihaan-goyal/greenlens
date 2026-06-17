// Pure module — imports nothing from React/Next.
// Stage 1 of the matcher: blocking. Cheap keys that group items into small
// candidate buckets so we never have to score every n² pair.
//
// Keys per item:
//   gtin:<14-digit>        normalized so UPC-A/EAN-13/GTIN-14 collide
//   brand+token:<id>:<t>   canonical brand id × first non-stopword name token
//   brand:<id>             coarse fallback so a stripped name still matches
//
// Seam: ingredient MinHash blocks plug in here later for the long-tail no-
// barcode case. The signature (item → keys) stays the same; only new keys
// get added.

import type { Brand } from '../domain/types';
import type { MatchableItem } from './features';

/**
 * Strip non-digits and left-pad to 14. UPC-A is 12, EAN-13 is 13, GTIN-14 is
 * 14 — padded, they collide on the same physical product. Rejects strings
 * that aren't plausible barcodes (too short or too long after stripping).
 */
export function normalizeGtin(raw: string | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D+/g, '');
  if (digits.length < 8 || digits.length > 14) return null;
  return digits.padStart(14, '0');
}

/**
 * Canonical brand id from a raw brand string. Tries each brand's name + every
 * alias under a normalize-strip transform (lowercase, strip non-alphanumeric)
 * so "BigB", "Big B", "big-b" all collide. Falls back to the normalized raw
 * so two listings with the same unknown brand still cluster.
 */
export function canonicalizeBrand(
  raw: string | undefined,
  brands: ReadonlyArray<Brand>,
): string | null {
  if (!raw) return null;
  const norm = stripNorm(raw);
  if (!norm) return null;
  for (const b of brands) {
    const candidates = [b.name, ...b.aliases].map(stripNorm);
    if (candidates.includes(norm)) return b.id;
  }
  return norm; // unknown brand — same normalized string still collides across listings
}

function stripNorm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * First non-stopword token of length ≥3 in the name, lower-cased. Used so
 * "Daily Glow Serum" and "Daily Glow Serum 30ml" share a brand+token key.
 */
export function firstNameToken(name: string): string | null {
  const tokens = name.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
  for (const t of tokens) {
    if (!STOPWORDS.has(t) && t.length >= 3) return t;
  }
  return null;
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'oz', 'ounce', 'ml', 'pack', 'size',
  'free', 'new', 'daily', 'body', 'face', 'all',
]);

export function blockKeys(item: MatchableItem, brands: ReadonlyArray<Brand>): string[] {
  const keys: string[] = [];
  const gtin = normalizeGtin(item.gtin);
  if (gtin) keys.push(`gtin:${gtin}`);
  const brandId = canonicalizeBrand(item.brand, brands);
  const firstTok = firstNameToken(item.name);
  if (brandId && firstTok) keys.push(`brand+token:${brandId}:${firstTok}`);
  if (brandId) keys.push(`brand:${brandId}`);
  return keys;
}

export interface CandidatePair {
  a: string;
  b: string;
  /** Which block key surfaced this pair — kept for telemetry / debugging. */
  via: string;
}

/**
 * From a batch of items, return the deduped candidate pairs surfaced by any
 * block key. Order within a pair is canonical (a < b lexically).
 */
export function generateCandidatePairs(
  items: ReadonlyArray<MatchableItem>,
  brands: ReadonlyArray<Brand>,
): CandidatePair[] {
  const buckets = new Map<string, string[]>();
  for (const it of items) {
    for (const k of blockKeys(it, brands)) {
      const arr = buckets.get(k) ?? [];
      arr.push(it.id);
      buckets.set(k, arr);
    }
  }
  const seen = new Set<string>();
  const out: CandidatePair[] = [];
  for (const [k, ids] of buckets) {
    if (ids.length < 2) continue;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i]!;
        const b = ids[j]!;
        const [lo, hi] = a < b ? [a, b] : [b, a];
        const sig = `${lo}|${hi}`;
        if (seen.has(sig)) continue;
        seen.add(sig);
        out.push({ a: lo, b: hi, via: k });
      }
    }
  }
  return out;
}
