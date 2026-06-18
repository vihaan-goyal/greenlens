import type { IngredientFlag, Pillars, Weights } from '@/lib/domain/types';
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
  /**
   * Per-ingredient flag entries for this product. Each entry holds every
   * rater's stance + funding model + reasoning — the thesis screen of the
   * product, never aggregated into a single number.
   */
  flags: IngredientFlag[];
  /** 0..1, how confident the matcher is this is the right canonical product. */
  matchConfidence: number;
  /**
   * True when a different, similar product scored almost as well — the match is a
   * best guess, not a sure thing. The card hedges ("closest match") so we never
   * present a near-tie between similar products as certain.
   */
  ambiguous?: boolean;
}

export type BgToContent =
  | { kind: 'verdict'; payload: VerdictPayload }
  | { kind: 'notCosmetic' }
  | { kind: 'noMatch'; rawName: string }
  | { kind: 'weights'; weights: Weights };

// ─── popup → content (via chrome.tabs.sendMessage) ──────────────────────────
// The popup queries the active tab's content script to learn what it's
// currently showing — verdict, unknown, or idle. We don't cache verdicts in
// the SW because MV3 service workers go to sleep; the content script is the
// authoritative view of "what does the user see right now."

export type PopupToContent = { kind: 'getCurrentState' };

export type ContentState =
  | { kind: 'verdict'; payload: VerdictPayload }
  | { kind: 'unknown'; rawName: string }
  | { kind: 'idle' };

/** Returned to popup when the tab is one of ours; otherwise sendMessage rejects. */
export type ContentToPopup = ContentState | { kind: 'none' };

// ─── typed wrappers ─────────────────────────────────────────────────────────
// Thin helpers so callers stop sprinkling `chrome.runtime.sendMessage` with
// untyped object literals. Lives in /shared so popup, content, and options
// all use the same surface. `chrome.*` types come from @types/chrome.

export async function sendToBackground(msg: ContentToBg): Promise<BgToContent> {
  return (await chrome.runtime.sendMessage(msg)) as BgToContent;
}
