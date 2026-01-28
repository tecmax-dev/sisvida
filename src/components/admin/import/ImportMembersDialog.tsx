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

  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsLoading(true);

    try {
      let textContent = "";

      // Check file type
      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        // Parse PDF using pdfjs-dist with legacy build (no worker needed)
        const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
        
        // Disable worker to avoid CORS/loading issues
        pdfjsLib.GlobalWorkerOptions.workerSrc = "";
        
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ 
          data: arrayBuffer,
          useWorkerFetch: false,
          isEvalSupported: false,
          useSystemFonts: true,
        });
        
        const pdf = await loadingTask.promise;
        
        const textParts: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items
            .map((item: any) => item.str)
            .join(" ");
          textParts.push(pageText);
        }
        
        // Convert to markdown table format
        textContent = convertPdfTextToMarkdown(textParts.join("\n"));
        toast.info(`PDF processado: ${pdf.numPages} páginas`);
      } else if (file.type === "text/plain" || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
        textContent = await file.text();
      } else {
        toast.error("Por favor, selecione um arquivo PDF ou texto (.txt, .md)");
        setIsLoading(false);
        return;
      }

      setFileContent(textContent);
      
      // Parse preview
      const { parsePdfTableData } = await import("./parsePdfData");
      const records = parsePdfTableData(textContent);
      setPreviewData(records.slice(0, 10));
      
      if (records.length > 0) {
        toast.success(`${records.length} registros identificados`);
      } else {
        toast.warning("Nenhum registro válido encontrado. Verifique o formato do arquivo.");
      }
    } catch (error) {
      console.error("Error parsing file:", error);
      toast.error("Erro ao processar o arquivo. Verifique se o arquivo é válido.");
    } finally {
      setIsLoading(false);
    }
  };

  // Convert raw PDF text to markdown table format for parsing
  const convertPdfTextToMarkdown = (rawText: string): string => {
    // Split by lines and try to identify table rows
    const lines = rawText.split(/[\n\r]+/).filter(line => line.trim());
    const markdownLines: string[] = [];
    
    // Add header
    markdownLines.push("| Nome Sócio | CPF | RG | Empresas | CNPJ | Função | Data inscrição | Data admissão |");
    markdownLines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
    
    // Pattern to match CPF (XXX.XXX.XXX-XX or 11 digits)
    const cpfPattern = /(\d{3}[.\s]?\d{3}[.\s]?\d{3}[-.\s]?\d{2})/g;
    // Pattern to match CNPJ (XX.XXX.XXX/XXXX-XX or 14 digits)
    const cnpjPattern = /(\d{2}[.\s]?\d{3}[.\s]?\d{3}[\/\s]?\d{4}[-.\s]?\d{2})/g;
    // Pattern to match dates (DD/MM/YYYY)
    const datePattern = /(\d{2}\/\d{2}\/\d{4})/g;

    // Try to extract structured data from raw text
    let currentLine = "";
    for (const line of lines) {
      currentLine += " " + line;
      
      // Check if line contains both CPF and CNPJ
      const cpfMatches = currentLine.match(cpfPattern);
      const cnpjMatches = currentLine.match(cnpjPattern);
      const dateMatches = currentLine.match(datePattern);
      
      if (cpfMatches && cnpjMatches) {
        // Try to extract name (text before CPF)
        const cpfIndex = currentLine.indexOf(cpfMatches[0]);
        const name = currentLine.substring(0, cpfIndex).trim();
        
        if (name && name.length > 2) {
          // Extract other fields
          const cpf = cpfMatches[0];
          const cnpj = cnpjMatches[0];
          const dates = dateMatches || [];
          
          // Find RG (between CPF and company name)
          const afterCpf = currentLine.substring(cpfIndex + cpf.length);
          const rgMatch = afterCpf.match(/^[\s]*(\d{7,12})/);
          const rg = rgMatch ? rgMatch[1] : "";
          
          // Find company name (text between RG/CPF and CNPJ)
          const cnpjIndex = currentLine.indexOf(cnpj);
          let companyName = currentLine.substring(cpfIndex + cpf.length, cnpjIndex);
          if (rg) companyName = companyName.replace(rg, "");
          companyName = companyName.replace(/^\s+|\s+$/g, "").replace(/\s+/g, " ");
          
          // Find function (text after CNPJ before dates)
          let afterCnpj = currentLine.substring(cnpjIndex + cnpj.length);
          let funcao = "";
          if (dates.length > 0) {
            const dateIndex = afterCnpj.indexOf(dates[0]);
            funcao = afterCnpj.substring(0, dateIndex).trim();
          }
          
          const dataInscricao = dates[0] || "";
          const dataAdmissao = dates[1] || "";
          
          markdownLines.push(`| ${name} | ${cpf} | ${rg} | ${companyName} | ${cnpj} | ${funcao} | ${dataInscricao} | ${dataAdmissao} |`);
          currentLine = "";
        }
      }
    }
    
    return markdownLines.join("\n");
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
                      Selecione o arquivo PDF ou texto com a lista de sócios
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Formato: tabela com Nome, CPF, RG, Empresa, CNPJ, Função, Datas
                    </p>
                  </div>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.md"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isProcessing || isLoading}
                  />
                  
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing || isLoading}
                    variant="outline"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Selecionar PDF ou Texto
                      </>
                    )}
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
