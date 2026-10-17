import { Prisma, prisma } from '@frego/db';
import { resolveMembershipRecognition } from '../audience.js';
import {
  accountNoticeCopy,
  campaignEndingDetail,
  campaignNoticeKey,
  channelSettled,
  collectEndingCampaigns,
  collectExpiryNotices,
  expiryDetail,
  expiryNoticeKey,
  msUntilNextReminder,
  type ChannelAttempt,
} from '../notify/account-notice.js';
import { sendAccountNoticePush } from '../push/account-notice.js';
import { addCivilDays, ymdInSaoPaulo } from '../promo.js';
import { deriveWallet } from '../wallet.js';
import { sendWhatsAppTemplate } from '../whatsapp/client.js';
import {
  ensureAccountNoticeTemplate,
  NOTICE_TEMPLATE_LANG,
  NOTICE_TEMPLATE_NAME,
} from '../whatsapp/templates.js';
import {
  maintainStoredConnection,
  recordWhatsAppSendFailure,
} from '../whatsapp/token-maintain.js';

const MEMBERSHIP_CONCURRENCY = 4;

export type ReminderLog = (msg: string, extra?: Record<string, unknown>) => void;

type NoticeRow = {
  noticeKey: string;
  pushState: string | null;
  whatsappState: string | null;
};

type WhatsAppReady =
  | {
      ok: true;
      connectionId: string;
      phoneNumberId: string;
      accessToken: string;
      templateName: string;
      templateLang: string;
      grantLost: boolean;
    }
  | { ok: false; skipped: string; error?: string };

async function mapPool<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let i = 0;
  const workers = Array.from(
    { length: Math.min(limit, Math.max(items.length, 1)) },
    async () => {
      while (i < items.length) {
        const idx = i;
        i += 1;
        const item = items[idx];
        if (item !== undefined) await fn(item);
      }
    },
  );
  await Promise.all(workers);
}

async function ensureNotices(
  membershipId: string,
  kind: 'expiry' | 'campaign_end',
  keys: string[],
): Promise<Map<string, NoticeRow>> {
  for (const noticeKey of keys) {
    try {
      await prisma.accountNotice.create({
        data: { membershipId, kind, noticeKey },
      });
    } catch (err) {
      if (
        !(err instanceof Prisma.PrismaClientKnownRequestError) ||
        err.code !== 'P2002'
      ) {
        throw err;
      }
    }
  }
  const rows = await prisma.accountNotice.findMany({
    where: { noticeKey: { in: keys } },
    select: { noticeKey: true, pushState: true, whatsappState: true },
  });
  return new Map(rows.map((row) => [row.noticeKey, row]));
}

async function claimChannel(
  keys: string[],
  channel: 'push' | 'whatsapp',
): Promise<string[]> {
  const claimed: string[] = [];
  for (const noticeKey of keys) {
    const updated = await prisma.accountNotice.updateMany({
      where: {
        noticeKey,
        ...(channel === 'push' ? { pushState: null } : { whatsappState: null }),
      },
      data: channel === 'push' ? { pushState: 'sending' } : { whatsappState: 'sending' },
    });
    if (updated.count === 1) claimed.push(noticeKey);
  }
  return claimed;
}

async function releaseChannel(
  keys: string[],
  channel: 'push' | 'whatsapp',
): Promise<void> {
  if (keys.length === 0) return;
  await prisma.accountNotice.updateMany({
    where: {
      noticeKey: { in: keys },
      ...(channel === 'push'
        ? { pushState: 'sending' }
        : { whatsappState: 'sending' }),
    },
    data: channel === 'push' ? { pushState: null } : { whatsappState: null },
  });
}

async function markChannel(
  keys: string[],
  channel: 'push' | 'whatsapp',
  state: 'sent' | 'skipped',
): Promise<void> {
  if (keys.length === 0) return;
  await prisma.accountNotice.updateMany({
    where: { noticeKey: { in: keys } },
    data: channel === 'push' ? { pushState: state } : { whatsappState: state },
  });
}

async function prepareWhatsApp(
  businessId: string,
  log?: ReminderLog,
): Promise<WhatsAppReady> {
  const conn = await prisma.businessWhatsAppConnection.findUnique({
    where: { businessId },
  });
  if (!conn || conn.status !== 'connected') {
    return { ok: false, skipped: 'not_connected' };
  }
  const ready = await maintainStoredConnection(conn.id, { log });
  if (ready.grantLost) return { ok: false, skipped: 'grant_lost' };
  if (!ready.accessToken) {
    return {
      ok: false,
      skipped: 'decrypt_failed',
      error: ready.error ?? 'decrypt_failed',
    };
  }

  let templateStatus = conn.templateNoticeStatus;
  let templateName = conn.templateNoticeName || NOTICE_TEMPLATE_NAME;
  let templateLang = conn.templateNoticeLang || NOTICE_TEMPLATE_LANG;
  if (templateStatus === 'missing') {
    const ensured = await ensureAccountNoticeTemplate(
      conn.wabaId,
      ready.accessToken,
    );
    templateStatus = ensured.status;
    templateName = NOTICE_TEMPLATE_NAME;
    templateLang = NOTICE_TEMPLATE_LANG;
    await prisma.businessWhatsAppConnection.update({
      where: { id: conn.id },
      data: {
        templateNoticeName: templateName,
        templateNoticeLang: templateLang,
        templateNoticeStatus: ensured.status,
        templateNoticeId: ensured.templateId,
        templateNoticeSyncedAt: new Date(),
      },
    });
  }
  if (templateStatus !== 'approved') {
    return { ok: false, skipped: `template_${templateStatus}` };
  }
  return {
    ok: true,
    connectionId: conn.id,
    phoneNumberId: conn.phoneNumberId,
    accessToken: ready.accessToken,
    templateName,
    templateLang,
    grantLost: false,
  };
}

async function sendNoticeWhatsApp(input: {
  ready: WhatsAppReady;
  toE164: string;
  businessName: string;
  detail: string;
  log?: ReminderLog;
}): Promise<ChannelAttempt> {
  if (!input.ready.ok) {
    return {
      sent: false,
      skipped: input.ready.skipped,
      error: input.ready.error,
    };
  }
  if (input.ready.grantLost) return { sent: false, skipped: 'grant_lost' };
  const phone = input.toE164.trim();
  if (phone.length < 10) return { sent: false, skipped: 'invalid_phone' };
  const copy = accountNoticeCopy(input.businessName, input.detail);
  const result = await sendWhatsAppTemplate({
    accessToken: input.ready.accessToken,
    phoneNumberId: input.ready.phoneNumberId,
    toE164: phone,
    templateName: input.ready.templateName,
    languageCode: input.ready.templateLang,
    bodyParams: [copy.title, copy.body],
  });
  if (result.ok) return { sent: true };
  const failure = await recordWhatsAppSendFailure(
    input.ready.connectionId,
    result,
    input.log,
  );
  if (failure === 'grant_lost') input.ready.grantLost = true;
  return {
    sent: false,
    skipped: failure === 'grant_lost' ? 'grant_lost' : 'all_failed',
    error: result.error,
  };
}

async function deliver(input: {
  keys: string[];
  rows: Map<string, NoticeRow>;
  detailFor: (keys: string[]) => string;
  pushType: 'wallet_expiry' | 'campaign_ending';
  campaignId?: string | null;
  businessId: string;
  businessName: string;
  phoneE164: string;
  notificationsEnabled: boolean;
  tokens: string[];
  whatsapp: WhatsAppReady;
  log?: ReminderLog;
}): Promise<'sent' | 'idle'> {
  const pendingPush = input.keys.filter(
    (key) => input.rows.get(key)?.pushState == null,
  );
  const pendingWhatsapp = input.keys.filter(
    (key) => input.rows.get(key)?.whatsappState == null,
  );
  const claimedPush = await claimChannel(pendingPush, 'push');
  const claimedWhatsapp = await claimChannel(pendingWhatsapp, 'whatsapp');
  if (claimedPush.length === 0 && claimedWhatsapp.length === 0) return 'idle';

  let sent = false;
  if (claimedPush.length > 0) {
    try {
      const copy = accountNoticeCopy(
        input.businessName,
        input.detailFor(claimedPush),
      );
      const push = await sendAccountNoticePush({
        tokens: input.tokens,
        notificationsEnabled: input.notificationsEnabled,
        title: copy.title,
        body: copy.body,
        type: input.pushType,
        businessId: input.businessId,
        campaignId: input.campaignId,
      });
      const settled = channelSettled('push', push);
      if (settled === 'retry') await releaseChannel(claimedPush, 'push');
      else {
        await markChannel(claimedPush, 'push', settled);
        if (settled === 'sent') sent = true;
      }
    } catch (err) {
      await releaseChannel(claimedPush, 'push');
      throw err;
    }
  }

  if (claimedWhatsapp.length > 0) {
    try {
      const whatsapp = await sendNoticeWhatsApp({
        ready: input.whatsapp,
        toE164: input.phoneE164,
        businessName: input.businessName,
        detail: input.detailFor(claimedWhatsapp),
        log: input.log,
      });
      const settled = channelSettled('whatsapp', whatsapp);
      if (settled === 'retry') await releaseChannel(claimedWhatsapp, 'whatsapp');
      else {
        await markChannel(claimedWhatsapp, 'whatsapp', settled);
        if (settled === 'sent') sent = true;
      }
    } catch (err) {
      await releaseChannel(claimedWhatsapp, 'whatsapp');
      throw err;
    }
  }

  return sent ? 'sent' : 'idle';
}

export async function runAccountReminders(input?: {
  now?: Date;
  log?: ReminderLog;
}): Promise<{
  businesses: number;
  memberships: number;
  expirySent: number;
  campaignSent: number;
}> {
  const now = input?.now ?? new Date();
  const today = ymdInSaoPaulo(now);
  const until = addCivilDays(today, 7);
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  const untilDate = new Date(`${until}T00:00:00.000Z`);

  const businesses = await prisma.business.findMany({
    where: {
      status: { in: ['trial', 'active', 'past_due'] },
      OR: [
        { stampsExpireDays: { not: null } },
        { pointsExpireDays: { not: null } },
        { cashbackExpireDays: { not: null } },
        {
          campaigns: {
            some: {
              status: 'active',
              type: 'promo',
              endsOn: { gte: todayDate, lte: untilDate },
            },
          },
        },
      ],
    },
    select: { id: true, name: true },
  });

  let memberships = 0;
  let expirySent = 0;
  let campaignSent = 0;

  for (const business of businesses) {
    const whatsapp = await prepareWhatsApp(business.id, input?.log);
    const members = await prisma.membership.findMany({
      where: { businessId: business.id, customer: { deletedAt: null } },
      select: {
        id: true,
        customer: {
          select: {
            phoneE164: true,
            notificationsEnabled: true,
            deviceTokens: { select: { token: true } },
          },
        },
      },
    });

    await mapPool(members, MEMBERSHIP_CONCURRENCY, async (membership) => {
      memberships += 1;
      try {
        const wallet = await deriveWallet(membership.id, business.id);
        const recognized = await resolveMembershipRecognition(
          membership.id,
          business.id,
          wallet,
        );
        const expiry = collectExpiryNotices(wallet.lots);
        const ending = collectEndingCampaigns(recognized.campaigns, today);
        const tokens = membership.customer.deviceTokens.map((row) => row.token);

        if (expiry.length > 0) {
          const keyed = expiry.map((item) => ({
            ...item,
            noticeKey: expiryNoticeKey(membership.id, item.keySuffix),
          }));
          const stored = await ensureNotices(
            membership.id,
            'expiry',
            keyed.map((item) => item.noticeKey),
          );
          const result = await deliver({
            keys: keyed.map((item) => item.noticeKey),
            rows: stored,
            detailFor: (keys) => {
              const wanted = new Set(keys);
              return expiryDetail(
                keyed.filter((item) => wanted.has(item.noticeKey)),
              );
            },
            pushType: 'wallet_expiry',
            businessId: business.id,
            businessName: business.name,
            phoneE164: membership.customer.phoneE164,
            notificationsEnabled: membership.customer.notificationsEnabled,
            tokens,
            whatsapp,
            log: input?.log,
          });
          if (result === 'sent') expirySent += 1;
        }

        if (ending.length > 0) {
          const keyed = ending.map((item) => ({
            ...item,
            noticeKey: campaignNoticeKey(
              membership.id,
              item.campaignId,
              item.endsOn,
            ),
          }));
          const stored = await ensureNotices(
            membership.id,
            'campaign_end',
            keyed.map((item) => item.noticeKey),
          );
          const result = await deliver({
            keys: keyed.map((item) => item.noticeKey),
            rows: stored,
            detailFor: (keys) => {
              const wanted = new Set(keys);
              return campaignEndingDetail(
                keyed.filter((item) => wanted.has(item.noticeKey)),
              );
            },
            pushType: 'campaign_ending',
            campaignId: ending.length === 1 ? ending[0]?.campaignId : null,
            businessId: business.id,
            businessName: business.name,
            phoneE164: membership.customer.phoneE164,
            notificationsEnabled: membership.customer.notificationsEnabled,
            tokens,
            whatsapp,
            log: input?.log,
          });
          if (result === 'sent') campaignSent += 1;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'reminder_failed';
        input?.log?.('account_reminder_member_failed', {
          businessId: business.id,
          membershipId: membership.id,
          error: message,
        });
      }
    });
  }

  input?.log?.('account_reminders_done', {
    businesses: businesses.length,
    memberships,
    expirySent,
    campaignSent,
  });

  return {
    businesses: businesses.length,
    memberships,
    expirySent,
    campaignSent,
  };
}

export function startAccountReminderSchedule(log: {
  info: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
}): void {
  if (process.env.REMINDER_SCHEDULER === '0') return;
  if (
    process.env.NODE_ENV !== 'production' &&
    process.env.REMINDER_SCHEDULER !== '1'
  ) {
    return;
  }
  const tick = () => {
    const wait = msUntilNextReminder();
    setTimeout(() => {
      void runAccountReminders({
        log: (msg, extra) => log.info(extra ?? {}, msg),
      })
        .catch((err: unknown) => {
          log.error({ err }, 'account_reminders_failed');
        })
        .finally(tick);
    }, wait);
    log.info({ waitMs: wait }, 'account_reminders_scheduled');
  };
  tick();
}
