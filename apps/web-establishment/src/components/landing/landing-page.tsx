'use client';

import { LandingNav } from '@/components/landing/nav';
import { LandingHero } from '@/components/landing/hero';
import { LandingProblem } from '@/components/landing/problem';
import { LandingLoyalty } from '@/components/landing/loyalty';
import { LandingCampaigns } from '@/components/landing/campaigns';
import { LandingIntelligence } from '@/components/landing/intelligence';
import { LandingCustomerApp } from '@/components/landing/customer-app';
import { LandingSales } from '@/components/landing/sales';
import { LandingHowItWorks } from '@/components/landing/how-it-works';
import { LandingComparison } from '@/components/landing/comparison';
import { LandingPricingCta } from '@/components/landing/pricing-cta';
import { LandingFooter } from '@/components/landing/footer';

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-[var(--color-bg)]">
      <LandingNav />
      <main className="overflow-x-hidden">
        <LandingHero />
        <LandingProblem />
        <LandingLoyalty />
        <LandingHowItWorks />
        <LandingCampaigns />
        <LandingIntelligence />
        <LandingCustomerApp />
        <LandingSales />
        <LandingComparison />
        <LandingPricingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
