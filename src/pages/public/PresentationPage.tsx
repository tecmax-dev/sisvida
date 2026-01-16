import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";

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
            size: A4;
            margin: 8mm;
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
          }
          .print-page {
            min-height: auto !important;
            height: auto !important;
          }
        }
      `}</style>

      {/* PAGE 1 - COVER */}
      <div className="print-page min-h-screen print:min-h-0 print:h-auto flex flex-col relative overflow-hidden py-16 print:py-8">
        <img 
          src={coverHero} 
          alt="Cover" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/90 via-blue-800/80 to-emerald-700/70" />
        
        <div className="relative z-10 flex-1 flex flex-col justify-center items-center text-center text-white p-12">
          <div className="mb-8">
            <div className="w-32 h-32 bg-white rounded-2xl flex items-center justify-center mb-6 mx-auto shadow-2xl p-4">
              <img src={ecliniLogo} alt="eCLINI" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-6xl font-bold mb-4 tracking-tight">eCLINI</h1>
            <p className="text-2xl text-blue-100">Sistema Integrado de Gestão Clínica e Sindical</p>
          </div>

          <div className="mt-12 max-w-2xl">
            <h2 className="text-3xl font-semibold mb-4">Apresentação Executiva</h2>
            <p className="text-xl text-blue-100 mb-8">
              Sindicato dos Comerciários de Ilhéus
            </p>
            
            <div className="border-t border-white/30 pt-8 mt-8">
              <p className="text-lg text-blue-200 mb-2">Desenvolvido por:</p>
              <p className="text-3xl font-bold">TECMAX TECNOLOGIA</p>
              <p className="text-blue-200 mt-4">Ilhéus - Bahia • Janeiro de 2026</p>
            </div>
          </div>
        </div>
      </div>

      {/* PAGE 2 - SUMÁRIO EXECUTIVO */}
      <div className="page-break print-page p-8 print:p-4 flex flex-col">
        <div className="border-b-4 border-blue-600 pb-4 mb-8">
          <h2 className="text-4xl font-bold text-gray-800">Sumário Executivo</h2>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="no-break bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-6">
            <h3 className="text-xl font-bold text-blue-800 mb-3">Sobre a Tecmax Tecnologia</h3>
            <p className="text-gray-700 text-base leading-relaxed">
              A <strong>Tecmax Tecnologia</strong> é uma empresa especializada no desenvolvimento de soluções 
              digitais personalizadas, com foco em sistemas de gestão para organizações que buscam 
              modernização, eficiência e segurança em seus processos administrativos.
            </p>
          </div>

          <div className="no-break bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-xl p-6">
            <h3 className="text-xl font-bold text-emerald-800 mb-3">Visão Geral do Projeto</h3>
            <p className="text-gray-700 text-base leading-relaxed mb-4">
              O <strong>eCLINI</strong> é uma plataforma completa e integrada que unifica a gestão clínica 
              e sindical em um único ecossistema digital, proporcionando:
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                "Centralização de informações",
                "Automação de processos",
                "Segurança de dados",
                "Acessibilidade multiplataforma",
                "Redução de custos operacionais",
                "Conformidade com LGPD"
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                    <span className="text-white text-sm">✓</span>
                  </div>
                  <span className="text-gray-700">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="no-break bg-gradient-to-r from-amber-50 to-amber-100 rounded-xl p-6">
            <h3 className="text-xl font-bold text-amber-800 mb-3">Objetivos da Apresentação</h3>
            <ul className="grid grid-cols-2 gap-2 text-gray-700 text-base">
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">1.</span>
                Demonstrar os recursos e funcionalidades desenvolvidos
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">2.</span>
                Apresentar a tecnologia de ponta implementada
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">3.</span>
                Destacar os benefícios para gestores e usuários
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">4.</span>
                Evidenciar a complexidade e robustez do projeto
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* PAGE 3 - MÓDULO CLÍNICA */}
      <div className="page-break print-page p-8 print:p-4 flex flex-col">
        <div className="border-b-4 border-cyan-600 pb-3 mb-6">
          <span className="text-cyan-600 font-semibold text-sm">MÓDULO 01</span>
          <h2 className="text-3xl font-bold text-gray-800">Gestão Clínica</h2>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <img 
            src={clinicModule} 
            alt="Módulo Clínica" 
            className="rounded-xl shadow-lg w-full h-40 object-cover"
          />
          <div className="flex flex-col justify-center">
            <p className="text-gray-700 text-base leading-relaxed">
              Sistema completo para gestão de clínicas médicas com recursos avançados de 
              agendamento, prontuário eletrônico e teleconsulta integrados.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
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
            <div key={i} className="no-break bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className={`${section.color} text-white px-3 py-1 rounded-lg inline-block mb-3`}>
                <h4 className="font-bold text-sm">{section.title}</h4>
              </div>
              <ul className="space-y-1 text-sm">
                {section.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2 text-gray-700">
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
      <div className="page-break print-page p-8 print:p-4 flex flex-col">
        <div className="border-b-4 border-amber-600 pb-3 mb-6">
          <span className="text-amber-600 font-semibold text-sm">MÓDULO 02</span>
          <h2 className="text-3xl font-bold text-gray-800">Gestão Sindical</h2>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="flex flex-col justify-center">
            <p className="text-gray-700 text-base leading-relaxed">
              Módulo completo para gestão de entidades sindicais com controle de empresas, 
              contribuições, negociações de débitos e homologação de rescisões.
            </p>
          </div>
          <img 
            src={unionModule} 
            alt="Módulo Sindical" 
            className="rounded-xl shadow-lg w-full h-40 object-cover"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
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
            <div key={i} className="no-break bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className={`${section.color} text-white px-3 py-1 rounded-lg inline-block mb-3`}>
                <h4 className="font-bold text-sm">{section.title}</h4>
              </div>
              <ul className="space-y-1 text-sm">
                {section.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2 text-gray-700">
                    <span className="text-gray-400 mt-0.5">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* PAGE 5 - PORTAIS */}
      <div className="page-break print-page p-8 print:p-4 flex flex-col">
        <div className="border-b-4 border-green-600 pb-3 mb-6">
          <span className="text-green-600 font-semibold text-sm">ECOSSISTEMA</span>
          <h2 className="text-3xl font-bold text-gray-800">Portais de Acesso</h2>
        </div>

        <div className="mb-6">
          <img 
            src={portalsAccess} 
            alt="Portais de Acesso" 
            className="rounded-xl shadow-lg w-full h-40 object-cover"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
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
            <div key={i} className="no-break bg-white rounded-lg p-4 border-2 border-gray-200 shadow-sm">
              <div className={`${portal.color} text-white px-3 py-2 rounded-lg mb-3`}>
                <h4 className="font-bold text-sm">{portal.title}</h4>
                <p className="text-xs opacity-80">{portal.subtitle}</p>
              </div>
              <ul className="space-y-1 text-sm">
                {portal.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2 text-gray-700">
                    <span className="text-green-500 mt-0.5">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* PAGE 6 - TECNOLOGIA */}
      <div className="page-break print-page p-8 print:p-4 flex flex-col">
        <div className="border-b-4 border-purple-600 pb-3 mb-6">
          <span className="text-purple-600 font-semibold text-sm">INFRAESTRUTURA</span>
          <h2 className="text-3xl font-bold text-gray-800">Tecnologia Implementada</h2>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <img 
            src={technologyStack} 
            alt="Stack Tecnológico" 
            className="rounded-xl shadow-lg w-full h-40 object-cover"
          />
          <div className="flex flex-col justify-center">
            <p className="text-gray-700 text-base leading-relaxed">
              O eCLINI foi desenvolvido utilizando as mais modernas tecnologias do mercado,
              garantindo performance, segurança e escalabilidade.
            </p>
          </div>
        </div>

        <div className="no-break bg-gray-900 rounded-xl p-6 text-white mb-6">
          <h3 className="text-xl font-bold mb-4 text-center">Stack Tecnológico de Ponta</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { layer: "Frontend", tech: "React + TypeScript", benefit: "Interface moderna e responsiva" },
              { layer: "Estilização", tech: "Tailwind CSS", benefit: "Design consistente e adaptável" },
              { layer: "Banco de Dados", tech: "PostgreSQL", benefit: "Segurança e escalabilidade" },
              { layer: "Autenticação", tech: "OAuth + JWT", benefit: "Login seguro (Google, CPF)" },
              { layer: "Backend", tech: "Edge Functions", benefit: "Processamento em tempo real" },
              { layer: "Integrações", tech: "APIs REST", benefit: "Lytex, WhatsApp, Resend" },
            ].map((item, i) => (
              <div key={i} className="bg-gray-800 rounded-lg p-3 text-center">
                <p className="text-purple-400 text-xs font-semibold mb-1">{item.layer}</p>
                <p className="text-white font-bold text-sm mb-1">{item.tech}</p>
                <p className="text-gray-400 text-xs">{item.benefit}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="no-break bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
          <h3 className="text-xl font-bold mb-4 text-center">Segurança de Dados</h3>
          <div className="grid grid-cols-4 gap-3">
            {[
              { icon: "🔒", title: "RLS", desc: "Cada usuário acessa apenas seus dados" },
              { icon: "🔐", title: "Criptografia", desc: "Dados sensíveis protegidos" },
              { icon: "📋", title: "Auditoria", desc: "Logs de todas as ações críticas" },
              { icon: "🛡️", title: "LGPD", desc: "Proteção de dados pessoais" },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl mb-1">{item.icon}</div>
                <p className="font-bold text-sm">{item.title}</p>
                <p className="text-xs text-blue-100">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PAGE 7 - COMPLEXIDADE */}
      <div className="page-break print-page p-8 print:p-4 flex flex-col">
        <div className="border-b-4 border-rose-600 pb-3 mb-6">
          <span className="text-rose-600 font-semibold text-sm">DIMENSÃO TÉCNICA</span>
          <h2 className="text-3xl font-bold text-gray-800">Complexidade do Projeto</h2>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="no-break bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 text-white">
            <h3 className="text-xl font-bold mb-4">Volume de Código</h3>
            <div className="space-y-3">
              {[
                { label: "Componentes React", value: "+200" },
                { label: "Páginas de Interface", value: "+50" },
                { label: "Edge Functions", value: "+30" },
                { label: "Tabelas de Banco", value: "+80" },
                { label: "Políticas RLS", value: "+150" },
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center border-b border-slate-700 pb-2">
                  <span className="text-slate-300 text-sm">{item.label}</span>
                  <span className="text-2xl font-bold text-emerald-400">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="no-break bg-gradient-to-br from-blue-800 to-indigo-900 rounded-xl p-6 text-white">
            <h3 className="text-xl font-bold mb-4">Integrações Externas</h3>
            <div className="space-y-3">
              {[
                { name: "Lytex", desc: "Boletos bancários" },
                { name: "WhatsApp Business", desc: "Notificações automáticas" },
                { name: "Google OAuth", desc: "Autenticação segura" },
                { name: "Resend", desc: "E-mails transacionais" },
                { name: "Receita Federal", desc: "Consulta CNPJ" },
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center border-b border-blue-700 pb-2">
                  <span className="font-semibold text-blue-200 text-sm">{item.name}</span>
                  <span className="text-blue-300 text-sm">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="no-break bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-6 text-white">
          <h3 className="text-xl font-bold mb-4 text-center">Funcionalidades Avançadas</h3>
          <div className="grid grid-cols-6 gap-3">
            {[
              { icon: "⚡", title: "Tempo Real", desc: "Realtime" },
              { icon: "📦", title: "Lote", desc: "Importações" },
              { icon: "📄", title: "PDFs", desc: "Relatórios" },
              { icon: "📱", title: "QR Codes", desc: "Carteirinhas" },
              { icon: "🔔", title: "Push", desc: "Alertas" },
              { icon: "🌐", title: "PWA", desc: "Mobile" },
            ].map((item, i) => (
              <div key={i} className="bg-white/20 rounded-lg p-3 text-center backdrop-blur-sm">
                <div className="text-2xl mb-1">{item.icon}</div>
                <p className="font-bold text-xs">{item.title}</p>
                <p className="text-xs text-amber-100">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PAGE 8 - BENEFÍCIOS */}
      <div className="page-break print-page p-8 print:p-4 flex flex-col">
        <div className="border-b-4 border-emerald-600 pb-3 mb-6">
          <span className="text-emerald-600 font-semibold text-sm">VALOR ENTREGUE</span>
          <h2 className="text-3xl font-bold text-gray-800">Benefícios</h2>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="no-break">
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-5 text-white h-full">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="text-2xl">👔</span>
                Para os Gestores
              </h3>
              <div className="space-y-2">
                {[
                  { benefit: "Centralização", impact: "Todas as informações em um único lugar" },
                  { benefit: "Automação", impact: "Redução de trabalho manual repetitivo" },
                  { benefit: "Controle Financeiro", impact: "Visão completa de receitas e despesas" },
                  { benefit: "Relatórios", impact: "Decisões baseadas em dados reais" },
                  { benefit: "Rastreabilidade", impact: "Auditoria completa de ações" },
                  { benefit: "Redução de Glosas", impact: "Faturamento TISS automatizado" },
                ].map((item, i) => (
                  <div key={i} className="bg-white/10 rounded-lg p-3">
                    <p className="font-bold text-blue-200 text-sm">{item.benefit}</p>
                    <p className="text-xs text-blue-100">{item.impact}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="no-break">
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-xl p-5 text-white h-full">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="text-2xl">👥</span>
                Para os Usuários
              </h3>
              <div className="space-y-2">
                {[
                  { benefit: "Autoatendimento", impact: "Acesso 24h sem depender de atendimento" },
                  { benefit: "Transparência", impact: "Visualização clara de pendências" },
                  { benefit: "Praticidade", impact: "Boletos e documentos digitais" },
                  { benefit: "Comunicação", impact: "Notificações automáticas" },
                  { benefit: "Mobilidade", impact: "Acesso via aplicativo móvel" },
                  { benefit: "Segurança", impact: "Dados protegidos e privados" },
                ].map((item, i) => (
                  <div key={i} className="bg-white/10 rounded-lg p-3">
                    <p className="font-bold text-emerald-200 text-sm">{item.benefit}</p>
                    <p className="text-xs text-emerald-100">{item.impact}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PAGE 9 - RECURSOS DISPONÍVEIS */}
      <div className="page-break print-page p-8 print:p-4 flex flex-col">
        <div className="border-b-4 border-indigo-600 pb-3 mb-6">
          <span className="text-indigo-600 font-semibold text-sm">FUNCIONALIDADES</span>
          <h2 className="text-3xl font-bold text-gray-800">Recursos Disponíveis</h2>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { name: "Gestão de Pacientes/Sócios", color: "bg-blue-500" },
            { name: "Agenda e Agendamento Online", color: "bg-cyan-500" },
            { name: "Prontuário Eletrônico", color: "bg-emerald-500" },
            { name: "Carteirinha Digital", color: "bg-green-500" },
            { name: "Gestão de Empresas", color: "bg-amber-500" },
            { name: "Contribuições Sindicais", color: "bg-orange-500" },
            { name: "Negociação de Débitos", color: "bg-red-500" },
            { name: "Homologação de Rescisões", color: "bg-rose-500" },
            { name: "Escritórios de Contabilidade", color: "bg-purple-500" },
            { name: "Portais (Empresa/Contador/Sócio)", color: "bg-violet-500" },
            { name: "Aplicativo Mobile (PWA)", color: "bg-indigo-500" },
            { name: "Gestão Financeira Sindical", color: "bg-blue-600" },
            { name: "Conciliação Bancária", color: "bg-teal-500" },
            { name: "Relatórios Gerenciais", color: "bg-slate-600" },
            { name: "Convenções Coletivas (CCTs)", color: "bg-gray-600" },
            { name: "Convênios e Parcerias", color: "bg-pink-500" },
            { name: "Comunicação WhatsApp/E-mail", color: "bg-green-600" },
            { name: "Teleconsulta", color: "bg-sky-500" },
          ].map((item, i) => (
            <div key={i} className={`${item.color} text-white rounded-lg p-3 flex items-center gap-2`}>
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-sm">✓</span>
              </div>
              <span className="font-medium text-sm">{item.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* PAGE 10 - CONTATO */}
      <div className="page-break print-page flex flex-col relative overflow-hidden py-12 print:py-8">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900" />
        
        <div className="relative z-10 flex-1 flex flex-col justify-center items-center text-center text-white p-8">
          <div className="mb-8">
            <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center mb-6 mx-auto shadow-2xl">
              <span className="text-4xl font-bold text-blue-600">TM</span>
            </div>
            <h2 className="text-4xl font-bold mb-3">TECMAX TECNOLOGIA</h2>
            <p className="text-xl text-blue-200">Desenvolvimento de Soluções Digitais</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 max-w-md">
            <h3 className="text-2xl font-bold mb-6">Entre em Contato</h3>
            
            <div className="space-y-4 text-left">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-xl">📧</span>
                </div>
                <div>
                  <p className="text-blue-300 text-xs">E-mail</p>
                  <p className="text-lg font-semibold">contato@tecmax.com.br</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                  <span className="text-xl">📞</span>
                </div>
                <div>
                  <p className="text-blue-300 text-xs">Telefone</p>
                  <p className="text-lg font-semibold">(71) 3144-9898</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                  <span className="text-xl">🌐</span>
                </div>
                <div>
                  <p className="text-blue-300 text-xs">Sistema</p>
                  <p className="text-lg font-semibold">app.eclini.com.br</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 text-blue-300">
            <p className="text-lg italic mb-2">"Tecnologia a serviço da gestão eficiente"</p>
            <p className="text-xs">© 2026 Tecmax Tecnologia - Todos os direitos reservados</p>
          </div>
        </div>
      </div>
    </div>
  );
}
