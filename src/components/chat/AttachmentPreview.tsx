import { useState, useEffect } from 'react';
import { FileText, Download, Loader2, X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useChatAttachment } from '@/hooks/useChatAttachment';
import { cn } from '@/lib/utils';

interface AttachmentPreviewProps {
  url: string;
  name: string;
  type: string;
  size: number;
  isUser?: boolean;
}

export const AttachmentPreview = ({ url, name, type, size, isUser = false }: AttachmentPreviewProps) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { getAttachmentUrl, isImage, formatFileSize } = useChatAttachment();

  useEffect(() => {
    const loadUrl = async () => {
      setIsLoading(true);
      const signed = await getAttachmentUrl(url);
      setSignedUrl(signed);
      setIsLoading(false);
    };
    loadUrl();
  }, [url, getAttachmentUrl]);

  const handleDownload = async () => {
    if (!signedUrl) return;
    
    const link = document.createElement('a');
    link.href = signedUrl;
    link.download = name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className={cn(
        'flex items-center gap-2 p-2 rounded-lg',
        isUser ? 'bg-primary-foreground/20' : 'bg-background/50'
      )}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-xs">Carregando...</span>
      </div>
    );
  }

  if (!signedUrl) {
    return (
      <div className={cn(
        'flex items-center gap-2 p-2 rounded-lg',
        isUser ? 'bg-primary-foreground/20' : 'bg-background/50'
      )}>
        <FileText className="h-4 w-4" />
        <span className="text-xs">Anexo indisponível</span>
      </div>
    );
  }

  if (isImage(type)) {
    return (
      <>
        <div className="relative group cursor-pointer" onClick={() => setLightboxOpen(true)}>
          <img
            src={signedUrl}
            alt={name}
            className={cn(
              'max-w-[200px] max-h-[200px] rounded-lg object-cover',
              'transition-opacity group-hover:opacity-90'
            )}
          />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <ExternalLink className="h-6 w-6 text-white drop-shadow-lg" />
          </div>
        </div>

        <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
          <DialogContent className="max-w-4xl p-0 overflow-hidden">
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 z-10 bg-background/80"
                onClick={() => setLightboxOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
              <img
                src={signedUrl}
                alt={name}
                className="w-full h-auto max-h-[80vh] object-contain"
              />
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/50 to-transparent">
                <div className="flex items-center justify-between text-white">
                  <span className="text-sm">{name}</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleDownload}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Baixar
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Document preview
  return (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-lg border',
      isUser ? 'bg-primary-foreground/20 border-primary-foreground/30' : 'bg-background/50 border-border'
    )}>
      <FileText className="h-8 w-8 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-xs text-muted-foreground">{formatFileSize(size)}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDownload}
      >
        <Download className="h-4 w-4" />
      </Button>
    </div>
  );
};
