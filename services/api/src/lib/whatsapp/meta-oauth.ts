const DEFAULT_GRAPH = 'v21.0';

export function graphVersion(): string {
  return process.env.WHATSAPP_GRAPH_VERSION?.trim() || DEFAULT_GRAPH;
}

export function graphBase(): string {
  return `https://graph.facebook.com/${graphVersion()}`;
}

export type ExchangedToken = {
  accessToken: string;
  tokenType?: string;
  expiresIn?: number;
};

export async function exchangeEmbeddedSignupCode(
  code: string,
): Promise<ExchangedToken> {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    throw Object.assign(new Error('META_APP_NOT_CONFIGURED'), {
      statusCode: 503,
    });
  }

  // Embedded Signup via FB.login returns the code to a JS callback — Meta does
  // not bind a redirect_uri to that code. Sending redirect_uri causes 36008.
  const url = new URL(`${graphBase()}/oauth/access_token`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('code', code);

  const res = await fetch(url);
  const body = (await res.json()) as {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
    error?: { message?: string };
  };
  if (!res.ok || !body.access_token) {
    throw Object.assign(
      new Error(body.error?.message ?? 'META_CODE_EXCHANGE_FAILED'),
      { statusCode: 400, meta: body },
    );
  }
  return {
    accessToken: body.access_token,
    tokenType: body.token_type,
    expiresIn: body.expires_in,
  };
}

export type SharedWabaPhone = {
  wabaId: string;
  metaBusinessId: string | null;
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  qualityRating: string | null;
  messagingLimitTier: string | null;
};

/**
 * After Embedded Signup, resolve the granted WABA + phone number
 * using the user/system token from code exchange.
 * Prefer session asset IDs when Meta returned them.
 */
export async function fetchSharedWabaPhone(
  accessToken: string,
  opts?: {
    preferredPhoneNumberId?: string | null;
    preferredWabaId?: string | null;
  },
): Promise<SharedWabaPhone> {
  // debug_token → granular scopes / granular_scopes for whatsapp
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    throw Object.assign(new Error('META_APP_NOT_CONFIGURED'), {
      statusCode: 503,
    });
  }

  const debugUrl = new URL(`${graphBase()}/debug_token`);
  debugUrl.searchParams.set('input_token', accessToken);
  debugUrl.searchParams.set('access_token', `${appId}|${appSecret}`);

  const debugRes = await fetch(debugUrl);
  const debugBody = (await debugRes.json()) as {
    data?: {
      granular_scopes?: Array<{ scope: string; target_ids?: string[] }>;
    };
    error?: { message?: string };
  };

  const wabaIds =
    debugBody.data?.granular_scopes?.find(
      (s) =>
        s.scope === 'whatsapp_business_management' ||
        s.scope === 'whatsapp_business_messaging',
    )?.target_ids ?? [];

  // Fallback: list businesses → owned WABAs
  let wabaId: string | undefined =
    opts?.preferredWabaId &&
    (!wabaIds.length || wabaIds.includes(opts.preferredWabaId))
      ? opts.preferredWabaId
      : wabaIds[0];
  let metaBusinessId: string | null = null;

  if (!wabaId) {
    const bizRes = await fetch(
      `${graphBase()}/me/businesses?fields=id,name&access_token=${encodeURIComponent(accessToken)}`,
    );
    const bizBody = (await bizRes.json()) as {
      data?: Array<{ id: string }>;
    };
    const business = bizBody.data?.[0];
    if (!business) {
      throw Object.assign(new Error('META_NO_BUSINESS_GRANTED'), {
        statusCode: 400,
      });
    }
    metaBusinessId = business.id;
    const wabaRes = await fetch(
      `${graphBase()}/${business.id}/owned_whatsapp_business_accounts?fields=id,name&access_token=${encodeURIComponent(accessToken)}`,
    );
    const wabaBody = (await wabaRes.json()) as {
      data?: Array<{ id: string }>;
    };
    wabaId = wabaBody.data?.[0]?.id;
  }

  if (!wabaId) {
    throw Object.assign(new Error('META_NO_WABA_GRANTED'), {
      statusCode: 400,
      debug: debugBody,
    });
  }

  const resolvedWabaId = wabaId;

  // Parent business of WABA
  if (!metaBusinessId) {
    const wabaInfoRes = await fetch(
      `${graphBase()}/${resolvedWabaId}?fields=id,owner_business_info&access_token=${encodeURIComponent(accessToken)}`,
    );
    const wabaInfo = (await wabaInfoRes.json()) as {
      owner_business_info?: { id?: string };
    };
    metaBusinessId = wabaInfo.owner_business_info?.id ?? null;
  }

  const phonesRes = await fetch(
    `${graphBase()}/${resolvedWabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,messaging_limit_tier&access_token=${encodeURIComponent(accessToken)}`,
  );
  const phonesBody = (await phonesRes.json()) as {
    data?: Array<{
      id: string;
      display_phone_number?: string;
      verified_name?: string;
      quality_rating?: string;
      messaging_limit_tier?: string;
    }>;
    error?: { message?: string };
  };
  const phones = phonesBody.data ?? [];
  const preferredPhoneNumberId = opts?.preferredPhoneNumberId;
  const phone =
    (preferredPhoneNumberId
      ? phones.find((p) => p.id === preferredPhoneNumberId)
      : undefined) ?? phones[0];
  if (!phone) {
    throw Object.assign(
      new Error(phonesBody.error?.message ?? 'META_NO_PHONE_ON_WABA'),
      { statusCode: 400 },
    );
  }

  return {
    wabaId: resolvedWabaId,
    metaBusinessId,
    phoneNumberId: phone.id,
    displayPhoneNumber: phone.display_phone_number ?? null,
    verifiedName: phone.verified_name ?? null,
    qualityRating: phone.quality_rating ?? null,
    messagingLimitTier: phone.messaging_limit_tier ?? null,
  };
}

/** Detect Cloud API + WhatsApp Business app coexistence on a phone. */
export async function fetchPhoneCoexistenceFlags(
  phoneNumberId: string,
  accessToken: string,
): Promise<{ isOnBizApp: boolean; platformType: string | null }> {
  try {
    const res = await fetch(
      `${graphBase()}/${phoneNumberId}?fields=is_on_biz_app,platform_type&access_token=${encodeURIComponent(accessToken)}`,
    );
    const body = (await res.json()) as {
      is_on_biz_app?: boolean;
      platform_type?: string;
    };
    return {
      isOnBizApp: Boolean(body.is_on_biz_app),
      platformType: body.platform_type ?? null,
    };
  } catch {
    return { isOnBizApp: false, platformType: null };
  }
}

export type SmbAppDataSyncResult = {
  ok: boolean;
  requestId?: string;
  error?: string;
};

/**
 * Start SMB App Data sync (contacts or history). Required within 24h of
 * coexistence onboarding or Meta forces offboarding.
 * @see https://developers.facebook.com/docs/whatsapp/embedded-signup/custom-flows/onboarding-business-app-users/
 */
export async function initiateSmbAppDataSync(
  phoneNumberId: string,
  accessToken: string,
  syncType: 'smb_app_state_sync' | 'history',
): Promise<SmbAppDataSyncResult> {
  try {
    const res = await fetch(`${graphBase()}/${phoneNumberId}/smb_app_data`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        sync_type: syncType,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      request_id?: string;
      error?: { message?: string };
    };
    if (!res.ok || body.error) {
      return {
        ok: false,
        error: body.error?.message ?? `smb_sync_failed_${res.status}`,
      };
    }
    return { ok: true, requestId: body.request_id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'smb_sync_failed',
    };
  }
}

/** Best-effort subscribe WABA to app webhooks. */
export async function subscribeWabaWebhooks(
  wabaId: string,
  accessToken: string,
): Promise<boolean> {
  try {
    const res = await fetch(
      `${graphBase()}/${wabaId}/subscribed_apps?access_token=${encodeURIComponent(accessToken)}`,
      { method: 'POST' },
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Register the business phone on Cloud API.
 * Without this, sends often fail with (#133010) Account not registered.
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/reference/registration/
 */
export async function registerCloudApiPhone(
  phoneNumberId: string,
  accessToken: string,
): Promise<{ ok: boolean; error?: string }> {
  const pin =
    process.env.WHATSAPP_REGISTER_PIN?.trim() ||
    String(Math.floor(100000 + Math.random() * 900000));

  try {
    const res = await fetch(`${graphBase()}/${phoneNumberId}/register`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        pin,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      error?: { message?: string; code?: number };
    };
    if (!res.ok || body.error) {
      return {
        ok: false,
        error: body.error?.message ?? `register_failed_${res.status}`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'register_failed',
    };
  }
}
