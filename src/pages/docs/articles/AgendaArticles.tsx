import { Link, useParams, Navigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Lightbulb, AlertCircle, MousePointer, Calendar } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  "visao-geral-agenda": {
    title: "Visão Geral da Agenda",
    description: "Conheça todas as funcionalidades da agenda do Eclini",
    readTime: "4 min",
    prevArticle: undefined,
    nextArticle: { slug: "criando-agendamentos", title: "Criando Agendamentos" },
    content: (
      <div className="prose prose-slate max-w-none">
        <h2>A Agenda do Eclini</h2>
        <p>
          A agenda é o coração do Eclini. Aqui você gerencia todos os agendamentos da sua clínica de forma visual e intuitiva.
        </p>

        <div className="my-6 rounded-lg border bg-muted/50 p-4">
          <img 
            src={dashboardMockup} 
            alt="Visão geral da agenda do Eclini" 
            className="rounded-lg w-full shadow-lg"
          />
          <p className="text-sm text-muted-foreground text-center mt-2">
            Visão geral da agenda com agendamentos coloridos por status
          </p>
        </div>

        <h3>Visualizações disponíveis</h3>
        <p>A agenda oferece diferentes formas de visualizar os agendamentos:</p>
        <ul>
          <li><strong>Dia</strong> - Visualize todos os agendamentos do dia selecionado</li>
          <li><strong>Semana</strong> - Veja a semana inteira de forma compacta</li>
          <li><strong>Mês</strong> - Tenha uma visão geral do mês</li>
          <li><strong>Lista</strong> - Visualize em formato de lista os próximos agendamentos</li>
        </ul>

        <h3>Cores dos agendamentos</h3>
        <p>Cada status de agendamento tem uma cor específica:</p>
        <div className="not-prose my-4 space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded bg-yellow-500"></div>
            <span className="text-sm"><strong>Amarelo</strong> - Agendado (aguardando)</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded bg-blue-500"></div>
            <span className="text-sm"><strong>Azul</strong> - Confirmado</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded bg-purple-500"></div>
            <span className="text-sm"><strong>Roxo</strong> - Chegou (na recepção)</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded bg-green-500"></div>
            <span className="text-sm"><strong>Verde</strong> - Em atendimento</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded bg-emerald-600"></div>
            <span className="text-sm"><strong>Verde escuro</strong> - Finalizado</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded bg-red-500"></div>
            <span className="text-sm"><strong>Vermelho</strong> - Cancelado</span>
          </div>
        </div>

        <h3>Filtros</h3>
        <p>Use os filtros para encontrar rapidamente o que precisa:</p>
        <ul>
          <li>Filtrar por profissional</li>
          <li>Filtrar por status</li>
          <li>Buscar por nome do paciente</li>
        </ul>

        <Alert className="my-6">
          <Lightbulb className="h-4 w-4" />
          <AlertTitle>Dica</AlertTitle>
          <AlertDescription>
            Clique duas vezes em um horário vazio para criar rapidamente um novo agendamento.
          </AlertDescription>
        </Alert>
      </div>
    ),
  },
  "criando-agendamentos": {
    title: "Criando Agendamentos",
    description: "Aprenda a criar e gerenciar agendamentos",
    readTime: "5 min",
    prevArticle: { slug: "visao-geral-agenda", title: "Visão Geral da Agenda" },
    nextArticle: { slug: "confirmacao-whatsapp", title: "Confirmação via WhatsApp" },
    content: (
      <div className="prose prose-slate max-w-none">
        <h2>Criando um novo agendamento</h2>
        <p>
          Existem várias formas de criar um agendamento no Eclini. Veja as opções disponíveis:
        </p>

        <h3>Método 1: Clique na agenda</h3>
        <ol>
          <li>Acesse a <strong>Agenda</strong> no menu lateral</li>
          <li>Clique no horário desejado</li>
          <li>Preencha os dados do agendamento:
            <ul>
              <li>Selecione ou cadastre o paciente</li>
              <li>Escolha o procedimento</li>
              <li>Adicione observações (opcional)</li>
            </ul>
          </li>
          <li>Clique em <strong>Agendar</strong></li>
        </ol>

        <div className="my-6 rounded-lg border bg-muted/50 p-4">
          <img 
            src={heroScreens} 
            alt="Formulário de agendamento do Eclini" 
            className="rounded-lg w-full shadow-lg"
          />
          <p className="text-sm text-muted-foreground text-center mt-2">
            Formulário de novo agendamento com interface intuitiva
          </p>
        </div>

        <h3>Método 2: Botão de novo agendamento</h3>
        <ol>
          <li>Clique no botão <strong>+ Novo Agendamento</strong> no topo da agenda</li>
          <li>Selecione o profissional</li>
          <li>Escolha a data e horário</li>
          <li>Preencha os demais dados</li>
        </ol>

        <h3>Método 3: A partir do cadastro do paciente</h3>
        <ol>
          <li>Acesse o cadastro do paciente</li>
          <li>Clique em <strong>Agendar consulta</strong></li>
          <li>Escolha profissional, data e horário</li>
        </ol>

        <h3>Arrastar e soltar</h3>
        <p>
          Você pode mover agendamentos arrastando-os para outro horário:
        </p>
        <ul>
          <li>Clique e segure no agendamento</li>
          <li>Arraste para o novo horário</li>
          <li>Solte para confirmar a mudança</li>
        </ul>

        <Alert variant="default" className="my-6 border-amber-500/50 bg-amber-500/10">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-700">Atenção</AlertTitle>
          <AlertDescription className="text-amber-700">
            O sistema verifica automaticamente se há conflitos de horário. Se o horário já estiver ocupado, 
            você será avisado.
          </AlertDescription>
        </Alert>

        <h3>Agendamentos recorrentes</h3>
        <p>
          Para tratamentos que precisam de várias sessões:
        </p>
        <ol>
          <li>Ao criar o agendamento, marque <strong>Agendamento recorrente</strong></li>
          <li>Defina a frequência (semanal, quinzenal, mensal)</li>
          <li>Escolha quantas sessões criar</li>
        </ol>
      </div>
    ),
  },
  "confirmacao-whatsapp": {
    title: "Confirmação via WhatsApp",
    description: "Configure confirmações automáticas de agendamento",
    readTime: "4 min",
    prevArticle: { slug: "criando-agendamentos", title: "Criando Agendamentos" },
    nextArticle: { slug: "lista-espera", title: "Lista de Espera" },
    content: (
      <div className="prose prose-slate max-w-none">
        <h2>Confirmação automática</h2>
        <p>
          O Eclini pode enviar automaticamente mensagens de confirmação para os pacientes via WhatsApp, 
          reduzindo faltas e melhorando a organização da sua agenda.
        </p>

        <div className="my-6 rounded-lg border bg-muted/50 p-4">
          <img 
            src="/eclini-whatsapp-header.jpg" 
            alt="Integração WhatsApp do Eclini" 
            className="rounded-lg w-full shadow-lg"
          />
          <p className="text-sm text-muted-foreground text-center mt-2">
            Mensagens automáticas enviadas diretamente pelo WhatsApp
          </p>
        </div>

        <h3>Como funciona</h3>
        <ol>
          <li>O paciente recebe uma mensagem X horas antes da consulta</li>
          <li>Ele pode responder <strong>SIM</strong> para confirmar ou <strong>NÃO</strong> para cancelar</li>
          <li>O status na agenda é atualizado automaticamente</li>
        </ol>

        <h3>Configurando os lembretes</h3>
        <ol>
          <li>Acesse <strong>Configurações → WhatsApp</strong></li>
          <li>Ative a opção <strong>Lembretes automáticos</strong></li>
          <li>Defina quantas horas antes do agendamento a mensagem será enviada (padrão: 24h)</li>
          <li>Personalize a mensagem se desejar</li>
        </ol>

        <h3>Variáveis disponíveis na mensagem</h3>
        <p>Você pode usar as seguintes variáveis que serão substituídas automaticamente:</p>
        <ul>
          <li><code>{"{nome}"}</code> - Nome do paciente</li>
          <li><code>{"{data}"}</code> - Data da consulta</li>
          <li><code>{"{hora}"}</code> - Horário da consulta</li>
          <li><code>{"{profissional}"}</code> - Nome do profissional</li>
          <li><code>{"{procedimento}"}</code> - Nome do procedimento</li>
          <li><code>{"{clinica}"}</code> - Nome da clínica</li>
        </ul>

        <Alert className="my-6">
          <Lightbulb className="h-4 w-4" />
          <AlertTitle>Dica</AlertTitle>
          <AlertDescription>
            Mensagens enviadas entre 8h e 20h têm maior taxa de resposta. Configure o horário de envio 
            nas configurações de WhatsApp.
          </AlertDescription>
        </Alert>
      </div>
    ),
  },
  "lista-espera": {
    title: "Lista de Espera",
    description: "Gerencie pacientes aguardando horários",
    readTime: "3 min",
    prevArticle: { slug: "confirmacao-whatsapp", title: "Confirmação via WhatsApp" },
    nextArticle: undefined,
    content: (
      <div className="prose prose-slate max-w-none">
        <h2>Lista de Espera</h2>
        <p>
          Quando não há horários disponíveis, adicione o paciente à lista de espera. 
          Assim que um horário surgir, você será notificado.
        </p>

        <h3>Adicionando à lista de espera</h3>
        <ol>
          <li>Acesse <strong>Agenda → Lista de Espera</strong></li>
          <li>Clique em <strong>+ Adicionar à lista</strong></li>
          <li>Selecione o paciente</li>
          <li>Escolha o profissional desejado</li>
          <li>Defina o período de preferência (manhã, tarde ou qualquer horário)</li>
          <li>Adicione observações se necessário</li>
        </ol>

        <div className="my-6 rounded-lg border bg-muted/50 p-4">
          <img 
            src={dashboardMockup} 
            alt="Lista de espera no Eclini" 
            className="rounded-lg w-full shadow-lg"
          />
          <p className="text-sm text-muted-foreground text-center mt-2">
            Tela de lista de espera com pacientes ordenados por prioridade
          </p>
        </div>

        <h3>Priorização</h3>
        <p>
          Organize a lista por ordem de prioridade arrastando os itens. 
          Pacientes no topo serão contatados primeiro quando houver disponibilidade.
        </p>

        <h3>Quando surgir uma vaga</h3>
        <ol>
          <li>Ao cancelar ou mover um agendamento, o sistema sugere pacientes da lista de espera</li>
          <li>Você pode agendar diretamente da lista</li>
          <li>O paciente pode ser notificado automaticamente sobre a disponibilidade</li>
        </ol>

        <Alert className="my-6">
          <Lightbulb className="h-4 w-4" />
          <AlertTitle>Dica</AlertTitle>
          <AlertDescription>
            Configure notificações automáticas para avisar os pacientes da lista de espera quando 
            surgir um horário compatível com suas preferências.
          </AlertDescription>
        </Alert>
      </div>
    ),
  },
};

export default function AgendaArticle() {
  const { articleSlug } = useParams<{ articleSlug: string }>();
  
  if (!articleSlug || !articles[articleSlug]) {
    return <Navigate to="/ajuda/agenda" replace />;
  }

  const article = articles[articleSlug];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link 
          to="/ajuda/agenda"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Agenda
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
            to={`/ajuda/agenda/${article.prevArticle.slug}`}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {article.prevArticle.title}
          </Link>
        ) : <div />}
        
        {article.nextArticle && (
          <Link 
            to={`/ajuda/agenda/${article.nextArticle.slug}`}
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
