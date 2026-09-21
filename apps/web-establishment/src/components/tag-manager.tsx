'use client';

import { useCallback, useEffect, useState } from 'react';
import { Tag } from 'lucide-react';
import { API_URL } from '@/lib/api';
import { useBusiness } from '@/lib/business-context';
import {
  TAG_PALETTE,
  tagChipStyle,
  type CatalogTag,
} from '@/lib/tags';

const inputClass =
  'mt-1.5 min-h-11 w-full rounded-[12px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] px-3 text-[15px] font-normal normal-case tracking-normal text-[var(--color-ink)] outline-none focus:border-[var(--color-primary-500)]';

export function TagManager() {
  const { authHeaders, business, businessId } = useBusiness();
  const canManage = business?.role !== 'employee';
  const [tags, setTags] = useState<CatalogTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(TAG_PALETTE[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/tags`, { headers });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error ?? 'Não foi possível carregar as etiquetas.');
      }
      setTags(json.tags ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar.');
      setTags([]);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createTag() {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const headers = {
        ...(await authHeaders()),
        'Content-Type': 'application/json',
      };
      const res = await fetch(`${API_URL}/tags`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: trimmed, color }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          json.message ?? json.error ?? 'Não foi possível criar a etiqueta.',
        );
      }
      setName('');
      setTags((prev) => [...prev, json.tag as CatalogTag]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível criar.');
    } finally {
      setBusy(false);
    }
  }

  async function renameTag(id: string) {
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const headers = {
        ...(await authHeaders()),
        'Content-Type': 'application/json',
      };
      const res = await fetch(`${API_URL}/tags/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ name: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          json.message ?? json.error ?? 'Não foi possível salvar.',
        );
      }
      setTags((prev) =>
        prev.map((t) => (t.id === id ? (json.tag as CatalogTag) : t)),
      );
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  }

  async function setTagColor(id: string, next: string) {
    setBusy(true);
    setError(null);
    try {
      const headers = {
        ...(await authHeaders()),
        'Content-Type': 'application/json',
      };
      const res = await fetch(`${API_URL}/tags/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ color: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          json.message ?? json.error ?? 'Não foi possível salvar.',
        );
      }
      setTags((prev) =>
        prev.map((t) => (t.id === id ? (json.tag as CatalogTag) : t)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  }

  async function archiveTag(id: string) {
    if (!window.confirm('Arquivar esta etiqueta? Clientes que já a têm continuam com ela.')) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/tags/${id}`, {
        method: 'DELETE',
        headers,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          json.message ?? json.error ?? 'Não foi possível arquivar.',
        );
      }
      setTags((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível arquivar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-4 md:p-5">
      <div className="mb-4 flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-primary-50)] text-[var(--color-primary-600)]">
          <Tag size={16} strokeWidth={2.25} aria-hidden />
        </span>
        <div className="min-w-0 pt-0.5">
          <h2 className="text-[14px] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
            Etiquetas
          </h2>
          <p className="mt-0.5 text-[12px] leading-snug text-[var(--color-neutral-500)]">
            Opcional. Adicione etiquetas aos clientes no caixa quando quiser e
            use depois em audiências e campanhas. Sem etiquetas, o caixa
            continua igual.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-[13px] text-[var(--color-neutral-500)]">Carregando…</p>
      ) : (
        <>
          {tags.length === 0 ? (
            <p className="text-[13px] leading-relaxed text-[var(--color-neutral-500)]">
              Nenhuma etiqueta ainda. Crie se a casa quiser recortar clientes
              (ex.: almoço, aniversariante). Não é obrigatório.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {tags.map((tag) => (
                <li
                  key={tag.id}
                  className="flex flex-wrap items-center gap-2 rounded-[12px] border border-[var(--color-hairline)] px-3 py-2"
                >
                  {editingId === tag.id ? (
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => void renameTag(tag.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void renameTag(tag.id);
                        }
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="min-h-9 min-w-0 flex-1 rounded-[8px] border border-[var(--color-primary-200)] px-2 text-[13px] outline-none"
                      autoFocus
                      disabled={!canManage || busy}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (!canManage) return;
                        setEditingId(tag.id);
                        setEditName(tag.name);
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span
                        className="inline-flex max-w-full truncate rounded-full px-2.5 py-1 text-[12px] font-semibold"
                        style={tagChipStyle(tag.color)}
                      >
                        {tag.name}
                      </span>
                    </button>
                  )}
                  {canManage ? (
                    <>
                      <div className="flex items-center gap-1">
                        {TAG_PALETTE.map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            aria-label={`Cor ${hex}`}
                            disabled={busy}
                            onClick={() => void setTagColor(tag.id, hex)}
                            className={`h-5 w-5 rounded-full border ${
                              tag.color === hex
                                ? 'border-[var(--color-ink)]'
                                : 'border-transparent'
                            }`}
                            style={{ background: hex }}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void archiveTag(tag.id)}
                        className="text-[12px] font-semibold text-[var(--color-neutral-400)] hover:text-[var(--color-danger)]"
                      >
                        Arquivar
                      </button>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {canManage ? (
            <div className="mt-4">
              <label className="block text-[13px] font-semibold text-[var(--color-ink)]">
                Nova etiqueta
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void createTag();
                    }
                  }}
                  maxLength={32}
                  placeholder="Ex.: almoço"
                  className={inputClass}
                />
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {TAG_PALETTE.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    aria-label={`Cor ${hex}`}
                    onClick={() => setColor(hex)}
                    className={`h-6 w-6 rounded-full border ${
                      color === hex
                        ? 'border-[var(--color-ink)]'
                        : 'border-transparent'
                    }`}
                    style={{ background: hex }}
                  />
                ))}
                <button
                  type="button"
                  disabled={busy || !name.trim()}
                  onClick={() => void createTag()}
                  className="ml-auto min-h-10 rounded-[12px] bg-[var(--color-primary-500)] px-3.5 text-[13px] font-semibold text-white disabled:opacity-50"
                >
                  Adicionar
                </button>
              </div>
            </div>
          ) : null}

          {error ? (
            <p className="mt-3 text-[13px] text-[var(--color-danger)]" role="alert">
              {error}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
