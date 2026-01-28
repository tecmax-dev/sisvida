import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Users,
  Building2,
  ArrowRight,
  Download,
  Loader2,
} from "lucide-react";
import { useImportMembersEmployers } from "./useImportMembersEmployers";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface ImportMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportMembersDialog({ open, onOpenChange }: ImportMembersDialogProps) {
  const { currentClinic } = useAuth();
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [previewData, setPreviewData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { processImport, isProcessing, progress, result } = useImportMembersEmployers(currentClinic?.id);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    // Check file type
    if (file.type === "text/plain" || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
      const text = await file.text();
      setFileContent(text);
      
      // Parse preview
      const { parsePdfTableData } = await import("./parsePdfData");
      const records = parsePdfTableData(text);
      setPreviewData(records.slice(0, 10));
      
      toast.success(`${records.length} registros identificados`);
    } else {
      toast.error("Por favor, selecione um arquivo de texto (.txt ou .md) com os dados parseados do PDF");
    }
  };

  const handleImport = async () => {
    if (!fileContent) {
      toast.error("Selecione um arquivo primeiro");
      return;
    }

    try {
      const importResult = await processImport(fileContent);
      
      if (importResult.errors.length === 0) {
        toast.success(
          `Importação concluída! ${importResult.membersCreated} sócios criados, ${importResult.employersCreated} empresas criadas.`
        );
      } else {
        toast.warning(
          `Importação com avisos: ${importResult.membersCreated} sócios criados, ${importResult.errors.length} erros.`
        );
      }
    } catch (error) {
      toast.error(`Erro na importação: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
    }
  };

  const handleExportErrors = () => {
    if (!result?.errors.length) return;
    
    const csv = [
      ["Linha", "Campo", "Mensagem", "Dados"],
      ...result.errors.map(e => [e.row.toString(), e.field, e.message, JSON.stringify(e.data)]),
    ]
      .map(row => row.join(";"))
      .join("\n");
    
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `erros_importacao_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetState = () => {
    setFileContent(null);
    setFileName("");
    setPreviewData([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isProcessing) { onOpenChange(v); if (!v) resetState(); } }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Sócios e Empresas
          </DialogTitle>
          <DialogDescription>
            Importe dados de sócios e empresas a partir de arquivo parseado do PDF
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {/* File Upload Section */}
            {!result && (
              <Card className="p-4">
                <div className="flex flex-col items-center justify-center gap-4 py-6">
                  <div className="p-4 rounded-full bg-muted">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">
                      Selecione o arquivo de texto com os dados parseados do PDF
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Formato esperado: tabela markdown com colunas Nome, CPF, RG, Empresa, CNPJ, Função, Data inscrição, Data admissão
                    </p>
                  </div>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isProcessing}
                  />
                  
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                    variant="outline"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Selecionar Arquivo
                  </Button>
                  
                  {fileName && (
                    <Badge variant="secondary" className="gap-2">
                      <FileText className="h-3 w-3" />
                      {fileName}
                    </Badge>
                  )}
                </div>
              </Card>
            )}

            {/* Preview Section */}
            {previewData.length > 0 && !result && (
              <Card className="p-4">
                <h3 className="font-medium mb-2">Prévia dos dados ({previewData.length} de muitos registros)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-1 px-2">Nome</th>
                        <th className="text-left py-1 px-2">CPF</th>
                        <th className="text-left py-1 px-2">Empresa</th>
                        <th className="text-left py-1 px-2">CNPJ</th>
                        <th className="text-left py-1 px-2">Função</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, i) => (
                        <tr key={i} className="border-b border-muted">
                          <td className="py-1 px-2 truncate max-w-[150px]">{row.nome}</td>
                          <td className="py-1 px-2">{row.cpf}</td>
                          <td className="py-1 px-2 truncate max-w-[150px]">{row.empresa_nome}</td>
                          <td className="py-1 px-2">{row.cnpj}</td>
                          <td className="py-1 px-2 truncate max-w-[100px]">{row.funcao || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Progress Section */}
            {isProcessing && (
              <Card className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="font-medium">{progress.message}</span>
                  </div>
                  <Progress value={progress.current} max={progress.total} />
                  <p className="text-sm text-muted-foreground">
                    Fase: {progress.phase} ({progress.current}%)
                  </p>
                </div>
              </Card>
            )}

            {/* Results Section */}
            {result && (
              <div className="space-y-4">
                <Alert className={result.errors.length > 0 ? "border-yellow-500" : "border-green-500"}>
                  <div className="flex items-center gap-2">
                    {result.errors.length > 0 ? (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    <AlertDescription>
                      {result.errors.length > 0
                        ? `Importação concluída com ${result.errors.length} avisos/erros`
                        : "Importação concluída com sucesso!"}
                    </AlertDescription>
                  </div>
                </Alert>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="p-4 text-center">
                    <Users className="h-6 w-6 mx-auto mb-2 text-green-500" />
                    <p className="text-2xl font-bold">{result.membersCreated}</p>
                    <p className="text-xs text-muted-foreground">Sócios Criados</p>
                  </Card>
                  <Card className="p-4 text-center">
                    <Users className="h-6 w-6 mx-auto mb-2 text-blue-500" />
                    <p className="text-2xl font-bold">{result.membersUpdated}</p>
                    <p className="text-xs text-muted-foreground">Sócios Atualizados</p>
                  </Card>
                  <Card className="p-4 text-center">
                    <Building2 className="h-6 w-6 mx-auto mb-2 text-green-500" />
                    <p className="text-2xl font-bold">{result.employersCreated}</p>
                    <p className="text-xs text-muted-foreground">Empresas Criadas</p>
                  </Card>
                  <Card className="p-4 text-center">
                    <Building2 className="h-6 w-6 mx-auto mb-2 text-gray-500" />
                    <p className="text-2xl font-bold">{result.employersSkipped}</p>
                    <p className="text-xs text-muted-foreground">Empresas Existentes</p>
                  </Card>
                </div>

                {result.errors.length > 0 && (
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-red-600">Erros ({result.errors.length})</h3>
                      <Button size="sm" variant="outline" onClick={handleExportErrors}>
                        <Download className="h-4 w-4 mr-2" />
                        Exportar Erros
                      </Button>
                    </div>
                    <ScrollArea className="h-40">
                      <div className="space-y-2">
                        {result.errors.slice(0, 20).map((error, i) => (
                          <div key={i} className="text-sm p-2 bg-red-50 rounded border border-red-200">
                            <span className="font-medium">Linha {error.row}:</span> {error.message}
                          </div>
                        ))}
                        {result.errors.length > 20 && (
                          <p className="text-sm text-muted-foreground">
                            E mais {result.errors.length - 20} erros...
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </Card>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <Separator />

        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={() => { onOpenChange(false); resetState(); }}
            disabled={isProcessing}
          >
            {result ? "Fechar" : "Cancelar"}
          </Button>
          
          {!result && (
            <Button
              onClick={handleImport}
              disabled={!fileContent || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Iniciar Importação
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
