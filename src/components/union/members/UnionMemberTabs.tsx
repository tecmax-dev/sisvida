import { cn } from "@/lib/utils";

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

const tabs: { id: UnionMemberTab; label: string }[] = [
  { id: 'cadastro', label: 'Cadastro' },
  { id: 'dependentes', label: 'Dependentes' },
  { id: 'sindical', label: 'Dados Sindicais' },
  { id: 'carteirinha', label: 'Carteirinha' },
  { id: 'anexos', label: 'Anexos' },
  { id: 'agendamentos', label: 'Agendamentos' },
];

export function UnionMemberTabs({ activeTab, onTabChange, memberId, hiddenTabs = [] }: UnionMemberTabsProps) {
  const visibleTabs = tabs.filter(tab => !hiddenTabs.includes(tab.id));

  return (
    <div className="border-b bg-card">
      <nav className="flex gap-1 px-4 overflow-x-auto" aria-label="Tabs">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors relative",
              activeTab === tab.id
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
