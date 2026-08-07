import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/lib/auth-context';
import { BusinessProvider } from '@/lib/business-context';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Frego — Estabelecimento',
    template: '%s · Frego',
  },
  description: 'Painel de fidelidade do seu negócio',
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
    <html lang="pt-BR">
      <body className="min-h-dvh antialiased">
        <AuthProvider>
          <BusinessProvider>{children}</BusinessProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
