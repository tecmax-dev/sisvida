import { useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ClinicaHeroSection } from "@/components/landing/clinica/ClinicaHeroSection";
import { ClinicaStatsSection } from "@/components/landing/clinica/ClinicaStatsSection";
import { ClinicaFeaturesSection } from "@/components/landing/clinica/ClinicaFeaturesSection";
import { ClinicaQuickFeaturesGrid } from "@/components/landing/clinica/ClinicaQuickFeaturesGrid";
import { ClinicaProblemsSection } from "@/components/landing/clinica/ClinicaProblemsSection";
import { ClinicaTestimonialsSection } from "@/components/landing/clinica/ClinicaTestimonialsSection";
import { ClinicaFAQSection } from "@/components/landing/clinica/ClinicaFAQSection";
import { ClinicaCTASection } from "@/components/landing/clinica/ClinicaCTASection";

export default function ClinicaLandingPage() {
  useEffect(() => {
    document.title = "Prosinge Clínica — Sistema de gestão para clínicas e consultórios";
    const desc = "Sistema completo para clínicas, consultórios e centros médicos: agenda, prontuário eletrônico, prescrição digital, financeiro, TISS e WhatsApp.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <ClinicaHeroSection />
        <ClinicaStatsSection />
        <ClinicaFeaturesSection />
        <ClinicaQuickFeaturesGrid />
        <ClinicaProblemsSection />
        <ClinicaTestimonialsSection />
        <ClinicaFAQSection />
        <ClinicaCTASection />
      </main>
      <Footer />
    </div>
  );
}