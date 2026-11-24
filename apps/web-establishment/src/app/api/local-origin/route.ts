import { networkInterfaces } from 'node:os';

/** Dev-only address a phone on the same network can open. */
export function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ origin: null });
  }
  const port = new URL(request.url).searchParams.get('port') || '3000';
  let address = '';
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        address = entry.address;
        break;
      }
    }
    if (address) break;
  }
  return Response.json({
    origin: address ? `http://${address}:${port}` : null,
  });
}
