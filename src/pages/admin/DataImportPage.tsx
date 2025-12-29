import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  Layers,
  Sparkles,
  Info,
  Check,
  ArrowDownToLine,
  StopCircle,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import DataExportPanel from "@/components/admin/DataExportPanel";
import {
  PatientImportRow,
  MedicalRecordImportRow,
  ImportRow,
  DetectedSheet,
  parseSpreadsheet,
  parseMultiSheetSpreadsheet,
  parseWithForcedType,
  validatePatientRow,
  validateMedicalRecordRow,
  mapPatientRow,
  mapMedicalRecordRow,
  downloadTemplate,
  formatPhone,
  formatCPF,
  parseDate,
  getDetectedColumnsInfo,
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
  const [activeTab, setActiveTab] = useState<"export" | "combined" | "patients" | "records">("export");
  
  // Auto-detection state
  const [detectedSheets, setDetectedSheets] = useState<DetectedSheet[]>([]);
  const [importWithRecords, setImportWithRecords] = useState(true);
  const [lastFileBuffer, setLastFileBuffer] = useState<ArrayBuffer | null>(null);
  
  // Patient import state
  const [patientRows, setPatientRows] = useState<ImportRow<PatientImportRow>[]>([]);
  const [importingPatients, setImportingPatients] = useState(false);
  const [patientProgress, setPatientProgress] = useState(0);
  
  // Medical records import state
  const [recordRows, setRecordRows] = useState<ImportRow<MedicalRecordImportRow>[]>([]);
  const [importingRecords, setImportingRecords] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  
  // Combined import state
  const [importingCombined, setImportingCombined] = useState(false);
  const [combinedProgress, setCombinedProgress] = useState(0);
  
  // Cancellation ref - used to signal import loops to stop
  const cancelImportRef = useRef(false);
  const [importCancelled, setImportCancelled] = useState(false);

  // Function to cancel ongoing import
  const cancelImport = useCallback(() => {
    cancelImportRef.current = true;
    setImportCancelled(true);
    toast.warning('Cancelando importação... Aguarde o término da operação atual.');
  }, []);

  // Reset cancellation state when starting new import
  const resetCancellation = useCallback(() => {
    cancelImportRef.current = false;
    setImportCancelled(false);
  }, []);

  // Fetch clinics on mount
  useEffect(() => {
    fetchClinics();
  }, []);

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

  // Handle combined file upload with auto-detection
  const handleCombinedFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      const buffer = await file.arrayBuffer();
      // Store buffer for potential forced re-parsing
      setLastFileBuffer(buffer);
      const result = parseMultiSheetSpreadsheet(buffer);
      
      setDetectedSheets(result.sheets);
      setPatientRows(result.patients);
      setRecordRows(result.records);
      
      const sheetsInfo = result.sheets.map(s => `${s.name} (${s.type === 'patients' ? 'Pacientes' : s.type === 'records' ? 'Prontuários' : 'Desconhecido'})`);
      
      // Check for unrecognized sheets
      const unknownSheets = result.sheets.filter(s => s.type === 'unknown');
      
      if (result.patients.length > 0 || result.records.length > 0) {
        toast.success(
          `Detectado: ${result.patients.length} pacientes e ${result.records.length} prontuários`,
          { description: `Abas encontradas: ${sheetsInfo.join(', ')}` }
        );
        
        if (unknownSheets.length > 0) {
          unknownSheets.forEach(sheet => {
            toast.warning(`Aba "${sheet.name}" não reconhecida (${sheet.rowCount} linhas)`, {
              description: `Colunas: ${getDetectedColumnsInfo(sheet.columns)}`,
              duration: 10000,
            });
          });
        }
      } else {
        // All sheets unknown - show detailed info
        result.sheets.forEach(sheet => {
          toast.error(`Aba "${sheet.name}" não reconhecida (${sheet.rowCount} linhas)`, {
            description: `Colunas encontradas: ${getDetectedColumnsInfo(sheet.columns)}. Use a importação separada para forçar o tipo.`,
            duration: 15000,
          });
        });
      }
    } catch (error) {
      console.error('Error parsing file:', error);
      toast.error('Erro ao ler arquivo. Verifique o formato.');
    }
    
    event.target.value = '';
  }, []);

  // Force re-parse unknown sheets as a specific type
  const forceConvertAs = useCallback((forceType: 'patients' | 'records') => {
    if (!lastFileBuffer) {
      toast.error('Nenhum arquivo carregado');
      return;
    }
    
    try {
      const result = parseWithForcedType(lastFileBuffer, forceType);
      
      setDetectedSheets(result.sheets);
      setPatientRows(result.patients);
      setRecordRows(result.records);
      
      const typeLabel = forceType === 'patients' ? 'Pacientes' : 'Prontuários';
      toast.success(
        `Convertido como ${typeLabel}: ${result.patients.length} pacientes e ${result.records.length} prontuários`,
        { description: 'Abas não reconhecidas foram convertidas automaticamente' }
      );
    } catch (error) {
      console.error('Error forcing type:', error);
      toast.error('Erro ao converter arquivo');
    }
  }, [lastFileBuffer]);

  const handlePatientFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      const buffer = await file.arrayBuffer();
      const rows = parseSpreadsheet<PatientImportRow>(buffer, validatePatientRow, mapPatientRow);
      setPatientRows(rows);
      setDetectedSheets([]);
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
      setDetectedSheets([]);
      toast.success(`${rows.length} linhas carregadas`);
    } catch (error) {
      console.error('Error parsing file:', error);
      toast.error('Erro ao ler arquivo. Verifique o formato.');
    }
    
    event.target.value = '';
  }, []);

  // Combined import - patients first, then records
  const importCombined = async () => {
    if (!selectedClinicId) {
      toast.error('Selecione uma clínica');
      return;
    }
    
    const validPatients = patientRows.filter(r => r.validation.isValid);
    const validRecords = recordRows.filter(r => r.validation.isValid);
    
    if (validPatients.length === 0 && validRecords.length === 0) {
      toast.error('Nenhum registro válido para importar');
      return;
    }
    
    resetCancellation();
    setImportingCombined(true);
    setCombinedProgress(0);
    
    const totalItems = validPatients.length + (importWithRecords ? validRecords.length : 0);
    let processedItems = 0;
    let importedPatients = 0;
    let importedRecords = 0;
    let errors = 0;
    
    // Map to track imported patients by CPF and name for record linking
    const importedPatientsMap = new Map<string, string>();
    const importedPatientsNameMap = new Map<string, string>();
    
    // Step 1: Import patients
    for (const row of validPatients) {
      // Check for cancellation
      if (cancelImportRef.current) {
        toast.info(`Importação cancelada. ${importedPatients} pacientes importados antes do cancelamento.`);
        break;
      }
      
      try {
        const patientData = {
          clinic_id: selectedClinicId,
          name: row.data.nome.trim(),
          // Telefone pode estar ausente na planilha; o banco exige string,
          // então gravamos "" para permitir importar e completar depois.
          phone: row.data.telefone ? formatPhone(row.data.telefone) : "",
          email: row.data.email?.trim() || null,
          cpf: row.data.cpf ? formatCPF(row.data.cpf) : null,
          birth_date: row.data.data_nascimento ? parseDate(row.data.data_nascimento) : null,
          address: row.data.endereco?.trim() || null,
          notes: row.data.observacoes?.trim() || null,
        };
        
        const { data, error } = await supabase.from('patients').insert(patientData).select('id').single();
        
        if (error) {
          if (error.message.includes('CPF_DUPLICADO')) {
            // Get existing patient ID for record linking
            const { data: existingPatient } = await supabase
              .from('patients')
              .select('id')
              .eq('clinic_id', selectedClinicId)
              .eq('cpf', patientData.cpf)
              .single();
            
            if (existingPatient) {
              if (patientData.cpf) {
                importedPatientsMap.set(patientData.cpf.replace(/\D/g, ''), existingPatient.id);
              }
              importedPatientsNameMap.set(row.data.nome.toLowerCase().trim(), existingPatient.id);
            }
          }
          errors++;
        } else if (data) {
          importedPatients++;
          if (patientData.cpf) {
            importedPatientsMap.set(patientData.cpf.replace(/\D/g, ''), data.id);
          }
          importedPatientsNameMap.set(row.data.nome.toLowerCase().trim(), data.id);
        }
      } catch (err) {
        errors++;
      }
      
      processedItems++;
      setCombinedProgress((processedItems / totalItems) * 100);
    }
    
    // Check for cancellation before starting records import
    if (cancelImportRef.current) {
      setImportingCombined(false);
      setPatientRows([]);
      setRecordRows([]);
      setDetectedSheets([]);
      return;
    }
    
    // Step 2: Import records if enabled
    if (importWithRecords && validRecords.length > 0) {
      // Fetch ALL existing patients for this clinic with complete data
      const { data: existingPatients } = await supabase
        .from('patients')
        .select('id, name, cpf')
        .eq('clinic_id', selectedClinicId);
      
      // Build maps for patient lookup - CPF is the PRIMARY identifier
      const cpfToPatientId = new Map<string, string>();
      const nameToPatientIds = new Map<string, string[]>(); // Name can have multiple patients
      
      existingPatients?.forEach(p => {
        // CPF map - only if CPF exists (unique identifier)
        if (p.cpf) {
          const cleanCPF = p.cpf.replace(/\D/g, '');
          cpfToPatientId.set(cleanCPF, p.id);
        }
        // Name map - track ALL patients with same name (for duplicate detection)
        const normalizedName = p.name.toLowerCase().trim();
        const existingIds = nameToPatientIds.get(normalizedName) || [];
        existingIds.push(p.id);
        nameToPatientIds.set(normalizedName, existingIds);
      });
      
      // Also add patients imported in step 1 to the maps
      for (const [cpf, id] of importedPatientsMap.entries()) {
        cpfToPatientId.set(cpf, id);
      }
      for (const [name, id] of importedPatientsNameMap.entries()) {
        const existingIds = nameToPatientIds.get(name) || [];
        if (!existingIds.includes(id)) {
          existingIds.push(id);
          nameToPatientIds.set(name, existingIds);
        }
      }
      
      let autoCreatedPatients = 0;
      let skippedAmbiguous = 0;
      
      for (const row of validRecords) {
        // Check for cancellation
        if (cancelImportRef.current) {
          toast.info(`Importação cancelada. ${importedRecords} prontuários importados antes do cancelamento.`);
          break;
        }
        
        let patientId: string | undefined;
        let matchMethod: 'cpf' | 'name_unique' | 'created' | 'none' = 'none';
        
        const cleanCPF = row.data.cpf_paciente?.replace(/\D/g, '') || '';
        const normalizedName = row.data.nome_paciente?.toLowerCase().trim() || '';
        
        // PRIORITY 1: Match by CPF (most reliable - unique identifier)
        if (cleanCPF && cleanCPF.length >= 11) {
          patientId = cpfToPatientId.get(cleanCPF);
          if (patientId) {
            matchMethod = 'cpf';
          }
        }
        
        // PRIORITY 2: Match by name ONLY if name is unique in the clinic
        if (!patientId && normalizedName) {
          const matchingPatients = nameToPatientIds.get(normalizedName) || [];
          
          if (matchingPatients.length === 1) {
            // Only ONE patient with this name - safe to match
            patientId = matchingPatients[0];
            matchMethod = 'name_unique';
          } else if (matchingPatients.length > 1) {
            // MULTIPLE patients with same name - CANNOT match without CPF
            // Skip this record to avoid wrong association
            console.warn(`[IMPORT SAFETY] Prontuário ignorado: múltiplos pacientes com nome "${row.data.nome_paciente}". Forneça CPF para vincular corretamente.`);
            skippedAmbiguous++;
            errors++;
            processedItems++;
            setCombinedProgress((processedItems / totalItems) * 100);
            continue;
          }
        }
        
        // PRIORITY 3: Auto-create patient if not found
        // Only create if we have BOTH name AND CPF (to ensure uniqueness)
        // OR if name doesn't exist at all in the clinic
        if (!patientId && normalizedName) {
          const existingWithSameName = nameToPatientIds.get(normalizedName) || [];
          
          // Safe to create: either has CPF (unique) or name doesn't exist
          const canCreate = cleanCPF.length >= 11 || existingWithSameName.length === 0;
          
          if (canCreate) {
            try {
              const formattedCpf = cleanCPF.length >= 11 ? formatCPF(row.data.cpf_paciente!) : undefined;
              const newPatientData: { clinic_id: string; name: string; phone: string; cpf?: string } = {
                clinic_id: selectedClinicId,
                name: row.data.nome_paciente!.trim(),
                phone: '',
              };
              if (formattedCpf) {
                newPatientData.cpf = formattedCpf;
              }
              
              const { data: newPatient, error: createError } = await supabase
                .from('patients')
                .insert([newPatientData])
                .select('id')
                .single();
              
              if (!createError && newPatient) {
                patientId = newPatient.id;
                autoCreatedPatients++;
                matchMethod = 'created';
                
                // Update maps for subsequent records
                if (formattedCpf) {
                  cpfToPatientId.set(cleanCPF, newPatient.id);
                }
                const existingNames = nameToPatientIds.get(normalizedName) || [];
                existingNames.push(newPatient.id);
                nameToPatientIds.set(normalizedName, existingNames);
                
              } else if (createError?.message.includes('CPF_DUPLICADO')) {
                // CPF already exists - fetch the existing patient
                const { data: existingPatient } = await supabase
                  .from('patients')
                  .select('id')
                  .eq('clinic_id', selectedClinicId)
                  .eq('cpf', newPatientData.cpf)
                  .single();
                
                if (existingPatient) {
                  patientId = existingPatient.id;
                  matchMethod = 'cpf';
                  // Update map
                  cpfToPatientId.set(cleanCPF, existingPatient.id);
                }
              }
            } catch (err) {
              console.error('[IMPORT ERROR] Erro ao criar paciente:', err);
            }
          } else {
            // Cannot create: name exists but no CPF to differentiate
            console.warn(`[IMPORT SAFETY] Prontuário ignorado: paciente "${row.data.nome_paciente}" já existe. Forneça CPF para criar novo ou vincular.`);
            skippedAmbiguous++;
            errors++;
            processedItems++;
            setCombinedProgress((processedItems / totalItems) * 100);
            continue;
          }
        }
        
        if (!patientId) {
          errors++;
          processedItems++;
          setCombinedProgress((processedItems / totalItems) * 100);
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
            importedRecords++;
          }
        } catch (err) {
          errors++;
        }
        
        processedItems++;
        setCombinedProgress((processedItems / totalItems) * 100);
      }
      
      if (autoCreatedPatients > 0) {
        toast.info(`${autoCreatedPatients} pacientes criados automaticamente durante importação`);
      }
      
      if (skippedAmbiguous > 0) {
        toast.warning(`${skippedAmbiguous} prontuários ignorados por ambiguidade de paciente. Inclua CPF na planilha para vincular corretamente.`);
      }
    }
    
    setImportingCombined(false);
    setPatientRows([]);
    setRecordRows([]);
    setDetectedSheets([]);
    
    const resultMessage = importWithRecords 
      ? `${importedPatients} pacientes e ${importedRecords} prontuários importados`
      : `${importedPatients} pacientes importados`;
    
    if (errors > 0) {
      toast.warning(`Importação concluída: ${resultMessage}. ${errors} erros.`);
    } else {
      toast.success(`${resultMessage} com sucesso!`);
    }
  };

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
    
    resetCancellation();
    setImportingPatients(true);
    setPatientProgress(0);
    
    let imported = 0;
    let errors = 0;
    
    for (const row of validRows) {
      // Check for cancellation
      if (cancelImportRef.current) {
        toast.info(`Importação cancelada. ${imported} pacientes importados antes do cancelamento.`);
        break;
      }
      
      try {
        const { error } = await supabase.from('patients').insert({
          clinic_id: selectedClinicId,
          name: row.data.nome.trim(),
          // Telefone pode estar ausente na planilha; o banco exige string,
          // então gravamos "" para permitir importar e completar depois.
          phone: row.data.telefone ? formatPhone(row.data.telefone) : "",
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
    
    resetCancellation();
    setImportingRecords(true);
    setRecordProgress(0);
    
    // Fetch patients from clinic for matching
    const { data: patients } = await supabase
      .from('patients')
      .select('id, name, cpf')
      .eq('clinic_id', selectedClinicId);
    
    // Build maps for patient lookup - CPF is the PRIMARY identifier
    const cpfToPatientId = new Map<string, string>();
    const nameToPatientIds = new Map<string, string[]>();
    
    patients?.forEach(p => {
      if (p.cpf) {
        const cleanCPF = p.cpf.replace(/\D/g, '');
        cpfToPatientId.set(cleanCPF, p.id);
      }
      const normalizedName = p.name.toLowerCase().trim();
      const existingIds = nameToPatientIds.get(normalizedName) || [];
      existingIds.push(p.id);
      nameToPatientIds.set(normalizedName, existingIds);
    });
    
    let imported = 0;
    let errors = 0;
    let autoCreatedPatients = 0;
    let skippedAmbiguous = 0;
    
    for (const row of validRows) {
      // Check for cancellation
      if (cancelImportRef.current) {
        toast.info(`Importação cancelada. ${imported} prontuários importados antes do cancelamento.`);
        break;
      }
      
      let patientId: string | undefined;
      
      const cleanCPF = row.data.cpf_paciente?.replace(/\D/g, '') || '';
      const normalizedName = row.data.nome_paciente?.toLowerCase().trim() || '';
      
      // PRIORITY 1: Match by CPF (most reliable)
      if (cleanCPF && cleanCPF.length >= 11) {
        patientId = cpfToPatientId.get(cleanCPF);
      }
      
      // PRIORITY 2: Match by name ONLY if unique
      if (!patientId && normalizedName) {
        const matchingPatients = nameToPatientIds.get(normalizedName) || [];
        
        if (matchingPatients.length === 1) {
          patientId = matchingPatients[0];
        } else if (matchingPatients.length > 1) {
          console.warn(`[IMPORT SAFETY] Prontuário ignorado: múltiplos pacientes com nome "${row.data.nome_paciente}"`);
          skippedAmbiguous++;
          errors++;
          setRecordProgress(((imported + errors) / validRows.length) * 100);
          continue;
        }
      }
      
      // PRIORITY 3: Auto-create patient with safety checks
      if (!patientId && normalizedName) {
        const existingWithSameName = nameToPatientIds.get(normalizedName) || [];
        const canCreate = cleanCPF.length >= 11 || existingWithSameName.length === 0;
        
        if (canCreate) {
          try {
            const formattedCpf = cleanCPF.length >= 11 ? formatCPF(row.data.cpf_paciente!) : undefined;
            const newPatientData: { clinic_id: string; name: string; phone: string; cpf?: string } = {
              clinic_id: selectedClinicId,
              name: row.data.nome_paciente!.trim(),
              phone: '',
            };
            if (formattedCpf) {
              newPatientData.cpf = formattedCpf;
            }
            
            const { data: newPatient, error: createError } = await supabase
              .from('patients')
              .insert([newPatientData])
              .select('id')
              .single();
            
            if (!createError && newPatient) {
              patientId = newPatient.id;
              autoCreatedPatients++;
              
              if (formattedCpf) {
                cpfToPatientId.set(cleanCPF, newPatient.id);
              }
              const existingNames = nameToPatientIds.get(normalizedName) || [];
              existingNames.push(newPatient.id);
              nameToPatientIds.set(normalizedName, existingNames);
              
            } else if (createError?.message.includes('CPF_DUPLICADO')) {
              const { data: existingPatient } = await supabase
                .from('patients')
                .select('id')
                .eq('clinic_id', selectedClinicId)
                .eq('cpf', newPatientData.cpf)
                .single();
              
              if (existingPatient) {
                patientId = existingPatient.id;
                cpfToPatientId.set(cleanCPF, existingPatient.id);
              }
            }
          } catch (err) {
            console.error('[IMPORT ERROR] Erro ao criar paciente:', err);
          }
        } else {
          console.warn(`[IMPORT SAFETY] Prontuário ignorado: paciente "${row.data.nome_paciente}" já existe sem CPF`);
          skippedAmbiguous++;
          errors++;
          setRecordProgress(((imported + errors) / validRows.length) * 100);
          continue;
        }
      }
      
      if (!patientId) {
        errors++;
        setRecordProgress(((imported + errors) / validRows.length) * 100);
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
    
    if (autoCreatedPatients > 0) {
      toast.info(`${autoCreatedPatients} pacientes criados automaticamente`);
    }
    
    if (skippedAmbiguous > 0) {
      toast.warning(`${skippedAmbiguous} prontuários ignorados por ambiguidade. Inclua CPF para vincular corretamente.`);
    }
    
    if (errors > 0) {
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

      {/* Format Guide */}
      <Collapsible defaultOpen={false}>
        <Card className="border-primary/20 bg-primary/5">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-primary/10 transition-colors py-3">
              <CardTitle className="text-sm flex items-center gap-2 font-medium">
                <Info className="h-4 w-4 text-primary" />
                Guia de Formatos de Arquivo para Importação
                <Badge variant="outline" className="ml-auto text-xs">
                  Clique para expandir
                </Badge>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-4">
              <div className="grid md:grid-cols-2 gap-4">
                {/* XLSX Recommended */}
                <div className="bg-success/10 border border-success/30 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-success" />
                    <span className="font-semibold">XLSX (Excel)</span>
                    <Badge className="bg-success text-success-foreground text-xs">Recomendado</Badge>
                  </div>
                  <ul className="text-sm space-y-1.5 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                      <span>Suporte a múltiplas abas (Pacientes + Prontuários em um único arquivo)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                      <span>Preserva formatação de datas corretamente</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                      <span>Caracteres especiais e acentos preservados</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                      <span>CPF com zeros à esquerda não são perdidos</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                      <span>Detecção automática do tipo de dados</span>
                    </li>
                  </ul>
                </div>

                {/* CSV Limitations */}
                <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-warning" />
                    <span className="font-semibold">CSV</span>
                    <Badge variant="outline" className="text-xs border-warning/50 text-warning">Limitações</Badge>
                  </div>
                  <ul className="text-sm space-y-1.5 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                      <span>Apenas uma tabela por arquivo (não suporta múltiplas abas)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                      <span>Problemas com acentos dependendo da codificação (UTF-8 vs ANSI)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                      <span>Datas podem ser mal interpretadas pelo Excel</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                      <span>CPF pode perder zeros à esquerda (ex: 012.345.678-90 → 12345678-90)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                      <span>Delimitador pode variar (vírgula vs ponto-e-vírgula)</span>
                    </li>
                  </ul>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" />
                Para a <strong>Importação Inteligente</strong>, utilize sempre arquivos <strong>.xlsx</strong> com abas separadas para Pacientes e Prontuários.
              </p>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Import/Export Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "export" | "combined" | "patients" | "records")}>
        <TabsList>
          <TabsTrigger value="export" className="gap-2">
            <ArrowDownToLine className="h-4 w-4" />
            Exportar Dados
          </TabsTrigger>
          <TabsTrigger value="combined" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Importação Inteligente
          </TabsTrigger>
          <TabsTrigger value="patients" className="gap-2">
            <Users className="h-4 w-4" />
            Só Pacientes
          </TabsTrigger>
          <TabsTrigger value="records" className="gap-2">
            <FileText className="h-4 w-4" />
            Só Prontuários
          </TabsTrigger>
        </TabsList>

        {/* Export Tab */}
        <TabsContent value="export" className="space-y-4">
          {selectedClinicId && selectedClinic ? (
            <DataExportPanel clinicId={selectedClinicId} clinicName={selectedClinic.name} />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Selecione uma clínica para exportar os dados
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Combined Import Tab */}
        <TabsContent value="combined" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Importação com Detecção Automática
              </CardTitle>
              <CardDescription>
                Faça upload de uma planilha com múltiplas abas - o sistema detecta automaticamente pacientes e prontuários
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={() => downloadTemplate('combined')}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Baixar Modelo Completo
                </Button>
                
                <label>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleCombinedFile}
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

              {/* Detected Sheets Info */}
              {detectedSheets.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Abas Detectadas
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {detectedSheets.map((sheet) => (
                      <Badge
                        key={sheet.name}
                        variant={sheet.type === 'patients' ? 'default' : sheet.type === 'records' ? 'secondary' : 'outline'}
                        className={sheet.type === 'unknown' ? 'border-warning text-warning' : ''}
                      >
                        {sheet.name}: {sheet.rowCount} linhas
                        {sheet.type === 'patients' && ' (Pacientes)'}
                        {sheet.type === 'records' && ' (Prontuários)'}
                        {sheet.type === 'unknown' && ' ⚠️ Não reconhecido'}
                      </Badge>
                    ))}
                  </div>
                  
                  {/* Force Conversion Buttons */}
                  {(lastFileBuffer && detectedSheets.length > 0 && recordRows.length === 0) && (
                    <div className="pt-3 border-t border-border/50 space-y-2">
                      <p className="text-sm text-muted-foreground">
                        <AlertTriangle className="h-4 w-4 inline mr-1 text-warning" />
                        Não detectamos prontuários nesta importação. Se sua planilha tiver uma aba de prontuários, você pode forçar a conversão.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => forceConvertAs('patients')}
                          className="gap-2"
                        >
                          <Users className="h-4 w-4" />
                          Converter como Pacientes
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => forceConvertAs('records')}
                          className="gap-2"
                        >
                          <FileText className="h-4 w-4" />
                          Converter como Prontuários
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Summary and Import Options */}
              {(patientRows.length > 0 || recordRows.length > 0) && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4 flex-wrap">
                      {patientRows.length > 0 && (
                        <Badge variant="default" className="bg-success">
                          <Users className="h-3 w-3 mr-1" />
                          {validPatientCount} pacientes válidos
                        </Badge>
                      )}
                      {recordRows.length > 0 && (
                        <Badge variant="secondary">
                          <FileText className="h-3 w-3 mr-1" />
                          {validRecordCount} prontuários válidos
                        </Badge>
                      )}
                    </div>

                    {recordRows.length > 0 && patientRows.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Switch
                          id="import-records"
                          checked={importWithRecords}
                          onCheckedChange={setImportWithRecords}
                        />
                        <Label htmlFor="import-records" className="text-sm">
                          Importar prontuários junto
                        </Label>
                      </div>
                    )}
                  </div>

                  {importingCombined && (
                    <div className="space-y-2">
                      <Progress value={combinedProgress} />
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">
                          {Math.round(combinedProgress)}% concluído
                        </span>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={cancelImport}
                          disabled={importCancelled}
                          className="gap-1"
                        >
                          <StopCircle className="h-3 w-3" />
                          {importCancelled ? 'Cancelando...' : 'Parar Importação'}
                        </Button>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={importCombined}
                    disabled={importingCombined || (validPatientCount === 0 && validRecordCount === 0)}
                    className="gap-2"
                  >
                    {importingCombined ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    Importar Tudo
                  </Button>

                  {/* Preview Tables */}
                  {patientRows.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Preview Pacientes ({patientRows.length})
                      </h5>
                      <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">#</TableHead>
                              <TableHead>Nome</TableHead>
                              <TableHead>Telefone</TableHead>
                              <TableHead>CPF</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {patientRows.slice(0, 10).map((row) => (
                              <TableRow key={row.rowNumber} className={!row.validation.isValid ? 'bg-destructive/5' : ''}>
                                <TableCell className="text-muted-foreground text-xs">{row.rowNumber}</TableCell>
                                <TableCell className="font-medium text-sm">{row.data.nome}</TableCell>
                                <TableCell className="text-sm">{row.data.telefone}</TableCell>
                                <TableCell className="text-sm">{row.data.cpf || '-'}</TableCell>
                                <TableCell>
                                  {row.validation.isValid ? (
                                    <CheckCircle2 className="h-4 w-4 text-success" />
                                  ) : (
                                    <AlertCircle className="h-4 w-4 text-destructive" />
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {patientRows.length > 10 && (
                        <p className="text-xs text-muted-foreground">
                          +{patientRows.length - 10} linhas adicionais
                        </p>
                      )}
                    </div>
                  )}

                  {recordRows.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Preview Prontuários ({recordRows.length})
                      </h5>
                      <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">#</TableHead>
                              <TableHead>Paciente</TableHead>
                              <TableHead>Data</TableHead>
                              <TableHead>Queixa</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {recordRows.slice(0, 10).map((row) => (
                              <TableRow key={row.rowNumber} className={!row.validation.isValid ? 'bg-destructive/5' : ''}>
                                <TableCell className="text-muted-foreground text-xs">{row.rowNumber}</TableCell>
                                <TableCell className="font-medium text-sm">{row.data.nome_paciente || row.data.cpf_paciente || '-'}</TableCell>
                                <TableCell className="text-sm">{row.data.data_registro}</TableCell>
                                <TableCell className="text-sm max-w-[150px] truncate">{row.data.queixa || '-'}</TableCell>
                                <TableCell>
                                  {row.validation.isValid ? (
                                    <CheckCircle2 className="h-4 w-4 text-success" />
                                  ) : (
                                    <AlertCircle className="h-4 w-4 text-destructive" />
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {recordRows.length > 10 && (
                        <p className="text-xs text-muted-foreground">
                          +{recordRows.length - 10} linhas adicionais
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium text-sm mb-2">Como funciona:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>Detecção automática:</strong> O sistema identifica abas de pacientes e prontuários pelas colunas</li>
                  <li>• <strong>Importação sequencial:</strong> Pacientes são importados primeiro, depois os prontuários são vinculados</li>
                  <li>• <strong>Vinculação inteligente:</strong> Prontuários são ligados aos pacientes por CPF ou nome</li>
                  <li>• <strong>Colunas de pacientes:</strong> nome, telefone, cpf, email, data_nascimento, endereco</li>
                  <li>• <strong>Colunas de prontuários:</strong> cpf_paciente ou nome_paciente, data_registro, queixa, diagnostico, tratamento</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

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
                    <div className="space-y-2">
                      <Progress value={patientProgress} />
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">
                          {Math.round(patientProgress)}% concluído
                        </span>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={cancelImport}
                          disabled={importCancelled}
                          className="gap-1"
                        >
                          <StopCircle className="h-3 w-3" />
                          {importCancelled ? 'Cancelando...' : 'Parar Importação'}
                        </Button>
                      </div>
                    </div>
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
                    <div className="space-y-2">
                      <Progress value={recordProgress} />
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">
                          {Math.round(recordProgress)}% concluído
                        </span>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={cancelImport}
                          disabled={importCancelled}
                          className="gap-1"
                        >
                          <StopCircle className="h-3 w-3" />
                          {importCancelled ? 'Cancelando...' : 'Parar Importação'}
                        </Button>
                      </div>
                    </div>
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
