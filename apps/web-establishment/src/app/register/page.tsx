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
  PasswordField,
  SoftLink,
  TextField,
} from '@/components/ui';
import { FregoWordmark } from '@/components/brand';
import { BusinessTypePicker } from '@/components/business-type-picker';
import { CONTACT_EMAIL, CONTACT_MAILTO } from '@/lib/contact';
import { cnpjFieldError, formatCnpj } from '@/lib/cnpj';

const REQUIRED = 'Campo obrigatório.';

type RegisterForm = {
  ownerName: string;
  email: string;
  password: string;
  confirmPassword: string;
  businessName: string;
  cnpj: string;
  type: string;
  slogan: string;
  locationName: string;
  locationAddress: string;
  primaryColor: string;
};

const FIELD_ORDER = [
  'ownerName',
  'email',
  'password',
  'confirmPassword',
  'businessName',
  'cnpj',
  'locationName',
  'locationAddress',
] as const;

type FieldKey = (typeof FIELD_ORDER)[number];

function fieldErrors(form: RegisterForm): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {};
  if (!form.ownerName.trim()) errors.ownerName = REQUIRED;
  else if (form.ownerName.trim().length < 2) {
    errors.ownerName = 'Use pelo menos 2 caracteres.';
  }

  const email = form.email.trim();
  if (!email) errors.email = REQUIRED;
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'E-mail inválido.';
  }

  if (!form.password) errors.password = REQUIRED;
  else if (form.password.length < 6) {
    errors.password = 'Use pelo menos 6 caracteres.';
  }

  if (!form.confirmPassword) errors.confirmPassword = REQUIRED;
  else if (form.password !== form.confirmPassword) {
    errors.confirmPassword = 'As senhas não coincidem.';
  }

  if (!form.businessName.trim()) errors.businessName = REQUIRED;
  else if (form.businessName.trim().length < 2) {
    errors.businessName = 'Use pelo menos 2 caracteres.';
  }

  const cnpjError = cnpjFieldError(form.cnpj);
  if (cnpjError) errors.cnpj = cnpjError;

  if (!form.locationName.trim()) errors.locationName = REQUIRED;
  else if (form.locationName.trim().length < 2) {
    errors.locationName = 'Use pelo menos 2 caracteres.';
  }

  if (!form.locationAddress.trim()) errors.locationAddress = REQUIRED;
  else if (form.locationAddress.trim().length < 5) {
    errors.locationAddress = 'Use pelo menos 5 caracteres.';
  }

  return errors;
}

export default function RegisterPage() {
  const router = useRouter();
  const configured = isFirebaseConfigured();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [form, setForm] = useState<RegisterForm>({
    ownerName: '',
    email: '',
    password: '',
    confirmPassword: '',
    businessName: '',
    cnpj: '',
    type: 'café',
    slogan: '',
    locationName: '',
    locationAddress: '',
    primaryColor: '#070707',
  });

  function setField<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const errors = fieldErrors(form);
  const passwordsDiffer =
    form.confirmPassword.length > 0 && form.password !== form.confirmPassword;
  const cnpjError = cnpjFieldError(form.cnpj);

  function visibleError(key: FieldKey, live = false) {
    if (!showErrors && !live) return undefined;
    return errors[key];
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!configured) {
      setError('Firebase não configurado neste ambiente.');
      return;
    }
    setShowErrors(true);
    const nextErrors = fieldErrors(form);
    const firstInvalid = FIELD_ORDER.find((key) => nextErrors[key]);
    if (firstInvalid) {
      setError(null);
      const field = document.getElementById(firstInvalid);
      field?.focus({ preventScroll: true });
      field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
          cnpj: form.cnpj || undefined,
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
        if (code === 'INVALID_CNPJ') {
          throw new Error('CNPJ inválido.');
        }
        if (code === 'CNPJ_TAKEN') {
          throw new Error('Este CNPJ já está cadastrado.');
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

        <form
          onSubmit={onSubmit}
          noValidate
          className="mt-8 flex flex-col gap-4"
        >
          <Card padding="md">
            <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
              Sua conta
            </p>
            <div className="flex flex-col gap-3.5">
              <TextField
                id="ownerName"
                label="Seu nome"
                value={form.ownerName}
                onChange={(e) => setField('ownerName', e.target.value)}
                error={visibleError('ownerName')}
                required
                minLength={2}
              />
              <TextField
                id="email"
                label="E-mail"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                error={visibleError('email')}
                required
              />
              <PasswordField
                id="password"
                label="Senha"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setField('password', e.target.value)}
                error={visibleError('password')}
                required
                minLength={6}
              />
              <PasswordField
                id="confirmPassword"
                label="Confirmar senha"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(e) => setField('confirmPassword', e.target.value)}
                error={visibleError('confirmPassword', passwordsDiffer)}
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
                id="businessName"
                label="Nome do estabelecimento"
                value={form.businessName}
                onChange={(e) => setField('businessName', e.target.value)}
                error={visibleError('businessName')}
                required
                minLength={2}
              />
              <TextField
                id="cnpj"
                label="CNPJ (opcional)"
                inputMode="numeric"
                autoComplete="off"
                placeholder="00.000.000/0000-00"
                value={form.cnpj}
                onChange={(e) => setField('cnpj', formatCnpj(e.target.value))}
                error={visibleError('cnpj', Boolean(cnpjError))}
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
                id="locationName"
                label="Nome da unidade"
                value={form.locationName}
                onChange={(e) => setField('locationName', e.target.value)}
                placeholder="Ex.: Loja Jardins"
                error={visibleError('locationName')}
                required
                minLength={2}
              />
              <TextField
                id="locationAddress"
                label="Endereço"
                value={form.locationAddress}
                onChange={(e) => setField('locationAddress', e.target.value)}
                error={visibleError('locationAddress')}
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
