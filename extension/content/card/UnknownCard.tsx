import { useState } from 'react';
import { Sonion } from '@/components/Sonion';

interface Props {
  rawName: string;
}

/**
 * Shown when the page IS a cosmetic but the matcher couldn't find a canonical
 * product. Honest about being a data gap, not a bug — the matcher's tail
 * recall is a known weakness CLAUDE.md says to surface, not hide.
 */
export function UnknownCard({ rawName }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="gl-card" data-band="none">
      <button
        type="button"
        className="gl-trigger"
        aria-label="Greenlens: product not in catalog yet"
        onClick={() => setOpen((v) => !v)}
      >
        <Sonion mood="neutral" size={48} idle={!open} />
        <span className="gl-trigger-text">
          <span className="gl-trigger-score" style={{ color: 'var(--ink-3)' }}>?</span>
          <span className="gl-trigger-band">Not yet rated</span>
        </span>
      </button>
      {open && (
        <div className="gl-panel" role="dialog" aria-label="Product not in catalog">
          <p className="gl-eyebrow">Not in catalog</p>
          <h2 className="gl-title" style={{ fontSize: 15, fontWeight: 500 }}>
            {rawName}
          </h2>
          <p className="gl-sonion-line">
            I don&apos;t have ratings for this one yet — coverage on the tail of
            the catalog is genuinely worse, and we&apos;d rather say so than fake
            a number.
          </p>
          <p className="gl-foot">Use the toolbar icon to adjust your weighting in the meantime.</p>
        </div>
      )}
    </div>
  );
}
