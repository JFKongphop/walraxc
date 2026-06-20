import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WALRAXC — Autonomous Security Cognition on Sui',
  description:
    'Autonomous AI Security Agent for Smart Contract Auditing on Sui. Replayable intelligence, deterministic execution, cryptographic verification.',
  icons: { icon: '/icon.png', apple: '/icon.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
