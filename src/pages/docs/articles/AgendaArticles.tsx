import { Link, useParams, Navigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Clock, MousePointer, Calendar, MessageSquare, ListChecks } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { TutorialImage } from "@/components/docs/TutorialImage";
import { TutorialStep, TutorialChecklist } from "@/components/docs/TutorialStep";
import { TutorialTip, TutorialCard } from "@/components/docs/TutorialCard";

// Import images
import tutorialAgenda from "@/assets/docs/tutorial-agenda-pt.png";
import tutorialWhatsapp from "@/assets/docs/tutorial-whatsapp-pt.png";

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
    description: "Conheça todas as funcionalidades da agenda do Eclini e como ela pode otimizar sua clínica",
    readTime: "4 min",
    prevArticle: undefined,
    nextArticle: { slug: "criando-agendamentos", title: "Criando Agendamentos" },
    content: (
      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">A Agenda do Eclini</h2>
          <p className="text-muted-foreground">
            A agenda é o coração do Eclini. Aqui você gerencia todos os agendamentos da sua clínica de forma visual e intuitiva.
          </p>
        </section>

        <TutorialImage 
          src={tutorialAgenda} 
          alt="Visão geral da agenda do Eclini" 
          caption="Agenda com visualização de agendamentos coloridos por status"
        />

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Visualizações Disponíveis</h3>
          <p className="text-muted-foreground mb-4">A agenda oferece diferentes formas de visualizar os agendamentos:</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <TutorialCard 
              icon={Calendar} 
              title="Visualização por Dia" 
              description="Veja todos os agendamentos do dia selecionado em detalhes"
              color="blue"
            />
            <TutorialCard 
              icon={Calendar} 
              title="Visualização por Semana" 
              description="Tenha uma visão completa da semana de forma compacta"
              color="violet"
            />
            <TutorialCard 
              icon={Calendar} 
              title="Visualização por Mês" 
              description="Veja o panorama geral do mês inteiro"
              color="emerald"
            />
            <TutorialCard 
              icon={ListChecks} 
              title="Visualização em Lista" 
              description="Próximos agendamentos em formato de lista"
              color="amber"
            />
          </div>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Cores dos Agendamentos</h3>
          <p className="text-muted-foreground mb-4">Cada status tem uma cor específica para facilitar a identificação:</p>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="w-4 h-4 rounded bg-yellow-500"></div>
              <div>
                <span className="font-medium text-foreground">Amarelo</span>
                <span className="text-muted-foreground"> - Agendado (aguardando confirmação)</span>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="w-4 h-4 rounded bg-blue-500"></div>
              <div>
                <span className="font-medium text-foreground">Azul</span>
                <span className="text-muted-foreground"> - Confirmado pelo paciente</span>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="w-4 h-4 rounded bg-purple-500"></div>
              <div>
                <span className="font-medium text-foreground">Roxo</span>
                <span className="text-muted-foreground"> - Paciente chegou na recepção</span>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="w-4 h-4 rounded bg-green-500"></div>
              <div>
                <span className="font-medium text-foreground">Verde</span>
                <span className="text-muted-foreground"> - Em atendimento</span>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="w-4 h-4 rounded bg-emerald-600"></div>
              <div>
                <span className="font-medium text-foreground">Verde Escuro</span>
                <span className="text-muted-foreground"> - Atendimento finalizado</span>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="w-4 h-4 rounded bg-red-500"></div>
              <div>
                <span className="font-medium text-foreground">Vermelho</span>
                <span className="text-muted-foreground"> - Cancelado ou falta</span>
              </div>
            </div>
          </div>
        </section>

        <TutorialTip type="tip">
          Clique duas vezes em um horário vazio para criar rapidamente um novo agendamento sem precisar abrir o formulário completo.
        </TutorialTip>
      </div>
    ),
  },
  "criando-agendamentos": {
    title: "Criando Agendamentos",
    description: "Aprenda todas as formas de criar e gerenciar agendamentos no Eclini",
    readTime: "5 min",
    prevArticle: { slug: "visao-geral-agenda", title: "Visão Geral da Agenda" },
    nextArticle: { slug: "confirmacao-whatsapp", title: "Confirmação via WhatsApp" },
    content: (
      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Criando um Novo Agendamento</h2>
          <p className="text-muted-foreground">
            Existem várias formas de criar um agendamento no Eclini. Veja as opções disponíveis e escolha a mais prática para você.
          </p>
        </section>

        <TutorialImage 
          src={tutorialAgenda} 
          alt="Formulário de agendamento" 
          caption="Formulário de novo agendamento com interface intuitiva"
        />

        <section className="space-y-6">
          <h3 className="text-lg font-semibold text-foreground">Método 1: Clique na Agenda</h3>
          
          <TutorialStep number={1} title="Acesse a Agenda">
            <p>No menu lateral, clique em <strong>Agenda</strong></p>
          </TutorialStep>

          <TutorialStep number={2} title="Clique no Horário Desejado">
            <p>Clique no slot de horário onde deseja criar o agendamento</p>
          </TutorialStep>

          <TutorialStep number={3} title="Preencha os Dados">
            <TutorialChecklist items={[
              "Selecione ou cadastre o paciente",
              "Escolha o procedimento",
              "Adicione observações (opcional)",
              "Clique em Agendar"
            ]} />
          </TutorialStep>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Método 2: Botão de Novo Agendamento</h3>
          <TutorialChecklist items={[
            "Clique no botão + Novo Agendamento no topo da agenda",
            "Selecione o profissional",
            "Escolha a data e horário disponíveis",
            "Preencha os demais dados do paciente"
          ]} />
        </section>

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Arrastar e Soltar</h3>
          <p className="text-muted-foreground mb-4">
            Você pode mover agendamentos arrastando-os para outro horário:
          </p>
          <TutorialChecklist items={[
            "Clique e segure no agendamento",
            "Arraste para o novo horário desejado",
            "Solte para confirmar a mudança"
          ]} />
        </section>

        <TutorialTip type="warning">
          O sistema verifica automaticamente se há conflitos de horário. Se o horário já estiver ocupado, você será avisado antes de confirmar.
        </TutorialTip>

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Agendamentos Recorrentes</h3>
          <p className="text-muted-foreground mb-4">
            Para tratamentos que precisam de várias sessões:
          </p>
          <TutorialChecklist items={[
            "Ao criar o agendamento, marque 'Agendamento recorrente'",
            "Defina a frequência (semanal, quinzenal, mensal)",
            "Escolha quantas sessões deseja criar",
            "O sistema criará todos os agendamentos automaticamente"
          ]} />
        </section>
      </div>
    ),
  },
  "confirmacao-whatsapp": {
    title: "Confirmação via WhatsApp",
    description: "Configure confirmações automáticas de agendamento e reduza faltas na sua clínica",
    readTime: "4 min",
    prevArticle: { slug: "criando-agendamentos", title: "Criando Agendamentos" },
    nextArticle: { slug: "lista-espera", title: "Lista de Espera" },
    content: (
      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Confirmação Automática</h2>
          <p className="text-muted-foreground">
            O Eclini pode enviar automaticamente mensagens de confirmação para os pacientes via WhatsApp, 
            reduzindo faltas e melhorando a organização da sua agenda.
          </p>
        </section>

        <TutorialImage 
          src={tutorialWhatsapp} 
          alt="Integração WhatsApp" 
          caption="Configuração de mensagens automáticas via WhatsApp"
        />

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Como Funciona</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 bg-green-500/10 rounded-xl border border-green-500/20">
              <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold">1</div>
              <div>
                <h4 className="font-medium text-foreground">Envio Automático</h4>
                <p className="text-sm text-muted-foreground">O paciente recebe uma mensagem X horas antes da consulta</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-green-500/10 rounded-xl border border-green-500/20">
              <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold">2</div>
              <div>
                <h4 className="font-medium text-foreground">Resposta do Paciente</h4>
                <p className="text-sm text-muted-foreground">Ele responde <strong>SIM</strong> para confirmar ou <strong>NÃO</strong> para cancelar</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-green-500/10 rounded-xl border border-green-500/20">
              <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold">3</div>
              <div>
                <h4 className="font-medium text-foreground">Atualização Automática</h4>
                <p className="text-sm text-muted-foreground">O status na agenda é atualizado automaticamente</p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <h3 className="text-lg font-semibold text-foreground">Configurando os Lembretes</h3>
          
          <TutorialStep number={1} title="Acesse as Configurações">
            <p>Vá em <strong>Configurações → WhatsApp</strong></p>
          </TutorialStep>

          <TutorialStep number={2} title="Ative os Lembretes">
            <p>Ative a opção <strong>Lembretes automáticos</strong></p>
          </TutorialStep>

          <TutorialStep number={3} title="Configure o Tempo">
            <p>Defina quantas horas antes do agendamento a mensagem será enviada (padrão: 24h)</p>
          </TutorialStep>

          <TutorialStep number={4} title="Personalize a Mensagem">
            <p>Edite o texto da mensagem se desejar usar um texto personalizado</p>
          </TutorialStep>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Variáveis Disponíveis</h3>
          <p className="text-muted-foreground mb-4">Use estas variáveis que serão substituídas automaticamente:</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="p-3 bg-muted rounded-lg">
              <code className="text-primary font-mono text-sm">{"{nome}"}</code>
              <span className="text-muted-foreground text-sm ml-2">Nome do paciente</span>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <code className="text-primary font-mono text-sm">{"{data}"}</code>
              <span className="text-muted-foreground text-sm ml-2">Data da consulta</span>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <code className="text-primary font-mono text-sm">{"{hora}"}</code>
              <span className="text-muted-foreground text-sm ml-2">Horário</span>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <code className="text-primary font-mono text-sm">{"{profissional}"}</code>
              <span className="text-muted-foreground text-sm ml-2">Nome do médico</span>
            </div>
          </div>
        </section>

        <TutorialTip type="tip">
          Mensagens enviadas entre 8h e 20h têm maior taxa de resposta. Configure o horário de envio nas configurações.
        </TutorialTip>
      </div>
    ),
  },
  "lista-espera": {
    title: "Lista de Espera",
    description: "Gerencie pacientes aguardando horários e nunca perca uma oportunidade de agendamento",
    readTime: "3 min",
    prevArticle: { slug: "confirmacao-whatsapp", title: "Confirmação via WhatsApp" },
    nextArticle: undefined,
    content: (
      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Lista de Espera</h2>
          <p className="text-muted-foreground">
            Quando não há horários disponíveis, adicione o paciente à lista de espera. 
            Assim que um horário surgir, você será notificado e poderá agendar rapidamente.
          </p>
        </section>

        <TutorialImage 
          src={tutorialAgenda} 
          alt="Lista de espera" 
          caption="Tela de lista de espera com pacientes ordenados por prioridade"
        />

        <section className="space-y-6">
          <h3 className="text-lg font-semibold text-foreground">Adicionando à Lista</h3>
          
          <TutorialStep number={1} title="Acesse a Lista de Espera">
            <p>Vá em <strong>Agenda → Lista de Espera</strong></p>
          </TutorialStep>

          <TutorialStep number={2} title="Adicione o Paciente">
            <p>Clique em <strong>+ Adicionar à lista</strong></p>
          </TutorialStep>

          <TutorialStep number={3} title="Configure as Preferências">
            <TutorialChecklist items={[
              "Selecione o paciente",
              "Escolha o profissional desejado",
              "Defina a preferência de horário (manhã, tarde ou qualquer)",
              "Adicione observações se necessário"
            ]} />
          </TutorialStep>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Priorização</h3>
          <p className="text-muted-foreground mb-4">
            Organize a lista por ordem de prioridade arrastando os itens. 
            Pacientes no topo serão contatados primeiro quando houver disponibilidade.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Quando Surgir uma Vaga</h3>
          <TutorialChecklist items={[
            "Ao cancelar ou mover um agendamento, o sistema sugere pacientes da lista",
            "Você pode agendar diretamente da lista de espera",
            "O paciente pode ser notificado automaticamente via WhatsApp"
          ]} />
        </section>

        <TutorialTip type="tip">
          Configure notificações automáticas para avisar os pacientes da lista de espera quando surgir um horário compatível com suas preferências.
        </TutorialTip>
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
      <Card>
        <CardContent className="p-6 lg:p-8">
          {article.content}
        </CardContent>
      </Card>

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
