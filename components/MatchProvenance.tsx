import { AXES, type Pillars } from '@/lib/domain/types';
import { coverageSummary } from '@/lib/domain/provenance';

/**
 * Honest coverage + match-quality note for a product. A rating shown on a
 * product is an implicit claim that it's *about* that product, and the product's
 * overall picture is only as complete as the sources that reach it. This card
 * states both plainly: how many sources cover how many axes, whether any rest on
 * a weak/unreviewed match, and the standing fairness reminder that smaller-brand
 * products get thinner coverage — so a missing rating is not a clean bill of
 * health. Pure presentation of `pillars`; no scores, no weights.
 */
export function MatchProvenance({ pillars }: { pillars: Pillars }) {
  const c = coverageSummary(pillars);
  if (c.sourceCount === 0) return null;

  const total = AXES.length;
  const clean = !c.hasUnreviewed && !c.sparseCoverage;

  const caveats: { text: string; caution: boolean }[] = [];
  if (c.hasWeak) {
    caveats.push({
      text:
        'At least one rating was auto-linked to this product on a low-confidence match — it may describe a different size or variant.',
      caution: true,
    });
  } else if (c.hasUnreviewed) {
    caveats.push({
      text: 'Some ratings rest on an automatic match that has not been human-reviewed.',
      caution: false,
    });
  }
  if (c.sparseCoverage) {
    caveats.push({
      text:
        'Fewer raters reach smaller-brand products, so a missing rating is not a clean bill of health — only a gap.',
      caution: false,
    });
  }

  return (
    <div
      className="rounded-card p-4"
      style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-2">
          Coverage &amp; match quality
        </p>
        <p className="tabular text-[13px] font-semibold text-ink">
          {c.sourceCount} {c.sourceCount === 1 ? 'rating' : 'ratings'} ·{' '}
          <span style={{ color: c.sparseCoverage ? 'var(--verdict-poor)' : 'var(--ink)' }}>
            {c.axesCovered} of {total} axes
          </span>
        </p>
      </div>

      {clean ? (
        <p className="mt-2 text-[11.5px] leading-snug text-ink-2">
          All four axes are covered and every rating is matched on a reviewed, high-confidence link.
        </p>
      ) : (
        <ul className="mt-2.5 space-y-2">
          {caveats.map((cav) => (
            <li key={cav.text} className="flex gap-2 text-[11.5px] leading-snug text-ink-2">
              <span
                aria-hidden
                className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: cav.caution ? 'var(--verdict-poor)' : 'var(--ink-3)' }}
              />
              <span>{cav.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
