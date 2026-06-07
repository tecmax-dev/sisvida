import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Copy, CheckCircle2, ShieldCheck, AlertTriangle, ExternalLink } from "lucide-react";

type Btn =
  | { type: "QUICK_REPLY"; text: string }
  | { type: "URL"; text: string; url: string; example?: string };

interface Tpl {
  name: string;
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
  language: string;
  header?: string;
  body: string;
  footer?: string;
  bodyExamples: string[]; // example for each {{n}} in body order
  buttons?: Btn[];
  priority: 1 | 2 | 3; // 1 = crítico (dia 1)
  notes?: string;
}

const TEMPLATES: Tpl[] = [
  {
    name: "boleto_mensalidade",
    category: "UTILITY",
    language: "pt_BR",
    body:
      "Olá, segue a sua mensalidade do Sindicato dos Comerciários.\n\nOs detalhes (mês de referência, valor, vencimento e link de pagamento) serão enviados na próxima mensagem.\n\nQualquer dúvida, estamos à disposição.",
    footer: "Sindicato dos Comerciários",
    bodyExamples: [],
    priority: 1,
  },
  {
    name: "boleto_vencido",
    category: "UTILITY",
    language: "pt_BR",
    body:
      "Olá, identificamos que existe uma mensalidade do Sindicato dos Comerciários em aberto na sua conta.\n\nOs detalhes (mês, valor atualizado, vencimento e link de regularização) serão enviados na próxima mensagem.",
    footer: "Sindicato dos Comerciários",
    bodyExamples: [],
    priority: 1,
  },
  {
    name: "lembrete_consulta_v2",
    category: "UTILITY",
    language: "pt_BR",
    body:
      "Olá, este é um lembrete de uma consulta agendada no Sindicato dos Comerciários.\n\nOs dados completos (profissional, especialidade, data, horário e local) serão enviados na próxima mensagem.\n\nPedimos a gentileza de confirmar a sua presença pelos botões abaixo.",
    footer: "Sindicato dos Comerciários",
    bodyExamples: [],
    buttons: [
      { type: "QUICK_REPLY", text: "Confirmar" },
      { type: "QUICK_REPLY", text: "Cancelar" },
    ],
    priority: 1,
  },
  {
    name: "confirmacao_agendamento",
    category: "UTILITY",
    language: "pt_BR",
    body:
      "Olá, a sua consulta no Sindicato dos Comerciários foi agendada com sucesso.\n\nOs dados completos (profissional, especialidade, data, horário e local) serão enviados na próxima mensagem.",
    footer: "Sindicato dos Comerciários",
    bodyExamples: [],
    priority: 2,
  },
  {
    name: "carteira_vencendo",
    category: "UTILITY",
    language: "pt_BR",
    body:
      "Olá, a sua carteirinha do Sindicato dos Comerciários está próxima do vencimento.\n\nPara manter o acesso aos benefícios, regularize a renovação no aplicativo. A data exata será enviada na próxima mensagem.",
    footer: "Sindicato dos Comerciários",
    bodyExamples: [],
    priority: 2,
    notes: "Originalmente MARKETING — recriar como UTILITY (renovação é transacional).",
  },
  {
    name: "carteira_vencida",
    category: "UTILITY",
    language: "pt_BR",
    body:
      "Olá, a sua carteirinha do Sindicato dos Comerciários está vencida.\n\nPara reativar o acesso aos benefícios, regularize a renovação pelo aplicativo. A data de vencimento será enviada na próxima mensagem.",
    footer: "Sindicato dos Comerciários",
    bodyExamples: [],
    priority: 2,
  },
  {
    name: "autorizacao_pronta",
    category: "UTILITY",
    language: "pt_BR",
    body:
      "Olá, a sua autorização emitida pelo Sindicato dos Comerciários está disponível.\n\nOs dados completos (tipo, profissional e validade) serão enviados na próxima mensagem. Acesse o aplicativo para visualizar e imprimir.",
    footer: "Sindicato dos Comerciários",
    bodyExamples: [],
    priority: 3,
  },
  {
    name: "filiacao_aprovada",
    category: "UTILITY",
    language: "pt_BR",
    body:
      "Olá, a sua filiação ao Sindicato dos Comerciários foi aprovada.\n\nA matrícula e o plano contratado serão enviados na próxima mensagem. Seja bem-vindo(a). Acesse o aplicativo para utilizar os benefícios.",
    footer: "Sindicato dos Comerciários",
    bodyExamples: [],
    priority: 3,
  },
  {
    name: "carteirinha_atualizada",
    category: "UTILITY",
    language: "pt_BR",
    body:
      "Olá, a sua carteirinha do Sindicato dos Comerciários foi renovada com sucesso.\n\nA nova validade será enviada na próxima mensagem. Acesse o aplicativo para visualizar.",
    footer: "Sindicato dos Comerciários",
    bodyExamples: [],
    priority: 3,
  },
  {
    name: "contracheque_aprovado",
    category: "UTILITY",
    language: "pt_BR",
    body:
      "Olá, o seu contracheque foi recebido e aprovado pelo Sindicato dos Comerciários.\n\nObrigado por manter os seus dados atualizados.",
    footer: "Sindicato dos Comerciários",
    bodyExamples: [],
    priority: 3,
  },
  {
    name: "carteirinha_recusada",
    category: "UTILITY",
    language: "pt_BR",
    body:
      "Olá, a sua solicitação de renovação da carteirinha do Sindicato dos Comerciários não pôde ser concluída.\n\nO motivo será enviado na próxima mensagem. Reenvie o documento atualizado pelo aplicativo.",
    footer: "Sindicato dos Comerciários",
    bodyExamples: [],
    priority: 3,
  },
  {
    name: "homologacao_lembrete_v3",
    category: "UTILITY",
    language: "pt_BR",
    body:
      "Olá, este é um lembrete de um atendimento de homologação agendado no Sindicato dos Comerciários.\n\nOs dados completos (funcionário, empresa, data, horário e responsável) serão enviados na próxima mensagem. Confirme presença pelos botões abaixo.",
    footer: "Sindicato dos Comerciários",
    bodyExamples: [],
    buttons: [
      { type: "QUICK_REPLY", text: "Confirmar" },
      { type: "QUICK_REPLY", text: "Cancelar" },
      { type: "URL", text: "Reagendar", url: "https://prosindweb.com.br/agendamento/profissional/{{1}}", example: "andrea-matos" },
    ],
    priority: 3,
  },
  {
    name: "homologacao_lembrete_profissional_v3",
    category: "UTILITY",
    language: "pt_BR",
    body:
      "Olá, lembrete de atendimento de homologação na sua agenda no Sindicato dos Comerciários.\n\nOs dados completos (funcionário, empresa, data e horário) serão enviados na próxima mensagem.",
    footer: "Sindicato dos Comerciários",
    bodyExamples: [],
    buttons: [
      { type: "QUICK_REPLY", text: "Confirmar" },
      { type: "QUICK_REPLY", text: "Cancelar" },
    ],
    priority: 3,
  },
  {
    name: "homologacao_confirmacao",
    category: "UTILITY",
    language: "pt_BR",
    body:
      "Olá, o atendimento de homologação foi confirmado no Sindicato dos Comerciários.\n\nOs dados completos (funcionário, empresa, data, horário e responsável) serão enviados na próxima mensagem.",
    footer: "Sindicato dos Comerciários",
    bodyExamples: [],
    priority: 3,
  },
  {
    name: "homologacao_protocolo",
    category: "UTILITY",
    language: "pt_BR",
    body:
      "Olá, o atendimento de homologação foi concluído no Sindicato dos Comerciários.\n\nOs dados completos (funcionário, empresa, data e número de protocolo) serão enviados na próxima mensagem.",
    footer: "Sindicato dos Comerciários",
    bodyExamples: [],
    priority: 3,
  },
  {
    name: "cancelamento_consulta_profissional",
    category: "UTILITY",
    language: "pt_BR",
    body:
      "Olá, informamos que uma consulta agendada no Sindicato dos Comerciários precisou ser cancelada.\n\nOs dados completos (profissional, especialidade, data, horário e motivo) serão enviados na próxima mensagem. Reagende pelo aplicativo no melhor horário para você.",
    footer: "Sindicato dos Comerciários",
    bodyExamples: [],
    priority: 3,
  },
  {
    name: "atendimento_encerrado_inatividade",
    category: "UTILITY",
    language: "pt_BR",
    body:
      "Olá, encerramos este atendimento do Sindicato dos Comerciários por inatividade.\n\nSe ainda precisar de ajuda, envie uma nova mensagem que retornaremos o atendimento.",
    footer: "Sindicato dos Comerciários",
    bodyExamples: [],
    priority: 3,
  },
  {
    name: "iniciar_atendimento",
    category: "UTILITY",
    language: "pt_BR",
    body:
      "Olá, aqui é do Sindicato dos Comerciários. Precisamos falar com você sobre um assunto da sua filiação.\n\nToque em \"Falar com atendente\" abaixo para iniciar a conversa.",
    footer: "Sindicato dos Comerciários",
    bodyExamples: [],
    buttons: [
      { type: "QUICK_REPLY", text: "Falar com atendente" },
      { type: "QUICK_REPLY", text: "Agora não" },
    ],
    priority: 1,
    notes: "Use quando o sindicato precisa INICIAR uma conversa (fora da janela de 24h). O toque em 'Falar com atendente' abre a janela de 24h e o operador pode mandar mensagens livres.",
  },
  {
    name: "retomar_atendimento",
    category: "UTILITY",
    language: "pt_BR",
    body:
      "Olá, notamos que um atendimento do Sindicato dos Comerciários ficou pendente. Se ainda precisar de ajuda, é só tocar no botão abaixo que retornamos.",
    footer: "Sindicato dos Comerciários",
    bodyExamples: [],
    buttons: [
      { type: "QUICK_REPLY", text: "Continuar atendimento" },
    ],
    priority: 2,
    notes: "Reativa contato que parou de responder. Janela de 24h reabre quando o associado toca no botão.",
  },
];

const VAGA_PROFESSIONALS: { slug: string; nome: string }[] = [
  { slug: "daniela_sales", nome: "Dra. Daniela Sales" },
  { slug: "eliney_silva", nome: "Dr. Eliney Silva" },
  { slug: "jorge_avelar", nome: "Dr. Jorge Avelar" },
  { slug: "jose_alcides", nome: "Dr. José Alcides" },
  { slug: "juliane_leite", nome: "Dra. Juliane Leite" },
  { slug: "marcelo_aguiar", nome: "Dr. Marcelo Aguiar" },
  { slug: "pedro_roberto", nome: "Dr. Pedro Roberto" },
  { slug: "uiara_tiuba", nome: "Dra. Uiara Tiuba" },
];

for (const p of VAGA_PROFESSIONALS) {
  TEMPLATES.push({
    name: `vaga_medica_${p.slug}`,
    category: "UTILITY",
    language: "pt_BR",
    body:
      `Olá, abriu uma vaga de consulta com ${p.nome} no Sindicato dos Comerciários.\n\nA data e o horário disponíveis serão enviados na próxima mensagem. Se tiver interesse, acesse o aplicativo para reservar o horário.`,
    footer: "Sindicato dos Comerciários",
    bodyExamples: [],
    buttons: [
      { type: "URL", text: "Acessar Aplicativo", url: "https://prosindweb.com.br/" },
    ],
    priority: 3,
    notes: "Um template por profissional ativo. Originalmente jorge_avelar foi classificado como MARKETING — texto acima é utilitário (notificação de vaga reservada para associado).",
  });
}

function CopyBtn({ value, label = "Copiar" }: { value: string; label?: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        toast({ title: "Copiado!" });
        setTimeout(() => setCopied(false), 1500);
      }}
      className="gap-2"
    >
      {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copiado" : label}
    </Button>
  );
}

function TemplateCard({ t }: { t: Tpl }) {
  const catColor =
    t.category === "UTILITY"
      ? "bg-blue-500/10 text-blue-600 border-blue-500/30"
      : t.category === "MARKETING"
      ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
      : "bg-purple-500/10 text-purple-600 border-purple-500/30";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="font-mono text-base flex items-center gap-2">
              {t.name}
              <CopyBtn value={t.name} label="Nome" />
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className={catColor}>{t.category}</Badge>
              <Badge variant="outline">{t.language}</Badge>
              {t.priority === 1 && <Badge className="bg-red-500/10 text-red-600 border-red-500/30" variant="outline">Prioridade 1 — Dia 1</Badge>}
              {t.priority === 2 && <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/30" variant="outline">Prioridade 2 — Dia 2-3</Badge>}
              {t.priority === 3 && <Badge variant="outline">Prioridade 3</Badge>}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <section>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-muted-foreground">CORPO (BODY)</p>
            <CopyBtn value={t.body} />
          </div>
          <pre className="whitespace-pre-wrap text-sm bg-muted p-3 rounded-md border">{t.body}</pre>
        </section>

        {t.footer && (
          <section>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-muted-foreground">RODAPÉ (FOOTER)</p>
              <CopyBtn value={t.footer} />
            </div>
            <pre className="whitespace-pre-wrap text-sm bg-muted p-3 rounded-md border">{t.footer}</pre>
          </section>
        )}

        {t.bodyExamples.length > 0 && (
          <section>
            <p className="text-xs font-semibold text-muted-foreground mb-2">EXEMPLOS DE VARIÁVEIS (Body)</p>
            <div className="grid gap-2">
              {t.bodyExamples.map((ex, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground w-12">{`{{${i + 1}}}`}</span>
                  <Input readOnly value={ex} className="h-8 text-sm font-mono" />
                  <CopyBtn value={ex} label="" />
                </div>
              ))}
            </div>
          </section>
        )}

        {t.buttons && t.buttons.length > 0 && (
          <section>
            <p className="text-xs font-semibold text-muted-foreground mb-2">BOTÕES</p>
            <div className="space-y-2">
              {t.buttons.map((b, i) => (
                <div key={i} className="border rounded-md p-3 bg-muted/40 space-y-2">
                  <Badge variant="outline">{b.type === "QUICK_REPLY" ? "Resposta rápida" : "URL dinâmica"}</Badge>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-20">Texto:</span>
                    <Input readOnly value={b.text} className="h-8 text-sm" />
                    <CopyBtn value={b.text} label="" />
                  </div>
                  {b.type === "URL" && (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-20">URL:</span>
                        <Input readOnly value={b.url} className="h-8 text-sm font-mono" />
                        <CopyBtn value={b.url} label="" />
                      </div>
                      {b.example && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-20">Exemplo {`{{1}}`}:</span>
                          <Input readOnly value={b.example} className="h-8 text-sm font-mono" />
                          <CopyBtn value={b.example} label="" />
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {t.notes && (
          <div className="flex gap-2 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 p-3 rounded-md">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{t.notes}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function WhatsAppTemplatesGuidePage() {
  const [filter, setFilter] = useState("");
  const filtered = TEMPLATES.filter(t =>
    t.name.toLowerCase().includes(filter.toLowerCase())
  ).sort((a, b) => a.priority - b.priority);

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Guia de Criação Manual de Templates</h1>
        <p className="text-muted-foreground">
          Conteúdo pronto para copiar e colar no WhatsApp Manager da Meta — otimizado para aprovação e baixo risco de banimento.
        </p>
      </div>

      <Card className="border-green-500/30 bg-green-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <ShieldCheck className="h-5 w-5" /> Regras anti-banimento (siga à risca)
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>1. <strong>Máximo 2 templates por dia.</strong> Comece pelos de prioridade 1.</p>
          <p>2. <strong>Sempre categoria UTILITY</strong> para tudo que for transacional (boleto, lembrete, autorização). MARKETING só para promocional puro.</p>
          <p>3. <strong>Nunca</strong> use bit.ly, caixa alta agressiva, "GRÁTIS!!!", spam, ou texto vago.</p>
          <p>4. Use sempre os <strong>exemplos reais</strong> abaixo nos campos "Adicionar exemplo" — Meta valida.</p>
          <p>5. <strong>Aguarde aprovação</strong> antes de criar o próximo lote. Não crie em rajada.</p>
          <p>6. Os apelos das WABAs v1/v2 devem estar <strong>aprovados</strong> antes de qualquer cadastro.</p>
          <p>7. <strong>Sem variáveis no corpo.</strong> Os textos abaixo já estão 100% estáticos — os dados dinâmicos (nome, valor, data, etc.) vão numa mensagem livre logo após, dentro da janela de 24h que o template abre.</p>
          <p className="pt-2">
            <a
              href="https://business.facebook.com/wa/manage/message-templates/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Abrir WhatsApp Manager <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </CardContent>
      </Card>

      <div className="sticky top-0 bg-background/90 backdrop-blur z-10 py-3 -mx-2 px-2 border-b">
        <Input
          placeholder="Filtrar por nome..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-md"
        />
        <p className="text-xs text-muted-foreground mt-1">
          {filtered.length} de {TEMPLATES.length} templates · Ordenados por prioridade
        </p>
      </div>

      <Separator />

      <div className="grid gap-6">
        {filtered.map((t) => (
          <TemplateCard key={t.name} t={t} />
        ))}
      </div>
    </div>
  );
}