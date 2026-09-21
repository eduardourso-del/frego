'use client';

import { LandingNav } from '@/components/landing/nav';
import { LandingHero } from '@/components/landing/hero';
import { LandingHowItWorks } from '@/components/landing/how-it-works';
import { LandingProblem } from '@/components/landing/problem';
import { LandingLoyalty } from '@/components/landing/loyalty';
import { LandingIntelligence } from '@/components/landing/intelligence';
import { LandingSales } from '@/components/landing/sales';
import { LandingOutcomes } from '@/components/landing/outcomes';
import { LandingCampaigns } from '@/components/landing/campaigns';
import { LandingCustomerApp } from '@/components/landing/customer-app';
import { LandingNetwork } from '@/components/landing/network';
import { LandingComparison } from '@/components/landing/comparison';
import { LandingPricingCta } from '@/components/landing/pricing-cta';
import { LandingFooter } from '@/components/landing/footer';

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-[var(--color-bg)]">
      <LandingNav />
      <main className="overflow-x-hidden">
        <LandingHero />
        <LandingHowItWorks />
        <LandingProblem />
        <LandingLoyalty />
        <LandingIntelligence />
        <LandingSales />
        <LandingOutcomes />
        <LandingCampaigns />
        <LandingCustomerApp />
        <LandingNetwork />
        <LandingComparison />
        <LandingPricingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
