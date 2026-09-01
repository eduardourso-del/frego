export type PublicShopCampaign = {
  id: string;
  name: string;
  type: string;
  stampsNeeded: number | null;
  pointsPerReal: number | null;
  cashbackPercent?: number | null;
  rewardTitle: string | null;
  rewardDescription: string | null;
  rewardImageUrl: string | null;
};

export type PublicShopLocation = {
  name: string;
  address: string | null;
  isOpen: boolean;
};

export type PublicShopBusiness = {
  name: string;
  type: string;
  logoUrl: string | null;
  heroImageUrl: string | null;
  primaryColor: string;
  primaryColorDark: string;
  slogan: string | null;
  slug: string;
  cashbackPercent?: number;
  pointsPerReal?: number;
};

export type PublicShopPayload = {
  business: PublicShopBusiness;
  locations: PublicShopLocation[];
  campaigns: PublicShopCampaign[];
};
