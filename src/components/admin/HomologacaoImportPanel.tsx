import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { 
  Upload, 
  FileJson, 
  CheckCircle2, 
  AlertCircle,
  AlertTriangle,
  Loader2,
  Info,
  ChevronDown,
  Stethoscope,
  Users,
  Calendar,
  Clock,
  Bell,
} from "lucide-react";

interface HomologacaoImportPanelProps {
  clinics: Array<{ id: string; name: string; slug: string }>;
  selectedClinicId: string;
  onClinicChange: (clinicId: string) => void;
}

interface BackupPayload {
  module: string;
  version: string;
  exported_at: string;
  exported_by?: string;
  clinic?: {
    id: string;
    name: string;
    slug: string;
  };
  data: {
    settings?: any[];
    professionals?: any[];
    service_types?: any[];
    schedules?: any[];
    professional_services?: any[];
    blocks?: any[];
    appointments?: any[];
    notifications?: any[];
  };
  stats?: {
    total_records: number;
    by_table: Record<string, number>;
  };
}

interface ImportResult {
  success: boolean;
  summary: Array<{
    table: string;
    imported: number;
    errors: number;
  }>;
  total_imported: number;
  total_errors: number;
  error_details: string[];
}

const TABLE_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  settings: { label: 'Configurações', icon: <Info className="h-4 w-4" /> },
  professionals: { label: 'Profissionais', icon: <Users className="h-4 w-4" /> },
  service_types: { label: 'Tipos de Serviço', icon: <Stethoscope className="h-4 w-4" /> },
  schedules: { label: 'Horários', icon: <Clock className="h-4 w-4" /> },
  professional_services: { label: 'Serviços por Profissional', icon: <Stethoscope className="h-4 w-4" /> },
  blocks: { label: 'Bloqueios', icon: <AlertCircle className="h-4 w-4" /> },
  appointments: { label: 'Agendamentos', icon: <Calendar className="h-4 w-4" /> },
  notifications: { label: 'Notificações', icon: <Bell className="h-4 w-4" /> },
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export function HomologacaoImportPanel({ 
  clinics, 
  selectedClinicId, 
  onClinicChange 
}: HomologacaoImportPanelProps) {
  const [payload, setPayload] = useState<BackupPayload | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [fileSize, setFileSize] = useState<number>(0);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  
  // Options
  const [clearExisting, setClearExisting] = useState(false);
  const [skipAppointments, setSkipAppointments] = useState(false);
  
  // Errors panel
  const [errorsOpen, setErrorsOpen] = useState(false);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setFileSize(file.size);
    setImportResult(null);
    setProgress(0);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content) as BackupPayload;

        // Validate module
        if (parsed.module !== 'homologacao') {
          toast.error('Arquivo inválido: O módulo deve ser "homologacao"');
          setPayload(null);
          return;
        }

        setPayload(parsed);
        
        const totalRecords = parsed.stats?.total_records || 
          Object.values(parsed.data).reduce((sum, arr) => sum + (arr?.length || 0), 0);
        
        toast.success(`Backup carregado: ${totalRecords} registros`, {
          description: `Origem: ${parsed.clinic?.name || 'Desconhecida'}`,
        });
      } catch (err) {
        console.error('Error parsing JSON:', err);
        toast.error('Erro ao ler arquivo JSON');
        setPayload(null);
      }
    };

    reader.onerror = () => {
      toast.error('Erro ao ler arquivo');
      setPayload(null);
    };

    reader.readAsText(file);
    event.target.value = '';
  }, []);

  const runImport = async () => {
    if (!payload || !selectedClinicId) {
      toast.error('Selecione uma clínica e carregue o arquivo');
      return;
    }

    setIsImporting(true);
    setProgress(10);
    setImportResult(null);

    try {
      setProgress(30);

      const { data, error } = await supabase.functions.invoke('import-homologacao-module', {
        body: {
          target_clinic_id: selectedClinicId,
          backup_data: payload,
          options: {
            clear_existing: clearExisting,
            skip_appointments: skipAppointments,
          },
        },
      });

      setProgress(100);

      if (error) {
        console.error('Import error:', error);
        toast.error('Erro na importação', { description: error.message });
        setImportResult({
          success: false,
          summary: [],
          total_imported: 0,
          total_errors: 1,
          error_details: [error.message],
        });
        return;
      }

      const result = data as ImportResult;
      setImportResult(result);

      if (result.success) {
        toast.success(`Importação concluída: ${result.total_imported} registros`, {
          description: 'Dados do módulo Homologação importados com sucesso',
        });
      } else {
        toast.warning(`Importação parcial: ${result.total_imported} registros, ${result.total_errors} erros`, {
          description: 'Verifique os detalhes dos erros abaixo',
        });
      }
    } catch (err) {
      console.error('Import exception:', err);
      toast.error('Erro inesperado na importação');
      setImportResult({
        success: false,
        summary: [],
        total_imported: 0,
        total_errors: 1,
        error_details: [String(err)],
      });
    } finally {
      setIsImporting(false);
    }
  };

  const getTotalRecords = (): number => {
    if (!payload) return 0;
    return Object.values(payload.data).reduce((sum, arr) => sum + (arr?.length || 0), 0);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-teal-600" />
          Importar Módulo Homologação
        </CardTitle>
        <CardDescription>
          Importe dados de exames ocupacionais a partir de um backup JSON exportado de outro projeto.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Clinic Selection */}
        <div className="space-y-2">
          <Label>Clínica Destino</Label>
          <Select value={selectedClinicId} onValueChange={onClinicChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a clínica..." />
            </SelectTrigger>
            <SelectContent>
              {clinics.map(clinic => (
                <SelectItem key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* File Upload */}
        <div className="space-y-2">
          <Label>Arquivo de Backup</Label>
          <div className="flex items-center gap-4">
            <Button variant="outline" asChild className="flex-1">
              <label className="cursor-pointer flex items-center justify-center gap-2">
                <Upload className="h-4 w-4" />
                Carregar JSON
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </Button>
            {fileName && (
              <div className="flex items-center gap-2">
                <FileJson className="h-4 w-4 text-muted-foreground" />
                <Badge variant="secondary">{fileName}</Badge>
                <Badge variant="outline">{formatFileSize(fileSize)}</Badge>
              </div>
            )}
          </div>
        </div>

        {/* Payload Preview */}
        {payload && (
          <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Preview do Backup</h4>
              <Badge variant="outline">{getTotalRecords()} registros</Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Origem:</span>{' '}
                <span className="font-medium">{payload.clinic?.name || 'Desconhecida'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Versão:</span>{' '}
                <span className="font-medium">{payload.version}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Exportado em:</span>{' '}
                <span className="font-medium">
                  {payload.exported_at 
                    ? new Date(payload.exported_at).toLocaleString('pt-BR')
                    : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Por:</span>{' '}
                <span className="font-medium">{payload.exported_by || 'N/A'}</span>
              </div>
            </div>

            {/* Records by table */}
            <div className="space-y-2">
              <h5 className="text-sm font-medium text-muted-foreground">Registros por Tabela</h5>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(payload.data).map(([table, records]) => {
                  const count = records?.length || 0;
                  const info = TABLE_LABELS[table] || { label: table, icon: <Info className="h-4 w-4" /> };
                  return (
                    <div 
                      key={table}
                      className="flex items-center gap-2 p-2 rounded-md bg-background border"
                    >
                      {info.icon}
                      <span className="text-sm">{info.label}</span>
                      <Badge variant="secondary" className="ml-auto">{count}</Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Options */}
        {payload && (
          <div className="space-y-4 border rounded-lg p-4">
            <h4 className="font-medium">Opções de Importação</h4>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="clear-existing">Limpar dados existentes</Label>
                <p className="text-xs text-muted-foreground">
                  Remove todos os dados do módulo Homologação antes de importar
                </p>
              </div>
              <Switch
                id="clear-existing"
                checked={clearExisting}
                onCheckedChange={setClearExisting}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="skip-appointments">Pular agendamentos</Label>
                <p className="text-xs text-muted-foreground">
                  Importa apenas configuração (profissionais, serviços, horários)
                </p>
              </div>
              <Switch
                id="skip-appointments"
                checked={skipAppointments}
                onCheckedChange={setSkipAppointments}
              />
            </div>
          </div>
        )}

        {/* Progress */}
        {isImporting && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Importando...
              </span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {/* Import Button */}
        <Button
          onClick={runImport}
          disabled={!payload || !selectedClinicId || isImporting}
          className="w-full"
        >
          {isImporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Importando...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Importar Dados
            </>
          )}
        </Button>

        {/* Results */}
        {importResult && (
          <div className="space-y-4 border rounded-lg p-4">
            <div className="flex items-center gap-2">
              {importResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : importResult.total_imported > 0 ? (
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              <h4 className="font-medium">
                {importResult.success 
                  ? 'Importação Concluída' 
                  : importResult.total_imported > 0
                    ? 'Importação Parcial'
                    : 'Falha na Importação'}
              </h4>
            </div>

            <div className="flex gap-4">
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {importResult.total_imported} importados
              </Badge>
              {importResult.total_errors > 0 && (
                <Badge variant="secondary" className="bg-red-100 text-red-800">
                  {importResult.total_errors} erros
                </Badge>
              )}
            </div>

            {/* Summary Table */}
            {importResult.summary.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tabela</TableHead>
                    <TableHead className="text-right">Importados</TableHead>
                    <TableHead className="text-right">Erros</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importResult.summary.map((row) => {
                    const info = TABLE_LABELS[row.table] || { label: row.table, icon: null };
                    return (
                      <TableRow key={row.table}>
                        <TableCell className="flex items-center gap-2">
                          {info.icon}
                          {info.label}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            {row.imported}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {row.errors > 0 ? (
                            <Badge variant="secondary" className="bg-red-100 text-red-800">
                              {row.errors}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {/* Error Details */}
            {importResult.error_details.length > 0 && (
              <Collapsible open={errorsOpen} onOpenChange={setErrorsOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      Detalhes dos Erros ({importResult.error_details.length})
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${errorsOpen ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ScrollArea className="h-40 mt-2 border rounded-md p-2 bg-muted/50">
                    <div className="space-y-1 text-sm font-mono">
                      {importResult.error_details.map((err, idx) => (
                        <div key={idx} className="text-red-600">
                          {err}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
          <h5 className="font-medium mb-2 flex items-center gap-2">
            <Info className="h-4 w-4" />
            Como usar
          </h5>
          <ol className="list-decimal list-inside space-y-1">
            <li>Exporte o módulo Homologação do projeto de origem como JSON</li>
            <li>Selecione a clínica destino neste formulário</li>
            <li>Carregue o arquivo JSON exportado</li>
            <li>Revise as opções de importação</li>
            <li>Clique em "Importar Dados"</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}