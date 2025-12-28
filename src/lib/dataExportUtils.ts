import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

export interface ExportOptions {
  clinicId: string;
  clinicName: string;
  exportPatients: boolean;
  exportContacts: boolean;
  exportMedicalRecords: boolean;
  exportProfessionals: boolean;
  exportProcedures: boolean;
  exportInsurancePlans: boolean;
}

export interface ExportProgress {
  current: number;
  total: number;
  currentEntity: string;
}

// Format phone for export
const formatPhoneForExport = (phone: string | null): string => {
  if (!phone) return '';
  return phone;
};

// Format CPF for export
const formatCPFForExport = (cpf: string | null): string => {
  if (!cpf) return '';
  return cpf;
};

// Format date for export
const formatDateForExport = (date: string | null): string => {
  if (!date) return '';
  try {
    return new Date(date).toLocaleDateString('pt-BR');
  } catch {
    return date;
  }
};

export async function exportClinicData(
  options: ExportOptions,
  onProgress?: (progress: ExportProgress) => void
): Promise<void> {
  const workbook = XLSX.utils.book_new();
  const entitiesToExport: string[] = [];
  
  if (options.exportPatients) entitiesToExport.push('patients');
  if (options.exportContacts) entitiesToExport.push('contacts');
  if (options.exportMedicalRecords) entitiesToExport.push('records');
  if (options.exportProfessionals) entitiesToExport.push('professionals');
  if (options.exportProcedures) entitiesToExport.push('procedures');
  if (options.exportInsurancePlans) entitiesToExport.push('insurance');
  
  let processedEntities = 0;
  const totalEntities = entitiesToExport.length;

  // Export Patients
  if (options.exportPatients) {
    onProgress?.({ current: processedEntities, total: totalEntities, currentEntity: 'Pacientes' });
    
    const { data: patients, error } = await supabase
      .from('patients')
      .select('*')
      .eq('clinic_id', options.clinicId)
      .order('name');
    
    if (!error && patients && patients.length > 0) {
      const patientsData = patients.map(p => ({
        'Nome': p.name,
        'Telefone': formatPhoneForExport(p.phone),
        'CPF': formatCPFForExport(p.cpf),
        'Email': p.email || '',
        'Data de Nascimento': formatDateForExport(p.birth_date),
        'Endereço': p.address || '',
        'Observações': p.notes || '',
        'Criado em': formatDateForExport(p.created_at),
      }));
      
      const sheet = XLSX.utils.json_to_sheet(patientsData);
      XLSX.utils.book_append_sheet(workbook, sheet, 'Pacientes');
    }
    
    processedEntities++;
  }

  // Export Contacts (same as patients but different columns)
  if (options.exportContacts) {
    onProgress?.({ current: processedEntities, total: totalEntities, currentEntity: 'Contatos' });
    
    const { data: patients, error } = await supabase
      .from('patients')
      .select('name, phone, email')
      .eq('clinic_id', options.clinicId)
      .order('name');
    
    if (!error && patients && patients.length > 0) {
      const contactsData = patients.map(p => ({
        'Nome': p.name,
        'Telefone': formatPhoneForExport(p.phone),
        'Email': p.email || '',
      }));
      
      const sheet = XLSX.utils.json_to_sheet(contactsData);
      XLSX.utils.book_append_sheet(workbook, sheet, 'Contatos');
    }
    
    processedEntities++;
  }

  // Export Medical Records
  if (options.exportMedicalRecords) {
    onProgress?.({ current: processedEntities, total: totalEntities, currentEntity: 'Prontuários' });
    
    const { data: records, error } = await supabase
      .from('medical_records')
      .select(`
        *,
        patient:patients(name, cpf)
      `)
      .eq('clinic_id', options.clinicId)
      .order('record_date', { ascending: false });
    
    if (!error && records && records.length > 0) {
      const recordsData = records.map(r => ({
        'Paciente': r.patient?.name || '',
        'CPF Paciente': formatCPFForExport(r.patient?.cpf || null),
        'Data do Registro': formatDateForExport(r.record_date),
        'Queixa Principal': r.chief_complaint || '',
        'Diagnóstico': r.diagnosis || '',
        'Plano de Tratamento': r.treatment_plan || '',
        'Prescrição': r.prescription || '',
        'Observações': r.notes || '',
        'Criado em': formatDateForExport(r.created_at),
      }));
      
      const sheet = XLSX.utils.json_to_sheet(recordsData);
      XLSX.utils.book_append_sheet(workbook, sheet, 'Prontuarios');
    }
    
    processedEntities++;
  }

  // Export Professionals
  if (options.exportProfessionals) {
    onProgress?.({ current: processedEntities, total: totalEntities, currentEntity: 'Profissionais' });
    
    const { data: professionals, error } = await supabase
      .from('professionals')
      .select('*')
      .eq('clinic_id', options.clinicId)
      .order('name');
    
    if (!error && professionals && professionals.length > 0) {
      const professionalsData = professionals.map(p => ({
        'Nome': p.name,
        'Especialidade': p.specialty || '',
        'Registro Profissional': p.registration_number || '',
        'Telefone': formatPhoneForExport(p.phone),
        'Email': p.email || '',
        'Ativo': p.is_active ? 'Sim' : 'Não',
        'Criado em': formatDateForExport(p.created_at),
      }));
      
      const sheet = XLSX.utils.json_to_sheet(professionalsData);
      XLSX.utils.book_append_sheet(workbook, sheet, 'Profissionais');
    }
    
    processedEntities++;
  }

  // Export Procedures
  if (options.exportProcedures) {
    onProgress?.({ current: processedEntities, total: totalEntities, currentEntity: 'Procedimentos' });
    
    const { data: procedures, error } = await supabase
      .from('procedures')
      .select('*')
      .eq('clinic_id', options.clinicId)
      .order('name');
    
    if (!error && procedures && procedures.length > 0) {
      const proceduresData = procedures.map(p => ({
        'Nome': p.name,
        'Descrição': p.description || '',
        'Preço': p.price ? `R$ ${Number(p.price).toFixed(2)}` : '',
        'Duração (min)': p.duration_minutes || '',
        'Categoria': p.category || '',
        'Ativo': p.is_active ? 'Sim' : 'Não',
        'Criado em': formatDateForExport(p.created_at),
      }));
      
      const sheet = XLSX.utils.json_to_sheet(proceduresData);
      XLSX.utils.book_append_sheet(workbook, sheet, 'Procedimentos');
    }
    
    processedEntities++;
  }

  // Export Insurance Plans
  if (options.exportInsurancePlans) {
    onProgress?.({ current: processedEntities, total: totalEntities, currentEntity: 'Convênios' });
    
    const { data: insurancePlans, error } = await supabase
      .from('insurance_plans')
      .select('*')
      .eq('clinic_id', options.clinicId)
      .order('name');
    
    if (!error && insurancePlans && insurancePlans.length > 0) {
      const insuranceData = insurancePlans.map(p => ({
        'Nome': p.name,
        'Código': p.code || '',
        'Ativo': p.is_active ? 'Sim' : 'Não',
        'Criado em': formatDateForExport(p.created_at),
      }));
      
      const sheet = XLSX.utils.json_to_sheet(insuranceData);
      XLSX.utils.book_append_sheet(workbook, sheet, 'Convenios');
    }
    
    processedEntities++;
  }

  // Check if workbook has any sheets
  if (workbook.SheetNames.length === 0) {
    throw new Error('Nenhum dado encontrado para exportar');
  }

  // Generate filename with date
  const dateStr = new Date().toISOString().split('T')[0];
  const clinicSlug = options.clinicName.toLowerCase().replace(/\s+/g, '-');
  const filename = `exportacao-${clinicSlug}-${dateStr}.xlsx`;

  // Save file
  XLSX.writeFile(workbook, filename);
  
  onProgress?.({ current: totalEntities, total: totalEntities, currentEntity: 'Concluído' });
}

// Get counts for each entity type
export async function getExportCounts(clinicId: string): Promise<{
  patients: number;
  medicalRecords: number;
  professionals: number;
  procedures: number;
  insurancePlans: number;
}> {
  const [patientsResult, recordsResult, professionalsResult, proceduresResult, insuranceResult] = await Promise.all([
    supabase.from('patients').select('id', { count: 'exact', head: true }).eq('clinic_id', clinicId),
    supabase.from('medical_records').select('id', { count: 'exact', head: true }).eq('clinic_id', clinicId),
    supabase.from('professionals').select('id', { count: 'exact', head: true }).eq('clinic_id', clinicId),
    supabase.from('procedures').select('id', { count: 'exact', head: true }).eq('clinic_id', clinicId),
    supabase.from('insurance_plans').select('id', { count: 'exact', head: true }).eq('clinic_id', clinicId),
  ]);

  return {
    patients: patientsResult.count || 0,
    medicalRecords: recordsResult.count || 0,
    professionals: professionalsResult.count || 0,
    procedures: proceduresResult.count || 0,
    insurancePlans: insuranceResult.count || 0,
  };
}
