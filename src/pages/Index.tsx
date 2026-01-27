import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/landing/HeroSection";
import { StatsSection } from "@/components/landing/StatsSection";
import { AIFeatureSection } from "@/components/landing/AIFeatureSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { ProblemsSection } from "@/components/landing/ProblemsSection";
import { MigrationSection } from "@/components/landing/MigrationSection";
import { AlternatingFeaturesSection } from "@/components/landing/AlternatingFeaturesSection";
import { QuickFeaturesGrid } from "@/components/landing/QuickFeaturesGrid";
import { PricingSection } from "@/components/landing/PricingSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { CTASection } from "@/components/landing/CTASection";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        {/* 1. Hero com layout lado a lado */}
        <HeroSection />
        
        {/* 2. Seção de IA no Prontuário */}
        <AIFeatureSection />
        
        {/* 3. Depoimentos de clientes */}
        <TestimonialsSection />
        
        {/* 4. Problemas de usar software errado */}
        <ProblemsSection />
        
        {/* 5. Migração fácil */}
        <MigrationSection />
        
        {/* 6. Funcionalidades alternadas (como Clínica nas Nuvens) */}
        <AlternatingFeaturesSection />
        
        {/* 7. Grid rápido de features menores */}
        <QuickFeaturesGrid />
        
        {/* 8. Estatísticas */}
        <StatsSection />
        
        {/* 9. Planos e preços */}
        <PricingSection />
        
        {/* 10. FAQ */}
        <FAQSection />
        
        {/* 11. CTA Final */}
        <CTASection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
