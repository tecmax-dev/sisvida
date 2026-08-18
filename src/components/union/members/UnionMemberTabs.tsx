import { cn } from "@/lib/utils";
import { User, Users, ShieldCheck, CreditCard, FileText, Calendar, Receipt } from "lucide-react";

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
  { id: 'cadastro', label: 'Cadastro', icon: User },
  { id: 'dependentes', label: 'Dependentes', icon: Users },
  { id: 'sindical', label: 'Dados Sindicais', icon: ShieldCheck },
  { id: 'carteirinha', label: 'Carteirinha', icon: CreditCard },
  { id: 'anexos', label: 'Anexos', icon: FileText },
  { id: 'agendamentos', label: 'Agendamentos', icon: Calendar },
  { id: 'contribuicoes', label: 'Contribuições', icon: Receipt },
];

export function UnionMemberTabs({ activeTab, onTabChange, memberId, hiddenTabs = [] }: UnionMemberTabsProps) {
  const visibleTabs = tabs.filter(tab => !hiddenTabs.includes(tab.id));

  return (
    <div className="bg-slate-50/50 rounded-xl border border-slate-200/60 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4 px-1">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Navegação</h3>
        <div className="h-1 w-8 bg-teal-500/20 rounded-full" />
      </div>
      <div className="flex flex-wrap gap-2">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "h-9 flex items-center gap-2 px-4 rounded-xl text-[11px] font-semibold transition-all duration-200 border",
                isActive
                  ? "bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-600/20 scale-[1.02]"
                  : "bg-white text-slate-600 border-slate-200 hover:border-teal-500/50 hover:bg-teal-50/30 hover:text-teal-700"
              )}
            >
              <Icon size={15} className={cn(isActive ? "text-white" : "text-slate-400")} />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>

  );
}
