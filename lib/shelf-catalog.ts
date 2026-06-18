import type { Axis, Pillars } from './domain/types';
import { repository } from './data';

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
}

/**
 * Build the full client lookup table for every catalog product. The catalog is
 * small (seed data), so eagerly resolving all products + their alternatives is
 * cheap and keeps the client free of any async/repository concerns.
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

  const alternatives: Record<string, ShelfBranch[]> = {};
  await Promise.all(
    views.map(async (v) => {
      const alts = await repository.listAlternatives(v.product.id);
      alternatives[v.product.id] = alts.map((a) => ({
        id: a.view.product.id,
        cleaner: a.cleaner,
        tradeoffs: a.tradeoffs,
      }));
    }),
  );

  return { products, alternatives };
}
