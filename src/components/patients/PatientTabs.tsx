import { cn } from "@/lib/utils";

export type PatientTab = 
  | 'cadastro' 
  | 'prontuario' 
  | 'anamnese' 
  | 'prescricoes' 
  | 'anexos' 
  | 'agendamentos';

interface PatientTabsProps {
  activeTab: PatientTab;
  onTabChange: (tab: PatientTab) => void;
  patientId: string;
}

const tabs: { id: PatientTab; label: string }[] = [
  { id: 'cadastro', label: 'Cadastro' },
  { id: 'prontuario', label: 'Prontuário' },
  { id: 'anamnese', label: 'Anamnese' },
  { id: 'prescricoes', label: 'Prescrições' },
  { id: 'anexos', label: 'Anexos' },
  { id: 'agendamentos', label: 'Agendamentos' },
];

export function PatientTabs({ activeTab, onTabChange, patientId }: PatientTabsProps) {
  return (
    <div className="border-b bg-card">
      <nav className="flex gap-1 px-4 overflow-x-auto" aria-label="Tabs">
        {tabs.map((tab) => (
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