import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@frego/db';
import { requireCustomerAuth } from '../plugins/auth.js';
import { deriveWallet } from '../lib/wallet.js';
import { resolveMembershipRecognition } from '../lib/audience.js';
import { civilYmd } from '../lib/promo.js';
import { findCity, type CityRef } from '../lib/city.js';
import { setCustomerFavorite } from '../lib/favorite.js';
import {
  EXPLORATION_STATUSES,
  browsingCity,
  buildExplorationFeed,
  campaignAppliesToCity,
  leadLine,
  listCatalogCities,
  locationInCity,
  orderLocationsForCity,
} from '../lib/exploration.js';

const cityBody = z.object({
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().min(2).max(2),
});

const placeQuery = z.object({
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().min(2).max(2),
});

const listedBusinessSelect = {
  id: true,
  name: true,
  type: true,
  slogan: true,
  logoUrl: true,
  heroImageUrl: true,
  primaryColor: true,
  primaryColorDark: true,
  pointsPerReal: true,
  stampsExpireDays: true,
  pointsExpireDays: true,
  locations: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      name: true,
      address: true,
      city: true,
      state: true,
      isOpen: true,
    },
  },
  campaigns: {
    where: { status: 'active' as const },
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      name: true,
      type: true,
      cartela: true,
      stampsNeeded: true,
      pointsPerReal: true,
      cashbackPercent: true,
      rewardTitle: true,
      rewardDescription: true,
      rewardImageUrl: true,
      startsOn: true,
      endsOn: true,
      weekdays: true,
      redeemMax: true,
      redeemPeriod: true,
      audienceSegmentId: true,
      createdAt: true,
      locations: { select: { locationId: true } },
    },
  },
};

type ListedBusiness = Awaited<
  ReturnType<typeof loadListedBusinesses>
>[number];

async function loadListedBusinesses() {
  return prisma.business.findMany({
    where: {
      explorationVisible: true,
      status: { in: [...EXPLORATION_STATUSES] },
    },
    select: listedBusinessSelect,
  });
}

function applicableCampaigns(business: ListedBusiness, city: CityRef) {
  const locations = business.locations;
  return business.campaigns.filter((campaign) =>
    campaignAppliesToCity(
      {
        locationIds: campaign.locations.map((location) => location.locationId),
      },
      locations,
      city,
    ),
  );
}

function loyaltyUnitsNeeded(campaign: {
  type: string;
  stampsNeeded: number | null;
}): number | null {
  if (
    campaign.type === 'cashback' ||
    campaign.type === 'birthday' ||
    campaign.type === 'promo'
  ) {
    return null;
  }
  return campaign.stampsNeeded ?? (campaign.type === 'spend' ? 100 : 10);
}

function publicCampaignEntry(
  campaign: ListedBusiness['campaigns'][number],
) {
  const needed =
    campaign.stampsNeeded ?? (campaign.type === 'spend' ? 100 : 10);
  return {
    campaignId: campaign.id,
    campaignName: campaign.name,
    type: campaign.type,
    unitsNeeded: needed,
    stampsNeeded: needed,
    pointsPerReal: campaign.pointsPerReal,
    cashbackPercent: campaign.cashbackPercent,
    cashbackBalanceCents: 0,
    canRedeem: false,
    rewardsAvailable: 0,
    rewardTitle: campaign.rewardTitle,
    rewardDescription: campaign.rewardDescription,
    rewardImageUrl: campaign.rewardImageUrl,
    lockedReason: campaign.type === 'birthday' ? 'no_birthday' : null,
    startsOn: civilYmd(campaign.startsOn),
    endsOn: civilYmd(campaign.endsOn),
    weekdays: campaign.weekdays,
    redeemMax: campaign.redeemMax,
    redeemPeriod: campaign.redeemPeriod,
    audienceSegmentId: campaign.audienceSegmentId,
    audienceEligible: false,
    audienceName: null,
    audienceUnlockMessage: null,
    balance: 0,
    cartela: campaign.cartela,
  };
}

function publicBusiness(business: ListedBusiness, city: CityRef) {
  return {
    id: business.id,
    name: business.name,
    type: business.type,
    slogan: business.slogan,
    logoUrl: business.logoUrl,
    heroImageUrl: business.heroImageUrl,
    primaryColor: business.primaryColor,
    primaryColorDark: business.primaryColorDark,
    pointsPerReal: business.pointsPerReal,
    stampsExpireDays: business.stampsExpireDays,
    pointsExpireDays: business.pointsExpireDays,
    locations: orderLocationsForCity(business.locations, city).map(
      (location) => ({
        id: location.id,
        name: location.name,
        address: location.address,
        city: location.city,
        state: location.state,
        isOpen: location.isOpen,
      }),
    ),
  };
}

export const explorationRoutes: FastifyPluginAsync = async (app) => {
  app.get('/me/exploration/cities', async (request) => {
    requireCustomerAuth(request);
    return { cities: await listCatalogCities() };
  });

  app.get('/me/exploration', async (request) => {
    const auth = requireCustomerAuth(request);
    const customer = await prisma.customer.findUniqueOrThrow({
      where: { id: auth.customerId },
      select: {
        city: true,
        state: true,
        browseCity: true,
        browseState: true,
        browseCityChosen: true,
      },
    });
    const browsing = browsingCity(customer);
    const cidade =
      customer.city && customer.state
        ? { city: customer.city, state: customer.state }
        : null;
    if (!browsing) {
      return {
        cidade,
        browsing: null,
        redeemableCount: 0,
        sections: [],
        places: [],
      };
    }

    const businesses = await loadListedBusinesses();
    const inCity = businesses.filter((business) =>
      business.locations.some((location) => locationInCity(location, browsing)),
    );

    const ids = inCity.map((business) => business.id);
    const [memberships, favorites] = await Promise.all([
      prisma.membership.findMany({
        where: { customerId: auth.customerId, businessId: { in: ids } },
        select: { id: true, businessId: true, isFavorite: true },
      }),
      prisma.favorite.findMany({
        where: { customerId: auth.customerId, businessId: { in: ids } },
        select: { businessId: true },
      }),
    ]);
    const membershipByBusiness = new Map(
      memberships.map((membership) => [membership.businessId, membership]),
    );
    const favoriteIds = new Set(favorites.map((favorite) => favorite.businessId));

    const redeemable = new Set<string>();
    const progress = new Map<
      string,
      { unitsNeeded: number; balance: number; cashbackBalanceCents: number | null }
    >();
    await Promise.all(
      memberships.map(async (membership) => {
        const business = inCity.find((item) => item.id === membership.businessId);
        if (!business) return;
        const applicable = new Set(
          applicableCampaigns(business, browsing).map((campaign) => campaign.id),
        );
        const wallet = await deriveWallet(membership.id, membership.businessId);
        const recognized = await resolveMembershipRecognition(
          membership.id,
          membership.businessId,
          wallet,
        );
        for (const campaign of recognized.campaigns) {
          if (!applicable.has(campaign.campaignId)) continue;
          progress.set(campaign.campaignId, {
            unitsNeeded: campaign.unitsNeeded,
            balance: campaign.balance,
            cashbackBalanceCents: campaign.cashbackBalanceCents ?? null,
          });
          if (campaign.canRedeem && campaign.type !== 'cashback') {
            redeemable.add(campaign.campaignId);
          }
        }
      }),
    );

    const places = inCity.map((business) => {
      const membership = membershipByBusiness.get(business.id);
      const isFavorite =
        favoriteIds.has(business.id) || membership?.isFavorite === true;
      return {
        businessId: business.id,
        name: business.name,
        type: business.type,
        isFavorite,
        hasMembership: Boolean(membership),
        business: {
          id: business.id,
          name: business.name,
          type: business.type,
          slogan: business.slogan,
          logoUrl: business.logoUrl,
          heroImageUrl: business.heroImageUrl,
          primaryColor: business.primaryColor,
          primaryColorDark: business.primaryColorDark,
        },
      };
    });

    const campaigns = inCity.flatMap((business) => {
      const place = places.find((item) => item.businessId === business.id);
      return applicableCampaigns(business, browsing).map((campaign) => ({
        campaignId: campaign.id,
        businessId: business.id,
        businessName: business.name,
        logoUrl: business.logoUrl,
        name: campaign.name,
        type: campaign.type,
        rewardTitle: campaign.rewardTitle,
        rewardDescription: campaign.rewardDescription,
        rewardImageUrl: campaign.rewardImageUrl,
        cashbackPercent: campaign.cashbackPercent,
        canRedeem: redeemable.has(campaign.id) && campaign.type !== 'cashback',
        unitsNeeded:
          progress.get(campaign.id)?.unitsNeeded ?? loyaltyUnitsNeeded(campaign),
        balance:
          progress.get(campaign.id)?.balance ??
          (loyaltyUnitsNeeded(campaign) == null ? null : 0),
        cashbackBalanceCents:
          progress.get(campaign.id)?.cashbackBalanceCents ?? null,
        primaryColor: business.primaryColor,
        primaryColorDark: business.primaryColorDark,
        isFavorite: place?.isFavorite === true,
        hasMembership: place?.hasMembership === true,
      }));
    });

    const sections = buildExplorationFeed(places, campaigns).map((section) => ({
      type: section.type,
      places: section.places.map((place) => ({
        businessId: place.businessId,
        isFavorite: place.isFavorite,
        hasMembership: place.hasMembership,
        business: place.business,
      })),
      campaigns: section.campaigns.map((campaign) => ({
        campaignId: campaign.campaignId,
        businessId: campaign.businessId,
        businessName: campaign.businessName,
        logoUrl: campaign.logoUrl,
        name: campaign.name,
        type: campaign.type,
        rewardTitle: campaign.rewardTitle,
        rewardDescription: campaign.rewardDescription,
        rewardImageUrl: campaign.rewardImageUrl,
        cashbackPercent: campaign.cashbackPercent,
        canRedeem: campaign.canRedeem,
        unitsNeeded: campaign.unitsNeeded,
        balance: campaign.balance,
        cashbackBalanceCents: campaign.cashbackBalanceCents,
        primaryColor: campaign.primaryColor,
        primaryColorDark: campaign.primaryColorDark,
        isFavorite: campaign.isFavorite,
        hasMembership: campaign.hasMembership,
      })),
    }));

    const legacyPlaces = [...places]
      .sort((a, b) => {
        if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
        return a.name.localeCompare(b.name, 'pt-BR');
      })
      .map((place) => {
        const business = inCity.find((item) => item.id === place.businessId);
        const applicable = business
          ? applicableCampaigns(business, browsing)
          : [];
        return {
          businessId: place.businessId,
          isFavorite: place.isFavorite,
          hasMembership: place.hasMembership,
          leadLine: leadLine(
            applicable.map((campaign) => ({
              id: campaign.id,
              type: campaign.type,
              cashbackPercent: campaign.cashbackPercent,
              rewardTitle: campaign.rewardTitle,
              createdAt: campaign.createdAt,
              locationIds: campaign.locations.map(
                (location) => location.locationId,
              ),
            })),
          ),
          business: place.business,
        };
      });

    return {
      cidade,
      browsing,
      redeemableCount: sections.reduce(
        (sum, section) =>
          sum + section.campaigns.filter((campaign) => campaign.canRedeem).length,
        0,
      ),
      sections,
      places: legacyPlaces,
    };
  });

  app.put('/me/exploration/city', async (request, reply) => {
    const auth = requireCustomerAuth(request);
    const body = cityBody.parse(request.body);
    const match = findCity(await listCatalogCities(), body.city, body.state);
    if (!match) {
      return reply.code(400).send({ error: 'CITY_UNAVAILABLE' });
    }
    const customer = await prisma.customer.update({
      where: { id: auth.customerId },
      data: {
        browseCity: match.city,
        browseState: match.state,
        browseCityChosen: true,
      },
      select: {
        browseCity: true,
        browseState: true,
        browseCityChosen: true,
      },
    });
    return {
      browsing: { city: customer.browseCity, state: customer.browseState },
    };
  });

  app.get('/me/exploration/businesses/:businessId', async (request, reply) => {
    const auth = requireCustomerAuth(request);
    const { businessId } = request.params as { businessId: string };
    const query = placeQuery.parse(request.query);
    const city = { city: query.city.trim(), state: query.state.trim().toUpperCase() };

    const business = (
      await prisma.business.findMany({
        where: {
          id: businessId,
          explorationVisible: true,
          status: { in: [...EXPLORATION_STATUSES] },
        },
        select: listedBusinessSelect,
      })
    )[0];
    if (!business) {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }
    const inCity = business.locations.some((location) =>
      locationInCity(location, city),
    );
    if (!inCity) {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }

    const applicableIds = new Set(
      applicableCampaigns(business, city).map((campaign) => campaign.id),
    );
    const [membership, favorite] = await Promise.all([
      prisma.membership.findUnique({
        where: {
          customerId_businessId: {
            customerId: auth.customerId,
            businessId,
          },
        },
      }),
      prisma.favorite.findUnique({
        where: {
          customerId_businessId: {
            customerId: auth.customerId,
            businessId,
          },
        },
        select: { customerId: true },
      }),
    ]);
    const isFavorite = Boolean(favorite) || membership?.isFavorite === true;
    const shown = publicBusiness(business, city);

    if (!membership) {
      const campaigns = applicableCampaigns(business, city).map(publicCampaignEntry);
      const pools = { stamps: 0, points: 0, cashbackCents: 0 };
      return {
        business: shown,
        membership: { isFavorite },
        badges: [],
        pools,
        campaigns,
        wallet: {
          pools,
          campaigns,
          lots: [],
          stampDestinations: [],
        },
        hasMembership: false,
      };
    }

    const baseWallet = await deriveWallet(membership.id, businessId);
    const scopedWallet = {
      ...baseWallet,
      campaigns: baseWallet.campaigns.filter((campaign) =>
        applicableIds.has(campaign.campaignId),
      ),
    };
    const { badges, campaigns } = await resolveMembershipRecognition(
      membership.id,
      businessId,
      scopedWallet,
    );
    const filtered = campaigns;
    const wallet = { ...baseWallet, campaigns: filtered };
    return {
      business: shown,
      membership: {
        id: membership.id,
        isVip: membership.isVip,
        isFavorite,
      },
      badges,
      wallet,
      pools: wallet.pools,
      campaigns: filtered,
      hasMembership: true,
    };
  });

  app.patch('/me/favorites/:businessId', async (request, reply) => {
    const auth = requireCustomerAuth(request);
    const { businessId } = request.params as { businessId: string };
    const body = z.object({ isFavorite: z.boolean() }).parse(request.body);
    const updated = await setCustomerFavorite(
      auth.customerId,
      businessId,
      body.isFavorite,
    );
    if (!updated) {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }
    return updated;
  });
};
