import { Navigate, useParams, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Clock, FileText, FolderOpen, History, User } from "lucide-react";
import { TutorialImage } from "@/components/docs/TutorialImage";
import { TutorialStep, TutorialChecklist } from "@/components/docs/TutorialStep";
import { TutorialTip, TutorialCard } from "@/components/docs/TutorialCard";

// Import images
import tutorialPacientes from "@/assets/docs/tutorial-pacientes-pt.png";
import tutorialProntuario from "@/assets/docs/tutorial-prontuario-pt.png";

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
    description: "Aprenda a cadastrar novos pacientes no sistema de forma rápida e completa",
    readTime: "4 min",
    content: (
      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Cadastro de Pacientes</h2>
          <p className="text-muted-foreground">
            Para cadastrar um novo paciente, acesse o menu <strong>Cadastros → Pacientes</strong> e 
            clique no botão <strong>"Novo Paciente"</strong>.
          </p>
        </section>

        <TutorialImage 
          src={tutorialPacientes} 
          alt="Tela de cadastro de pacientes" 
          caption="Interface de cadastro de pacientes do Prosinge"
        />

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Dados Obrigatórios</h3>
          <p className="text-muted-foreground mb-4">Os campos essenciais para o cadastro são:</p>
          <TutorialChecklist items={[
            "Nome completo do paciente",
            "CPF (documento de identificação)",
            "Data de nascimento (para cálculo de idade)",
            "Telefone/WhatsApp (para contato e lembretes)",
            "E-mail (opcional, para comunicações)"
          ]} />
        </section>

        <TutorialTip type="tip">
          Ao digitar o CEP, o sistema preenche automaticamente o endereço completo do paciente!
        </TutorialTip>

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Cadastro Rápido</h3>
          <p className="text-muted-foreground mb-4">
            Para agilizar o atendimento, você pode usar o <strong>Cadastro Rápido</strong> diretamente 
            na tela de agendamento. Basta clicar em "Novo Paciente" e preencher apenas os dados essenciais.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Informações Adicionais</h3>
          <p className="text-muted-foreground mb-4">Além dos dados básicos, você pode registrar:</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <TutorialCard 
              icon={User} 
              title="Convênio" 
              description="Plano de saúde e número da carteira"
              color="blue"
            />
            <TutorialCard 
              icon={User} 
              title="Responsável" 
              description="Para pacientes menores de idade"
              color="violet"
            />
            <TutorialCard 
              icon={User} 
              title="Foto" 
              description="Foto para identificação visual"
              color="emerald"
            />
            <TutorialCard 
              icon={FileText} 
              title="Observações" 
              description="Notas importantes sobre o paciente"
              color="amber"
            />
          </div>
        </section>
      </div>
    ),
    nextArticle: { slug: "prontuario-eletronico", title: "Prontuário Eletrônico" }
  },
  "prontuario-eletronico": {
    title: "Prontuário Eletrônico",
    description: "Como acessar e gerenciar o prontuário eletrônico dos pacientes de forma completa",
    readTime: "5 min",
    content: (
      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Acessando o Prontuário</h2>
          <p className="text-muted-foreground mb-4">
            O prontuário eletrônico pode ser acessado de duas formas:
          </p>
          <TutorialChecklist items={[
            "Na lista de pacientes, clique no ícone de prontuário ao lado do nome",
            "Durante o atendimento, acesse a aba 'Prontuário' no painel do paciente"
          ]} />
        </section>

        <TutorialImage 
          src={tutorialProntuario} 
          alt="Prontuário eletrônico" 
          caption="Prontuário eletrônico com histórico completo do paciente"
        />

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Estrutura do Prontuário</h3>
          <p className="text-muted-foreground mb-4">O prontuário é organizado em seções:</p>
          <div className="space-y-3">
            <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
              <h4 className="font-medium text-foreground flex items-center gap-2">
                <span className="text-xl">📋</span> Anamnese
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                Histórico médico, alergias e medicamentos em uso
              </p>
            </div>
            <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/20">
              <h4 className="font-medium text-foreground flex items-center gap-2">
                <span className="text-xl">📝</span> Evoluções
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                Registros de cada consulta realizada
              </p>
            </div>
            <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/20">
              <h4 className="font-medium text-foreground flex items-center gap-2">
                <span className="text-xl">💊</span> Prescrições
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                Receitas e orientações médicas
              </p>
            </div>
            <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/20">
              <h4 className="font-medium text-foreground flex items-center gap-2">
                <span className="text-xl">📎</span> Anexos
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                Exames, laudos e documentos
              </p>
            </div>
          </div>
        </section>

        <TutorialTip type="warning">
          Todas as alterações no prontuário são registradas com data, hora e usuário responsável para auditoria completa.
        </TutorialTip>

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Adicionando Evoluções</h3>
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
    description: "Gerencie exames, laudos e documentos dos pacientes de forma organizada",
    readTime: "4 min",
    content: (
      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Enviando Anexos</h2>
          <p className="text-muted-foreground mb-4">
            Para anexar documentos ao prontuário do paciente, siga os passos:
          </p>
        </section>

        <section className="space-y-6">
          <TutorialStep number={1} title="Acesse o Cadastro do Paciente">
            <p>Vá em <strong>Cadastros → Pacientes</strong> e selecione o paciente</p>
          </TutorialStep>

          <TutorialStep number={2} title="Abra a Aba Anexos">
            <p>Clique na aba <strong>"Anexos"</strong></p>
          </TutorialStep>

          <TutorialStep number={3} title="Envie o Arquivo">
            <p>Clique em <strong>"Enviar Arquivo"</strong> e selecione o documento</p>
          </TutorialStep>

          <TutorialStep number={4} title="Organize em Pastas">
            <p>Escolha a pasta de destino para manter tudo organizado</p>
          </TutorialStep>
        </section>

        <TutorialImage 
          src={tutorialProntuario} 
          alt="Gerenciamento de anexos" 
          caption="Sistema de anexos organizado em pastas"
        />

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Organizando em Pastas</h3>
          <p className="text-muted-foreground mb-4">
            O sistema permite organizar os anexos em pastas personalizadas:
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="p-4 bg-muted/50 rounded-xl border text-center">
              <span className="text-3xl">🔬</span>
              <p className="font-medium mt-2">Exames</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-xl border text-center">
              <span className="text-3xl">📄</span>
              <p className="font-medium mt-2">Laudos</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-xl border text-center">
              <span className="text-3xl">📸</span>
              <p className="font-medium mt-2">Imagens</p>
            </div>
          </div>
        </section>

        <TutorialTip type="tip">
          Você pode criar pastas personalizadas clicando em "Nova Pasta" para organizar os documentos da forma que preferir.
        </TutorialTip>

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Formatos Suportados</h3>
          <TutorialChecklist items={[
            "Imagens: JPG, PNG, GIF, WEBP",
            "Documentos: PDF, DOC, DOCX",
            "Tamanho máximo: 10MB por arquivo"
          ]} />
        </section>
      </div>
    ),
    prevArticle: { slug: "prontuario-eletronico", title: "Prontuário Eletrônico" },
    nextArticle: { slug: "historico-atendimentos", title: "Histórico de Atendimentos" }
  },
  "historico-atendimentos": {
    title: "Histórico de Atendimentos",
    description: "Visualize todo o histórico de consultas e procedimentos do paciente",
    readTime: "3 min",
    content: (
      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">Visualizando o Histórico</h2>
          <p className="text-muted-foreground mb-4">
            O histórico completo de atendimentos pode ser acessado no cadastro do paciente, 
            na aba <strong>"Agendamentos"</strong>.
          </p>
        </section>

        <TutorialImage 
          src={tutorialPacientes} 
          alt="Histórico de atendimentos" 
          caption="Timeline de atendimentos do paciente com todos os detalhes"
        />

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Informações Exibidas</h3>
          <p className="text-muted-foreground mb-4">Para cada atendimento, você pode visualizar:</p>
          <div className="space-y-3">
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl">
              <span className="text-2xl">📅</span>
              <div>
                <p className="font-medium text-foreground">Data e Horário</p>
                <p className="text-sm text-muted-foreground">Quando a consulta ocorreu</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl">
              <span className="text-2xl">👨‍⚕️</span>
              <div>
                <p className="font-medium text-foreground">Profissional</p>
                <p className="text-sm text-muted-foreground">Quem realizou o atendimento</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl">
              <span className="text-2xl">🏥</span>
              <div>
                <p className="font-medium text-foreground">Procedimento</p>
                <p className="text-sm text-muted-foreground">Tipo de consulta ou procedimento</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl">
              <span className="text-2xl">✅</span>
              <div>
                <p className="font-medium text-foreground">Status</p>
                <p className="text-sm text-muted-foreground">Se foi realizado, cancelado ou faltou</p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">Filtros e Busca</h3>
          <p className="text-muted-foreground mb-4">
            Utilize os filtros para encontrar atendimentos específicos:
          </p>
          <TutorialChecklist items={[
            "Filtrar por período (data inicial e final)",
            "Filtrar por profissional específico",
            "Filtrar por status do agendamento",
            "Buscar por procedimento realizado"
          ]} />
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
