import { cn } from "@/lib/utils";
import { User, Users, ShieldCheck, CreditCard, FileText, Calendar } from "lucide-react";

export type UnionMemberTab = 
  | 'cadastro' 
  | 'dependentes'
  | 'carteirinha'
  | 'anexos'
  | 'sindical'
  | 'agendamentos';

interface UnionMemberTabsProps {
  activeTab: UnionMemberTab;
  onTabChange: (tab: UnionMemberTab) => void;
  memberId: string;
  hiddenTabs?: UnionMemberTab[];
}

const tabs: { id: UnionMemberTab; label: string; icon: any }[] = [
  { id: 'cadastro', label: 'Cadastro', icon: User },
  { id: 'dependentes', label: 'Dependentes', icon: Users },
  { id: 'sindical', label: 'Dados Sindicais', icon: ShieldCheck },
  { id: 'carteirinha', label: 'Carteirinha', icon: CreditCard },
  { id: 'anexos', label: 'Anexos', icon: FileText },
  { id: 'agendamentos', label: 'Agendamentos', icon: Calendar },
];

export function UnionMemberTabs({ activeTab, onTabChange, memberId, hiddenTabs = [] }: UnionMemberTabsProps) {
  const visibleTabs = tabs.filter(tab => !hiddenTabs.includes(tab.id));

  return (
    <div className="bg-white rounded-xl border p-4 shadow-sm">
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">Navegação</h3>
      <div className="flex flex-wrap gap-1.5">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "h-8 flex items-center gap-1.5 px-3 rounded-full text-[11px] font-medium transition-all border",
                isActive
                  ? "bg-teal-50 text-teal-700 border-teal-100/50 shadow-sm"
                  : "bg-slate-50 text-slate-600 border-slate-100/50 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Icon size={14} className={cn(isActive ? "text-teal-600" : "text-slate-400")} />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
