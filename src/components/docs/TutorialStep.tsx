import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";

interface TutorialStepProps {
  number: number;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function TutorialStep({ number, title, children, className }: TutorialStepProps) {
  return (
    <div className={cn("relative pl-12 pb-8 last:pb-0", className)}>
      {/* Step indicator */}
      <div className="absolute left-0 top-0 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-lg">
          {number}
        </div>
      </div>
      
      {/* Connector line */}
      <div className="absolute left-[15px] top-10 bottom-0 w-0.5 bg-border last:hidden" />
      
      {/* Content */}
      <div>
        <h4 className="font-semibold text-foreground text-lg mb-2">{title}</h4>
        <div className="text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

interface TutorialChecklistProps {
  items: string[];
  className?: string;
}

export function TutorialChecklist({ items, className }: TutorialChecklistProps) {
  return (
    <ul className={cn("space-y-2", className)}>
      {items.map((item, index) => (
        <li key={index} className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
          <span className="text-muted-foreground">{item}</span>
        </li>
      ))}
    </ul>
  );
}
