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
 * After Embedded Signup, resolve the granted WABA + first phone number
 * using the user/system token from code exchange.
 */
export async function fetchSharedWabaPhone(
  accessToken: string,
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
  let wabaId: string | undefined = wabaIds[0];
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
  const phone = phonesBody.data?.[0];
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
