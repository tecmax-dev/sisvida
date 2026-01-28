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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  RefreshCw,
  Eye,
  Plus,
  Pencil,
  SkipForward,
} from "lucide-react";
import { useImportPreview } from "./useImportPreview";
import { useImportExecution } from "./useImportExecution";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ImportedMember } from "./types";

interface ImportMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "upload" | "preview" | "importing" | "result";

export function ImportMembersDialog({ open, onOpenChange }: ImportMembersDialogProps) {
  const { currentClinic } = useAuth();
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const {
    generatePreview,
    isLoading: isLoadingPreview,
    progress: previewProgress,
    previewData,
    error: previewError,
    reset: resetPreview,
  } = useImportPreview(currentClinic?.id);
  
  const {
    executeImport,
    isProcessing,
    progress: importProgress,
    result,
    reset: resetImport,
  } = useImportExecution(currentClinic?.id);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type (PDF, XLS, XLSX)
    const validTypes = [
      "application/pdf",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    const validExtensions = [".pdf", ".xls", ".xlsx"];
    const hasValidType = validTypes.some(t => file.type.includes(t) || file.type === t);
    const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    
    if (!hasValidType && !hasValidExtension) {
      toast.error("Formatos aceitos: PDF, XLS ou XLSX");
      return;
    }

    setFileName(file.name);
    
    const result = await generatePreview(file);
    if (result) {
      setStep("preview");
      toast.success(`${result.summary.total} registros identificados`);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData) return;

    setStep("importing");
    
    try {
      const importResult = await executeImport(previewData);
      setStep("result");
      
      if (importResult.errors.length === 0) {
        toast.success(
          `Importação concluída! ${importResult.membersCreated} sócios criados, ${importResult.membersUpdated} atualizados.`
        );
      } else {
        toast.warning(
          `Importação com avisos: ${importResult.membersCreated + importResult.membersUpdated} processados, ${importResult.errors.length} erros.`
        );
      }
    } catch (error) {
      toast.error(`Erro na importação: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
      setStep("preview");
    }
  };

  const handleExportErrors = () => {
    if (!result?.errors.length) return;
    
    const csv = [
      ["Linha", "Campo", "Mensagem", "Nome", "CPF", "Empresa", "CNPJ"],
      ...result.errors.map(e => [
        e.row.toString(),
        e.field,
        e.message,
        e.data?.nome || "",
        e.data?.cpf || "",
        e.data?.empresa_nome || "",
        e.data?.cnpj || "",
      ]),
    ]
      .map(row => row.map(cell => `"${cell}"`).join(";"))
      .join("\n");
    
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `erros_importacao_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetState = () => {
    setStep("upload");
    setFileName("");
    resetPreview();
    resetImport();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getActionBadge = (record: ImportedMember) => {
    switch (record.status) {
      case "will_create":
        return <Badge className="bg-green-100 text-green-800"><Plus className="h-3 w-3 mr-1" />Criar</Badge>;
      case "will_update":
        return <Badge className="bg-blue-100 text-blue-800"><Pencil className="h-3 w-3 mr-1" />Atualizar</Badge>;
      case "will_skip":
        return <Badge className="bg-gray-100 text-gray-600"><SkipForward className="h-3 w-3 mr-1" />Ignorar</Badge>;
      case "error":
        return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Erro</Badge>;
      case "created":
        return <Badge className="bg-green-500 text-white"><CheckCircle className="h-3 w-3 mr-1" />Criado</Badge>;
      case "updated":
        return <Badge className="bg-blue-500 text-white"><CheckCircle className="h-3 w-3 mr-1" />Atualizado</Badge>;
      case "skipped":
        return <Badge variant="secondary"><SkipForward className="h-3 w-3 mr-1" />Ignorado</Badge>;
      default:
        return <Badge variant="outline">Pendente</Badge>;
    }
  };

  const canClose = !isLoadingPreview && !isProcessing;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (canClose) { onOpenChange(v); if (!v) resetState(); } }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Sócios e Empresas
          </DialogTitle>
          <DialogDescription>
            Importe dados de sócios e empresas a partir de arquivo PDF ou planilha Excel (XLS/XLSX)
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {/* Step 1: Upload */}
            {step === "upload" && (
              <Card className="p-6">
                <div className="flex flex-col items-center justify-center gap-4 py-8">
                  <div className="p-4 rounded-full bg-muted">
                    <FileText className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="font-semibold text-lg">Selecione o arquivo</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      Formatos aceitos: <strong>PDF, XLS ou XLSX</strong>. O arquivo deve conter: Nome, CPF, Empresa, CNPJ e demais dados dos sócios.
                    </p>
                  </div>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.xls,.xlsx,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isLoadingPreview}
                  />
                  
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoadingPreview}
                    size="lg"
                  >
                    {isLoadingPreview ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processando arquivo...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Selecionar Arquivo
                      </>
                    )}
                  </Button>

                  {isLoadingPreview && (
                    <div className="w-full max-w-md space-y-2">
                      <Progress value={previewProgress.current} />
                      <p className="text-sm text-center text-muted-foreground">
                        {previewProgress.message}
                      </p>
                    </div>
                  )}

                  {previewError && (
                    <Alert variant="destructive" className="max-w-md">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Erro ao processar arquivo</AlertTitle>
                      <AlertDescription>{previewError}</AlertDescription>
                    </Alert>
                  )}
                </div>
              </Card>
            )}

            {/* Step 2: Preview */}
            {step === "preview" && previewData && (
              <div className="space-y-4">
                <Alert>
                  <Eye className="h-4 w-4" />
                  <AlertTitle>Preview da Importação</AlertTitle>
                  <AlertDescription>
                    Revise os dados antes de confirmar. Arquivo: <strong>{fileName}</strong>
                  </AlertDescription>
                </Alert>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <Card className="p-3 text-center">
                    <p className="text-2xl font-bold">{previewData.summary.total}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </Card>
                  <Card className="p-3 text-center border-green-200 bg-green-50">
                    <p className="text-2xl font-bold text-green-700">{previewData.summary.toCreate}</p>
                    <p className="text-xs text-green-600">Criar</p>
                  </Card>
                  <Card className="p-3 text-center border-blue-200 bg-blue-50">
                    <p className="text-2xl font-bold text-blue-700">{previewData.summary.toUpdate}</p>
                    <p className="text-xs text-blue-600">Atualizar</p>
                  </Card>
                  <Card className="p-3 text-center border-gray-200 bg-gray-50">
                    <p className="text-2xl font-bold text-gray-600">{previewData.summary.toSkip}</p>
                    <p className="text-xs text-gray-500">Ignorar</p>
                  </Card>
                  <Card className="p-3 text-center border-red-200 bg-red-50">
                    <p className="text-2xl font-bold text-red-700">{previewData.summary.errors}</p>
                    <p className="text-xs text-red-600">Erros</p>
                  </Card>
                </div>

                {/* Preview Table */}
                <Card className="p-4">
                  <h3 className="font-medium mb-3">Prévia dos registros</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2 font-medium">Nome</th>
                          <th className="text-left py-2 px-2 font-medium">CPF</th>
                          <th className="text-left py-2 px-2 font-medium">Empresa</th>
                          <th className="text-left py-2 px-2 font-medium">CNPJ</th>
                          <th className="text-left py-2 px-2 font-medium">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.records.slice(0, 50).map((record, i) => (
                          <tr key={i} className={`border-b border-muted ${record.status === "error" ? "bg-red-50" : ""}`}>
                            <td className="py-2 px-2 truncate max-w-[180px]" title={record.nome}>
                              {record.nome}
                            </td>
                            <td className="py-2 px-2 font-mono text-xs">{record.cpf}</td>
                            <td className="py-2 px-2 truncate max-w-[180px]" title={record.empresa_nome}>
                              {record.empresa_nome}
                            </td>
                            <td className="py-2 px-2 font-mono text-xs">{record.cnpj}</td>
                            <td className="py-2 px-2">
                              {getActionBadge(record)}
                              {record.error_message && (
                                <span className="block text-xs text-red-600 mt-1">{record.error_message}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {previewData.records.length > 50 && (
                      <p className="text-sm text-muted-foreground mt-2 text-center">
                        Mostrando 50 de {previewData.records.length} registros
                      </p>
                    )}
                  </div>
                </Card>
              </div>
            )}

            {/* Step 3: Importing */}
            {step === "importing" && (
              <Card className="p-6">
                <div className="flex flex-col items-center justify-center gap-4 py-8">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <div className="text-center space-y-2">
                    <h3 className="font-semibold text-lg">Importando dados...</h3>
                    <p className="text-sm text-muted-foreground">{importProgress.message}</p>
                  </div>
                  <div className="w-full max-w-md">
                    <Progress value={importProgress.current} />
                  </div>
                </div>
              </Card>
            )}

            {/* Step 4: Results */}
            {step === "result" && result && (
              <div className="space-y-4">
                <Alert className={result.errors.length > 0 ? "border-yellow-500 bg-yellow-50" : "border-green-500 bg-green-50"}>
                  {result.errors.length > 0 ? (
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  )}
                  <AlertTitle>
                    {result.errors.length > 0 
                      ? `Importação concluída com ${result.errors.length} avisos/erros`
                      : "Importação concluída com sucesso!"}
                  </AlertTitle>
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
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-red-600">Erros ({result.errors.length})</h3>
                      <Button size="sm" variant="outline" onClick={handleExportErrors}>
                        <Download className="h-4 w-4 mr-2" />
                        Exportar CSV
                      </Button>
                    </div>
                    <ScrollArea className="h-48">
                      <div className="space-y-2">
                        {result.errors.slice(0, 30).map((error, i) => (
                          <div key={i} className="text-sm p-2 bg-red-50 rounded border border-red-200">
                            <span className="font-medium">Linha {error.row}:</span> {error.message}
                            {error.data?.nome && <span className="text-muted-foreground ml-2">({error.data.nome})</span>}
                          </div>
                        ))}
                        {result.errors.length > 30 && (
                          <p className="text-sm text-muted-foreground text-center">
                            E mais {result.errors.length - 30} erros. Exporte o CSV para ver todos.
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
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => { onOpenChange(false); resetState(); }}
              disabled={!canClose}
            >
              {step === "result" ? "Fechar" : "Cancelar"}
            </Button>
            
            {step === "preview" && (
              <Button variant="ghost" onClick={resetState}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Novo Arquivo
              </Button>
            )}
          </div>
          
          {step === "preview" && (
            <Button onClick={handleConfirmImport} disabled={!previewData || previewData.summary.errors === previewData.summary.total}>
              <ArrowRight className="h-4 w-4 mr-2" />
              Confirmar Importação ({previewData?.summary.toCreate || 0} criar, {previewData?.summary.toUpdate || 0} atualizar)
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
