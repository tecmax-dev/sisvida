import { Check, ArrowRight, Calendar, Stethoscope, Wallet, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Block {
  title: string;
  subtitle: string;
  description: string;
  features: string[];
  imagePosition: "left" | "right";
  icon: React.ReactNode;
  mockup: React.ReactNode;
}

function FeatureBlock({ title, subtitle, description, features, imagePosition, icon, mockup }: Block) {
  return (
    <div className="py-20 lg:py-28">
      <div className="container">
        <div className={cn("flex flex-col gap-16 items-center", imagePosition === "left" ? "lg:flex-row" : "lg:flex-row-reverse")}>
          <div className="lg:w-1/2 flex justify-center w-full">
            <div className="relative w-full max-w-sm">
              <div className="absolute inset-0 rounded-3xl blur-2xl opacity-20 bg-primary" />
              <div className="relative bg-card border border-border/60 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">{icon}</div>
                  <div>
                    <h4 className="font-bold text-foreground text-sm">{subtitle}</h4>
                    <p className="text-xs text-muted-foreground">Visão em tempo real</p>
                  </div>
                </div>
                {mockup}
              </div>
            </div>
          </div>

          <div className="lg:w-1/2">
            <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight tracking-tight">{title}</h3>
            <p className="text-muted-foreground mb-8 leading-relaxed text-lg">{description}</p>
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
            <Button variant="link" className="p-0 h-auto text-primary font-semibold group text-base" asChild>
              <a href="https://wa.me/5571982786864?text=Ol%C3%A1!%20Quero%20testar%20o%20Prosinge%20gratuitamente." target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                Quero conhecer
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ClinicaFeaturesSection() {
  return (
    <section id="features">
      <div className="py-16 bg-background">
        <div className="container text-center">
          <span className="text-primary font-semibold text-sm uppercase tracking-widest mb-3 block">Funcionalidades</span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 tracking-tight">Tudo que sua clínica precisa</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Da agenda ao prontuário, do financeiro ao marketing — uma plataforma feita para clínicas, consultórios e centros médicos.
          </p>
        </div>
      </div>

      <FeatureBlock
        title="Agenda inteligente para sua equipe"
        subtitle="Agenda"
        description="Visualize todos os profissionais em uma única tela, com confirmação automática via WhatsApp e controle de salas e procedimentos."
        features={[
          "Agenda multiprofissional e por sala",
          "Confirmação automática via WhatsApp",
          "Bloqueios, recorrência e fila de espera",
          "Controle de no-show com relatórios",
        ]}
        imagePosition="right"
        icon={<Calendar className="h-5 w-5 text-primary" />}
        mockup={
          <div className="space-y-3">
            {[
              { time: "08:00", name: "Maria Silva", type: "Consulta", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
              { time: "09:30", name: "João Santos", type: "Retorno", color: "bg-amber-50 text-amber-700 border-amber-200" },
              { time: "10:00", name: "Ana Costa", type: "Exame", color: "bg-blue-50 text-blue-700 border-blue-200" },
              { time: "11:30", name: "Pedro Lima", type: "Procedimento", color: "bg-purple-50 text-purple-700 border-purple-200" },
            ].map((a, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <span className="text-xs font-bold text-foreground tabular-nums w-12">{a.time}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{a.name}</p>
                </div>
                <span className={cn("text-[10px] font-semibold px-2 py-1 rounded-full border", a.color)}>{a.type}</span>
              </div>
            ))}
          </div>
        }
      />

      <div className="border-t border-border/30" />

      <FeatureBlock
        title="Prontuário eletrônico completo"
        subtitle="Prontuário"
        description="Anamnese, evolução, prescrição digital, atestados e exames em um único lugar. Tudo seguro, em conformidade com a LGPD e o CFM."
        features={[
          "Prontuário SOAP e evolução por consulta",
          "Prescrição e atestados digitais com assinatura",
          "Anamnese personalizável por especialidade",
          "Anexos, exames e laudos centralizados",
        ]}
        imagePosition="left"
        icon={<Stethoscope className="h-5 w-5 text-primary" />}
        mockup={
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">Última consulta</div>
            <div className="bg-muted/30 rounded-lg p-3 space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Pressão</span>
                <span className="text-xs font-bold text-foreground">120/80</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Frequência</span>
                <span className="text-xs font-bold text-foreground">72 bpm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Saturação</span>
                <span className="text-xs font-bold text-foreground">98%</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground pt-2">Prescrições ativas</div>
            <div className="space-y-1.5">
              <div className="text-xs bg-primary/5 text-foreground px-3 py-2 rounded">Losartana 50mg — 1x ao dia</div>
              <div className="text-xs bg-primary/5 text-foreground px-3 py-2 rounded">AAS 100mg — 1x ao dia</div>
            </div>
          </div>
        }
      />

      <div className="border-t border-border/30" />

      <FeatureBlock
        title="Financeiro e faturamento sem dor de cabeça"
        subtitle="Financeiro"
        description="Controle completo de receitas, despesas, repasses para profissionais, faturamento TISS e fluxo de caixa em tempo real."
        features={[
          "Faturamento TISS para convênios",
          "Repasses automáticos por profissional",
          "Boletos, Pix e cartão integrados",
          "Fluxo de caixa e DRE em tempo real",
        ]}
        imagePosition="right"
        icon={<Wallet className="h-5 w-5 text-primary" />}
        mockup={
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Receita do mês</span>
                <span className="text-sm font-bold text-foreground tabular-nums">R$ 84.250</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: "82%" }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Repasses pagos</span>
                <span className="text-sm font-bold text-foreground tabular-nums">R$ 32.180</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary/70 rounded-full" style={{ width: "65%" }} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2">
              {[{ l: "Pix", v: "R$ 28k" }, { l: "Convênio", v: "R$ 41k" }, { l: "Cartão", v: "R$ 15k" }].map((it) => (
                <div key={it.l} className="bg-muted/50 rounded-lg p-2 text-center">
                  <p className="text-xs font-bold text-foreground">{it.v}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{it.l}</p>
                </div>
              ))}
            </div>
          </div>
        }
      />

      <div className="border-t border-border/30" />

      <FeatureBlock
        title="WhatsApp e marketing automatizados"
        subtitle="Relacionamento"
        description="Confirme consultas, envie lembretes, faça campanhas, mensagens de aniversário e fidelize seus pacientes — tudo automaticamente."
        features={[
          "Confirmação e lembretes via WhatsApp",
          "Campanhas segmentadas por perfil",
          "Mensagens automáticas de aniversário",
          "Pesquisa de satisfação NPS pós-consulta",
        ]}
        imagePosition="left"
        icon={<Smartphone className="h-5 w-5 text-primary" />}
        mockup={
          <div className="space-y-2">
            {[
              { t: "✅ Maria S. confirmou", time: "agora" },
              { t: "📩 47 lembretes enviados", time: "5min" },
              { t: "🎂 12 aniversariantes hoje", time: "manhã" },
              { t: "⭐ NPS 9/10 (Dr. Lucas)", time: "ontem" },
            ].map((m, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-xs text-foreground">{m.t}</span>
                <span className="text-[10px] text-muted-foreground">{m.time}</span>
              </div>
            ))}
          </div>
        }
      />
    </section>
  );
}