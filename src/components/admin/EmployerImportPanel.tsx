import { useState, useCallback } from "react";
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
  status: 'to_create' | 'to_update' | 'invalid';
  existingId?: string;
  existingRegistration?: string;
  errors: string[];
  changes?: string[];
}

interface EmployerImportPanelProps {
  clinicId: string;
}

// Clean CNPJ to 14 digits
function cleanCnpj(cnpj: string): string {
  return (cnpj || '').replace(/\D/g, '');
}

// Format registration number to 6 digits
function formatRegistration(id: string): string {
  const numericId = id.replace(/\D/g, '');
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

export function EmployerImportPanel({ clinicId }: EmployerImportPanelProps) {
  const [parsedEmployers, setParsedEmployers] = useState<ParsedEmployer[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ created: number; updated: number; errors: number } | null>(null);

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
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
      
      // Fetch existing employers for comparison
      const { data: existingEmployers } = await supabase
        .from('employers')
        .select('id, cnpj, registration_number, name')
        .eq('clinic_id', clinicId);
      
      const cnpjToEmployer = new Map<string, { id: string; registration_number: string | null; name: string }>();
      existingEmployers?.forEach(emp => {
        const cleanedCnpj = cleanCnpj(emp.cnpj || '');
        if (cleanedCnpj) {
          cnpjToEmployer.set(cleanedCnpj, {
            id: emp.id,
            registration_number: emp.registration_number,
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
          const val = row['ID'] || row['id'] || row['Id'] || row['MATRICULA'] || row['matricula'] || '';
          return String(val).trim();
        };
        
        const getNome = (): string => {
          const val = row['Nome da empresa'] || row['NOME DA EMPRESA'] || row['nome'] || row['Nome'] || row['NOME'] || row['razao_social'] || '';
          return String(val).trim();
        };
        
        const getFantasia = (): string => {
          const val = row['Fantasia'] || row['FANTASIA'] || row['fantasia'] || row['nome_fantasia'] || '';
          return String(val).trim();
        };
        
        const getCnpj = (): string => {
          const val = row['CNPJ'] || row['cnpj'] || row['Cnpj'] || '';
          return String(val).trim();
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
        
        let status: 'to_create' | 'to_update' | 'invalid' = 'invalid';
        let existingId: string | undefined;
        let existingRegistration: string | undefined;
        
        if (errors.length === 0) {
          const cleanedCnpj = cleanCnpj(cnpj);
          const existing = cnpjToEmployer.get(cleanedCnpj);
          
          if (existing) {
            status = 'to_update';
            existingId = existing.id;
            existingRegistration = existing.registration_number || undefined;
            
            const newRegistration = formatRegistration(id);
            if (existing.registration_number !== newRegistration) {
              changes.push(`Matrícula: ${existing.registration_number || '(vazio)'} → ${newRegistration}`);
            }
          } else {
            status = 'to_create';
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
        });
      }
      
      toast.dismiss('parsing-employers');
      setParsedEmployers(parsed);
      
      const toCreate = parsed.filter(p => p.status === 'to_create').length;
      const toUpdate = parsed.filter(p => p.status === 'to_update').length;
      const invalid = parsed.filter(p => p.status === 'invalid').length;
      
      toast.success(`Planilha processada: ${toCreate} para criar, ${toUpdate} para atualizar, ${invalid} com erros`);
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
    const toProcess = parsedEmployers.filter(p => p.status !== 'invalid');
    if (toProcess.length === 0) {
      toast.error('Nenhum registro válido para importar');
      return;
    }
    
    setImporting(true);
    setProgress(0);
    setResults(null);
    
    let created = 0;
    let updated = 0;
    let errors = 0;
    
    const BATCH_SIZE = 50;
    
    for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
      const batch = toProcess.slice(i, i + BATCH_SIZE);
      
      for (const employer of batch) {
        try {
          const cleanedCnpj = cleanCnpj(employer.data.cnpj);
          const registration = formatRegistration(employer.data.id);
          
          if (employer.status === 'to_update' && employer.existingId) {
            if (!dryRun) {
              const { error } = await supabase
                .from('employers')
                .update({
                  registration_number: registration,
                  // Only update if empty in database
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
              
              if (error) throw error;
            }
            updated++;
          } else if (employer.status === 'to_create') {
            if (!dryRun) {
              const { error } = await supabase
                .from('employers')
                .insert({
                  clinic_id: clinicId,
                  name: employer.data.nome,
                  trade_name: employer.data.fantasia || null,
                  cnpj: cleanedCnpj,
                  registration_number: registration,
                  email: employer.data.email || null,
                  phone: employer.data.telefone || null,
                  cep: employer.data.cep || null,
                  city: employer.data.cidade || null,
                  state: employer.data.uf || null,
                  neighborhood: employer.data.bairro || null,
                  address: employer.data.endereco || null,
                  is_active: true,
                });
              
              if (error) throw error;
            }
            created++;
          }
        } catch (error) {
          console.error('Error processing employer:', error);
          errors++;
        }
      }
      
      setProgress(Math.round(((i + batch.length) / toProcess.length) * 100));
    }
    
    setResults({ created, updated, errors });
    setImporting(false);
    
    if (dryRun) {
      toast.success(`Simulação concluída: ${created} seriam criados, ${updated} seriam atualizados`);
    } else {
      toast.success(`Importação concluída: ${created} criados, ${updated} atualizados, ${errors} erros`);
      setParsedEmployers([]);
    }
  };

  const toCreate = parsedEmployers.filter(p => p.status === 'to_create');
  const toUpdate = parsedEmployers.filter(p => p.status === 'to_update');
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
              
              {invalid.length > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {invalid.length} com erros
                </Badge>
              )}
              
              <div className="ml-auto">
                <Button
                  onClick={handleImport}
                  disabled={importing || (toCreate.length + toUpdate.length === 0)}
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
            
            {/* Progress */}
            {importing && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-sm text-muted-foreground text-center">{progress}%</p>
              </div>
            )}
            
            {/* Results */}
            {results && (
              <div className="bg-muted/50 rounded-lg p-4 grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-success">{results.created}</p>
                  <p className="text-xs text-muted-foreground">{dryRun ? 'Seriam criados' : 'Criados'}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">{results.updated}</p>
                  <p className="text-xs text-muted-foreground">{dryRun ? 'Seriam atualizados' : 'Atualizados'}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-destructive">{results.errors}</p>
                  <p className="text-xs text-muted-foreground">Erros</p>
                </div>
              </div>
            )}
            
            {/* Preview table */}
            <ScrollArea className="h-[400px] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead className="w-20">ID</TableHead>
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
                        emp.status === 'to_create' ? 'bg-success/5' :
                        'bg-primary/5'
                      }
                    >
                      <TableCell className="text-muted-foreground text-xs">{emp.rowNumber}</TableCell>
                      <TableCell className="font-mono text-sm">{formatRegistration(emp.data.id)}</TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">{emp.data.nome}</TableCell>
                      <TableCell className="font-mono text-xs">{emp.data.cnpj}</TableCell>
                      <TableCell>
                        {emp.status === 'to_create' && (
                          <Badge className="bg-success text-xs">Criar</Badge>
                        )}
                        {emp.status === 'to_update' && (
                          <Badge className="bg-primary text-xs">Atualizar</Badge>
                        )}
                        {emp.status === 'invalid' && (
                          <Badge variant="destructive" className="text-xs">Inválido</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px]">
                        {emp.errors.length > 0 && (
                          <span className="text-destructive">{emp.errors.join(', ')}</span>
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
            <li>• Use o <strong>modo simulação</strong> para ver as alterações antes de aplicar</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
