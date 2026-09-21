'use client';

type FbLoginResponse = {
  authResponse?: { code?: string };
};

type FbSdk = {
  init: (opts: Record<string, unknown>) => void;
  login: (
    cb: (resp: FbLoginResponse) => void,
    opts: Record<string, unknown>,
  ) => void;
};

type WaEmbeddedSession = {
  type?: string;
  event?: string;
  data?: {
    phone_number_id?: string;
    waba_id?: string;
    business_id?: string;
    current_step?: string;
    error_message?: string;
  };
};

export type WhatsAppSignupMode = 'cloud' | 'coexistence';

export type WhatsAppEmbeddedSignupResult = {
  code: string;
  mode: WhatsAppSignupMode;
  /** Meta coexistence finish (existing WhatsApp Business app number). */
  coexistence: boolean;
  wabaId?: string;
  phoneNumberId?: string;
};

declare global {
  interface Window {
    FB?: FbSdk;
    fbAsyncInit?: () => void;
  }
}

const GRAPH_VERSION = 'v26.0';

let sdkPromise: Promise<FbSdk> | null = null;

function loadFacebookSdk(appId: string): Promise<FbSdk> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('no_window'));
  }
  if (window.FB) return Promise.resolve(window.FB);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB?.init({
        appId,
        autoLogAppEvents: true,
        cookie: true,
        xfbml: false,
        version: GRAPH_VERSION,
      });
      if (window.FB) resolve(window.FB);
      else reject(new Error('FB_SDK_INIT_FAILED'));
    };

    const existing = document.getElementById('facebook-jssdk');
    if (existing) return;

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.onerror = () => reject(new Error('FB_SDK_LOAD_FAILED'));
    document.body.appendChild(script);
  });

  return sdkPromise;
}

function parseWaSession(raw: unknown): WaEmbeddedSession | null {
  if (typeof raw !== 'string') return null;
  try {
    const data = JSON.parse(raw) as WaEmbeddedSession;
    if (data?.type === 'WA_EMBEDDED_SIGNUP') return data;
  } catch {
    /* ignore non-JSON postMessages */
  }
  return null;
}

/**
 * Launch Meta WhatsApp Embedded Signup and return the OAuth code.
 *
 * - `coexistence`: keep WhatsApp Business app + Cloud API on the same number.
 *   This is the production path after the Meta app is Live with Advanced Access.
 * - `cloud`: Cloud API number only (dedicated / test number, no Business app).
 *
 * Do not pass redirect_uri — the JS SDK popup returns the code to the
 * callback with no redirect, and Meta's token exchange must omit it too.
 *
 * Prefer HTTPS hosts (Meta docs). localhost http:// often sticks on the
 * cancel/reentry dialog.
 */
export async function launchWhatsAppEmbeddedSignup(
  mode: WhatsAppSignupMode = 'cloud',
): Promise<WhatsAppEmbeddedSignupResult> {
  const appId = process.env.NEXT_PUBLIC_META_APP_ID?.trim();
  const configId = process.env.NEXT_PUBLIC_META_EMBEDDED_CONFIG_ID?.trim();
  if (!appId || !configId) {
    throw new Error(
      'Configure NEXT_PUBLIC_META_APP_ID e NEXT_PUBLIC_META_EMBEDDED_CONFIG_ID',
    );
  }

  if (
    typeof window !== 'undefined' &&
    window.location.protocol === 'http:' &&
    window.location.hostname !== 'localhost'
  ) {
    throw new Error(
      'Embedded Signup exige HTTPS. Use o domínio Vercel ou localhost.',
    );
  }

  const FB = await loadFacebookSdk(appId);

  return new Promise((resolve, reject) => {
    let settled = false;
    let abandonedStep: string | undefined;
    let coexistence = mode === 'coexistence';
    let sessionWabaId: string | undefined;
    let sessionPhoneNumberId: string | undefined;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', onMessage);
      fn();
    };

    const onMessage = (event: MessageEvent) => {
      if (
        typeof event.origin !== 'string' ||
        !event.origin.endsWith('facebook.com')
      ) {
        return;
      }
      const session = parseWaSession(event.data);
      if (!session) return;

      if (
        session.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING' ||
        session.event === 'FINISH'
      ) {
        if (session.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') {
          coexistence = true;
        }
        sessionWabaId = session.data?.waba_id ?? sessionWabaId;
        sessionPhoneNumberId =
          session.data?.phone_number_id ?? sessionPhoneNumberId;
      }

      // Meta sends FINISH with asset IDs; CANCEL/error include the screen left.
      if (session.event === 'CANCEL' || session.event === 'error') {
        abandonedStep =
          session.data?.current_step ||
          session.data?.error_message ||
          session.event;
      }
    };

    window.addEventListener('message', onMessage);

    const extras: Record<string, unknown> = {
      setup: {},
      sessionInfoVersion: '3',
    };
    if (mode === 'coexistence') {
      extras.featureType = 'whatsapp_business_app_onboarding';
    }

    FB.login(
      (response) => {
        const code = response.authResponse?.code;
        if (code) {
          finish(() =>
            resolve({
              code,
              mode,
              coexistence,
              wabaId: sessionWabaId,
              phoneNumberId: sessionPhoneNumberId,
            }),
          );
          return;
        }
        const reason = abandonedStep
          ? `Fluxo Meta interrompido (${abandonedStep}). Feche o popup e tente de novo, selecionando um Business.`
          : 'Conexão cancelada ou sem código do Meta. Feche o popup do Facebook e tente novamente.';
        finish(() => reject(new Error(reason)));
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        extras,
      },
    );
  });
}

export function isMetaEmbeddedSignupConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_META_APP_ID?.trim() &&
      process.env.NEXT_PUBLIC_META_EMBEDDED_CONFIG_ID?.trim(),
  );
}
