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
  Phone,
  History,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import DataExportPanel from "@/components/admin/DataExportPanel";
import { ImportProgressCard } from "@/components/admin/ImportProgressCard";
import { ImportHistoryPanel } from "@/components/admin/ImportHistoryPanel";
import {
  PatientImportRow,
  MedicalRecordImportRow,
  ContactImportRow,
  ImportRow,
  DetectedSheet,
  parseSpreadsheet,
  parseMultiSheetSpreadsheet,
  parseWithForcedType,
  validatePatientRow,
  validateMedicalRecordRow,
  validateContactRow,
  mapPatientRow,
  mapMedicalRecordRow,
  mapContactRow,
  downloadTemplate,
  formatPhone,
  formatCPF,
  parseDate,
  getDetectedColumnsInfo,
  normalizeNameForComparison,
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
  const [activeTab, setActiveTab] = useState<"export" | "combined" | "patients" | "records" | "contacts" | "history">("export");
  
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
  
  // Contact import state
  const [contactRows, setContactRows] = useState<ImportRow<ContactImportRow>[]>([]);
  const [importingContacts, setImportingContacts] = useState(false);
  const [contactProgress, setContactProgress] = useState(0);
  
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

  // Helper to create import log entry
  const createImportLog = async (
    type: string,
    fileName?: string
  ): Promise<string | null> => {
    if (!selectedClinicId) return null;
    
    try {
      const { data, error } = await supabase
        .from('import_logs')
        .insert({
          clinic_id: selectedClinicId,
          import_type: type,
          file_name: fileName || null,
          status: 'in_progress',
        })
        .select('id')
        .single();
      
      if (error) {
        console.error('Error creating import log:', error);
        return null;
      }
      return data?.id || null;
    } catch (err) {
      console.error('Exception creating import log:', err);
      return null;
    }
  };

  // Helper to update import log
  const updateImportLog = async (
    logId: string | null,
    updates: {
      total_rows?: number;
      success_count?: number;
      error_count?: number;
      status?: string;
      error_details?: any;
    }
  ) => {
    if (!logId) return;
    
    try {
      const updateData: Record<string, any> = { ...updates };
      if (updates.status === 'completed' || updates.status === 'failed' || updates.status === 'cancelled') {
        updateData.completed_at = new Date().toISOString();
      }
      
      await supabase
        .from('import_logs')
        .update(updateData)
        .eq('id', logId);
    } catch (err) {
      console.error('Error updating import log:', err);
    }
  };

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

  const handleContactsFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      const buffer = await file.arrayBuffer();
      const rows = parseSpreadsheet<ContactImportRow>(buffer, validateContactRow, mapContactRow);
      setContactRows(rows);
      toast.success(`${rows.length} linhas carregadas`);
    } catch (error) {
      console.error('Error parsing file:', error);
      toast.error('Erro ao ler arquivo. Verifique o formato.');
    }
    
    event.target.value = '';
  }, []);
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
    
    // Create import log
    const logId = await createImportLog('combined');
    
    const totalItems = validPatients.length + (importWithRecords ? validRecords.length : 0);
    let processedItems = 0;
    let importedPatients = 0;
    let importedRecords = 0;
    let errors = 0;
    const BATCH_SIZE = 500; // Increased from 50 for better performance
    
    // Map to track imported patients by CPF and name for record linking
    const importedPatientsMap = new Map<string, string>();
    const importedPatientsNameMap = new Map<string, string>();
    
    // Fetch existing patients BEFORE importing to avoid duplicates
    const { data: existingPatientsForDedup } = await supabase
      .from('patients')
      .select('id, name, cpf')
      .eq('clinic_id', selectedClinicId);
    
    // Build deduplication maps
    const existingCpfToId = new Map<string, string>();
    const existingNameToId = new Map<string, string>();
    
    existingPatientsForDedup?.forEach(p => {
      if (p.cpf) {
        existingCpfToId.set(p.cpf.replace(/\D/g, ''), p.id);
      }
      existingNameToId.set(normalizeNameForComparison(p.name), p.id);
    });
    
    console.log('[DEDUP] Existing patients:', existingPatientsForDedup?.length || 0);
    console.log('[DEDUP] CPF map size:', existingCpfToId.size);
    console.log('[DEDUP] Name map size:', existingNameToId.size);
    
    // Step 1: Import patients in batches (only NEW patients)
    const allPatientData: Array<{
      rowData: PatientImportRow;
      patientData: any;
      existingPatientId?: string;
    }> = [];
    
    let skippedDuplicates = 0;
    
    for (const row of validPatients) {
      const cpfClean = row.data.cpf ? row.data.cpf.replace(/\D/g, '') : null;
      const normalizedName = normalizeNameForComparison(row.data.nome);
      
      // Check if patient already exists by CPF (primary) or name (secondary)
      let existingId: string | undefined;
      
      if (cpfClean && existingCpfToId.has(cpfClean)) {
        existingId = existingCpfToId.get(cpfClean);
        console.log('[DEDUP] Found by CPF:', row.data.nome, cpfClean);
      } else if (existingNameToId.has(normalizedName)) {
        existingId = existingNameToId.get(normalizedName);
        console.log('[DEDUP] Found by name:', row.data.nome, normalizedName);
      }
      
      if (existingId) {
        // Patient exists - add to map for record linking, skip insertion
        skippedDuplicates++;
        if (cpfClean) {
          importedPatientsMap.set(cpfClean, existingId);
        }
        importedPatientsNameMap.set(row.data.nome.toLowerCase().trim(), existingId);
        processedItems++;
        setCombinedProgress((processedItems / totalItems) * 100);
      } else {
        // New patient - prepare for insertion
        allPatientData.push({
          rowData: row.data,
          patientData: {
            clinic_id: selectedClinicId,
            name: row.data.nome.trim(),
            phone: row.data.telefone ? formatPhone(row.data.telefone) : "",
            landline: row.data.telefone_fixo ? formatPhone(row.data.telefone_fixo) : null,
            email: row.data.email?.trim() || null,
            cpf: row.data.cpf ? formatCPF(row.data.cpf) : null,
            rg: row.data.rg?.trim() || null,
            birth_date: row.data.data_nascimento ? parseDate(row.data.data_nascimento) : null,
            gender: row.data.sexo?.trim() || null,
            marital_status: row.data.estado_civil?.trim() || null,
            birthplace: row.data.naturalidade?.trim() || null,
            profession: row.data.profissao?.trim() || null,
            education: row.data.escolaridade?.trim() || null,
            mother_name: row.data.nome_mae?.trim() || null,
            father_name: row.data.nome_pai?.trim() || null,
            cep: row.data.cep?.replace(/\D/g, '') || null,
            street: row.data.rua?.trim() || null,
            street_number: row.data.numero?.trim() || null,
            complement: row.data.complemento?.trim() || null,
            neighborhood: row.data.bairro?.trim() || null,
            city: row.data.cidade?.trim() || null,
            state: row.data.estado?.trim() || null,
            address: row.data.endereco?.trim() || null,
            referral: row.data.indicacao?.trim() || null,
            notes: row.data.observacoes?.trim() || null,
          }
        });
        
        // Also add to name map to prevent duplicates within the same import batch
        existingNameToId.set(normalizedName, 'pending');
        if (cpfClean) {
          existingCpfToId.set(cpfClean, 'pending');
        }
      }
    }
    
    console.log('[DEDUP] Skipped duplicates:', skippedDuplicates);
    console.log('[DEDUP] New patients to import:', allPatientData.length);
    
    for (let i = 0; i < allPatientData.length; i += BATCH_SIZE) {
      if (cancelImportRef.current) {
        toast.info(`Importação cancelada. ${importedPatients} pacientes importados antes do cancelamento.`);
        break;
      }
      
      const batch = allPatientData.slice(i, i + BATCH_SIZE);
      const batchData = batch.map(b => b.patientData);
      
      try {
        const { data, error } = await supabase.from('patients').insert(batchData).select('id, cpf, name');
        
        if (error) {
          console.error('[BATCH ERROR]', error.message);
          errors += batch.length;
        } else if (data) {
          importedPatients += data.length;
          // Update maps for record linking
          data.forEach((p: { id: string; cpf: string | null; name: string }) => {
            if (p.cpf) {
              importedPatientsMap.set(p.cpf.replace(/\D/g, ''), p.id);
            }
            importedPatientsNameMap.set(p.name.toLowerCase().trim(), p.id);
          });
        }
      } catch (err) {
        console.error('[BATCH EXCEPTION]', err);
        errors += batch.length;
      }
      
      processedItems += batch.length;
      setCombinedProgress((processedItems / totalItems) * 100);
    }
    
    // Show dedup info
    if (skippedDuplicates > 0) {
      toast.info(`${skippedDuplicates} pacientes já existentes foram ignorados (sem duplicação).`);
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
      const normalizedNameToPatientIds = new Map<string, string[]>();
      // Build list for fuzzy matching
      const allPatients: Array<{ id: string; name: string; normalizedName: string }> = [];
      
      existingPatients?.forEach(p => {
        // CPF map - only if CPF exists (unique identifier)
        if (p.cpf) {
          const cleanCPF = p.cpf.replace(/\D/g, '');
          cpfToPatientId.set(cleanCPF, p.id);
        }
        // Name map - track ALL patients with same name (for duplicate detection)
        const normalizedName = normalizeNameForComparison(p.name);
        allPatients.push({ id: p.id, name: p.name, normalizedName });
        const existingIds = normalizedNameToPatientIds.get(normalizedName) || [];
        existingIds.push(p.id);
        normalizedNameToPatientIds.set(normalizedName, existingIds);
      });
      
      // Also add patients imported in step 1 to the maps
      for (const [cpf, id] of importedPatientsMap.entries()) {
        cpfToPatientId.set(cpf, id);
      }
      for (const [name, id] of importedPatientsNameMap.entries()) {
        const normalizedName = normalizeNameForComparison(name);
        const existingIds = normalizedNameToPatientIds.get(normalizedName) || [];
        if (!existingIds.includes(id)) {
          existingIds.push(id);
          normalizedNameToPatientIds.set(normalizedName, existingIds);
          allPatients.push({ id, name, normalizedName });
        }
      }
      
      // Helper function to find patient by name with fuzzy matching
      const findPatientByNameCombined = (searchName: string): string | undefined => {
        const normalizedSearch = normalizeNameForComparison(searchName);
        if (!normalizedSearch) return undefined;
        
        // PRIORITY 1: Exact normalized match
        const exactMatches = normalizedNameToPatientIds.get(normalizedSearch) || [];
        if (exactMatches.length === 1) return exactMatches[0];
        
        // PRIORITY 2: Check if search name contains patient name or vice versa
        for (const patient of allPatients) {
          if (patient.normalizedName.includes(normalizedSearch) || normalizedSearch.includes(patient.normalizedName)) {
            // Additional check: at least 70% of words match
            const searchWords = normalizedSearch.split(' ').filter(w => w.length > 2);
            const patientWords = patient.normalizedName.split(' ').filter(w => w.length > 2);
            const matchingWords = searchWords.filter(sw => patientWords.some(pw => pw.includes(sw) || sw.includes(pw)));
            
            if (matchingWords.length >= Math.min(searchWords.length, patientWords.length) * 0.7) {
              return patient.id;
            }
          }
        }
        
        return undefined;
      };
      
      // ============ PROFESSIONAL CREATION LOGIC ============
      // Extract unique professional names from records
      const uniqueProfessionalNames = new Set<string>();
      for (const row of validRecords) {
        const profName = row.data.nome_profissional?.trim();
        if (profName) {
          uniqueProfessionalNames.add(profName.toLowerCase());
        }
      }
      
      console.log('[IMPORT DEBUG] Unique professional names found:', Array.from(uniqueProfessionalNames));
      console.log('[IMPORT DEBUG] Sample record data:', validRecords[0]?.data);
      
      // Build map of professional name -> id
      const professionalNameToId = new Map<string, string>();
      
      if (uniqueProfessionalNames.size > 0) {
        // Fetch existing professionals for this clinic
        const { data: existingProfessionals } = await supabase
          .from('professionals')
          .select('id, name')
          .eq('clinic_id', selectedClinicId);
        
        existingProfessionals?.forEach(p => {
          professionalNameToId.set(p.name.toLowerCase().trim(), p.id);
        });
        
        // Find professionals that need to be created
        const professionalsToCreate: Array<{ clinic_id: string; name: string; is_active: boolean }> = [];
        for (const profNameLower of uniqueProfessionalNames) {
          if (!professionalNameToId.has(profNameLower)) {
            // Find original case name from records
            const originalName = validRecords.find(
              r => r.data.nome_profissional?.toLowerCase().trim() === profNameLower
            )?.data.nome_profissional?.trim();
            
            if (originalName) {
              professionalsToCreate.push({
                clinic_id: selectedClinicId,
                name: originalName,
                is_active: true,
              });
            }
          }
        }
        
        // Batch create professionals
        if (professionalsToCreate.length > 0) {
          try {
            const { data: createdProfessionals, error } = await supabase
              .from('professionals')
              .insert(professionalsToCreate)
              .select('id, name');
            
            if (!error && createdProfessionals) {
              createdProfessionals.forEach(p => {
                professionalNameToId.set(p.name.toLowerCase().trim(), p.id);
              });
              toast.info(`${createdProfessionals.length} profissionais criados automaticamente`);
            } else if (error) {
              console.error('[PROFESSIONAL CREATE ERROR]', error.message);
            }
          } catch (err) {
            console.error('[PROFESSIONAL CREATE EXCEPTION]', err);
          }
        }
      }
      // ============ END PROFESSIONAL CREATION LOGIC ============
      
      let autoCreatedPatients = 0;
      let skippedAmbiguous = 0;
      
      // First pass: identify records that need new patients
      const recordsToInsert: Array<{
        clinic_id: string;
        patient_id: string;
        professional_id?: string | null;
        record_date: string;
        chief_complaint: string | null;
        diagnosis: string | null;
        treatment_plan: string | null;
        prescription: string | null;
        notes: string | null;
      }> = [];
      
      // Collect patients to create in batch
      const patientsToCreate: Array<{
        rowIndex: number;
        cleanCPF: string;
        normalizedName: string;
        patientData: { clinic_id: string; name: string; phone: string; cpf?: string };
      }> = [];
      
      const recordsNeedingPatient: Array<{
        row: typeof validRecords[0];
        cleanCPF: string;
        normalizedName: string;
      }> = [];
      
      // First pass: categorize records
      for (let i = 0; i < validRecords.length; i++) {
        if (cancelImportRef.current) break;
        
        const row = validRecords[i];
        const cleanCPF = row.data.cpf_paciente?.replace(/\D/g, '') || '';
        const normalizedName = normalizeNameForComparison(row.data.nome_paciente || '');
        let patientId: string | undefined;
        
        // PRIORITY 1: Match by CPF
        if (cleanCPF && cleanCPF.length >= 11) {
          patientId = cpfToPatientId.get(cleanCPF);
        }
        
        // PRIORITY 2: Match by name using fuzzy matching
        if (!patientId && normalizedName) {
          patientId = findPatientByNameCombined(row.data.nome_paciente || '');
        }
        
        if (patientId) {
          const parsedRecordDate = parseDate(row.data.data_registro);
          if (!parsedRecordDate) {
            errors++;
            continue;
          }

          // Patient found, add record directly
          // Get professional_id if professional name is provided
          const profNameLower = row.data.nome_profissional?.toLowerCase().trim();
          const professionalId = profNameLower ? professionalNameToId.get(profNameLower) : undefined;
          
          recordsToInsert.push({
            clinic_id: selectedClinicId,
            patient_id: patientId,
            professional_id: professionalId || null,
            record_date: parsedRecordDate,
            chief_complaint: row.data.queixa?.trim() || null,
            diagnosis: row.data.diagnostico?.trim() || null,
            treatment_plan: row.data.tratamento?.trim() || null,
            prescription: row.data.prescricao?.trim() || null,
            notes: row.data.observacoes?.trim() || null,
          });
        } else if (normalizedName) {
          // Need to create patient
          // Importação “do zero”: se não conseguimos vincular por CPF/nome único,
          // criamos um paciente automaticamente (mesmo que já exista alguém com o mesmo nome).
          const canCreate = true;

          if (canCreate) {
            // Check if we already queued this patient for creation
            const alreadyQueued = patientsToCreate.find(p => 
              (cleanCPF.length >= 11 && p.cleanCPF === cleanCPF) || 
              (cleanCPF.length < 11 && p.normalizedName === normalizedName)
            );

            if (!alreadyQueued) {
              const formattedCpf = cleanCPF.length >= 11 ? formatCPF(row.data.cpf_paciente!) : undefined;
              const patientData: { clinic_id: string; name: string; phone: string; cpf?: string } = {
                clinic_id: selectedClinicId,
                name: row.data.nome_paciente!.trim(),
                phone: '',
              };
              if (formattedCpf) {
                patientData.cpf = formattedCpf;
              }
              patientsToCreate.push({
                rowIndex: i,
                cleanCPF,
                normalizedName,
                patientData,
              });
            }

            recordsNeedingPatient.push({ row, cleanCPF, normalizedName });
          }
        } else {
          errors++;
          processedItems++;
        }
      }
      
      // Batch create patients
      if (patientsToCreate.length > 0) {
        const PATIENT_CREATE_BATCH = 200;
        for (let i = 0; i < patientsToCreate.length; i += PATIENT_CREATE_BATCH) {
          if (cancelImportRef.current) break;
          
          const batch = patientsToCreate.slice(i, i + PATIENT_CREATE_BATCH);
          const batchData = batch.map(p => p.patientData);
          
          try {
            const { data: createdPatients, error } = await supabase
              .from('patients')
              .insert(batchData)
              .select('id, cpf, name');
            
            if (!error && createdPatients) {
              autoCreatedPatients += createdPatients.length;
              
              // Update maps with created patients
              createdPatients.forEach((p) => {
                if (p.cpf) {
                  cpfToPatientId.set(p.cpf.replace(/\D/g, ''), p.id);
                }
                const normName = normalizeNameForComparison(p.name);
                allPatients.push({ id: p.id, name: p.name, normalizedName: normName });
                const existingNames = normalizedNameToPatientIds.get(normName) || [];
                existingNames.push(p.id);
                normalizedNameToPatientIds.set(normName, existingNames);
              });
            } else if (error) {
              console.error('[PATIENT CREATE BATCH ERROR]', error.message);
            }
          } catch (err) {
            console.error('[PATIENT CREATE BATCH EXCEPTION]', err);
          }
        }
        
        // Now add records for the created patients
        for (const { row, cleanCPF, normalizedName } of recordsNeedingPatient) {
          let patientId: string | undefined;
          
          if (cleanCPF.length >= 11) {
            patientId = cpfToPatientId.get(cleanCPF);
          }
          if (!patientId) {
            patientId = findPatientByNameCombined(row.data.nome_paciente || '');
          }
          
          if (patientId) {
            const parsedRecordDate = parseDate(row.data.data_registro);
            if (!parsedRecordDate) {
              errors++;
              continue;
            }

            // Get professional_id if professional name is provided
            const profNameLower = row.data.nome_profissional?.toLowerCase().trim();
            const professionalId = profNameLower ? professionalNameToId.get(profNameLower) : undefined;
            
            recordsToInsert.push({
              clinic_id: selectedClinicId,
              patient_id: patientId,
              professional_id: professionalId || null,
              record_date: parsedRecordDate,
              chief_complaint: row.data.queixa?.trim() || null,
              diagnosis: row.data.diagnostico?.trim() || null,
              treatment_plan: row.data.tratamento?.trim() || null,
              prescription: row.data.prescricao?.trim() || null,
              notes: row.data.observacoes?.trim() || null,
            });
          } else {
            errors++;
          }
          processedItems++;
        }
      }
      
      // Batch insert medical records
      const RECORD_BATCH_SIZE = 500;
      for (let i = 0; i < recordsToInsert.length; i += RECORD_BATCH_SIZE) {
        if (cancelImportRef.current) {
          toast.info(`Importação cancelada. ${importedRecords} prontuários importados antes do cancelamento.`);
          break;
        }
        
        const batch = recordsToInsert.slice(i, i + RECORD_BATCH_SIZE);
        
        try {
          const { data, error } = await supabase.from('medical_records').insert(batch).select('id');
          
          if (error) {
            console.error('[RECORDS BATCH ERROR]', error.message);
            errors += batch.length;
          } else {
            importedRecords += data?.length || batch.length;
          }
        } catch (err) {
          console.error('[RECORDS BATCH EXCEPTION]', err);
          errors += batch.length;
        }
        
        processedItems += batch.length;
        setCombinedProgress((processedItems / totalItems) * 100);
      }
      
      if (autoCreatedPatients > 0) {
        toast.info(`${autoCreatedPatients} pacientes criados automaticamente durante importação`);
      }
      
      if (skippedAmbiguous > 0) {
        toast.warning(`${skippedAmbiguous} prontuários ignorados por ambiguidade de paciente. Inclua CPF na planilha para vincular corretamente.`);
      }
    }
    
    // Update import log
    const finalStatus = cancelImportRef.current ? 'cancelled' : (errors > 0 ? 'completed' : 'completed');
    await updateImportLog(logId, {
      total_rows: totalItems,
      success_count: importedPatients + importedRecords,
      error_count: errors,
      status: cancelImportRef.current ? 'cancelled' : 'completed',
    });
    
    setImportingCombined(false);
    setPatientRows([]);
    setRecordRows([]);
    setDetectedSheets([]);
    
    const resultMessage = importWithRecords 
      ? `${importedPatients} pacientes e ${importedRecords} prontuários importados`
      : `${importedPatients} pacientes importados`;
    
    if (cancelImportRef.current) {
      return;
    }
    
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
    
    // Create import log
    const logId = await createImportLog('patients');
    
    let imported = 0;
    let errors = 0;
    const BATCH_SIZE = 500; // Increased from 50 for better performance
    
    // Prepare all patient data
    const allPatientData = validRows.map(row => ({
      clinic_id: selectedClinicId,
      name: row.data.nome.trim(),
      phone: row.data.telefone ? formatPhone(row.data.telefone) : "",
      landline: row.data.telefone_fixo ? formatPhone(row.data.telefone_fixo) : null,
      email: row.data.email?.trim() || null,
      cpf: row.data.cpf ? formatCPF(row.data.cpf) : null,
      rg: row.data.rg?.trim() || null,
      birth_date: row.data.data_nascimento ? parseDate(row.data.data_nascimento) : null,
      gender: row.data.sexo?.trim() || null,
      marital_status: row.data.estado_civil?.trim() || null,
      birthplace: row.data.naturalidade?.trim() || null,
      profession: row.data.profissao?.trim() || null,
      education: row.data.escolaridade?.trim() || null,
      mother_name: row.data.nome_mae?.trim() || null,
      father_name: row.data.nome_pai?.trim() || null,
      cep: row.data.cep?.replace(/\D/g, '') || null,
      street: row.data.rua?.trim() || null,
      street_number: row.data.numero?.trim() || null,
      complement: row.data.complemento?.trim() || null,
      neighborhood: row.data.bairro?.trim() || null,
      city: row.data.cidade?.trim() || null,
      state: row.data.estado?.trim() || null,
      address: row.data.endereco?.trim() || null,
      referral: row.data.indicacao?.trim() || null,
      notes: row.data.observacoes?.trim() || null,
    }));
    
    // Process in batches
    for (let i = 0; i < allPatientData.length; i += BATCH_SIZE) {
      if (cancelImportRef.current) {
        toast.info(`Importação cancelada. ${imported} pacientes importados antes do cancelamento.`);
        break;
      }
      
      const batch = allPatientData.slice(i, i + BATCH_SIZE);
      
      try {
        const { data, error } = await supabase.from('patients').insert(batch).select('id');
        
        if (error) {
          // Log error but don't fallback to individual inserts (too slow)
          console.error('[BATCH ERROR]', error.message);
          errors += batch.length;
        } else {
          imported += data?.length || batch.length;
        }
      } catch (err) {
        console.error('[BATCH EXCEPTION]', err);
        errors += batch.length;
      }
      
      setPatientProgress(((i + batch.length) / allPatientData.length) * 100);
    }
    
    // Update import log
    await updateImportLog(logId, {
      total_rows: validRows.length,
      success_count: imported,
      error_count: errors,
      status: cancelImportRef.current ? 'cancelled' : 'completed',
    });
    
    setImportingPatients(false);
    setPatientRows([]);
    
    if (cancelImportRef.current) return;
    
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
    
    // Create import log
    const logId = await createImportLog('records');
    
    // Fetch patients from clinic for matching
    const { data: patients } = await supabase
      .from('patients')
      .select('id, name, cpf')
      .eq('clinic_id', selectedClinicId);
    
    // Build maps for patient lookup - CPF is the PRIMARY identifier
    const cpfToPatientId = new Map<string, string>();
    const normalizedNameToPatientIds = new Map<string, string[]>();
    // Also build a list for fuzzy matching
    const allPatients: Array<{ id: string; name: string; normalizedName: string }> = [];
    
    patients?.forEach(p => {
      if (p.cpf) {
        const cleanCPF = p.cpf.replace(/\D/g, '');
        cpfToPatientId.set(cleanCPF, p.id);
      }
      const normalizedName = normalizeNameForComparison(p.name);
      allPatients.push({ id: p.id, name: p.name, normalizedName });
      const existingIds = normalizedNameToPatientIds.get(normalizedName) || [];
      existingIds.push(p.id);
      normalizedNameToPatientIds.set(normalizedName, existingIds);
    });
    
    // Helper function to find patient by name with fuzzy matching
    const findPatientByName = (searchName: string): string | undefined => {
      const normalizedSearch = normalizeNameForComparison(searchName);
      if (!normalizedSearch) return undefined;
      
      // PRIORITY 1: Exact normalized match
      const exactMatches = normalizedNameToPatientIds.get(normalizedSearch) || [];
      if (exactMatches.length === 1) return exactMatches[0];
      
      // PRIORITY 2: Check if search name contains patient name or vice versa
      for (const patient of allPatients) {
        if (patient.normalizedName.includes(normalizedSearch) || normalizedSearch.includes(patient.normalizedName)) {
          // Additional check: at least 80% of words match
          const searchWords = normalizedSearch.split(' ').filter(w => w.length > 2);
          const patientWords = patient.normalizedName.split(' ').filter(w => w.length > 2);
          const matchingWords = searchWords.filter(sw => patientWords.some(pw => pw.includes(sw) || sw.includes(pw)));
          
          if (matchingWords.length >= Math.min(searchWords.length, patientWords.length) * 0.7) {
            return patient.id;
          }
        }
      }
      
      return undefined;
    };
    
    // ============ PROFESSIONAL CREATION LOGIC ============
    // Extract unique professional names from records
    const uniqueProfessionalNames = new Set<string>();
    
    // Debug: Log first few rows to see what data we have
    console.log('[IMPORT DEBUG] First 3 valid rows:', validRows.slice(0, 3).map(r => ({
      nome_profissional: r.data.nome_profissional,
      nome_paciente: r.data.nome_paciente,
      allKeys: Object.keys(r.data)
    })));
    
    for (const row of validRows) {
      const profName = row.data.nome_profissional?.trim();
      if (profName) {
        uniqueProfessionalNames.add(profName.toLowerCase());
      }
    }
    
    console.log('[IMPORT DEBUG] Unique professional names found:', Array.from(uniqueProfessionalNames));
    
    // Build map of professional name -> id
    const professionalNameToId = new Map<string, string>();
    
    if (uniqueProfessionalNames.size > 0) {
      // Fetch existing professionals for this clinic
      const { data: existingProfessionals } = await supabase
        .from('professionals')
        .select('id, name')
        .eq('clinic_id', selectedClinicId);
      
      existingProfessionals?.forEach(p => {
        professionalNameToId.set(p.name.toLowerCase().trim(), p.id);
      });
      
      // Find professionals that need to be created
      const professionalsToCreate: Array<{ clinic_id: string; name: string; is_active: boolean }> = [];
      for (const profNameLower of uniqueProfessionalNames) {
        if (!professionalNameToId.has(profNameLower)) {
          // Find original case name from records
          const originalName = validRows.find(
            r => r.data.nome_profissional?.toLowerCase().trim() === profNameLower
          )?.data.nome_profissional?.trim();
          
          if (originalName) {
            professionalsToCreate.push({
              clinic_id: selectedClinicId,
              name: originalName,
              is_active: true,
            });
          }
        }
      }
      
      // Batch create professionals
      if (professionalsToCreate.length > 0) {
        try {
          const { data: createdProfessionals, error } = await supabase
            .from('professionals')
            .insert(professionalsToCreate)
            .select('id, name');
          
          if (!error && createdProfessionals) {
            createdProfessionals.forEach(p => {
              professionalNameToId.set(p.name.toLowerCase().trim(), p.id);
            });
            toast.info(`${createdProfessionals.length} profissionais criados automaticamente`);
          } else if (error) {
            console.error('[PROFESSIONAL CREATE ERROR]', error.message);
          }
        } catch (err) {
          console.error('[PROFESSIONAL CREATE EXCEPTION]', err);
        }
      }
    }
    // ============ END PROFESSIONAL CREATION LOGIC ============
    
    let imported = 0;
    let errors = 0;
    let autoCreatedPatients = 0;
    let skippedAmbiguous = 0;
    const BATCH_SIZE = 500;
    
    // Prepare structures for batch patient creation
    const recordsToInsert: Array<{
      clinic_id: string;
      patient_id: string;
      professional_id?: string | null;
      record_date: string;
      chief_complaint: string | null;
      diagnosis: string | null;
      treatment_plan: string | null;
      prescription: string | null;
      notes: string | null;
    }> = [];
    
    const patientsToCreate: Array<{
      cleanCPF: string;
      normalizedName: string;
      patientData: { clinic_id: string; name: string; phone: string; cpf?: string };
    }> = [];
    
    const recordsNeedingPatient: Array<{
      row: typeof validRows[0];
      cleanCPF: string;
      normalizedName: string;
    }> = [];
    
    // First pass: categorize records
    for (let i = 0; i < validRows.length; i++) {
      if (cancelImportRef.current) break;
      
      const row = validRows[i];
      const cleanCPF = row.data.cpf_paciente?.replace(/\D/g, '') || '';
      const normalizedName = normalizeNameForComparison(row.data.nome_paciente || '');
      
      let patientId: string | undefined;
      
      // PRIORITY 1: Match by CPF
      if (cleanCPF && cleanCPF.length >= 11) {
        patientId = cpfToPatientId.get(cleanCPF);
      }
      
      // PRIORITY 2: Match by name using fuzzy matching
      if (!patientId && normalizedName) {
        patientId = findPatientByName(row.data.nome_paciente || '');
      }
      
      if (patientId) {
        const parsedRecordDate = parseDate(row.data.data_registro);
        if (!parsedRecordDate) {
          errors++;
          continue;
        }

        // Get professional_id if professional name is provided
        const profNameLower = row.data.nome_profissional?.toLowerCase().trim();
        const professionalId = profNameLower ? professionalNameToId.get(profNameLower) : undefined;

        recordsToInsert.push({
          clinic_id: selectedClinicId,
          patient_id: patientId,
          professional_id: professionalId || null,
          record_date: parsedRecordDate,
          chief_complaint: row.data.queixa?.trim() || null,
          diagnosis: row.data.diagnostico?.trim() || null,
          treatment_plan: row.data.tratamento?.trim() || null,
          prescription: row.data.prescricao?.trim() || null,
          notes: row.data.observacoes?.trim() || null,
        });
      } else if (normalizedName) {
        const canCreate = true;

        if (canCreate) {
          const alreadyQueued = patientsToCreate.find(p => 
            (cleanCPF.length >= 11 && p.cleanCPF === cleanCPF) || 
            (cleanCPF.length < 11 && p.normalizedName === normalizedName)
          );

          if (!alreadyQueued) {
            const formattedCpf = cleanCPF.length >= 11 ? formatCPF(row.data.cpf_paciente!) : undefined;
            const patientData: { clinic_id: string; name: string; phone: string; cpf?: string } = {
              clinic_id: selectedClinicId,
              name: row.data.nome_paciente!.trim(),
              phone: '',
            };
            if (formattedCpf) {
              patientData.cpf = formattedCpf;
            }
            patientsToCreate.push({ cleanCPF, normalizedName, patientData });
          }

          recordsNeedingPatient.push({ row, cleanCPF, normalizedName });
        }
      } else {
        errors++;
      }
    }
    
    setRecordProgress(20);
    
    // Batch create patients
    if (patientsToCreate.length > 0) {
      const PATIENT_CREATE_BATCH = 200;
      for (let i = 0; i < patientsToCreate.length; i += PATIENT_CREATE_BATCH) {
        if (cancelImportRef.current) break;
        
        const batch = patientsToCreate.slice(i, i + PATIENT_CREATE_BATCH);
        const batchData = batch.map(p => p.patientData);
        
        try {
          const { data: createdPatients, error } = await supabase
            .from('patients')
            .insert(batchData)
            .select('id, cpf, name');
          
          if (!error && createdPatients) {
            autoCreatedPatients += createdPatients.length;
            
            createdPatients.forEach((p) => {
              if (p.cpf) {
                cpfToPatientId.set(p.cpf.replace(/\D/g, ''), p.id);
              }
              const normName = normalizeNameForComparison(p.name);
              allPatients.push({ id: p.id, name: p.name, normalizedName: normName });
              const existingNames = normalizedNameToPatientIds.get(normName) || [];
              existingNames.push(p.id);
              normalizedNameToPatientIds.set(normName, existingNames);
            });
          } else if (error) {
            console.error('[PATIENT CREATE BATCH ERROR]', error.message);
          }
        } catch (err) {
          console.error('[PATIENT CREATE BATCH EXCEPTION]', err);
        }
      }
      
      // Link records to created patients
      for (const { row, cleanCPF, normalizedName } of recordsNeedingPatient) {
        let patientId: string | undefined;
        
        if (cleanCPF.length >= 11) {
          patientId = cpfToPatientId.get(cleanCPF);
        }
        if (!patientId) {
          patientId = findPatientByName(row.data.nome_paciente || '');
        }
        
        if (patientId) {
          const parsedRecordDate = parseDate(row.data.data_registro);
          if (!parsedRecordDate) {
            errors++;
            continue;
          }

          // Get professional_id if professional name is provided
          const profNameLower = row.data.nome_profissional?.toLowerCase().trim();
          const professionalId = profNameLower ? professionalNameToId.get(profNameLower) : undefined;
          
          recordsToInsert.push({
            clinic_id: selectedClinicId,
            patient_id: patientId,
            professional_id: professionalId || null,
            record_date: parsedRecordDate,
            chief_complaint: row.data.queixa?.trim() || null,
            diagnosis: row.data.diagnostico?.trim() || null,
            treatment_plan: row.data.tratamento?.trim() || null,
            prescription: row.data.prescricao?.trim() || null,
            notes: row.data.observacoes?.trim() || null,
          });
        } else {
          errors++;
        }
      }
    }
    
    setRecordProgress(40);
    
    // Batch insert records
    for (let i = 0; i < recordsToInsert.length; i += BATCH_SIZE) {
      if (cancelImportRef.current) {
        toast.info(`Importação cancelada. ${imported} prontuários importados antes do cancelamento.`);
        break;
      }
      
      const batch = recordsToInsert.slice(i, i + BATCH_SIZE);
      
      try {
        const { data, error } = await supabase.from('medical_records').insert(batch).select('id');
        
        if (error) {
          // Log error but don't fallback to individual inserts (too slow)
          console.error('[RECORDS BATCH ERROR]', error.message);
          errors += batch.length;
        } else {
          imported += data?.length || batch.length;
        }
      } catch (err) {
        console.error('[RECORDS BATCH EXCEPTION]', err);
        errors += batch.length;
      }
      
      setRecordProgress(40 + ((i + batch.length) / recordsToInsert.length) * 60);
    }
    
    // Update import log
    await updateImportLog(logId, {
      total_rows: validRows.length,
      success_count: imported,
      error_count: errors,
      status: cancelImportRef.current ? 'cancelled' : 'completed',
    });
    
    setImportingRecords(false);
    setRecordRows([]);
    
    if (cancelImportRef.current) return;
    
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

  // Import contacts and link to existing patients
  const importContacts = async () => {
    if (!selectedClinicId) {
      toast.error('Selecione uma clínica');
      return;
    }
    
    const validContacts = contactRows.filter(r => r.validation.isValid);
    
    if (validContacts.length === 0) {
      toast.error('Nenhum contato válido para importar');
      return;
    }
    
    resetCancellation();
    setImportingContacts(true);
    setContactProgress(0);
    
    // Create import log
    const logId = await createImportLog('contacts');
    
    let updated = 0;
    let notFound = 0;
    let errors = 0;
    
    // Fetch all existing patients for this clinic
    const { data: existingPatients } = await supabase
      .from('patients')
      .select('id, name, cpf')
      .eq('clinic_id', selectedClinicId);
    
    // Build maps for patient lookup
    const cpfToPatientId = new Map<string, string>();
    const nameToPatientId = new Map<string, string>();
    
    existingPatients?.forEach(p => {
      if (p.cpf) {
        const cleanCPF = p.cpf.replace(/\D/g, '');
        cpfToPatientId.set(cleanCPF, p.id);
      }
      nameToPatientId.set(p.name.toLowerCase().trim(), p.id);
    });
    
    for (let i = 0; i < validContacts.length; i++) {
      if (cancelImportRef.current) {
        toast.info(`Importação cancelada. ${updated} contatos atualizados antes do cancelamento.`);
        break;
      }
      
      const row = validContacts[i];
      const cleanCPF = row.data.cpf?.replace(/\D/g, '') || '';
      const normalizedName = row.data.nome?.toLowerCase().trim() || '';
      
      let patientId: string | undefined;
      
      // Priority 1: Match by CPF
      if (cleanCPF && cleanCPF.length >= 11) {
        patientId = cpfToPatientId.get(cleanCPF);
      }
      
      // Priority 2: Match by name
      if (!patientId && normalizedName) {
        patientId = nameToPatientId.get(normalizedName);
      }
      
      if (patientId) {
        // Build update object with only provided fields
        const updateData: Record<string, string> = {};
        
        if (row.data.telefone) {
          updateData.phone = formatPhone(row.data.telefone);
        }
        if (row.data.telefone_fixo) {
          updateData.landline = formatPhone(row.data.telefone_fixo);
        }
        if (row.data.email) {
          updateData.email = row.data.email.trim();
        }
        
        if (Object.keys(updateData).length > 0) {
          try {
            const { error } = await supabase
              .from('patients')
              .update(updateData)
              .eq('id', patientId);
            
            if (error) {
              console.error('[UPDATE ERROR]', error.message);
              errors++;
            } else {
              updated++;
            }
          } catch (err) {
            console.error('[UPDATE EXCEPTION]', err);
            errors++;
          }
        }
      } else {
        notFound++;
      }
      
      setContactProgress(((i + 1) / validContacts.length) * 100);
    }
    
    // Update import log
    await updateImportLog(logId, {
      total_rows: validContacts.length,
      success_count: updated,
      error_count: errors + notFound,
      status: cancelImportRef.current ? 'cancelled' : 'completed',
    });
    
    setImportingContacts(false);
    setContactRows([]);
    
    if (cancelImportRef.current) {
      return;
    }
    
    if (notFound > 0 || errors > 0) {
      toast.warning(`${updated} contatos atualizados, ${notFound} pacientes não encontrados, ${errors} erros`);
    } else {
      toast.success(`${updated} contatos atualizados com sucesso!`);
    }
  };

  const selectedClinic = clinics.find(c => c.id === selectedClinicId);
  const validPatientCount = patientRows.filter(r => r.validation.isValid).length;
  const validRecordCount = recordRows.filter(r => r.validation.isValid).length;
  const validContactCount = contactRows.filter(r => r.validation.isValid).length;

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
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "export" | "combined" | "patients" | "records" | "contacts" | "history")}>
        <TabsList className="flex-wrap h-auto gap-1">
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
          <TabsTrigger value="contacts" className="gap-2">
            <Phone className="h-4 w-4" />
            Atualizar Contatos
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Histórico
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

                  <ImportProgressCard
                    isImporting={importingCombined}
                    progress={combinedProgress}
                    importType="combined"
                    totalItems={validPatientCount + (importWithRecords ? validRecordCount : 0)}
                    isCancelled={importCancelled}
                    onCancel={cancelImport}
                  />

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

                  <ImportProgressCard
                    isImporting={importingPatients}
                    progress={patientProgress}
                    importType="patients"
                    totalItems={validPatientCount}
                    isCancelled={importCancelled}
                    onCancel={cancelImport}
                  />

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

                  <ImportProgressCard
                    isImporting={importingRecords}
                    progress={recordProgress}
                    importType="records"
                    totalItems={validRecordCount}
                    isCancelled={importCancelled}
                    onCancel={cancelImport}
                  />

                  <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Paciente</TableHead>
                          <TableHead>Profissional</TableHead>
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
                            <TableCell>{row.data.nome_profissional || '-'}</TableCell>
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

        {/* Contacts Import Tab */}
        <TabsContent value="contacts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Importar e Atualizar Contatos
              </CardTitle>
              <CardDescription>
                Atualize telefone, telefone fixo e email de pacientes existentes vinculando por CPF ou nome
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={() => downloadTemplate('contacts')}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Baixar Modelo
                </Button>
                
                <label>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleContactsFile}
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
              {contactRows.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Badge variant="outline">{contactRows.length} linhas</Badge>
                      <Badge variant="default" className="bg-success">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {validContactCount} válidos
                      </Badge>
                      {contactRows.length - validContactCount > 0 && (
                        <Badge variant="destructive">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          {contactRows.length - validContactCount} com erros
                        </Badge>
                      )}
                    </div>
                    
                    <Button
                      onClick={importContacts}
                      disabled={importingContacts || validContactCount === 0}
                      className="gap-2"
                    >
                      {importingContacts ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      Atualizar {validContactCount} contatos
                    </Button>
                  </div>

                  <ImportProgressCard
                    isImporting={importingContacts}
                    progress={contactProgress}
                    importType="contacts"
                    totalItems={validContactCount}
                    isCancelled={importCancelled}
                    onCancel={cancelImport}
                  />

                  <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>CPF</TableHead>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Fixo</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contactRows.slice(0, 100).map((row) => (
                          <TableRow key={row.rowNumber} className={!row.validation.isValid ? 'bg-destructive/5' : ''}>
                            <TableCell className="text-muted-foreground">{row.rowNumber}</TableCell>
                            <TableCell className="font-medium">{row.data.nome || '-'}</TableCell>
                            <TableCell>{row.data.cpf || '-'}</TableCell>
                            <TableCell>{row.data.telefone || '-'}</TableCell>
                            <TableCell>{row.data.telefone_fixo || '-'}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{row.data.email || '-'}</TableCell>
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
                  
                  {contactRows.length > 100 && (
                    <p className="text-sm text-muted-foreground text-center">
                      Mostrando 100 de {contactRows.length} linhas
                    </p>
                  )}
                </div>
              )}

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium text-sm mb-2">Como funciona a atualização de contatos:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Primeiro tentamos vincular pelo <strong>CPF do paciente</strong></li>
                  <li>• Se não encontrar, tentamos pelo <strong>nome exato</strong></li>
                  <li>• Apenas os campos preenchidos na planilha serão atualizados</li>
                  <li>• Pacientes não encontrados serão ignorados na importação</li>
                  <li>• Os pacientes já devem existir no sistema para atualizar seus contatos</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <ImportHistoryPanel clinicId={selectedClinicId || undefined} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
