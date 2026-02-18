import { Link, useParams, Navigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Users,
  Stethoscope,
  Settings,
  Ban,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  List,
  CalendarDays,
  UserCheck,
  Scissors,
  Lock,
  Sliders,
} from "lucide-react";
import { TutorialStep, TutorialChecklist } from "@/components/docs/TutorialStep";
import { TutorialCard, TutorialTip } from "@/components/docs/TutorialCard";

const articles: Record<string, {
  title: string;
  description: string;
  readTime: string;
  content: React.ReactNode;
  nextArticle?: { slug: string; title: string };
  prevArticle?: { slug: string; title: string };
}> = {

  // ─── 1. AGENDA ───────────────────────────────────────────────────────────────
  "agenda-homologacao": {
    title: "Agenda de Homologação",
    description: "Aprenda a visualizar, criar e gerenciar agendamentos no módulo de Homologação",
    readTime: "5 min",
    prevArticle: undefined,
    nextArticle: { slug: "profissionais-homologacao", title: "Profissionais" },
    content: (
      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Agenda de Homologação</h2>
          <p className="text-muted-foreground">
            A agenda do módulo de Homologação permite visualizar e gerenciar todos os agendamentos
            de atendimento dos profissionais cadastrados. Os trabalhadores podem agendar diretamente
            pelo link público, e o sindicato acompanha tudo em tempo real.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Visualizações disponíveis</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <TutorialCard
              icon={CalendarDays}
              title="Por dia"
              description="Veja os agendamentos de um dia específico, organizados por horário"
              color="blue"
            />
            <TutorialCard
              icon={List}
              title="Em lista"
              description="Lista cronológica de todos os agendamentos futuros e passados"
              color="violet"
            />
            <TutorialCard
              icon={Calendar}
              title="Por profissional"
              description="Filtre a agenda por profissional para ver a disponibilidade individual"
              color="emerald"
            />
            <TutorialCard
              icon={CheckCircle2}
              title="Por status"
              description="Filtre por agendado, confirmado, realizado ou cancelado"
              color="amber"
            />
          </div>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Como acessar a agenda</h3>
          <div className="space-y-4">
            <TutorialStep number={1} title="Acesse o módulo">
              <p>No menu lateral, clique em <strong>Homologação</strong> para expandir o submenu.</p>
            </TutorialStep>
            <TutorialStep number={2} title="Clique em Agenda">
              <p>Selecione a opção <strong>Agenda</strong> para visualizar os agendamentos existentes.</p>
            </TutorialStep>
            <TutorialStep number={3} title="Filtre por profissional ou data">
              <p>Use os filtros no topo para selecionar profissional, intervalo de datas ou status desejado.</p>
            </TutorialStep>
            <TutorialStep number={4} title="Acesse os detalhes">
              <p>Clique em qualquer agendamento para ver o protocolo, dados do trabalhador, empresa e serviço solicitado.</p>
            </TutorialStep>
          </div>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Status dos agendamentos</h3>
          <div className="space-y-3">
            {[
              { color: "bg-yellow-500", label: "Agendado", desc: "Horário reservado, aguardando atendimento" },
              { color: "bg-blue-500", label: "Confirmado", desc: "Confirmado pelo profissional ou pela secretaria" },
              { color: "bg-emerald-500", label: "Realizado", desc: "Atendimento concluído com sucesso" },
              { color: "bg-red-500", label: "Cancelado", desc: "Agendamento cancelado pelo trabalhador ou pelo sindicato" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <div className={`w-4 h-4 rounded-full ${item.color} shrink-0`} />
                <div>
                  <span className="font-medium text-foreground">{item.label}</span>
                  <span className="text-muted-foreground"> — {item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Link de agendamento público</h3>
          <p className="text-muted-foreground mb-3">
            Cada profissional possui um link exclusivo para agendamento público. Os trabalhadores
            acessam esse link, escolhem data, horário e serviço — sem precisar de login.
          </p>
          <TutorialTip type="tip">
            O link público fica disponível na página do profissional (seção Profissionais). Compartilhe-o
            com empresas e trabalhadores para facilitar o auto-agendamento.
          </TutorialTip>
        </section>

        <TutorialTip type="info">
          Agendamentos realizados pelo link público aparecem automaticamente na agenda interna do sistema,
          com protocolo gerado no ato do agendamento.
        </TutorialTip>
      </div>
    ),
  },

  // ─── 2. PROFISSIONAIS ─────────────────────────────────────────────────────────
  "profissionais-homologacao": {
    title: "Profissionais",
    description: "Cadastre e configure os profissionais de saúde que realizam homologações",
    readTime: "5 min",
    prevArticle: { slug: "agenda-homologacao", title: "Agenda" },
    nextArticle: { slug: "servicos-homologacao", title: "Serviços" },
    content: (
      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Cadastro de Profissionais</h2>
          <p className="text-muted-foreground">
            Os profissionais são os médicos ou especialistas responsáveis por realizar as homologações.
            Cada profissional possui sua própria agenda, horários e link de agendamento público.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Como cadastrar um profissional</h3>
          <div className="space-y-4">
            <TutorialStep number={1} title="Acesse Profissionais">
              <p>No menu <strong>Homologação</strong>, clique em <strong>Profissionais</strong>.</p>
            </TutorialStep>
            <TutorialStep number={2} title="Clique em Novo Profissional">
              <p>Clique no botão <strong>+ Novo Profissional</strong> no canto superior direito.</p>
            </TutorialStep>
            <TutorialStep number={3} title="Preencha os dados">
              <TutorialChecklist items={[
                "Nome completo do profissional",
                "Especialidade (ex.: Médico do Trabalho, Clínico Geral)",
                "CRM e número de registro profissional",
                "Dados de contato (telefone e e-mail)",
                "Foto de perfil (opcional, aparece no link público)",
              ]} />
            </TutorialStep>
            <TutorialStep number={4} title="Configure a slug (URL personalizada)">
              <p>
                A <strong>slug</strong> é a URL do link público do profissional. Ex.: <code className="bg-muted px-1.5 py-0.5 rounded text-sm">meu-sindicato.app/homologacao/<strong>dr-silva</strong></code>.
                Escolha uma URL amigável e sem espaços.
              </p>
            </TutorialStep>
            <TutorialStep number={5} title="Defina os horários de atendimento">
              <p>
                Configure os dias da semana e intervalos de horário em que o profissional estará disponível.
                Esses horários aparecem no agendamento público.
              </p>
            </TutorialStep>
            <TutorialStep number={6} title="Salve e ative">
              <p>Clique em <strong>Salvar</strong>. O profissional já estará disponível para receber agendamentos.</p>
            </TutorialStep>
          </div>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Informações do profissional</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <TutorialCard
              icon={UserCheck}
              title="Dados cadastrais"
              description="Nome, CRM, especialidade e contato ficam visíveis no link público para os trabalhadores"
              color="blue"
            />
            <TutorialCard
              icon={Clock}
              title="Horários de atendimento"
              description="Defina os dias e horários disponíveis; o sistema bloqueia horários já ocupados automaticamente"
              color="emerald"
            />
            <TutorialCard
              icon={Calendar}
              title="Link público exclusivo"
              description="Cada profissional tem um link próprio para agendamento — ideal para divulgar para as empresas"
              color="violet"
            />
            <TutorialCard
              icon={Stethoscope}
              title="Serviços vinculados"
              description="Associe os tipos de serviço que o profissional está habilitado a realizar"
              color="amber"
            />
          </div>
        </section>

        <TutorialTip type="tip">
          Você pode ter vários profissionais cadastrados. Cada um terá sua própria agenda e link de agendamento,
          permitindo que o trabalhador escolha com quem quer ser atendido.
        </TutorialTip>

        <TutorialTip type="warning">
          Ao desativar um profissional, os agendamentos futuros existentes <strong>não são cancelados automaticamente</strong>.
          Revise a agenda antes de desativar.
        </TutorialTip>
      </div>
    ),
  },

  // ─── 3. SERVIÇOS ─────────────────────────────────────────────────────────────
  "servicos-homologacao": {
    title: "Serviços",
    description: "Configure os tipos de serviço disponíveis para agendamento na homologação",
    readTime: "4 min",
    prevArticle: { slug: "profissionais-homologacao", title: "Profissionais" },
    nextArticle: { slug: "bloqueios-homologacao", title: "Bloqueios" },
    content: (
      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Tipos de Serviço</h2>
          <p className="text-muted-foreground">
            Os serviços definem quais tipos de atendimento o trabalhador pode solicitar ao agendar.
            Exemplos comuns: <em>Exame Admissional</em>, <em>Exame Demissional</em>, <em>Retorno ao Trabalho</em>.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Como cadastrar um serviço</h3>
          <div className="space-y-4">
            <TutorialStep number={1} title="Acesse Serviços">
              <p>No menu <strong>Homologação</strong>, clique em <strong>Serviços</strong>.</p>
            </TutorialStep>
            <TutorialStep number={2} title="Clique em Novo Serviço">
              <p>Clique no botão <strong>+ Novo Serviço</strong>.</p>
            </TutorialStep>
            <TutorialStep number={3} title="Preencha os dados do serviço">
              <TutorialChecklist items={[
                "Nome do serviço (ex.: Exame Admissional)",
                "Descrição breve — aparece no formulário de agendamento público",
                "Duração estimada do atendimento (em minutos)",
                "Cor de identificação (facilita visualização na agenda)",
              ]} />
            </TutorialStep>
            <TutorialStep number={4} title="Ative o serviço">
              <p>Certifique-se de que o serviço está <strong>ativo</strong> para aparecer nas opções de agendamento público.</p>
            </TutorialStep>
          </div>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Boas práticas</h3>
          <TutorialChecklist items={[
            "Use nomes claros que o trabalhador consiga identificar facilmente",
            "Defina durações realistas para evitar conflitos de horário",
            "Desative serviços temporariamente em vez de excluir — os históricos são preservados",
            "Crie serviços distintos para tipos diferentes de atendimento (admissional ≠ demissional)",
          ]} />
        </section>

        <TutorialTip type="info">
          A duração do serviço é usada pelo sistema para calcular automaticamente o intervalo de horários
          disponíveis na agenda pública. Um serviço de 30 min a partir das 08:00 ocupa até as 08:30.
        </TutorialTip>

        <TutorialTip type="warning">
          Excluir um serviço que já possui agendamentos vinculados pode causar inconsistências.
          Prefira <strong>desativar</strong> ao invés de excluir.
        </TutorialTip>
      </div>
    ),
  },

  // ─── 4. BLOQUEIOS ────────────────────────────────────────────────────────────
  "bloqueios-homologacao": {
    title: "Bloqueios de Agenda",
    description: "Bloqueie datas e horários para férias, feriados ou indisponibilidade do profissional",
    readTime: "4 min",
    prevArticle: { slug: "servicos-homologacao", title: "Serviços" },
    nextArticle: { slug: "configuracoes-homologacao", title: "Configurações" },
    content: (
      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Bloqueios de Agenda</h2>
          <p className="text-muted-foreground">
            Os bloqueios impedem que novos agendamentos sejam feitos em datas ou períodos específicos.
            São úteis para feriados, férias do profissional, eventos internos ou qualquer indisponibilidade.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Como criar um bloqueio</h3>
          <div className="space-y-4">
            <TutorialStep number={1} title="Acesse Bloqueios">
              <p>No menu <strong>Homologação</strong>, clique em <strong>Bloqueios</strong>.</p>
            </TutorialStep>
            <TutorialStep number={2} title="Clique em Novo Bloqueio">
              <p>Clique no botão <strong>+ Novo Bloqueio</strong>.</p>
            </TutorialStep>
            <TutorialStep number={3} title="Configure o bloqueio">
              <TutorialChecklist items={[
                "Selecione o profissional afetado (ou todos, se o bloqueio for geral)",
                "Escolha a data (ou intervalo de datas) do bloqueio",
                "Adicione um motivo ou descrição para identificação futura",
              ]} />
            </TutorialStep>
            <TutorialStep number={4} title="Salve o bloqueio">
              <p>
                Após salvar, as datas bloqueadas ficam indisponíveis no link público.
                Agendamentos já existentes <strong>não são cancelados</strong> automaticamente.
              </p>
            </TutorialStep>
          </div>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Tipos de bloqueio</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <TutorialCard
              icon={Lock}
              title="Bloqueio por profissional"
              description="Bloqueia apenas a agenda de um profissional específico em determinada data"
              color="rose"
            />
            <TutorialCard
              icon={Ban}
              title="Bloqueio geral"
              description="Bloqueia todos os profissionais — ideal para feriados do sindicato"
              color="amber"
            />
          </div>
        </section>

        <TutorialTip type="tip">
          Cadastre os bloqueios de feriados com antecedência para evitar que trabalhadores agendem
          em datas indisponíveis.
        </TutorialTip>

        <TutorialTip type="warning">
          Se já existirem agendamentos na data que será bloqueada, entre em contato com os trabalhadores
          e cancele manualmente cada um antes de criar o bloqueio.
        </TutorialTip>
      </div>
    ),
  },

  // ─── 5. CONFIGURAÇÕES ────────────────────────────────────────────────────────
  "configuracoes-homologacao": {
    title: "Configurações da Homologação",
    description: "Personalize as opções gerais do módulo de Homologação do seu sindicato",
    readTime: "4 min",
    prevArticle: { slug: "bloqueios-homologacao", title: "Bloqueios" },
    nextArticle: undefined,
    content: (
      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Configurações Gerais</h2>
          <p className="text-muted-foreground">
            As configurações do módulo de Homologação permitem personalizar o comportamento do
            agendamento público, notificações e outras preferências operacionais.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Como acessar as configurações</h3>
          <div className="space-y-4">
            <TutorialStep number={1} title="Acesse o módulo de Homologação">
              <p>No menu lateral, clique em <strong>Homologação</strong>.</p>
            </TutorialStep>
            <TutorialStep number={2} title="Clique em Configurações">
              <p>No submenu, selecione <strong>Configurações</strong>.</p>
            </TutorialStep>
            <TutorialStep number={3} title="Ajuste as opções disponíveis">
              <TutorialChecklist items={[
                "Mensagem de boas-vindas exibida no link de agendamento público",
                "Antecedência mínima para agendamento (ex.: ao menos 24h antes)",
                "Número máximo de agendamentos por trabalhador no mesmo período",
                "Notificações por WhatsApp — ative para confirmar agendamentos automaticamente",
                "E-mail de notificação para a equipe interna do sindicato",
              ]} />
            </TutorialStep>
            <TutorialStep number={4} title="Salve as alterações">
              <p>Clique em <strong>Salvar configurações</strong> para aplicar as mudanças.</p>
            </TutorialStep>
          </div>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Principais configurações</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <TutorialCard
              icon={Sliders}
              title="Regras de agendamento"
              description="Defina antecedência mínima, limite por trabalhador e janela de agendamento disponível"
              color="blue"
            />
            <TutorialCard
              icon={AlertCircle}
              title="Notificações automáticas"
              description="Configure envio automático de confirmação e lembrete via WhatsApp para o trabalhador"
              color="green"
            />
            <TutorialCard
              icon={Scissors}
              title="Intervalo entre atendimentos"
              description="Defina um intervalo de descanso entre um atendimento e o próximo para o profissional"
              color="violet"
            />
            <TutorialCard
              icon={Settings}
              title="Mensagens personalizadas"
              description="Personalize o texto exibido na tela de confirmação do agendamento público"
              color="amber"
            />
          </div>
        </section>

        <TutorialTip type="tip">
          Ative as notificações por WhatsApp para reduzir o número de faltas — trabalhadores lembrados
          automaticamente comparecem com mais frequência.
        </TutorialTip>

        <TutorialTip type="info">
          As configurações se aplicam a todos os profissionais cadastrados no módulo. Para configurações
          individuais por profissional (como horários), acesse a seção <strong>Profissionais</strong>.
        </TutorialTip>
      </div>
    ),
  },
};

// ─── Article Renderer ─────────────────────────────────────────────────────────
export default function HomologacaoArticle() {
  const { articleSlug } = useParams<{ articleSlug: string }>();

  if (!articleSlug || !articles[articleSlug]) {
    return <Navigate to="/ajuda/homologacao" replace />;
  }

  const article = articles[articleSlug];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pb-6 border-b border-border">
        <Link
          to="/ajuda/homologacao"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Homologação
        </Link>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">{article.title}</h1>
        <p className="text-muted-foreground">{article.description}</p>
        <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>{article.readTime} de leitura</span>
        </div>
      </div>

      {/* Content */}
      <div>{article.content}</div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-8 border-t border-border">
        {article.prevArticle ? (
          <Link
            to={`/ajuda/homologacao/${article.prevArticle.slug}`}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors group"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            <div>
              <div className="text-xs text-muted-foreground">Anterior</div>
              <div>{article.prevArticle.title}</div>
            </div>
          </Link>
        ) : (
          <div />
        )}

        {article.nextArticle ? (
          <Link
            to={`/ajuda/homologacao/${article.nextArticle.slug}`}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors group text-right"
          >
            <div>
              <div className="text-xs text-muted-foreground">Próximo</div>
              <div>{article.nextArticle.title}</div>
            </div>
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
