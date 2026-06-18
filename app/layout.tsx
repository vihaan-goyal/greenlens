import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Greenlens',
  description:
    'Look up a cosmetics product and see what every public rating source says, including where they disagree.',
};

/**
 * Root layout. Deliberately frame-free: the marketing landing at `/` is
 * full-width and responsive. The phone-mockup chrome is applied only to the
 * app screens via `app/(app)/layout.tsx`, so the device frame no longer leaks
 * onto the landing page.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen text-ink">{children}</body>
    </html>
  );
}
