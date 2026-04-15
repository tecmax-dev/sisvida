import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface FeatureBlockProps {
  title: string;
  description: string;
  features?: string[];
  imagePosition: "left" | "right";
  bgColor?: string;
  ctaText?: string;
  ctaLink?: string;
  illustration: React.ReactNode;
}

function FeatureBlock({
  title,
  description,
  features,
  imagePosition,
  bgColor = "bg-background",
  ctaText = "Saiba mais",
  ctaLink = "/cadastro",
  illustration,
}: FeatureBlockProps) {
  return (
    <div className={cn("py-16 lg:py-24", bgColor)}>
      <div className="container">
        <div
          className={cn(
            "flex flex-col gap-12 items-center",
            imagePosition === "left" ? "lg:flex-row" : "lg:flex-row-reverse"
          )}
        >
          {/* Illustration */}
          <div className="lg:w-1/2 flex justify-center">{illustration}</div>

          {/* Content */}
          <div className="lg:w-1/2">
            <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-4 leading-tight">
              {title}
            </h3>
            <p className="text-muted-foreground mb-6 leading-relaxed text-lg">
              {description}
            </p>

            {features && (
              <ul className="space-y-3 mb-8">
                {features.map((f, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
            )}

            <Button
              variant="link"
              className="p-0 h-auto text-primary font-semibold group text-base"
              asChild
            >
              <Link to={ctaLink} className="flex items-center gap-2">
                {ctaText}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// SVG-based illustrations matching the SindSystem style
function ProductivityIllustration() {
  return (
    <div className="relative w-full max-w-md">
      <div className="absolute inset-0 bg-primary/5 rounded-3xl blur-xl" />
      <div className="relative bg-card border border-border rounded-2xl p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div>
            <h4 className="font-bold text-foreground">Dashboard</h4>
            <p className="text-xs text-muted-foreground">Visão em tempo real</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Associados ativos</span>
            <span className="text-sm font-bold text-foreground">12.450</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: "85%" }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Arrecadação mensal</span>
            <span className="text-sm font-bold text-success">R$ 245.000</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-success rounded-full" style={{ width: "72%" }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Inadimplência</span>
            <span className="text-sm font-bold text-destructive">8%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-destructive rounded-full" style={{ width: "8%" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpandIllustration() {
  return (
    <div className="relative w-full max-w-md">
      <div className="absolute inset-0 bg-primary/5 rounded-3xl blur-xl" />
      <div className="relative bg-card border border-border rounded-2xl p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </div>
          <div>
            <h4 className="font-bold text-foreground">App do Associado</h4>
            <p className="text-xs text-muted-foreground">Carteirinha digital</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-primary/5 rounded-xl p-3 text-center border border-primary/10">
            <p className="text-2xl font-bold text-primary">📱</p>
            <p className="text-xs text-muted-foreground mt-1">App Mobile</p>
          </div>
          <div className="bg-success/5 rounded-xl p-3 text-center border border-success/10">
            <p className="text-2xl font-bold text-success">💳</p>
            <p className="text-xs text-muted-foreground mt-1">Carteirinha</p>
          </div>
          <div className="bg-warning/5 rounded-xl p-3 text-center border border-warning/10">
            <p className="text-2xl font-bold text-warning">🔔</p>
            <p className="text-xs text-muted-foreground mt-1">Notificações</p>
          </div>
          <div className="bg-info/5 rounded-xl p-3 text-center border border-info/10">
            <p className="text-2xl font-bold text-info">📊</p>
            <p className="text-xs text-muted-foreground mt-1">Boletos</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AlternatingFeaturesSection() {
  return (
    <section id="features">
      {/* Section Header */}
      <div className="py-12 lg:py-16 bg-muted/30">
        <div className="container text-center">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            ProsindWeb: feito para sindicatos e associações.
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Desde o início, construímos uma plataforma sólida, funcional e fácil de usar. Estamos sempre evoluindo para oferecer o melhor em gestão sindical e associativa.
          </p>
        </div>
      </div>

      <FeatureBlock
        title="Ganhe tempo. Reduza custos. Aumente sua produtividade."
        description="Com o ProsindWeb, você otimiza os processos da sua entidade e acompanha todas as operações do seu Sindicato ou Associação de onde estiver. Elimine a necessidade de servidores locais e reduza o investimento em infraestrutura."
        imagePosition="right"
        bgColor="bg-background"
        illustration={<ProductivityIllustration />}
      />

      <FeatureBlock
        title="Expanda seus projetos e conquiste mais associados."
        description="Com uma interface moderna, simples e responsiva, o ProsindWeb oferece tudo que sua entidade precisa para crescer. Cresça com confiança, conte com o ProsindWeb."
        features={[
          "Gestão completa de cadastros e arrecadação",
          "Controle de benefícios e convênios",
          "Carteirinha digital personalizada no app",
          "Notificações para associados e equipe",
        ]}
        imagePosition="left"
        bgColor="bg-card"
        ctaText="Mais detalhes"
        illustration={<ExpandIllustration />}
      />
    </section>
  );
}
