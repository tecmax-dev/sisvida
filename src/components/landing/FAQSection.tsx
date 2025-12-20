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
    question: "Como funciona o período de teste gratuito?",
    answer: "Você tem acesso completo a todas as funcionalidades por 7 dias, sem precisar cadastrar cartão de crédito. Após o período, você escolhe o plano ideal para sua clínica."
  },
  {
    question: "Preciso instalar algum software?",
    answer: "Não! O Eclini funciona 100% na nuvem, acessível de qualquer navegador. Basta fazer login e começar a usar, sem instalações ou atualizações manuais."
  },
  {
    question: "Meus dados estão seguros?",
    answer: "Absolutamente. Utilizamos criptografia de ponta a ponta, servidores seguros e estamos em conformidade com a LGPD. Seus dados e os de seus pacientes são nossa prioridade."
  },
  {
    question: "Posso cancelar a qualquer momento?",
    answer: "Sim, sem multas ou burocracias. Você pode cancelar sua assinatura quando quiser diretamente pelo painel, e seus dados ficam disponíveis para exportação."
  },
  {
    question: "Como funciona o suporte técnico?",
    answer: "Oferecemos suporte via WhatsApp, e-mail e chat dentro da plataforma. Nossa equipe está disponível em horário comercial para ajudar com qualquer dúvida."
  },
  {
    question: "O sistema funciona no celular?",
    answer: "Sim! O Eclini é totalmente responsivo e funciona perfeitamente em smartphones e tablets. Você pode gerenciar sua clínica de qualquer lugar."
  }
];

export function FAQSection() {
  return (
    <section className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium mb-4">
            Tire suas dúvidas
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Perguntas Frequentes
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Encontre respostas para as dúvidas mais comuns sobre o Eclini
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-background border border-border rounded-xl px-6 data-[state=open]:shadow-lg transition-shadow"
              >
                <AccordionTrigger className="text-left text-base md:text-lg font-medium hover:no-underline py-5">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="mt-12 text-center">
            <p className="text-muted-foreground mb-4">
              Ainda tem dúvidas? Fale com nossa equipe
            </p>
            <Button asChild size="lg" variant="outline" className="gap-2">
              <a
                href="https://wa.me/5511999999999?text=Olá! Tenho uma dúvida sobre o Eclini"
                target="_blank"
                rel="noopener noreferrer"
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
