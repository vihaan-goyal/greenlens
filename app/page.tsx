import Link from 'next/link';
import { headers } from 'next/headers';
import { Sonion } from '@/components/Sonion';
import { VERDICT_VAR } from '@/lib/domain/verdict';
import { LeftProductColumn, RightProductColumn, type SpotlightProduct } from '@/components/FloatingProductCards';
import { repository } from '@/lib/data';
import { overall, defaultWeights } from '@/lib/domain/scoring';
import { verdictBand } from '@/lib/domain/verdict';

const MOBILE_RE = /Android|iPhone|iPad|iPod|Mobile|BlackBerry|IEMobile|Opera Mini/i;

// Real products to feature on the landing page — fake/demo products excluded.
// imageUrl pulled from each brand's official website or retailer CDN.
const SPOTLIGHT: { id: string; imageUrl: string }[] = [
  {
    id: 'prod-cerave-mc',
    imageUrl: 'https://target.scene7.com/is/image/Target/GUEST_ef902ef2-7e84-4c3e-8857-6b45c768af63?wid=800&hei=800&fmt=pjpeg',
  },
  {
    id: 'prod-neutrogena-hydroboost',
    imageUrl: 'https://target.scene7.com/is/image/Target/GUEST_83cbb31a-b7ef-43b5-84ba-a28df85a25ec?wid=800&hei=800&fmt=pjpeg',
  },
  {
    id: 'prod-laroche-toleriane',
    imageUrl: 'https://target.scene7.com/is/image/Target/GUEST_25742152-122e-401b-8045-a47c0de6165c?wid=800&hei=800&fmt=pjpeg',
  },
  {
    id: 'prod-eltamd-uvclear',
    imageUrl: 'https://eltamd.com/cdn/shop/files/1_9.png?v=1776287056',
  },
  {
    id: 'prod-ordinary-niacinamide',
    imageUrl: 'https://theordinary.com/dw/image/v2/BFKJ_PRD/on/demandware.static/-/Sites-deciem-master/default/dwce8a7cdf/Images/products/The%20Ordinary/rdn-niacinamide-10pct-zinc-1pct-30ml.png?sw=800&sh=800&sm=fit',
  },
  {
    id: 'prod-cosrx-snail',
    imageUrl: 'https://www.cosrx.com/cdn/shop/files/james_800x1067_1_1_4e9750cc-2cd6-4817-ace5-be2305a85806.jpg?v=1763111577',
  },
  {
    id: 'prod-olaplex-3',
    imageUrl: 'https://olaplex.com/cdn/shop/files/2025_No3PLUS_100ml_Product_Packshot_01_GBL_1440x1440_a2cbc609-6363-49e1-b2d2-7acd8a72672f.png',
  },
  {
    id: 'prod-drunk-protini',
    imageUrl: 'https://www.drunkelephant.com/dw/image/v2/BBSK_PRD/on/demandware.static/-/Sites-itemmaster_drunkelephant/default/dwc318f9ff/products/images/2026/January/Protini_new_images/Protini-PDP_2026_Standard-Hero.jpg?sw=800&sh=800&sm=fit',
  },
];

async function getSpotlightProducts(): Promise<SpotlightProduct[]> {
  const views = await repository.listProducts();
  const weights = defaultWeights();
  const byId = new Map(views.map((v) => [v.product.id, v]));

  return SPOTLIGHT.flatMap(({ id, imageUrl }) => {
    const v = byId.get(id);
    if (!v) return [];
    const score = overall(v.pillars, weights);
    if (score === null) return [];
    const band = verdictBand(score);
    if (!band) return [];
    return [{
      id: v.product.id,
      displayName: v.product.displayName,
      brandName: v.brand.name,
      category: v.product.category,
      score,
      band,
      imageUrl,
    } satisfies SpotlightProduct];
  });
}

export default async function LandingPage() {
  const [ua, spotlightProducts] = await Promise.all([
    headers().then((h) => h.get('user-agent') ?? ''),
    getSpotlightProducts(),
  ]);
  const isMobile = MOBILE_RE.test(ua);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Three-column layout: sidebars sit in the natural gutters alongside the content */}
      <div className="flex items-start justify-center">
        <LeftProductColumn products={spotlightProducts} />

      <main className="w-full max-w-4xl px-6 py-16 md:py-24">

        {/* ─── HERO ─────────────────────────────────────────────────────── */}
        <header className="flex flex-col items-center text-center anim-rise">
          <div className="flex flex-col items-center gap-3">
            <Sonion mood="happy" size={80} idle />
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.3em]"
              style={{ color: 'var(--accent-deep)' }}
            >
              Greenlens
            </p>
          </div>

          <h1 className="mt-6 max-w-2xl font-display text-[36px] font-semibold leading-[1.07] text-ink md:text-[54px]">
            Every rating source on one cosmetic —{' '}
            <span className="mark-leaf">and where they disagree.</span>
          </h1>

          <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-ink-2 md:text-base">
            Is this safe for <em>you</em>? Greenlens shows what every public rater
            says, names who funds each opinion, and gives you one score whose
            weighting <strong className="u-bold font-semibold">you</strong> control —
            never a single blended number that hides the conflict.
          </p>

          {/* Search bar — the single universal action */}
          <div className="mt-10 w-full max-w-sm">
            <form method="get" action="/browse">
              <div
                className="flex items-center gap-2 rounded-pill py-2 pl-4 pr-2"
                style={{
                  background: 'var(--card)',
                  border: '1.5px solid var(--line)',
                  boxShadow: 'var(--shadow-soft)',
                }}
              >
                <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden className="shrink-0">
                  <circle cx="7" cy="7" r="4.5" stroke="var(--ink-3)" strokeWidth="1.6" fill="none" />
                  <path d="M10.5 10.5 L 14 14" stroke="var(--ink-3)" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                <input
                  name="q"
                  type="text"
                  placeholder="Brand, product, or barcode…"
                  aria-label="Search products"
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-pill px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-card"
                  style={{ background: 'var(--espresso)' }}
                >
                  Look up
                </button>
              </div>
            </form>
            <Link
              href="/browse"
              className="mt-3 inline-block text-[12px] font-medium text-ink-3 underline-offset-4 hover:text-ink-2 hover:underline transition-colors"
            >
              Browse the shelf →
            </Link>
          </div>
        </header>

        {/* ─── DIVIDER ──────────────────────────────────────────────────── */}
        <div className="mt-16 md:mt-20" style={{ height: '1px', background: 'var(--line)' }} />

        {/* ─── THREE PILLARS ────────────────────────────────────────────── */}
        <section className="mt-12 md:mt-14">
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.26em] text-ink-3">
            What makes it honest
          </p>
          <div className="mt-7 grid gap-3 md:grid-cols-3">
            <PointCard
              n="01"
              title="Disagreement stays visible"
              body={'When EWG says "concern" and Yuka says "clean," we show the spread and name both — never averaged into silence.'}
            />
            <PointCard
              n="02"
              title="Who pays is always shown"
              body="Every rating carries its funding model — nonprofit, ad-supported, subscription — so you can weigh the source, not just the score."
            />
            <PointCard
              n="03"
              title="You own the weighting"
              body="Safety, environment, labor, packaging — slide them to what you care about. Computed live, never stored."
            />
          </div>
        </section>

        {/* ─── EXTENSION CARD (desktop only) ────────────────────────────── */}
        {!isMobile && (
          <>
            <div className="mt-12 md:mt-16" style={{ height: '1px', background: 'var(--line)' }} />
            <section className="mt-12 md:mt-14">
              <p className="text-center text-[10px] font-semibold uppercase tracking-[0.26em] text-ink-3">
                On desktop
              </p>
              <div
                className="mt-7 rounded-card"
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--line)',
                  boxShadow: 'var(--shadow-soft)',
                }}
              >
                <div className="flex flex-col gap-6 p-7 md:flex-row md:items-center md:gap-8 md:p-8">
                  <div className="shrink-0">
                    <OverlayPreview />
                  </div>
                  <div className="flex flex-col gap-4">
                    <div>
                      <p
                        className="text-[10px] font-semibold uppercase tracking-[0.22em]"
                        style={{ color: 'var(--accent-deep)' }}
                      >
                        Browser extension · Chrome
                      </p>
                      <h2 className="mt-1.5 font-display text-[22px] font-semibold leading-tight text-ink md:text-[26px]">
                        A verdict while you shop
                      </h2>
                      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">
                        Drops a Sonion card onto product pages as you browse — tap for the spread,
                        click through for the full breakdown on ingredients and rater disagreements.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <a
                        href="#install"
                        className="inline-flex items-center gap-2 rounded-pill px-5 py-2.5 text-[13px] font-semibold text-card transition-opacity hover:opacity-90"
                        style={{ background: 'var(--accent-deep)', boxShadow: 'var(--shadow-soft)' }}
                      >
                        Add to Chrome
                      </a>
                      <span className="text-[11.5px] text-ink-3">
                        Loads unpacked · Chrome Web Store coming soon
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {/* ─── INSTALL STEPS ────────────────────────────────────────────── */}
        <section id="install" className="mt-12 scroll-mt-8 md:mt-16">
          <div
            className="rounded-card"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--line)',
            }}
          >
            <div className="p-6 md:p-8">
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.22em]"
                style={{ color: 'var(--accent-deep)' }}
              >
                Desktop · Chrome
              </p>
              <h2 className="mt-1 font-display text-[22px] font-semibold text-ink md:text-[26px]">
                Add the extension
              </h2>
              <p className="mt-2 max-w-lg text-[13.5px] leading-relaxed text-ink-2">
                Not on the Chrome Web Store yet — it loads unpacked from a local
                build while we&apos;re in development.
              </p>
              <ol className="mt-5 grid gap-3 md:grid-cols-3">
                <InstallStep n={1} mono="npm run ext:build">
                  Build the extension into <code className="text-ink">dist/extension</code>.
                </InstallStep>
                <InstallStep n={2} mono="chrome://extensions">
                  Open it and turn on <span className="text-ink">Developer mode</span> (top right).
                </InstallStep>
                <InstallStep n={3} mono="Load unpacked">
                  Select the <code className="text-ink">dist/extension</code> folder. Open an Amazon product page.
                </InstallStep>
              </ol>
            </div>
          </div>
        </section>

        {/* ─── FOOTER ───────────────────────────────────────────────────── */}
        <footer className="mt-16 flex flex-col items-center gap-1.5 text-center md:mt-20">
          <div className="mb-3" style={{ height: '1px', width: '3rem', background: 'var(--line)' }} />
          <p className="text-[10px] uppercase tracking-[0.22em] text-ink-3">
            Cosmetics only · lead with safety
          </p>
          <p className="text-[12.5px] text-ink-2">
            Built around one rule: never hide a disagreement behind a single number.
          </p>
        </footer>
      </main>

        <RightProductColumn products={spotlightProducts} />
      </div>
    </div>
  );
}

function OverlayPreview() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5"
      style={{
        background: 'var(--card-2)',
        border: '1px dashed var(--line)',
        minWidth: '180px',
      }}
      aria-hidden
    >
      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-3">
        On a product page
      </p>
      <div className="mt-4 flex items-center justify-end">
        <div
          className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--line)',
            boxShadow: 'var(--shadow-soft)',
          }}
        >
          <Sonion mood="concerned" size={36} idle />
          <span className="flex flex-col leading-none">
            <span
              className="font-display text-[22px] font-semibold tabular"
              style={{ color: VERDICT_VAR.poor }}
            >
              50
            </span>
            <span
              className="text-[9px] font-bold uppercase tracking-[0.12em]"
              style={{ color: VERDICT_VAR.poor }}
            >
              Poor
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

function PointCard({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div
      className="flex flex-col gap-3 rounded-card p-5 md:p-6"
      style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
    >
      <span
        className="font-display text-[13px] font-semibold tabular"
        style={{ color: 'var(--accent-deep)' }}
      >
        {n}
      </span>
      <div>
        <h3 className="font-display text-[17px] font-semibold leading-snug text-ink">{title}</h3>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-2">{body}</p>
      </div>
    </div>
  );
}

function InstallStep({ n, mono, children }: { n: number; mono: string; children: React.ReactNode }) {
  return (
    <li
      className="rounded-2xl p-4"
      style={{ background: 'var(--card-2)', border: '1px solid var(--line-soft)' }}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular"
          style={{
            background: 'var(--card)',
            color: 'var(--accent-deep)',
            border: '1px solid var(--line)',
          }}
        >
          {n}
        </span>
        <code className="text-[11.5px] font-semibold text-ink">{mono}</code>
      </div>
      <p className="mt-2.5 text-[12px] leading-snug text-ink-2">{children}</p>
    </li>
  );
}
