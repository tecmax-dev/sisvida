import { Navigate, useParams, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, ArrowRight, Clock, Lightbulb, AlertCircle, CheckCircle2 } from "lucide-react";
import dashboardMockup from "@/assets/dashboard-mockup.png";
import heroMockup from "@/assets/hero-mockup.png";

const articles: Record<string, {
  title: string;
  description: string;
  readTime: string;
  content: React.ReactNode;
  prevArticle?: { slug: string; title: string };
  nextArticle?: { slug: string; title: string };
}> = {
  "fluxo-atendimento": {
    title: "Fluxo de Atendimento",
    description: "Entenda o fluxo completo de atendimento ao paciente no sistema.",
    readTime: "5 min",
    content: (
      <div className="space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Etapas do Atendimento</h2>
          <p className="text-muted-foreground mb-4">
            O fluxo de atendimento no Eclini segue as seguintes etapas:
          </p>
          <div className="space-y-3">
            <div className="flex items-start gap-4 p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white font-bold text-sm">1</span>
              <div>
                <h4 className="font-medium text-foreground">Chegada do Paciente</h4>
                <p className="text-sm text-muted-foreground">Paciente chega e é marcado como "Aguardando" na agenda</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500 text-white font-bold text-sm">2</span>
              <div>
                <h4 className="font-medium text-foreground">Pré-Atendimento</h4>
                <p className="text-sm text-muted-foreground">Coleta de sinais vitais e triagem inicial</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-green-500/10 rounded-lg border border-green-500/20">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500 text-white font-bold text-sm">3</span>
              <div>
                <h4 className="font-medium text-foreground">Atendimento</h4>
                <p className="text-sm text-muted-foreground">Consulta com o profissional e registro no prontuário</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-500 text-white font-bold text-sm">4</span>
              <div>
                <h4 className="font-medium text-foreground">Finalização</h4>
                <p className="text-sm text-muted-foreground">Emissão de documentos, pagamento e agendamento de retorno</p>
              </div>
            </div>
          </div>
        </section>

        <div className="bg-muted/50 rounded-lg p-4 border">
          <img 
            src={dashboardMockup} 
            alt="Dashboard Eclini - Fluxo de Atendimento" 
            className="rounded-lg w-full"
          />
        </div>

        <Alert className="border-primary/20 bg-primary/5">
          <Lightbulb className="h-4 w-4 text-primary" />
          <AlertDescription>
            <strong>Dica:</strong> Use a tela de Atendimento para ter acesso rápido a todas as informações do paciente durante a consulta.
          </AlertDescription>
        </Alert>
      </div>
    ),
    nextArticle: { slug: "iniciando-consulta", title: "Iniciando uma Consulta" }
  },
  "iniciando-consulta": {
    title: "Iniciando uma Consulta",
    description: "Como iniciar o atendimento de um paciente agendado.",
    readTime: "4 min",
    content: (
      <div className="space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Iniciando o Atendimento</h2>
          <p className="text-muted-foreground mb-4">
            Para iniciar uma consulta, você tem duas opções:
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg border">
              <h4 className="font-medium text-foreground mb-2">Via Agenda</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Acesse a Agenda</li>
                <li>Localize o agendamento</li>
                <li>Clique em "Iniciar Atendimento"</li>
              </ol>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg border">
              <h4 className="font-medium text-foreground mb-2">Via Fila de Espera</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Acesse a Fila</li>
                <li>Veja pacientes aguardando</li>
                <li>Clique em "Chamar"</li>
              </ol>
            </div>
          </div>
        </section>

        <div className="bg-muted/50 rounded-lg p-4 border">
          <img 
            src="/docs/tela-home.png" 
            alt="Tela de Agenda Eclini" 
            className="rounded-lg w-full"
          />
        </div>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Tela de Atendimento</h2>
          <p className="text-muted-foreground mb-4">
            Ao iniciar o atendimento, você terá acesso a:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>Dados do paciente e histórico</li>
            <li>Anamnese e evoluções anteriores</li>
            <li>Campo para registrar a evolução atual</li>
            <li>Emissão de prescrições e atestados</li>
            <li>Solicitação de exames</li>
          </ul>
        </section>

        <Alert className="border-amber-500/20 bg-amber-500/5">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            <strong>Importante:</strong> Todas as alterações são salvas automaticamente para evitar perda de dados.
          </AlertDescription>
        </Alert>
      </div>
    ),
    prevArticle: { slug: "fluxo-atendimento", title: "Fluxo de Atendimento" },
    nextArticle: { slug: "prescricoes-receitas", title: "Prescrições e Receitas" }
  },
  "prescricoes-receitas": {
    title: "Prescrições e Receitas",
    description: "Aprenda a emitir prescrições médicas e receitas de controle especial.",
    readTime: "5 min",
    content: (
      <div className="space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Tipos de Prescrição</h2>
          <p className="text-muted-foreground mb-4">
            O sistema permite emitir diferentes tipos de prescrições:
          </p>
          <div className="space-y-3">
            <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <h4 className="font-medium text-foreground">📋 Receita Simples</h4>
              <p className="text-sm text-muted-foreground">Para medicamentos sem controle especial</p>
            </div>
            <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <h4 className="font-medium text-foreground">📑 Receita de Controle Especial</h4>
              <p className="text-sm text-muted-foreground">Para medicamentos controlados (tarja preta/vermelha)</p>
            </div>
            <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
              <h4 className="font-medium text-foreground">🔵 Receita Azul (B)</h4>
              <p className="text-sm text-muted-foreground">Para psicotrópicos e substâncias da lista B</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Emitindo uma Prescrição</h2>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-4">
            <li>Na tela de atendimento, clique em <strong>"Prescrição"</strong></li>
            <li>Busque o medicamento pelo nome</li>
            <li>Informe posologia, quantidade e orientações</li>
            <li>Adicione mais medicamentos se necessário</li>
            <li>Clique em <strong>"Gerar Receita"</strong> para imprimir</li>
          </ol>
          <div className="bg-muted/50 rounded-lg p-4 border mt-4">
            <img 
              src={heroMockup} 
              alt="Tela de Prescrição Eclini" 
              className="rounded-lg w-full"
            />
          </div>
        </section>

        <Alert className="border-primary/20 bg-primary/5">
          <Lightbulb className="h-4 w-4 text-primary" />
          <AlertDescription>
            <strong>Dica:</strong> O sistema possui uma base com milhares de medicamentos. Basta digitar as primeiras letras para buscar.
          </AlertDescription>
        </Alert>
      </div>
    ),
    prevArticle: { slug: "iniciando-consulta", title: "Iniciando uma Consulta" },
    nextArticle: { slug: "atestados-documentos", title: "Atestados e Documentos" }
  },
  "atestados-documentos": {
    title: "Atestados e Documentos",
    description: "Emissão de atestados médicos, declarações e outros documentos.",
    readTime: "4 min",
    content: (
      <div className="space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Documentos Disponíveis</h2>
          <p className="text-muted-foreground mb-4">
            O Eclini permite emitir diversos tipos de documentos durante o atendimento:
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="p-3 bg-muted/50 rounded-lg border">
              <CheckCircle2 className="h-5 w-5 text-green-500 mb-2" />
              <h4 className="font-medium text-foreground">Atestado Médico</h4>
              <p className="text-sm text-muted-foreground">Com CID opcional</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border">
              <CheckCircle2 className="h-5 w-5 text-green-500 mb-2" />
              <h4 className="font-medium text-foreground">Declaração de Comparecimento</h4>
              <p className="text-sm text-muted-foreground">Comprovante de presença</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border">
              <CheckCircle2 className="h-5 w-5 text-green-500 mb-2" />
              <h4 className="font-medium text-foreground">Solicitação de Exames</h4>
              <p className="text-sm text-muted-foreground">Laboratoriais e de imagem</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border">
              <CheckCircle2 className="h-5 w-5 text-green-500 mb-2" />
              <h4 className="font-medium text-foreground">Laudos e Relatórios</h4>
              <p className="text-sm text-muted-foreground">Documentos personalizados</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Emitindo um Atestado</h2>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-4">
            <li>Na tela de atendimento, clique em <strong>"Atestado"</strong></li>
            <li>Selecione o tipo de documento</li>
            <li>Preencha os dados (dias de afastamento, CID, etc.)</li>
            <li>Clique em <strong>"Gerar"</strong> para visualizar e imprimir</li>
          </ol>
          <div className="bg-muted/50 rounded-lg p-4 border mt-4">
            <img 
              src={dashboardMockup} 
              alt="Emissão de documentos Eclini" 
              className="rounded-lg w-full"
            />
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Personalizando Documentos</h2>
          <p className="text-muted-foreground mb-4">
            Você pode personalizar o cabeçalho e rodapé dos documentos em{" "}
            <strong>Configurações → Documentos</strong>. Adicione logo, informações de contato e texto personalizado.
          </p>
        </section>

        <Alert className="border-primary/20 bg-primary/5">
          <Lightbulb className="h-4 w-4 text-primary" />
          <AlertDescription>
            <strong>Dica:</strong> Todos os documentos emitidos ficam salvos automaticamente no prontuário do paciente.
          </AlertDescription>
        </Alert>
      </div>
    ),
    prevArticle: { slug: "prescricoes-receitas", title: "Prescrições e Receitas" }
  }
};

export default function AtendimentoArticle() {
  const { articleSlug } = useParams();
  
  if (!articleSlug || !articles[articleSlug]) {
    return <Navigate to="/ajuda/atendimento" replace />;
  }

  const article = articles[articleSlug];

  return (
    <div className="space-y-8">
      <Link 
        to="/ajuda/atendimento" 
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para Atendimento
      </Link>

      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-3">
          {article.title}
        </h1>
        <p className="text-lg text-muted-foreground mb-4">
          {article.description}
        </p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Tempo de leitura: {article.readTime}</span>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 lg:p-8">
          {article.content}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between pt-4 border-t">
        {article.prevArticle ? (
          <Link
            to={`/ajuda/atendimento/${article.prevArticle.slug}`}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{article.prevArticle.title}</span>
          </Link>
        ) : (
          <div />
        )}
        
        {article.nextArticle && (
          <Link
            to={`/ajuda/atendimento/${article.nextArticle.slug}`}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <span>{article.nextArticle.title}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
