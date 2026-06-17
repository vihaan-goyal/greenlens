import type { Metadata } from 'next';
import './globals.css';
import { DeviceFrame } from '@/components/DeviceFrame';

export const metadata: Metadata = {
  title: 'Greenlens',
  description:
    'Look up a cosmetics product and see what every public rating source says, including where they disagree.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen text-ink" style={{ backgroundColor: '#1F1B16' }}>
        <DeviceFrame>{children}</DeviceFrame>
      </body>
    </html>
  );
}
