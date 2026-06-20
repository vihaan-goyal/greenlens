// Pure module — imports nothing from React/Next. The matcher computes
// per-pair features over a normalized MatchableItem shape. Both raw Listings
// and canonical Products project to this shape, so the same scoring/clustering
// code serves batch ingestion and live extension lookups.

/**
 * The smallest projection needed for matching. Everything is optional except
 * id and name — by design, the matcher's job is to make a confident guess
 * from whatever subset of fields survived ingestion.
 */
export interface MatchableItem {
  id: string;
  brand?: string;
  name: string;
  gtin?: string;
  ingredients?: string[];
  sizeValue?: number;
  sizeUnit?: string;
}

/**
 * Feature outcomes for one pair. `undefined` means the feature is *not
 * available* (one side is missing the input). The scorer normalizes only
 * over features that are present, so a missing GTIN drops that signal
 * instead of dragging the score to zero.
 */
export interface FeatureScores {
  /** Both sides have a GTIN AND they normalize to the same 14-digit. */
  gtinExact?: boolean;
  /** Jaro-Winkler over normalized full names, 0..1. */
  nameJaroWinkler?: number;
  /**
   * Token containment over name tokens: |A ∩ B| / min(|A|, |B|), 0..1. Same
   * Szymkiewicz-Simpson overlap used for ingredients, and for the same reason —
   * the catalog holds a short canonical name ("Daily Moisturizing Lotion") while
   * a real Amazon title is a long marketing string ("Aveeno Daily Moisturizing
   * Sheer Hydration Fragrance-Free Lotion with Prebiotic Oat…"). Symmetric
   * Jaccard collapses to near-zero on that length gap even when every catalog
   * token is present; overlap rewards the containment, which is the actual
   * "same product" signal. Brand match + the threshold guard against a short
   * generic name spuriously containing into an unrelated title.
   */
  nameTokenSet?: number;
  /** Canonical brand match after alias resolution. */
  brandMatch?: boolean;
  /**
   * Szymkiewicz-Simpson overlap coefficient over normalized ingredient sets:
   * |A ∩ B| / min(|A|, |B|). Available only when both sides list ≥5
   * ingredients — fewer than that is too noisy and too forgiving.
   *
   * We use overlap instead of Jaccard because the catalog typically holds a
   * shorter canonical ingredient list, while real-world Amazon pages publish
   * the full INCI with many synonyms and inactive carriers. Jaccard punishes
   * that size mismatch even when the catalog's list is fully contained in
   * the page's; overlap rewards the containment, which is the actual
   * "same product" signal.
   */
  ingredientsOverlap?: number;
  /** Same numeric size, same unit family (ml↔ml, oz↔oz). */
  sizeMatch?: boolean;
  /**
   * Variant-token CONFLICT: true when both names expose the same kind of variant
   * marker but the values disagree — "...SPF 60" vs "...SPF 30", shade "...150"
   * vs "...350", "2%" vs "5%", "AM" vs "PM", scent "Lavender" vs "Eucalyptus",
   * color "Nude" vs "Coral", "3 Pack" vs "6 Pack". These are head-brand siblings:
   * they share almost every token but the one that decides which physical product
   * (and which safety data) you're looking at.
   *
   * The name features can't carry this — nameTokenSet is a containment coefficient
   * and nameJaroWinkler is character-level, so both score a sibling pair near-1
   * (every token but one is shared). This is modeled as a one-sided NEGATIVE
   * signal: true is strong "different product" evidence, and the field is left
   * UNDEFINED (neutral) when the variants agree or aren't comparable. Agreement is
   * deliberately not rewarded — the other features already carry a genuine match,
   * and a small "agree" bonus risks dragging a sparse real match (brand+shade
   * only) below threshold. Read off the RAW name, not the normalized one, because
   * normalizeName strips the "%" that distinguishes a concentration token.
   */
  variantConflict?: boolean;
}

/** Public alias so blocking/score don't import directly from a deep file. */
export type FeatureKey = keyof FeatureScores;

// ─── normalizers ────────────────────────────────────────────────────────────

export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizeIngredient(s: string): string {
  // Drop everything but a-z/0-9 so "Ceramide NP" and "ceramide-np" collide.
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// ─── feature computation ────────────────────────────────────────────────────

import type { Brand } from '../domain/types';
import { canonicalizeBrand, normalizeGtin } from './blocking';

export function computeFeatures(
  a: MatchableItem,
  b: MatchableItem,
  brands: ReadonlyArray<Brand>,
): FeatureScores {
  const out: FeatureScores = {};

  const gA = normalizeGtin(a.gtin);
  const gB = normalizeGtin(b.gtin);
  // Asymmetric on purpose: a TRUE GTIN match is strong positive evidence of
  // same product (and earns the heaviest feature weight in score.ts). A FALSE
  // non-match is *not* strong negative evidence — Amazon assigns different
  // UPCs to product variants (refills, size SKUs, region packs) that are
  // still the same canonical product. So on mismatch we omit the feature
  // entirely and let brand + name + ingredients decide.
  if (gA && gB && gA === gB) out.gtinExact = true;

  const nA = normalizeName(a.name);
  const nB = normalizeName(b.name);
  if (nA && nB) {
    out.nameJaroWinkler = jaroWinkler(nA, nB);
    out.nameTokenSet = overlapCoefficient(new Set(nA.split(' ')), new Set(nB.split(' ')));
  }

  if (a.brand && b.brand) {
    const ca = canonicalizeBrand(a.brand, brands);
    const cb = canonicalizeBrand(b.brand, brands);
    if (ca && cb) out.brandMatch = ca === cb;
  }

  if (
    a.ingredients && b.ingredients &&
    a.ingredients.length >= 5 && b.ingredients.length >= 5
  ) {
    const aSet = new Set(a.ingredients.map(normalizeIngredient).filter(Boolean));
    const bSet = new Set(b.ingredients.map(normalizeIngredient).filter(Boolean));
    if (aSet.size >= 5 && bSet.size >= 5) {
      out.ingredientsOverlap = overlapCoefficient(aSet, bSet);
    }
  }

  if (
    a.sizeValue != null && b.sizeValue != null && a.sizeUnit && b.sizeUnit
  ) {
    out.sizeMatch = sizesEqual(a.sizeValue, a.sizeUnit, b.sizeValue, b.sizeUnit);
  }

  if (variantTokensConflict(a.name, b.name)) out.variantConflict = true;

  return out;
}

// ─── variant tokens ───────────────────────────────────────────────────────────
// Markers that distinguish near-identical SKUs of the same brand. Each kind is a
// real sibling case (see eval-pairs.ts for the numeric ones). Deliberately NOT
// included: size/quantity (owned by sizeMatch). Note "pack" is a pack-COUNT
// (3-pack vs 6-pack — distinct retail SKUs), NOT a "Refill" repackage; the count
// regex below never matches the bare word "Refill" (eval e6 stays a match).
//
// Numeric/single-valued kinds (spf, pct, ampm, shade, pack) conflict when their
// one value disagrees. Open-vocabulary kinds (scent, color) are stored as a
// `|`-joined sorted word SET and conflict only when both sets are non-empty and
// DISJOINT — so "Coconut & Vanilla" vs "Vanilla" (overlap) is not a conflict,
// guarding against a truncated sighting splitting from its own product.

/**
 * Parse variant markers off a raw product name into a `kind → value` map.
 * Operates on the raw (un-normalized) name so the "%" on a concentration and
 * the digits glued to a unit ("32ml") survive for the rules below.
 */
export function extractVariantTokens(name: string): Map<string, string> {
  const s = name.toLowerCase();
  const tokens = new Map<string, string>();

  const spf = s.match(/\bspf\s*(\d+)/);
  if (spf) tokens.set('spf', spf[1]!);

  // Active concentration — needs the literal "%", so this must run on the raw name.
  const pct = s.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pct) tokens.set('pct', pct[1]!);

  // Day/night formula marker (CeraVe AM vs PM).
  const ampm = s.match(/\b(am|pm)\b/);
  if (ampm) tokens.set('ampm', ampm[1]!);

  const shade = shadeNumber(s);
  if (shade) tokens.set('shade', shade);

  const pack = packCount(s);
  if (pack) tokens.set('pack', pack);

  const words = s.match(/[a-z]+/g) ?? [];
  const scent = matchVocab(words, SCENT_WORDS);
  if (scent) tokens.set('scent', scent);
  const color = matchVocab(words, COLOR_WORDS);
  if (color) tokens.set('color', color);

  return tokens;
}

/** Kinds whose value is a `|`-joined word set, compared by set-disjointness. */
const SET_KINDS: ReadonlySet<string> = new Set(['scent', 'color']);

/**
 * A retail pack-count ("3 Pack", "2-Count", "6ct", "Pack of 2"). The bare word
 * "Refill" is intentionally not a count, so a refill repackage (eval e6) is never
 * read as a pack conflict.
 */
function packCount(s: string): string | null {
  const m =
    s.match(/\b(\d+)\s*[- ]?(?:packs?|count|ct)\b/) ?? s.match(/\bpack of\s*(\d+)\b/);
  return m ? m[1]! : null;
}

/** Sorted, `|`-joined set of `vocab` words present in `words`, or null if none. */
function matchVocab(words: ReadonlyArray<string>, vocab: ReadonlySet<string>): string | null {
  const found = new Set<string>();
  for (const w of words) if (vocab.has(w)) found.add(w);
  return found.size === 0 ? null : [...found].sort().join('|');
}

// Concrete fragrance/flavor nouns. Curated allowlist (recall-limited on purpose,
// like blocking's STOPWORDS): a known word is a reliable signal; an unlisted one
// is just neutral. Generic scent-family words ("fresh", "floral") are excluded —
// too polysemous to discriminate.
const SCENT_WORDS: ReadonlySet<string> = new Set([
  'lavender', 'vanilla', 'rose', 'jasmine', 'citrus', 'lemon', 'lime', 'orange',
  'grapefruit', 'bergamot', 'mint', 'peppermint', 'spearmint', 'menthol',
  'eucalyptus', 'coconut', 'almond', 'cucumber', 'chamomile', 'sandalwood',
  'cedarwood', 'patchouli', 'neroli', 'gardenia', 'magnolia', 'peony', 'lilac',
  'berry', 'strawberry', 'raspberry', 'blackberry', 'blueberry', 'cherry',
  'peach', 'apricot', 'mango', 'pineapple', 'papaya', 'watermelon', 'pomegranate',
  'lychee', 'melon', 'fig', 'plum', 'pear', 'apple', 'grape', 'ginger',
  'cinnamon', 'clove', 'nutmeg', 'pumpkin', 'caramel', 'chocolate', 'mocha',
  'espresso', 'hazelnut', 'vetiver', 'musk', 'amber',
]);

// Concrete makeup shade/color nouns. Generic intensity words ("light", "medium",
// "deep", "dark", "fair") are excluded: they double as texture/coverage/skincare
// descriptors ("deep hydration", "light lotion") and would mis-fire as colors.
const COLOR_WORDS: ReadonlySet<string> = new Set([
  'nude', 'beige', 'ivory', 'porcelain', 'sand', 'fawn', 'chestnut', 'praline',
  'toffee', 'mahogany', 'taupe', 'mauve', 'bronze', 'copper', 'coral', 'crimson',
  'scarlet', 'ruby', 'burgundy', 'blush', 'ebony', 'bisque', 'buff', 'honey',
  'caramel', 'golden', 'gold', 'silver', 'pink', 'plum', 'berry', 'wine', 'cocoa',
  'espresso', 'mocha', 'almond',
]);

/**
 * A makeup shade number. Prefers an explicit "shade N"; otherwise, only in a
 * shaded-product context (foundation/concealer/…), the trailing bare integer
 * that isn't the SPF number and isn't glued-or-spaced to a size unit. The
 * `\b…\b` guard already skips "32ml" (no boundary before the unit); the
 * lookahead additionally skips the spaced "32 ml" form.
 */
function shadeNumber(s: string): string | null {
  const explicit = s.match(/\bshade\s*(?:no\.?\s*)?(\d{1,4})\b/);
  if (explicit) return explicit[1]!;
  if (!/\b(foundation|concealer|corrector|tint|cushion|powder)\b/.test(s)) return null;
  const spf = s.match(/\bspf\s*(\d+)/)?.[1];
  const candidates = [...s.matchAll(/\b(\d{2,4})\b(?!\s*(?:ml|oz|g|kg|l|fl|ounce|ounces|gram|grams|pack|count|ct))/g)]
    .map((m) => m[1]!)
    .filter((n) => n !== spf);
  return candidates.length ? candidates[candidates.length - 1]! : null;
}

/**
 * True when the two names share a variant kind whose values disagree (different
 * SKU). A shared-and-agreeing kind, or no shared kind, is not a conflict. Set
 * kinds (scent/color) conflict on disjoint sets; single kinds on unequal values.
 */
export function variantTokensConflict(nameA: string, nameB: string): boolean {
  const a = extractVariantTokens(nameA);
  const b = extractVariantTokens(nameB);
  for (const [kind, valA] of a) {
    const valB = b.get(kind);
    if (valB === undefined) continue;
    const conflict = SET_KINDS.has(kind)
      ? setsDisjoint(valA, valB)
      : !variantValuesEqual(kind, valA, valB);
    if (conflict) return true;
  }
  return false;
}

function variantValuesEqual(kind: string, a: string, b: string): boolean {
  if (kind === 'ampm') return a === b;
  // Numeric kinds: compare by value so "030" === "30" and "2" === "2.0".
  return Number(a) === Number(b);
}

/** Two `|`-joined word sets share no member. */
function setsDisjoint(a: string, b: string): boolean {
  const bs = new Set(b.split('|'));
  for (const x of a.split('|')) if (bs.has(x)) return false;
  return true;
}

/**
 * Rewrite the first variant token in `name` to a different value, yielding the
 * name of a genuinely different SKU. Used to mint hard training negatives — the
 * mutated name matches on everything except variantConflict. Returns null when
 * the name carries no mutable token. Deterministic (no rng) so a product's
 * variant negative is stable.
 */
export function mutateVariantToken(name: string): string | null {
  const spf = name.match(/\bspf\s*\d+/i);
  if (spf) {
    const v = Number(spf[0].match(/\d+/)![0]);
    return name.replace(spf[0], spf[0].replace(/\d+/, String(v >= 50 ? 30 : v + 20)));
  }
  const pct = name.match(/\d+(?:\.\d+)?\s*%/);
  if (pct) {
    const v = Number(pct[0].match(/\d+(?:\.\d+)?/)![0]);
    return name.replace(pct[0], pct[0].replace(/\d+(?:\.\d+)?/, String(v >= 5 ? 1 : v + 5)));
  }
  const ampm = name.match(/\b(am|pm)\b/i);
  if (ampm) {
    return name.replace(ampm[0], ampm[1]!.toLowerCase() === 'am' ? 'PM' : 'AM');
  }
  const shade = shadeNumber(name.toLowerCase());
  if (shade) {
    const re = new RegExp(`\\b${shade}\\b`, 'g');
    let last = -1;
    for (const m of name.matchAll(re)) last = m.index!;
    if (last >= 0) {
      return name.slice(0, last) + String(Number(shade) + 100) + name.slice(last + shade.length);
    }
  }
  const pack = name.match(/\b(\d+)(\s*[- ]?(?:packs?|count|ct))\b/i);
  if (pack) {
    const v = Number(pack[1]);
    return name.replace(pack[0], `${v >= 2 ? 1 : v + 1}${pack[2]}`);
  }
  return mutateDescriptor(name, SCENT_WORDS) ?? mutateDescriptor(name, COLOR_WORDS);
}

/** Swap the first `vocab` word in `name` for a different one not already present. */
function mutateDescriptor(name: string, vocab: ReadonlySet<string>): string | null {
  const words = name.toLowerCase().match(/[a-z]+/g) ?? [];
  const present = new Set(words.filter((w) => vocab.has(w)));
  if (present.size === 0) return null;
  const replacement = [...vocab].find((w) => !present.has(w));
  if (!replacement) return null;
  const target = [...present][0]!;
  return name.replace(new RegExp(`\\b${target}\\b`, 'i'), replacement);
}

function sizesEqual(va: number, ua: string, vb: number, ub: string): boolean {
  const norm = (u: string) => u.toLowerCase().replace(/\.?$/, '');
  if (norm(ua) !== norm(ub)) return false;
  return Math.abs(va - vb) < 0.5;
}

// ─── string similarity ──────────────────────────────────────────────────────

/**
 * Jaro similarity. Standard implementation: matching characters within a
 * window of max(|s1|,|s2|)/2 - 1, then a half-count of transpositions.
 */
export function jaroSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  if (!s1.length || !s2.length) return 0;
  const matchWindow = Math.max(0, Math.floor(Math.max(s1.length, s2.length) / 2) - 1);
  const a1 = new Array<boolean>(s1.length).fill(false);
  const a2 = new Array<boolean>(s2.length).fill(false);
  let matches = 0;
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(s2.length - 1, i + matchWindow);
    for (let j = start; j <= end; j++) {
      if (a2[j]) continue;
      if (s1[i] !== s2[j]) continue;
      a1[i] = true;
      a2[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let k = 0;
  let transpositions = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!a1[i]) continue;
    while (!a2[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }
  transpositions /= 2;
  return (matches / s1.length + matches / s2.length + (matches - transpositions) / matches) / 3;
}

/** Jaro-Winkler with the standard 0.1 boost per matching prefix char (up to 4). */
export function jaroWinkler(s1: string, s2: string, p = 0.1): number {
  const jaro = jaroSimilarity(s1, s2);
  if (jaro === 0) return 0;
  let prefix = 0;
  const maxPrefix = Math.min(4, Math.min(s1.length, s2.length));
  while (prefix < maxPrefix && s1[prefix] === s2[prefix]) prefix++;
  return jaro + prefix * p * (1 - jaro);
}

export function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const x of a) if (b.has(x)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Szymkiewicz-Simpson overlap coefficient — see ingredientsOverlap above for
 * why this beats Jaccard for asymmetric set comparisons.
 */
export function overlapCoefficient<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const x of a) if (b.has(x)) intersection++;
  return intersection / Math.min(a.size, b.size);
}
