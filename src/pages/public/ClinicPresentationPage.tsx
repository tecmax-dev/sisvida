import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { PageNumber } from "@/components/print/PageNumber";

// Import images
import coverHero from "@/assets/presentation/cover-hero.jpg";
import clinicModule from "@/assets/presentation/clinic-module.jpg";
import technologyStack from "@/assets/presentation/technology-stack.jpg";
import ecliniLogo from "@/assets/eclini-logo.png";

export default function ClinicPresentationPage() {
  const handlePrint = () => {
    window.print();
  };

  // Force light mode for this public page
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
    document.documentElement.style.colorScheme = "light";
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900" data-theme="light">
      {/* Print Controls - Hidden when printing */}
      <div className="print:hidden fixed top-4 right-4 z-50 flex gap-2">
        <Button onClick={handlePrint} className="bg-cyan-600 hover:bg-cyan-700">
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
        <PageNumber current={1} total={8} variant="light" />
        <img 
          src={coverHero} 
          alt="Cover" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/90 via-cyan-800/80 to-teal-700/70" />
        
        <div className="relative z-10 flex-1 flex flex-col justify-center items-center text-center text-white p-8 print:p-6">
          <div className="mb-6">
            <div className="w-28 h-28 print:w-24 print:h-24 bg-white rounded-2xl flex items-center justify-center mb-4 mx-auto shadow-2xl p-3">
              <img src={ecliniLogo} alt="eCLINI" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-5xl print:text-4xl font-bold mb-3 tracking-tight">eCLINI</h1>
            <p className="text-xl print:text-lg text-cyan-100">Sistema de Gestão para Clínicas e Consultórios</p>
          </div>

          <div className="mt-8 max-w-2xl">
            <h2 className="text-2xl print:text-xl font-semibold mb-3">Apresentação Comercial</h2>
            <p className="text-lg print:text-base text-cyan-100 mb-6">
              Módulo Clínica - Gestão Médica Completa
            </p>
            
            <div className="border-t border-white/30 pt-6 mt-6">
              <p className="text-base print:text-sm text-cyan-200 mb-2">Desenvolvido por:</p>
              <p className="text-2xl print:text-xl font-bold">TECMAX TECNOLOGIA</p>
              <p className="text-cyan-200 mt-3 print:text-sm">Ilhéus - Bahia • Janeiro de 2026</p>
            </div>
          </div>
        </div>
      </div>

      {/* PAGE 2 - SUMÁRIO EXECUTIVO */}
      <div className="page-break print-page p-6 print:p-4 flex flex-col relative">
        <PageNumber current={2} total={8} />
        <div className="border-b-4 border-cyan-600 pb-2 mb-4">
          <h2 className="text-3xl print:text-2xl font-bold text-gray-800">Sumário Executivo</h2>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="no-break bg-gradient-to-r from-cyan-50 to-cyan-100 rounded-lg p-4 print:p-3">
            <h3 className="text-lg print:text-base font-bold text-cyan-800 mb-2">Sobre a Tecmax Tecnologia</h3>
            <p className="text-gray-700 text-sm print:text-xs leading-relaxed">
              A <strong>Tecmax Tecnologia</strong> é uma empresa especializada no desenvolvimento de soluções 
              digitais personalizadas, com foco em sistemas de gestão para organizações que buscam 
              modernização, eficiência e segurança em seus processos administrativos.
            </p>
          </div>

          <div className="no-break bg-gradient-to-r from-teal-50 to-teal-100 rounded-lg p-4 print:p-3">
            <h3 className="text-lg print:text-base font-bold text-teal-800 mb-2">Visão Geral do Sistema</h3>
            <p className="text-gray-700 text-sm print:text-xs leading-relaxed mb-3">
              O <strong>eCLINI Clínica</strong> é uma plataforma completa para gestão de clínicas médicas, 
              consultórios e centros de saúde, proporcionando:
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                "Agenda online inteligente",
                "Prontuário eletrônico",
                "Teleconsulta integrada",
                "Gestão de pacientes",
                "Carteirinha digital",
                "Conformidade com LGPD"
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-4 h-4 print:w-3 print:h-3 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs print:text-[8px]">✓</span>
                  </div>
                  <span className="text-gray-700 text-sm print:text-xs">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="no-break bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 print:p-3">
            <h3 className="text-lg print:text-base font-bold text-blue-800 mb-2">Diferenciais Competitivos</h3>
            <ul className="grid grid-cols-2 gap-2 text-gray-700 text-sm print:text-xs">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">1.</span>
                Sistema 100% web (acesso de qualquer lugar)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">2.</span>
                Interface moderna e intuitiva
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">3.</span>
                Integração com WhatsApp e E-mail
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">4.</span>
                Suporte técnico especializado
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* PAGE 3 - FUNCIONALIDADES PRINCIPAIS */}
      <div className="page-break print-page p-6 print:p-4 flex flex-col relative">
        <PageNumber current={3} total={8} />
        <div className="border-b-4 border-cyan-600 pb-2 mb-4">
          <span className="text-cyan-600 font-semibold text-xs">RECURSOS PRINCIPAIS</span>
          <h2 className="text-2xl print:text-xl font-bold text-gray-800">Gestão Clínica Completa</h2>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <img 
            src={clinicModule} 
            alt="Módulo Clínica" 
            className="rounded-lg shadow-lg w-full h-32 print:h-28 object-cover"
          />
          <div className="flex flex-col justify-center">
            <p className="text-gray-700 text-sm print:text-xs leading-relaxed">
              Sistema desenvolvido para otimizar o dia a dia da sua clínica, com recursos avançados de 
              agendamento, prontuário eletrônico e comunicação automatizada com pacientes.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 flex-1">
          {[
            {
              title: "Agenda Inteligente",
              color: "bg-cyan-500",
              items: [
                "Agendamento online 24 horas",
                "Confirmação automática via WhatsApp",
                "Controle de ausências e bloqueios",
                "Visualização por profissional, dia, semana ou mês",
                "Lembretes automáticos"
              ]
            },
            {
              title: "Prontuário Eletrônico",
              color: "bg-teal-500",
              items: [
                "Histórico completo do paciente",
                "Anamnese digital personalizável",
                "Anexos e documentos médicos",
                "Prescrições digitais",
                "Declarações e atestados"
              ]
            },
            {
              title: "Teleconsulta",
              color: "bg-blue-500",
              items: [
                "Atendimentos remotos ilimitados",
                "Integração com agenda",
                "Histórico de teleconsultas",
                "Sala virtual segura",
                "Gravação opcional"
              ]
            },
            {
              title: "Gestão de Pacientes",
              color: "bg-purple-500",
              items: [
                "Cadastro completo com foto",
                "Dependentes vinculados",
                "Carteirinha digital com QR Code",
                "Controle de limites de consultas",
                "Histórico de atendimentos"
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

      {/* PAGE 4 - RECURSOS ADICIONAIS */}
      <div className="page-break print-page p-6 print:p-4 flex flex-col relative">
        <PageNumber current={4} total={8} />
        <div className="border-b-4 border-teal-600 pb-2 mb-4">
          <span className="text-teal-600 font-semibold text-xs">FUNCIONALIDADES EXTRAS</span>
          <h2 className="text-2xl print:text-xl font-bold text-gray-800">Recursos Adicionais</h2>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            {
              title: "Documentação Médica",
              color: "bg-rose-500",
              items: [
                "Receituário digital",
                "Receituário de controle especial",
                "Solicitação de exames",
                "Declaração de comparecimento",
                "Atestado médico personalizado"
              ]
            },
            {
              title: "Financeiro",
              color: "bg-amber-500",
              items: [
                "Controle de caixa",
                "Contas a pagar/receber",
                "Faturamento TISS",
                "Relatórios financeiros",
                "Conciliação bancária"
              ]
            },
            {
              title: "Comunicação",
              color: "bg-green-500",
              items: [
                "WhatsApp integrado",
                "E-mail automático",
                "SMS (opcional)",
                "Notificações push",
                "Campanhas de marketing"
              ]
            },
            {
              title: "Relatórios",
              color: "bg-indigo-500",
              items: [
                "Dashboard em tempo real",
                "Relatórios gerenciais",
                "Exportação PDF/Excel",
                "Indicadores de produtividade",
                "Análise de no-show"
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

        <div className="no-break bg-gradient-to-r from-cyan-600 to-teal-600 rounded-lg p-4 text-white mt-auto">
          <h3 className="text-lg print:text-base font-bold mb-3 text-center">Integrações Disponíveis</h3>
          <div className="grid grid-cols-5 gap-2">
            {[
              { icon: "💬", title: "WhatsApp" },
              { icon: "📧", title: "E-mail" },
              { icon: "📱", title: "App Mobile" },
              { icon: "🎥", title: "Teleconsulta" },
              { icon: "💳", title: "Pagamentos" },
            ].map((item, i) => (
              <div key={i} className="bg-white/20 rounded p-2 text-center backdrop-blur-sm">
                <div className="text-xl">{item.icon}</div>
                <p className="font-bold text-xs">{item.title}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PAGE 5 - TECNOLOGIA */}
      <div className="page-break print-page p-6 print:p-4 flex flex-col relative">
        <PageNumber current={5} total={8} />
        <div className="border-b-4 border-purple-600 pb-2 mb-4">
          <span className="text-purple-600 font-semibold text-xs">INFRAESTRUTURA</span>
          <h2 className="text-2xl print:text-xl font-bold text-gray-800">Tecnologia de Ponta</h2>
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
              garantindo performance, segurança e escalabilidade para sua clínica.
            </p>
          </div>
        </div>

        <div className="no-break bg-gray-900 rounded-lg p-4 text-white mb-4">
          <h3 className="text-lg print:text-base font-bold mb-3 text-center">Stack Tecnológico</h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              { layer: "Frontend", tech: "React + TypeScript", benefit: "Interface moderna" },
              { layer: "Estilização", tech: "Tailwind CSS", benefit: "Design adaptável" },
              { layer: "Banco de Dados", tech: "PostgreSQL", benefit: "Escalabilidade" },
              { layer: "Autenticação", tech: "OAuth + JWT", benefit: "Login seguro" },
              { layer: "Backend", tech: "Edge Functions", benefit: "Tempo real" },
              { layer: "Hospedagem", tech: "Cloud", benefit: "Alta disponibilidade" },
            ].map((item, i) => (
              <div key={i} className="bg-gray-800 rounded p-2 text-center">
                <p className="text-purple-400 text-[10px] font-semibold">{item.layer}</p>
                <p className="text-white font-bold text-xs">{item.tech}</p>
                <p className="text-gray-400 text-[10px]">{item.benefit}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="no-break bg-gradient-to-r from-cyan-600 to-teal-600 rounded-lg p-4 text-white">
          <h3 className="text-lg print:text-base font-bold mb-3 text-center">Segurança e Conformidade</h3>
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: "🔒", title: "Criptografia", desc: "Dados protegidos" },
              { icon: "🔐", title: "Autenticação", desc: "Login seguro" },
              { icon: "📋", title: "Auditoria", desc: "Logs completos" },
              { icon: "🛡️", title: "LGPD", desc: "Conformidade total" },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="text-xl mb-1">{item.icon}</div>
                <p className="font-bold text-xs">{item.title}</p>
                <p className="text-[10px] text-cyan-100">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PAGE 6 - BENEFÍCIOS */}
      <div className="page-break print-page p-6 print:p-4 flex flex-col relative">
        <PageNumber current={6} total={8} />
        <div className="border-b-4 border-teal-600 pb-2 mb-4">
          <span className="text-teal-600 font-semibold text-xs">VALOR ENTREGUE</span>
          <h2 className="text-2xl print:text-xl font-bold text-gray-800">Benefícios do Sistema</h2>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="no-break">
            <div className="bg-gradient-to-br from-cyan-600 to-cyan-800 rounded-lg p-4 text-white h-full">
              <h3 className="text-lg print:text-base font-bold mb-3 flex items-center gap-2">
                <span className="text-xl">👔</span>
                Para a Clínica
              </h3>
              <div className="space-y-1.5">
                {[
                  { benefit: "Organização", impact: "Agenda e prontuários centralizados" },
                  { benefit: "Produtividade", impact: "Menos trabalho manual" },
                  { benefit: "Redução de Faltas", impact: "Confirmação automática" },
                  { benefit: "Fidelização", impact: "Comunicação ativa com pacientes" },
                  { benefit: "Controle Financeiro", impact: "Receitas e despesas organizadas" },
                  { benefit: "Redução de Glosas", impact: "TISS automatizado" },
                ].map((item, i) => (
                  <div key={i} className="bg-white/10 rounded p-2">
                    <p className="font-bold text-cyan-200 text-xs">{item.benefit}</p>
                    <p className="text-[10px] text-cyan-100">{item.impact}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="no-break">
            <div className="bg-gradient-to-br from-teal-600 to-teal-800 rounded-lg p-4 text-white h-full">
              <h3 className="text-lg print:text-base font-bold mb-3 flex items-center gap-2">
                <span className="text-xl">👥</span>
                Para os Pacientes
              </h3>
              <div className="space-y-1.5">
                {[
                  { benefit: "Comodidade", impact: "Agendamento online 24h" },
                  { benefit: "Lembretes", impact: "WhatsApp e e-mail automáticos" },
                  { benefit: "Teleconsulta", impact: "Atendimento de casa" },
                  { benefit: "Carteirinha Digital", impact: "Sempre à mão no celular" },
                  { benefit: "Histórico", impact: "Acesso aos próprios dados" },
                  { benefit: "Segurança", impact: "Dados protegidos" },
                ].map((item, i) => (
                  <div key={i} className="bg-white/10 rounded p-2">
                    <p className="font-bold text-teal-200 text-xs">{item.benefit}</p>
                    <p className="text-[10px] text-teal-100">{item.impact}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="no-break bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg p-4 text-white">
          <h3 className="text-lg print:text-base font-bold mb-3 text-center">Resultados Esperados</h3>
          <div className="grid grid-cols-4 gap-2">
            {[
              { metric: "-40%", desc: "Faltas de pacientes" },
              { metric: "+30%", desc: "Produtividade" },
              { metric: "-50%", desc: "Tempo administrativo" },
              { metric: "+25%", desc: "Satisfação pacientes" },
            ].map((item, i) => (
              <div key={i} className="bg-white/20 rounded p-2 text-center backdrop-blur-sm">
                <p className="text-2xl font-bold">{item.metric}</p>
                <p className="text-xs">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PAGE 7 - PLANOS */}
      <div className="page-break print-page p-6 print:p-4 flex flex-col relative">
        <PageNumber current={7} total={8} />
        <div className="border-b-4 border-blue-600 pb-2 mb-4">
          <span className="text-blue-600 font-semibold text-xs">INVESTIMENTO</span>
          <h2 className="text-2xl print:text-xl font-bold text-gray-800">Planos e Preços</h2>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4 flex-1">
          {[
            {
              name: "Essencial",
              price: "R$ 197",
              color: "from-gray-600 to-gray-700",
              highlight: false,
              features: [
                "Até 2 profissionais",
                "Agenda online",
                "Prontuário eletrônico",
                "Confirmação WhatsApp",
                "Suporte por e-mail"
              ]
            },
            {
              name: "Profissional",
              price: "R$ 297",
              color: "from-cyan-600 to-teal-600",
              highlight: true,
              features: [
                "Até 5 profissionais",
                "Tudo do Essencial +",
                "Teleconsulta",
                "Financeiro completo",
                "Relatórios avançados",
                "Suporte prioritário"
              ]
            },
            {
              name: "Premium",
              price: "R$ 497",
              color: "from-purple-600 to-indigo-600",
              highlight: false,
              features: [
                "Profissionais ilimitados",
                "Tudo do Profissional +",
                "Multi-unidades",
                "API para integrações",
                "Suporte dedicado",
                "Treinamento incluso"
              ]
            }
          ].map((plan, i) => (
            <div 
              key={i} 
              className={`no-break rounded-lg overflow-hidden ${plan.highlight ? 'ring-2 ring-cyan-500 shadow-lg' : 'border border-gray-200'}`}
            >
              <div className={`bg-gradient-to-br ${plan.color} text-white p-4 text-center`}>
                {plan.highlight && (
                  <span className="bg-amber-400 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded mb-2 inline-block">
                    MAIS POPULAR
                  </span>
                )}
                <h3 className="font-bold text-lg">{plan.name}</h3>
                <p className="text-2xl font-bold mt-1">{plan.price}<span className="text-sm font-normal">/mês</span></p>
              </div>
              <div className="p-3 bg-white">
                <ul className="space-y-1.5">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs text-gray-700">
                      <span className="text-green-500">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        <div className="no-break bg-gray-100 rounded-lg p-4">
          <p className="text-center text-sm text-gray-600">
            <strong>🎁 Oferta de Lançamento:</strong> Ganhe 30 dias grátis + Implantação sem custo adicional
          </p>
        </div>
      </div>

      {/* PAGE 8 - CONTATO */}
      <div className="page-break print-page print:min-h-[277mm] flex flex-col relative overflow-hidden">
        <PageNumber current={8} total={8} variant="light" />
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-900 via-teal-900 to-blue-900" />
        
        <div className="relative z-10 flex-1 flex flex-col justify-center items-center text-center text-white p-6">
          <div className="mb-6">
            <div className="w-20 h-20 bg-white rounded-xl flex items-center justify-center mb-4 mx-auto shadow-2xl">
              <span className="text-3xl font-bold text-cyan-600">TM</span>
            </div>
            <h2 className="text-3xl print:text-2xl font-bold mb-2">TECMAX TECNOLOGIA</h2>
            <p className="text-lg print:text-base text-cyan-200">Desenvolvimento de Soluções Digitais</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 max-w-sm mb-4">
            <h3 className="text-xl print:text-lg font-bold mb-4">Entre em Contato</h3>
            
            <div className="space-y-3 text-left">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-cyan-500 rounded-lg flex items-center justify-center">
                  <span className="text-lg">📧</span>
                </div>
                <div>
                  <p className="text-cyan-300 text-[10px]">E-mail</p>
                  <p className="text-base font-semibold">contato@tecmax.com.br</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                  <span className="text-lg">📞</span>
                </div>
                <div>
                  <p className="text-cyan-300 text-[10px]">Telefone</p>
                  <p className="text-base font-semibold">(71) 3144-9898</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                  <span className="text-lg">🌐</span>
                </div>
                <div>
                  <p className="text-cyan-300 text-[10px]">Sistema</p>
                  <p className="text-base font-semibold">app.eclini.com.br</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-cyan-500/20 backdrop-blur-sm rounded-lg p-4 max-w-md">
            <p className="font-bold text-lg mb-2">🚀 Pronto para modernizar sua clínica?</p>
            <p className="text-cyan-200 text-sm">
              Solicite uma demonstração gratuita e descubra como o eCLINI pode transformar sua gestão!
            </p>
          </div>

          <div className="mt-6 text-cyan-300">
            <p className="text-base italic mb-1">"Tecnologia a serviço da saúde"</p>
            <p className="text-[10px]">© 2026 Tecmax Tecnologia - Todos os direitos reservados</p>
          </div>
        </div>
      </div>
    </div>
  );
}
