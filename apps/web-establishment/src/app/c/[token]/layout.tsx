import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { APP_STORE_ID } from '@/components/store-badges';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  return {
    other: {
      'apple-itunes-app': `app-id=${APP_STORE_ID}, app-argument=frego://c/${token}`,
    },
  };
}

export default function CheckInDoorLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
