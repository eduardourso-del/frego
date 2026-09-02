export function campaignNotifyCopy(businessName: string, campaignName: string) {
  const title = businessName.trim() || 'Frego';
  const name = campaignName.trim() || 'campanha';
  return {
    title,
    body: `Nova campanha: ${name}`,
    campaignName: name,
  };
}

/** @deprecated use campaignNotifyCopy */
export function campaignPushCopy(businessName: string, campaignName: string) {
  const copy = campaignNotifyCopy(businessName, campaignName);
  return { title: copy.title, body: copy.body };
}
