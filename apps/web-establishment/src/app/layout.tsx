import type { Metadata, Viewport } from 'next';
import { Archivo } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { BusinessProvider } from '@/lib/business-context';
import './globals.css';

const archivo = Archivo({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '600', '800'],
  display: 'swap',
  variable: '--font-archivo',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://frego.app.br'),
  title: {
    default: 'Frego — Estabelecimento',
    template: '%s · Frego',
  },
  description: 'Painel de fidelidade do seu negócio',
  icons: {
    icon: [
      { url: '/brand/png/frego-favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/brand/png/frego-favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/brand/png/frego-icone-180.png',
  },
  openGraph: {
    images: [
      {
        url: '/brand/png/frego-compartilhamento-1200x630.png',
        width: 1200,
        height: 630,
        alt: 'Frego',
      },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Frego',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#F7F8FA',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={archivo.variable}>
      <body className="min-h-dvh antialiased">
        <AuthProvider>
          <BusinessProvider>{children}</BusinessProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
