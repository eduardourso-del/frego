'use client';

import { useRef, useState } from 'react';
import { Button, SelectField, TextField } from '@/components/ui';
import {
  BR_UFS,
  formatCep,
  lookupCep,
  type AddressField,
  type OperatingAddress,
} from '@/lib/br-ufs';

export function OperatingAddressFields({
  idPrefix,
  value,
  onChange,
  errors,
  showErrors,
  legacyAddress,
}: {
  idPrefix: string;
  value: OperatingAddress;
  onChange: (patch: Partial<OperatingAddress>) => void;
  errors?: Partial<Record<AddressField, string>>;
  showErrors?: boolean;
  legacyAddress?: string;
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'missing' | 'error'>('idle');
  const lookupSeq = useRef(0);

  function visible(key: AddressField) {
    if (!showErrors) return undefined;
    return errors?.[key];
  }

  async function search(raw = value.postalCode) {
    const digits = raw.replace(/\D/g, '');
    if (digits.length !== 8) {
      setStatus('missing');
      return;
    }
    const seq = ++lookupSeq.current;
    setStatus('loading');
    try {
      const hit = await lookupCep(digits);
      if (seq !== lookupSeq.current) return;
      if (!hit) {
        setStatus('missing');
        return;
      }
      onChange({
        street: hit.street || value.street,
        neighborhood: hit.neighborhood || value.neighborhood,
        city: hit.city || value.city,
        state: hit.state || value.state,
      });
      setStatus('idle');
    } catch {
      if (seq !== lookupSeq.current) return;
      setStatus('error');
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      {legacyAddress ? (
        <p className="text-[13px] leading-snug text-[var(--color-neutral-500)]">
          Endereço atual: {legacyAddress}
        </p>
      ) : null}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <TextField
            id={`${idPrefix}-postalCode`}
            label="CEP"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            value={value.postalCode}
            onChange={(e) => {
              const postalCode = formatCep(e.target.value);
              onChange({ postalCode });
              if (postalCode.replace(/\D/g, '').length === 8) {
                void search(postalCode);
              } else {
                setStatus('idle');
              }
            }}
            error={visible('postalCode')}
            required
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          className="mt-7 shrink-0 px-3"
          disabled={status === 'loading'}
          onClick={() => void search()}
        >
          {status === 'loading' ? 'Buscando…' : 'Buscar'}
        </Button>
      </div>
      {status === 'missing' ? (
        <p className="text-[13px] text-[var(--color-neutral-500)]">
          CEP não encontrado. Preencha o endereço e escolha o estado.
        </p>
      ) : null}
      {status === 'error' ? (
        <p className="text-[13px] text-[var(--color-danger)]">
          Não foi possível buscar o CEP. Preencha o endereço e escolha o estado.
        </p>
      ) : null}
      <TextField
        id={`${idPrefix}-street`}
        label="Logradouro"
        autoComplete="address-line1"
        value={value.street}
        onChange={(e) => onChange({ street: e.target.value })}
        error={visible('street')}
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          id={`${idPrefix}-streetNumber`}
          label="Número"
          value={value.streetNumber}
          onChange={(e) => onChange({ streetNumber: e.target.value })}
          error={visible('streetNumber')}
          required
        />
        <TextField
          id={`${idPrefix}-complement`}
          label="Complemento"
          value={value.complement}
          onChange={(e) => onChange({ complement: e.target.value })}
        />
      </div>
      <TextField
        id={`${idPrefix}-neighborhood`}
        label="Bairro"
        value={value.neighborhood}
        onChange={(e) => onChange({ neighborhood: e.target.value })}
        error={visible('neighborhood')}
        required
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField
          id={`${idPrefix}-city`}
          label="Cidade"
          autoComplete="address-level2"
          value={value.city}
          onChange={(e) => onChange({ city: e.target.value })}
          error={visible('city')}
          required
        />
        <SelectField
          id={`${idPrefix}-state`}
          label="Estado"
          autoComplete="address-level1"
          value={value.state}
          onChange={(e) => onChange({ state: e.target.value })}
          error={visible('state')}
          required
        >
          <option value="">Selecione</option>
          {BR_UFS.map(([uf, name]) => (
            <option key={uf} value={uf}>
              {name}
            </option>
          ))}
        </SelectField>
      </div>
    </div>
  );
}
