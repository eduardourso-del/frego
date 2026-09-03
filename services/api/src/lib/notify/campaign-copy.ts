export function campaignNotifyCopy(businessName: string, campaignName: string) {
  const title = (businessName.trim() || 'Frego').slice(0, 60);
  const name = (campaignName.trim() || 'campanha').slice(0, 120);
  return {
    title,
    body: `Lançou uma nova campanha: ${name}. Abra o app Frego para conferir os detalhes e participar.`.slice(
      0,
      180,
    ),
    campaignName: name,
  };
}

/** @deprecated use campaignNotifyCopy */
export function campaignPushCopy(businessName: string, campaignName: string) {
  const copy = campaignNotifyCopy(businessName, campaignName);
  return { title: copy.title, body: copy.body };
}
