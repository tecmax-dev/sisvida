import { Check, ArrowRight, BarChart3, Users, Smartphone, FileText, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import appScreenshot from "@/assets/app-screenshot.png";

interface FeatureBlockProps {
  title: string;
  subtitle: string;
  description: string;
  features: string[];
  imagePosition: "left" | "right";
  icon: React.ReactNode;
  gradient: string;
  imageSrc?: string;
}

function FeatureBlock({
  title,
  subtitle,
  description,
  features,
  imagePosition,
  icon,
  gradient,
  imageSrc,
}: FeatureBlockProps) {
  return (
    <div className="py-20 lg:py-28">
      <div className="container">
        <div
          className={cn(
            "flex flex-col gap-16 items-center",
            imagePosition === "left" ? "lg:flex-row" : "lg:flex-row-reverse"
          )}
        >
          {/* Visual */}
          <div className="lg:w-1/2 flex justify-center">
            <div className={cn("relative w-full max-w-xs")}>
              <div className={cn("absolute inset-0 rounded-3xl blur-2xl opacity-20", gradient)} />
              {imageSrc ? (
                <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-border/60 max-h-[400px]">
                  <img 
                    src={imageSrc} 
                    alt={title}
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="relative bg-card border border-border/60 rounded-2xl p-8 shadow-xl">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      {icon}
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground text-sm">{subtitle}</h4>
                      <p className="text-xs text-muted-foreground">Painel em tempo real</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Associados ativos</span>
                      <span className="text-sm font-bold text-foreground tabular-nums">12.450</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: "85%" }} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Arrecadação mensal</span>
                      <span className="text-sm font-bold text-foreground tabular-nums">R$ 245.000</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary/70 rounded-full transition-all duration-1000" style={{ width: "72%" }} />
                    </div>
                    <div className="grid grid-cols-3 gap-3 pt-4">
                      {[
                        { label: "Novos", value: "+128" },
                        { label: "Inativos", value: "32" },
                        { label: "Pendentes", value: "15" },
                      ].map((item) => (
                        <div key={item.label} className="bg-muted/50 rounded-xl p-3 text-center">
                          <p className="text-lg font-bold text-foreground">{item.value}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{item.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="lg:w-1/2">
            <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight tracking-tight">
              {title}
            </h3>
            <p className="text-muted-foreground mb-8 leading-relaxed text-lg">
              {description}
            </p>

            <ul className="space-y-4 mb-8">
              {features.map((f, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="h-3 w-3 text-primary" />
                  </div>
                  <span className="text-foreground/80">{f}</span>
                </li>
              ))}
            </ul>

            <Button
              variant="link"
              className="p-0 h-auto text-primary font-semibold group text-base"
              asChild
            >
              <a href="https://wa.me/5571982786864?text=Ol%C3%A1!%20Quero%20testar%20o%20Prosinge%20gratuitamente." target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                Saiba mais
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AlternatingFeaturesSection() {
  return (
    <section id="features">
      <div className="py-16 bg-background">
        <div className="container text-center">
          <span className="text-primary font-semibold text-sm uppercase tracking-widest mb-3 block">
            Funcionalidades
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 tracking-tight">
            Tudo que seu sindicato precisa
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Uma plataforma sólida, funcional e feita para a realidade de sindicatos, associações e federações.
          </p>
        </div>
      </div>

      <FeatureBlock
        title="Dashboard inteligente para tomada de decisão"
        subtitle="Dashboard"
        description="Acompanhe indicadores-chave em tempo real. Visualize associados, arrecadação, inadimplência e muito mais em um painel centralizado e intuitivo."
        features={[
          "Indicadores financeiros em tempo real",
          "Gestão completa de associados e cadastros",
          "Relatórios gerenciais automatizados",
          "Controle de inadimplência inteligente",
        ]}
        imagePosition="right"
        icon={<BarChart3 className="h-6 w-6 text-primary" />}
        gradient="bg-primary"
      />

      <div className="border-t border-border/30" />

      <FeatureBlock
        title="App do associado com carteirinha digital"
        subtitle="App Mobile"
        description="Ofereça uma experiência moderna aos seus associados com app personalizado, carteirinha digital, notificações automáticas e autoatendimento completo."
        features={[
          "Carteirinha digital com QR Code",
          "2ª via de boletos pelo app",
          "Notificações via WhatsApp e push",
          "Agendamento online de serviços",
        ]}
        imagePosition="left"
        icon={<Smartphone className="h-6 w-6 text-primary" />}
        gradient="bg-emerald-500"
        imageSrc={appScreenshot}
      />
    </section>
  );
}
