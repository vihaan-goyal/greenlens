import Link from 'next/link';
import { notFound } from 'next/navigation';
import { mockRepository, ingredientSlug } from '@/lib/data/mock-repository';
import { RaterSpread } from '@/components/RaterSpread';
import { CompositeRange } from '@/components/CompositeRange';
import { WeightControls } from '@/components/WeightControls';

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const view = await mockRepository.getProduct(id);
  if (!view) notFound();

  const { product, brand, pillars } = view;
  const flags = await mockRepository.listIngredientFlags(product.id);
  const alternatives = await mockRepository.listAlternatives(product.id);

  return (
    <main className="px-5 pt-4 pb-6">
      <nav className="mb-5 text-xs text-ink-3">
        <Link href="/" className="hover:text-ink">
          ← back
        </Link>
      </nav>

      <header className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.18em] text-ink-3">{brand.name}</p>
        <h1 className="mt-1 text-[22px] font-semibold leading-tight text-ink">
          {product.displayName}
        </h1>
        <p className="mt-2 text-xs text-ink-2">
          {product.category} · {product.sizeValue}
          {product.sizeUnit}
          {product.gtin && <span> · GTIN {product.gtin}</span>}
        </p>
      </header>

      <section className="mb-7 rounded-card bg-card p-5 shadow-card ring-1 ring-line">
        <RaterSpread pillars={pillars} />
      </section>

      <section className="mb-4 rounded-card bg-card p-5 ring-1 ring-line">
        <CompositeRange pillars={pillars} />
      </section>

      <section className="mb-7">
        <WeightControls />
      </section>

      <section className="mb-7 grid grid-cols-2 gap-3">
        {alternatives.length > 0 ? (
          <Link
            href={`/product/${product.id}/alternatives`}
            className="rounded-card bg-card px-4 py-4 ring-1 ring-line transition hover:ring-accent"
          >
            <p className="text-sm font-medium text-ink">See better options</p>
            <p className="mt-1 text-xs text-ink-2">
              {alternatives.length} cleaner{' '}
              {alternatives.length === 1 ? 'alternative' : 'alternatives'} ranked by ingredient safety.
            </p>
          </Link>
        ) : (
          <div className="rounded-card bg-card-2 px-4 py-4 ring-1 ring-line">
            <p className="text-sm font-medium text-ink">No cleaner alternatives</p>
            <p className="mt-1 text-xs text-ink-2">
              Nothing in the catalog beats this on ingredient safety.
            </p>
          </div>
        )}

        {flags.length > 0 ? (
          <Link
            href={`/product/${product.id}/flag/${flags[0]!.slug}`}
            className="rounded-card bg-card px-4 py-4 ring-1 ring-line transition hover:ring-accent"
          >
            <p className="text-sm font-medium text-ink">What's flagged</p>
            <p className="mt-1 text-xs text-ink-2">
              {flags.length} {flags.length === 1 ? 'ingredient' : 'ingredients'} where raters split.
            </p>
          </Link>
        ) : (
          <div className="rounded-card bg-card-2 px-4 py-4 ring-1 ring-line">
            <p className="text-sm font-medium text-ink">No ingredient flags</p>
            <p className="mt-1 text-xs text-ink-2">No rater has flagged a specific ingredient.</p>
          </div>
        )}
      </section>

      {flags.length > 0 && (
        <section className="mb-7">
          <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">
            Flagged ingredients
          </h2>
          <ul className="space-y-2">
            {flags.map((f) => (
              <li key={f.slug}>
                <Link
                  href={`/product/${product.id}/flag/${f.slug}`}
                  className="flex items-center justify-between rounded-card bg-card px-4 py-3 ring-1 ring-line transition hover:ring-accent"
                >
                  <span className="text-sm text-ink">{f.name}</span>
                  <span className="text-[11px] text-ink-3">
                    {f.positions.length} rater positions →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">
          Ingredients (as labeled)
        </h2>
        <ul className="flex flex-wrap gap-1.5">
          {product.ingredients.map((name) => {
            const slug = ingredientSlug(name);
            const flagged = flags.some((f) => f.slug === slug);
            const inner = (
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] ring-1 ring-line ${
                  flagged ? 'bg-card text-ink' : 'bg-card-2 text-ink-2'
                }`}
              >
                {name}
                {flagged && <span className="ml-1 text-ink-3">·flag</span>}
              </span>
            );
            return (
              <li key={name}>
                {flagged ? (
                  <Link href={`/product/${product.id}/flag/${slug}`}>{inner}</Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
