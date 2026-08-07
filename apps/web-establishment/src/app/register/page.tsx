'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  isFirebaseConfigured,
  registerStaff,
  getIdToken,
  getFirebaseAuth,
} from '@/lib/firebase';
import { API_URL } from '@/lib/api';
import {
  Alert,
  Button,
  Card,
  FieldLabel,
  SoftLink,
  TextField,
} from '@/components/ui';

const TYPES = [
  { value: 'café', label: 'Café' },
  { value: 'restaurant', label: 'Restaurante' },
  { value: 'beauty', label: 'Beleza' },
  { value: 'retail', label: 'Varejo' },
  { value: 'pet', label: 'Pet' },
];

export default function RegisterPage() {
  const router = useRouter();
  const configured = isFirebaseConfigured();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    ownerName: '',
    email: '',
    password: '',
    businessName: '',
    type: 'café',
    slogan: '',
    locationName: '',
    locationAddress: '',
    primaryColor: '#3B5BDB',
  });

  function setField<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!configured) {
      setError('Firebase não configurado neste ambiente.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await registerStaff(form.email, form.password);
      const token = await getIdToken(true);
      if (!token) throw new Error('Token Firebase indisponível');

      const res = await fetch(`${API_URL}/businesses/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ownerName: form.ownerName,
          businessName: form.businessName,
          type: form.type,
          slogan: form.slogan || undefined,
          primaryColor: form.primaryColor,
          primaryColorDark: form.primaryColor,
          locationName: form.locationName,
          locationAddress: form.locationAddress,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const code = json.error as string | undefined;
        if (code === 'ALREADY_HAS_BUSINESS') {
          throw new Error('Este e-mail já está ligado a uma loja.');
        }
        throw new Error(code ?? `Erro HTTP ${res.status}`);
      }

      if (typeof window !== 'undefined' && json.business?.id) {
        const uid = getFirebaseAuth().currentUser?.uid;
        const key = uid
          ? `frego.activeBusinessId.${uid}`
          : 'frego.activeBusinessId';
        window.localStorage.setItem(key, json.business.id);
      }

      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no cadastro');
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
        <h1 className="text-[28px] font-semibold tracking-[-0.03em]">
          Cadastrar loja
        </h1>
        <p className="mt-2 text-[15px] text-[var(--color-neutral-500)]">
          Configure as variáveis <code>NEXT_PUBLIC_FIREBASE_*</code> em
          `.env.local`.
        </p>
      </main>
    );
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[var(--color-bg)]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-[var(--color-primary-50)] to-transparent"
        aria-hidden
      />
      <div className="relative mx-auto max-w-lg px-5 py-10 md:py-14">
        <div className="mb-8 flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-[14px] text-[20px] font-bold text-white shadow-[var(--shadow-cta)]"
            style={{ background: 'var(--color-primary-500)' }}
          >
            V
          </div>
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--color-neutral-400)]">
              Frego
            </p>
            <p className="text-[15px] font-semibold text-[var(--color-ink)]">
              Novo estabelecimento
            </p>
          </div>
        </div>

        <h1 className="text-[30px] font-semibold tracking-[-0.03em] text-[var(--color-ink)]">
          Cadastrar loja
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-neutral-500)]">
          Uma conta por loja. Após o envio, a equipe Frego aprova o acesso.
        </p>

        <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
          <Card padding="md">
            <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
              Sua conta
            </p>
            <div className="flex flex-col gap-3.5">
              <TextField
                label="Seu nome"
                value={form.ownerName}
                onChange={(e) => setField('ownerName', e.target.value)}
                required
                minLength={2}
              />
              <TextField
                label="E-mail"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                required
              />
              <TextField
                label="Senha"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setField('password', e.target.value)}
                required
                minLength={6}
              />
            </div>
          </Card>

          <Card padding="md">
            <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
              A loja
            </p>
            <div className="flex flex-col gap-3.5">
              <TextField
                label="Nome do estabelecimento"
                value={form.businessName}
                onChange={(e) => setField('businessName', e.target.value)}
                required
                minLength={2}
              />
              <div>
                <FieldLabel>Tipo</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {TYPES.map((t) => {
                    const active = form.type === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setField('type', t.value)}
                        className={`min-h-9 rounded-full px-3.5 text-[13px] font-semibold transition-colors ${
                          active
                            ? 'bg-[var(--color-primary-500)] text-white shadow-[var(--shadow-cta)]'
                            : 'bg-[var(--color-bg)] text-[var(--color-neutral-600)] ring-1 ring-[var(--color-hairline)]'
                        }`}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <TextField
                label="Slogan (opcional)"
                value={form.slogan}
                onChange={(e) => setField('slogan', e.target.value)}
                maxLength={160}
              />
              <label className="block">
                <FieldLabel>Cor da marca</FieldLabel>
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) => setField('primaryColor', e.target.value)}
                  className="h-11 w-full cursor-pointer rounded-[12px] border border-[var(--color-neutral-200)] bg-[var(--color-bg)] px-2"
                />
              </label>
            </div>
          </Card>

          <Card padding="md">
            <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
              Unidade
            </p>
            <div className="flex flex-col gap-3.5">
              <TextField
                label="Nome da unidade"
                value={form.locationName}
                onChange={(e) => setField('locationName', e.target.value)}
                placeholder="Ex.: Loja Jardins"
                required
                minLength={2}
              />
              <TextField
                label="Endereço"
                value={form.locationAddress}
                onChange={(e) => setField('locationAddress', e.target.value)}
                required
                minLength={5}
              />
            </div>
          </Card>

          {error ? <Alert>{error}</Alert> : null}

          <Button
            type="submit"
            disabled={busy}
            className="w-full min-h-12 text-[15px]"
          >
            {busy ? 'Enviando…' : 'Enviar para aprovação'}
          </Button>
        </form>

        <p className="mt-6 text-center text-[14px] text-[var(--color-neutral-500)]">
          Já tem conta? <SoftLink href="/login">Entrar</SoftLink>
        </p>
      </div>
    </main>
  );
}
