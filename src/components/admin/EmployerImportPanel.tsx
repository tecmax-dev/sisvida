import { useState, useCallback, useEffect } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Upload,
  Building2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  FileSpreadsheet,
  ArrowRight,
  RefreshCw,
  Shuffle,
} from "lucide-react";

interface EmployerImportRow {
  id: string;
  nome: string;
  fantasia?: string;
  cnpj: string;
  email?: string;
  telefone?: string;
  cep?: string;
  cidade?: string;
  uf?: string;
  bairro?: string;
  endereco?: string;
  segmento?: string;
}

interface ParsedEmployer {
  rowNumber: number;
  data: EmployerImportRow;
  status: 'to_create' | 'to_update' | 'invalid' | 'conflict';
  existingId?: string;
  existingRegistration?: string;
  errors: string[];
  changes?: string[];
  conflictInfo?: {
    occupantId: string;
    occupantName: string;
    occupantCnpj: string;
    targetRegistration: string;
  };
}

interface EmployerImportPanelProps {
  clinicId: string;
}

// Clean CNPJ to 14 digits
function cleanCnpj(cnpj: string): string {
  return (cnpj || '').replace(/\D/g, '');
}

// Normalize CNPJ value from Excel (handles numbers, scientific notation, strings)
function normalizeCnpjValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  
  // If it's a number (Excel stores CNPJs as numbers, losing leading zeros)
  if (typeof val === 'number') {
    // Convert to string and pad to 14 digits
    return Math.floor(val).toString().padStart(14, '0');
  }
  
  let str = String(val).trim();
  
  // Handle scientific notation (e.g., 1.23456E+13)
  if (/[eE]\+?\d+/.test(str)) {
    try {
      // Parse as number and convert to integer string
      const num = parseFloat(str);
      if (!isNaN(num)) {
        str = Math.floor(num).toString().padStart(14, '0');
      }
    } catch {
      // Keep original if parsing fails
    }
  }
  
  // Clean to only digits and pad if needed
  const digits = str.replace(/\D/g, '');
  if (digits.length > 0 && digits.length < 14) {
    return digits.padStart(14, '0');
  }
  
  return digits;
}

// Format registration number to 6 digits
function formatRegistration(id: string): string {
  const numericId = String(id || '').replace(/\D/g, '');
  return numericId.padStart(6, '0');
}

// Validate CNPJ
function validateCnpj(cnpj: string): boolean {
  const clean = cleanCnpj(cnpj);
  if (clean.length !== 14) return false;
  if (/^(\d)\1+$/.test(clean)) return false;
  
  let sum = 0;
  let weight = 5;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(clean[i]) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(clean[12])) return false;
  
  sum = 0;
  weight = 6;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(clean[i]) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(clean[13])) return false;
  
  return true;
}

// Find header row index by looking for CNPJ or ID columns
function findHeaderRowIndex(sheet: XLSX.WorkSheet): number {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  const maxRowsToCheck = Math.min(10, range.e.r + 1);
  
  for (let r = 0; r < maxRowsToCheck; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellAddress = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[cellAddress];
      if (cell && cell.v) {
        const val = String(cell.v).trim().toUpperCase();
        if (val === 'CNPJ' || val === 'ID' || val === 'MATRICULA' || val === 'NOME DA EMPRESA') {
          return r;
        }
      }
    }
  }
  return 0; // Default to first row
}

// Categorize error type
function categorizeError(errorMessage: string): 'unique' | 'rls' | 'other' {
  const msg = errorMessage.toLowerCase();
  if (msg.includes('unique constraint') || msg.includes('duplicate key')) {
    return 'unique';
  }
  if (msg.includes('rls') || msg.includes('policy') || msg.includes('permission') || msg.includes('denied')) {
    return 'rls';
  }
  return 'other';
}

export function EmployerImportPanel({ clinicId }: EmployerImportPanelProps) {
  const STORAGE_KEY = `employer-import-${clinicId}`;

  const [parsedEmployers, setParsedEmployers] = useState<ParsedEmployer[]>(() => {
    try {
      const saved = sessionStorage.getItem(`employer-import-${clinicId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.employers || [];
      }
    } catch { /* ignore */ }
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dryRun, setDryRun] = useState(() => {
    try {
      const saved = sessionStorage.getItem(`employer-import-${clinicId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.dryRun ?? true;
      }
    } catch { /* ignore */ }
    return true;
  });
  const [resolveConflicts, setResolveConflicts] = useState(() => {
    try {
      const saved = sessionStorage.getItem(`employer-import-${clinicId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.resolveConflicts ?? true;
      }
    } catch { /* ignore */ }
    return true;
  });
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ 
    created: number; 
    updated: number; 
    errors: number; 
    reallocated: number;
    errorDetails: string[];
    uniqueErrors: string[];
    rlsErrors: string[];
  } | null>(() => {
    try {
      const saved = sessionStorage.getItem(`employer-import-${clinicId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.results || null;
      }
    } catch { /* ignore */ }
    return null;
  });

  // Persist state to sessionStorage
  useEffect(() => {
    if (parsedEmployers.length > 0 || results) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        employers: parsedEmployers,
        dryRun,
        resolveConflicts,
        results,
      }));
    }
  }, [parsedEmployers, dryRun, resolveConflicts, results, STORAGE_KEY]);

  // Clear storage helper
  const clearStorage = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
  }, [STORAGE_KEY]);

  const handleFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setLoading(true);
    setParsedEmployers([]);
    setResults(null);
    
    try {
      toast.loading('Processando planilha...', { id: 'parsing-employers' });
      
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      
      // Find the actual header row (skip title rows from SindSystem, etc.)
      const headerRowIndex = findHeaderRowIndex(sheet);
      console.log('Header row detected at index:', headerRowIndex);
      
      // Parse with the correct header row, preserving raw values
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { 
        range: headerRowIndex,
        defval: '', // Empty cells become empty strings
        raw: true, // Get raw values (numbers stay as numbers)
      });
      
      console.log('Parsed rows:', rows.length);
      
      // Fetch existing employers for comparison
      const { data: existingEmployers } = await supabase
        .from('employers')
        .select('id, cnpj, registration_number, name')
        .eq('clinic_id', clinicId);
      
      // Build maps for CNPJ and registration_number
      const cnpjToEmployer = new Map<string, { id: string; registration_number: string | null; name: string; cnpj: string }>();
      const registrationToEmployer = new Map<string, { id: string; cnpj: string; name: string }>();
      
      existingEmployers?.forEach(emp => {
        const cleanedCnpj = cleanCnpj(emp.cnpj || '');
        if (cleanedCnpj) {
          cnpjToEmployer.set(cleanedCnpj, {
            id: emp.id,
            registration_number: emp.registration_number,
            name: emp.name,
            cnpj: cleanedCnpj,
          });
        }
        if (emp.registration_number) {
          registrationToEmployer.set(emp.registration_number, {
            id: emp.id,
            cnpj: cleanedCnpj,
            name: emp.name,
          });
        }
      });
      
      const parsed: ParsedEmployer[] = [];
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const errors: string[] = [];
        const changes: string[] = [];
        
        // Map columns - handle different column name variations
        const getId = (): string => {
          // Find ID column with case-insensitive matching
          const idKey = Object.keys(row).find(k => 
            ['ID', 'MATRICULA'].includes(k.trim().toUpperCase())
          );
          const val = idKey ? row[idKey] : '';
          return String(val).trim();
        };
        
        const getNome = (): string => {
          // Find Nome column with case-insensitive matching
          const nomeKey = Object.keys(row).find(k => {
            const upper = k.trim().toUpperCase();
            return upper === 'NOME DA EMPRESA' || upper === 'NOME' || upper === 'RAZAO_SOCIAL';
          });
          const val = nomeKey ? row[nomeKey] : '';
          return String(val).trim();
        };
        
        const getFantasia = (): string => {
          const val = row['Fantasia'] || row['FANTASIA'] || row['fantasia'] || row['nome_fantasia'] || '';
          return String(val).trim();
        };
        
        const getCnpj = (): string => {
          // Find CNPJ column with case-insensitive matching
          const cnpjKey = Object.keys(row).find(k => k.trim().toUpperCase() === 'CNPJ');
          const val = cnpjKey ? row[cnpjKey] : '';
          // Normalize CNPJ (handles numbers, scientific notation, leading zeros)
          return normalizeCnpjValue(val);
        };
        
        const getEmail = (): string => {
          const val = row['E-mail'] || row['EMAIL'] || row['email'] || row['Email'] || '';
          return String(val).trim();
        };
        
        const getTelefone = (): string => {
          const val = row['Telefone'] || row['TELEFONE'] || row['telefone'] || row['fone'] || '';
          return String(val).trim();
        };
        
        const getCep = (): string => {
          const val = row['Cep'] || row['CEP'] || row['cep'] || '';
          return String(val).trim();
        };
        
        const getCidade = (): string => {
          const val = row['Cidade'] || row['CIDADE'] || row['cidade'] || row['municipio'] || '';
          return String(val).trim();
        };
        
        const getUf = (): string => {
          const val = row['UF'] || row['uf'] || row['Uf'] || row['estado'] || row['ESTADO'] || '';
          return String(val).trim();
        };
        
        const getBairro = (): string => {
          const val = row['Bairro'] || row['BAIRRO'] || row['bairro'] || '';
          return String(val).trim();
        };
        
        const getEndereco = (): string => {
          const val = row['Endereço'] || row['ENDERECO'] || row['endereco'] || row['Endereco'] || row['logradouro'] || '';
          return String(val).trim();
        };
        
        const getSegmento = (): string => {
          const val = row['Segmento'] || row['SEGMENTO'] || row['segmento'] || row['categoria'] || '';
          return String(val).trim();
        };
        
        const id = getId();
        const nome = getNome();
        const cnpj = getCnpj();
        
        // Validations
        if (!id) errors.push('ID/Matrícula ausente');
        if (!nome) errors.push('Nome ausente');
        if (!cnpj) errors.push('CNPJ ausente');
        else if (!validateCnpj(cnpj)) errors.push('CNPJ inválido');
        
        const data: EmployerImportRow = {
          id,
          nome,
          fantasia: getFantasia() || undefined,
          cnpj,
          email: getEmail() || undefined,
          telefone: getTelefone() || undefined,
          cep: getCep() || undefined,
          cidade: getCidade() || undefined,
          uf: getUf() || undefined,
          bairro: getBairro() || undefined,
          endereco: getEndereco() || undefined,
          segmento: getSegmento() || undefined,
        };
        
        let status: 'to_create' | 'to_update' | 'invalid' | 'conflict' = 'invalid';
        let existingId: string | undefined;
        let existingRegistration: string | undefined;
        let conflictInfo: ParsedEmployer['conflictInfo'];
        
        if (errors.length === 0) {
          const cleanedCnpj = cleanCnpj(cnpj);
          const existing = cnpjToEmployer.get(cleanedCnpj);
          const targetRegistration = formatRegistration(id);
          const occupant = registrationToEmployer.get(targetRegistration);
          
          if (existing) {
            existingId = existing.id;
            existingRegistration = existing.registration_number || undefined;
            
            // Check if there's a registration conflict (different employer has this registration)
            if (occupant && occupant.id !== existing.id) {
              status = 'conflict';
              conflictInfo = {
                occupantId: occupant.id,
                occupantName: occupant.name,
                occupantCnpj: occupant.cnpj,
                targetRegistration,
              };
              errors.push(`Matrícula ${targetRegistration} já em uso por "${occupant.name}" (CNPJ ${occupant.cnpj})`);
            } else {
              status = 'to_update';
              if (existing.registration_number !== targetRegistration) {
                changes.push(`Matrícula: ${existing.registration_number || '(vazio)'} → ${targetRegistration}`);
              }
            }
          } else {
            // New employer - check if registration is already taken
            if (occupant) {
              status = 'conflict';
              conflictInfo = {
                occupantId: occupant.id,
                occupantName: occupant.name,
                occupantCnpj: occupant.cnpj,
                targetRegistration,
              };
              errors.push(`Matrícula ${targetRegistration} já em uso por "${occupant.name}" (CNPJ ${occupant.cnpj})`);
            } else {
              status = 'to_create';
            }
          }
        }
        
        parsed.push({
          rowNumber: i + 2, // Excel row (header is row 1)
          data,
          status,
          existingId,
          existingRegistration,
          errors,
          changes,
          conflictInfo,
        });
      }
      
      toast.dismiss('parsing-employers');
      setParsedEmployers(parsed);
      
      const toCreate = parsed.filter(p => p.status === 'to_create').length;
      const toUpdate = parsed.filter(p => p.status === 'to_update').length;
      const conflicts = parsed.filter(p => p.status === 'conflict').length;
      const invalid = parsed.filter(p => p.status === 'invalid').length;
      
      let message = `Planilha processada: ${toCreate} para criar, ${toUpdate} para atualizar`;
      if (conflicts > 0) {
        message += `, ${conflicts} conflitos de matrícula`;
      }
      if (invalid > 0) {
        message += `, ${invalid} com erros`;
      }
      
      if (conflicts > 0) {
        toast.warning(message);
      } else {
        toast.success(message);
      }
    } catch (error) {
      toast.dismiss('parsing-employers');
      console.error('Error parsing employer file:', error);
      toast.error('Erro ao ler arquivo');
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  }, [clinicId]);

  const handleImport = async () => {
    const conflicts = parsedEmployers.filter(p => p.status === 'conflict');
    const toProcess = parsedEmployers.filter(p => p.status === 'to_create' || p.status === 'to_update' || (p.status === 'conflict' && resolveConflicts));
    
    if (toProcess.length === 0) {
      if (conflicts.length > 0 && !resolveConflicts) {
        toast.error('Existem conflitos de matrícula. Ative "Resolver conflitos automaticamente" para continuar.');
      } else {
        toast.error('Nenhum registro válido para importar');
      }
      return;
    }
    
    setImporting(true);
    setProgress(0);
    setResults(null);
    
    let created = 0;
    let updated = 0;
    let errors = 0;
    let reallocated = 0;
    const errorDetails: string[] = [];
    const uniqueErrors: string[] = [];
    const rlsErrors: string[] = [];
    
    // Build a working map of registrations (will be updated during import)
    const workingRegistrationMap = new Map<string, string>(); // registration -> employer_id
    const { data: existingEmployers } = await supabase
      .from('employers')
      .select('id, registration_number')
      .eq('clinic_id', clinicId);
    
    existingEmployers?.forEach(emp => {
      if (emp.registration_number) {
        workingRegistrationMap.set(emp.registration_number, emp.id);
      }
    });
    
    const BATCH_SIZE = 50;
    
    for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
      const batch = toProcess.slice(i, i + BATCH_SIZE);
      
      for (const employer of batch) {
        try {
          const cleanedCnpj = cleanCnpj(employer.data.cnpj);
          const targetRegistration = formatRegistration(employer.data.id);
          
          // ROBUST: Always free up the registration directly by key (clinic_id + registration_number)
          // This ensures we catch ANY occupant, not just those in our in-memory map
          if (resolveConflicts && !dryRun) {
            const excludeId = employer.existingId || 'no-match-placeholder';
            const { data: freedData, error: freeError } = await supabase
              .from('employers')
              .update({ 
                registration_number: null,
                updated_at: new Date().toISOString(),
              })
              .eq('clinic_id', clinicId)
              .eq('registration_number', targetRegistration)
              .neq('id', excludeId)
              .select('id');
            
            if (freeError) {
              const errorMsg = `Linha ${employer.rowNumber}: Não foi possível liberar matrícula ${targetRegistration} - ${freeError.message}`;
              rlsErrors.push(errorMsg);
              throw freeError;
            }
            
            // Track how many were freed
            if (freedData && freedData.length > 0) {
              reallocated += freedData.length;
              // Update working map
              workingRegistrationMap.delete(targetRegistration);
            }
          } else if (resolveConflicts && dryRun) {
            // In dry-run, check if reallocation would happen
            const currentOccupant = workingRegistrationMap.get(targetRegistration);
            if (currentOccupant && currentOccupant !== employer.existingId) {
              reallocated++;
              workingRegistrationMap.delete(targetRegistration);
            }
          }
          
          const shouldUpdate = (employer.status === 'to_update') || (employer.status === 'conflict' && !!employer.existingId);
          const shouldCreate = (employer.status === 'to_create') || (employer.status === 'conflict' && !employer.existingId);

          if (shouldUpdate && employer.existingId) {
            if (!dryRun) {
              const { error } = await supabase
                .from('employers')
                .update({
                  registration_number: targetRegistration,
                  ...(employer.data.email && { email: employer.data.email }),
                  ...(employer.data.telefone && { phone: employer.data.telefone }),
                  ...(employer.data.cep && { cep: employer.data.cep }),
                  ...(employer.data.cidade && { city: employer.data.cidade }),
                  ...(employer.data.uf && { state: employer.data.uf }),
                  ...(employer.data.bairro && { neighborhood: employer.data.bairro }),
                  ...(employer.data.endereco && { address: employer.data.endereco }),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', employer.existingId);

              if (error) {
                const errorType = categorizeError(error.message);
                const errorMsg = `Linha ${employer.rowNumber} (${employer.data.nome}): ${error.message}`;
                if (errorType === 'unique') {
                  uniqueErrors.push(errorMsg);
                } else if (errorType === 'rls') {
                  rlsErrors.push(errorMsg);
                } else {
                  errorDetails.push(errorMsg);
                }
                throw error;
              }
            }
            // Update working map
            workingRegistrationMap.set(targetRegistration, employer.existingId);
            updated++;
          } else if (shouldCreate) {
            if (!dryRun) {
              const { data: inserted, error } = await supabase
                .from('employers')
                .insert({
                  clinic_id: clinicId,
                  name: employer.data.nome,
                  trade_name: employer.data.fantasia || null,
                  cnpj: cleanedCnpj,
                  registration_number: targetRegistration,
                  email: employer.data.email || null,
                  phone: employer.data.telefone || null,
                  cep: employer.data.cep || null,
                  city: employer.data.cidade || null,
                  state: employer.data.uf || null,
                  neighborhood: employer.data.bairro || null,
                  address: employer.data.endereco || null,
                  is_active: true,
                })
                .select('id')
                .single();

              if (error) {
                // FALLBACK: If CNPJ duplicate, try to find and update instead
                if (error.message.includes('employers_clinic_id_cnpj_key')) {
                  const { data: existingByCnpj } = await supabase
                    .from('employers')
                    .select('id')
                    .eq('clinic_id', clinicId)
                    .eq('cnpj', cleanedCnpj)
                    .single();
                  
                  if (existingByCnpj) {
                    const { error: updateError } = await supabase
                      .from('employers')
                      .update({
                        registration_number: targetRegistration,
                        name: employer.data.nome,
                        trade_name: employer.data.fantasia || null,
                        ...(employer.data.email && { email: employer.data.email }),
                        ...(employer.data.telefone && { phone: employer.data.telefone }),
                        ...(employer.data.cep && { cep: employer.data.cep }),
                        ...(employer.data.cidade && { city: employer.data.cidade }),
                        ...(employer.data.uf && { state: employer.data.uf }),
                        ...(employer.data.bairro && { neighborhood: employer.data.bairro }),
                        ...(employer.data.endereco && { address: employer.data.endereco }),
                        updated_at: new Date().toISOString(),
                      })
                      .eq('id', existingByCnpj.id);
                    
                    if (updateError) {
                      const errorType = categorizeError(updateError.message);
                      const errorMsg = `Linha ${employer.rowNumber} (${employer.data.nome}): ${updateError.message}`;
                      if (errorType === 'unique') uniqueErrors.push(errorMsg);
                      else if (errorType === 'rls') rlsErrors.push(errorMsg);
                      else errorDetails.push(errorMsg);
                      throw updateError;
                    }
                    workingRegistrationMap.set(targetRegistration, existingByCnpj.id);
                    updated++;
                    continue; // Skip to next employer
                  }
                }
                
                const errorType = categorizeError(error.message);
                const errorMsg = `Linha ${employer.rowNumber} (${employer.data.nome}): ${error.message}`;
                if (errorType === 'unique') {
                  uniqueErrors.push(errorMsg);
                } else if (errorType === 'rls') {
                  rlsErrors.push(errorMsg);
                } else {
                  errorDetails.push(errorMsg);
                }
                throw error;
              }

              // Update working map with new employer
              if (inserted) {
                workingRegistrationMap.set(targetRegistration, inserted.id);
              }
            }
            created++;
          }
        } catch (error) {
          console.error('Error processing employer:', employer.data.nome, error);
          errors++;
        }
      }
      
      setProgress(Math.round(((i + batch.length) / toProcess.length) * 100));
    }
    
    setResults({ created, updated, errors, reallocated, errorDetails, uniqueErrors, rlsErrors });
    setImporting(false);
    
    if (dryRun) {
      let msg = `Simulação concluída: ${created} seriam criados, ${updated} seriam atualizados`;
      if (reallocated > 0) {
        msg += `, ${reallocated} matrículas seriam realocadas`;
      }
      toast.success(msg);
    } else {
      if (errors > 0) {
        const errorTypes: string[] = [];
        if (uniqueErrors.length > 0) errorTypes.push(`${uniqueErrors.length} conflitos de matrícula`);
        if (rlsErrors.length > 0) errorTypes.push(`${rlsErrors.length} erros de permissão`);
        if (errorDetails.length > 0) errorTypes.push(`${errorDetails.length} outros erros`);
        
        toast.error(`Importação com erros: ${created} criados, ${updated} atualizados, ${errorTypes.join(', ')}`);
      } else {
        let msg = `Importação concluída: ${created} criados, ${updated} atualizados`;
        if (reallocated > 0) {
          msg += `, ${reallocated} matrículas realocadas`;
        }
        toast.success(msg);
      }
      if (errors === 0) {
        setParsedEmployers([]);
        clearStorage();
      }
    }
  };

  const toCreate = parsedEmployers.filter(p => p.status === 'to_create');
  const toUpdate = parsedEmployers.filter(p => p.status === 'to_update');
  const conflicts = parsedEmployers.filter(p => p.status === 'conflict');
  const invalid = parsedEmployers.filter(p => p.status === 'invalid');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Importar Empresas (Sincronizar Matrículas)
        </CardTitle>
        <CardDescription>
          Sincronize matrículas com planilha do SindSystem e crie empresas inexistentes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload */}
        <div className="flex flex-wrap items-center gap-4">
          <label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFile}
              className="hidden"
              disabled={loading || importing}
            />
            <Button
              variant="default"
              className="gap-2"
              disabled={loading || importing}
              asChild
            >
              <span>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Carregar Planilha
              </span>
            </Button>
          </label>
          
          <div className="flex items-center gap-2">
            <Switch
              id="dry-run"
              checked={dryRun}
              onCheckedChange={setDryRun}
              disabled={importing}
            />
            <Label htmlFor="dry-run" className="text-sm">
              Modo simulação (não altera banco)
            </Label>
          </div>
          
          <div className="flex items-center gap-2">
            <Switch
              id="resolve-conflicts"
              checked={resolveConflicts}
              onCheckedChange={setResolveConflicts}
              disabled={importing}
            />
            <Label htmlFor="resolve-conflicts" className="text-sm flex items-center gap-1">
              <Shuffle className="h-3 w-3" />
              Resolver conflitos de matrícula
            </Label>
          </div>
        </div>
        
        
        {/* Summary */}
        {parsedEmployers.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" className="gap-1">
                <FileSpreadsheet className="h-3 w-3" />
                {parsedEmployers.length} linhas
              </Badge>
              
              {toCreate.length > 0 && (
                <Badge className="bg-success gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {toCreate.length} para criar
                </Badge>
              )}
              
              {toUpdate.length > 0 && (
                <Badge className="bg-primary gap-1">
                  <RefreshCw className="h-3 w-3" />
                  {toUpdate.length} para atualizar
                </Badge>
              )}
              
              {conflicts.length > 0 && (
                <Badge className="bg-warning text-warning-foreground gap-1">
                  <Shuffle className="h-3 w-3" />
                  {conflicts.length} conflitos
                  {resolveConflicts && <span className="text-xs">(serão realocados)</span>}
                </Badge>
              )}
              
              {invalid.length > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {invalid.length} com erros
                </Badge>
              )}
              
              <div className="ml-auto">
                <Button
                  onClick={handleImport}
                  disabled={importing || (toCreate.length + toUpdate.length + (resolveConflicts ? conflicts.length : 0) === 0)}
                  className="gap-2"
                >
                  {importing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  {dryRun ? 'Simular' : 'Importar'}
                </Button>
              </div>
            </div>
            
            {/* Conflicts warning */}
            {conflicts.length > 0 && !resolveConflicts && (
              <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <p className="font-medium text-sm">
                    {conflicts.length} conflitos de matrícula detectados
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ative "Resolver conflitos de matrícula" para liberar automaticamente as matrículas ocupadas por outras empresas.
                </p>
              </div>
            )}
            
            {/* Progress */}
            {importing && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-sm text-muted-foreground text-center">{progress}%</p>
              </div>
            )}
            
            {/* Results */}
            {results && (
              <div className="space-y-3">
                <div className="bg-muted/50 rounded-lg p-4 grid grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-success">{results.created}</p>
                    <p className="text-xs text-muted-foreground">{dryRun ? 'Seriam criados' : 'Criados'}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-primary">{results.updated}</p>
                    <p className="text-xs text-muted-foreground">{dryRun ? 'Seriam atualizados' : 'Atualizados'}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-warning">{results.reallocated}</p>
                    <p className="text-xs text-muted-foreground">{dryRun ? 'Matrículas realocadas' : 'Realocados'}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-destructive">{results.errors}</p>
                    <p className="text-xs text-muted-foreground">Erros</p>
                  </div>
                </div>
                
                {/* Unique Constraint Errors */}
                {results.uniqueErrors && results.uniqueErrors.length > 0 && (
                  <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Shuffle className="h-4 w-4 text-warning" />
                      <p className="font-medium text-sm text-warning">
                        Conflitos de Matrícula ({results.uniqueErrors.length})
                      </p>
                    </div>
                    <ScrollArea className="h-[80px]">
                      <ul className="text-xs space-y-1 text-muted-foreground">
                        {results.uniqueErrors.slice(0, 20).map((err, idx) => (
                          <li key={idx}>• {err}</li>
                        ))}
                        {results.uniqueErrors.length > 20 && (
                          <li className="font-medium">... e mais {results.uniqueErrors.length - 20}</li>
                        )}
                      </ul>
                    </ScrollArea>
                  </div>
                )}
                
                {/* RLS Errors */}
                {results.rlsErrors && results.rlsErrors.length > 0 && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <p className="font-medium text-sm text-destructive">
                        Erros de Permissão/RLS ({results.rlsErrors.length})
                      </p>
                    </div>
                    <ScrollArea className="h-[80px]">
                      <ul className="text-xs space-y-1 text-destructive/80">
                        {results.rlsErrors.slice(0, 20).map((err, idx) => (
                          <li key={idx}>• {err}</li>
                        ))}
                        {results.rlsErrors.length > 20 && (
                          <li className="font-medium">... e mais {results.rlsErrors.length - 20}</li>
                        )}
                      </ul>
                    </ScrollArea>
                    <p className="text-xs text-muted-foreground mt-2">
                      Verifique se você tem permissão de admin para esta clínica.
                    </p>
                  </div>
                )}
                
                {/* Error Details */}
                {results.errorDetails && results.errorDetails.length > 0 && (
                  <div className="bg-muted border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium text-sm">
                        Outros Erros ({results.errorDetails.length})
                      </p>
                    </div>
                    <ScrollArea className="h-[80px]">
                      <ul className="text-xs space-y-1 text-muted-foreground">
                        {results.errorDetails.slice(0, 20).map((err, idx) => (
                          <li key={idx}>• {err}</li>
                        ))}
                        {results.errorDetails.length > 20 && (
                          <li className="font-medium">... e mais {results.errorDetails.length - 20}</li>
                        )}
                      </ul>
                    </ScrollArea>
                  </div>
                )}
              </div>
            )}
            
            {/* Preview table */}
            <ScrollArea className="h-[400px] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead className="w-24">Planilha</TableHead>
                    <TableHead className="w-24">Banco</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedEmployers.slice(0, 200).map((emp) => (
                    <TableRow 
                      key={emp.rowNumber} 
                      className={
                        emp.status === 'invalid' ? 'bg-destructive/5' :
                        emp.status === 'conflict' ? 'bg-warning/5' :
                        emp.status === 'to_create' ? 'bg-success/5' :
                        'bg-primary/5'
                      }
                    >
                      <TableCell className="text-muted-foreground text-xs">{emp.rowNumber}</TableCell>
                      <TableCell className={`font-mono text-sm ${emp.existingRegistration && formatRegistration(emp.data.id) !== emp.existingRegistration ? 'text-destructive font-bold' : ''}`}>
                        {formatRegistration(emp.data.id)}
                      </TableCell>
                      <TableCell className={`font-mono text-sm ${emp.existingRegistration && formatRegistration(emp.data.id) !== emp.existingRegistration ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                        {emp.existingRegistration || '-'}
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">{emp.data.nome}</TableCell>
                      <TableCell className="font-mono text-xs">{emp.data.cnpj}</TableCell>
                      <TableCell>
                        {emp.status === 'to_create' && (
                          <Badge className="bg-success text-xs">Criar</Badge>
                        )}
                        {emp.status === 'to_update' && (
                          <Badge className="bg-primary text-xs">Atualizar</Badge>
                        )}
                        {emp.status === 'conflict' && (
                          <Badge className="bg-warning text-warning-foreground text-xs">Conflito</Badge>
                        )}
                        {emp.status === 'invalid' && (
                          <Badge variant="destructive" className="text-xs">Inválido</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px]">
                        {emp.errors.length > 0 && (
                          <span className={emp.status === 'conflict' ? 'text-warning' : 'text-destructive'}>
                            {emp.errors.join(', ')}
                          </span>
                        )}
                        {emp.changes && emp.changes.length > 0 && (
                          <span className="text-primary">{emp.changes.join(', ')}</span>
                        )}
                        {emp.status === 'to_create' && emp.errors.length === 0 && (
                          <span className="text-success">Nova empresa</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            
            {parsedEmployers.length > 200 && (
              <p className="text-sm text-muted-foreground text-center">
                Mostrando 200 de {parsedEmployers.length} linhas
              </p>
            )}
          </div>
        )}
        
        {/* Instructions */}
        <div className="bg-muted/50 rounded-lg p-4">
          <h4 className="font-medium text-sm mb-2">Como funciona:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• <strong>ID da planilha</strong> será convertido em <strong>matrícula</strong> (6 dígitos)</li>
            <li>• Empresas são identificadas pelo <strong>CNPJ</strong></li>
            <li>• Se CNPJ existe: atualiza matrícula e dados vazios</li>
            <li>• Se CNPJ não existe: cria nova empresa com todos os dados</li>
            <li>• <strong>Resolver conflitos</strong>: libera matrícula de empresa que está ocupando e atribui à correta</li>
            <li>• Use o <strong>modo simulação</strong> para ver as alterações antes de aplicar</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
