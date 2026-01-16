import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { PageNumber } from "@/components/print/PageNumber";

// Import images
import coverHero from "@/assets/presentation/cover-hero.jpg";
import clinicModule from "@/assets/presentation/clinic-module.jpg";
import unionModule from "@/assets/presentation/union-module.jpg";
import technologyStack from "@/assets/presentation/technology-stack.jpg";
import portalsAccess from "@/assets/presentation/portals-access.jpg";
import ecliniLogo from "@/assets/eclini-logo.png";

export default function PresentationPage() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Print Controls - Hidden when printing */}
      <div className="print:hidden fixed top-4 right-4 z-50 flex gap-2">
        <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
          <Printer className="w-4 h-4 mr-2" />
          Imprimir
        </Button>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 5mm;
          }
          .page-break {
            page-break-before: always;
          }
          .no-break {
            page-break-inside: avoid;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            font-size: 11px;
          }
          .print-page {
            min-height: 277mm !important;
            max-height: 277mm !important;
            overflow: hidden;
          }
          .print-cover {
            min-height: 277mm !important;
            max-height: 277mm !important;
          }
        }
      `}</style>

      {/* PAGE 1 - COVER */}
      <div className="print-cover min-h-screen print:min-h-[277mm] flex flex-col relative overflow-hidden">
        <PageNumber current={1} total={10} variant="light" />
        <img 
          src={coverHero} 
          alt="Cover" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/90 via-blue-800/80 to-emerald-700/70" />
        
        <div className="relative z-10 flex-1 flex flex-col justify-center items-center text-center text-white p-8 print:p-6">
          <div className="mb-6">
            <div className="w-28 h-28 print:w-24 print:h-24 bg-white rounded-2xl flex items-center justify-center mb-4 mx-auto shadow-2xl p-3">
              <img src={ecliniLogo} alt="eCLINI" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-5xl print:text-4xl font-bold mb-3 tracking-tight">eCLINI</h1>
            <p className="text-xl print:text-lg text-blue-100">Sistema Integrado de Gestão Clínica e Sindical</p>
          </div>

          <div className="mt-8 max-w-2xl">
            <h2 className="text-2xl print:text-xl font-semibold mb-3">Apresentação Executiva</h2>
            <p className="text-lg print:text-base text-blue-100 mb-6">
              Sindicato dos Comerciários de Ilhéus
            </p>
            
            <div className="border-t border-white/30 pt-6 mt-6">
              <p className="text-base print:text-sm text-blue-200 mb-2">Desenvolvido por:</p>
              <p className="text-2xl print:text-xl font-bold">TECMAX TECNOLOGIA</p>
              <p className="text-blue-200 mt-3 print:text-sm">Ilhéus - Bahia • Janeiro de 2026</p>
            </div>
          </div>
        </div>
      </div>

      {/* PAGE 2 - SUMÁRIO EXECUTIVO */}
      <div className="page-break print-page p-6 print:p-4 flex flex-col relative">
        <PageNumber current={2} total={10} />
        <div className="border-b-4 border-blue-600 pb-2 mb-4">
          <h2 className="text-3xl print:text-2xl font-bold text-gray-800">Sumário Executivo</h2>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="no-break bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 print:p-3">
            <h3 className="text-lg print:text-base font-bold text-blue-800 mb-2">Sobre a Tecmax Tecnologia</h3>
            <p className="text-gray-700 text-sm print:text-xs leading-relaxed">
              A <strong>Tecmax Tecnologia</strong> é uma empresa especializada no desenvolvimento de soluções 
              digitais personalizadas, com foco em sistemas de gestão para organizações que buscam 
              modernização, eficiência e segurança em seus processos administrativos.
            </p>
          </div>

          <div className="no-break bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-lg p-4 print:p-3">
            <h3 className="text-lg print:text-base font-bold text-emerald-800 mb-2">Visão Geral do Projeto</h3>
            <p className="text-gray-700 text-sm print:text-xs leading-relaxed mb-3">
              O <strong>eCLINI</strong> é uma plataforma completa e integrada que unifica a gestão clínica 
              e sindical em um único ecossistema digital, proporcionando:
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                "Centralização de informações",
                "Automação de processos",
                "Segurança de dados",
                "Acessibilidade multiplataforma",
                "Redução de custos operacionais",
                "Conformidade com LGPD"
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-4 h-4 print:w-3 print:h-3 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs print:text-[8px]">✓</span>
                  </div>
                  <span className="text-gray-700 text-sm print:text-xs">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="no-break bg-gradient-to-r from-amber-50 to-amber-100 rounded-lg p-4 print:p-3">
            <h3 className="text-lg print:text-base font-bold text-amber-800 mb-2">Objetivos da Apresentação</h3>
            <ul className="grid grid-cols-2 gap-2 text-gray-700 text-sm print:text-xs">
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">1.</span>
                Demonstrar os recursos desenvolvidos
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">2.</span>
                Apresentar a tecnologia implementada
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">3.</span>
                Destacar benefícios para gestores e usuários
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">4.</span>
                Evidenciar a complexidade do projeto
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* PAGE 3 - MÓDULO CLÍNICA */}
      <div className="page-break print-page p-6 print:p-4 flex flex-col relative">
        <PageNumber current={3} total={10} />
        <div className="border-b-4 border-cyan-600 pb-2 mb-4">
          <span className="text-cyan-600 font-semibold text-xs">MÓDULO 01</span>
          <h2 className="text-2xl print:text-xl font-bold text-gray-800">Gestão Clínica</h2>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <img 
            src={clinicModule} 
            alt="Módulo Clínica" 
            className="rounded-lg shadow-lg w-full h-32 print:h-28 object-cover"
          />
          <div className="flex flex-col justify-center">
            <p className="text-gray-700 text-sm print:text-xs leading-relaxed">
              Sistema completo para gestão de clínicas médicas com recursos avançados de 
              agendamento, prontuário eletrônico e teleconsulta integrados.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 flex-1">
          {[
            {
              title: "Agenda Inteligente",
              color: "bg-blue-500",
              items: [
                "Agendamento online 24 horas",
                "Confirmação automática via WhatsApp",
                "Controle de ausências e bloqueios",
                "Visualização por profissional, dia, semana ou mês"
              ]
            },
            {
              title: "Prontuário Eletrônico",
              color: "bg-emerald-500",
              items: [
                "Histórico completo do paciente em tela única",
                "Anamnese digital personalizável",
                "Anexos e documentos médicos",
                "Prescrições e declarações digitais"
              ]
            },
            {
              title: "Teleconsulta",
              color: "bg-purple-500",
              items: [
                "Atendimentos remotos ilimitados",
                "Integração com agenda",
                "Histórico de teleconsultas",
                "Sala virtual segura"
              ]
            },
            {
              title: "Gestão de Pacientes",
              color: "bg-rose-500",
              items: [
                "Cadastro completo com foto",
                "Dependentes vinculados",
                "Carteirinha digital com QR Code",
                "Controle de limites de consultas"
              ]
            }
          ].map((section, i) => (
            <div key={i} className="no-break bg-gray-50 rounded-lg p-3 print:p-2 border border-gray-200">
              <div className={`${section.color} text-white px-2 py-1 rounded inline-block mb-2`}>
                <h4 className="font-bold text-xs">{section.title}</h4>
              </div>
              <ul className="space-y-0.5 text-xs print:text-[10px]">
                {section.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-1 text-gray-700">
                    <span className="text-gray-400 mt-0.5">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* PAGE 4 - MÓDULO SINDICAL */}
      <div className="page-break print-page p-6 print:p-4 flex flex-col relative">
        <PageNumber current={4} total={10} />
        <div className="border-b-4 border-amber-600 pb-2 mb-4">
          <span className="text-amber-600 font-semibold text-xs">MÓDULO 02</span>
          <h2 className="text-2xl print:text-xl font-bold text-gray-800">Gestão Sindical</h2>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col justify-center">
            <p className="text-gray-700 text-sm print:text-xs leading-relaxed">
              Módulo completo para gestão de entidades sindicais com controle de empresas, 
              contribuições, negociações de débitos e homologação de rescisões.
            </p>
          </div>
          <img 
            src={unionModule} 
            alt="Módulo Sindical" 
            className="rounded-lg shadow-lg w-full h-32 print:h-28 object-cover"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 flex-1">
          {[
            {
              title: "Gestão de Empresas",
              color: "bg-amber-500",
              items: [
                "Cadastro completo com CNPJ",
                "Categorização (Comércio Varejista/Atacadista)",
                "Vinculação com escritórios de contabilidade",
                "Histórico de contribuições"
              ]
            },
            {
              title: "Contribuições Sindicais",
              color: "bg-emerald-500",
              items: [
                "Lançamento individual e em lote",
                "Integração com Lytex (boletos)",
                "Controle de inadimplência",
                "Relatórios gerenciais (PDF profissional)"
              ]
            },
            {
              title: "Negociação de Débitos",
              color: "bg-blue-500",
              items: [
                "Parcelamento flexível",
                "Cálculo automático de juros e multas",
                "Acompanhamento de parcelas",
                "Geração de acordos"
              ]
            },
            {
              title: "Homologação de Rescisões",
              color: "bg-purple-500",
              items: [
                "Agenda dedicada por profissional",
                "Agendamento público via link",
                "Protocolo automático",
                "Notificações WhatsApp/E-mail"
              ]
            }
          ].map((section, i) => (
            <div key={i} className="no-break bg-gray-50 rounded-lg p-3 print:p-2 border border-gray-200">
              <div className={`${section.color} text-white px-2 py-1 rounded inline-block mb-2`}>
                <h4 className="font-bold text-xs">{section.title}</h4>
              </div>
              <ul className="space-y-0.5 text-xs print:text-[10px]">
                {section.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-1 text-gray-700">
                    <span className="text-gray-400">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* PAGE 5 - PORTAIS */}
      <div className="page-break print-page p-6 print:p-4 flex flex-col relative">
        <PageNumber current={5} total={10} />
        <div className="border-b-4 border-green-600 pb-2 mb-4">
          <span className="text-green-600 font-semibold text-xs">ECOSSISTEMA</span>
          <h2 className="text-2xl print:text-xl font-bold text-gray-800">Portais de Acesso</h2>
        </div>

        <div className="mb-4">
          <img 
            src={portalsAccess} 
            alt="Portais de Acesso" 
            className="rounded-lg shadow-lg w-full h-32 print:h-28 object-cover"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 flex-1">
          {[
            {
              title: "Portal do Empregador",
              subtitle: "Empresas",
              color: "bg-blue-600",
              items: [
                "Acesso às contribuições pendentes",
                "Visualização e download de boletos",
                "Download de CCTs por categoria",
                "Agendamento de homologações"
              ]
            },
            {
              title: "Portal do Contador",
              subtitle: "Escritórios",
              color: "bg-purple-600",
              items: [
                "Gestão de múltiplas empresas",
                "Acesso unificado às contribuições",
                "Agendamento de homologações",
                "Relatórios consolidados"
              ]
            },
            {
              title: "Portal do Sócio",
              subtitle: "Pessoa Física",
              color: "bg-emerald-600",
              items: [
                "Consulta de contribuições individuais",
                "Carteirinha digital",
                "Acesso às CCTs",
                "Histórico de pagamentos"
              ]
            },
            {
              title: "Aplicativo Mobile",
              subtitle: "PWA",
              color: "bg-rose-600",
              items: [
                "Acesso via smartphone",
                "Agendamentos online",
                "Convênios e parcerias",
                "Notificações push"
              ]
            }
          ].map((portal, i) => (
            <div key={i} className="no-break bg-white rounded-lg p-3 print:p-2 border-2 border-gray-200 shadow-sm">
              <div className={`${portal.color} text-white px-2 py-1 rounded mb-2`}>
                <h4 className="font-bold text-xs">{portal.title}</h4>
                <p className="text-[10px] opacity-80">{portal.subtitle}</p>
              </div>
              <ul className="space-y-0.5 text-xs print:text-[10px]">
                {portal.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-1 text-gray-700">
                    <span className="text-green-500">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* PAGE 6 - TECNOLOGIA */}
      <div className="page-break print-page p-6 print:p-4 flex flex-col relative">
        <PageNumber current={6} total={10} />
        <div className="border-b-4 border-purple-600 pb-2 mb-4">
          <span className="text-purple-600 font-semibold text-xs">INFRAESTRUTURA</span>
          <h2 className="text-2xl print:text-xl font-bold text-gray-800">Tecnologia Implementada</h2>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <img 
            src={technologyStack} 
            alt="Stack Tecnológico" 
            className="rounded-lg shadow-lg w-full h-32 print:h-28 object-cover"
          />
          <div className="flex flex-col justify-center">
            <p className="text-gray-700 text-sm print:text-xs leading-relaxed">
              O eCLINI foi desenvolvido utilizando as mais modernas tecnologias do mercado,
              garantindo performance, segurança e escalabilidade.
            </p>
          </div>
        </div>

        <div className="no-break bg-gray-900 rounded-lg p-4 text-white mb-4">
          <h3 className="text-lg print:text-base font-bold mb-3 text-center">Stack Tecnológico de Ponta</h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              { layer: "Frontend", tech: "React + TypeScript", benefit: "Interface moderna" },
              { layer: "Estilização", tech: "Tailwind CSS", benefit: "Design adaptável" },
              { layer: "Banco de Dados", tech: "PostgreSQL", benefit: "Escalabilidade" },
              { layer: "Autenticação", tech: "OAuth + JWT", benefit: "Login seguro" },
              { layer: "Backend", tech: "Edge Functions", benefit: "Tempo real" },
              { layer: "Integrações", tech: "APIs REST", benefit: "WhatsApp, Lytex" },
            ].map((item, i) => (
              <div key={i} className="bg-gray-800 rounded p-2 text-center">
                <p className="text-purple-400 text-[10px] font-semibold">{item.layer}</p>
                <p className="text-white font-bold text-xs">{item.tech}</p>
                <p className="text-gray-400 text-[10px]">{item.benefit}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="no-break bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-4 text-white">
          <h3 className="text-lg print:text-base font-bold mb-3 text-center">Segurança de Dados</h3>
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: "🔒", title: "RLS", desc: "Acesso por usuário" },
              { icon: "🔐", title: "Criptografia", desc: "Dados protegidos" },
              { icon: "📋", title: "Auditoria", desc: "Logs completos" },
              { icon: "🛡️", title: "LGPD", desc: "Conformidade" },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="text-xl mb-1">{item.icon}</div>
                <p className="font-bold text-xs">{item.title}</p>
                <p className="text-[10px] text-blue-100">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PAGE 7 - COMPLEXIDADE */}
      <div className="page-break print-page p-6 print:p-4 flex flex-col relative">
        <PageNumber current={7} total={10} />
        <div className="border-b-4 border-rose-600 pb-2 mb-4">
          <span className="text-rose-600 font-semibold text-xs">DIMENSÃO TÉCNICA</span>
          <h2 className="text-2xl print:text-xl font-bold text-gray-800">Complexidade do Projeto</h2>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="no-break bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-4 text-white">
            <h3 className="text-lg print:text-base font-bold mb-3">Volume de Código</h3>
            <div className="space-y-2">
              {[
                { label: "Componentes React", value: "+200" },
                { label: "Páginas de Interface", value: "+50" },
                { label: "Edge Functions", value: "+30" },
                { label: "Tabelas de Banco", value: "+80" },
                { label: "Políticas RLS", value: "+150" },
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center border-b border-slate-700 pb-1">
                  <span className="text-slate-300 text-xs">{item.label}</span>
                  <span className="text-xl font-bold text-emerald-400">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="no-break bg-gradient-to-br from-blue-800 to-indigo-900 rounded-lg p-4 text-white">
            <h3 className="text-lg print:text-base font-bold mb-3">Integrações Externas</h3>
            <div className="space-y-2">
              {[
                { name: "Lytex", desc: "Boletos bancários" },
                { name: "WhatsApp Business", desc: "Notificações" },
                { name: "Google OAuth", desc: "Autenticação" },
                { name: "Resend", desc: "E-mails" },
                { name: "Receita Federal", desc: "CNPJ" },
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center border-b border-blue-700 pb-1">
                  <span className="font-semibold text-blue-200 text-xs">{item.name}</span>
                  <span className="text-blue-300 text-xs">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="no-break bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg p-4 text-white">
          <h3 className="text-lg print:text-base font-bold mb-3 text-center">Funcionalidades Avançadas</h3>
          <div className="grid grid-cols-6 gap-2">
            {[
              { icon: "⚡", title: "Realtime" },
              { icon: "📦", title: "Lote" },
              { icon: "📄", title: "PDFs" },
              { icon: "📱", title: "QR Code" },
              { icon: "🔔", title: "Push" },
              { icon: "🌐", title: "PWA" },
            ].map((item, i) => (
              <div key={i} className="bg-white/20 rounded p-2 text-center backdrop-blur-sm">
                <div className="text-xl">{item.icon}</div>
                <p className="font-bold text-xs">{item.title}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PAGE 8 - BENEFÍCIOS */}
      <div className="page-break print-page p-6 print:p-4 flex flex-col relative">
        <PageNumber current={8} total={10} />
        <div className="border-b-4 border-emerald-600 pb-2 mb-4">
          <span className="text-emerald-600 font-semibold text-xs">VALOR ENTREGUE</span>
          <h2 className="text-2xl print:text-xl font-bold text-gray-800">Benefícios</h2>
        </div>

        <div className="grid grid-cols-2 gap-4 flex-1">
          <div className="no-break">
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg p-4 text-white h-full">
              <h3 className="text-lg print:text-base font-bold mb-3 flex items-center gap-2">
                <span className="text-xl">👔</span>
                Para os Gestores
              </h3>
              <div className="space-y-1.5">
                {[
                  { benefit: "Centralização", impact: "Informações em um único lugar" },
                  { benefit: "Automação", impact: "Menos trabalho manual" },
                  { benefit: "Controle Financeiro", impact: "Visão de receitas/despesas" },
                  { benefit: "Relatórios", impact: "Decisões baseadas em dados" },
                  { benefit: "Rastreabilidade", impact: "Auditoria completa" },
                  { benefit: "Redução de Glosas", impact: "TISS automatizado" },
                ].map((item, i) => (
                  <div key={i} className="bg-white/10 rounded p-2">
                    <p className="font-bold text-blue-200 text-xs">{item.benefit}</p>
                    <p className="text-[10px] text-blue-100">{item.impact}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="no-break">
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-lg p-4 text-white h-full">
              <h3 className="text-lg print:text-base font-bold mb-3 flex items-center gap-2">
                <span className="text-xl">👥</span>
                Para os Usuários
              </h3>
              <div className="space-y-1.5">
                {[
                  { benefit: "Autoatendimento", impact: "Acesso 24h sem atendente" },
                  { benefit: "Transparência", impact: "Pendências claras" },
                  { benefit: "Praticidade", impact: "Boletos digitais" },
                  { benefit: "Comunicação", impact: "Notificações automáticas" },
                  { benefit: "Mobilidade", impact: "Acesso via app" },
                  { benefit: "Segurança", impact: "Dados protegidos" },
                ].map((item, i) => (
                  <div key={i} className="bg-white/10 rounded p-2">
                    <p className="font-bold text-emerald-200 text-xs">{item.benefit}</p>
                    <p className="text-[10px] text-emerald-100">{item.impact}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PAGE 9 - RECURSOS DISPONÍVEIS */}
      <div className="page-break print-page p-6 print:p-4 flex flex-col relative">
        <PageNumber current={9} total={10} />
        <div className="border-b-4 border-indigo-600 pb-2 mb-4">
          <span className="text-indigo-600 font-semibold text-xs">FUNCIONALIDADES</span>
          <h2 className="text-2xl print:text-xl font-bold text-gray-800">Recursos Disponíveis</h2>
        </div>

        <div className="grid grid-cols-3 gap-2 flex-1">
          {[
            { name: "Gestão de Pacientes/Sócios", color: "bg-blue-500" },
            { name: "Agenda Online", color: "bg-cyan-500" },
            { name: "Prontuário Eletrônico", color: "bg-emerald-500" },
            { name: "Carteirinha Digital", color: "bg-green-500" },
            { name: "Gestão de Empresas", color: "bg-amber-500" },
            { name: "Contribuições Sindicais", color: "bg-orange-500" },
            { name: "Negociação de Débitos", color: "bg-red-500" },
            { name: "Homologação de Rescisões", color: "bg-rose-500" },
            { name: "Escritórios Contábeis", color: "bg-purple-500" },
            { name: "Portais de Acesso", color: "bg-violet-500" },
            { name: "Aplicativo Mobile", color: "bg-indigo-500" },
            { name: "Gestão Financeira", color: "bg-blue-600" },
            { name: "Conciliação Bancária", color: "bg-teal-500" },
            { name: "Relatórios Gerenciais", color: "bg-slate-600" },
            { name: "CCTs", color: "bg-gray-600" },
            { name: "Convênios", color: "bg-pink-500" },
            { name: "WhatsApp/E-mail", color: "bg-green-600" },
            { name: "Teleconsulta", color: "bg-sky-500" },
          ].map((item, i) => (
            <div key={i} className={`${item.color} text-white rounded p-2 flex items-center gap-1.5`}>
              <div className="w-4 h-4 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-[10px]">✓</span>
              </div>
              <span className="font-medium text-xs">{item.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* PAGE 10 - CONTATO */}
      <div className="page-break print-page print:min-h-[277mm] flex flex-col relative overflow-hidden">
        <PageNumber current={10} total={10} variant="light" />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900" />
        
        <div className="relative z-10 flex-1 flex flex-col justify-center items-center text-center text-white p-6">
          <div className="mb-6">
            <div className="w-20 h-20 bg-white rounded-xl flex items-center justify-center mb-4 mx-auto shadow-2xl">
              <span className="text-3xl font-bold text-blue-600">TM</span>
            </div>
            <h2 className="text-3xl print:text-2xl font-bold mb-2">TECMAX TECNOLOGIA</h2>
            <p className="text-lg print:text-base text-blue-200">Desenvolvimento de Soluções Digitais</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 max-w-sm">
            <h3 className="text-xl print:text-lg font-bold mb-4">Entre em Contato</h3>
            
            <div className="space-y-3 text-left">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-lg">📧</span>
                </div>
                <div>
                  <p className="text-blue-300 text-[10px]">E-mail</p>
                  <p className="text-base font-semibold">contato@tecmax.com.br</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                  <span className="text-lg">📞</span>
                </div>
                <div>
                  <p className="text-blue-300 text-[10px]">Telefone</p>
                  <p className="text-base font-semibold">(71) 3144-9898</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                  <span className="text-lg">🌐</span>
                </div>
                <div>
                  <p className="text-blue-300 text-[10px]">Sistema</p>
                  <p className="text-base font-semibold">app.eclini.com.br</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 text-blue-300">
            <p className="text-base italic mb-1">"Tecnologia a serviço da gestão eficiente"</p>
            <p className="text-[10px]">© 2026 Tecmax Tecnologia - Todos os direitos reservados</p>
          </div>
        </div>
      </div>
    </div>
  );
}
