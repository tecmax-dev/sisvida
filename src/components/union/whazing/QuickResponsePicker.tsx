import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Zap, Search, Link, Image, FileText } from "lucide-react";
import {
  useWhazingQuickResponses,
  useIncrementQuickResponseUsage,
} from "@/hooks/useWhazingQuickResponses";

interface QuickResponsePickerProps {
  onSelect: (body: string, mediaUrl?: string, mediaType?: string) => void;
}

export default function QuickResponsePicker({ onSelect }: QuickResponsePickerProps) {
  const { data: responses } = useWhazingQuickResponses();
  const incrementUsage = useIncrementQuickResponseUsage();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = (responses || []).filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.title.toLowerCase().includes(s) ||
      r.body.toLowerCase().includes(s) ||
      (r.shortcut || "").toLowerCase().includes(s) ||
      (r.category || "").toLowerCase().includes(s)
    );
  });

  const handleSelect = (r: typeof filtered[0]) => {
    onSelect(r.body, r.media_url || undefined, r.media_type || undefined);
    incrementUsage.mutate(r.id);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9" title="Respostas rápidas">
          <Zap className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar resposta ou /atalho..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>
        <ScrollArea className="max-h-64">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma resposta</p>
          ) : (
            <div className="p-1">
              {filtered.map((r) => (
                <button
                  key={r.id}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors"
                  onClick={() => handleSelect(r)}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium">{r.title}</span>
                    {r.shortcut && (
                      <Badge variant="secondary" className="text-[9px] font-mono">
                        /{r.shortcut}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{r.body}</p>
                  {r.media_url && (
                    <div className="flex items-center gap-1 mt-0.5 text-[10px] text-primary">
                      {r.media_type?.startsWith("image") ? <Image className="h-3 w-3" /> : r.media_type === "link" ? <Link className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                      <span>Mídia anexada</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
