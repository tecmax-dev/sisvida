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
    question: "O que é o ProsindWeb?",
    answer:
      "O ProsindWeb é um sistema de gestão completo para sindicatos, associações e federações, integrando módulos administrativos, financeiros, jurídicos e de relacionamento com o associado, de forma segura e conforme a legislação vigente.",
  },
  {
    question: "O ProsindWeb atende sindicatos de qualquer porte?",
    answer:
      "Sim. O ProsindWeb possui planos para entidades de pequeno, médio ou grande porte, oferecendo recursos escaláveis conforme o número de associados ou a complexidade das operações.",
  },
  {
    question: "É possível emitir boletos bancários pelo sistema?",
    answer:
      "Sim. O ProsindWeb permite a emissão de boletos bancários e integração com diversos bancos. O Portal do Associado também permite a geração de segunda via de boletos.",
  },
  {
    question: "O sistema controla a inadimplência dos associados?",
    answer:
      "Sim. O ProsindWeb possui recursos de controle de vencimentos, cobrança automática e envio de notificações por e-mail ou WhatsApp, ajudando a reduzir a inadimplência.",
  },
  {
    question: "Existe um portal para o associado?",
    answer:
      "Sim. O Portal do Associado permite que o filiado emita 2ª via de boletos, atualize seus dados cadastrais, solicite documentos e acompanhe informações junto ao sindicato.",
  },
  {
    question: "O ProsindWeb oferece suporte?",
    answer:
      "Sim. Nossa equipe oferece suporte técnico, treinamentos e orientação para garantir o melhor aproveitamento de todas as funcionalidades do ProsindWeb.",
  },
];

export function FAQSection() {
  return (
    <section id="faq" className="py-20 lg:py-28 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Perguntas Frequentes (FAQ)
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Tire suas principais dúvidas sobre o ProsindWeb e descubra como podemos ajudar seu sindicato ou associação.
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-card border border-border rounded-2xl px-6 data-[state=open]:shadow-lg data-[state=open]:border-primary/30 transition-all"
              >
                <AccordionTrigger className="text-left text-base md:text-lg font-medium hover:no-underline py-5 hover:text-primary">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="mt-12 text-center">
            <p className="text-muted-foreground mb-4">Ainda tem dúvidas? Fale com nossa equipe</p>
            <Button
              asChild
              size="lg"
              className="btn-eclini px-8 font-semibold"
            >
              <a
                href="https://wa.me/557332311784?text=Olá! Tenho uma dúvida sobre o ProsindWeb"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <MessageCircle className="h-5 w-5" />
                Falar no WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
