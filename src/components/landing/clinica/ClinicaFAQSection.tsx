import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

const faqs = [
  {
    question: "O Prosinge Clínica atende qual tipo de clínica?",
    answer: "Atendemos clínicas médicas (todas as especialidades), odontológicas, fisioterapia, psicologia, nutrição, estética e centros multidisciplinares — de consultórios individuais a clínicas com dezenas de profissionais.",
  },
  {
    question: "O prontuário eletrônico está em conformidade com o CFM?",
    answer: "Sim. Nosso prontuário segue as resoluções do CFM, com assinatura digital, controle de acesso por perfil, log de auditoria e armazenamento seguro em conformidade com a LGPD.",
  },
  {
    question: "Posso emitir receitas e atestados digitais?",
    answer: "Sim. A prescrição digital tem validade em todo o Brasil, com QR Code de autenticidade. O paciente recebe direto pelo WhatsApp, sem precisar imprimir.",
  },
  {
    question: "Como funciona o faturamento TISS para convênios?",
    answer: "Geramos guias TISS prontas para envio aos convênios, com controle de glosas, recursos e relatórios detalhados. Funciona com Unimed, Bradesco, Amil, SulAmérica e demais operadoras.",
  },
  {
    question: "A migração dos meus dados atuais é gratuita?",
    answer: "Sim. Nossa equipe migra gratuitamente sua agenda, cadastros de pacientes, profissionais, convênios e procedimentos do seu sistema atual sem que você precise refazer nada.",
  },
  {
    question: "Existe fidelidade ou multa por cancelamento?",
    answer: "Não. Sem fidelidade, sem multa. Você cancela quando quiser e pode exportar todos os seus dados a qualquer momento.",
  },
  {
    question: "O sistema funciona em tablet e celular?",
    answer: "Sim. 100% em nuvem e responsivo — funciona em qualquer navegador, no computador, tablet ou celular. Nada para instalar.",
  },
];

export function ClinicaFAQSection() {
  return (
    <section id="faq" className="py-20 lg:py-28 bg-background">
      <div className="container">
        <div className="text-center mb-16">
          <span className="text-primary font-semibold text-sm uppercase tracking-widest mb-3 block">FAQ</span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 tracking-tight">Perguntas Frequentes</h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">Tire suas dúvidas sobre o Prosinge Clínica</p>
        </div>

        <div className="max-w-2xl mx-auto">
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="bg-card border border-border/50 rounded-xl px-6 data-[state=open]:shadow-md data-[state=open]:border-primary/20 transition-all">
                <AccordionTrigger className="text-left text-base font-medium hover:no-underline py-5 hover:text-primary">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="mt-12 text-center">
            <p className="text-muted-foreground text-sm mb-4">Ainda tem dúvidas?</p>
            <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-8 font-semibold shadow-md">
              <a href="https://wa.me/551151943839?text=Olá! Tenho uma dúvida sobre o Prosinge Clínica." target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Falar no WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}