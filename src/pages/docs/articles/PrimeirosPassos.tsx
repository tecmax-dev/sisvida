import { Link, useParams, Navigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Lightbulb, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import heroMockup from "@/assets/hero-mockup.png";
import dashboardMockup from "@/assets/dashboard-mockup.png";
import heroScreens from "@/assets/hero-mockup-screens.png";

const articles: Record<string, {
  title: string;
  description: string;
  readTime: string;
  content: React.ReactNode;
  nextArticle?: { slug: string; title: string };
  prevArticle?: { slug: string; title: string };
}> = {
  "configuracao-inicial": {
    title: "Configuração Inicial",
    description: "Aprenda a configurar sua clínica no Eclini do zero",
    readTime: "5 min",
    prevArticle: undefined,
    nextArticle: { slug: "personalizando-clinica", title: "Personalizando sua Clínica" },
    content: (
      <div className="prose prose-slate max-w-none">
        <h2>Bem-vindo ao Eclini!</h2>
        <p>
          Este guia vai te ajudar a configurar sua clínica no Eclini em poucos minutos. 
          Siga os passos abaixo para ter seu sistema pronto para uso.
        </p>

        <Alert className="my-6">
          <Lightbulb className="h-4 w-4" />
          <AlertTitle>Dica</AlertTitle>
          <AlertDescription>
            Recomendamos completar todas as etapas de configuração antes de começar a usar o sistema no dia a dia.
          </AlertDescription>
        </Alert>

        <h3>Passo 1: Criando sua conta</h3>
        <p>
          Acesse <Link to="/cadastro" className="text-primary hover:underline">eclini.com.br/cadastro</Link> e 
          preencha seus dados para criar sua clínica. Você receberá um email de confirmação.
        </p>
        
        <div className="my-6 rounded-lg border bg-muted/50 p-4">
          <img 
            src="/docs/tela-login.png" 
            alt="Tela de login do Eclini" 
            className="rounded-lg w-full shadow-lg"
          />
          <p className="text-sm text-muted-foreground text-center mt-2">
            Tela de login do Eclini com acesso seguro
          </p>
        </div>

        <h3>Passo 2: Acessando o painel</h3>
        <p>
          Após confirmar seu email, acesse o sistema em <Link to="/auth" className="text-primary hover:underline">eclini.com.br/auth</Link> com 
          seu email e senha cadastrados.
        </p>

        <h3>Passo 3: Configurando dados da clínica</h3>
        <ol>
          <li>No menu lateral, acesse <strong>Configurações</strong></li>
          <li>Clique em <strong>Dados da Clínica</strong></li>
          <li>Preencha as informações:
            <ul>
              <li>Nome da clínica</li>
              <li>CNPJ</li>
              <li>Endereço completo</li>
              <li>Telefone e WhatsApp</li>
              <li>Logo da clínica (opcional)</li>
            </ul>
          </li>
          <li>Clique em <strong>Salvar</strong></li>
        </ol>

        <div className="my-6 rounded-lg border bg-muted/50 p-4">
          <img 
            src={dashboardMockup} 
            alt="Dashboard do Eclini" 
            className="rounded-lg w-full shadow-lg"
          />
          <p className="text-sm text-muted-foreground text-center mt-2">
            Dashboard principal com visão geral da clínica
          </p>
        </div>

        <h3>Passo 4: Definindo horário de funcionamento</h3>
        <p>
          Configure os horários em que sua clínica atende para que a agenda funcione corretamente:
        </p>
        <ol>
          <li>Em <strong>Configurações</strong>, acesse <strong>Horários</strong></li>
          <li>Defina o horário de abertura e fechamento para cada dia da semana</li>
          <li>Marque os dias em que a clínica está fechada</li>
        </ol>

        <Alert variant="default" className="my-6 border-amber-500/50 bg-amber-500/10">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-700">Importante</AlertTitle>
          <AlertDescription className="text-amber-700">
            Os horários configurados aqui serão usados como base para a agenda. 
            Cada profissional pode ter horários personalizados.
          </AlertDescription>
        </Alert>

        <h3>Próximos passos</h3>
        <p>
          Com a configuração inicial concluída, você já pode começar a:
        </p>
        <ul>
          <li><CheckCircle2 className="inline h-4 w-4 text-green-500 mr-1" /> Cadastrar profissionais</li>
          <li><CheckCircle2 className="inline h-4 w-4 text-green-500 mr-1" /> Adicionar procedimentos</li>
          <li><CheckCircle2 className="inline h-4 w-4 text-green-500 mr-1" /> Personalizar a aparência</li>
          <li><CheckCircle2 className="inline h-4 w-4 text-green-500 mr-1" /> Integrar o WhatsApp</li>
        </ul>
      </div>
    ),
  },
  "personalizando-clinica": {
    title: "Personalizando sua Clínica",
    description: "Configure logo, cores e informações da sua clínica",
    readTime: "4 min",
    prevArticle: { slug: "configuracao-inicial", title: "Configuração Inicial" },
    nextArticle: { slug: "cadastrando-profissionais", title: "Cadastrando Profissionais" },
    content: (
      <div className="prose prose-slate max-w-none">
        <h2>Personalize sua clínica</h2>
        <p>
          O Eclini permite que você personalize diversos aspectos do sistema para refletir a identidade visual da sua clínica.
        </p>

        <h3>Adicionando o logo</h3>
        <ol>
          <li>Acesse <strong>Configurações → Dados da Clínica</strong></li>
          <li>Na seção "Logo", clique em <strong>Escolher arquivo</strong></li>
          <li>Selecione uma imagem (recomendado: PNG com fundo transparente, 512x512px)</li>
          <li>O logo aparecerá nos documentos impressos e no painel de chamada</li>
        </ol>

        <div className="my-6 rounded-lg border bg-muted/50 p-4">
          <img 
            src={heroMockup} 
            alt="Sistema Eclini em dispositivos" 
            className="rounded-lg w-full shadow-lg"
          />
          <p className="text-sm text-muted-foreground text-center mt-2">
            O Eclini funciona perfeitamente em todos os dispositivos
          </p>
        </div>

        <h3>Personalizando documentos</h3>
        <p>
          Configure como seus documentos impressos (receitas, atestados, etc.) serão exibidos:
        </p>
        <ol>
          <li>Acesse <strong>Configurações → Documentos</strong></li>
          <li>Escolha quais informações aparecem no cabeçalho:
            <ul>
              <li>Logo da clínica</li>
              <li>Nome e endereço</li>
              <li>Telefone</li>
              <li>CNPJ</li>
            </ul>
          </li>
          <li>Configure o texto do rodapé</li>
          <li>Salve as alterações</li>
        </ol>

        <h3>Painel de chamada</h3>
        <p>
          Se você utiliza um painel de chamada na recepção, pode personalizá-lo:
        </p>
        <ul>
          <li>Adicione banners promocionais</li>
          <li>Configure cores e mensagens</li>
          <li>Exiba informações em tempo real</li>
        </ul>

        <Alert className="my-6">
          <Lightbulb className="h-4 w-4" />
          <AlertTitle>Dica profissional</AlertTitle>
          <AlertDescription>
            Use imagens de alta qualidade no painel de chamada. O sistema aceita imagens nos formatos JPG, PNG e WebP.
          </AlertDescription>
        </Alert>
      </div>
    ),
  },
  "cadastrando-profissionais": {
    title: "Cadastrando Profissionais",
    description: "Adicione médicos e profissionais à sua clínica",
    readTime: "6 min",
    prevArticle: { slug: "personalizando-clinica", title: "Personalizando sua Clínica" },
    nextArticle: { slug: "configurando-horarios", title: "Configurando Horários de Atendimento" },
    content: (
      <div className="prose prose-slate max-w-none">
        <h2>Cadastro de Profissionais</h2>
        <p>
          Cadastre todos os profissionais que realizam atendimentos na sua clínica. 
          Cada profissional terá sua própria agenda e pode ter horários personalizados.
        </p>

        <h3>Passo a passo</h3>
        <ol>
          <li>No menu lateral, acesse <strong>Cadastros → Profissionais</strong></li>
          <li>Clique no botão <strong>+ Novo Profissional</strong></li>
          <li>Preencha os dados obrigatórios:
            <ul>
              <li>Nome completo</li>
              <li>Especialidade</li>
              <li>Conselho profissional (CRM, CRO, etc.)</li>
              <li>Número do registro</li>
            </ul>
          </li>
          <li>Adicione foto do profissional (opcional, mas recomendado)</li>
          <li>Configure os procedimentos que ele realiza</li>
          <li>Clique em <strong>Salvar</strong></li>
        </ol>

        <div className="my-6 rounded-lg border bg-muted/50 p-4">
          <img 
            src={heroScreens} 
            alt="Telas do sistema Eclini" 
            className="rounded-lg w-full shadow-lg"
          />
          <p className="text-sm text-muted-foreground text-center mt-2">
            Interface intuitiva para cadastro de profissionais
          </p>
        </div>

        <h3>Configurando especialidades</h3>
        <p>
          O sistema vem com diversas especialidades pré-cadastradas. Para adicionar uma nova:
        </p>
        <ol>
          <li>No cadastro do profissional, clique em <strong>+ Nova Especialidade</strong></li>
          <li>Digite o nome da especialidade</li>
          <li>Salve</li>
        </ol>

        <h3>Vinculando procedimentos</h3>
        <p>
          É importante vincular os procedimentos que cada profissional realiza para facilitar o agendamento:
        </p>
        <ul>
          <li>Na aba <strong>Procedimentos</strong> do cadastro</li>
          <li>Selecione os procedimentos da lista</li>
          <li>Os preços podem ser personalizados por profissional</li>
        </ul>

        <Alert variant="default" className="my-6 border-amber-500/50 bg-amber-500/10">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-700">Atenção</AlertTitle>
          <AlertDescription className="text-amber-700">
            Profissionais só aparecem na agenda após terem horários de atendimento configurados.
          </AlertDescription>
        </Alert>
      </div>
    ),
  },
  "configurando-horarios": {
    title: "Configurando Horários de Atendimento",
    description: "Defina os horários de cada profissional",
    readTime: "5 min",
    prevArticle: { slug: "cadastrando-profissionais", title: "Cadastrando Profissionais" },
    nextArticle: undefined,
    content: (
      <div className="prose prose-slate max-w-none">
        <h2>Horários de Atendimento</h2>
        <p>
          Configure os horários de atendimento de cada profissional para que a agenda funcione corretamente.
        </p>

        <h3>Acessando a configuração</h3>
        <ol>
          <li>Acesse <strong>Cadastros → Profissionais</strong></li>
          <li>Clique no profissional desejado</li>
          <li>Vá para a aba <strong>Horários</strong></li>
        </ol>

        <div className="my-6 rounded-lg border bg-muted/50 p-4">
          <img 
            src={dashboardMockup} 
            alt="Configuração de horários na agenda" 
            className="rounded-lg w-full shadow-lg"
          />
          <p className="text-sm text-muted-foreground text-center mt-2">
            Agenda com visualização clara dos horários configurados
          </p>
        </div>

        <h3>Definindo horários por dia da semana</h3>
        <p>Para cada dia da semana, você pode definir:</p>
        <ul>
          <li><strong>Horário de início</strong> - quando começa o atendimento</li>
          <li><strong>Horário de término</strong> - quando termina o atendimento</li>
          <li><strong>Intervalo</strong> - horário de almoço ou pausa</li>
          <li><strong>Duração padrão da consulta</strong> - tempo de cada atendimento</li>
        </ul>

        <h3>Exemplo prático</h3>
        <div className="not-prose my-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Dia</th>
                <th className="text-left py-2">Manhã</th>
                <th className="text-left py-2">Tarde</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2">Segunda</td>
                <td className="py-2">08:00 - 12:00</td>
                <td className="py-2">14:00 - 18:00</td>
              </tr>
              <tr className="border-b">
                <td className="py-2">Terça</td>
                <td className="py-2">08:00 - 12:00</td>
                <td className="py-2">14:00 - 18:00</td>
              </tr>
              <tr className="border-b">
                <td className="py-2">Quarta</td>
                <td className="py-2">-</td>
                <td className="py-2">14:00 - 18:00</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>Bloqueando horários específicos</h3>
        <p>
          Você pode bloquear horários específicos diretamente na agenda:
        </p>
        <ol>
          <li>Acesse a <strong>Agenda</strong></li>
          <li>Clique no horário que deseja bloquear</li>
          <li>Selecione <strong>Bloquear horário</strong></li>
          <li>Adicione um motivo (opcional)</li>
        </ol>

        <Alert className="my-6">
          <Lightbulb className="h-4 w-4" />
          <AlertTitle>Dica</AlertTitle>
          <AlertDescription>
            Use os feriados configurados em Configurações → Feriados para bloquear automaticamente dias específicos.
          </AlertDescription>
        </Alert>
      </div>
    ),
  },
};

export default function PrimeirosPassosArticle() {
  const { articleSlug } = useParams<{ articleSlug: string }>();
  
  if (!articleSlug || !articles[articleSlug]) {
    return <Navigate to="/ajuda/primeiros-passos" replace />;
  }

  const article = articles[articleSlug];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link 
          to="/ajuda/primeiros-passos"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Primeiros Passos
        </Link>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
          {article.title}
        </h1>
        <p className="text-muted-foreground mt-2">
          {article.description}
        </p>
        <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Tempo de leitura: {article.readTime}</span>
        </div>
      </div>

      {/* Content */}
      <div className="bg-card rounded-xl border border-border p-6 lg:p-8">
        {article.content}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-6 border-t border-border">
        {article.prevArticle ? (
          <Link 
            to={`/ajuda/primeiros-passos/${article.prevArticle.slug}`}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {article.prevArticle.title}
          </Link>
        ) : <div />}
        
        {article.nextArticle && (
          <Link 
            to={`/ajuda/primeiros-passos/${article.nextArticle.slug}`}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            {article.nextArticle.title}
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
