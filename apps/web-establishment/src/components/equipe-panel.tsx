'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { API_URL } from '@/lib/api';
import { useBusiness } from '@/lib/business-context';
import { Alert, Button } from '@/components/ui';
import Link from 'next/link';

type EquipeMember = {
  id: string;
  displayName: string | null;
  email: string | null;
  role: string;
  status: string;
};

const inputClass =
  'mt-1.5 min-h-11 w-full rounded-[12px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] px-3 text-[15px] text-[var(--color-ink)] outline-none focus:border-[var(--color-primary-500)]';

function placeLabel(member: EquipeMember) {
  if (member.role === 'owner') return 'Dono';
  return 'Balcão';
}

function conditionLabel(member: EquipeMember) {
  if (member.role === 'owner') return null;
  if (member.status === 'pending') return 'Aguardando';
  if (member.status === 'disabled') return 'Desativado';
  return null;
}

function addError(code: string) {
  if (code === 'SELF') return 'Este e-mail é o seu.';
  if (code === 'OPERATOR') return 'Este e-mail é da equipe Frego.';
  if (code === 'ALREADY_ACTIVE') return 'Esta pessoa já entra neste estabelecimento.';
  if (code === 'NAME_REQUIRED') return 'Informe o nome.';
  if (code === 'INVALID_EMAIL') return 'E-mail inválido.';
  if (code === 'BUSINESS_UNAVAILABLE') {
    return 'A Equipe fica disponível quando o estabelecimento está no ar.';
  }
  if (code === 'EQUIPE_LIMIT') {
    return 'O Growth chega a 2 pessoas na Equipe.';
  }
  if (code === 'PLAN_REQUIRED') {
    return 'A Equipe faz parte do Growth.';
  }
  if (code === 'LOGIN_UNAVAILABLE' || code === 'MAIL_LINK_FAILED') {
    return 'Não foi possível preparar o acesso agora. Tente de novo.';
  }
  return 'Não foi possível adicionar.';
}

type EquipeSeats = { limit: number | null; taken: number };

export function EquipePanel() {
  const { authHeaders, business } = useBusiness();
  const [members, setMembers] = useState<EquipeMember[]>([]);
  const [seats, setSeats] = useState<EquipeSeats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/equipe`, { headers });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        members?: EquipeMember[];
        seats?: EquipeSeats;
      };
      if (!res.ok) throw new Error(json.error ?? 'LOAD');
      setMembers(json.members ?? []);
      setSeats(json.seats ?? null);
    } catch {
      setError('Não foi possível carregar a equipe.');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const headers = {
        ...(await authHeaders()),
        'Content-Type': 'application/json',
      };
      const res = await fetch(`${API_URL}/equipe`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ displayName: name, email }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        mail?: string | null;
      };
      if (!res.ok) {
        setError(addError(json.error ?? ''));
        return;
      }
      setName('');
      setEmail('');
      if (json.mail && json.mail !== 'sent' && json.mail !== null) {
        setNotice('A pessoa foi atualizada. O e-mail não saiu.');
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function mutate(
    id: string,
    path: string,
    method: 'POST' | 'PATCH' | 'DELETE',
    body?: unknown,
  ) {
    setError(null);
    setNotice(null);
    const headers = {
      ...(await authHeaders()),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    };
    const res = await fetch(`${API_URL}/equipe/${id}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setError(addError(json.error ?? ''));
      return;
    }
    const json = (await res.json().catch(() => ({}))) as { mail?: string };
    if (path === '/resend' && json.mail && json.mail !== 'sent') {
      setNotice('O link não saiu. Tente reenviar.');
    }
    setEditingId(null);
    await load();
  }

  const limit = seats?.limit ?? business?.billing?.equipeSeats ?? null;
  const taken = seats?.taken ?? 0;
  const full = limit != null && taken >= limit;
  const seatNote =
    limit == null
      ? ' A Equipe não tem limite.'
      : limit > 0
        ? ` O Growth inclui até ${limit} pessoas, além de você.`
        : '';

  return (
    <section className="rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-4 md:p-5">
      <div className="mb-4 flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-primary-50)] text-[var(--color-primary-600)]">
          <Users size={16} strokeWidth={2.25} aria-hidden />
        </span>
        <div>
          <h2 className="text-[14px] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
            Equipe
          </h2>
          <p className="mt-0.5 text-[12px] leading-snug text-[var(--color-neutral-500)]">
            Quem você adiciona entra como Balcão: o caixa e os clientes, no painel e no PDV.
            {seatNote}
          </p>
        </div>
      </div>

      {full ? (
        <p className="text-[13px] leading-relaxed text-[var(--color-neutral-500)]">
          O Growth chega a 2 pessoas na Equipe. No Enterprise ela não tem limite.
          {business?.role === 'owner' ? (
            <>
              {' '}
              <Link href="/settings#plano" className="font-semibold text-[var(--color-ink)]">
                Atualizar Plano
              </Link>
            </>
          ) : null}
        </p>
      ) : (
      <form onSubmit={onAdd} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="block text-[13px] font-semibold text-[var(--color-neutral-500)]">
          Nome
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            autoComplete="name"
            required
          />
        </label>
        <label className="block text-[13px] font-semibold text-[var(--color-neutral-500)]">
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            autoComplete="off"
            required
          />
        </label>
        <Button type="submit" disabled={busy} className="sm:mb-0">
          {busy ? 'Adicionando…' : 'Adicionar'}
        </Button>
      </form>
      )}

      {error ? (
        <div className="mt-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}
      {notice ? (
        <p className="mt-4 text-[13px] text-[var(--color-neutral-500)]">{notice}</p>
      ) : null}

      {loading ? (
        <div className="mt-5 h-24 animate-pulse rounded-[12px] bg-[var(--color-neutral-100)]" />
      ) : (
        <ul className="mt-5 divide-y divide-[var(--color-hairline)]">
          {members.map((member) => {
            const condition = conditionLabel(member);
            const editing = editingId === member.id;
            return (
              <li key={member.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  {editing ? (
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void mutate(member.id, '', 'PATCH', { displayName: editingName });
                      }}
                    >
                      <input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className={inputClass + ' mt-0'}
                        aria-label="Nome"
                      />
                      <Button type="submit" variant="secondary">
                        Salvar
                      </Button>
                    </form>
                  ) : (
                    <>
                      <p className="truncate text-[15px] font-semibold text-[var(--color-ink)]">
                        {member.displayName?.trim() || 'Sem nome'}
                      </p>
                      <p className="truncate text-[13px] text-[var(--color-neutral-500)]">
                        {member.email}
                      </p>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[var(--color-bg)] px-2.5 py-1 text-[12px] font-semibold text-[var(--color-ink)]">
                    {placeLabel(member)}
                  </span>
                  {condition ? (
                    <span className="rounded-full bg-[var(--color-primary-50)] px-2.5 py-1 text-[12px] font-semibold text-[var(--color-primary-600)]">
                      {condition}
                    </span>
                  ) : null}
                  {!editing ? (
                    <button
                      type="button"
                      className="text-[13px] font-semibold text-[var(--color-neutral-500)] hover:text-[var(--color-ink)]"
                      onClick={() => {
                        setEditingId(member.id);
                        setEditingName(member.displayName ?? '');
                      }}
                    >
                      Corrigir nome
                    </button>
                  ) : null}
                  {member.status === 'pending' ? (
                    <>
                      <button
                        type="button"
                        className="text-[13px] font-semibold text-[var(--color-primary-600)]"
                        onClick={() => void mutate(member.id, '/resend', 'POST')}
                      >
                        Reenviar
                      </button>
                      <button
                        type="button"
                        className="text-[13px] font-semibold text-[var(--color-danger)]"
                        onClick={() => void mutate(member.id, '', 'DELETE')}
                      >
                        Remover
                      </button>
                    </>
                  ) : null}
                  {member.role !== 'owner' && member.status === 'active' ? (
                    <button
                      type="button"
                      className="text-[13px] font-semibold text-[var(--color-danger)]"
                      onClick={() => void mutate(member.id, '/disable', 'POST')}
                    >
                      Desativar
                    </button>
                  ) : null}
                  {member.status === 'disabled' ? (
                    <button
                      type="button"
                      className="text-[13px] font-semibold text-[var(--color-primary-600)]"
                      onClick={() => void mutate(member.id, '/enable', 'POST')}
                    >
                      Ativar
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
