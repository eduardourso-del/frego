import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCampaignPushMessage,
  campaignPushCopy,
  chunkTokens,
  isStaleFcmTokenError,
  shouldQueueCampaignAudiencePush,
} from './push/campaign-notify.js';
import { campaignNotifyCopy } from './notify/campaign-copy.js';

describe('shouldQueueCampaignAudiencePush', () => {
  it('sends on create-as-active with audience', () => {
    assert.equal(
      shouldQueueCampaignAudiencePush({
        previousStatus: null,
        nextStatus: 'active',
        audienceSegmentId: 'aud_1',
      }),
      true,
    );
  });

  it('sends on draft to active with audience', () => {
    assert.equal(
      shouldQueueCampaignAudiencePush({
        previousStatus: 'draft',
        nextStatus: 'active',
        audienceSegmentId: 'aud_1',
      }),
      true,
    );
  });

  it('does not send on create draft', () => {
    assert.equal(
      shouldQueueCampaignAudiencePush({
        previousStatus: null,
        nextStatus: 'draft',
        audienceSegmentId: 'aud_1',
      }),
      false,
    );
  });

  it('does not send without audience', () => {
    assert.equal(
      shouldQueueCampaignAudiencePush({
        previousStatus: 'draft',
        nextStatus: 'active',
        audienceSegmentId: null,
      }),
      false,
    );
  });

  it('does not send on second activate', () => {
    assert.equal(
      shouldQueueCampaignAudiencePush({
        previousStatus: 'active',
        nextStatus: 'active',
        audienceSegmentId: 'aud_1',
      }),
      false,
    );
  });

  it('sends on paused to active when never sent', () => {
    assert.equal(
      shouldQueueCampaignAudiencePush({
        previousStatus: 'paused',
        nextStatus: 'active',
        audienceSegmentId: 'aud_1',
        alreadySent: false,
      }),
      true,
    );
  });

  it('does not send on pause then re-activate after the first send', () => {
    assert.equal(
      shouldQueueCampaignAudiencePush({
        previousStatus: 'paused',
        nextStatus: 'active',
        audienceSegmentId: 'aud_1',
        alreadySent: true,
      }),
      false,
    );
  });
});

describe('chunkTokens', () => {
  it('splits into batches of 500', () => {
    const tokens = Array.from({ length: 501 }, (_, i) => `t${i}`);
    const chunks = chunkTokens(tokens);
    assert.equal(chunks.length, 2);
    assert.equal(chunks[0]?.length, 500);
    assert.equal(chunks[1]?.length, 1);
  });

  it('returns a single chunk when under the limit', () => {
    assert.deepEqual(chunkTokens(['a', 'b'], 500), [['a', 'b']]);
  });
});

describe('isStaleFcmTokenError', () => {
  it('detects unregistered and invalid tokens', () => {
    assert.equal(
      isStaleFcmTokenError({
        code: 'messaging/registration-token-not-registered',
      }),
      true,
    );
    assert.equal(
      isStaleFcmTokenError({ code: 'messaging/invalid-registration-token' }),
      true,
    );
    assert.equal(isStaleFcmTokenError({ code: 'messaging/internal-error' }), false);
    assert.equal(isStaleFcmTokenError(undefined), false);
  });
});

describe('campaignPushCopy', () => {
  it('uses business name and campaign name in pt-BR', () => {
    assert.deepEqual(campaignPushCopy('Café Bloom', '10 carimbos'), {
      title: 'Café Bloom',
      body: 'Nova campanha: 10 carimbos',
    });
    assert.deepEqual(campaignNotifyCopy('Café Bloom', '10 carimbos'), {
      title: 'Café Bloom',
      body: 'Nova campanha: 10 carimbos',
      campaignName: '10 carimbos',
    });
  });

  it('falls back to Frego when business name is blank', () => {
    assert.equal(campaignPushCopy('  ', 'Promo').title, 'Frego');
  });
});

describe('buildCampaignPushMessage', () => {
  it('includes notification and data payload', () => {
    const message = buildCampaignPushMessage({
      tokens: ['abc'],
      businessName: 'Loja',
      campaignName: 'VIP',
      businessId: 'biz_1',
      campaignId: 'cmp_1',
    });
    assert.deepEqual(message.notification, {
      title: 'Loja',
      body: 'Nova campanha: VIP',
    });
    assert.deepEqual(message.data, {
      type: 'campaign_new',
      businessId: 'biz_1',
      campaignId: 'cmp_1',
    });
    const payload = message.apns?.payload as Record<string, unknown> | undefined;
    assert.equal(payload?.type, 'campaign_new');
    assert.equal(payload?.businessId, 'biz_1');
    assert.equal(payload?.campaignId, 'cmp_1');
    assert.deepEqual(message.tokens, ['abc']);
  });
});
