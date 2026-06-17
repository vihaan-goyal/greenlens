import type { RawProductSighting } from '../../shared/sighting';

/**
 * Per-site adapter contract. Adapters are pure functions of (Document, url)
 * → sighting | null. The DOM walk lives in the adapter; everything downstream
 * is site-agnostic. Tests drive each adapter from snapshotted HTML fixtures.
 */
export interface SiteAdapter {
  readonly id: RawProductSighting['source'];
  /** Cheap URL gate — return false to skip the heavier DOM extraction. */
  matches(url: string): boolean;
  /** Returns null when the page isn't a product page (search results, etc.). */
  extract(doc: Document, url: string): RawProductSighting | null;
}
