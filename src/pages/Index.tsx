import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/landing/HeroSection";
import { StatsSection } from "@/components/landing/StatsSection";
import { AlternatingFeaturesSection } from "@/components/landing/AlternatingFeaturesSection";
import { QuickFeaturesGrid } from "@/components/landing/QuickFeaturesGrid";
import { ProblemsSection } from "@/components/landing/ProblemsSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { CTASection } from "@/components/landing/CTASection";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        {/* 1. Hero + Highlight cards */}
        <HeroSection />

        {/* 2. Números */}
        <StatsSection />

        {/* 3. Funcionalidades alternadas */}
        <AlternatingFeaturesSection />

        {/* 4. Grid de benefícios */}
        <QuickFeaturesGrid />

        {/* 5. Por que escolher */}
        <ProblemsSection />

        {/* 6. Depoimentos */}
        <TestimonialsSection />

        {/* 7. Planos e preços */}
        <PricingSection />

        {/* 8. FAQ */}
        <FAQSection />

        {/* 9. CTA Final */}
        <CTASection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
