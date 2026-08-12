import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, MessageSquare, AlertTriangle, CheckCircle2, Info, BookOpen, Smartphone, ShieldCheck, FileText, UserPlus, HelpCircle, DollarSign, Send } from "lucide-react";

const TrainingMaterial = () => {
  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-slate-900 font-sans print:p-0">
      {/* Header */}
      <header className="text-center mb-10 border-b-4 border-primary pb-6">
        <div className="flex justify-center mb-4">
          <img src="/apple-touch-icon-sindicato.png" alt="Sindicato Logo" className="h-16 w-16" />
        </div>
        <h1 className="text-3xl font-bold uppercase tracking-tight text-primary mb-2">Manual de Atendimento WhatsApp (API Meta)</h1>
        <p className="text-xl text-slate-600">Guia Prático para Atendimento Humano - Sindicato dos Comerciários</p>
      </header>

      {/* Key Concept: 24h Window & Costs */}
      <section className="mb-10 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-amber-50 border-l-8 border-amber-500 p-6 rounded-r-lg shadow-sm">
          <div className="flex items-center mb-4">
            <Clock className="w-10 h-10 text-amber-600 mr-4" />
            <h2 className="text-2xl font-bold text-amber-900">A Janela de 24 Horas</h2>
          </div>
          <p className="text-lg mb-4 leading-relaxed">
            Sempre que um associado envia uma mensagem, abre-se uma <strong>"Janela de Atendimento"</strong> de 24 horas.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="bg-white p-3 rounded-lg shadow-inner border border-amber-200">
              <h3 className="font-bold text-green-700 text-sm flex items-center mb-1">
                <CheckCircle2 className="mr-2 w-4 h-4" /> Janela Aberta
              </h3>
              <p className="text-xs">Conversa livre e envio de arquivos sem travas.</p>
            </div>
            <div className="bg-white p-3 rounded-lg shadow-inner border border-amber-200">
              <h3 className="font-bold text-red-700 text-sm flex items-center mb-1">
                <AlertTriangle className="mr-2 w-4 h-4" /> Janela Fechada
              </h3>
              <p className="text-xs">O sistema trava. Só modelos aprovados funcionam.</p>
            </div>
          </div>
        </div>

        <div className="bg-emerald-50 border-2 border-emerald-200 p-6 rounded-lg shadow-sm">
          <div className="flex items-center mb-4">
            <DollarSign className="w-8 h-8 text-emerald-600 mr-2" />
            <h2 className="text-xl font-bold text-emerald-900">Custos da Meta</h2>
          </div>
          <p className="text-sm text-emerald-800 mb-2">
            A Meta cobra por <strong>Sessão de 24h</strong>, não por mensagem individual.
          </p>
          <ul className="text-xs space-y-2 text-emerald-900 list-disc ml-4">
            <li><strong>Se o associado chamar:</strong> Inicia uma conversa de "Serviço".</li>
            <li>Dentro das 24h, você pode enviar 100 mensagens e o custo será o mesmo de 1 mensagem.</li>
            <li>Temos uma cota gratuita de 1.000 conversas por mês.</li>
          </ul>
        </div>
      </section>

      {/* New Section: Templates and After 24h */}
      <section className="mb-10">
        <div className="bg-blue-50 border-2 border-blue-200 p-6 rounded-lg shadow-sm">
          <div className="flex items-center mb-4">
            <FileText className="w-8 h-8 text-blue-700 mr-3" />
            <h2 className="text-2xl font-bold text-blue-900">Modelos de Mensagem (Templates)</h2>
          </div>
          <p className="mb-4 text-slate-700">
            Quando a janela de 24h fecha, o WhatsApp "trava". Para falar com o associado de novo, você deve usar um <strong>Modelo Aprovado</strong>. Isso serve para <strong>"reativar"</strong> a conversa.
          </p>
          
          <div className="bg-white p-4 rounded-lg border border-blue-100 mb-6">
            <h3 className="font-bold text-blue-800 flex items-center mb-3 text-sm">
              <Send className="w-4 h-4 mr-2" /> Exemplo de Modelo para Reativar:
            </h3>
            <div className="bg-slate-50 p-3 rounded border-l-4 border-blue-500 italic text-sm text-slate-600">
              "Olá, aqui é do Sindicato dos Comerciários. Notamos que sua solicitação ainda não foi concluída. Você ainda precisa de ajuda com este assunto?"
            </div>
            <p className="mt-3 text-xs text-slate-500">
              <strong>Como funciona:</strong> Após você enviar esse modelo, a Meta cobra uma pequena taxa e a janela de 24h <strong>só reabre</strong> quando o associado responder (mesmo que seja um "Sim").
            </p>
          </div>

          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <li className="bg-blue-100/50 p-3 rounded flex items-start">
              <CheckCircle2 className="w-4 h-4 text-blue-600 mr-2 mt-1 shrink-0" />
              <span className="text-xs font-medium">Os modelos são fixos: você não consegue mudar o texto na hora de enviar.</span>
            </li>
            <li className="bg-blue-100/50 p-3 rounded flex items-start">
              <CheckCircle2 className="w-4 h-4 text-blue-600 mr-2 mt-1 shrink-0" />
              <span className="text-xs font-medium">Sempre escolha o modelo que mais se encaixa no assunto pendente.</span>
            </li>
          </ul>
        </div>
      </section>

      {/* Human Interaction vs Automation */}
      <section className="mb-10 grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="border-2 border-blue-100 shadow-md">
          <CardHeader className="bg-blue-50 border-b">
            <CardTitle className="flex items-center text-blue-800">
              <MessageSquare className="mr-2" /> Atendimento Humano
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ul className="space-y-3">
              <li className="flex items-start">
                <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mt-1 mr-2 shrink-0">1</span>
                <span>Seja cordial e identifique-se.</span>
              </li>
              <li className="flex items-start">
                <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mt-1 mr-2 shrink-0">2</span>
                <span>Use linguagem clara, sem gírias excessivas.</span>
              </li>
              <li className="flex items-start">
                <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mt-1 mr-2 shrink-0">3</span>
                <span>Se precisar de tempo para pesquisar algo, avise o associado.</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-100 shadow-md">
          <CardHeader className="bg-purple-50 border-b">
            <CardTitle className="flex items-center text-purple-800">
              <Smartphone className="mr-2" /> Agendamentos (App SECMI)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 text-slate-700">
            <div className="bg-red-50 p-3 rounded border border-red-100 mb-4 text-red-800 text-sm font-bold flex items-center">
              <AlertTriangle className="mr-2 shrink-0" /> ATENÇÃO: AGENDAMENTO PELO WHATSAPP ESTÁ DESATIVADO.
            </div>
            <p className="mb-4 text-sm">Se o associado pedir agendamento de consultas ou serviços:</p>
            <ol className="list-decimal ml-5 space-y-2 text-sm font-medium">
              <li>Informe que agora é exclusivo pelo <strong>Aplicativo SECMI</strong>.</li>
              <li>Oriente a baixar na Play Store (Android) ou Apple Store (iOS).</li>
              <li>Não tente agendar manualmente pelo chat.</li>
            </ol>
          </CardContent>
        </Card>
      </section>

      {/* Dashboard Support */}
      <section className="mb-10">
        <div className="border-2 border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-slate-800 text-white p-4 flex items-center">
            <UserPlus className="mr-3" />
            <h2 className="text-xl font-bold">Assumindo o Atendimento no Dashboard</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-slate-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 font-bold text-slate-800">1</div>
              <h3 className="font-bold text-sm mb-1">Aba "Aguardando"</h3>
              <p className="text-xs text-slate-500">Veja quem solicitou ajuda humana e ainda não foi atendido.</p>
            </div>
            <div className="text-center">
              <div className="bg-slate-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 font-bold text-slate-800">2</div>
              <h3 className="font-bold text-sm mb-1">Botão "Assumir"</h3>
              <p className="text-xs text-slate-500">Ao clicar, o robô para de responder e você assume o controle total.</p>
            </div>
            <div className="text-center">
              <div className="bg-slate-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 font-bold text-slate-800">3</div>
              <h3 className="font-bold text-sm mb-1">Finalizar Chat</h3>
              <p className="text-xs text-slate-500">Sempre clique em "Finalizar" ao terminar para liberar o associado para o robô novamente.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Financial Support and FAQ */}
      <section className="mb-10 grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="bg-green-50 border-green-200 border-2">
          <CardHeader>
            <CardTitle className="text-green-800 flex items-center">
              <FileText className="mr-2" /> Boletos e Financeiro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-bold text-green-900 mb-2 underline">Procedimento Interno:</p>
              <ul className="text-xs space-y-2 list-disc ml-4 text-green-900">
                <li>Confirme o CPF dele no sistema antes de enviar.</li>
                <li>Envie o boleto (PDF) ou a linha digitável diretamente no chat.</li>
                <li><strong>Importante:</strong> Se ele já iniciou a conversa, não há custo extra em atendê-lo por aqui dentro das 24h.</li>
              </ul>
            </div>
            <div className="bg-white p-3 rounded border border-green-100 italic">
              <p className="text-xs text-green-800">
                <strong>Dica de Economia:</strong> Incentive o uso do <strong>Portal do Sócio</strong>. Se o associado aprender a tirar o boleto sozinho no site/app sem mandar mensagem no WhatsApp, o Sindicato economiza créditos de conversas da Meta!
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-800 flex items-center">
              <HelpCircle className="mr-2" /> Em caso de Dúvida Técnica
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm mb-3">Se o sistema WhatsApp parecer travado ou não enviar mensagens:</p>
            <ul className="text-xs space-y-2 list-disc ml-4 text-blue-900">
              <li>Verifique se a mensagem do associado tem mais de 24 horas.</li>
              <li>Tente enviar um "Modelo de Mensagem" de Utilidade.</li>
              <li>Se persistir, acione o suporte técnico da Prosinge.</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Best Practices Visual Guide */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-6 flex items-center">
          <Info className="mr-2 text-primary" /> Boas Práticas e Segurança
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 border rounded-lg text-center bg-slate-50">
            <ShieldCheck className="w-12 h-12 mx-auto mb-2 text-green-600" />
            <h3 className="font-bold mb-1">Dados Sensíveis</h3>
            <p className="text-xs">Evite pedir senhas ou dados bancários via chat.</p>
          </div>
          <div className="p-4 border rounded-lg text-center bg-slate-50">
            <BookOpen className="w-12 h-12 mx-auto mb-2 text-blue-600" />
            <h3 className="font-bold mb-1">Respostas Rápidas</h3>
            <p className="text-xs">Use os modelos aprovados para ganhar tempo.</p>
          </div>
          <div className="p-4 border rounded-lg text-center bg-slate-50">
            <Smartphone className="w-12 h-12 mx-auto mb-2 text-purple-600" />
            <h3 className="font-bold mb-1">App SECMI</h3>
            <p className="text-xs">O foco do WhatsApp é tirar dúvidas, não agendar.</p>
          </div>
        </div>
      </section>

      {/* Footer / Print Note */}
      <footer className="mt-12 pt-6 border-t border-slate-200 flex justify-between items-center text-slate-400 text-xs">
        <p>© 2026 Sindicato dos Comerciários - Tecnologia SECMI</p>
        <p className="font-bold">Dica de Impressão: Utilize papel A4, modo Colorido.</p>
      </footer>

      {/* Styling for Print */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { padding: 0; margin: 0; background: white; }
          .max-w-4xl { max-width: 100%; border: none; box-shadow: none !important; }
          .shadow-md, .shadow-sm { box-shadow: none !important; border: 1px solid #e2e8f0 !important; }
          button, nav { display: none !important; }
        }
      `}} />
    </div>
  );
};

export default TrainingMaterial;
