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

      // Colors - RGB format
      const primaryColor: [number, number, number] = [0, 136, 169]; // Teal/Cyan
      const secondaryColor: [number, number, number] = [106, 90, 205]; // Slate Blue
      const accentColor: [number, number, number] = [16, 185, 129]; // Emerald
      const darkColor: [number, number, number] = [30, 41, 59]; // Slate dark
      const lightGray: [number, number, number] = [241, 245, 249]; // Light gray bg
      const amberColor: [number, number, number] = [245, 158, 11]; // Amber
      const redColor: [number, number, number] = [239, 68, 68]; // Red

      // Helper: Draw page header with logo
      const drawHeader = (pageNum: number, title: string) => {
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, pageWidth, 26, "F");
        
        if (logoBase64) {
          doc.addImage(logoBase64, 'PNG', margin, 3, 32, 16);
        }

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text(title, pageWidth - margin, 14, { align: "right" });

        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(`Pagina ${pageNum}`, pageWidth - margin, 21, { align: "right" });
      };

      // Helper: Draw page footer
      const drawFooter = () => {
        doc.setFillColor(...darkColor);
        doc.rect(0, pageHeight - 10, pageWidth, 10, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.text("Tutorial Eclini - Modulo Sindical | Tecmax Tecnologia 2026", pageWidth / 2, pageHeight - 4, { align: "center" });
      };

      // Helper: Draw a content box with colored left bar
      const drawContentBox = (y: number, title: string, items: string[], iconLetter: string, boxColor: [number, number, number]) => {
        const boxHeight = 22 + (items.length * 5.5);
        
        // Light background
        doc.setFillColor(...lightGray);
        doc.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, "F");
        
        // Left accent bar
        doc.setFillColor(...boxColor);
        doc.rect(margin, y, 3, boxHeight, "F");
        
        // Icon circle
        doc.setFillColor(...boxColor);
        doc.circle(margin + 14, y + 11, 7, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(iconLetter, margin + 14, y + 14, { align: "center" });
        
        // Title
        doc.setTextColor(...boxColor);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(title, margin + 26, y + 13);
        
        // Items
        doc.setTextColor(...darkColor);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        items.forEach((item, index) => {
          doc.text("- " + item, margin + 26, y + 20 + (index * 5.5));
        });

        return boxHeight + 4;
      };

      // Helper: Draw numbered step
      const drawStep = (y: number, stepNum: number, title: string, description: string) => {
        // Step number circle
        doc.setFillColor(...accentColor);
        doc.circle(margin + 7, y + 5, 5, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(stepNum.toString(), margin + 7, y + 7.5, { align: "center" });

        // Step title
        doc.setTextColor(...darkColor);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(title, margin + 16, y + 7);

        // Step description
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(description, contentWidth - 22);
        doc.text(lines, margin + 16, y + 13);

        return 16 + (lines.length * 3.5);
      };

      // =====================
      // PAGE 1 - COVER
      // =====================
      
      // Gradient-like background with overlapping shapes
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, pageWidth, pageHeight, "F");
      
      // Decorative circles with lighter color (simulating transparency)
      doc.setFillColor(51, 163, 191); // Lighter teal
      doc.circle(pageWidth + 10, -10, 70, "F");
      doc.circle(-20, pageHeight + 20, 90, "F");
      
      // Logo centered
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', (pageWidth - 55) / 2, 32, 55, 28);
      }

      // Main title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(28);
      doc.setFont("helvetica", "bold");
      doc.text("Tutorial Completo", pageWidth / 2, 85, { align: "center" });
      
      doc.setFontSize(22);
      doc.text("Modulo Sindical", pageWidth / 2, 98, { align: "center" });

      // Subtitle box with semi-transparent look
      doc.setFillColor(51, 163, 191); // Lighter shade for transparency effect
      doc.roundedRect(margin + 8, 112, contentWidth - 16, 28, 3, 3, "F");
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Guia ilustrado para usuarios e profissionais de saude", pageWidth / 2, 122, { align: "center" });
      doc.text("Sistema Eclini - Gestao Sindical Inteligente", pageWidth / 2, 132, { align: "center" });

      // Feature cards - 6 items in 2 rows
      const features = [
        { letter: "E", label: "Gestao de Empresas" },
        { letter: "S", label: "Cadastro de Socios" },
        { letter: "C", label: "Contribuicoes" },
        { letter: "F", label: "Financeiro" },
        { letter: "N", label: "Negociacoes" },
        { letter: "J", label: "Juridico" }
      ];

      const cardW = (contentWidth - 20) / 3;
      features.forEach((feat, i) => {
        const row = Math.floor(i / 3);
        const col = i % 3;
        const x = margin + 5 + (col * (cardW + 5));
        const y = 155 + (row * 26);
        
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(x, y, cardW, 20, 2, 2, "F");
        
        // Icon letter circle
        doc.setFillColor(...primaryColor);
        doc.circle(x + 10, y + 10, 6, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(feat.letter, x + 10, y + 12.5, { align: "center" });
        
        doc.setTextColor(...darkColor);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(feat.label, x + 20, y + 12);
      });

      // Footer contact box
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin, pageHeight - 48, contentWidth, 33, 3, 3, "F");
      
      doc.setTextColor(...darkColor);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Tecmax Tecnologia", pageWidth / 2, pageHeight - 36, { align: "center" });
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Contato: 71 3144-9898", pageWidth / 2, pageHeight - 27, { align: "center" });
      doc.text("www.eclini.com.br", pageWidth / 2, pageHeight - 19, { align: "center" });

      // =====================
      // PAGE 2 - OVERVIEW
      // =====================
      doc.addPage();
      drawHeader(2, "Visao Geral do Sistema");
      drawFooter();

      let yPos = 36;

      // Intro text
      doc.setTextColor(...darkColor);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const introText = "O Modulo Sindical do Eclini foi desenvolvido para oferecer uma solucao completa de gestao para entidades sindicais. Este tutorial apresenta as principais funcionalidades e como utiliza-las de forma eficiente.";
      const introLines = doc.splitTextToSize(introText, contentWidth);
      doc.text(introLines, margin, yPos);
      yPos += 18;

      // Section title
      doc.setTextColor(...primaryColor);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Modulos Principais", margin, yPos);
      yPos += 8;

      yPos += drawContentBox(yPos, "Empresas", [
        "Cadastro completo de empresas associadas",
        "Gestao de escritorios contabeis vinculados",
        "Controle de planos e contratos"
      ], "E", amberColor);

      yPos += drawContentBox(yPos, "Socios", [
        "Cadastro de trabalhadores filiados",
        "Gestao de beneficios e autorizacoes",
        "Aprovacao de novas filiacoes"
      ], "S", secondaryColor);

      yPos += drawContentBox(yPos, "Contribuicoes", [
        "Gerenciamento de mensalidades",
        "Controle de inadimplencia",
        "Emissao de relatorios detalhados"
      ], "C", accentColor);

      yPos += drawContentBox(yPos, "Financeiro", [
        "Controle de receitas e despesas",
        "Fluxo de caixa em tempo real",
        "Conciliacao bancaria automatizada"
      ], "F", primaryColor);

      // =====================
      // PAGE 3 - FIRST STEPS
      // =====================
      doc.addPage();
      drawHeader(3, "Primeiros Passos");
      drawFooter();

      yPos = 36;

      doc.setTextColor(...primaryColor);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Como Comecar", margin, yPos);
      yPos += 10;

      yPos += drawStep(yPos, 1, "Acesso ao Sistema", 
        "Acesse o sistema atraves do endereco fornecido pela sua entidade. Utilize seu e-mail e senha cadastrados para fazer login.");
      
      yPos += drawStep(yPos, 2, "Navegacao no Menu", 
        "O menu lateral esquerdo contem todas as funcionalidades organizadas por categorias. Clique nas categorias para expandir os submenus.");
      
      yPos += drawStep(yPos, 3, "Dashboard Principal", 
        "A tela inicial apresenta um resumo com estatisticas importantes: empresas ativas, socios, contribuicoes pendentes e saldo financeiro.");
      
      yPos += drawStep(yPos, 4, "Cadastro de Empresas", 
        "Acesse Empresas > Cadastro para adicionar novas empresas. Preencha CNPJ, razao social, contatos e endereco completo.");
      
      yPos += drawStep(yPos, 5, "Gestao de Contribuicoes", 
        "Em Contribuicoes > Gerenciamento voce pode visualizar, filtrar e atualizar o status de pagamento das contribuicoes.");
      
      yPos += drawStep(yPos, 6, "Relatorios", 
        "Acesse a area de Relatorios para gerar documentos personalizados com filtros por periodo, empresa ou status.");

      // Tips box
      yPos += 8;
      doc.setFillColor(...lightGray);
      doc.roundedRect(margin, yPos, contentWidth, 36, 2, 2, "F");
      doc.setFillColor(...accentColor);
      doc.rect(margin, yPos, 3, 36, "F");
      
      doc.setTextColor(...accentColor);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Dicas Importantes", margin + 10, yPos + 9);
      
      doc.setTextColor(...darkColor);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text("- Use os filtros de busca para encontrar informacoes rapidamente", margin + 10, yPos + 18);
      doc.text("- Exporte relatorios em PDF ou Excel conforme necessidade", margin + 10, yPos + 25);
      doc.text("- Mantenha os dados de contato das empresas sempre atualizados", margin + 10, yPos + 32);

      // =====================
      // PAGE 4 - MEDICAL PROFESSIONALS
      // =====================
      doc.addPage();
      drawHeader(4, "Guia para Profissionais de Saude");
      drawFooter();

      yPos = 36;

      // Medical header banner
      doc.setFillColor(...secondaryColor);
      doc.roundedRect(margin, yPos, contentWidth, 24, 3, 3, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Area Medica - Homologacoes e Atendimentos", pageWidth / 2, yPos + 15, { align: "center" });
      yPos += 32;

      yPos += drawStep(yPos, 1, "Agenda de Homologacoes", 
        "Acesse Homologacao > Agenda para visualizar e gerenciar os agendamentos. O calendario mostra todos os horarios disponiveis e ocupados.");
      
      yPos += drawStep(yPos, 2, "Cadastro de Profissionais", 
        "Em Homologacao > Profissionais, cadastre os medicos e especialistas que realizam atendimentos. Defina especialidades, horarios e salas.");
      
      yPos += drawStep(yPos, 3, "Servicos Oferecidos", 
        "Configure os tipos de servico disponiveis em Homologacao > Servicos. Defina duracao, valor e requisitos de cada procedimento.");
      
      yPos += drawStep(yPos, 4, "Bloqueios de Agenda", 
        "Use Homologacao > Bloqueios para definir periodos indisponiveis como ferias, feriados ou manutencao.");
      
      yPos += drawStep(yPos, 5, "Atendimento ao Paciente", 
        "Durante o atendimento, acesse o prontuario do paciente, registre observacoes e finalize a homologacao com assinatura digital.");

      // Medical tips box
      yPos += 6;
      doc.setFillColor(...lightGray);
      doc.roundedRect(margin, yPos, contentWidth, 32, 2, 2, "F");
      doc.setFillColor(...secondaryColor);
      doc.rect(margin, yPos, 3, 32, "F");
      
      doc.setTextColor(...secondaryColor);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Boas Praticas Medicas", margin + 10, yPos + 9);
      
      doc.setTextColor(...darkColor);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text("- Sempre verifique a identidade do paciente antes do atendimento", margin + 10, yPos + 17);
      doc.text("- Mantenha os registros medicos completos e atualizados", margin + 10, yPos + 24);
      doc.text("- Utilize a assinatura digital para validar documentos oficiais", margin + 10, yPos + 31);

      // =====================
      // PAGE 5 - FINANCIAL MODULE
      // =====================
      doc.addPage();
      drawHeader(5, "Modulo Financeiro");
      drawFooter();

      yPos = 36;

      doc.setTextColor(...primaryColor);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Gestao Financeira Completa", margin, yPos);
      yPos += 10;

      yPos += drawContentBox(yPos, "Visao Geral", [
        "Dashboard com metricas em tempo real",
        "Graficos de evolucao mensal",
        "Indicadores de desempenho (KPIs)"
      ], "V", primaryColor);

      yPos += drawContentBox(yPos, "Despesas e Receitas", [
        "Cadastro categorizado de lancamentos",
        "Anexo de comprovantes digitais",
        "Aprovacao em multiplos niveis"
      ], "D", redColor);

      yPos += drawContentBox(yPos, "Fluxo de Caixa", [
        "Projecao de entradas e saidas",
        "Alertas de saldo baixo",
        "Transferencias entre contas"
      ], "F", accentColor);

      yPos += drawContentBox(yPos, "Conciliacao Bancaria", [
        "Importacao de extratos OFX",
        "Conciliacao automatica",
        "Identificacao de divergencias"
      ], "B", secondaryColor);

      // =====================
      // PAGE 6 - LEGAL & NEGOTIATIONS
      // =====================
      doc.addPage();
      drawHeader(6, "Juridico e Negociacoes");
      drawFooter();

      yPos = 36;

      doc.setTextColor(...primaryColor);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Modulo Juridico", margin, yPos);
      yPos += 10;

      yPos += drawContentBox(yPos, "Gestao de Processos", [
        "Cadastro de acoes judiciais",
        "Acompanhamento de prazos processuais",
        "Vinculacao com advogados e escritorios"
      ], "P", [99, 102, 241]);

      yPos += drawContentBox(yPos, "Controle de Prazos", [
        "Alertas automaticos de vencimentos",
        "Calendario integrado",
        "Historico de movimentacoes"
      ], "Z", [236, 72, 153]);

      yPos += 8;

      doc.setTextColor(...secondaryColor);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Negociacoes e Parcelamentos", margin, yPos);
      yPos += 10;

      yPos += drawContentBox(yPos, "Acordos de Divida", [
        "Simulacao de parcelamentos",
        "Calculo de juros e correcoes",
        "Aprovacao digital de propostas"
      ], "A", amberColor);

      yPos += drawContentBox(yPos, "Acompanhamento", [
        "Status de pagamentos em tempo real",
        "Notificacoes de inadimplencia",
        "Renegociacao simplificada"
      ], "R", accentColor);

      // =====================
      // PAGE 7 - MOBILE APP & SUPPORT
      // =====================
      doc.addPage();
      drawHeader(7, "App Mobile e Suporte");
      drawFooter();

      yPos = 36;

      // Mobile app section header
      doc.setFillColor(...accentColor);
      doc.roundedRect(margin, yPos, contentWidth, 24, 3, 3, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Aplicativo para Socios", pageWidth / 2, yPos + 15, { align: "center" });
      yPos += 32;

      // App features list
      const appFeatures = [
        { title: "Carteirinha Digital", desc: "Identificacao do socio com QR Code" },
        { title: "Beneficios", desc: "Consulta e resgate de convenios" },
        { title: "Contribuicoes", desc: "Visualizacao de boletos e pagamentos" },
        { title: "Notificacoes", desc: "Avisos importantes em tempo real" }
      ];

      appFeatures.forEach((feat, i) => {
        const y = yPos + (i * 18);
        doc.setFillColor(...lightGray);
        doc.roundedRect(margin, y, contentWidth, 14, 2, 2, "F");
        
        // Checkmark circle
        doc.setFillColor(...accentColor);
        doc.circle(margin + 8, y + 7, 4, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text("OK", margin + 8, y + 9, { align: "center" });
        
        doc.setTextColor(...darkColor);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(feat.title, margin + 18, y + 9);
        
        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "normal");
        doc.text(feat.desc, margin + 60, y + 9);
      });

      yPos += 85;

      // Support section
      doc.setTextColor(...primaryColor);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Suporte e Ajuda", margin, yPos);
      yPos += 10;

      doc.setFillColor(...lightGray);
      doc.roundedRect(margin, yPos, contentWidth, 45, 3, 3, "F");
      
      doc.setTextColor(...darkColor);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Precisa de ajuda? Entre em contato conosco:", margin + 10, yPos + 12);
      
      doc.setFont("helvetica", "bold");
      doc.text("Telefone: 71 3144-9898", margin + 10, yPos + 23);
      doc.text("E-mail: suporte@eclini.com.br", margin + 10, yPos + 32);
      doc.text("Chat: Disponivel no sistema (horario comercial)", margin + 10, yPos + 41);

      // =====================
      // PAGE 8 - BACK COVER
      // =====================
      doc.addPage();
      
      // Dark background
      doc.setFillColor(...darkColor);
      doc.rect(0, 0, pageWidth, pageHeight, "F");
      
      // Decorative colored circles
      doc.setFillColor(...primaryColor);
      doc.circle(-15, 45, 50, "F");
      doc.setFillColor(...secondaryColor);
      doc.circle(pageWidth + 15, pageHeight - 45, 65, "F");

      // Logo
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', (pageWidth - 48) / 2, 48, 48, 24);
      }

      // Thank you message
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("Obrigado por escolher", pageWidth / 2, 95, { align: "center" });
      doc.text("o Eclini!", pageWidth / 2, 108, { align: "center" });

      // Closing message box with darker shade
      doc.setFillColor(55, 65, 81); // Slightly lighter than dark background
      doc.roundedRect(margin + 8, 125, contentWidth - 16, 42, 3, 3, "F");
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const closingText = "Este tutorial foi desenvolvido para facilitar o seu dia a dia. Em caso de duvidas, nossa equipe de suporte esta sempre pronta para ajudar.";
      const closingLines = doc.splitTextToSize(closingText, contentWidth - 36);
      doc.text(closingLines, pageWidth / 2, 142, { align: "center" });

      // Contact info card
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin + 18, 188, contentWidth - 36, 52, 3, 3, "F");
      
      doc.setTextColor(...darkColor);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Tecmax Tecnologia", pageWidth / 2, 205, { align: "center" });
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("71 3144-9898", pageWidth / 2, 218, { align: "center" });
      doc.text("www.eclini.com.br", pageWidth / 2, 230, { align: "center" });

      // Version footer
      doc.setTextColor(180, 180, 180);
      doc.setFontSize(8);
      doc.text("Tutorial v1.0 | Janeiro 2026", pageWidth / 2, pageHeight - 18, { align: "center" });

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
