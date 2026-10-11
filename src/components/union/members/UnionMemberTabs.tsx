import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { User, Users, ShieldCheck, CreditCard, FileText, Calendar, Receipt, History } from "lucide-react";

export type UnionMemberTab = 
  | 'cadastro' 
  | 'dependentes'
  | 'carteirinha'
  | 'anexos'
  | 'sindical'
  | 'agendamentos'
  | 'contribuicoes';

interface UnionMemberTabsProps {
  activeTab: UnionMemberTab;
  onTabChange: (tab: UnionMemberTab) => void;
  memberId: string;
  hiddenTabs?: UnionMemberTab[];
}

const tabs: { id: UnionMemberTab; label: string; icon: any }[] = [
  { id: 'cadastro', label: 'Dados pessoais e contato', icon: User },
  { id: 'sindical', label: 'Dados sindicais', icon: ShieldCheck },
  { id: 'dependentes', label: 'Dependentes', icon: Users },
  { id: 'carteirinha', label: 'Carteirinha digital', icon: CreditCard },
  { id: 'contribuicoes', label: 'Contribuições', icon: Receipt },
  { id: 'agendamentos', label: 'Agendamentos', icon: Calendar },
  { id: 'anexos', label: 'Documentos e anexos', icon: FileText },
];

const itemClass = (active: boolean) =>
  cn(
    "flex h-9 shrink-0 items-center gap-2.5 rounded-md px-3 text-[13px] transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active
      ? "bg-primary-soft font-medium text-primary lg:shadow-[inset_2px_0_0_hsl(var(--primary))]"
      : "text-muted-foreground hover:bg-muted hover:text-foreground"
  );

export function UnionMemberTabs({ activeTab, onTabChange, memberId, hiddenTabs = [] }: UnionMemberTabsProps) {
  const navigate = useNavigate();
  const visibleTabs = tabs.filter(tab => !hiddenTabs.includes(tab.id));

  return (
    <nav aria-label="Seções do associado" className="rounded-lg border bg-card p-1.5">
      <div className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              aria-current={isActive ? "page" : undefined}
              className={itemClass(isActive)}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {tab.label}
            </button>
          );
        })}
        {memberId && (
          <>
            <div className="mx-2 my-1 hidden border-t lg:block" />
            <button type="button" onClick={() => navigate(`/union/socios/${memberId}/auditoria`)} className={itemClass(false)}>
              <History className="h-4 w-4 shrink-0" />
              Contracheques e auditoria
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
