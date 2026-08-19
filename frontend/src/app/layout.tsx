import type { Metadata } from 'next';
import './globals.css';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://biosustainlab.com';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: 'BioSustain — Dashboard',
  description: 'Plataforma de gestión de bioconversión sostenible',
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  icons: {
    icon: [
      { url: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🌱</text></svg>' },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}