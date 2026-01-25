import { Link, useParams, Navigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Clock, Users, Calendar, Settings, Cog } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { TutorialImage } from "@/components/docs/TutorialImage";
import { TutorialStep, TutorialChecklist } from "@/components/docs/TutorialStep";
import { TutorialTip, TutorialCard } from "@/components/docs/TutorialCard";

// Import images
import tutorialLogin from "@/assets/docs/tutorial-login-pt.png";
import tutorialDashboard from "@/assets/docs/tutorial-dashboard-pt.png";
import tutorialConfiguracoes from "@/assets/docs/tutorial-configuracoes-pt.png";
import tutorialAgenda from "@/assets/docs/tutorial-agenda-pt.png";

const articles: Record<string, {
  title: string;
  description: string;
  readTime: string;
  content: React.ReactNode;
  nextArticle?: { slug: string; title: string };
  prevArticle?: { slug: string; title: string };
}> = {
  "configuracao-inicial": {
    title: "Configuração Inicial do Sistema",
    description: "Configure sua clínica no Eclini do zero e comece a usar todas as funcionalidades",
    readTime: "5 min",
    prevArticle: undefined,
    nextArticle: { slug: "personalizando-clinica", title: "Personalizando sua Clínica" },
    content: (
      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Bem-vindo ao Eclini!</h2>
          <p className="text-muted-foreground mb-4">
            Este guia vai te ajudar a configurar sua clínica no Eclini em poucos minutos. 
            Siga os passos abaixo para ter seu sistema pronto para uso.
          </p>
          
          <TutorialTip type="tip">
            Recomendamos completar todas as etapas de configuração antes de começar a usar o sistema no dia a dia.
          </TutorialTip>
        </section>

        <TutorialImage 
          src={tutorialLogin} 
          alt="Tela de login do Eclini" 
          caption="Tela de acesso ao sistema Eclini com login seguro"
        />

        <section className="space-y-6">
          <h3 className="text-lg font-semibold text-foreground">Passo a Passo</h3>
          
          <TutorialStep number={1} title="Acesse o Sistema">
            <p className="mb-2">
              Entre no endereço <strong>app.eclini.com.br</strong> e faça login com suas credenciais. 
              Se você ainda não tem uma conta, clique em "Criar conta" para começar.
            </p>
          </TutorialStep>

          <TutorialStep number={2} title="Configure os Dados da Clínica">
            <p className="mb-3">
              No menu lateral, acesse <strong>Configurações → Dados da Clínica</strong> e preencha as informações:
            </p>
            <TutorialChecklist items={[
              "Nome da clínica",
              "CNPJ (opcional)",
              "Endereço completo",
              "Telefone e WhatsApp",
              "Logo da clínica (opcional)"
            ]} />
          </TutorialStep>

          <TutorialStep number={3} title="Defina o Horário de Funcionamento">
            <p className="mb-2">
              Configure os horários de atendimento da sua clínica em <strong>Configurações → Horários</strong>.
              Defina os dias e horários em que a clínica funciona.
            </p>
          </TutorialStep>

          <TutorialStep number={4} title="Cadastre os Profissionais">
            <p className="mb-2">
              Adicione os médicos e profissionais da sua clínica em <strong>Cadastros → Profissionais</strong>.
              Configure os horários de atendimento de cada um.
            </p>
          </TutorialStep>
        </section>

        <TutorialImage 
          src={tutorialConfiguracoes} 
          alt="Painel de configurações do Eclini" 
          caption="Painel de configurações com todas as opções disponíveis"
        />

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Próximos Passos</h3>
          <p className="text-muted-foreground mb-4">
            Com a configuração inicial concluída, você pode:
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <TutorialCard 
              icon={Users} 
              title="Cadastrar Profissionais" 
              description="Adicione médicos e defina seus horários"
              color="violet"
            />
            <TutorialCard 
              icon={Calendar} 
              title="Criar Agendamentos" 
              description="Comece a agendar consultas"
              color="blue"
            />
            <TutorialCard 
              icon={Settings} 
              title="Personalizar Aparência" 
              description="Configure logo e cores do sistema"
              color="emerald"
            />
            <TutorialCard 
              icon={Cog} 
              title="Integrar WhatsApp" 
              description="Ative lembretes automáticos"
              color="green"
            />
          </div>
        </section>
      </div>
    ),
  },
  "personalizando-clinica": {
    title: "Personalizando sua Clínica",
    description: "Configure logo, cores e informações para refletir a identidade visual da sua clínica",
    readTime: "4 min",
    prevArticle: { slug: "configuracao-inicial", title: "Configuração Inicial" },
    nextArticle: { slug: "cadastrando-profissionais", title: "Cadastrando Profissionais" },
    content: (
      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Personalize sua clínica</h2>
          <p className="text-muted-foreground">
            O Eclini permite que você personalize diversos aspectos do sistema para refletir a identidade visual da sua clínica.
          </p>
        </section>

        <section className="space-y-6">
          <h3 className="text-lg font-semibold text-foreground">Adicionando o Logo</h3>
          
          <TutorialStep number={1} title="Acesse as Configurações">
            <p>Vá em <strong>Configurações → Dados da Clínica</strong></p>
          </TutorialStep>

          <TutorialStep number={2} title="Faça o Upload do Logo">
            <p className="mb-2">Na seção "Logo", clique em <strong>Escolher arquivo</strong></p>
            <TutorialTip type="info">
              Recomendamos usar uma imagem PNG com fundo transparente, tamanho 512x512 pixels para melhor qualidade.
            </TutorialTip>
          </TutorialStep>

          <TutorialStep number={3} title="Salve as Alterações">
            <p>O logo aparecerá nos documentos impressos, painel de chamada e no sistema.</p>
          </TutorialStep>
        </section>

        <TutorialImage 
          src={tutorialConfiguracoes} 
          alt="Configurações de personalização" 
          caption="Painel de personalização da clínica"
        />

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Configurando Documentos</h3>
          <p className="text-muted-foreground mb-4">
            Personalize como seus documentos impressos (receitas, atestados, etc.) são exibidos:
          </p>
          <TutorialChecklist items={[
            "Acesse Configurações → Documentos",
            "Escolha quais informações aparecem no cabeçalho",
            "Configure o texto do rodapé",
            "Visualize e salve as alterações"
          ]} />
        </section>

        <TutorialTip type="tip">
          Use imagens de alta qualidade em todos os materiais. O sistema aceita imagens nos formatos JPG, PNG e WebP.
        </TutorialTip>
      </div>
    ),
  },
  "cadastrando-profissionais": {
    title: "Cadastrando Profissionais",
    description: "Adicione médicos e profissionais à sua clínica com todos os dados necessários",
    readTime: "6 min",
    prevArticle: { slug: "personalizando-clinica", title: "Personalizando sua Clínica" },
    nextArticle: { slug: "configurando-horarios", title: "Configurando Horários de Atendimento" },
    content: (
      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Cadastro de Profissionais</h2>
          <p className="text-muted-foreground">
            Cadastre todos os profissionais que realizam atendimentos na sua clínica. 
            Cada profissional terá sua própria agenda e pode ter horários personalizados.
          </p>
        </section>

        <TutorialImage 
          src={tutorialAgenda} 
          alt="Tela de profissionais" 
          caption="Lista de profissionais cadastrados no sistema"
        />

        <section className="space-y-6">
          <h3 className="text-lg font-semibold text-foreground">Como Cadastrar</h3>
          
          <TutorialStep number={1} title="Acesse o Cadastro">
            <p>No menu lateral, vá em <strong>Cadastros → Profissionais</strong></p>
          </TutorialStep>

          <TutorialStep number={2} title="Clique em Novo Profissional">
            <p>Use o botão <strong>+ Novo Profissional</strong> para abrir o formulário</p>
          </TutorialStep>

          <TutorialStep number={3} title="Preencha os Dados">
            <TutorialChecklist items={[
              "Nome completo do profissional",
              "Especialidade médica",
              "Conselho profissional (CRM, CRO, etc.)",
              "Número do registro",
              "Foto do profissional (opcional, mas recomendado)"
            ]} />
          </TutorialStep>

          <TutorialStep number={4} title="Configure os Procedimentos">
            <p>Selecione os procedimentos que o profissional realiza. Os preços podem ser personalizados.</p>
          </TutorialStep>
        </section>

        <TutorialTip type="warning">
          Profissionais só aparecem na agenda após terem horários de atendimento configurados. 
          Não esqueça de definir os horários após o cadastro!
        </TutorialTip>

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Vinculando Procedimentos</h3>
          <p className="text-muted-foreground mb-4">
            É importante vincular os procedimentos que cada profissional realiza:
          </p>
          <TutorialChecklist items={[
            "Na aba Procedimentos do cadastro",
            "Selecione os procedimentos da lista disponível",
            "Personalize os preços se necessário",
            "Salve as alterações"
          ]} />
        </section>
      </div>
    ),
  },
  "configurando-horarios": {
    title: "Configurando Horários de Atendimento",
    description: "Defina os horários de cada profissional para que a agenda funcione corretamente",
    readTime: "5 min",
    prevArticle: { slug: "cadastrando-profissionais", title: "Cadastrando Profissionais" },
    nextArticle: undefined,
    content: (
      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Horários de Atendimento</h2>
          <p className="text-muted-foreground">
            Configure os horários de atendimento de cada profissional para que a agenda funcione corretamente 
            e os pacientes possam ser agendados nos horários disponíveis.
          </p>
        </section>

        <TutorialImage 
          src={tutorialAgenda} 
          alt="Configuração de horários" 
          caption="Agenda com visualização dos horários configurados"
        />

        <section className="space-y-6">
          <h3 className="text-lg font-semibold text-foreground">Como Configurar</h3>
          
          <TutorialStep number={1} title="Acesse o Cadastro do Profissional">
            <p>Vá em <strong>Cadastros → Profissionais</strong> e clique no profissional desejado</p>
          </TutorialStep>

          <TutorialStep number={2} title="Abra a Aba Horários">
            <p>Clique na aba <strong>Horários</strong> para ver a configuração de disponibilidade</p>
          </TutorialStep>

          <TutorialStep number={3} title="Defina os Horários por Dia">
            <p className="mb-2">Para cada dia da semana, configure:</p>
            <TutorialChecklist items={[
              "Horário de início do atendimento",
              "Horário de término",
              "Intervalo para almoço ou pausas",
              "Duração padrão de cada consulta"
            ]} />
          </TutorialStep>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Exemplo de Configuração</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Dia</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Manhã</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Tarde</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border">
                  <td className="py-3 px-4 text-muted-foreground">Segunda</td>
                  <td className="py-3 px-4 text-muted-foreground">08:00 - 12:00</td>
                  <td className="py-3 px-4 text-muted-foreground">14:00 - 18:00</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="py-3 px-4 text-muted-foreground">Terça</td>
                  <td className="py-3 px-4 text-muted-foreground">08:00 - 12:00</td>
                  <td className="py-3 px-4 text-muted-foreground">14:00 - 18:00</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="py-3 px-4 text-muted-foreground">Quarta</td>
                  <td className="py-3 px-4 text-muted-foreground">-</td>
                  <td className="py-3 px-4 text-muted-foreground">14:00 - 18:00</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Bloqueando Horários Específicos</h3>
          <p className="text-muted-foreground mb-4">
            Você pode bloquear horários específicos diretamente na agenda:
          </p>
          <TutorialChecklist items={[
            "Acesse a Agenda",
            "Clique no horário que deseja bloquear",
            "Selecione 'Bloquear horário'",
            "Adicione um motivo (opcional)"
          ]} />
        </section>

        <TutorialTip type="tip">
          Use os feriados configurados em <strong>Configurações → Feriados</strong> para bloquear automaticamente 
          dias específicos para todos os profissionais.
        </TutorialTip>
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
      <Card>
        <CardContent className="p-6 lg:p-8">
          {article.content}
        </CardContent>
      </Card>

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
