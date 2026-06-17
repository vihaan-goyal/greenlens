import { Sonion } from '@/components/Sonion';

/**
 * The "between screens" state. Shows just Sonion in a small floating pill so
 * the user knows the extension is alive while they navigate around a site —
 * search results, category pages, the home page. The card upgrades to a
 * verdict/unknown state the moment the user lands on a product page.
 *
 * Intentionally quiet: no text, no badge. Animations land here later.
 */
export function IdleCard() {
  return (
    <div className="gl-card" data-band="none">
      <div
        className="gl-trigger gl-trigger-idle"
        role="img"
        aria-label="Greenlens — open a product page to see ratings"
      >
        <Sonion mood="neutral" size={36} idle />
      </div>
    </div>
  );
}
