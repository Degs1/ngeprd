import React from "react";
import LandingNavbar from "@/components/landing/LandingNavbar";
import HeroCursorAnimation from "@/components/landing/HeroCursorAnimation";
import ProductPreview from "@/components/landing/ProductPreview";
import WorkflowSection from "@/components/landing/WorkflowSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import ArchitectureSection from "@/components/landing/ArchitectureSection";
import CtaSection from "@/components/landing/CtaSection";
import LandingFooter from "@/components/landing/LandingFooter";

export default function LandingPage() {
  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-white text-[#20242C] overflow-x-clip flex flex-col font-sans">
      {/* Top Sticky Header */}
      <LandingNavbar />

      <main className="flex-1 w-full">
        {/* Hero Section with Interactive Multi-Cursor Assembly Animation */}
        <HeroCursorAnimation />

        {/* Product Showcase / Preview Section */}
        <ProductPreview />

        {/* 5-Step Workflow Section */}
        <WorkflowSection />

        {/* Core Technical Capabilities Section */}
        <FeaturesSection />

        {/* Architecture & Engine Specifications */}
        <ArchitectureSection />

        {/* Final Workspace CTA */}
        <CtaSection />
      </main>

      {/* Clean & Honest Footer */}
      <LandingFooter />
    </div>
  );
}
