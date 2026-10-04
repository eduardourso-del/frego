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
import { FregoWordmark } from '@/components/brand';
import { BusinessTypePicker } from '@/components/business-type-picker';
import { CONTACT_EMAIL, CONTACT_MAILTO } from '@/lib/contact';

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
    primaryColor: '#070707',
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
      if (!token) throw new Error('Não foi possível autenticar. Tente novamente.');

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
          throw new Error('Este e-mail já está vinculado a uma loja.');
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
      setError(err instanceof Error ? err.message : 'Não foi possível concluir o cadastro.');
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
        <div className="mb-8">
          <FregoWordmark height={28} href="/" />
          <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-neutral-500)]">
            Novo estabelecimento
          </p>
        </div>

        <h1 className="text-[32px] font-extrabold tracking-[-0.025em] text-[var(--color-ink)]">
          Cadastrar loja
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-neutral-500)]">
          Uma conta por loja. Depois do envio, a equipe Frego analisa e libera o
          acesso.
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
              <BusinessTypePicker
                value={form.type}
                onChange={(type) => setField('type', type)}
              />
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

          <p className="text-[12px] leading-relaxed text-[var(--color-neutral-500)]">
            Ao enviar, você concorda com os{' '}
            <SoftLink href="/termos">Termos de Uso</SoftLink> e a{' '}
            <SoftLink href="/privacidade">Política de Privacidade</SoftLink>.
          </p>

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
        <p className="mt-3 text-center text-[12px] text-[var(--color-neutral-400)]">
          Dúvidas?{' '}
          <SoftLink href="/suporte">Suporte</SoftLink>
          {' · '}
          <a
            href={CONTACT_MAILTO}
            className="font-medium text-[var(--color-neutral-600)] hover:text-[var(--color-ink)]"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
      </div>
    </main>
  );
}
