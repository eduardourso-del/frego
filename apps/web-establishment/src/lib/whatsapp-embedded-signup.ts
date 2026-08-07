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

declare global {
  interface Window {
    FB?: FbSdk;
    fbAsyncInit?: () => void;
  }
}

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
        cookie: true,
        xfbml: false,
        version: 'v21.0',
      });
      if (window.FB) resolve(window.FB);
      else reject(new Error('FB_SDK_INIT_FAILED'));
    };

    const existing = document.getElementById('facebook-jssdk');
    if (existing) return;

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.onerror = () => reject(new Error('FB_SDK_LOAD_FAILED'));
    document.body.appendChild(script);
  });

  return sdkPromise;
}

/**
 * Launch Meta WhatsApp Embedded Signup and return the OAuth code.
 */
export async function launchWhatsAppEmbeddedSignup(): Promise<string> {
  const appId = process.env.NEXT_PUBLIC_META_APP_ID?.trim();
  const configId = process.env.NEXT_PUBLIC_META_EMBEDDED_CONFIG_ID?.trim();
  if (!appId || !configId) {
    throw new Error(
      'Configure NEXT_PUBLIC_META_APP_ID e NEXT_PUBLIC_META_EMBEDDED_CONFIG_ID',
    );
  }

  const FB = await loadFacebookSdk(appId);

  return new Promise((resolve, reject) => {
    FB.login(
      (response) => {
        const code = response.authResponse?.code;
        if (code) resolve(code);
        else reject(new Error('Conexão cancelada ou sem código do Meta'));
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: '',
          sessionInfoVersion: '3',
        },
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
