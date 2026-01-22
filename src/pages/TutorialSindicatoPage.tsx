import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { 
  Download, 
  FileText, 
  Loader2, 
  Building2, 
  Users, 
  DollarSign, 
  Receipt, 
  Handshake,
  Scale,
  Smartphone,
  BookOpen,
  CheckCircle,
  Play,
  ArrowRight,
  Stethoscope,
  UserPlus,
  ClipboardList,
  Settings,
  BarChart3,
  Shield
} from "lucide-react";
import jsPDF from "jspdf";
import { toast } from "sonner";
import ecliniLogo from "@/assets/eclini-logo.png";

const TutorialSindicatoPage = () => {
  const [generating, setGenerating] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  useEffect(() => {
    const loadLogo = async () => {
      try {
        const response = await fetch(ecliniLogo);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          setLogoBase64(reader.result as string);
        };
        reader.readAsDataURL(blob);
      } catch (error) {
        console.error("Erro ao carregar logo:", error);
      }
    };
    loadLogo();
  }, []);

  const generatePDF = async () => {
    setGenerating(true);
    
    try {
      const doc = new jsPDF("p", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);

      // Colors
      const primaryColor: [number, number, number] = [59, 130, 246]; // Blue
      const secondaryColor: [number, number, number] = [139, 92, 246]; // Purple  
      const accentColor: [number, number, number] = [16, 185, 129]; // Emerald
      const darkColor: [number, number, number] = [30, 41, 59]; // Slate dark
      const lightColor: [number, number, number] = [248, 250, 252]; // Slate light

      // Helper functions
      const drawHeader = (pageNum: number, title: string) => {
        // Header background
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, pageWidth, 28, "F");
        
        // Logo
        if (logoBase64) {
          doc.addImage(logoBase64, 'PNG', margin, 4, 35, 17);
        }

        // Page title
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(title, pageWidth - margin, 16, { align: "right" });

        // Page number
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`Página ${pageNum}`, pageWidth - margin, 23, { align: "right" });
      };

      const drawFooter = () => {
        doc.setFillColor(...darkColor);
        doc.rect(0, pageHeight - 12, pageWidth, 12, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.text("Tutorial Eclini - Módulo Sindical | © 2026 Tecmax Tecnologia", pageWidth / 2, pageHeight - 5, { align: "center" });
      };

      const drawSectionBox = (y: number, title: string, content: string[], icon: string, color: [number, number, number]) => {
        const boxHeight = 25 + (content.length * 6);
        
        // Box background
        doc.setFillColor(color[0], color[1], color[2], 0.1);
        doc.roundedRect(margin, y, contentWidth, boxHeight, 3, 3, "F");
        
        // Left accent bar
        doc.setFillColor(...color);
        doc.roundedRect(margin, y, 4, boxHeight, 2, 2, "F");
        
        // Icon circle
        doc.setFillColor(...color);
        doc.circle(margin + 15, y + 12, 8, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(icon, margin + 15, y + 15, { align: "center" });
        
        // Title
        doc.setTextColor(...color);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(title, margin + 28, y + 14);
        
        // Content
        doc.setTextColor(...darkColor);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        content.forEach((line, index) => {
          doc.text(`• ${line}`, margin + 28, y + 22 + (index * 6));
        });

        return boxHeight + 5;
      };

      const drawStep = (y: number, stepNum: number, title: string, description: string) => {
        // Step number circle
        doc.setFillColor(...accentColor);
        doc.circle(margin + 8, y + 6, 6, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(stepNum.toString(), margin + 8, y + 9, { align: "center" });

        // Step title
        doc.setTextColor(...darkColor);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(title, margin + 18, y + 8);

        // Step description
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(description, contentWidth - 25);
        doc.text(lines, margin + 18, y + 15);

        return 20 + (lines.length * 4);
      };

      // =====================
      // PAGE 1 - COVER
      // =====================
      
      // Full page gradient background
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, pageWidth, pageHeight, "F");
      
      // Decorative circles
      doc.setFillColor(255, 255, 255, 0.1);
      doc.circle(pageWidth + 20, -20, 80, "F");
      doc.circle(-30, pageHeight + 30, 100, "F");
      
      // Logo centered
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', (pageWidth - 60) / 2, 35, 60, 30);
      }

      // Main title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(32);
      doc.setFont("helvetica", "bold");
      doc.text("Tutorial Completo", pageWidth / 2, 90, { align: "center" });
      
      doc.setFontSize(24);
      doc.text("Módulo Sindical", pageWidth / 2, 105, { align: "center" });

      // Subtitle box
      doc.setFillColor(255, 255, 255, 0.2);
      doc.roundedRect(margin + 10, 120, contentWidth - 20, 35, 4, 4, "F");
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text("Guia ilustrado para usuários e profissionais de saúde", pageWidth / 2, 132, { align: "center" });
      doc.text("Sistema Eclini - Gestão Sindical Inteligente", pageWidth / 2, 145, { align: "center" });

      // Feature cards
      const features = [
        { icon: "🏢", label: "Gestão de Empresas" },
        { icon: "👥", label: "Cadastro de Sócios" },
        { icon: "💰", label: "Contribuições" },
        { icon: "📊", label: "Financeiro" },
        { icon: "🤝", label: "Negociações" },
        { icon: "⚖️", label: "Jurídico" }
      ];

      const cardWidth = (contentWidth - 30) / 3;
      features.forEach((feat, i) => {
        const row = Math.floor(i / 3);
        const col = i % 3;
        const x = margin + 5 + (col * (cardWidth + 10));
        const y = 170 + (row * 30);
        
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(x, y, cardWidth, 22, 3, 3, "F");
        
        doc.setTextColor(...primaryColor);
        doc.setFontSize(14);
        doc.text(feat.icon, x + 8, y + 14);
        
        doc.setTextColor(...darkColor);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(feat.label, x + 22, y + 14);
      });

      // Footer info
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin, pageHeight - 50, contentWidth, 35, 4, 4, "F");
      
      doc.setTextColor(...darkColor);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Tecmax Tecnologia", pageWidth / 2, pageHeight - 38, { align: "center" });
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Contato: 71 3144-9898", pageWidth / 2, pageHeight - 28, { align: "center" });
      doc.text("www.eclini.com.br", pageWidth / 2, pageHeight - 20, { align: "center" });

      // =====================
      // PAGE 2 - OVERVIEW & ACCESS
      // =====================
      doc.addPage();
      drawHeader(2, "Visão Geral do Sistema");
      drawFooter();

      let yPos = 38;

      // Intro text
      doc.setTextColor(...darkColor);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const introText = "O Módulo Sindical do Eclini foi desenvolvido para oferecer uma solução completa de gestão para entidades sindicais. Este tutorial apresenta as principais funcionalidades e como utilizá-las de forma eficiente.";
      const introLines = doc.splitTextToSize(introText, contentWidth);
      doc.text(introLines, margin, yPos);
      yPos += 20;

      // Main modules section
      doc.setTextColor(...primaryColor);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("📋 Módulos Principais", margin, yPos);
      yPos += 10;

      yPos += drawSectionBox(yPos, "Empresas", [
        "Cadastro completo de empresas associadas",
        "Gestão de escritórios contábeis vinculados",
        "Controle de planos e contratos"
      ], "🏢", [245, 158, 11]);

      yPos += drawSectionBox(yPos, "Sócios", [
        "Cadastro de trabalhadores filiados",
        "Gestão de benefícios e autorizações",
        "Aprovação de novas filiações"
      ], "👥", secondaryColor);

      yPos += drawSectionBox(yPos, "Contribuições", [
        "Gerenciamento de mensalidades",
        "Controle de inadimplência",
        "Emissão de relatórios detalhados"
      ], "💳", accentColor);

      yPos += drawSectionBox(yPos, "Financeiro", [
        "Controle de receitas e despesas",
        "Fluxo de caixa em tempo real",
        "Conciliação bancária automatizada"
      ], "📊", primaryColor);

      // =====================
      // PAGE 3 - STEP BY STEP
      // =====================
      doc.addPage();
      drawHeader(3, "Primeiros Passos");
      drawFooter();

      yPos = 38;

      doc.setTextColor(...primaryColor);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("🚀 Como Começar", margin, yPos);
      yPos += 12;

      yPos += drawStep(yPos, 1, "Acesso ao Sistema", 
        "Acesse o sistema através do endereço fornecido pela sua entidade. Utilize seu e-mail e senha cadastrados para fazer login.");
      
      yPos += drawStep(yPos, 2, "Navegação no Menu", 
        "O menu lateral esquerdo contém todas as funcionalidades organizadas por categorias. Clique nas categorias para expandir os submenus.");
      
      yPos += drawStep(yPos, 3, "Dashboard Principal", 
        "A tela inicial apresenta um resumo com estatísticas importantes: empresas ativas, sócios, contribuições pendentes e saldo financeiro.");
      
      yPos += drawStep(yPos, 4, "Cadastro de Empresas", 
        "Acesse Empresas > Cadastro para adicionar novas empresas. Preencha CNPJ, razão social, contatos e endereço completo.");
      
      yPos += drawStep(yPos, 5, "Gestão de Contribuições", 
        "Em Contribuições > Gerenciamento você pode visualizar, filtrar e atualizar o status de pagamento das contribuições.");
      
      yPos += drawStep(yPos, 6, "Relatórios", 
        "Acesse a área de Relatórios para gerar documentos personalizados com filtros por período, empresa ou status.");

      // Tips box
      yPos += 10;
      doc.setFillColor(16, 185, 129, 0.1);
      doc.roundedRect(margin, yPos, contentWidth, 40, 3, 3, "F");
      doc.setFillColor(...accentColor);
      doc.roundedRect(margin, yPos, 4, 40, 2, 2, "F");
      
      doc.setTextColor(...accentColor);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("💡 Dicas Importantes", margin + 10, yPos + 10);
      
      doc.setTextColor(...darkColor);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("• Use os filtros de busca para encontrar informações rapidamente", margin + 10, yPos + 20);
      doc.text("• Exporte relatórios em PDF ou Excel conforme necessidade", margin + 10, yPos + 26);
      doc.text("• Mantenha os dados de contato das empresas sempre atualizados", margin + 10, yPos + 32);

      // =====================
      // PAGE 4 - MEDICAL PROFESSIONALS
      // =====================
      doc.addPage();
      drawHeader(4, "Guia para Profissionais de Saúde");
      drawFooter();

      yPos = 38;

      // Medical icon header
      doc.setFillColor(...secondaryColor);
      doc.roundedRect(margin, yPos, contentWidth, 30, 4, 4, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("🩺 Área Médica - Homologações e Atendimentos", pageWidth / 2, yPos + 18, { align: "center" });
      yPos += 40;

      // Medical specific content
      yPos += drawStep(yPos, 1, "Agenda de Homologações", 
        "Acesse Homologação > Agenda para visualizar e gerenciar os agendamentos de homologação. O calendário mostra todos os horários disponíveis e ocupados.");
      
      yPos += drawStep(yPos, 2, "Cadastro de Profissionais", 
        "Em Homologação > Profissionais, cadastre os médicos e especialistas que realizam atendimentos. Defina especialidades, horários e salas.");
      
      yPos += drawStep(yPos, 3, "Serviços Oferecidos", 
        "Configure os tipos de serviço disponíveis em Homologação > Serviços. Defina duração, valor e requisitos de cada procedimento.");
      
      yPos += drawStep(yPos, 4, "Bloqueios de Agenda", 
        "Use Homologação > Bloqueios para definir períodos indisponíveis como férias, feriados ou manutenção.");
      
      yPos += drawStep(yPos, 5, "Atendimento ao Paciente", 
        "Durante o atendimento, acesse o prontuário do paciente, registre observações e finalize a homologação com assinatura digital.");

      // Medical tips
      yPos += 5;
      doc.setFillColor(139, 92, 246, 0.1);
      doc.roundedRect(margin, yPos, contentWidth, 35, 3, 3, "F");
      doc.setFillColor(...secondaryColor);
      doc.roundedRect(margin, yPos, 4, 35, 2, 2, "F");
      
      doc.setTextColor(...secondaryColor);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("⚕️ Boas Práticas Médicas", margin + 10, yPos + 10);
      
      doc.setTextColor(...darkColor);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("• Sempre verifique a identidade do paciente antes do atendimento", margin + 10, yPos + 19);
      doc.text("• Mantenha os registros médicos completos e atualizados", margin + 10, yPos + 25);
      doc.text("• Utilize a assinatura digital para validar documentos oficiais", margin + 10, yPos + 31);

      // =====================
      // PAGE 5 - FINANCIAL MODULE
      // =====================
      doc.addPage();
      drawHeader(5, "Módulo Financeiro");
      drawFooter();

      yPos = 38;

      doc.setTextColor(...primaryColor);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("💰 Gestão Financeira Completa", margin, yPos);
      yPos += 12;

      // Financial sections
      yPos += drawSectionBox(yPos, "Visão Geral", [
        "Dashboard com métricas em tempo real",
        "Gráficos de evolução mensal",
        "Indicadores de desempenho (KPIs)"
      ], "📈", primaryColor);

      yPos += drawSectionBox(yPos, "Despesas e Receitas", [
        "Cadastro categorizado de lançamentos",
        "Anexo de comprovantes digitais",
        "Aprovação em múltiplos níveis"
      ], "💳", [239, 68, 68]);

      yPos += drawSectionBox(yPos, "Fluxo de Caixa", [
        "Projeção de entradas e saídas",
        "Alertas de saldo baixo",
        "Transferências entre contas"
      ], "📊", accentColor);

      yPos += drawSectionBox(yPos, "Conciliação Bancária", [
        "Importação de extratos OFX",
        "Conciliação automática",
        "Identificação de divergências"
      ], "🏦", secondaryColor);

      // =====================
      // PAGE 6 - LEGAL & NEGOTIATIONS
      // =====================
      doc.addPage();
      drawHeader(6, "Jurídico e Negociações");
      drawFooter();

      yPos = 38;

      // Legal section
      doc.setTextColor(...primaryColor);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("⚖️ Módulo Jurídico", margin, yPos);
      yPos += 12;

      yPos += drawSectionBox(yPos, "Gestão de Processos", [
        "Cadastro de ações judiciais",
        "Acompanhamento de prazos processuais",
        "Vinculação com advogados e escritórios"
      ], "📋", [99, 102, 241]);

      yPos += drawSectionBox(yPos, "Controle de Prazos", [
        "Alertas automáticos de vencimentos",
        "Calendário integrado",
        "Histórico de movimentações"
      ], "📅", [236, 72, 153]);

      yPos += 10;

      // Negotiations section
      doc.setTextColor(...secondaryColor);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("🤝 Negociações e Parcelamentos", margin, yPos);
      yPos += 12;

      yPos += drawSectionBox(yPos, "Acordos de Dívida", [
        "Simulação de parcelamentos",
        "Cálculo de juros e correções",
        "Aprovação digital de propostas"
      ], "💼", [245, 158, 11]);

      yPos += drawSectionBox(yPos, "Acompanhamento", [
        "Status de pagamentos em tempo real",
        "Notificações de inadimplência",
        "Renegociação simplificada"
      ], "📈", accentColor);

      // =====================
      // PAGE 7 - MOBILE APP & SUPPORT
      // =====================
      doc.addPage();
      drawHeader(7, "App Mobile e Suporte");
      drawFooter();

      yPos = 38;

      // Mobile app section
      doc.setFillColor(...accentColor);
      doc.roundedRect(margin, yPos, contentWidth, 30, 4, 4, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("📱 Aplicativo para Sócios", pageWidth / 2, yPos + 18, { align: "center" });
      yPos += 40;

      // App features
      const appFeatures = [
        { title: "Carteirinha Digital", desc: "Identificação do sócio com QR Code" },
        { title: "Benefícios", desc: "Consulta e resgate de convênios" },
        { title: "Contribuições", desc: "Visualização de boletos e pagamentos" },
        { title: "Notificações", desc: "Avisos importantes em tempo real" }
      ];

      appFeatures.forEach((feat, i) => {
        const y = yPos + (i * 20);
        doc.setFillColor(16, 185, 129, 0.1);
        doc.roundedRect(margin, y, contentWidth, 16, 2, 2, "F");
        
        doc.setTextColor(...accentColor);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`✓ ${feat.title}`, margin + 5, y + 10);
        
        doc.setTextColor(...darkColor);
        doc.setFont("helvetica", "normal");
        doc.text(feat.desc, margin + 60, y + 10);
      });

      yPos += 95;

      // Support section
      doc.setTextColor(...primaryColor);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("🆘 Suporte e Ajuda", margin, yPos);
      yPos += 12;

      doc.setFillColor(...lightColor);
      doc.roundedRect(margin, yPos, contentWidth, 50, 4, 4, "F");
      
      doc.setTextColor(...darkColor);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Precisa de ajuda? Entre em contato conosco:", margin + 10, yPos + 12);
      
      doc.setFont("helvetica", "bold");
      doc.text("📞 Telefone: 71 3144-9898", margin + 10, yPos + 24);
      doc.text("📧 E-mail: suporte@eclini.com.br", margin + 10, yPos + 34);
      doc.text("💬 Chat: Disponível no sistema (horário comercial)", margin + 10, yPos + 44);

      // =====================
      // PAGE 8 - BACK COVER
      // =====================
      doc.addPage();
      
      // Full page gradient
      doc.setFillColor(...darkColor);
      doc.rect(0, 0, pageWidth, pageHeight, "F");
      
      // Decorative elements
      doc.setFillColor(...primaryColor);
      doc.circle(-20, 50, 60, "F");
      doc.setFillColor(...secondaryColor);
      doc.circle(pageWidth + 20, pageHeight - 50, 80, "F");

      // Logo
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', (pageWidth - 50) / 2, 50, 50, 25);
      }

      // Thank you message
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("Obrigado por escolher", pageWidth / 2, 100, { align: "center" });
      doc.text("o Eclini!", pageWidth / 2, 115, { align: "center" });

      // Closing message box
      doc.setFillColor(255, 255, 255, 0.1);
      doc.roundedRect(margin + 10, 130, contentWidth - 20, 50, 4, 4, "F");
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      const closingText = "Este tutorial foi desenvolvido para facilitar o seu dia a dia. Em caso de dúvidas, nossa equipe de suporte está sempre pronta para ajudar.";
      const closingLines = doc.splitTextToSize(closingText, contentWidth - 40);
      doc.text(closingLines, pageWidth / 2, 150, { align: "center" });

      // Contact info
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin + 20, 200, contentWidth - 40, 60, 4, 4, "F");
      
      doc.setTextColor(...darkColor);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Tecmax Tecnologia", pageWidth / 2, 218, { align: "center" });
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text("71 3144-9898", pageWidth / 2, 232, { align: "center" });
      doc.text("www.eclini.com.br", pageWidth / 2, 244, { align: "center" });

      // Version
      doc.setTextColor(255, 255, 255, 0.5);
      doc.setFontSize(9);
      doc.text("Tutorial v1.0 | Janeiro 2026", pageWidth / 2, pageHeight - 20, { align: "center" });

      // Save PDF
      doc.save("Tutorial-Modulo-Sindical-Eclini.pdf");
      toast.success("Tutorial gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar o tutorial");
    } finally {
      setGenerating(false);
    }
  };

  const modules = [
    { icon: Building2, title: "Empresas", desc: "Gestão de empresas e escritórios", color: "text-amber-500", bg: "bg-amber-500/10" },
    { icon: Users, title: "Sócios", desc: "Cadastro e benefícios", color: "text-violet-500", bg: "bg-violet-500/10" },
    { icon: Receipt, title: "Contribuições", desc: "Controle de pagamentos", color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { icon: DollarSign, title: "Financeiro", desc: "Receitas, despesas e fluxo", color: "text-blue-500", bg: "bg-blue-500/10" },
    { icon: Handshake, title: "Negociações", desc: "Acordos e parcelamentos", color: "text-purple-500", bg: "bg-purple-500/10" },
    { icon: Scale, title: "Jurídico", desc: "Processos e prazos", color: "text-indigo-500", bg: "bg-indigo-500/10" },
    { icon: Stethoscope, title: "Homologação", desc: "Agenda médica", color: "text-teal-500", bg: "bg-teal-500/10" },
    { icon: Smartphone, title: "App Mobile", desc: "Gestão de conteúdo", color: "text-pink-500", bg: "bg-pink-500/10" },
  ];

  const learningTopics = [
    { icon: Play, title: "Primeiros Passos", desc: "Como acessar e navegar no sistema" },
    { icon: UserPlus, title: "Cadastros", desc: "Empresas, sócios e escritórios" },
    { icon: ClipboardList, title: "Contribuições", desc: "Gerenciar e acompanhar pagamentos" },
    { icon: BarChart3, title: "Relatórios", desc: "Gerar análises e exportar dados" },
    { icon: Settings, title: "Configurações", desc: "Personalizar o sistema" },
    { icon: Shield, title: "Segurança", desc: "Boas práticas de uso" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-primary/5">
      <Header />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-20 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-purple-500/10 to-emerald-500/10" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
          
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
                <BookOpen className="h-4 w-4" />
                Tutorial Oficial
              </div>
              
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
                Aprenda a usar o{" "}
                <span className="bg-gradient-to-r from-primary via-purple-500 to-emerald-500 bg-clip-text text-transparent">
                  Módulo Sindical
                </span>
              </h1>
              
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                Guia completo e ilustrado para usuários e profissionais de saúde. 
                Domine todas as funcionalidades do sistema Eclini.
              </p>
              
              <Button 
                size="lg" 
                onClick={generatePDF}
                disabled={generating}
                className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white px-8 py-6 text-lg shadow-xl hover:shadow-2xl transition-all"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Gerando Tutorial...
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5 mr-2" />
                    Baixar Tutorial em PDF
                  </>
                )}
              </Button>
              
              <p className="text-sm text-muted-foreground mt-4">
                <FileText className="h-4 w-4 inline mr-1" />
                8 páginas ilustradas • Formato A4 • Gratuito
              </p>
            </div>
          </div>
        </section>

        {/* Modules Overview */}
        <section className="py-16 bg-card/50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground mb-4">
                Módulos Abordados
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                O tutorial cobre todas as principais funcionalidades do sistema
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
              {modules.map((mod, i) => (
                <Card key={i} className="border-border/50 hover:border-primary/50 transition-colors">
                  <CardContent className="p-4 text-center">
                    <div className={`w-12 h-12 rounded-xl ${mod.bg} flex items-center justify-center mx-auto mb-3`}>
                      <mod.icon className={`h-6 w-6 ${mod.color}`} />
                    </div>
                    <h3 className="font-semibold text-foreground text-sm">{mod.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{mod.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Learning Topics */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground mb-4">
                O que você vai aprender
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Conteúdo passo a passo para dominar o sistema
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {learningTopics.map((topic, i) => (
                <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-card border border-border/50 hover:border-primary/30 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <topic.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{topic.title}</h3>
                    <p className="text-sm text-muted-foreground">{topic.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Medical Section */}
        <section className="py-16 bg-gradient-to-r from-purple-500/10 via-primary/5 to-teal-500/10">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-500 to-teal-500 flex items-center justify-center shrink-0">
                  <Stethoscope className="h-12 w-12 text-white" />
                </div>
                <div className="text-center md:text-left">
                  <h2 className="text-2xl font-bold text-foreground mb-3">
                    Seção Especial para Profissionais de Saúde
                  </h2>
                  <p className="text-muted-foreground mb-4">
                    O tutorial inclui um capítulo dedicado aos médicos e profissionais de saúde, 
                    abordando agenda de homologações, cadastro de pacientes e assinatura digital.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                    <span className="px-3 py-1 bg-purple-500/10 text-purple-600 rounded-full text-sm">
                      <CheckCircle className="h-4 w-4 inline mr-1" /> Agenda Médica
                    </span>
                    <span className="px-3 py-1 bg-teal-500/10 text-teal-600 rounded-full text-sm">
                      <CheckCircle className="h-4 w-4 inline mr-1" /> Homologações
                    </span>
                    <span className="px-3 py-1 bg-blue-500/10 text-blue-600 rounded-full text-sm">
                      <CheckCircle className="h-4 w-4 inline mr-1" /> Assinatura Digital
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <Card className="max-w-3xl mx-auto bg-gradient-to-r from-primary to-purple-600 border-0 text-white overflow-hidden relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
              <CardContent className="p-8 md:p-12 text-center relative z-10">
                <h2 className="text-3xl font-bold mb-4">
                  Pronto para começar?
                </h2>
                <p className="text-white/80 mb-8 max-w-lg mx-auto">
                  Baixe agora o tutorial completo e domine todas as funcionalidades 
                  do Módulo Sindical do Eclini.
                </p>
                <Button 
                  size="lg" 
                  variant="secondary"
                  onClick={generatePDF}
                  disabled={generating}
                  className="bg-white text-primary hover:bg-white/90 px-8"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <Download className="h-5 w-5 mr-2" />
                      Baixar Tutorial Gratuito
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default TutorialSindicatoPage;
