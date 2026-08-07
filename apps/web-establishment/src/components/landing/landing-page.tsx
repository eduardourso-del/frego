'use client';

import { LandingNav } from '@/components/landing/nav';
import { LandingHero } from '@/components/landing/hero';
import { LandingProblem } from '@/components/landing/problem';
import { LandingLoyalty } from '@/components/landing/loyalty';
import { LandingSales } from '@/components/landing/sales';
import { LandingHowItWorks } from '@/components/landing/how-it-works';
import { LandingSocialProof } from '@/components/landing/social-proof';
import { LandingComparison } from '@/components/landing/comparison';
import { LandingPricingCta } from '@/components/landing/pricing-cta';
import { LandingFooter } from '@/components/landing/footer';

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-[var(--color-bg)]">
      <LandingNav />
      <main>
        <LandingHero />
        <LandingProblem />
        <LandingLoyalty />
        <LandingSales />
        <LandingHowItWorks />
        <LandingSocialProof />
        <LandingComparison />
        <LandingPricingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
