const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

export async function apiFetch(
  path: string,
  options: RequestInit & { token?: string | null; businessId?: string } = {},
) {
  const { token, businessId, headers, ...rest } = options;
  const nextHeaders = new Headers(headers);
  if (!nextHeaders.has('Content-Type') && rest.body) {
    nextHeaders.set('Content-Type', 'application/json');
  }
  if (token) nextHeaders.set('Authorization', `Bearer ${token}`);
  if (businessId) nextHeaders.set('X-Business-Id', businessId);

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: nextHeaders,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ?? `Erro HTTP ${res.status}`,
    );
  }
  return data;
}

export { API_URL };
