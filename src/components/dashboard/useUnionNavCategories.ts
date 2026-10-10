import {
  Building2,
  Users,
  Receipt,
  DollarSign,
  Handshake,
  FileText,
  ClipboardList,
  Wallet,
  Building,
  TrendingUp,
  ArrowLeftRight,
  Home,
  Gift,
  FileBarChart,
  History,
  ScrollText,
  UserPlus,
  Scale,
  Calendar,
  UserCircle,
  CalendarX,
  Settings,
  FolderTree,
  FileCheck2,
  FileCheck,
  Smartphone,
  Send,
  Download,
  Shield,
  Bell,
  MessageSquare,
  Mail,
  Inbox,
  Users2,
  Banknote,
  Gavel,
  BarChart3,
  SlidersHorizontal,
  Landmark,
  Megaphone,
  Contact,
  AlertTriangle,
} from "lucide-react";
import {
  useUnionPermissions,
  type UnionPermission,
} from "@/hooks/useUnionPermissions";

export interface UnionNavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  permission?: UnionPermission;
}

export interface UnionNavCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
  items: UnionNavItem[];
}

export const unionNavCategories: UnionNavCategory[] = [
  {
    id: "empresas",
    label: "Empresas",
    icon: Landmark,
    color: "empresas",
    items: [
      { href: "/union/empresas", icon: Building2, label: "Cadastro", permission: "union_view_employers" },
      { href: "/union/escritorios", icon: Building, label: "Escritórios", permission: "union_view_employers" },
      { href: "/union/planos", icon: ScrollText, label: "Planos", permission: "union_module_access" },
    ],
  },
  {
    id: "socios",
    label: "Sócios",
    icon: Users2,
    color: "socios",
    items: [
      { href: "/union/socios", icon: Users, label: "Gestão de Sócios", permission: "union_view_members" },
      { href: "/union/socios/contracheques", icon: FileCheck, label: "Contracheques", permission: "union_view_members" },
      { href: "/union/aprovacao-dependentes", icon: Shield, label: "Aprovação Dependentes", permission: "union_manage_members" },
      { href: "/union/beneficios", icon: Gift, label: "Benefícios", permission: "union_view_members" },
      { href: "/union/autorizacoes", icon: FileCheck2, label: "Autorizações", permission: "union_view_members" },
      { href: "/union/associados", icon: UserPlus, label: "Filiações Públicas", permission: "union_view_members" },
      { href: "/union/filiacoes", icon: ClipboardList, label: "Aprovação de Filiações", permission: "union_view_members" },
      { href: "/union/filiacoes/ciencia", icon: ClipboardList, label: "Ciência das Fichas", permission: "union_view_members" },
    ],
  },
  {
    id: "contribuicoes",
    label: "Contribuições",
    icon: Receipt,
    color: "contribuicoes",
    items: [
      { href: "/union/contribuicoes", icon: Receipt, label: "Gerenciamento", permission: "union_view_contributions" },
      { href: "/union/contribuicoes/relatorios", icon: FileBarChart, label: "Relatórios", permission: "union_view_contribution_reports" },
      { href: "/union/contribuicoes/emails", icon: Mail, label: "E-mails de alteração", permission: "union_view_contributions" },
      { href: "/union/contribuicoes/previsao", icon: TrendingUp, label: "Previsão de recebimento", permission: "union_view_contributions" },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro Sindical",
    icon: Banknote,
    color: "financeiro",
    items: [
      { href: "/union/financeiro", icon: Home, label: "Visão Geral", permission: "union_view_financials" },
      { href: "/union/financeiro/orcamento", icon: FileBarChart, label: "Previsão Orçamentária", permission: "union_view_financials" },
      { href: "/union/financeiro/despesas", icon: TrendingUp, label: "Despesas", permission: "union_view_expenses" },
      { href: "/union/financeiro/receitas", icon: TrendingUp, label: "Receitas", permission: "union_view_income" },
      { href: "/union/financeiro/movimentacao", icon: FileText, label: "Movimentação", permission: "union_view_cash_flow" },
      { href: "/union/financeiro/fluxo-caixa", icon: ArrowLeftRight, label: "Fluxo de Caixa", permission: "union_view_cash_flow" },
      { href: "/union/financeiro/contas", icon: Wallet, label: "Contas Bancárias", permission: "union_manage_cash_registers" },
      { href: "/union/financeiro/fornecedores", icon: Building, label: "Fornecedores", permission: "union_manage_suppliers" },
      { href: "/union/financeiro/categorias", icon: ClipboardList, label: "Categorias", permission: "union_manage_categories" },
      { href: "/union/financeiro/plano-contas", icon: FolderTree, label: "Plano de Contas", permission: "union_manage_categories" },
      { href: "/union/financeiro/historico-pagamentos", icon: History, label: "Histórico Pagamentos", permission: "union_view_financials" },
      { href: "/union/financeiro/conciliacao", icon: FileBarChart, label: "Conciliação Lytex", permission: "union_view_financials" },
      { href: "/union/financeiro/conciliacao-bancaria", icon: FileCheck2, label: "Conciliação Bancária", permission: "union_view_financials" },
      { href: "/union/financeiro/relatorios-lytex", icon: FileBarChart, label: "Relatórios Lytex", permission: "union_generate_reports" },
      { href: "/union/financeiro/relatorio-boletos", icon: FileBarChart, label: "Relatório de Boletos", permission: "union_generate_reports" },
      { href: "/union/financeiro/relatorios", icon: FileBarChart, label: "Relatórios", permission: "union_generate_reports" },
    ],
  },
  {
    id: "negociacoes",
    label: "Negociações",
    icon: Handshake,
    color: "negociacoes",
    items: [
      { href: "/union/negociacoes", icon: Handshake, label: "Acordos", permission: "union_view_negotiations" },
      { href: "/union/negociacoes/parcelamentos", icon: ScrollText, label: "Parcelamentos", permission: "union_view_installments" },
      { href: "/union/negociacoes/historico", icon: History, label: "Histórico", permission: "union_view_negotiations" },
    ],
  },
  {
    id: "homologacao",
    label: "Homologação",
    icon: Gavel,
    color: "homologacao",
    items: [
      { href: "/union/homologacao", icon: Calendar, label: "Agenda", permission: "union_module_access" },
      { href: "/union/homologacao/profissionais", icon: UserCircle, label: "Profissionais", permission: "union_module_access" },
      { href: "/union/homologacao/servicos", icon: ClipboardList, label: "Serviços", permission: "union_module_access" },
      { href: "/union/homologacao/bloqueios", icon: CalendarX, label: "Bloqueios", permission: "union_module_access" },
      { href: "/union/homologacao/config", icon: Settings, label: "Configurações", permission: "union_module_access" },
    ],
  },
  {
    id: "conteudoapp",
    label: "Conteúdo & App",
    icon: Megaphone,
    color: "conteudoapp",
    items: [
      { href: "/union/conteudo-app", icon: Smartphone, label: "Conteúdo do App", permission: "union_module_access" },
      { href: "/union/instalacoes-app", icon: Download, label: "Instalações do App", permission: "union_module_access" },
      { href: "/union/notificar-app", icon: Send, label: "Notificar Atualização", permission: "union_module_access" },
      { href: "/union/avisos-popup", icon: Bell, label: "Avisos Pop-up", permission: "union_module_access" },
      { href: "/union/email-marketing", icon: Mail, label: "E-mail em Massa", permission: "union_module_access" },
      { href: "/union/email-inbox", icon: Inbox, label: "Caixa de Entrada", permission: "union_module_access" },
      { href: "/union/sms", icon: MessageSquare, label: "SMS", permission: "union_module_access" },
    ],
  },
  {
    id: "juridico",
    label: "Jurídico",
    icon: Scale,
    color: "juridico",
    items: [
      { href: "/union/juridico", icon: Scale, label: "Dashboard", permission: "union_module_access" },
      { href: "/union/juridico/casos", icon: FileText, label: "Processos", permission: "union_module_access" },
      { href: "/union/juridico/advogados", icon: Users, label: "Advogados", permission: "union_module_access" },
      { href: "/union/juridico/escritorios", icon: Building, label: "Escritórios", permission: "union_module_access" },
      { href: "/union/juridico/prazos", icon: Calendar, label: "Prazos", permission: "union_module_access" },
      { href: "/union/juridico/despesas", icon: DollarSign, label: "Despesas", permission: "union_module_access" },
    ],
  },
  {
    id: "relatoriosSind",
    label: "Relatórios Sindicais",
    icon: BarChart3,
    color: "relatoriosSind",
    items: [
      { href: "/union/relatorios/associados", icon: Users, label: "Associados", permission: "union_view_members" },
      { href: "/union/relatorios/agendamentos", icon: Calendar, label: "Agendamentos", permission: "union_module_access" },
      { href: "/union/relatorios/uso-agendamentos", icon: BarChart3, label: "Uso dos Agendamentos", permission: "union_module_access" },
      { href: "/union/relatorios/inadimplencia", icon: AlertTriangle, label: "Empresas Inadimplentes", permission: "union_view_contribution_reports" },
      { href: "/union/relatorios/dependentes-sem-sexo", icon: AlertTriangle, label: "Dependentes sem Sexo", permission: "union_view_members" },
    ],
  },
  {
    id: "configSind",
    label: "Config. Sindical",
    icon: SlidersHorizontal,
    color: "configSind",
    items: [
      { href: "/union/configuracoes", icon: Settings, label: "Geral", permission: "union_module_access" },
      { href: "/union/configuracoes/feriados", icon: CalendarX, label: "Feriados", permission: "union_module_access" },
      { href: "/union/configuracoes/grupos-acesso", icon: Shield, label: "Grupos de Acesso", permission: "union_module_access" },
    ],
  },
  {
    id: "contatos",
    label: "Contatos",
    icon: Contact,
    color: "socios",
    items: [
      { href: "/union/contatos", icon: Users, label: "Contatos", permission: "union_module_access" },
    ],
  },
];

export function useUnionNavCategories(): UnionNavCategory[] {
  const { hasUnionPermission } = useUnionPermissions();

  return unionNavCategories
    .map((c) => ({
      ...c,
      items: c.items.filter((i) => !i.permission || hasUnionPermission(i.permission)),
    }))
    .filter((c) => c.items.length > 0);
}