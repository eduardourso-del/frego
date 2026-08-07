'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/lib/auth-context';
import { API_URL } from '@/lib/api';

export type BusinessBrand = {
  id: string;
  name: string;
  type: string;
  logoUrl: string | null;
  heroImageUrl: string | null;
  primaryColor: string;
  primaryColorDark: string;
  slogan: string | null;
  slug: string | null;
  status: string;
  pointsPerReal?: number;
  role?: string;
};

type BusinessContextValue = {
  business: BusinessBrand | null;
  businesses: BusinessBrand[];
  businessId: string | null;
  loading: boolean;
  setBusinessId: (id: string) => void;
  refresh: () => Promise<void>;
  updateBusiness: (patch: Partial<BusinessBrand>) => Promise<BusinessBrand>;
  authHeaders: () => Promise<Record<string, string>>;
};

const BusinessContext = createContext<BusinessContextValue | null>(null);
const STORAGE_KEY = 'frego.activeBusinessId';

function storageKeyFor(uid: string | null | undefined) {
  return uid ? `${STORAGE_KEY}.${uid}` : STORAGE_KEY;
}

function applyBrandCss(business: BusinessBrand | null) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (!business) {
    root.style.removeProperty('--color-primary-500');
    root.style.removeProperty('--color-primary-600');
    root.style.removeProperty('--color-primary-50');
    return;
  }
  root.style.setProperty('--color-primary-500', business.primaryColor);
  root.style.setProperty('--color-primary-600', business.primaryColorDark);
  root.style.setProperty('--color-primary-50', `${business.primaryColor}14`);
}

function clearLegacyStorage() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { user, getToken, loading: authLoading } = useAuth();
  const [businesses, setBusinesses] = useState<BusinessBrand[]>([]);
  const [businessId, setBusinessIdState] = useState<string | null>(null);
  const [business, setBusiness] = useState<BusinessBrand | null>(null);
  const [loading, setLoading] = useState(true);

  const setBusinessId = useCallback(
    (id: string) => {
      setBusinessIdState(id);
      if (typeof window !== 'undefined' && user?.uid) {
        localStorage.setItem(storageKeyFor(user.uid), id);
      }
    },
    [user?.uid],
  );

  const authHeaders = useCallback(async () => {
    const token = await getToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const stored =
      typeof window !== 'undefined' && user?.uid
        ? localStorage.getItem(storageKeyFor(user.uid))
        : null;
    const id = businessId ?? stored;
    if (id) headers['X-Business-Id'] = id;
    return headers;
  }, [getToken, businessId, user?.uid]);

  const resetBusinessState = useCallback(() => {
    setBusiness(null);
    setBusinesses([]);
    setBusinessIdState(null);
    applyBrandCss(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!user) {
      resetBusinessState();
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        resetBusinessState();
        return;
      }

      const stored =
        typeof window !== 'undefined'
          ? localStorage.getItem(storageKeyFor(user.uid))
          : null;
      // Preferência só se ainda for válida depois da listagem
      const preferId = businessId ?? stored ?? null;

      const listHeaders: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };
      // Não força loja demo — deixa a API resolver pelo UID
      if (preferId) listHeaders['X-Business-Id'] = preferId;

      const listRes = await fetch(`${API_URL}/me/businesses`, {
        headers: listHeaders,
      });
      const listJson = await listRes.json();
      if (!listRes.ok) {
        throw new Error(listJson.error ?? 'Falha ao listar lojas');
      }

      const list = (listJson.businesses ?? []) as BusinessBrand[];
      setBusinesses(list);

      const activeId =
        list.find((b) => b.id === preferId)?.id ?? list[0]?.id ?? null;

      if (!activeId) {
        resetBusinessState();
        clearLegacyStorage();
        if (typeof window !== 'undefined') {
          localStorage.removeItem(storageKeyFor(user.uid));
        }
        return;
      }

      setBusinessIdState(activeId);
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKeyFor(user.uid), activeId);
        clearLegacyStorage();
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        'X-Business-Id': activeId,
      };
      const res = await fetch(`${API_URL}/business`, { headers });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Falha ao carregar negócio');
      const next = json.business as BusinessBrand;
      setBusiness(next);
      applyBrandCss(next);
    } catch {
      resetBusinessState();
    } finally {
      setLoading(false);
    }
  }, [getToken, businessId, user, resetBusinessState]);

  const updateBusiness = useCallback(
    async (patch: Partial<BusinessBrand>) => {
      const headers = {
        ...(await authHeaders()),
        'Content-Type': 'application/json',
      };
      const res = await fetch(`${API_URL}/business`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Falha ao salvar');
      const next = json.business as BusinessBrand;
      setBusiness(next);
      setBusinesses((prev) =>
        prev.map((b) => (b.id === next.id ? { ...b, ...next } : b)),
      );
      applyBrandCss(next);
      return next;
    },
    [authHeaders],
  );

  // Recarrega sempre que o usuário Firebase muda (login / cadastro / logout)
  useEffect(() => {
    if (authLoading) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on auth identity change
  }, [authLoading, user?.uid]);

  const value = useMemo(
    () => ({
      business,
      businesses,
      businessId,
      loading,
      setBusinessId,
      refresh,
      updateBusiness,
      authHeaders,
    }),
    [
      business,
      businesses,
      businessId,
      loading,
      setBusinessId,
      refresh,
      updateBusiness,
      authHeaders,
    ],
  );

  return (
    <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>
  );
}

export function useBusiness() {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error('useBusiness fora de BusinessProvider');
  return ctx;
}
