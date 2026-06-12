import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800']
});

export const metadata: Metadata = {
  title: 'Workshop Timer',
  manifest: '/manifest.json'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <head>
        <meta name="theme-color" content="#111111" />
        <Script
          defer
          src="https://umami-analytics-seven-zeta.vercel.app/script.js"
          data-website-id="4320d621-9141-479a-9d34-1f25eb97f060"
          strategy="afterInteractive"
        />
      </head>
      <body className={plusJakartaSans.className}>{children}</body>
    </html>
  );
}
