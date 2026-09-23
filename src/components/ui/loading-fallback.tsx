import { Loader2 } from "lucide-react";

export const LoadingFallback = () => (
  <div className="min-h-[50dvh] flex items-center justify-center bg-background" role="status" aria-live="polite">
    <div className="flex flex-col items-center gap-3 rounded-lg border border-border/70 bg-card px-8 py-7 shadow-card">
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
      <p className="text-sm font-medium text-muted-foreground">Carregando conteúdo...</p>
    </div>
  </div>
);
