import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqItems = [
  {
    question: "Como faço para atualizar meus dados cadastrais?",
    answer: "Acesse a aba Perfil no menu inferior e clique em 'Editar perfil'. Você poderá atualizar suas informações pessoais como endereço, telefone e e-mail."
  },
  {
    question: "Como incluo um dependente?",
    answer: "Para incluir um dependente, acesse o menu lateral e clique em 'Dependentes'. Lá você poderá solicitar a inclusão de novos dependentes que serão analisados pelo sindicato."
  },
  {
    question: "Como visualizo minha carteirinha digital?",
    answer: "Acesse o menu lateral e clique em 'Carteirinha'. Sua carteirinha digital com QR Code estará disponível para apresentação em estabelecimentos conveniados."
  },
  {
    question: "Como altero minha senha de acesso?",
    answer: "No menu lateral, clique em 'Alterar senha'. Você precisará informar sua senha atual e depois a nova senha desejada."
  },
  {
    question: "Como agendar uma consulta?",
    answer: "Na tela inicial, clique em 'Nossos Serviços' e depois em 'Agendamentos'. Você poderá visualizar os horários disponíveis e realizar seu agendamento."
  },
  {
    question: "Como cancelar um agendamento?",
    answer: "Acesse 'Consultas' no menu inferior, localize o agendamento desejado e clique em 'Cancelar'. Lembre-se de cancelar com antecedência para liberar o horário para outros associados."
  },
  {
    question: "Onde consulto meus boletos?",
    answer: "Na tela inicial, acesse 'Nossos Serviços' e clique em 'Boletos'. Você poderá visualizar, copiar o código de barras ou acessar os boletos em aberto."
  },
  {
    question: "Como entro em contato com o sindicato?",
    answer: "Na seção 'Precisa de ajuda?' da tela inicial, você encontra os números de telefone, e-mail e o endereço do sindicato. Também pode clicar no botão do WhatsApp para atendimento rápido."
  },
];

export default function MobileFAQPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-emerald-600 text-white px-4 py-4 flex items-center gap-4 sticky top-0 z-50">
        <button onClick={() => navigate(-1)} className="p-1">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-semibold">Dúvidas Frequentes</h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <p className="text-muted-foreground mb-6">
          Encontre respostas para as perguntas mais comuns sobre o aplicativo e os serviços do sindicato.
        </p>

        <Accordion type="single" collapsible className="space-y-2">
          {faqItems.map((item, index) => (
            <AccordionItem 
              key={index} 
              value={`item-${index}`}
              className="bg-white rounded-lg border border-gray-200 px-4"
            >
              <AccordionTrigger className="text-left font-medium text-foreground hover:no-underline py-4">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-4">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
