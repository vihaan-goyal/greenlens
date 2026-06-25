export const metadata = { title: 'Privacy Policy — Greenlens' };

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 680, margin: '0 auto', padding: '48px 24px', fontFamily: 'system-ui, sans-serif', lineHeight: 1.7, color: '#2E2A22' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: '#6E675A', marginBottom: 40 }}>Last updated: June 25, 2026</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32 }}>What Greenlens does</h2>
      <p>
        Greenlens is a browser extension and web app that shows public cosmetics safety ratings from
        independent sources while you shop on Amazon and Sephora. It does not create accounts, does
        not require sign-in, and does not track you across the web.
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32 }}>Data the extension sends to our server</h2>
      <p>
        When you visit a supported product page, the extension sends the product&apos;s publicly
        visible name, brand, barcode (if present), and ingredient list to our server at
        greenlens-vert.vercel.app. This is used solely to look up safety ratings and return them to
        you. We do not log, store, or share these requests. No personal information is included.
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32 }}>Data stored on your device</h2>
      <p>
        Your rating-source weights (how much you value safety vs. environmental vs. ethical scores)
        are saved to <code>chrome.storage.local</code> on your device only. They are never sent to
        our server.
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32 }}>Third-party services</h2>
      <p>
        Ratings data comes from Open Beauty Facts (openbeautyfacts.org), a public-domain database.
        Amazon product enrichment uses the Amazon Product Advertising API when credentials are
        configured; only the product ASIN is sent, not any user identifier.
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32 }}>What we do not do</h2>
      <ul>
        <li>We do not collect names, emails, or any personally identifiable information.</li>
        <li>We do not sell or share any data with advertisers.</li>
        <li>We do not use cookies or cross-site tracking.</li>
        <li>We do not store your browsing history.</li>
      </ul>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32 }}>Contact</h2>
      <p>
        Questions? Email{' '}
        <a href="mailto:vihaan.goyal1512@gmail.com" style={{ color: '#7C8466' }}>
          vihaan.goyal1512@gmail.com
        </a>
        .
      </p>
    </main>
  );
}
