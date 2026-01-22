import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Upload, CheckCircle2, AlertCircle, Building2, Link2, FileSpreadsheet, FileText } from "lucide-react";
import { PopupBase, PopupHeader, PopupTitle, PopupFooter } from "@/components/ui/popup-base";
import { parseAccountingReport, parseExcelAccountingReport, ParsedOffice, formatCnpj, normalizeCnpj } from "@/lib/pdfAccountingParser";
import * as XLSX from "xlsx";

interface Employer {
  id: string;
  name: string;
  cnpj: string;
}

interface ImportPreview {
  office: ParsedOffice;
  existsInSystem: boolean;
  existingOfficeId?: string;
  matchedEmployers: Employer[];
  unmatchedCnpjs: string[];
}

interface ImportResult {
  officesCreated: number;
  officesUpdated: number;
  linksCreated: number;
  companiesNotFound: string[];
}

interface AccountingOfficeImportPanelProps {
  clinicId: string;
  employers: Employer[];
  existingOffices: Array<{ id: string; email: string; name: string }>;
  onImportComplete: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function AccountingOfficeImportPanel({
  clinicId,
  employers,
  existingOffices,
  onImportComplete,
  isOpen,
  onClose,
}: AccountingOfficeImportPanelProps) {
  const [textContent, setTextContent] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [preview, setPreview] = useState<ImportPreview[] | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [inputMode, setInputMode] = useState<"select" | "excel" | "text">("select");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateAccessCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const processParseResult = (offices: ParsedOffice[]) => {
    if (offices.length === 0) {
      toast.error("Nenhum escritório encontrado");
      return;
    }

    // Criar preview com matching
    const previews: ImportPreview[] = offices.map((office) => {
      // Verifica se o escritório já existe (por email)
      const existingOffice = existingOffices.find(
        (o) => o.email.toLowerCase() === office.email.toLowerCase()
      );

      // Match empresas por CNPJ
      const matchedEmployers: Employer[] = [];
      const unmatchedCnpjs: string[] = [];

      for (const cnpj of office.linkedCompanyCnpjs) {
        const normalizedCnpj = normalizeCnpj(cnpj);
        const employer = employers.find(
          (e) => normalizeCnpj(e.cnpj) === normalizedCnpj
        );
        if (employer) {
          matchedEmployers.push(employer);
        } else {
          unmatchedCnpjs.push(cnpj);
        }
      }

      return {
        office,
        existsInSystem: !!existingOffice,
        existingOfficeId: existingOffice?.id,
        matchedEmployers,
        unmatchedCnpjs,
      };
    });

    setPreview(previews);
    toast.success(`${previews.length} escritório(s) encontrado(s)`);
  };

  const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      const result = parseExcelAccountingReport(rows);
      processParseResult(result.offices);
    } catch (error) {
      console.error("Excel parse error:", error);
      toast.error("Erro ao processar planilha");
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleParse = () => {
    if (!textContent.trim()) {
      toast.error("Cole o conteúdo do relatório");
      return;
    }

    setIsParsing(true);
    try {
      const result = parseAccountingReport(textContent);
      processParseResult(result.offices);
    } catch (error) {
      console.error("Parse error:", error);
      toast.error("Erro ao processar texto");
    } finally {
      setIsParsing(false);
    }
  };

  const handleImport = async () => {
    if (!preview || preview.length === 0) return;

    setIsImporting(true);
    const result: ImportResult = {
      officesCreated: 0,
      officesUpdated: 0,
      linksCreated: 0,
      companiesNotFound: [],
    };

    try {
      for (const item of preview) {
        let officeId: string;

        if (item.existsInSystem && item.existingOfficeId) {
          // Atualizar escritório existente
          const { error } = await supabase
            .from("accounting_offices")
            .update({
              name: item.office.name,
              phone: item.office.phone || null,
              legacy_id: item.office.legacyId || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.existingOfficeId);

          if (error) {
            console.error("Error updating office:", error);
            continue;
          }
          officeId = item.existingOfficeId;
          result.officesUpdated++;
        } else {
          // Criar novo escritório
          const { data, error } = await supabase
            .from("accounting_offices")
            .insert({
              clinic_id: clinicId,
              name: item.office.name,
              email: item.office.email.toLowerCase(),
              phone: item.office.phone || null,
              legacy_id: item.office.legacyId || null,
              access_code: generateAccessCode(),
              is_active: true,
            })
            .select("id")
            .single();

          if (error) {
            console.error("Error creating office:", error);
            // Se já existe por email, tenta buscar
            if (error.code === "23505") {
              const { data: existing } = await supabase
                .from("accounting_offices")
                .select("id")
                .eq("clinic_id", clinicId)
                .eq("email", item.office.email.toLowerCase())
                .single();
              
              if (existing) {
                officeId = existing.id;
                result.officesUpdated++;
              } else {
                continue;
              }
            } else {
              continue;
            }
          } else {
            officeId = data.id;
            result.officesCreated++;
          }
        }

        // Criar vínculos com empresas encontradas
        if (item.matchedEmployers.length > 0) {
          // Primeiro, remove vínculos existentes para evitar duplicatas
          await supabase
            .from("accounting_office_employers")
            .delete()
            .eq("accounting_office_id", officeId);

          // Cria novos vínculos
          const links = item.matchedEmployers.map((emp) => ({
            accounting_office_id: officeId,
            employer_id: emp.id,
          }));

          const { error: linkError } = await supabase
            .from("accounting_office_employers")
            .insert(links);

          if (!linkError) {
            result.linksCreated += links.length;
          }
        }

        // Registra CNPJs não encontrados
        result.companiesNotFound.push(...item.unmatchedCnpjs);
      }

      setImportResult(result);
      toast.success("Importação concluída!");
      onImportComplete();
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Erro durante a importação");
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setTextContent("");
    setPreview(null);
    setImportResult(null);
    onClose();
  };

  const totalMatchedEmployers = preview?.reduce(
    (sum, p) => sum + p.matchedEmployers.length,
    0
  ) || 0;

  const totalUnmatchedCnpjs = preview?.reduce(
    (sum, p) => sum + p.unmatchedCnpjs.length,
    0
  ) || 0;

  const resetToSelectMode = () => {
    setInputMode("select");
    setTextContent("");
  };

  return (
    <PopupBase open={isOpen} onClose={handleClose} maxWidth="4xl">
      <PopupHeader>
        <PopupTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Importar Escritórios do Relatório
        </PopupTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Importe escritórios de contabilidade a partir de um arquivo Excel ou texto colado.
        </p>
      </PopupHeader>

      <div className="flex-1 overflow-y-auto space-y-4 py-4 max-h-[60vh]">
        {importResult ? (
          // Resultado da importação
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                Importação Concluída
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-700">
                    {importResult.officesCreated}
                  </div>
                  <div className="text-sm text-green-600">Escritórios criados</div>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-700">
                    {importResult.officesUpdated}
                  </div>
                  <div className="text-sm text-blue-600">Escritórios atualizados</div>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-700">
                    {importResult.linksCreated}
                  </div>
                  <div className="text-sm text-purple-600">Vínculos criados</div>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-700">
                    {importResult.companiesNotFound.length}
                  </div>
                  <div className="text-sm text-orange-600">Empresas não encontradas</div>
                </div>
              </div>

              {importResult.companiesNotFound.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-medium text-muted-foreground mb-2">
                    CNPJs não encontrados no sistema:
                  </div>
                  <ScrollArea className="h-32 border rounded-md p-2">
                    <div className="space-y-1">
                      {importResult.companiesNotFound.map((cnpj, idx) => (
                        <div key={idx} className="text-sm font-mono">
                          {formatCnpj(cnpj)}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        ) : preview ? (
          // Preview dos dados
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge variant="secondary" className="text-lg py-1 px-3">
                  {preview.length} escritório(s)
                </Badge>
                <Badge variant="outline" className="text-lg py-1 px-3 text-green-600">
                  {totalMatchedEmployers} empresa(s) encontrada(s)
                </Badge>
                {totalUnmatchedCnpjs > 0 && (
                  <Badge variant="outline" className="text-lg py-1 px-3 text-orange-600">
                    {totalUnmatchedCnpjs} não encontrada(s)
                  </Badge>
                )}
              </div>
              <Button variant="outline" onClick={() => setPreview(null)}>
                Voltar
              </Button>
            </div>

            <ScrollArea className="h-[400px]">
              <div className="space-y-3 pr-4">
                {preview.map((item, idx) => (
                  <Card key={idx} className={item.existsInSystem ? "border-blue-300" : "border-green-300"}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{item.office.name}</span>
                            <Badge variant={item.existsInSystem ? "secondary" : "default"} className="text-xs">
                              {item.existsInSystem ? "Já existe" : "Novo"}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div>Email: {item.office.email}</div>
                            <div>Telefone: {item.office.phone}</div>
                            <div>ID Legado: {item.office.legacyId}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-green-600">
                            <Link2 className="h-4 w-4" />
                            <span className="font-medium">{item.matchedEmployers.length}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">empresas</div>
                          {item.unmatchedCnpjs.length > 0 && (
                            <div className="text-xs text-orange-600 mt-1">
                              +{item.unmatchedCnpjs.length} não encontrada(s)
                            </div>
                          )}
                        </div>
                      </div>

                      {item.matchedEmployers.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="text-xs font-medium text-muted-foreground mb-2">
                            Empresas vinculadas:
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {item.matchedEmployers.slice(0, 5).map((emp) => (
                              <Badge key={emp.id} variant="outline" className="text-xs">
                                {emp.name.substring(0, 25)}...
                              </Badge>
                            ))}
                            {item.matchedEmployers.length > 5 && (
                              <Badge variant="outline" className="text-xs">
                                +{item.matchedEmployers.length - 5} mais
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        ) : inputMode === "select" ? (
          // Seleção de modo de importação
          <div className="space-y-6">
            <div className="text-sm text-muted-foreground text-center">
              Escolha como deseja importar os escritórios de contabilidade:
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <Card 
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <CardContent className="p-6 text-center">
                  <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-green-600" />
                  <div className="font-medium mb-2">Upload de Planilha</div>
                  <div className="text-sm text-muted-foreground">
                    Faça upload do arquivo Excel (.xlsx) do relatório
                  </div>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => setInputMode("text")}
              >
                <CardContent className="p-6 text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-blue-600" />
                  <div className="font-medium mb-2">Colar Texto</div>
                  <div className="text-sm text-muted-foreground">
                    Cole o conteúdo copiado de um PDF ou planilha
                  </div>
                </CardContent>
              </Card>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelUpload}
              className="hidden"
            />
          </div>
        ) : (
          // Input de texto
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Cole o conteúdo do relatório abaixo:
              </div>
              <Button variant="ghost" size="sm" onClick={resetToSelectMode}>
                ← Voltar
              </Button>
            </div>
            
            <Textarea
              placeholder="Cole aqui o conteúdo do relatório..."
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
            />
          </div>
        )}
      </div>

      <PopupFooter>
        {importResult ? (
          <Button onClick={handleClose}>Fechar</Button>
        ) : preview ? (
          <>
            <Button variant="outline" onClick={handleClose} disabled={isImporting}>
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Importar {preview.length} Escritório(s)
            </Button>
          </>
        ) : inputMode === "text" ? (
          <>
            <Button variant="outline" onClick={handleClose} disabled={isParsing}>
              Cancelar
            </Button>
            <Button onClick={handleParse} disabled={isParsing || !textContent.trim()}>
              {isParsing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Processar Texto
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
        )}
      </PopupFooter>
    </PopupBase>
  );
}
