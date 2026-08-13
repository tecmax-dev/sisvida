import {
  Calendar,
  Users,
  UserCircle,
  BarChart3,
  Settings,
  CreditCard,
  FileText,
  ClipboardList,
  Clock,
  UserCog,
  FileEdit,
  FilePlus2,
  DollarSign,
  Stethoscope,
  Warehouse,
  Percent,
  Monitor,
  Megaphone,
  CalendarOff,
  FlaskConical,
  HeartPulse,
  LayoutDashboard,
  MessageSquare,
  Stethoscope as StethoscopeIcon,
  ShieldCheck,
  ScrollText,
} from "lucide-react";
import { usePermissions, type Permission } from "@/hooks/usePermissions";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";

export interface MainNavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  permission?: Permission;
  addonKey?: string;
  featureKey?: string;
  highlight?: boolean;
}

export interface MainNavCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: MainNavItem[];
  color?: string;
  addonKey?: string;
}

export const mainNavCategories: MainNavCategory[] = [
  {
    id: "clinica",
    label: "Módulo Clínica",
    icon: StethoscopeIcon,
    color: "clinica",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Visão Geral", permission: "view_dashboard" },
      { href: "/dashboard/patients", icon: Users, label: "Pacientes", permission: "view_patients", highlight: true },
      { href: "/dashboard/calendar", icon: Calendar, label: "Agenda", permission: "scheduling" },
      { href: "/dashboard/waiting-list", icon: Clock, label: "Lista de Espera", permission: "view_waiting_list" },
      { href: "/dashboard/fila-espera", icon: Clock, label: "Fila de Espera (FIFO)", permission: "view_waiting_list" },
      { href: "/dashboard/queue", icon: Monitor, label: "Painel/Totem", permission: "view_queue" },
      { href: "/dashboard/professionals", icon: UserCircle, label: "Profissionais", permission: "view_professionals" },
      { href: "/dashboard/procedures", icon: Stethoscope, label: "Procedimentos", permission: "view_procedures" },
      { href: "/dashboard/exams", icon: FlaskConical, label: "Exames", permission: "view_procedures" },
      { href: "/dashboard/anamnesis", icon: ClipboardList, label: "Anamnese", permission: "view_anamnesis" },
      { href: "/dashboard/anamnesis-templates", icon: FileEdit, label: "Templates Anamnese", permission: "view_anamnesis", featureKey: "dynamic_anamnesis" },
      { href: "/dashboard/anamnesis-dynamic", icon: FilePlus2, label: "Anamnese Dinâmica", permission: "view_anamnesis", featureKey: "dynamic_anamnesis" },
      { href: "/dashboard/medical-records", icon: FileText, label: "Prontuário", permission: "view_medical_records" },
      { href: "/dashboard/whatsapp-atendimento", icon: MessageSquare, label: "Atendimento WhatsApp", permission: "view_dashboard" },
    ],
  },
  {
    id: "admin",
    label: "Administrativo",
    icon: ShieldCheck,
    color: "admin",
    items: [
      { href: "/dashboard/financials", icon: DollarSign, label: "Financeiro Clínica", permission: "view_financials" },
      { href: "/dashboard/repass", icon: Percent, label: "Repasse Médico", permission: "view_repass" },
      { href: "/dashboard/stock", icon: Warehouse, label: "Estoque", permission: "view_stock" },
      { href: "/dashboard/insurance", icon: CreditCard, label: "Convênios", permission: "insurance_plans" },
      { href: "/dashboard/reports", icon: BarChart3, label: "Relatórios", permission: "view_reports" },
      { href: "/dashboard/reports/appointments", icon: Calendar, label: "Relatório Consultas", permission: "view_reports" },
      { href: "/dashboard/marketing", icon: Megaphone, label: "Marketing", permission: "view_marketing" },
      { href: "/dashboard/users", icon: UserCog, label: "Usuários", permission: "manage_users" },
      { href: "/dashboard/holidays", icon: CalendarOff, label: "Feriados", permission: "manage_settings" },
      { href: "/dashboard/subscription", icon: CreditCard, label: "Meu Plano", permission: "manage_subscription" },
      { href: "/union/auditoria", icon: ScrollText, label: "Auditoria", permission: "view_audit" },
      { href: "/dashboard/settings", icon: Settings, label: "Configurações", permission: "change_password" },
    ],
  },
];

export function useMainNavCategories(): MainNavCategory[] {
  const { hasPermission } = usePermissions();
  const { hasAddon, hasFeature } = usePlanFeatures();

  return mainNavCategories
    .filter((c) => !c.addonKey || hasAddon(c.addonKey))
    .map((c) => ({
      ...c,
      items: c.items.filter((i) => {
        if (i.permission && !hasPermission(i.permission)) return false;
        if (i.addonKey && !hasAddon(i.addonKey)) return false;
        if (i.featureKey && !hasFeature(i.featureKey)) return false;
        return true;
      }),
    }))
    .filter((c) => c.items.length > 0);
}