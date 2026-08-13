import { useState, useEffect } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  X, 
  ChevronRight, 
  ChevronLeft,
  MousePointer2,
  Building2,
  FileText,
  Printer,
  CheckCircle2,
  Calendar,
  Download,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

interface Scene {
  id: number;
  title: string;
  description: string;
  caption: string;
  duration: number; // seconds
}

const SCENES: Scene[] = [
  {
    id: 1,
    title: "Acesso ao Portal",
    description: "Inicie informando os dados da empresa",
    caption: "Acesse o portal informando o CNPJ da empresa e o código de acesso enviado pelo sindicato.",
    duration: 5
  },
  {
    id: 2,
    title: "Painel Principal",
    description: "Visualize suas contribuições",
    caption: "No painel principal, você verá a lista de contribuições pendentes, pagas e vencidas.",
    duration: 5
  },
  {
    id: 3,
    title: "Gerar Boleto",
    description: "Abra o documento para pagamento",
    caption: "Localize a competência desejada e clique no ícone da impressora para gerar o boleto bancário.",
    duration: 5
  },
  {
    id: 4,
    title: "Pagamento via PIX",
    description: "Opção rápida e segura",
    caption: "O boleto será aberto com um QR Code para pagamento via PIX, que é compensado instantaneamente.",
    duration: 5
  },
  {
    id: 5,
    title: "Segunda Via",
    description: "Atualize boletos vencidos",
    caption: "Para boletos vencidos, você pode clicar em 'Solicitar 2ª via' para atualizar a data de vencimento.",
    duration: 6
  }
];

export function PortalTutorialVideo({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const [currentScene, setCurrentScene] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  const handleDownloadPDF = async () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFillColor(44, 82, 130); // #2c5282 (Prosinge Blue)
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.text("Guia Rapido: Portal da Empresa", 20, 25);
      
      doc.setFontSize(10);
      doc.text("Como gerar boletos e gerenciar contribuicoes", 20, 33);

      // Content
      let yPos = 55;
      
      SCENES.forEach((scene, index) => {
        // Scene Box
        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(15, yPos - 5, 180, 30, 3, 3, 'FD');

        // Step Number
        doc.setFillColor(44, 82, 130);
        doc.circle(25, yPos + 10, 5, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.text((index + 1).toString(), 23.5, yPos + 11.5);

        // Text Content
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(scene.title, 35, yPos + 5);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(71, 85, 105);
        
        // Multi-line caption
        const splitText = doc.splitTextToSize(scene.caption, 150);
        doc.text(splitText, 35, yPos + 12);

        yPos += 40;
        
        // Add new page if needed
        if (yPos > 250 && index < SCENES.length - 1) {
          doc.addPage();
          yPos = 30;
        }
      });

      // Footer
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text("© Prosinge - Sistema de Gestao Sindical", 105, 285, { align: "center" });

      doc.save("Guia_Rapido_Portal_Empresa.pdf");
      toast.success("Guia em PDF baixado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar o arquivo PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying && open) {
      timer = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            if (currentScene < SCENES.length - 1) {
              setCurrentScene(currentScene + 1);
              return 0;
            } else {
              setIsPlaying(false);
              return 100;
            }
          }
          return prev + (100 / (SCENES[currentScene].duration * 10));
        });
      }, 100);
    }
    return () => clearInterval(timer);
  }, [isPlaying, currentScene, open]);

  const handleRestart = () => {
    setCurrentScene(0);
    setProgress(0);
    setIsPlaying(true);
  };

  const handleNext = () => {
    if (currentScene < SCENES.length - 1) {
      setCurrentScene(currentScene + 1);
      setProgress(0);
      setIsPlaying(true);
    }
  };

  const handlePrev = () => {
    if (currentScene > 0) {
      setCurrentScene(currentScene - 1);
      setProgress(0);
      setIsPlaying(true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-slate-950 border-slate-800">
        <DialogHeader className="p-4 border-b border-slate-800 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="bg-primary/20 p-2 rounded-lg">
              <Play className="w-4 h-4 text-primary fill-current" />
            </div>
            <div>
              <DialogTitle className="text-white text-base">Tutorial: Como gerar boletos</DialogTitle>
              <p className="text-slate-400 text-xs">{SCENES[currentScene].title} ({currentScene + 1}/{SCENES.length})</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </Button>
        </DialogHeader>

        <div className="relative aspect-video bg-slate-900 overflow-hidden flex items-center justify-center">
          {/* Simulated Browser UI */}
          <div className="w-[90%] h-[85%] bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col scale-90 sm:scale-100">
            {/* Browser Header */}
            <div className="h-8 bg-slate-100 border-b flex items-center px-3 gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              </div>
              <div className="flex-1 max-w-md bg-white h-5 rounded border text-[10px] flex items-center px-2 text-slate-400">
                https://prosinge.com.br/portal/empresa
              </div>
            </div>

            {/* Content Area with Animations */}
            <div className="flex-1 relative bg-slate-50 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentScene}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="w-full h-full p-6 flex flex-col items-center justify-center"
                >
                  {currentScene === 0 && (
                    <div className="w-full max-w-sm space-y-4">
                      <div className="h-10 w-10 mx-auto bg-primary rounded flex items-center justify-center mb-2">
                        <Building2 className="text-white w-6 h-6" />
                      </div>
                      <div className="h-4 w-32 bg-slate-200 rounded mx-auto" />
                      <div className="space-y-3 pt-4">
                        <div className="h-9 w-full bg-white border rounded px-3 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">CNPJ da Empresa</span>
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: "100%" }}
                            transition={{ delay: 1, duration: 2 }}
                            className="h-full flex items-center"
                          >
                            <span className="text-[10px] text-slate-800">03.025.212/0001-11</span>
                          </motion.div>
                        </div>
                        <div className="h-9 w-full bg-white border rounded px-3 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">Código de Acesso</span>
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 3, duration: 0.5 }}
                            className="flex gap-1"
                          >
                            {[1,2,3,4,5,6].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-800" />)}
                          </motion.div>
                        </div>
                        <motion.div 
                          animate={{ scale: [1, 0.95, 1] }}
                          transition={{ delay: 4, duration: 0.2 }}
                          className="h-9 w-full bg-primary rounded flex items-center justify-center text-white text-xs font-medium shadow-sm"
                        >
                          Acessar Portal
                        </motion.div>
                      </div>
                    </div>
                  )}

                  {currentScene === 1 && (
                    <div className="w-full h-full flex flex-col">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-white">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div className="h-4 w-32 bg-slate-200 rounded" />
                        </div>
                        <div className="flex gap-2">
                          <div className="h-7 w-16 bg-slate-100 rounded border" />
                          <div className="h-7 w-7 bg-slate-100 rounded border" />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 mb-6">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="h-20 bg-white border rounded-lg p-3 flex flex-col justify-between">
                            <div className="h-3 w-12 bg-slate-100 rounded" />
                            <div className="h-5 w-20 bg-slate-200 rounded" />
                          </div>
                        ))}
                      </div>
                      <div className="bg-white border rounded-lg overflow-hidden flex-1">
                        <div className="h-8 bg-slate-50 border-b flex items-center px-4 gap-4">
                          <div className="h-2 w-20 bg-slate-200 rounded" />
                          <div className="h-2 w-16 bg-slate-200 rounded" />
                          <div className="h-2 w-12 bg-slate-200 rounded" />
                        </div>
                        <div className="p-4 space-y-4">
                          {[1, 2].map(i => (
                            <div key={i} className="flex items-center justify-between border-b pb-3 border-slate-50">
                              <div className="flex items-center gap-4">
                                <div className="h-3 w-24 bg-slate-100 rounded" />
                                <div className="h-3 w-16 bg-slate-100 rounded" />
                              </div>
                              <div className="flex gap-2">
                                <div className="h-6 w-12 bg-amber-50 border border-amber-200 rounded flex items-center justify-center">
                                  <div className="h-1.5 w-8 bg-amber-200 rounded" />
                                </div>
                                <div className="w-6 h-6 bg-slate-100 rounded" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {currentScene === 2 && (
                    <div className="w-full h-full flex flex-col">
                      <div className="h-6 w-48 bg-slate-200 rounded mb-6" />
                      <div className="bg-white border rounded-lg overflow-hidden flex-1 relative">
                        <div className="h-10 bg-slate-50 border-b flex items-center px-6 justify-between">
                          <div className="flex gap-10">
                            <div className="h-2 w-20 bg-slate-200 rounded" />
                            <div className="h-2 w-16 bg-slate-200 rounded" />
                          </div>
                          <div className="h-2 w-12 bg-slate-200 rounded" />
                        </div>
                        <div className="p-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-10">
                              <div className="h-4 w-32 bg-slate-800/10 rounded" />
                              <div className="h-4 w-20 bg-slate-800/10 rounded" />
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="h-7 w-20 bg-amber-100 rounded-full" />
                              <motion.div
                                initial={{ scale: 1 }}
                                animate={{ scale: [1, 1.2, 1], backgroundColor: ["#f1f5f9", "#3b82f6", "#f1f5f9"] }}
                                transition={{ delay: 2.5, duration: 0.5 }}
                                className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center border"
                              >
                                <Printer className="w-4 h-4 text-slate-600" id="print-button" />
                              </motion.div>
                            </div>
                          </div>
                        </div>

                        {/* Virtual Cursor */}
                        <motion.div
                          animate={{ 
                            x: [0, 250, 280], 
                            y: [0, 80, 105],
                          }}
                          transition={{ delay: 1, duration: 1.5, ease: "easeInOut" }}
                          className="absolute top-0 left-0 pointer-events-none"
                        >
                          <MousePointer2 className="w-5 h-5 text-black fill-black" />
                        </motion.div>
                      </div>
                    </div>
                  )}

                  {currentScene === 3 && (
                    <div className="w-full h-full flex items-center justify-center">
                      <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="w-80 bg-white border-2 border-slate-200 rounded-lg shadow-xl overflow-hidden"
                      >
                        <div className="h-12 bg-slate-800 flex items-center px-4 justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-white" />
                            <div className="h-3 w-20 bg-slate-600 rounded" />
                          </div>
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                        </div>
                        <div className="p-6 space-y-6">
                          <div className="flex justify-between items-start">
                            <div className="space-y-2">
                              <div className="h-4 w-32 bg-slate-200 rounded" />
                              <div className="h-3 w-48 bg-slate-100 rounded" />
                            </div>
                            <div className="w-12 h-12 bg-slate-100 rounded border flex items-center justify-center">
                              <Building2 className="w-6 h-6 text-slate-300" />
                            </div>
                          </div>
                          <div className="h-px bg-slate-100" />
                          <div className="flex justify-between">
                            <div className="space-y-1">
                              <div className="h-2 w-12 bg-slate-100 rounded" />
                              <div className="h-4 w-24 bg-slate-800 rounded" />
                            </div>
                            <div className="text-right space-y-1">
                              <div className="h-2 w-12 bg-slate-100 rounded ml-auto" />
                              <div className="h-4 w-20 bg-emerald-600 rounded ml-auto" />
                            </div>
                          </div>
                          <div className="pt-4 flex flex-col items-center gap-3">
                            <div className="w-24 h-24 bg-slate-50 border-2 border-dashed border-slate-200 rounded flex items-center justify-center relative">
                              <div className="w-20 h-20 bg-white border border-slate-100 p-1">
                                <div className="w-full h-full bg-slate-900 flex flex-wrap p-1">
                                  {[1,2,3,4,5,6,7,8,9].map(i => <div key={i} className="w-1/3 h-1/3 border border-white/10" />)}
                                </div>
                              </div>
                              <div className="absolute -top-2 -right-2 bg-emerald-500 rounded-full p-1 border-2 border-white">
                                <CheckCircle2 className="w-3 h-3 text-white" />
                              </div>
                            </div>
                            <div className="h-3 w-32 bg-slate-100 rounded" />
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  )}

                  {currentScene === 4 && (
                    <div className="w-full h-full flex flex-col">
                      <div className="flex items-center gap-3 mb-6">
                        <Calendar className="w-6 h-6 text-red-500" />
                        <div className="h-6 w-56 bg-red-50 border border-red-100 rounded px-3 flex items-center">
                          <div className="h-2 w-48 bg-red-200 rounded" />
                        </div>
                      </div>
                      <div className="bg-white border rounded-lg p-6 flex items-center justify-between border-red-100 bg-red-50/20">
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                              <Calendar className="w-4 h-4" />
                            </div>
                            <div className="space-y-1">
                              <div className="h-3 w-32 bg-slate-800 rounded" />
                              <div className="h-2 w-24 bg-red-400/30 rounded" />
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <motion.div
                            initial={{ scale: 1 }}
                            animate={{ 
                              scale: [1, 1.05, 1],
                              boxShadow: ["0 0 0 rgba(220, 38, 38, 0)", "0 0 15px rgba(220, 38, 38, 0.3)", "0 0 0 rgba(220, 38, 38, 0)"]
                            }}
                            transition={{ delay: 2, duration: 1.5, repeat: Infinity }}
                            className="h-10 px-4 bg-red-600 text-white rounded flex items-center gap-2 text-xs font-bold"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Solicitar 2ª via
                          </motion.div>
                          <div className="h-3 w-20 bg-slate-200 rounded" />
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Captions (Legenda) */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex justify-center">
            <motion.div
              key={currentScene}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-xl border border-white/10 max-w-2xl text-center"
            >
              <p className="text-white font-medium text-sm leading-relaxed">
                {SCENES[currentScene].caption}
              </p>
            </motion.div>
          </div>
        </div>

        {/* Controls */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col gap-4">
          <Progress value={progress} className="h-1 bg-slate-800" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsPlaying(!isPlaying)}
                className="text-white hover:bg-slate-800"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleRestart}
                className="text-white hover:bg-slate-800"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDownloadPDF}
                disabled={isExporting}
                className="bg-transparent border-primary/30 text-primary hover:bg-primary/5 mr-2"
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Baixar Guia (PDF)
              </Button>

              <Button 
                variant="outline" 
                size="sm" 
                onClick={handlePrev}
                disabled={currentScene === 0}
                className="bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleNext}
                disabled={currentScene === SCENES.length - 1}
                className="bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                Próximo <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}