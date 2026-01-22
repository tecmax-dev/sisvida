import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileText, Loader2, Building2, Users, Briefcase, Calculator, Zap, Shield, Globe, Smartphone, BarChart3, MessageSquare, Clock, CheckCircle } from "lucide-react";
import jsPDF from "jspdf";
import { toast } from "sonner";
import ecliniLogo from "@/assets/eclini-logo.png";

const ApresentacaoEcliniPage = () => {
  const [generating, setGenerating] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  // Load logo as base64 on mount
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
        console.error('Error loading logo:', error);
      }
    };
    loadLogo();
  }, []);

  const generatePDF = async () => {
    setGenerating(true);
    
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;

      // Colors
      const primaryColor: [number, number, number] = [32, 163, 158]; // Teal
      const secondaryColor: [number, number, number] = [15, 76, 76]; // Dark teal
      const accentColor: [number, number, number] = [255, 107, 107]; // Coral
      const textColor: [number, number, number] = [51, 51, 51];
      const lightGray: [number, number, number] = [245, 245, 245];

      // Helper functions
      const drawHeader = (pageNum: number) => {
        doc.setFillColor(...secondaryColor);
        doc.rect(0, 0, pageWidth, 25, 'F');
        
        // Add logo if available
        if (logoBase64) {
          try {
            doc.addImage(logoBase64, 'PNG', margin, 4, 35, 17);
          } catch (e) {
            console.error('Error adding logo to PDF:', e);
          }
        }
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('(71) 3144-9898', pageWidth - margin, 10, { align: 'right' });
        
        doc.setFontSize(8);
        doc.text(`Página ${pageNum} de 4`, pageWidth - margin, 17, { align: 'right' });
      };

      const drawFooter = () => {
        doc.setFillColor(...primaryColor);
        doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.text('www.tecmaxtecnologia.com.br | contato@tecmaxtecnologia.com.br | (71) 3144-9898', pageWidth / 2, pageHeight - 5, { align: 'center' });
      };

      const drawCard = (x: number, y: number, w: number, h: number, title: string, items: string[], iconColor: [number, number, number]) => {
        // Card background
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(x, y, w, h, 3, 3, 'F');
        
        // Card border
        doc.setDrawColor(...iconColor);
        doc.setLineWidth(0.5);
        doc.roundedRect(x, y, w, h, 3, 3, 'S');
        
        // Icon circle
        doc.setFillColor(...iconColor);
        doc.circle(x + 8, y + 10, 5, 'F');
        
        // Title
        doc.setTextColor(...secondaryColor);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(title, x + 16, y + 12);
        
        // Items
        doc.setTextColor(...textColor);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        let itemY = y + 22;
        items.forEach(item => {
          doc.setFillColor(...primaryColor);
          doc.circle(x + 6, itemY - 1.5, 1.5, 'F');
          doc.text(item, x + 10, itemY);
          itemY += 7;
        });
      };

      // ========== PAGE 1 - CAPA ==========
      drawHeader(1);
      
      // Main title area
      doc.setFillColor(...lightGray);
      doc.rect(0, 25, pageWidth, pageHeight - 37, 'F');
      
      // Decorative element
      doc.setFillColor(...primaryColor);
      doc.rect(margin, 45, 8, 50, 'F');
      
      // Main title
      doc.setTextColor(...secondaryColor);
      doc.setFontSize(42);
      doc.setFont('helvetica', 'bold');
      doc.text('ECLINI', margin + 15, 70);
      
      doc.setFontSize(18);
      doc.setTextColor(...primaryColor);
      doc.text('Sistema de Gestão Sindical Inteligente', margin + 15, 82);
      
      // Subtitle
      doc.setTextColor(...textColor);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text('Proposta de Implantação para o', margin + 15, 100);
      
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...secondaryColor);
      doc.text('SINDICATO DOS COMERCIÁRIOS', margin + 15, 112);
      
      // Features highlight boxes
      const features = [
        { title: 'HÍBRIDO', desc: 'Web + Mobile' },
        { title: 'INTELIGENTE', desc: 'IA Integrada' },
        { title: 'INTEGRADO', desc: 'Multi-plataforma' },
        { title: 'SEGURO', desc: 'Dados Protegidos' }
      ];
      
      let boxX = margin + 15;
      features.forEach((feat, idx) => {
        doc.setFillColor(...primaryColor);
        doc.roundedRect(boxX, 125, 55, 35, 3, 3, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(feat.title, boxX + 27.5, 140, { align: 'center' });
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(feat.desc, boxX + 27.5, 150, { align: 'center' });
        
        boxX += 60;
      });
      
      // Company info box with logo
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(pageWidth - 105, 45, 90, 55, 3, 3, 'F');
      doc.setDrawColor(...primaryColor);
      doc.setLineWidth(1);
      doc.roundedRect(pageWidth - 105, 45, 90, 55, 3, 3, 'S');
      
      // Add logo in the company box
      if (logoBase64) {
        try {
          doc.addImage(logoBase64, 'PNG', pageWidth - 95, 50, 70, 30);
        } catch (e) {
          console.error('Error adding logo to company box:', e);
        }
      }
      
      doc.setTextColor(...secondaryColor);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('(71) 3144-9898', pageWidth - 60, 90, { align: 'center' });
      
      drawFooter();

      // ========== PAGE 2 - MÓDULOS ==========
      doc.addPage();
      drawHeader(2);
      
      doc.setFillColor(...lightGray);
      doc.rect(0, 25, pageWidth, pageHeight - 37, 'F');
      
      // Section title
      doc.setTextColor(...secondaryColor);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('Módulos e Funcionalidades Completas', margin, 40);
      
      doc.setTextColor(...textColor);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Sistema completo para gestão integral do sindicato, empresas associadas e membros', margin, 48);
      
      // Module cards - Row 1
      drawCard(margin, 55, 85, 55, 'Gestão de Membros', [
        'Cadastro completo de filiados',
        'Dependentes e beneficiários',
        'Carteirinha digital com QR Code',
        'Histórico e documentação'
      ], primaryColor);
      
      drawCard(margin + 90, 55, 85, 55, 'Empresas Associadas', [
        'Cadastro de empregadores',
        'Vínculos trabalhistas',
        'Gestão de contribuições',
        'Portal do empregador'
      ], accentColor);
      
      drawCard(margin + 180, 55, 85, 55, 'Financeiro Completo', [
        'Contribuições sindicais',
        'Boletos e cobranças',
        'Relatórios financeiros',
        'Integração bancária'
      ], [107, 203, 119]);
      
      // Module cards - Row 2
      drawCard(margin, 115, 85, 55, 'Jurídico', [
        'Processos trabalhistas',
        'Advogados e escritórios',
        'Prazos e compromissos',
        'Provisões e custos'
      ], [255, 193, 7]);
      
      drawCard(margin + 90, 115, 85, 55, 'Benefícios', [
        'Convênios e parcerias',
        'Autorizações digitais',
        'Controle de uso',
        'Validação por QR Code'
      ], [156, 39, 176]);
      
      drawCard(margin + 180, 115, 85, 55, 'Contabilidades', [
        'Portal do contador',
        'Acesso dedicado',
        'Gestão de clientes',
        'Relatórios específicos'
      ], [33, 150, 243]);
      
      drawFooter();

      // ========== PAGE 3 - DIFERENCIAIS ==========
      doc.addPage();
      drawHeader(3);
      
      doc.setFillColor(...lightGray);
      doc.rect(0, 25, pageWidth, pageHeight - 37, 'F');
      
      // Section title
      doc.setTextColor(...secondaryColor);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('Sistema Híbrido e Ultra Inteligente', margin, 40);
      
      // Left column - Hybrid System
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin, 50, 130, 110, 5, 5, 'F');
      
      doc.setFillColor(...primaryColor);
      doc.roundedRect(margin, 50, 130, 20, 5, 5, 'F');
      doc.rect(margin, 60, 130, 10, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('🌐 SISTEMA HÍBRIDO', margin + 65, 63, { align: 'center' });
      
      const hybridFeatures = [
        '✓ Acesso via Web em qualquer navegador',
        '✓ Aplicativo Mobile (iOS e Android)',
        '✓ Sincronização em tempo real',
        '✓ Funciona offline com sync automático',
        '✓ Interface responsiva e adaptativa',
        '✓ Notificações push instantâneas',
        '✓ Dashboard personalizado por perfil'
      ];
      
      doc.setTextColor(...textColor);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      let featureY = 80;
      hybridFeatures.forEach(feat => {
        doc.text(feat, margin + 8, featureY);
        featureY += 10;
      });
      
      // Right column - Integrations
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin + 140, 50, 130, 110, 5, 5, 'F');
      
      doc.setFillColor(...accentColor);
      doc.roundedRect(margin + 140, 50, 130, 20, 5, 5, 'F');
      doc.rect(margin + 140, 60, 130, 10, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('🔗 INTEGRAÇÕES', margin + 205, 63, { align: 'center' });
      
      const integrations = [
        '✓ WhatsApp Business API',
        '✓ Bancos (boletos e PIX)',
        '✓ E-mail automatizado',
        '✓ Importação de dados (Excel/CSV)',
        '✓ API para sistemas externos',
        '✓ Inteligência Artificial (IA)',
        '✓ Geração automática de documentos'
      ];
      
      doc.setTextColor(...textColor);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      featureY = 80;
      integrations.forEach(int => {
        doc.text(int, margin + 148, featureY);
        featureY += 10;
      });
      
      drawFooter();

      // ========== PAGE 4 - BENEFÍCIOS ==========
      doc.addPage();
      drawHeader(4);
      
      doc.setFillColor(...lightGray);
      doc.rect(0, 25, pageWidth, pageHeight - 37, 'F');
      
      // Section title
      doc.setTextColor(...secondaryColor);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('Impacto e Benefícios para Todos', margin, 40);
      
      // Three columns for stakeholders
      const colWidth = 85;
      
      // Column 1 - Sindicato
      doc.setFillColor(...primaryColor);
      doc.roundedRect(margin, 50, colWidth, 15, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('PARA O SINDICATO', margin + colWidth/2, 60, { align: 'center' });
      
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin, 65, colWidth, 80, 3, 3, 'F');
      
      const sindicatoItems = [
        '• Gestão centralizada',
        '• Redução de custos operacionais',
        '• Relatórios em tempo real',
        '• Controle financeiro preciso',
        '• Comunicação eficiente',
        '• Menos trabalho manual',
        '• Decisões baseadas em dados',
        '• Auditoria completa'
      ];
      
      doc.setTextColor(...textColor);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      let itemY = 75;
      sindicatoItems.forEach(item => {
        doc.text(item, margin + 5, itemY);
        itemY += 9;
      });
      
      // Column 2 - Empresas
      doc.setFillColor(...accentColor);
      doc.roundedRect(margin + 90, 50, colWidth, 15, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('PARA AS EMPRESAS', margin + 90 + colWidth/2, 60, { align: 'center' });
      
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin + 90, 65, colWidth, 80, 3, 3, 'F');
      
      const empresasItems = [
        '• Portal de autoatendimento',
        '• Boletos digitais automáticos',
        '• Histórico de contribuições',
        '• Acesso 24/7',
        '• Redução de burocracia',
        '• Comunicação direta',
        '• Comprovantes digitais',
        '• Gestão de funcionários'
      ];
      
      doc.setTextColor(...textColor);
      itemY = 75;
      empresasItems.forEach(item => {
        doc.text(item, margin + 95, itemY);
        itemY += 9;
      });
      
      // Column 3 - Associados
      doc.setFillColor(107, 203, 119);
      doc.roundedRect(margin + 180, 50, colWidth, 15, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('PARA OS ASSOCIADOS', margin + 180 + colWidth/2, 60, { align: 'center' });
      
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin + 180, 65, colWidth, 80, 3, 3, 'F');
      
      const associadosItems = [
        '• Carteirinha digital',
        '• Acesso aos benefícios',
        '• Consulta de convênios',
        '• Validação por QR Code',
        '• Atendimento via WhatsApp',
        '• Notificações importantes',
        '• Histórico completo',
        '• App mobile exclusivo'
      ];
      
      doc.setTextColor(...textColor);
      itemY = 75;
      associadosItems.forEach(item => {
        doc.text(item, margin + 185, itemY);
        itemY += 9;
      });
      
      // CTA Box
      doc.setFillColor(...secondaryColor);
      doc.roundedRect(margin, 150, pageWidth - 2*margin, 25, 5, 5, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Entre em contato e agende uma demonstração!', pageWidth/2, 162, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text('TECMAX TECNOLOGIA | (71) 3144-9898 | contato@tecmaxtecnologia.com.br', pageWidth/2, 172, { align: 'center' });
      
      drawFooter();

      // Save PDF
      doc.save('Apresentacao_Eclini_Sindicato_Comerciarios.pdf');
      toast.success('PDF gerado com sucesso!');
      
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar o PDF');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-primary">
            Apresentação Sistema Eclini
          </h1>
          <p className="text-xl text-muted-foreground">
            Proposta para o Sindicato dos Comerciários
          </p>
          <p className="text-muted-foreground">
            Tecmax Tecnologia | (71) 3144-9898
          </p>
        </div>

        {/* Download Button */}
        <div className="flex justify-center">
          <Button 
            size="lg" 
            onClick={generatePDF} 
            disabled={generating}
            className="bg-primary hover:bg-primary/90 text-lg px-8 py-6"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Gerando PDF...
              </>
            ) : (
              <>
                <Download className="mr-2 h-5 w-5" />
                Baixar Apresentação em PDF
              </>
            )}
          </Button>
        </div>

        {/* Preview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-primary/20 hover:border-primary/50 transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-primary" />
                Página 1
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Capa institucional com apresentação do Sistema Eclini e destaques principais.
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 hover:border-primary/50 transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="h-5 w-5 text-primary" />
                Página 2
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Módulos completos: Membros, Empresas, Financeiro, Jurídico, Benefícios e Contabilidades.
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 hover:border-primary/50 transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="h-5 w-5 text-primary" />
                Página 3
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Sistema híbrido (Web + Mobile) e integrações inteligentes com WhatsApp, bancos e IA.
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 hover:border-primary/50 transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-primary" />
                Página 4
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Benefícios para todas as partes: Sindicato, Empresas e Associados.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Globe, label: 'Sistema Web' },
            { icon: Smartphone, label: 'App Mobile' },
            { icon: MessageSquare, label: 'WhatsApp' },
            { icon: Shield, label: 'Segurança' },
            { icon: BarChart3, label: 'Relatórios' },
            { icon: Clock, label: 'Tempo Real' },
            { icon: Calculator, label: 'Financeiro' },
            { icon: CheckCircle, label: 'Automação' },
          ].map((item, idx) => (
            <div 
              key={idx}
              className="flex items-center gap-3 p-4 bg-card rounded-lg border border-border/50"
            >
              <item.icon className="h-6 w-6 text-primary" />
              <span className="font-medium">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ApresentacaoEcliniPage;
