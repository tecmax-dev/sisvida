import { Navigate, useParams, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, ArrowRight, Clock, Lightbulb, AlertCircle, Settings, Users, Shield, FileText } from "lucide-react";

const articles: Record<string, {
  title: string;
  description: string;
  readTime: string;
  content: React.ReactNode;
  prevArticle?: { slug: string; title: string };
  nextArticle?: { slug: string; title: string };
}> = {
  "configuracoes-gerais": {
    title: "Configurações Gerais",
    description: "Personalize as configurações básicas da sua clínica.",
    readTime: "4 min",
    content: (
      <div className="space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Acessando as Configurações</h2>
          <p className="text-muted-foreground mb-4">
            Para acessar as configurações da clínica, clique em <strong>Configurações</strong> no menu lateral.
          </p>
          <div className="bg-muted/50 rounded-lg p-4 border">
            <img 
              src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=400&fit=crop" 
              alt="Configurações gerais" 
              className="rounded-lg w-full"
            />
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Informações da Clínica</h2>
          <p className="text-muted-foreground mb-4">
            Na aba <strong>"Geral"</strong>, você pode configurar:
          </p>
          <div className="space-y-3">
            <div className="p-3 bg-muted/50 rounded-lg border">
              <h4 className="font-medium text-foreground">Nome e Logo</h4>
              <p className="text-sm text-muted-foreground">Identidade visual da clínica</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border">
              <h4 className="font-medium text-foreground">Endereço</h4>
              <p className="text-sm text-muted-foreground">Localização para documentos e agendamento online</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border">
              <h4 className="font-medium text-foreground">Contatos</h4>
              <p className="text-sm text-muted-foreground">Telefone, WhatsApp e e-mail</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border">
              <h4 className="font-medium text-foreground">CNPJ</h4>
              <p className="text-sm text-muted-foreground">Documento para emissão de notas</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Horário de Funcionamento</h2>
          <p className="text-muted-foreground mb-4">
            Configure os horários de abertura e fechamento da clínica. 
            Isso será usado no agendamento online e nos lembretes.
          </p>
        </section>

        <Alert className="border-primary/20 bg-primary/5">
          <Lightbulb className="h-4 w-4 text-primary" />
          <AlertDescription>
            <strong>Dica:</strong> Mantenha as informações sempre atualizadas, especialmente o WhatsApp, para que os lembretes funcionem corretamente.
          </AlertDescription>
        </Alert>
      </div>
    ),
    nextArticle: { slug: "usuarios-permissoes", title: "Usuários e Permissões" }
  },
  "usuarios-permissoes": {
    title: "Usuários e Permissões",
    description: "Gerencie os usuários e controle o acesso ao sistema.",
    readTime: "5 min",
    content: (
      <div className="space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Níveis de Acesso</h2>
          <p className="text-muted-foreground mb-4">
            O Eclini possui diferentes perfis de usuário com permissões específicas:
          </p>
          <div className="space-y-3">
            <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/20">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-5 w-5 text-red-600" />
                <h4 className="font-medium text-foreground">Administrador</h4>
              </div>
              <p className="text-sm text-muted-foreground">Acesso total a todas as funcionalidades</p>
            </div>
            <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-5 w-5 text-blue-600" />
                <h4 className="font-medium text-foreground">Recepcionista</h4>
              </div>
              <p className="text-sm text-muted-foreground">Agenda, pacientes e financeiro básico</p>
            </div>
            <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-5 w-5 text-green-600" />
                <h4 className="font-medium text-foreground">Profissional</h4>
              </div>
              <p className="text-sm text-muted-foreground">Atendimento e prontuário dos próprios pacientes</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Criando um Novo Usuário</h2>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-4">
            <li>Acesse <strong>Cadastros → Usuários</strong></li>
            <li>Clique em <strong>"Novo Usuário"</strong></li>
            <li>Preencha nome, e-mail e senha temporária</li>
            <li>Selecione o perfil de acesso</li>
            <li>Clique em <strong>"Salvar"</strong></li>
          </ol>
          <div className="bg-muted/50 rounded-lg p-4 border mt-4">
            <img 
              src="https://images.unsplash.com/photo-1560250097-0b93528c311a?w=800&h=400&fit=crop" 
              alt="Gerenciamento de usuários" 
              className="rounded-lg w-full"
            />
          </div>
        </section>

        <Alert className="border-amber-500/20 bg-amber-500/5">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            <strong>Importante:</strong> O usuário receberá um e-mail com as credenciais de acesso. 
            Recomende que ele altere a senha no primeiro acesso.
          </AlertDescription>
        </Alert>
      </div>
    ),
    prevArticle: { slug: "configuracoes-gerais", title: "Configurações Gerais" },
    nextArticle: { slug: "personalizando-documentos", title: "Personalizando Documentos" }
  },
  "personalizando-documentos": {
    title: "Personalizando Documentos",
    description: "Configure o layout de receitas, atestados e outros documentos.",
    readTime: "4 min",
    content: (
      <div className="space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Acessando a Configuração</h2>
          <p className="text-muted-foreground mb-4">
            Para personalizar os documentos, acesse <strong>Configurações → Documentos</strong>.
          </p>
          <div className="bg-muted/50 rounded-lg p-4 border">
            <img 
              src="https://images.unsplash.com/photo-1586281380117-5a60ae2050cc?w=800&h=400&fit=crop" 
              alt="Configuração de documentos" 
              className="rounded-lg w-full"
            />
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Opções de Personalização</h2>
          <div className="space-y-3">
            <div className="p-3 bg-muted/50 rounded-lg border">
              <h4 className="font-medium text-foreground">Cabeçalho</h4>
              <p className="text-sm text-muted-foreground">Logo, nome e dados da clínica</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border">
              <h4 className="font-medium text-foreground">Rodapé</h4>
              <p className="text-sm text-muted-foreground">Endereço, telefone e mensagem personalizada</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border">
              <h4 className="font-medium text-foreground">Tamanho do Papel</h4>
              <p className="text-sm text-muted-foreground">A4, A5 ou formato personalizado</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border">
              <h4 className="font-medium text-foreground">Elementos Visíveis</h4>
              <p className="text-sm text-muted-foreground">Escolha o que exibir em cada documento</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Templates por Tipo</h2>
          <p className="text-muted-foreground mb-4">
            Você pode configurar templates diferentes para cada tipo de documento:
          </p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
            <li>Receitas e prescrições</li>
            <li>Atestados médicos</li>
            <li>Declarações de comparecimento</li>
            <li>Solicitações de exames</li>
          </ul>
        </section>

        <Alert className="border-primary/20 bg-primary/5">
          <Lightbulb className="h-4 w-4 text-primary" />
          <AlertDescription>
            <strong>Dica:</strong> Use a pré-visualização para ver como o documento ficará antes de salvar as alterações.
          </AlertDescription>
        </Alert>
      </div>
    ),
    prevArticle: { slug: "usuarios-permissoes", title: "Usuários e Permissões" },
    nextArticle: { slug: "backup-seguranca", title: "Backup e Segurança" }
  },
  "backup-seguranca": {
    title: "Backup e Segurança",
    description: "Entenda como seus dados são protegidos e faça backups.",
    readTime: "4 min",
    content: (
      <div className="space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Segurança dos Dados</h2>
          <p className="text-muted-foreground mb-4">
            O Eclini utiliza as melhores práticas de segurança para proteger os dados da sua clínica:
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
              <Shield className="h-5 w-5 text-green-600 mb-2" />
              <h4 className="font-medium text-foreground">Criptografia</h4>
              <p className="text-sm text-muted-foreground">Dados criptografados em trânsito e em repouso</p>
            </div>
            <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
              <Shield className="h-5 w-5 text-green-600 mb-2" />
              <h4 className="font-medium text-foreground">Backups Automáticos</h4>
              <p className="text-sm text-muted-foreground">Backups diários com retenção de 30 dias</p>
            </div>
            <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
              <Shield className="h-5 w-5 text-green-600 mb-2" />
              <h4 className="font-medium text-foreground">Autenticação Segura</h4>
              <p className="text-sm text-muted-foreground">Senhas criptografadas e sessões seguras</p>
            </div>
            <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
              <Shield className="h-5 w-5 text-green-600 mb-2" />
              <h4 className="font-medium text-foreground">Auditoria</h4>
              <p className="text-sm text-muted-foreground">Registro de todas as ações dos usuários</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Exportando Dados</h2>
          <p className="text-muted-foreground mb-4">
            Você pode exportar seus dados a qualquer momento:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-4">
            <li>Acesse <strong>Configurações → Dados</strong></li>
            <li>Selecione o tipo de dados para exportar</li>
            <li>Escolha o período desejado</li>
            <li>Clique em <strong>"Exportar"</strong> para baixar em Excel</li>
          </ol>
        </section>

        <div className="bg-muted/50 rounded-lg p-4 border">
          <img 
            src="https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?w=800&h=400&fit=crop" 
            alt="Segurança de dados" 
            className="rounded-lg w-full"
          />
        </div>

        <Alert className="border-amber-500/20 bg-amber-500/5">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            <strong>Importante:</strong> Mantenha suas senhas seguras e não compartilhe com terceiros. 
            Use senhas fortes com letras, números e caracteres especiais.
          </AlertDescription>
        </Alert>
      </div>
    ),
    prevArticle: { slug: "personalizando-documentos", title: "Personalizando Documentos" }
  }
};

export default function ConfiguracoesArticle() {
  const { articleSlug } = useParams();
  
  if (!articleSlug || !articles[articleSlug]) {
    return <Navigate to="/ajuda/configuracoes" replace />;
  }

  const article = articles[articleSlug];

  return (
    <div className="space-y-8">
      <Link 
        to="/ajuda/configuracoes" 
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para Configurações
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
            to={`/ajuda/configuracoes/${article.prevArticle.slug}`}
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
            to={`/ajuda/configuracoes/${article.nextArticle.slug}`}
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
