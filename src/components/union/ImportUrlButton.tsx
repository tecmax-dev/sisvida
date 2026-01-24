import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link2, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ExtractedMetadata {
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  url: string;
}

interface ImportUrlButtonProps {
  onImport: (data: {
    title: string;
    description: string;
    image_url: string;
    external_link: string;
  }) => void;
}

export function ImportUrlButton({ onImport }: ImportUrlButtonProps) {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleImport = async () => {
    if (!url.trim()) {
      toast.error("Digite uma URL válida");
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      toast.error("URL inválida. Inclua http:// ou https://");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke<ExtractedMetadata>(
        "extract-url-metadata",
        {
          body: { url },
        }
      );

      if (error) throw error;

      if (!data) {
        toast.error("Não foi possível extrair dados da URL");
        return;
      }

      onImport({
        title: data.title || "",
        description: data.description || "",
        image_url: data.image || "",
        external_link: url,
      });

      toast.success("Dados importados com sucesso!");
      setUrl("");
    } catch (err) {
      console.error("Error extracting URL metadata:", err);
      toast.error("Erro ao importar dados da URL");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <Label className="text-sm font-medium">Importar de Link</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Cole o link da matéria e o sistema preencherá automaticamente título, descrição e imagem
      </p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://comerciariosilheus.org.br/noticia/..."
            className="pl-9"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleImport();
              }
            }}
          />
        </div>
        <Button
          type="button"
          onClick={handleImport}
          disabled={isLoading || !url.trim()}
          variant="secondary"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Importar"
          )}
        </Button>
      </div>
    </div>
  );
}
