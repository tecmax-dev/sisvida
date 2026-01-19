import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  File,
  Image as ImageIcon,
  FileText,
} from "lucide-react";
import { UnionAppContent, CONTENT_TYPE_LABELS, ContentType } from "@/hooks/useUnionAppContent";

interface UnionContentListProps {
  content: UnionAppContent[];
  contentType: ContentType;
  onOpenCreate: () => void;
  onOpenEdit: (content: UnionAppContent) => void;
  onDelete: (id: string) => void;
  onToggleActive: (content: UnionAppContent) => void;
  onMoveUp: (content: UnionAppContent, index: number) => void;
  onMoveDown: (content: UnionAppContent, index: number) => void;
  cctCategories?: { id: string; name: string; color: string }[];
}

const contentTypeIcons: Record<ContentType, React.ReactNode> = {
  banner: <ImageIcon className="h-5 w-5" />,
  convenio: <FileText className="h-5 w-5" />,
  convencao: <FileText className="h-5 w-5" />,
  declaracao: <FileText className="h-5 w-5" />,
  diretoria: <FileText className="h-5 w-5" />,
  documento: <File className="h-5 w-5" />,
  galeria: <ImageIcon className="h-5 w-5" />,
  jornal: <FileText className="h-5 w-5" />,
  radio: <FileText className="h-5 w-5" />,
  video: <FileText className="h-5 w-5" />,
  faq: <FileText className="h-5 w-5" />,
  atendimento: <FileText className="h-5 w-5" />,
  sobre: <FileText className="h-5 w-5" />,
};

export function UnionContentList({
  content,
  contentType,
  onOpenCreate,
  onOpenEdit,
  onDelete,
  onToggleActive,
  onMoveUp,
  onMoveDown,
  cctCategories = [],
}: UnionContentListProps) {
  if (content.length === 0) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="py-16 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            {contentTypeIcons[contentType]}
          </div>
          <h3 className="font-semibold text-lg mb-2">Nenhum conteúdo encontrado</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Adicione seu primeiro {CONTENT_TYPE_LABELS[contentType].toLowerCase().slice(0, -1)} para começar a exibir no aplicativo
          </p>
          <Button onClick={onOpenCreate} size="lg" className="gap-2">
            <Plus className="h-5 w-5" />
            Adicionar {CONTENT_TYPE_LABELS[contentType].slice(0, -1)}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Find CCT category name helper
  const getCctCategoryName = (categoryId: string | null) => {
    if (!categoryId) return null;
    const cat = cctCategories.find((c) => c.id === categoryId);
    return cat?.name || null;
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {content.map((item, index) => {
        const cctCategoryName = getCctCategoryName(item.cct_category_id);
        
        return (
          <Card
            key={item.id}
            className={`group relative overflow-hidden transition-all hover:shadow-lg ${
              !item.is_active ? "opacity-60 grayscale" : ""
            }`}
          >
            {/* Image Section */}
            <div className="relative aspect-video bg-muted overflow-hidden">
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                  <div className="text-muted-foreground/50">
                    {contentTypeIcons[contentType]}
                  </div>
                </div>
              )}
              
              {/* Status Badge Overlay */}
              <div className="absolute top-3 left-3 flex gap-2">
                <Badge
                  variant={item.is_active ? "default" : "secondary"}
                  className="shadow-sm"
                >
                  {item.is_active ? "Ativo" : "Inativo"}
                </Badge>
                {cctCategoryName && (
                  <Badge variant="outline" className="bg-background/80 backdrop-blur-sm">
                    {cctCategoryName}
                  </Badge>
                )}
              </div>

              {/* Order indicator */}
              <div className="absolute top-3 right-3">
                <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
                  #{index + 1}
                </Badge>
              </div>
            </div>

            {/* Content Section */}
            <CardContent className="p-4">
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-base line-clamp-1">{item.title}</h3>
                  {item.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Links */}
                <div className="flex flex-wrap gap-2">
                  {item.external_link && (
                    <a
                      href={item.external_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-md"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Link externo
                    </a>
                  )}
                  {item.file_url && (
                    <a
                      href={item.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-md"
                    >
                      <File className="h-3 w-3" />
                      Arquivo
                    </a>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onMoveUp(item, index)}
                      disabled={index === 0}
                      className="h-8 w-8 p-0"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onMoveDown(item, index)}
                      disabled={index === content.length - 1}
                      className="h-8 w-8 p-0"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={item.is_active}
                      onCheckedChange={() => onToggleActive(item)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onOpenEdit(item)}
                      className="h-8 w-8 p-0"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(item.id)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
