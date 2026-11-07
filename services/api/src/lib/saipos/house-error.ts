/**
 * What the Estabelecimento sees when a Saipos sync does not finish.
 * Internal database and pool errors stay off the card.
 */
export function saiposErrorForHouse(
  lastError: string | null,
  status: string,
): string | null {
  if (!lastError?.trim()) return null;
  const raw = lastError.trim();
  const lower = raw.toLowerCase();

  if (isAlreadyHouseCopy(raw)) return raw;

  if (isInternalFailure(lower)) {
    return 'A última atualização das vendas não terminou. A Saipos continua conectada. A próxima é às 5h, 13h ou 21h.';
  }

  if (status === 'error') {
    return 'A Saipos recusou o token. Peça outro à Saipos e troque aqui.';
  }

  return 'A Saipos não respondeu nesta atualização. A conexão segue ativa. A próxima é às 5h, 13h ou 21h.';
}

function isInternalFailure(lower: string): boolean {
  return (
    lower.includes('connection pool') ||
    lower.includes('quota') ||
    lower.includes('prisma') ||
    lower.includes('econnrefused') ||
    lower.includes('etimedout') ||
    lower.includes('timed out') ||
    lower.includes('timeout') ||
    lower.includes("can't reach database") ||
    lower.includes('server has closed the connection')
  );
}

function isAlreadyHouseCopy(raw: string): boolean {
  return (
    raw.startsWith('Não foi possível') ||
    raw.startsWith('A Saipos') ||
    raw.startsWith('Cadastre o endereço') ||
    raw.startsWith('Nenhum responsável')
  );
}
