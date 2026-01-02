import { Navigate, useParams, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, ArrowRight, Clock, Lightbulb, AlertCircle, CheckCircle2 } from "lucide-react";

const articles: Record<string, {
  title: string;
  description: string;
  readTime: string;
  content: React.ReactNode;
  prevArticle?: { slug: string; title: string };
  nextArticle?: { slug: string; title: string };
}> = {
  "cadastrando-pacientes": {
    title: "Cadastrando Pacientes",
    description: "Aprenda a cadastrar novos pacientes no sistema de forma rápida e completa.",
    readTime: "4 min",
    content: (
      <div className="space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Acesso ao Cadastro</h2>
          <p className="text-muted-foreground mb-4">
            Para cadastrar um novo paciente, acesse o menu <strong>Cadastros → Pacientes</strong> e clique no botão <strong>"Novo Paciente"</strong>.
          </p>
          <div className="bg-muted/50 rounded-lg p-4 border">
            <img 
              src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&h=400&fit=crop" 
              alt="Tela de cadastro de pacientes" 
              className="rounded-lg w-full"
            />
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Dados Obrigatórios</h2>
          <p className="text-muted-foreground mb-4">
            Os campos essenciais para o cadastro são:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li><strong>Nome completo</strong> - Nome do paciente</li>
            <li><strong>CPF</strong> - Documento de identificação</li>
            <li><strong>Data de nascimento</strong> - Para cálculo de idade</li>
            <li><strong>Telefone/WhatsApp</strong> - Para contato e lembretes</li>
            <li><strong>E-mail</strong> - Para comunicações (opcional)</li>
          </ul>
        </section>

        <Alert className="border-primary/20 bg-primary/5">
          <Lightbulb className="h-4 w-4 text-primary" />
          <AlertDescription>
            <strong>Dica:</strong> Ao digitar o CEP, o sistema preenche automaticamente o endereço completo!
          </AlertDescription>
        </Alert>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Cadastro Rápido</h2>
          <p className="text-muted-foreground mb-4">
            Para agilizar o atendimento, você pode usar o <strong>Cadastro Rápido</strong> diretamente na tela de agendamento. 
            Basta clicar em "Novo Paciente" e preencher apenas os dados essenciais.
          </p>
          <div className="bg-muted/50 rounded-lg p-4 border">
            <img 
              src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&h=400&fit=crop" 
              alt="Cadastro rápido de paciente" 
              className="rounded-lg w-full"
            />
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Informações Adicionais</h2>
          <p className="text-muted-foreground mb-4">
            Além dos dados básicos, você pode registrar:
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="p-3 bg-muted/50 rounded-lg border">
              <CheckCircle2 className="h-5 w-5 text-green-500 mb-2" />
              <h4 className="font-medium text-foreground">Convênio</h4>
              <p className="text-sm text-muted-foreground">Plano de saúde e número da carteira</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border">
              <CheckCircle2 className="h-5 w-5 text-green-500 mb-2" />
              <h4 className="font-medium text-foreground">Responsável</h4>
              <p className="text-sm text-muted-foreground">Para pacientes menores de idade</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border">
              <CheckCircle2 className="h-5 w-5 text-green-500 mb-2" />
              <h4 className="font-medium text-foreground">Foto</h4>
              <p className="text-sm text-muted-foreground">Foto para identificação visual</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border">
              <CheckCircle2 className="h-5 w-5 text-green-500 mb-2" />
              <h4 className="font-medium text-foreground">Observações</h4>
              <p className="text-sm text-muted-foreground">Notas importantes sobre o paciente</p>
            </div>
          </div>
        </section>
      </div>
    ),
    nextArticle: { slug: "prontuario-eletronico", title: "Prontuário Eletrônico" }
  },
  "prontuario-eletronico": {
    title: "Prontuário Eletrônico",
    description: "Como acessar e gerenciar o prontuário eletrônico dos pacientes.",
    readTime: "5 min",
    content: (
      <div className="space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Acessando o Prontuário</h2>
          <p className="text-muted-foreground mb-4">
            O prontuário eletrônico pode ser acessado de duas formas:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-4">
            <li>Na lista de pacientes, clique no ícone de prontuário ao lado do nome</li>
            <li>Durante o atendimento, acesse a aba "Prontuário" no painel do paciente</li>
          </ol>
          <div className="bg-muted/50 rounded-lg p-4 border mt-4">
            <img 
              src="https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800&h=400&fit=crop" 
              alt="Prontuário eletrônico" 
              className="rounded-lg w-full"
            />
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Estrutura do Prontuário</h2>
          <p className="text-muted-foreground mb-4">
            O prontuário é organizado em seções:
          </p>
          <div className="space-y-3">
            <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <h4 className="font-medium text-foreground">📋 Anamnese</h4>
              <p className="text-sm text-muted-foreground">Histórico médico, alergias e medicamentos em uso</p>
            </div>
            <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
              <h4 className="font-medium text-foreground">📝 Evoluções</h4>
              <p className="text-sm text-muted-foreground">Registros de cada consulta realizada</p>
            </div>
            <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
              <h4 className="font-medium text-foreground">💊 Prescrições</h4>
              <p className="text-sm text-muted-foreground">Receitas e orientações médicas</p>
            </div>
            <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <h4 className="font-medium text-foreground">📎 Anexos</h4>
              <p className="text-sm text-muted-foreground">Exames, laudos e documentos</p>
            </div>
          </div>
        </section>

        <Alert className="border-amber-500/20 bg-amber-500/5">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            <strong>Importante:</strong> Todas as alterações no prontuário são registradas com data, hora e usuário responsável para auditoria.
          </AlertDescription>
        </Alert>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Adicionando Evoluções</h2>
          <p className="text-muted-foreground mb-4">
            Durante o atendimento, você pode adicionar evoluções clicando no botão <strong>"Nova Evolução"</strong>.
            O sistema permite usar templates personalizados para agilizar o registro.
          </p>
        </section>
      </div>
    ),
    prevArticle: { slug: "cadastrando-pacientes", title: "Cadastrando Pacientes" },
    nextArticle: { slug: "anexos-documentos", title: "Anexos e Documentos" }
  },
  "anexos-documentos": {
    title: "Anexos e Documentos",
    description: "Gerencie exames, laudos e documentos dos pacientes de forma organizada.",
    readTime: "4 min",
    content: (
      <div className="space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Enviando Anexos</h2>
          <p className="text-muted-foreground mb-4">
            Para anexar documentos ao prontuário do paciente:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-4">
            <li>Acesse o cadastro do paciente</li>
            <li>Clique na aba <strong>"Anexos"</strong></li>
            <li>Clique em <strong>"Enviar Arquivo"</strong></li>
            <li>Selecione o arquivo e escolha a pasta de destino</li>
          </ol>
          <div className="bg-muted/50 rounded-lg p-4 border mt-4">
            <img 
              src="https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=800&h=400&fit=crop" 
              alt="Upload de anexos" 
              className="rounded-lg w-full"
            />
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Organizando em Pastas</h2>
          <p className="text-muted-foreground mb-4">
            O sistema permite organizar os anexos em pastas personalizadas:
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="p-3 bg-muted/50 rounded-lg border text-center">
              <span className="text-2xl">🔬</span>
              <p className="text-sm font-medium mt-1">Exames</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border text-center">
              <span className="text-2xl">📄</span>
              <p className="text-sm font-medium mt-1">Laudos</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border text-center">
              <span className="text-2xl">📸</span>
              <p className="text-sm font-medium mt-1">Imagens</p>
            </div>
          </div>
        </section>

        <Alert className="border-primary/20 bg-primary/5">
          <Lightbulb className="h-4 w-4 text-primary" />
          <AlertDescription>
            <strong>Dica:</strong> Você pode criar pastas personalizadas clicando em "Nova Pasta" para organizar os documentos da forma que preferir.
          </AlertDescription>
        </Alert>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Formatos Suportados</h2>
          <p className="text-muted-foreground mb-4">
            O sistema aceita os seguintes formatos de arquivo:
          </p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
            <li>Imagens: JPG, PNG, GIF, WEBP</li>
            <li>Documentos: PDF, DOC, DOCX</li>
            <li>Tamanho máximo: 10MB por arquivo</li>
          </ul>
        </section>
      </div>
    ),
    prevArticle: { slug: "prontuario-eletronico", title: "Prontuário Eletrônico" },
    nextArticle: { slug: "historico-atendimentos", title: "Histórico de Atendimentos" }
  },
  "historico-atendimentos": {
    title: "Histórico de Atendimentos",
    description: "Visualize todo o histórico de consultas e procedimentos do paciente.",
    readTime: "3 min",
    content: (
      <div className="space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Visualizando o Histórico</h2>
          <p className="text-muted-foreground mb-4">
            O histórico completo de atendimentos pode ser acessado no cadastro do paciente, 
            na aba <strong>"Agendamentos"</strong>.
          </p>
          <div className="bg-muted/50 rounded-lg p-4 border">
            <img 
              src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=400&fit=crop" 
              alt="Histórico de atendimentos" 
              className="rounded-lg w-full"
            />
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Informações Exibidas</h2>
          <p className="text-muted-foreground mb-4">
            Para cada atendimento, você pode visualizar:
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-xl">📅</span>
              <div>
                <p className="font-medium text-foreground">Data e Horário</p>
                <p className="text-sm text-muted-foreground">Quando a consulta ocorreu</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-xl">👨‍⚕️</span>
              <div>
                <p className="font-medium text-foreground">Profissional</p>
                <p className="text-sm text-muted-foreground">Quem realizou o atendimento</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-xl">🏥</span>
              <div>
                <p className="font-medium text-foreground">Procedimento</p>
                <p className="text-sm text-muted-foreground">Tipo de consulta ou procedimento</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-xl">✅</span>
              <div>
                <p className="font-medium text-foreground">Status</p>
                <p className="text-sm text-muted-foreground">Se foi realizado, cancelado ou faltou</p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Filtros e Busca</h2>
          <p className="text-muted-foreground mb-4">
            Utilize os filtros para encontrar atendimentos específicos por período, profissional ou status.
          </p>
        </section>
      </div>
    ),
    prevArticle: { slug: "anexos-documentos", title: "Anexos e Documentos" }
  }
};

export default function PacientesArticle() {
  const { articleSlug } = useParams();
  
  if (!articleSlug || !articles[articleSlug]) {
    return <Navigate to="/ajuda/pacientes" replace />;
  }

  const article = articles[articleSlug];

  return (
    <div className="space-y-8">
      {/* Back link */}
      <Link 
        to="/ajuda/pacientes" 
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para Pacientes
      </Link>

      {/* Article header */}
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

      {/* Article content */}
      <Card>
        <CardContent className="p-6 lg:p-8">
          {article.content}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t">
        {article.prevArticle ? (
          <Link
            to={`/ajuda/pacientes/${article.prevArticle.slug}`}
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
            to={`/ajuda/pacientes/${article.nextArticle.slug}`}
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
