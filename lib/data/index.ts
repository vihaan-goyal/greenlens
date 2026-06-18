import { mockRepository } from './mock-repository';
import { prismaRepository } from './prisma-repository';
import type { ProductRepository } from './repository';

/**
 * The repository the Next app reads from. Swappable behind the ProductRepository
 * interface — `GREENLENS_REPO=prisma` reads the seeded SQLite catalog, anything
 * else (the default) uses the in-memory mock. Swapping must not change the UI.
 *
 * The extension service worker can't run Prisma in the browser, so it imports
 * `mock-repository` directly rather than this accessor.
 */
export const repository: ProductRepository =
  process.env.GREENLENS_REPO === 'prisma' ? prismaRepository : mockRepository;

export { ingredientSlug } from './mock-repository';
export type { ProductRepository, ProductView, AlternativeView } from './repository';
