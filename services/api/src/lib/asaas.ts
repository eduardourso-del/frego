/**
 * Asaas charges the Estabelecimento. Frego stores customer and subscription ids, not the card.
 * ASAAS_API_KEY is required. ASAAS_API_URL defaults to the sandbox.
 */

const DEFAULT_URL = 'https://api-sandbox.asaas.com/v3';

export type AsaasBillingType = 'CREDIT_CARD' | 'PIX' | 'BOLETO' | 'UNDEFINED';

export type AsaasPayment = {
  id: string;
  status: string;
  value: number;
  dueDate: string;
  invoiceUrl: string | null;
  subscription: string | null;
  customer: string | null;
  externalReference: string | null;
  billingType: string | null;
};

type AsaasList<T> = { data?: T[] };

export function asaasConfigured(): boolean {
  return Boolean(process.env.ASAAS_API_KEY);
}

function baseUrl() {
  return (process.env.ASAAS_API_URL ?? DEFAULT_URL).replace(/\/$/, '');
}

async function asaas<T>(path: string, init?: RequestInit): Promise<T> {
  const key = process.env.ASAAS_API_KEY;
  if (!key) {
    throw Object.assign(new Error('ASAAS_NOT_CONFIGURED'), {
      code: 'ASAAS_NOT_CONFIGURED',
    });
  }
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      access_token: key,
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = (text ? JSON.parse(text) : {}) as T & {
    errors?: Array<{ description?: string }>;
  };
  if (!res.ok) {
    const description = body.errors?.[0]?.description;
    throw Object.assign(new Error(description || `ASAAS_${res.status}`), {
      code: 'ASAAS_ERROR',
      status: res.status,
    });
  }
  return body;
}

export async function asaasEnsureCustomer(input: {
  customerId: string | null;
  name: string;
  cpfCnpj: string | null;
  email: string | null;
  externalReference: string;
}): Promise<string> {
  if (input.customerId) {
    if (input.cpfCnpj) {
      await asaas(`/customers/${input.customerId}`, {
        method: 'POST',
        body: JSON.stringify({
          name: input.name,
          cpfCnpj: input.cpfCnpj,
          email: input.email ?? undefined,
        }),
      });
    }
    return input.customerId;
  }
  const created = await asaas<{ id: string }>('/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      cpfCnpj: input.cpfCnpj ?? undefined,
      email: input.email ?? undefined,
      externalReference: input.externalReference,
    }),
  });
  return created.id;
}

export async function asaasCreateSubscription(input: {
  customer: string;
  billingType: AsaasBillingType;
  value: number;
  nextDueDate: string;
  description: string;
  externalReference: string;
}): Promise<{ id: string }> {
  return asaas('/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      customer: input.customer,
      billingType: input.billingType,
      value: input.value,
      nextDueDate: input.nextDueDate,
      cycle: 'MONTHLY',
      description: input.description,
      externalReference: input.externalReference,
    }),
  });
}

export async function asaasUpdateSubscription(
  id: string,
  input: { value?: number; billingType?: AsaasBillingType; updatePendingPayments?: boolean },
): Promise<void> {
  await asaas(`/subscriptions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function asaasDeleteSubscription(id: string): Promise<void> {
  await asaas(`/subscriptions/${id}`, { method: 'DELETE' });
}

export async function asaasSubscriptionPayments(id: string): Promise<AsaasPayment[]> {
  const list = await asaas<AsaasList<AsaasPayment>>(`/subscriptions/${id}/payments`);
  return list.data ?? [];
}

export async function asaasCustomerPayments(customerId: string): Promise<AsaasPayment[]> {
  const list = await asaas<AsaasList<AsaasPayment>>(
    `/payments?customer=${encodeURIComponent(customerId)}&limit=20`,
  );
  return list.data ?? [];
}

export async function asaasCreatePayment(input: {
  customer: string;
  billingType: AsaasBillingType;
  value: number;
  dueDate: string;
  description: string;
  externalReference: string;
}): Promise<AsaasPayment> {
  return asaas('/payments', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function asaasWebhookAuthorized(header: string | undefined): boolean {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected) return false;
  return header === expected;
}
