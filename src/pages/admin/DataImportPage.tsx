import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { 
  Upload, 
  FileSpreadsheet, 
  Download, 
  AlertCircle, 
  CheckCircle2, 
  AlertTriangle,
  Loader2,
  Users,
  FileText,
} from "lucide-react";
import {
  PatientImportRow,
  MedicalRecordImportRow,
  ImportRow,
  parseSpreadsheet,
  validatePatientRow,
  validateMedicalRecordRow,
  mapPatientRow,
  mapMedicalRecordRow,
  downloadTemplate,
  formatPhone,
  formatCPF,
  parseDate,
} from "@/lib/importUtils";

interface Clinic {
  id: string;
  name: string;
  slug: string;
}

export default function DataImportPage() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState<string>("");
  const [loadingClinics, setLoadingClinics] = useState(false);
  const [activeTab, setActiveTab] = useState<"patients" | "records">("patients");
  
  // Patient import state
  const [patientRows, setPatientRows] = useState<ImportRow<PatientImportRow>[]>([]);
  const [importingPatients, setImportingPatients] = useState(false);
  const [patientProgress, setPatientProgress] = useState(0);
  
  // Medical records import state
  const [recordRows, setRecordRows] = useState<ImportRow<MedicalRecordImportRow>[]>([]);
  const [importingRecords, setImportingRecords] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);

  // Fetch clinics on mount
  useState(() => {
    fetchClinics();
  });

  const fetchClinics = async () => {
    setLoadingClinics(true);
    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('id, name, slug')
        .order('name');
      
      if (error) throw error;
      setClinics(data || []);
    } catch (error) {
      console.error('Error fetching clinics:', error);
      toast.error('Erro ao carregar clínicas');
    } finally {
      setLoadingClinics(false);
    }
  };

  const handlePatientFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      const buffer = await file.arrayBuffer();
      const rows = parseSpreadsheet<PatientImportRow>(buffer, validatePatientRow, mapPatientRow);
      setPatientRows(rows);
      toast.success(`${rows.length} linhas carregadas`);
    } catch (error) {
      console.error('Error parsing file:', error);
      toast.error('Erro ao ler arquivo. Verifique o formato.');
    }
    
    event.target.value = '';
  }, []);

  const handleRecordsFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      const buffer = await file.arrayBuffer();
      const rows = parseSpreadsheet<MedicalRecordImportRow>(buffer, validateMedicalRecordRow, mapMedicalRecordRow);
      setRecordRows(rows);
      toast.success(`${rows.length} linhas carregadas`);
    } catch (error) {
      console.error('Error parsing file:', error);
      toast.error('Erro ao ler arquivo. Verifique o formato.');
    }
    
    event.target.value = '';
  }, []);

  const importPatients = async () => {
    if (!selectedClinicId) {
      toast.error('Selecione uma clínica');
      return;
    }
    
    const validRows = patientRows.filter(r => r.validation.isValid);
    if (validRows.length === 0) {
      toast.error('Nenhum registro válido para importar');
      return;
    }
    
    setImportingPatients(true);
    setPatientProgress(0);
    
    let imported = 0;
    let errors = 0;
    
    for (const row of validRows) {
      try {
        const { error } = await supabase.from('patients').insert({
          clinic_id: selectedClinicId,
          name: row.data.nome.trim(),
          phone: formatPhone(row.data.telefone),
          email: row.data.email?.trim() || null,
          cpf: row.data.cpf ? formatCPF(row.data.cpf) : null,
          birth_date: row.data.data_nascimento ? parseDate(row.data.data_nascimento) : null,
          address: row.data.endereco?.trim() || null,
          notes: row.data.observacoes?.trim() || null,
        });
        
        if (error) {
          if (error.message.includes('CPF_DUPLICADO')) {
            console.warn(`CPF duplicado: ${row.data.cpf}`);
          }
          errors++;
        } else {
          imported++;
        }
      } catch (err) {
        errors++;
      }
      
      setPatientProgress(((imported + errors) / validRows.length) * 100);
    }
    
    setImportingPatients(false);
    setPatientRows([]);
    
    if (errors > 0) {
      toast.warning(`Importação concluída: ${imported} pacientes importados, ${errors} erros`);
    } else {
      toast.success(`${imported} pacientes importados com sucesso!`);
    }
  };

  const importRecords = async () => {
    if (!selectedClinicId) {
      toast.error('Selecione uma clínica');
      return;
    }
    
    const validRows = recordRows.filter(r => r.validation.isValid);
    if (validRows.length === 0) {
      toast.error('Nenhum registro válido para importar');
      return;
    }
    
    setImportingRecords(true);
    setRecordProgress(0);
    
    // Fetch patients from clinic for matching
    const { data: patients } = await supabase
      .from('patients')
      .select('id, name, cpf')
      .eq('clinic_id', selectedClinicId);
    
    const patientsMap = new Map<string, string>();
    const patientsNameMap = new Map<string, string>();
    
    patients?.forEach(p => {
      if (p.cpf) {
        patientsMap.set(p.cpf.replace(/\D/g, ''), p.id);
      }
      patientsNameMap.set(p.name.toLowerCase().trim(), p.id);
    });
    
    let imported = 0;
    let errors = 0;
    let notFound = 0;
    
    for (const row of validRows) {
      // Find patient by CPF or name
      let patientId: string | undefined;
      
      if (row.data.cpf_paciente) {
        const cleanCPF = row.data.cpf_paciente.replace(/\D/g, '');
        patientId = patientsMap.get(cleanCPF);
      }
      
      if (!patientId && row.data.nome_paciente) {
        patientId = patientsNameMap.get(row.data.nome_paciente.toLowerCase().trim());
      }
      
      if (!patientId) {
        notFound++;
        errors++;
        continue;
      }
      
      try {
        const { error } = await supabase.from('medical_records').insert({
          clinic_id: selectedClinicId,
          patient_id: patientId,
          record_date: parseDate(row.data.data_registro) || new Date().toISOString().split('T')[0],
          chief_complaint: row.data.queixa?.trim() || null,
          diagnosis: row.data.diagnostico?.trim() || null,
          treatment_plan: row.data.tratamento?.trim() || null,
          prescription: row.data.prescricao?.trim() || null,
          notes: row.data.observacoes?.trim() || null,
        });
        
        if (error) {
          errors++;
        } else {
          imported++;
        }
      } catch (err) {
        errors++;
      }
      
      setRecordProgress(((imported + errors) / validRows.length) * 100);
    }
    
    setImportingRecords(false);
    setRecordRows([]);
    
    if (notFound > 0) {
      toast.warning(`${imported} prontuários importados. ${notFound} pacientes não encontrados.`);
    } else if (errors > 0) {
      toast.warning(`${imported} prontuários importados, ${errors} erros`);
    } else {
      toast.success(`${imported} prontuários importados com sucesso!`);
    }
  };

  const selectedClinic = clinics.find(c => c.id === selectedClinicId);
  const validPatientCount = patientRows.filter(r => r.validation.isValid).length;
  const validRecordCount = recordRows.filter(r => r.validation.isValid).length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Importação de Dados</h1>
        <p className="text-muted-foreground">
          Importe pacientes e prontuários de planilhas Excel ou CSV
        </p>
      </div>

      {/* Clinic Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Selecione a Clínica</CardTitle>
          <CardDescription>
            Os dados serão importados para esta clínica
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedClinicId} onValueChange={setSelectedClinicId}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder={loadingClinics ? "Carregando..." : "Selecione uma clínica"} />
            </SelectTrigger>
            <SelectContent>
              {clinics.map(clinic => (
                <SelectItem key={clinic.id} value={clinic.id}>
                  {clinic.name} ({clinic.slug})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {selectedClinic && (
            <p className="mt-2 text-sm text-muted-foreground">
              Clínica selecionada: <strong>{selectedClinic.name}</strong>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Import Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "patients" | "records")}>
        <TabsList>
          <TabsTrigger value="patients" className="gap-2">
            <Users className="h-4 w-4" />
            Pacientes
          </TabsTrigger>
          <TabsTrigger value="records" className="gap-2">
            <FileText className="h-4 w-4" />
            Prontuários
          </TabsTrigger>
        </TabsList>

        <TabsContent value="patients" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Importar Pacientes
              </CardTitle>
              <CardDescription>
                Faça upload de uma planilha com os dados dos pacientes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={() => downloadTemplate('patients')}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Baixar Modelo
                </Button>
                
                <label>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handlePatientFile}
                    className="hidden"
                    disabled={!selectedClinicId}
                  />
                  <Button
                    variant="default"
                    className="gap-2"
                    disabled={!selectedClinicId}
                    asChild
                  >
                    <span>
                      <Upload className="h-4 w-4" />
                      Carregar Planilha
                    </span>
                  </Button>
                </label>
              </div>

              {!selectedClinicId && (
                <p className="text-sm text-warning">
                  Selecione uma clínica antes de carregar o arquivo
                </p>
              )}

              {/* Preview Table */}
              {patientRows.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Badge variant="outline">{patientRows.length} linhas</Badge>
                      <Badge variant="default" className="bg-success">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {validPatientCount} válidos
                      </Badge>
                      {patientRows.length - validPatientCount > 0 && (
                        <Badge variant="destructive">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          {patientRows.length - validPatientCount} com erros
                        </Badge>
                      )}
                    </div>
                    
                    <Button
                      onClick={importPatients}
                      disabled={importingPatients || validPatientCount === 0}
                      className="gap-2"
                    >
                      {importingPatients ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      Importar {validPatientCount} pacientes
                    </Button>
                  </div>

                  {importingPatients && (
                    <Progress value={patientProgress} />
                  )}

                  <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Telefone</TableHead>
                          <TableHead>CPF</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {patientRows.slice(0, 100).map((row) => (
                          <TableRow key={row.rowNumber} className={!row.validation.isValid ? 'bg-destructive/5' : ''}>
                            <TableCell className="text-muted-foreground">{row.rowNumber}</TableCell>
                            <TableCell className="font-medium">{row.data.nome}</TableCell>
                            <TableCell>{row.data.telefone}</TableCell>
                            <TableCell>{row.data.cpf || '-'}</TableCell>
                            <TableCell>{row.data.email || '-'}</TableCell>
                            <TableCell>
                              {row.validation.isValid ? (
                                <div className="flex items-center gap-1 text-success">
                                  <CheckCircle2 className="h-4 w-4" />
                                  <span className="text-xs">Válido</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-destructive">
                                  <AlertCircle className="h-4 w-4" />
                                  <span className="text-xs">{row.validation.errors[0]}</span>
                                </div>
                              )}
                              {row.validation.warnings.length > 0 && (
                                <div className="flex items-center gap-1 text-warning mt-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  <span className="text-xs">{row.validation.warnings[0]}</span>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {patientRows.length > 100 && (
                    <p className="text-sm text-muted-foreground text-center">
                      Mostrando 100 de {patientRows.length} linhas
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="records" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Importar Prontuários
              </CardTitle>
              <CardDescription>
                Vincule prontuários a pacientes existentes por CPF ou nome
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={() => downloadTemplate('records')}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Baixar Modelo
                </Button>
                
                <label>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleRecordsFile}
                    className="hidden"
                    disabled={!selectedClinicId}
                  />
                  <Button
                    variant="default"
                    className="gap-2"
                    disabled={!selectedClinicId}
                    asChild
                  >
                    <span>
                      <Upload className="h-4 w-4" />
                      Carregar Planilha
                    </span>
                  </Button>
                </label>
              </div>

              {!selectedClinicId && (
                <p className="text-sm text-warning">
                  Selecione uma clínica antes de carregar o arquivo
                </p>
              )}

              {/* Preview Table */}
              {recordRows.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Badge variant="outline">{recordRows.length} linhas</Badge>
                      <Badge variant="default" className="bg-success">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {validRecordCount} válidos
                      </Badge>
                      {recordRows.length - validRecordCount > 0 && (
                        <Badge variant="destructive">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          {recordRows.length - validRecordCount} com erros
                        </Badge>
                      )}
                    </div>
                    
                    <Button
                      onClick={importRecords}
                      disabled={importingRecords || validRecordCount === 0}
                      className="gap-2"
                    >
                      {importingRecords ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      Importar {validRecordCount} prontuários
                    </Button>
                  </div>

                  {importingRecords && (
                    <Progress value={recordProgress} />
                  )}

                  <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Paciente</TableHead>
                          <TableHead>CPF</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Queixa</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recordRows.slice(0, 100).map((row) => (
                          <TableRow key={row.rowNumber} className={!row.validation.isValid ? 'bg-destructive/5' : ''}>
                            <TableCell className="text-muted-foreground">{row.rowNumber}</TableCell>
                            <TableCell className="font-medium">{row.data.nome_paciente || '-'}</TableCell>
                            <TableCell>{row.data.cpf_paciente || '-'}</TableCell>
                            <TableCell>{row.data.data_registro}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{row.data.queixa || '-'}</TableCell>
                            <TableCell>
                              {row.validation.isValid ? (
                                <div className="flex items-center gap-1 text-success">
                                  <CheckCircle2 className="h-4 w-4" />
                                  <span className="text-xs">Válido</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-destructive">
                                  <AlertCircle className="h-4 w-4" />
                                  <span className="text-xs">{row.validation.errors[0]}</span>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {recordRows.length > 100 && (
                    <p className="text-sm text-muted-foreground text-center">
                      Mostrando 100 de {recordRows.length} linhas
                    </p>
                  )}
                </div>
              )}

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium text-sm mb-2">Como funciona a vinculação:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Primeiro tentamos vincular pelo <strong>CPF do paciente</strong></li>
                  <li>• Se não encontrar, tentamos pelo <strong>nome exato</strong></li>
                  <li>• Pacientes não encontrados serão ignorados na importação</li>
                  <li>• Importe os pacientes primeiro se eles não existirem</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
