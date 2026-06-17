import type { Pillars, Weights } from '@/lib/domain/types';
import type { ProductView } from '@/lib/data/repository';
import type { RawProductSighting } from './sighting';

/**
 * One discriminated union per direction. Both ends import this file so
 * adapter, content script, popup, and SW agree on the wire shape.
 *
 * Wire rule: send Pillars + weights separately. The overall composite is
 * computed at render time from the user's current weights — we never put a
 * single blended number on the wire. (CLAUDE.md's one rule, enforced at the
 * boundary.)
 */

// ─── content → SW ───────────────────────────────────────────────────────────

export type ContentToBg =
  | { kind: 'sighting'; sighting: RawProductSighting }
  | { kind: 'getWeights' };

// ─── SW → content ───────────────────────────────────────────────────────────

export interface VerdictPayload {
  product: ProductView['product'];
  brand: ProductView['brand'];
  pillars: Pillars;
  sources: ProductView['sources'];
  /** 0..1, how confident the matcher is this is the right canonical product. */
  matchConfidence: number;
}

export type BgToContent =
  | { kind: 'verdict'; payload: VerdictPayload }
  | { kind: 'notCosmetic' }
  | { kind: 'noMatch'; rawName: string }
  | { kind: 'weights'; weights: Weights };

// ─── typed wrappers ─────────────────────────────────────────────────────────
// Thin helpers so callers stop sprinkling `chrome.runtime.sendMessage` with
// untyped object literals. Lives in /shared so popup, content, and options
// all use the same surface. `chrome.*` types come from @types/chrome.

export async function sendToBackground(msg: ContentToBg): Promise<BgToContent> {
  return (await chrome.runtime.sendMessage(msg)) as BgToContent;
}
