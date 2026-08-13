import { AlertTriangle, Info } from "lucide-react";
import type { AuthorizationBlockReason } from "@/lib/authorizationBlockReasons";

interface Props {
  reasons: AuthorizationBlockReason[];
  className?: string;
}

export function AuthorizationBlockNotice({ reasons, className }: Props) {
  if (!reasons.length) return null;

  return (
    <div
      className={`rounded-md border border-destructive/40 bg-destructive/10 p-3 space-y-3 ${className ?? ""}`}
    >
      <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {reasons.length > 1
          ? `Emissão bloqueada — ${reasons.length} motivos`
          : "Emissão bloqueada"}
      </div>

      {reasons.map((r) => (
        <div key={r.code} className="text-sm space-y-1">
          <p className="font-medium text-destructive">{r.title}</p>
          <p className="text-muted-foreground">{r.detail}</p>
          <div className="rounded-sm bg-background/60 p-2">
            <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Info className="h-3.5 w-3.5" />
              Como regularizar
            </p>
            <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
              {r.howToFix.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}
