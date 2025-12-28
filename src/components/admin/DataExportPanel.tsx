import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';
import { 
  Download, 
  FileSpreadsheet, 
  Users, 
  FileText, 
  Stethoscope, 
  ClipboardList,
  Building2,
  Loader2,
  Phone,
} from 'lucide-react';
import { exportClinicData, getExportCounts, ExportProgress } from '@/lib/dataExportUtils';

interface DataExportPanelProps {
  clinicId: string;
  clinicName: string;
}

interface ExportCounts {
  patients: number;
  medicalRecords: number;
  professionals: number;
  procedures: number;
  insurancePlans: number;
}

export default function DataExportPanel({ clinicId, clinicName }: DataExportPanelProps) {
  const [counts, setCounts] = useState<ExportCounts | null>(null);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  
  // Export options
  const [exportPatients, setExportPatients] = useState(true);
  const [exportContacts, setExportContacts] = useState(false);
  const [exportMedicalRecords, setExportMedicalRecords] = useState(true);
  const [exportProfessionals, setExportProfessionals] = useState(true);
  const [exportProcedures, setExportProcedures] = useState(true);
  const [exportInsurancePlans, setExportInsurancePlans] = useState(true);

  // Fetch counts when clinic changes
  useEffect(() => {
    if (clinicId) {
      fetchCounts();
    }
  }, [clinicId]);

  const fetchCounts = async () => {
    setLoadingCounts(true);
    try {
      const result = await getExportCounts(clinicId);
      setCounts(result);
    } catch (error) {
      console.error('Error fetching counts:', error);
      toast.error('Erro ao carregar contagens');
    } finally {
      setLoadingCounts(false);
    }
  };

  const handleExport = async () => {
    if (!clinicId) {
      toast.error('Selecione uma clínica');
      return;
    }

    const anySelected = exportPatients || exportContacts || exportMedicalRecords || 
                        exportProfessionals || exportProcedures || exportInsurancePlans;
    
    if (!anySelected) {
      toast.error('Selecione pelo menos um tipo de dado para exportar');
      return;
    }

    setExporting(true);
    setProgress(null);

    try {
      await exportClinicData({
        clinicId,
        clinicName,
        exportPatients,
        exportContacts,
        exportMedicalRecords,
        exportProfessionals,
        exportProcedures,
        exportInsurancePlans,
      }, (p) => setProgress(p));

      toast.success('Exportação concluída com sucesso!');
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error.message || 'Erro ao exportar dados');
    } finally {
      setExporting(false);
      setProgress(null);
    }
  };

  const exportOptions = [
    {
      id: 'patients',
      label: 'Pacientes',
      description: 'Dados completos dos pacientes (nome, CPF, telefone, email, endereço, etc)',
      icon: Users,
      checked: exportPatients,
      onChange: setExportPatients,
      count: counts?.patients || 0,
    },
    {
      id: 'contacts',
      label: 'Lista de Contatos',
      description: 'Apenas nome, telefone e email dos pacientes',
      icon: Phone,
      checked: exportContacts,
      onChange: setExportContacts,
      count: counts?.patients || 0,
    },
    {
      id: 'records',
      label: 'Prontuários',
      description: 'Registros médicos com diagnóstico, tratamento e prescrições',
      icon: FileText,
      checked: exportMedicalRecords,
      onChange: setExportMedicalRecords,
      count: counts?.medicalRecords || 0,
    },
    {
      id: 'professionals',
      label: 'Profissionais',
      description: 'Dados dos profissionais (nome, especialidade, CRM, comissão)',
      icon: Stethoscope,
      checked: exportProfessionals,
      onChange: setExportProfessionals,
      count: counts?.professionals || 0,
    },
    {
      id: 'procedures',
      label: 'Procedimentos',
      description: 'Catálogo de procedimentos com preços e duração',
      icon: ClipboardList,
      checked: exportProcedures,
      onChange: setExportProcedures,
      count: counts?.procedures || 0,
    },
    {
      id: 'insurance',
      label: 'Convênios',
      description: 'Planos de saúde e convênios cadastrados',
      icon: Building2,
      checked: exportInsurancePlans,
      onChange: setExportInsurancePlans,
      count: counts?.insurancePlans || 0,
    },
  ];

  const selectedCount = exportOptions.filter(o => o.checked).length;
  const totalRecords = exportOptions.filter(o => o.checked).reduce((sum, o) => sum + o.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Exportar Dados
        </CardTitle>
        <CardDescription>
          Selecione os dados que deseja exportar para uma planilha XLSX
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Export Options Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {exportOptions.map((option) => {
            const Icon = option.icon;
            return (
              <div
                key={option.id}
                className={`relative border rounded-lg p-4 transition-all cursor-pointer hover:border-primary/50 ${
                  option.checked ? 'border-primary bg-primary/5' : 'border-border'
                }`}
                onClick={() => option.onChange(!option.checked)}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={option.id}
                    checked={option.checked}
                    onCheckedChange={(checked) => option.onChange(checked as boolean)}
                    className="mt-1"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor={option.id} className="font-medium cursor-pointer">
                        {option.label}
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                    {loadingCounts ? (
                      <div className="h-5" />
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        {option.count.toLocaleString('pt-BR')} registros
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Export Summary */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                <strong>{selectedCount}</strong> tipo(s) selecionado(s)
              </span>
              {!loadingCounts && (
                <span className="text-sm text-muted-foreground">
                  ~<strong>{totalRecords.toLocaleString('pt-BR')}</strong> registros
                </span>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setExportPatients(true);
                  setExportContacts(true);
                  setExportMedicalRecords(true);
                  setExportProfessionals(true);
                  setExportProcedures(true);
                  setExportInsurancePlans(true);
                }}
              >
                Selecionar Tudo
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setExportPatients(false);
                  setExportContacts(false);
                  setExportMedicalRecords(false);
                  setExportProfessionals(false);
                  setExportProcedures(false);
                  setExportInsurancePlans(false);
                }}
              >
                Limpar
              </Button>
            </div>
          </div>

          {/* Progress Bar */}
          {exporting && progress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Exportando: {progress.currentEntity}
                </span>
                <span className="text-muted-foreground">
                  {progress.current}/{progress.total}
                </span>
              </div>
              <Progress value={(progress.current / progress.total) * 100} />
            </div>
          )}

          {/* Export Button */}
          <Button
            onClick={handleExport}
            disabled={exporting || selectedCount === 0 || !clinicId}
            className="w-full gap-2"
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Exportar para XLSX
              </>
            )}
          </Button>
        </div>

        {/* Info Box */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• O arquivo será baixado automaticamente após a exportação</p>
          <p>• Cada tipo de dado será salvo em uma aba separada na planilha</p>
          <p>• Datas e CPFs serão formatados corretamente</p>
        </div>
      </CardContent>
    </Card>
  );
}
