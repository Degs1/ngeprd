import React from "react";
import LandingNavbar from "@/components/landing/LandingNavbar";
import HeroSection from "@/components/landing/HeroSection";
import ProductShowcase from "@/components/landing/ProductShowcase";
import PipelineSection from "@/components/landing/PipelineSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import SpecimenComparison from "@/components/landing/SpecimenComparison";
import CtaSection from "@/components/landing/CtaSection";
import LandingFooter from "@/components/landing/LandingFooter";

export default function LandingPage() {
  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-[#0C1310] text-[#EAF0EB] overflow-x-clip flex flex-col font-sans selection:bg-[#1E2E25] selection:text-[#8EA690]">
      {/* Top Fixed Header with Brand Logo */}
      <LandingNavbar />

      <main className="flex-1 w-full">
        {/* Editorial Hero with Interactive Prompt Bar */}
        <HeroSection />

        {/* Live Workspace App-Frame Showcase */}
        <ProductShowcase />

        {/* 4-Stage Precision Pipeline */}
        <PipelineSection />

        {/* Technical Architecture & Capabilities Bento */}
        <FeaturesSection />

        {/* Quality Comparison: Generic Chatbot vs ngePRD */}
        <SpecimenComparison />

        {/* Workspace Conversion CTA */}
        <CtaSection />
      </main>

      {/* Honest Forest Editorial Footer */}
      <LandingFooter />
    </div>
  );
}
