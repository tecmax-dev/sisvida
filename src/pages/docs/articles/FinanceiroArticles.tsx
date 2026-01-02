import { Navigate, useParams, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, ArrowRight, Clock, Lightbulb, AlertCircle, TrendingUp, TrendingDown } from "lucide-react";

const articles: Record<string, {
  title: string;
  description: string;
  readTime: string;
  content: React.ReactNode;
  prevArticle?: { slug: string; title: string };
  nextArticle?: { slug: string; title: string };
}> = {
  "visao-geral-financeiro": {
    title: "Visão Geral do Financeiro",
    description: "Entenda como funciona o módulo financeiro e suas principais funcionalidades.",
    readTime: "4 min",
    content: (
      <div className="space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">O Módulo Financeiro</h2>
          <p className="text-muted-foreground mb-4">
            O módulo financeiro do Eclini permite gerenciar todas as movimentações da sua clínica, 
            incluindo receitas, despesas, contas a receber e fluxo de caixa.
          </p>
          <div className="bg-muted/50 rounded-lg p-4 border">
            <img 
              src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&h=400&fit=crop" 
              alt="Dashboard financeiro" 
              className="rounded-lg w-full"
            />
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Principais Recursos</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
              <TrendingUp className="h-6 w-6 text-green-600 mb-2" />
              <h4 className="font-medium text-foreground">Receitas</h4>
              <p className="text-sm text-muted-foreground">Controle de entradas e pagamentos recebidos</p>
            </div>
            <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/20">
              <TrendingDown className="h-6 w-6 text-red-600 mb-2" />
              <h4 className="font-medium text-foreground">Despesas</h4>
              <p className="text-sm text-muted-foreground">Registro de gastos e contas a pagar</p>
            </div>
            <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <span className="text-2xl">💳</span>
              <h4 className="font-medium text-foreground mt-1">Contas a Receber</h4>
              <p className="text-sm text-muted-foreground">Acompanhe valores pendentes</p>
            </div>
            <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
              <span className="text-2xl">📊</span>
              <h4 className="font-medium text-foreground mt-1">Relatórios</h4>
              <p className="text-sm text-muted-foreground">Análises e gráficos detalhados</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Acesso ao Módulo</h2>
          <p className="text-muted-foreground mb-4">
            Para acessar o módulo financeiro, clique em <strong>Financeiro</strong> no menu lateral. 
            Você terá acesso a diferentes abas para gerenciar cada aspecto das finanças.
          </p>
        </section>

        <Alert className="border-primary/20 bg-primary/5">
          <Lightbulb className="h-4 w-4 text-primary" />
          <AlertDescription>
            <strong>Dica:</strong> Configure os caixas e categorias antes de começar a registrar movimentações para manter tudo organizado.
          </AlertDescription>
        </Alert>
      </div>
    ),
    nextArticle: { slug: "lancando-receitas", title: "Lançando Receitas" }
  },
  "lancando-receitas": {
    title: "Lançando Receitas",
    description: "Aprenda a registrar pagamentos e receitas da clínica.",
    readTime: "5 min",
    content: (
      <div className="space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Registrando uma Receita</h2>
          <p className="text-muted-foreground mb-4">
            Para registrar uma nova receita, siga os passos:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-4">
            <li>Acesse <strong>Financeiro → Transações</strong></li>
            <li>Clique no botão <strong>"Nova Transação"</strong></li>
            <li>Selecione o tipo <strong>"Receita"</strong></li>
            <li>Preencha os dados e clique em <strong>"Salvar"</strong></li>
          </ol>
          <div className="bg-muted/50 rounded-lg p-4 border mt-4">
            <img 
              src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=400&fit=crop" 
              alt="Lançamento de receita" 
              className="rounded-lg w-full"
            />
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Campos do Lançamento</h2>
          <div className="space-y-3">
            <div className="p-3 bg-muted/50 rounded-lg border">
              <h4 className="font-medium text-foreground">Descrição</h4>
              <p className="text-sm text-muted-foreground">Identifique o motivo do recebimento</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border">
              <h4 className="font-medium text-foreground">Valor</h4>
              <p className="text-sm text-muted-foreground">Valor recebido</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border">
              <h4 className="font-medium text-foreground">Categoria</h4>
              <p className="text-sm text-muted-foreground">Ex: Consultas, Procedimentos, Convênios</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border">
              <h4 className="font-medium text-foreground">Caixa</h4>
              <p className="text-sm text-muted-foreground">Onde o valor será creditado</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border">
              <h4 className="font-medium text-foreground">Forma de Pagamento</h4>
              <p className="text-sm text-muted-foreground">Dinheiro, cartão, PIX, etc.</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Receitas Automáticas</h2>
          <p className="text-muted-foreground mb-4">
            Quando um atendimento é marcado como <strong>"Pago"</strong>, o sistema pode criar 
            automaticamente a receita correspondente, vinculando-a ao paciente e procedimento.
          </p>
        </section>

        <Alert className="border-amber-500/20 bg-amber-500/5">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            <strong>Importante:</strong> Sempre selecione o caixa correto para manter o controle preciso de cada conta.
          </AlertDescription>
        </Alert>
      </div>
    ),
    prevArticle: { slug: "visao-geral-financeiro", title: "Visão Geral do Financeiro" },
    nextArticle: { slug: "controlando-despesas", title: "Controlando Despesas" }
  },
  "controlando-despesas": {
    title: "Controlando Despesas",
    description: "Como registrar e acompanhar as despesas da clínica.",
    readTime: "4 min",
    content: (
      <div className="space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Registrando Despesas</h2>
          <p className="text-muted-foreground mb-4">
            Para registrar uma despesa, o processo é similar ao de receitas:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-4">
            <li>Acesse <strong>Financeiro → Transações</strong></li>
            <li>Clique no botão <strong>"Nova Transação"</strong></li>
            <li>Selecione o tipo <strong>"Despesa"</strong></li>
            <li>Preencha os dados e salve</li>
          </ol>
          <div className="bg-muted/50 rounded-lg p-4 border mt-4">
            <img 
              src="https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=800&h=400&fit=crop" 
              alt="Controle de despesas" 
              className="rounded-lg w-full"
            />
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Categorias de Despesas</h2>
          <p className="text-muted-foreground mb-4">
            Organize suas despesas por categorias para ter relatórios mais precisos:
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="p-3 bg-muted/50 rounded-lg border">
              <span className="text-lg">🏢</span>
              <p className="font-medium text-foreground mt-1">Aluguel</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border">
              <span className="text-lg">💡</span>
              <p className="font-medium text-foreground mt-1">Energia</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border">
              <span className="text-lg">👥</span>
              <p className="font-medium text-foreground mt-1">Folha de Pagamento</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border">
              <span className="text-lg">🧴</span>
              <p className="font-medium text-foreground mt-1">Materiais</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border">
              <span className="text-lg">📱</span>
              <p className="font-medium text-foreground mt-1">Telefone/Internet</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg border">
              <span className="text-lg">🔧</span>
              <p className="font-medium text-foreground mt-1">Manutenção</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Despesas Recorrentes</h2>
          <p className="text-muted-foreground mb-4">
            Para despesas que se repetem mensalmente (aluguel, contas fixas), 
            você pode configurar lançamentos recorrentes na aba <strong>"Recorrentes"</strong>.
          </p>
        </section>
      </div>
    ),
    prevArticle: { slug: "lancando-receitas", title: "Lançando Receitas" },
    nextArticle: { slug: "relatorios-financeiros", title: "Relatórios Financeiros" }
  },
  "relatorios-financeiros": {
    title: "Relatórios Financeiros",
    description: "Gere relatórios e análises para acompanhar a saúde financeira da clínica.",
    readTime: "4 min",
    content: (
      <div className="space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Tipos de Relatórios</h2>
          <p className="text-muted-foreground mb-4">
            O sistema oferece diversos tipos de relatórios financeiros:
          </p>
          <div className="space-y-3">
            <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <h4 className="font-medium text-foreground">📈 Fluxo de Caixa</h4>
              <p className="text-sm text-muted-foreground">Visualize entradas e saídas por período</p>
            </div>
            <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
              <h4 className="font-medium text-foreground">📊 DRE Simplificado</h4>
              <p className="text-sm text-muted-foreground">Demonstrativo de resultado do exercício</p>
            </div>
            <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
              <h4 className="font-medium text-foreground">💰 Contas a Receber</h4>
              <p className="text-sm text-muted-foreground">Valores pendentes por paciente/convênio</p>
            </div>
            <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <h4 className="font-medium text-foreground">📋 Extrato por Caixa</h4>
              <p className="text-sm text-muted-foreground">Movimentações detalhadas de cada conta</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Gerando um Relatório</h2>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-4">
            <li>Acesse <strong>Financeiro</strong></li>
            <li>Selecione o período desejado no filtro de datas</li>
            <li>Os gráficos e métricas são atualizados automaticamente</li>
            <li>Use o botão <strong>"Exportar"</strong> para baixar em Excel</li>
          </ol>
          <div className="bg-muted/50 rounded-lg p-4 border mt-4">
            <img 
              src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=400&fit=crop" 
              alt="Relatórios financeiros" 
              className="rounded-lg w-full"
            />
          </div>
        </section>

        <Alert className="border-primary/20 bg-primary/5">
          <Lightbulb className="h-4 w-4 text-primary" />
          <AlertDescription>
            <strong>Dica:</strong> Acompanhe os relatórios semanalmente para identificar tendências e tomar decisões mais assertivas.
          </AlertDescription>
        </Alert>
      </div>
    ),
    prevArticle: { slug: "controlando-despesas", title: "Controlando Despesas" }
  }
};

export default function FinanceiroArticle() {
  const { articleSlug } = useParams();
  
  if (!articleSlug || !articles[articleSlug]) {
    return <Navigate to="/ajuda/financeiro" replace />;
  }

  const article = articles[articleSlug];

  return (
    <div className="space-y-8">
      <Link 
        to="/ajuda/financeiro" 
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para Financeiro
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
            to={`/ajuda/financeiro/${article.prevArticle.slug}`}
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
            to={`/ajuda/financeiro/${article.nextArticle.slug}`}
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
