import { mockRepository } from './mock-repository';
import { prismaRepository } from './prisma-repository';
import type { ProductRepository } from './repository';

/**
 * The repository the Next app reads from. Swappable behind the ProductRepository
 * interface. Default is the full ingested SQLite catalog (215+ products); set
 * `GREENLENS_REPO=mock` to fall back to the 17-item in-memory mock — the
 * out-of-the-box path that needs no `db:push`/`db:seed`. Swapping must not change
 * the UI, only how many products it has.
 *
 * Prisma being the default means a fresh clone must seed first (npm run db:push
 * && db:seed && db:ingest); without a dev.db the app fails loudly here rather
 * than silently serving different data.
 *
 * The extension service worker can't run Prisma in the browser, so it imports
 * `mock-repository` directly rather than this accessor.
 */
export const repository: ProductRepository =
  process.env.GREENLENS_REPO === 'mock' ? mockRepository : prismaRepository;

export { ingredientSlug } from './mock-repository';
export type { ProductRepository, ProductView, AlternativeView } from './repository';
