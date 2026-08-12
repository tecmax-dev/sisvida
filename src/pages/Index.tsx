import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/landing/HeroSection";
import { StatsSection } from "@/components/landing/StatsSection";
import { BentoFeaturesSection } from "@/components/landing/BentoFeaturesSection";
import { AlternatingFeaturesSection } from "@/components/landing/AlternatingFeaturesSection";
import { QuickFeaturesGrid } from "@/components/landing/QuickFeaturesGrid";
import { ProblemsSection } from "@/components/landing/ProblemsSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { CTASection } from "@/components/landing/CTASection";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <HeroSection />
        <StatsSection />
        <BentoFeaturesSection />
        <AlternatingFeaturesSection />
        <QuickFeaturesGrid />
        <ProblemsSection />
        <TestimonialsSection />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
