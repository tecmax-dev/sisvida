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

/**
 * REGRA PERMANENTE META — MODO MANUAL E CONSERVADOR
 * 
 * NÃO executar automaticamente operações de escrita na Meta.
 * Proibido sem autorização manual explícita:
 * - criar template; reenviar template; editar template; excluir template;
 * - alterar webhook/callback; alterar WABA; alterar Phone Number ID;
 * - gerar retry; auto-retry; backoff automático; scheduler; loop de tentativa;
 * - reenvio de mensagem; alteração de permissões; troca de token.
 * 
 * Consultas READ-ONLY são permitidas.
 * Toda operação de escrita na Graph API deve obedecer:
 * MANUAL_AUTHORIZATION_REQUIRED = true | MAX_ATTEMPTS = 1 | AUTO_RETRY = false
 */

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
