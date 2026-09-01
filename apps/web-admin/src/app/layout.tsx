import type { Metadata } from 'next';
import { Archivo } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import './globals.css';

const archivo = Archivo({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '600', '800'],
  display: 'swap',
  variable: '--font-archivo',
});

export const metadata: Metadata = {
  title: 'Frego Admin',
  description: 'Console do operador da plataforma',
  icons: {
    icon: [
      { url: '/brand/png/frego-favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/brand/png/frego-favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/brand/png/frego-icone-180.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={archivo.variable}>
      <body className="min-h-screen antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
