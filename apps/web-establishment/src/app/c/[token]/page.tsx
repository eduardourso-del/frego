import { API_URL } from '@/lib/api';
import { CheckInDoor, type CheckInCard } from './door';

async function loadCard(token: string) {
  try {
    const res = await fetch(
      `${API_URL}/public/check-ins/${encodeURIComponent(token)}`,
      { cache: 'no-store' },
    );
    if (res.status === 404) return { kind: 'missing' as const };
    if (!res.ok) return { kind: 'unavailable' as const };
    return { kind: 'ok' as const, card: (await res.json()) as CheckInCard };
  } catch {
    return { kind: 'unavailable' as const };
  }
}

export default async function CheckInDoorPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await loadCard(token);
  if (result.kind === 'ok') return <CheckInDoor card={result.card} />;
  if (result.kind === 'missing') return <CheckInDoor missing />;
  return <CheckInDoor unavailable />;
}
