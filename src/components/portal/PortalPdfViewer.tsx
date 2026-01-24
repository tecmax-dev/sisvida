import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, X, ExternalLink, Loader2, Maximize2 } from "lucide-react";

interface PortalPdfViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  pdfUrl: string | null;
  externalLink?: string | null;
}

export function PortalPdfViewer({ 
  open, 
  onOpenChange, 
  title, 
  pdfUrl,
  externalLink 
}: PortalPdfViewerProps) {
  const [isLoading, setIsLoading] = useState(true);

  const handlePrint = () => {
    if (pdfUrl) {
      const printWindow = window.open(pdfUrl, "_blank");
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    }
  };

  const handleDownload = () => {
    if (pdfUrl) {
      const link = document.createElement("a");
      link.href = pdfUrl;
      link.download = `${title}.pdf`;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleOpenExternal = () => {
    const url = pdfUrl || externalLink;
    if (url) {
      window.open(url, "_blank");
    }
  };

  const documentUrl = pdfUrl || externalLink;
  const isPdf = pdfUrl?.toLowerCase().includes(".pdf") || 
                pdfUrl?.toLowerCase().includes("pdf") ||
                documentUrl?.toLowerCase().includes(".pdf");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b bg-slate-50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold text-slate-800 truncate pr-4">
              {title}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {isPdf && pdfUrl && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrint}
                    className="gap-2"
                  >
                    <Printer className="h-4 w-4" />
                    <span className="hidden sm:inline">Imprimir</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Baixar</span>
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenExternal}
                className="gap-2"
              >
                <Maximize2 className="h-4 w-4" />
                <span className="hidden sm:inline">Abrir em nova aba</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* PDF Viewer */}
        <div className="flex-1 relative bg-slate-100 overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                <p className="text-sm text-slate-500">Carregando documento...</p>
              </div>
            </div>
          )}
          
          {documentUrl ? (
            <iframe
              src={`${documentUrl}#toolbar=1&navpanes=0&scrollbar=1`}
              className="w-full h-full border-0"
              title={title}
              onLoad={() => setIsLoading(false)}
              onError={() => setIsLoading(false)}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-500">Documento não disponível</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
