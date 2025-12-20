import { forwardRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ShieldCheck, PenTool } from "lucide-react";
import type { Question, Answer } from "./AnamneseResponseForm";

interface AnamnesisPrintProps {
  clinic: {
    name: string;
    address?: string | null;
    phone?: string | null;
    logo_url?: string | null;
    cnpj?: string | null;
  };
  patient: {
    name: string;
    phone: string;
  };
  template: {
    title: string;
  };
  questions: Question[];
  answers: Answer[];
  response: {
    created_at: string;
    filled_by_patient: boolean;
    signature_data: string | null;
    signed_at: string | null;
    responsibility_accepted: boolean;
  };
  signatureUrl: string | null;
}

const getAnswerDisplay = (question: Question, answer: Answer | undefined): string => {
  if (question.question_type === "boolean") {
    if (!answer || answer.answer_text === null || answer.answer_text === undefined || answer.answer_text === "false") {
      return "Não";
    }
    if (answer.answer_text === "true") {
      return "Sim";
    }
    return answer.answer_text;
  }
  
  if (!answer) return "Não respondido";
  
  if (question.question_type === "text" || question.question_type === "textarea" || question.question_type === "date" || question.question_type === "number") {
    return answer.answer_text || "Não respondido";
  }
  
  if (question.question_type === "radio" || question.question_type === "select" || question.question_type === "checkbox") {
    if (!answer.answer_option_ids || answer.answer_option_ids.length === 0) return "Não respondido";
    
    const selectedOptions = question.options
      ?.filter(opt => answer.answer_option_ids?.includes(opt.id))
      .map(opt => opt.option_text);
    
    return selectedOptions?.join(", ") || "Não respondido";
  }
  
  return answer.answer_text || "Não respondido";
};

export const AnamnesisPrint = forwardRef<HTMLDivElement, AnamnesisPrintProps>(
  ({ clinic, patient, template, questions, answers, response, signatureUrl }, ref) => {
    return (
      <div ref={ref} className="p-8 bg-white text-black min-h-[297mm] w-[210mm] mx-auto">
        {/* Header */}
        <div className="text-center border-b-2 border-gray-300 pb-4 mb-6">
          {clinic.logo_url && (
            <img
              src={clinic.logo_url}
              alt="Logo da clínica"
              className="h-16 mx-auto mb-2 object-contain"
            />
          )}
          <h1 className="text-xl font-bold">{clinic.name}</h1>
          {clinic.address && (
            <p className="text-sm text-gray-600">{clinic.address}</p>
          )}
          <div className="text-sm text-gray-600 flex justify-center gap-4">
            {clinic.phone && <span>Tel: {clinic.phone}</span>}
            {clinic.cnpj && <span>CNPJ: {clinic.cnpj}</span>}
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-6">
          <h2 className="text-lg font-bold uppercase">Ficha de Anamnese</h2>
          <h3 className="text-base font-medium text-gray-700">{template.title}</h3>
        </div>

        {/* Patient Info */}
        <div className="mb-6 p-4 bg-gray-50 rounded border">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-semibold">Paciente:</span> {patient.name}
            </div>
            <div>
              <span className="font-semibold">Telefone:</span> {patient.phone}
            </div>
            <div className="col-span-2">
              <span className="font-semibold">Data do Preenchimento:</span>{" "}
              {format(new Date(response.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </div>
          </div>
        </div>

        {/* Questions and Answers */}
        <div className="space-y-4 mb-8">
          <h4 className="font-bold text-base border-b pb-2">Perguntas e Respostas</h4>
          {questions.map((question, index) => {
            const answer = answers.find(a => a.question_id === question.id);
            const answerDisplay = getAnswerDisplay(question, answer);
            
            return (
              <div key={question.id} className="border-l-4 border-gray-300 pl-4 py-2">
                <p className="font-medium text-sm">
                  {index + 1}. {question.question_text}
                  {question.is_required && <span className="text-red-500 ml-1">*</span>}
                </p>
                <p className="text-sm text-gray-700 mt-1">{answerDisplay}</p>
              </div>
            );
          })}
        </div>

        {/* Signature Section */}
        {response.filled_by_patient && response.signature_data && (
          <div className="border-t-2 border-gray-300 pt-6 mt-8">
            <h4 className="font-bold text-base mb-4 flex items-center gap-2">
              <PenTool className="h-4 w-4" />
              Assinatura Digital
            </h4>
            
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-green-700">
                <ShieldCheck className="h-4 w-4" />
                <span className="font-medium">Preenchido pelo paciente</span>
              </div>
              
              {response.responsibility_accepted && (
                <p className="text-gray-600 italic">
                  ✓ O paciente aceitou o termo de responsabilidade sobre as informações fornecidas.
                </p>
              )}
              
              {response.signed_at && (
                <p className="text-gray-600">
                  Assinado em: {format(new Date(response.signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
              
              {signatureUrl && (
                <div className="border rounded-lg p-4 bg-white mt-4 w-64">
                  <img
                    src={signatureUrl}
                    alt="Assinatura do paciente"
                    className="max-w-full h-auto max-h-24 mx-auto"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="fixed bottom-8 left-8 right-8 text-center text-xs text-gray-500 border-t pt-4">
          <p>Documento gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
          <p>{clinic.name}</p>
        </div>
      </div>
    );
  }
);

AnamnesisPrint.displayName = "AnamnesisPrint";
