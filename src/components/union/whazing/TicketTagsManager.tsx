import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tag, Plus, X, Loader2 } from "lucide-react";
import {
  useWhazingTags,
  useTicketTags,
  useAddTicketTag,
  useRemoveTicketTag,
  useCreateTag,
} from "@/hooks/useWhazingTags";
import { toast } from "sonner";

const TAG_COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#6366f1", "#14b8a6",
];

interface TicketTagsManagerProps {
  ticketId: string;
}

export default function TicketTagsManager({ ticketId }: TicketTagsManagerProps) {
  const { data: allTags } = useWhazingTags();
  const { data: ticketTags } = useTicketTags(ticketId);
  const addTag = useAddTicketTag();
  const removeTag = useRemoveTicketTag();
  const createTag = useCreateTag();
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);

  const appliedTagIds = (ticketTags || []).map((t) => t.tag_id);

  const handleAddTag = async (tagId: string) => {
    try {
      await addTag.mutateAsync({ ticketId, tagId });
    } catch {
      toast.error("Erro ao adicionar tag");
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      await removeTag.mutateAsync({ ticketId, tagId });
    } catch {
      toast.error("Erro ao remover tag");
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      const tag = await createTag.mutateAsync({ name: newTagName.trim(), color: newTagColor });
      await addTag.mutateAsync({ ticketId, tagId: tag.id });
      setNewTagName("");
      toast.success("Tag criada e aplicada");
    } catch {
      toast.error("Erro ao criar tag");
    }
  };

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {(ticketTags || []).map((tt) => (
        <Badge
          key={tt.id}
          variant="outline"
          className="text-[10px] gap-1 pr-1"
          style={{ borderColor: tt.tag.color, color: tt.tag.color }}
        >
          {tt.tag.name}
          <button
            onClick={() => handleRemoveTag(tt.tag_id)}
            className="hover:opacity-70"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </Badge>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <Tag className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          <p className="text-xs font-medium mb-2">Tags</p>
          <div className="space-y-1 max-h-32 overflow-y-auto mb-2">
            {(allTags || []).map((tag) => {
              const applied = appliedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-muted ${applied ? "opacity-50" : ""}`}
                  onClick={() => !applied && handleAddTag(tag.id)}
                  disabled={applied}
                >
                  <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                  {applied && <span className="ml-auto text-[9px]">✓</span>}
                </button>
              );
            })}
          </div>
          <div className="border-t pt-2">
            <div className="flex gap-1">
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Nova tag..."
                className="h-7 text-xs flex-1"
                onKeyDown={(e) => e.key === "Enter" && handleCreateTag()}
              />
              <Popover>
                <PopoverTrigger asChild>
                  <button className="h-7 w-7 rounded border flex items-center justify-center" style={{ backgroundColor: newTagColor }} />
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2">
                  <div className="flex gap-1 flex-wrap max-w-[140px]">
                    {TAG_COLORS.map((c) => (
                      <button
                        key={c}
                        className={`h-6 w-6 rounded ${newTagColor === c ? "ring-2 ring-offset-1 ring-primary" : ""}`}
                        style={{ backgroundColor: c }}
                        onClick={() => setNewTagColor(c)}
                      />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <Button size="icon" className="h-7 w-7" onClick={handleCreateTag} disabled={createTag.isPending}>
                {createTag.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
