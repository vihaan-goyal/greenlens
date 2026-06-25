import { AXES, type Axis, type Pillars } from './domain/types';
import { repository } from './data';
import type { ProductView } from './data/repository';

/**
 * Lookup tables the client shelf needs to render any product it has in history,
 * plus the alternative "branches" growing off each one. Built on the server
 * (the repository is async / server-only) and handed to the client component,
 * which renders only the ids currently on the user's shelf.
 *
 * Alternatives reference products by id into the same `products` table, so a
 * product's pillars are never duplicated across the payload.
 */
export interface ShelfCard {
  id: string;
  displayName: string;
  brandName: string;
  category: string;
  sizeValue?: number;
  sizeUnit?: string;
  pillars: Pillars;
}

export interface ShelfBranch {
  /** Alternative product id — look it up in `products`. */
  id: string;
  /** Axes where the alternative is meaningfully cleaner than the base. */
  cleaner: Array<{ axis: Axis; delta: number }>;
  /** Axes where it's worse — the honest tradeoff. */
  tradeoffs: Array<{ axis: Axis; delta: number }>;
}

export interface ShelfCatalog {
  products: Record<string, ShelfCard>;
  /** base product id → its cleaner alternatives (already safety-ranked). */
  alternatives: Record<string, ShelfBranch[]>;
  /** Full product views — returned so callers can avoid a second listProducts(). */
  views: ProductView[];
}

const DELTA_MIN = 5;

/**
 * Build the full client lookup table for every catalog product.
 *
 * All views are loaded in a single batched query via listProducts(). Alternatives
 * are then computed in-memory from the already-loaded views — no additional DB
 * queries. The old approach called listAlternatives() per product, which fired
 * O(N²) queries (one buildView per same-category peer, per product).
 */
export async function buildShelfCatalog(): Promise<ShelfCatalog> {
  const views = await repository.listProducts();

  const products: Record<string, ShelfCard> = {};
  for (const v of views) {
    products[v.product.id] = {
      id: v.product.id,
      displayName: v.product.displayName,
      brandName: v.brand.name,
      category: v.product.category,
      sizeValue: v.product.sizeValue,
      sizeUnit: v.product.sizeUnit,
      pillars: v.pillars,
    };
  }

  // Group views by category so each base product only scans its own peers.
  const byCategory = new Map<string, ProductView[]>();
  for (const v of views) {
    const cat = v.product.category;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(v);
  }

  const alternatives: Record<string, ShelfBranch[]> = {};
  for (const base of views) {
    const baseSafety = base.pillars.ingredient_safety.representative ?? -Infinity;
    const peers = byCategory.get(base.product.category) ?? [];
    alternatives[base.product.id] = peers
      .filter((v) => v.product.id !== base.product.id)
      .filter((v) => (v.pillars.ingredient_safety.representative ?? -Infinity) > baseSafety)
      .sort(
        (a, b) =>
          (b.pillars.ingredient_safety.representative ?? -Infinity) -
          (a.pillars.ingredient_safety.representative ?? -Infinity),
      )
      .map((alt) => {
        const cleaner: Array<{ axis: Axis; delta: number }> = [];
        const tradeoffs: Array<{ axis: Axis; delta: number }> = [];
        for (const axis of AXES) {
          const a = alt.pillars[axis].representative;
          const b = base.pillars[axis].representative;
          if (a === null || b === null) continue;
          const d = a - b;
          if (d >= DELTA_MIN) cleaner.push({ axis, delta: d });
          else if (d <= -DELTA_MIN) tradeoffs.push({ axis, delta: d });
        }
        return { id: alt.product.id, cleaner, tradeoffs };
      });
  }

  return { products, alternatives, views };
}
