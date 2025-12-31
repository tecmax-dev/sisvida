import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle, Users, CreditCard } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface UpdateRecord {
  cpf: string;
  expires_at: string;
}

interface UpdateResult {
  cpf: string;
  success: boolean;
  patient_name?: string;
  card_number?: string;
  dependents_updated?: number;
  error?: string;
}

interface ProcessingSummary {
  total: number;
  success_count: number;
  error_count: number;
  dependents_synced: number;
}

export function BulkCardExpiryUpdate() {
  const [selectedClinic, setSelectedClinic] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [records, setRecords] = useState<UpdateRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<UpdateResult[]>([]);
  const [summary, setSummary] = useState<ProcessingSummary | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Fetch clinics
  const { data: clinics } = useQuery({
    queryKey: ["admin-clinics-for-bulk"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinics")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setRecords([]);
    setResults([]);
    setSummary(null);
    setParseError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

        // Find CPF and date columns
        const headers = jsonData[0] as string[];
        let cpfIndex = -1;
        let dateIndex = -1;

        headers.forEach((header, index) => {
          const headerLower = String(header).toLowerCase().trim();
          if (headerLower.includes("cpf") || headerLower === "nrcpf") {
            cpfIndex = index;
          }
          if (
            headerLower.includes("valid") ||
            headerLower.includes("expir") ||
            headerLower.includes("vencimento") ||
            headerLower.includes("data")
          ) {
            dateIndex = index;
          }
        });

        if (cpfIndex === -1) {
          setParseError("Coluna de CPF não encontrada. Certifique-se de que existe uma coluna com 'CPF' no cabeçalho.");
          return;
        }

        if (dateIndex === -1) {
          setParseError("Coluna de data de validade não encontrada. Certifique-se de que existe uma coluna com 'Validade', 'Vencimento' ou 'Data' no cabeçalho.");
          return;
        }

        const parsedRecords: UpdateRecord[] = [];
        
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || !row[cpfIndex]) continue;

          const cpf = String(row[cpfIndex]).replace(/\D/g, "");
          if (cpf.length !== 11) continue;

          let dateValue = row[dateIndex];
          let formattedDate = "";

          if (typeof dateValue === "number") {
            // Excel serial date
            const excelDate = XLSX.SSF.parse_date_code(dateValue);
            formattedDate = `${excelDate.y}-${String(excelDate.m).padStart(2, "0")}-${String(excelDate.d).padStart(2, "0")}`;
          } else if (dateValue) {
            formattedDate = String(dateValue);
          }

          if (formattedDate) {
            parsedRecords.push({
              cpf,
              expires_at: formattedDate,
            });
          }
        }

        setRecords(parsedRecords);
        toast.success(`${parsedRecords.length} registros encontrados no arquivo`);

      } catch (err) {
        console.error("Error parsing file:", err);
        setParseError("Erro ao processar arquivo. Verifique se é um arquivo Excel válido.");
      }
    };

    reader.readAsArrayBuffer(selectedFile);
  }, []);

  const handleProcess = async () => {
    if (!selectedClinic || records.length === 0) {
      toast.error("Selecione uma clínica e carregue um arquivo");
      return;
    }

    setIsProcessing(true);
    setProgress(10);
    setResults([]);
    setSummary(null);

    try {
      setProgress(30);

      const { data, error } = await supabase.functions.invoke("bulk-update-card-expiry", {
        body: {
          clinic_id: selectedClinic,
          records,
        },
      });

      setProgress(90);

      if (error) {
        throw new Error(error.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setResults(data.results);
      setSummary(data.summary);
      setProgress(100);

      toast.success(`Processamento concluído: ${data.summary.success_count} atualizados, ${data.summary.error_count} erros`);

    } catch (err) {
      console.error("Processing error:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao processar");
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setRecords([]);
    setResults([]);
    setSummary(null);
    setParseError(null);
    setProgress(0);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Atualização em Massa de Validade
        </CardTitle>
        <CardDescription>
          Atualize a data de validade de múltiplas carteirinhas via arquivo Excel
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1: Select Clinic */}
        <div className="space-y-2">
          <Label>1. Selecione a Clínica</Label>
          <Select value={selectedClinic} onValueChange={setSelectedClinic}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha uma clínica" />
            </SelectTrigger>
            <SelectContent>
              {clinics?.map((clinic) => (
                <SelectItem key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Step 2: Upload File */}
        <div className="space-y-2">
          <Label>2. Carregar Arquivo Excel</Label>
          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              disabled={isProcessing}
              className="flex-1"
            />
            {file && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <FileSpreadsheet className="h-3 w-3" />
                {file.name}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            O arquivo deve conter colunas: CPF (ou NRCPF) e Data de Validade (ou Vencimento)
          </p>
        </div>

        {/* Parse Error */}
        {parseError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro ao processar arquivo</AlertTitle>
            <AlertDescription>{parseError}</AlertDescription>
          </Alert>
        )}

        {/* Records Preview */}
        {records.length > 0 && !summary && (
          <Alert>
            <FileSpreadsheet className="h-4 w-4" />
            <AlertTitle>{records.length} registros prontos para processamento</AlertTitle>
            <AlertDescription>
              Clique em "Processar" para atualizar as carteirinhas
            </AlertDescription>
          </Alert>
        )}

        {/* Progress */}
        {isProcessing && (
          <div className="space-y-2">
            <Label>Processando...</Label>
            <Progress value={progress} />
            <p className="text-xs text-muted-foreground text-center">
              Aguarde enquanto as carteirinhas são atualizadas
            </p>
          </div>
        )}

        {/* Summary */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{summary.total}</div>
                <p className="text-xs text-muted-foreground">Total Processado</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-green-600">{summary.success_count}</div>
                <p className="text-xs text-muted-foreground">Atualizados</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-red-600">{summary.error_count}</div>
                <p className="text-xs text-muted-foreground">Erros</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-blue-600 flex items-center gap-1">
                  <Users className="h-5 w-5" />
                  {summary.dependents_synced}
                </div>
                <p className="text-xs text-muted-foreground">Dependentes Sincronizados</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Results Table */}
        {results.length > 0 && (
          <div className="space-y-2">
            <Label>Resultados Detalhados</Label>
            <ScrollArea className="h-[300px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Status</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Carteirinha</TableHead>
                    <TableHead>Deps</TableHead>
                    <TableHead>Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((result, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {result.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{result.cpf}</TableCell>
                      <TableCell>{result.patient_name || "—"}</TableCell>
                      <TableCell>{result.card_number || "—"}</TableCell>
                      <TableCell>{result.dependents_updated ?? "—"}</TableCell>
                      <TableCell className="text-red-600 text-sm">{result.error || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={handleProcess}
            disabled={!selectedClinic || records.length === 0 || isProcessing}
            className="flex-1"
          >
            <Upload className="h-4 w-4 mr-2" />
            {isProcessing ? "Processando..." : "Processar Atualizações"}
          </Button>
          {(results.length > 0 || parseError) && (
            <Button variant="outline" onClick={resetForm}>
              Limpar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
