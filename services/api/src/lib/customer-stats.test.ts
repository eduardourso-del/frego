import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { progressFromWallet } from './customer-stats.js';
import type { CampaignWalletEntry, WalletSnapshot } from './wallet.js';

function entry(
  partial: Partial<CampaignWalletEntry> & Pick<CampaignWalletEntry, 'campaignId' | 'type'>,
): CampaignWalletEntry {
  return {
    campaignName: partial.campaignName ?? 'Campanha',
    unitsNeeded: partial.unitsNeeded ?? 10,
    stampsNeeded: partial.stampsNeeded ?? partial.unitsNeeded ?? 10,
    pointsPerReal: null,
    canRedeem: false,
    rewardTitle: 'Prêmio',
    rewardDescription: null,
    rewardImageUrl: null,
    rewardsAvailable: 0,
    ...partial,
  };
}

function snap(
  campaigns: CampaignWalletEntry[],
  stamps = 3,
): WalletSnapshot {
  return {
    pools: { stamps, points: 0, cashbackCents: 0 },
    stampsExpireDays: null,
    pointsExpireDays: null,
    cashbackExpireDays: null,
    cashbackPercent: 0,
    lots: [],
    campaigns,
  };
}

describe('progressFromWallet', () => {
  it('does not treat Promoção as a stamp cycle', () => {
    const progress = progressFromWallet(
      snap([
        entry({
          campaignId: 'promo-1',
          type: 'promo',
          unitsNeeded: 1,
          stampsNeeded: 1,
          canRedeem: false,
          rewardTitle: '50% off',
        }),
      ]),
    );
    assert.equal(progress?.type, 'promo');
    assert.equal(progress?.current, 0);
    assert.equal(progress?.needed, 1);
    assert.equal(progress?.remaining, 1);
    assert.equal(progress?.canRedeem, false);
  });

  it('prefers stamp/points progress over a locked Promoção', () => {
    const progress = progressFromWallet(
      snap([
        entry({
          campaignId: 'promo-1',
          type: 'promo',
          unitsNeeded: 1,
          canRedeem: false,
        }),
        entry({
          campaignId: 'stamps-1',
          type: 'stamps',
          unitsNeeded: 10,
          canRedeem: false,
        }),
      ]),
    );
    assert.equal(progress?.campaignId, 'stamps-1');
    assert.equal(progress?.remaining, 7);
  });

  it('keeps a full stamp card at remaining 0 when the Resgatar cap is hit', () => {
    const progress = progressFromWallet(
      snap(
        [
          entry({
            campaignId: 'stamps-1',
            type: 'stamps',
            unitsNeeded: 10,
            canRedeem: false,
            lockedReason: 'quota_exhausted',
            rewardsAvailable: 0,
          }),
        ],
        20,
      ),
    );
    assert.equal(progress?.remaining, 0);
    assert.equal(progress?.canRedeem, false);
    assert.equal(progress?.lockedReason, 'quota_exhausted');
  });
});
