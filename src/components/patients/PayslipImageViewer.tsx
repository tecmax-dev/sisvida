import { useState, useEffect } from 'react';
import { 
  RotateCw, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Download,
  X,
  Loader2,
  Maximize2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface PayslipImageViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string | null;
  patientName: string;
  loading?: boolean;
}

export function PayslipImageViewer({
  open,
  onOpenChange,
  imageUrl,
  patientName,
  loading = false,
}: PayslipImageViewerProps) {
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isPdf = !!imageUrl && imageUrl.toLowerCase().split('?')[0].endsWith('.pdf');

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setRotation(0);
      setZoom(1);
    }
  }, [open]);

  const handleRotateRight = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleRotateLeft = () => {
    setRotation((prev) => (prev - 90 + 360) % 360);
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleDownload = () => {
    if (!imageUrl) return;
    const safeName = patientName.replace(/\s+/g, '-').toLowerCase();
    const withoutQuery = imageUrl.split('?')[0];
    const ext = (withoutQuery.split('.').pop() || 'jpg').toLowerCase();
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `contracheque-${safeName}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "transition-all duration-300",
          isFullscreen 
            ? "max-w-[95vw] max-h-[95vh] w-full h-full" 
            : "max-w-4xl max-h-[90vh]"
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Contracheque - {patientName}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex items-center justify-center gap-2 py-2 border-b">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRotateLeft}
            disabled={isPdf}
            title="Girar para esquerda"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRotateRight}
            disabled={isPdf}
            title="Girar para direita"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
          <div className="w-px h-6 bg-border mx-2" />
          <Button
            variant="outline"
            size="icon"
            onClick={handleZoomOut}
            disabled={isPdf || zoom <= 0.5}
            title="Diminuir zoom"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground w-16 text-center">
            {isPdf ? 'PDF' : `${Math.round(zoom * 100)}%`}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={handleZoomIn}
            disabled={isPdf || zoom >= 3}
            title="Aumentar zoom"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <div className="w-px h-6 bg-border mx-2" />
          <Button
            variant="outline"
            size="icon"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleDownload}
            disabled={!imageUrl}
            title="Baixar imagem"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>

        {/* Image container */}
        <div 
          className={cn(
            "flex items-center justify-center overflow-auto bg-muted/30 rounded-lg",
            isFullscreen ? "flex-1" : "min-h-[400px] max-h-[60vh]"
          )}
        >
          {loading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Carregando imagem...</span>
            </div>
          ) : imageUrl ? (
            isPdf ? (
              <div className="w-full p-2">
                <iframe
                  src={imageUrl}
                  title={`Contracheque de ${patientName}`}
                  className="w-full rounded border bg-background"
                  style={{
                    height: isFullscreen ? '82vh' : '60vh',
                  }}
                />
              </div>
            ) : (
              <div 
                className="p-4 transition-transform duration-300"
                style={{
                  transform: `rotate(${rotation}deg) scale(${zoom})`,
                }}
              >
                <img
                  src={imageUrl}
                  alt={`Contracheque de ${patientName}`}
                  className="max-w-full max-h-full object-contain rounded shadow-lg"
                  style={{
                    maxHeight: isFullscreen ? '80vh' : '55vh',
                  }}
                />
              </div>
            )
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <X className="h-12 w-12" />
              <span>Imagem não disponível</span>
            </div>
          )}
        </div>

        {/* Zoom/rotation info */}
        <div className="text-center text-sm text-muted-foreground">
          {isPdf
            ? 'Pré-visualização do PDF (use baixar para salvar)'
            : 'Use os controles acima para girar e ampliar a imagem'}
        </div>
      </DialogContent>
    </Dialog>
  );
}
