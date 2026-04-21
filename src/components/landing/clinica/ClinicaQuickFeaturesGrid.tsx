import { CalendarDays, FileHeart, Receipt, MessageSquare, Pill, Microscope, Video, Cloud } from "lucide-react";

const features = [
  { icon: CalendarDays, title: "Agenda multiprofissional", description: "Visualize todos os profissionais e salas em uma única tela, com cores e tags personalizáveis." },
  { icon: FileHeart, title: "Prontuário eletrônico", description: "Anamnese, evolução SOAP, anexos e histórico completo do paciente em conformidade com o CFM." },
  { icon: Pill, title: "Prescrição digital", description: "Receitas, atestados e laudos com assinatura digital válida em todo o Brasil." },
  { icon: Receipt, title: "Faturamento TISS", description: "Geração de guias TISS, controle de glosas e envio direto para os convênios." },
  { icon: MessageSquare, title: "WhatsApp integrado", description: "Confirmação automática, lembretes, campanhas e atendimento humanizado em um só lugar." },
  { icon: Microscope, title: "Exames e laudos", description: "Solicitação de exames, recebimento de resultados e organização por paciente." },
  { icon: Video, title: "Telemedicina", description: "Consulta por vídeo integrada, sem instalar nada — funciona pelo navegador." },
  { icon: Cloud, title: "100% em nuvem", description: "Acesse de qualquer lugar, com backup automático e segurança LGPD." },
];

export function ClinicaQuickFeaturesGrid() {
  return (
    <section className="py-20 lg:py-28 bg-muted/20">
      <div className="container">
        <div className="text-center mb-16">
          <span className="text-primary font-semibold text-sm uppercase tracking-widest mb-3 block">Recursos</span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 tracking-tight">Mais do que um software</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Uma solução pensada para todo o ciclo de atendimento: do agendamento ao pós-consulta.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {features.map((f, i) => (
            <div key={i} className="group relative bg-card border border-border/50 rounded-2xl p-6 hover:shadow-xl hover:border-primary/20 transition-all duration-500 hover:-translate-y-1">
              <div className="w-11 h-11 rounded-xl bg-primary/8 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-base font-bold text-foreground mb-2 group-hover:text-primary transition-colors">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}