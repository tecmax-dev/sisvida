import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

const faqs = [
  {
    question: "O que é o Prosinge?",
    answer: "O Prosinge é um sistema de gestão completo para sindicatos, associações e federações, integrando módulos administrativos, financeiros, jurídicos e de relacionamento com o associado.",
  },
  {
    question: "O Prosinge atende sindicatos de qualquer porte?",
    answer: "Sim. Possuímos planos para entidades de pequeno, médio ou grande porte, com recursos escaláveis conforme o número de associados.",
  },
  {
    question: "É possível emitir boletos bancários pelo sistema?",
    answer: "Sim. Permite emissão de boletos registrados com integração bancária. O Portal do Associado também permite geração de segunda via.",
  },
  {
    question: "O sistema controla a inadimplência?",
    answer: "Sim. Possui controle de vencimentos, cobrança automática e notificações por WhatsApp e e-mail para reduzir a inadimplência.",
  },
  {
    question: "Existe um portal para o associado?",
    answer: "Sim. O Portal permite emitir 2ª via de boletos, atualizar dados cadastrais, solicitar documentos e acompanhar informações junto ao sindicato.",
  },
  {
    question: "O Prosinge oferece suporte?",
    answer: "Sim. Nossa equipe oferece suporte técnico dedicado, treinamentos e orientação para garantir o melhor aproveitamento do sistema.",
  },
];

export function FAQSection() {
  return (
    <section id="faq" className="py-20 lg:py-28 bg-background">
      <div className="container">
        <div className="text-center mb-16">
          <span className="text-primary font-semibold text-sm uppercase tracking-widest mb-3 block">
            FAQ
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 tracking-tight">
            Perguntas Frequentes
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Tire suas dúvidas sobre o Prosinge
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-card border border-border/50 rounded-xl px-6 data-[state=open]:shadow-md data-[state=open]:border-primary/20 transition-all"
              >
                <AccordionTrigger className="text-left text-base font-medium hover:no-underline py-5 hover:text-primary">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="mt-12 text-center">
            <p className="text-muted-foreground text-sm mb-4">Ainda tem dúvidas?</p>
            <Button
              asChild
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-8 font-semibold shadow-md"
            >
              <a
                href="https://wa.me/5571982786864?text=Olá! Tenho uma dúvida sobre o Prosinge"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
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
