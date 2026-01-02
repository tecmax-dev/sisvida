import { Navigate, useParams, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, ArrowRight, Clock, Lightbulb, AlertCircle, CheckCircle2, MessageSquare } from "lucide-react";

const articles: Record<string, {
  title: string;
  description: string;
  readTime: string;
  content: React.ReactNode;
  prevArticle?: { slug: string; title: string };
  nextArticle?: { slug: string; title: string };
}> = {
  "configurando-whatsapp": {
    title: "Configurando o WhatsApp",
    description: "Passo a passo para integrar o WhatsApp à sua clínica.",
    readTime: "6 min",
    content: (
      <div className="space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Provedores Disponíveis</h2>
          <p className="text-muted-foreground mb-4">
            O Eclini oferece duas opções de integração com WhatsApp:
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
              <MessageSquare className="h-6 w-6 text-green-600 mb-2" />
              <h4 className="font-medium text-foreground">Evolution API</h4>
              <p className="text-sm text-muted-foreground">Solução gratuita usando seu próprio número</p>
            </div>
            <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <MessageSquare className="h-6 w-6 text-blue-600 mb-2" />
              <h4 className="font-medium text-foreground">Twilio</h4>
              <p className="text-sm text-muted-foreground">API oficial do WhatsApp Business</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Configurando Evolution API</h2>
          <p className="text-muted-foreground mb-4">
            Para configurar a Evolution API:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-4">
            <li>Acesse <strong>Configurações → WhatsApp</strong></li>
            <li>Selecione <strong>"Evolution API"</strong></li>
            <li>Informe a URL da sua instância e a API Key</li>
            <li>Clique em <strong>"Conectar"</strong></li>
            <li>Escaneie o QR Code com seu WhatsApp</li>
          </ol>
          <div className="bg-muted/50 rounded-lg p-4 border mt-4">
            <img 
              src="https://images.unsplash.com/photo-1611746872915-64382b5c76da?w=800&h=400&fit=crop" 
              alt="Configuração WhatsApp" 
              className="rounded-lg w-full"
            />
          </div>
        </section>

        <Alert className="border-amber-500/20 bg-amber-500/5">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            <strong>Importante:</strong> É necessário ter uma instância da Evolution API rodando em um servidor. 
            Consulte a documentação oficial para configuração.
          </AlertDescription>
        </Alert>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Verificando a Conexão</h2>
          <p className="text-muted-foreground mb-4">
            Após conectar, você verá o status "Conectado" em verde. 
            Se a conexão cair, basta escanear o QR Code novamente.
          </p>
        </section>
      </div>
    ),
    nextArticle: { slug: "lembretes-automaticos", title: "Lembretes Automáticos" }
  },
  "lembretes-automaticos": {
    title: "Lembretes Automáticos",
    description: "Configure o envio automático de lembretes de consulta.",
    readTime: "4 min",
    content: (
      <div className="space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Como Funciona</h2>
          <p className="text-muted-foreground mb-4">
            O sistema envia lembretes automáticos de consulta via WhatsApp, 
            ajudando a reduzir faltas e melhorar a comunicação com os pacientes.
          </p>
          <div className="bg-muted/50 rounded-lg p-4 border">
            <img 
              src="https://images.unsplash.com/photo-1577563908411-5077b6dc7624?w=800&h=400&fit=crop" 
              alt="Lembretes automáticos" 
              className="rounded-lg w-full"
            />
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Configurando Lembretes</h2>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-4">
            <li>Acesse <strong>Configurações → Geral</strong></li>
            <li>Ative a opção <strong>"Lembretes de Consulta"</strong></li>
            <li>Defina quantas horas antes da consulta o lembrete será enviado</li>
            <li>Personalize a mensagem se desejar</li>
          </ol>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Variáveis Disponíveis</h2>
          <p className="text-muted-foreground mb-4">
            Use variáveis para personalizar a mensagem:
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="p-2 bg-muted/50 rounded border font-mono text-sm">
              {"{nome}"} - Nome do paciente
            </div>
            <div className="p-2 bg-muted/50 rounded border font-mono text-sm">
              {"{data}"} - Data da consulta
            </div>
            <div className="p-2 bg-muted/50 rounded border font-mono text-sm">
              {"{horario}"} - Horário da consulta
            </div>
            <div className="p-2 bg-muted/50 rounded border font-mono text-sm">
              {"{profissional}"} - Nome do profissional
            </div>
            <div className="p-2 bg-muted/50 rounded border font-mono text-sm">
              {"{clinica}"} - Nome da clínica
            </div>
            <div className="p-2 bg-muted/50 rounded border font-mono text-sm">
              {"{endereco}"} - Endereço da clínica
            </div>
          </div>
        </section>

        <Alert className="border-primary/20 bg-primary/5">
          <Lightbulb className="h-4 w-4 text-primary" />
          <AlertDescription>
            <strong>Dica:</strong> Configure o lembrete para 24 horas antes. Isso dá tempo suficiente para o paciente se organizar ou remarcar se necessário.
          </AlertDescription>
        </Alert>
      </div>
    ),
    prevArticle: { slug: "configurando-whatsapp", title: "Configurando o WhatsApp" },
    nextArticle: { slug: "confirmacao-consultas", title: "Confirmação de Consultas" }
  },
  "confirmacao-consultas": {
    title: "Confirmação de Consultas",
    description: "Permita que pacientes confirmem ou cancelem consultas via WhatsApp.",
    readTime: "4 min",
    content: (
      <div className="space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Confirmação Interativa</h2>
          <p className="text-muted-foreground mb-4">
            Quando o lembrete é enviado, o paciente pode confirmar ou cancelar 
            a consulta diretamente pelo WhatsApp.
          </p>
          <div className="bg-green-500/10 p-4 rounded-lg border border-green-500/20">
            <p className="text-sm text-foreground mb-2">Exemplo de mensagem:</p>
            <div className="bg-background p-3 rounded-lg border text-sm">
              <p>Olá Maria! 👋</p>
              <p className="mt-2">Lembramos da sua consulta amanhã às 14:00 com Dr. João.</p>
              <p className="mt-2">Responda:</p>
              <p><strong>1</strong> - Confirmar presença ✅</p>
              <p><strong>2</strong> - Cancelar consulta ❌</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Status na Agenda</h2>
          <p className="text-muted-foreground mb-4">
            Quando o paciente responde, o status é atualizado automaticamente na agenda:
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="text-foreground">Confirmado - Paciente confirmou presença</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <span className="text-foreground">Cancelado - Paciente cancelou a consulta</span>
            </div>
          </div>
        </section>

        <div className="bg-muted/50 rounded-lg p-4 border">
          <img 
            src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=400&fit=crop" 
            alt="Confirmação de consultas" 
            className="rounded-lg w-full"
          />
        </div>

        <Alert className="border-primary/20 bg-primary/5">
          <Lightbulb className="h-4 w-4 text-primary" />
          <AlertDescription>
            <strong>Dica:</strong> Configure notificações para ser avisado quando uma consulta for cancelada, assim você pode oferecer o horário para outros pacientes.
          </AlertDescription>
        </Alert>
      </div>
    ),
    prevArticle: { slug: "lembretes-automaticos", title: "Lembretes Automáticos" },
    nextArticle: { slug: "mensagens-aniversario", title: "Mensagens de Aniversário" }
  },
  "mensagens-aniversario": {
    title: "Mensagens de Aniversário",
    description: "Envie automaticamente mensagens de felicitações aos pacientes.",
    readTime: "3 min",
    content: (
      <div className="space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Ativando o Recurso</h2>
          <p className="text-muted-foreground mb-4">
            O Eclini pode enviar automaticamente mensagens de aniversário para seus pacientes:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-4">
            <li>Acesse <strong>Configurações → Geral</strong></li>
            <li>Ative a opção <strong>"Mensagens de Aniversário"</strong></li>
            <li>Personalize a mensagem de felicitações</li>
            <li>Opcionalmente, adicione uma imagem personalizada</li>
          </ol>
        </section>

        <div className="bg-muted/50 rounded-lg p-4 border">
          <img 
            src="https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&h=400&fit=crop" 
            alt="Mensagem de aniversário" 
            className="rounded-lg w-full"
          />
        </div>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Personalizando a Mensagem</h2>
          <p className="text-muted-foreground mb-4">
            Use variáveis para tornar a mensagem mais pessoal:
          </p>
          <div className="bg-green-500/10 p-4 rounded-lg border border-green-500/20">
            <p className="text-sm text-foreground mb-2">Exemplo de mensagem:</p>
            <div className="bg-background p-3 rounded-lg border text-sm">
              <p>🎂 Feliz Aniversário, {"{nome}"}!</p>
              <p className="mt-2">A equipe da {"{clinica}"} deseja a você um dia repleto de alegrias e realizações!</p>
              <p className="mt-2">Que este novo ciclo seja cheio de saúde e felicidade! 🎉</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Histórico de Envios</h2>
          <p className="text-muted-foreground mb-4">
            Você pode acompanhar o histórico de mensagens enviadas no Dashboard, 
            na seção "Mensagens de Aniversário".
          </p>
        </section>

        <Alert className="border-primary/20 bg-primary/5">
          <Lightbulb className="h-4 w-4 text-primary" />
          <AlertDescription>
            <strong>Dica:</strong> Adicione uma imagem personalizada com a logo da sua clínica para fortalecer sua marca!
          </AlertDescription>
        </Alert>
      </div>
    ),
    prevArticle: { slug: "confirmacao-consultas", title: "Confirmação de Consultas" }
  }
};

export default function WhatsAppArticle() {
  const { articleSlug } = useParams();
  
  if (!articleSlug || !articles[articleSlug]) {
    return <Navigate to="/ajuda/whatsapp" replace />;
  }

  const article = articles[articleSlug];

  return (
    <div className="space-y-8">
      <Link 
        to="/ajuda/whatsapp" 
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para WhatsApp
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
            to={`/ajuda/whatsapp/${article.prevArticle.slug}`}
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
            to={`/ajuda/whatsapp/${article.nextArticle.slug}`}
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
