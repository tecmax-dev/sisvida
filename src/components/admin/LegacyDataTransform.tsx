import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Upload, 
  FileSpreadsheet, 
  Download, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  Users,
  FileText,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import {
  processLegacyFiles,
  downloadCSV,
  TransformedPatient,
  TransformedMedicalRecord,
} from "@/lib/legacyCsvTransform";

interface LegacyDataTransformProps {
  onPatientsReady?: (patients: TransformedPatient[], csv: string) => void;
  onRecordsReady?: (records: TransformedMedicalRecord[], csv: string) => void;
}

export function LegacyDataTransform({ onPatientsReady, onRecordsReady }: LegacyDataTransformProps) {
  const [pessoaFile, setPessoaFile] = useState<File | null>(null);
  const [prontuarioFile, setProntuarioFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState<{
    totalPessoas: number;
    totalPacientes: number;
    totalProfissionais: number;
    totalProntuarios: number;
    prontuariosVinculados: number;
  } | null>(null);
  const [transformedData, setTransformedData] = useState<{
    patients: TransformedPatient[];
    medicalRecords: TransformedMedicalRecord[];
    patientsCSV: string;
    medicalRecordsCSV: string;
  } | null>(null);

  const handlePessoaFile = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setPessoaFile(file);
      // Reset transformed data when file changes
      setTransformedData(null);
      setStats(null);
    }
    event.target.value = '';
  }, []);

  const handleProntuarioFile = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setProntuarioFile(file);
      // Reset transformed data when file changes
      setTransformedData(null);
      setStats(null);
    }
    event.target.value = '';
  }, []);

  const processFiles = useCallback(async () => {
    if (!pessoaFile || !prontuarioFile) {
      toast.error('Por favor, carregue ambos os arquivos (PESSOA.csv e PRONTUARIO.csv)');
      return;
    }

    setProcessing(true);
    toast.loading('Processando arquivos legados...', { id: 'processing-legacy' });

    try {
      const pessoaContent = await pessoaFile.text();
      const prontuarioContent = await prontuarioFile.text();

      const result = await processLegacyFiles(pessoaContent, prontuarioContent);

      setStats(result.stats);
      setTransformedData({
        patients: result.patients,
        medicalRecords: result.medicalRecords,
        patientsCSV: result.patientsCSV,
        medicalRecordsCSV: result.medicalRecordsCSV,
      });

      toast.dismiss('processing-legacy');
      toast.success(
        `Processamento concluído!`,
        { 
          description: `${result.stats.totalPacientes} pacientes e ${result.stats.prontuariosVinculados} prontuários prontos para importação` 
        }
      );

      // Notify parent if callbacks provided
      if (onPatientsReady) {
        onPatientsReady(result.patients, result.patientsCSV);
      }
      if (onRecordsReady) {
        onRecordsReady(result.medicalRecords, result.medicalRecordsCSV);
      }
    } catch (error) {
      console.error('Error processing legacy files:', error);
      toast.dismiss('processing-legacy');
      toast.error('Erro ao processar arquivos. Verifique o formato.');
    } finally {
      setProcessing(false);
    }
  }, [pessoaFile, prontuarioFile, onPatientsReady, onRecordsReady]);

  const handleDownloadPatients = useCallback(() => {
    if (transformedData?.patientsCSV) {
      downloadCSV(transformedData.patientsCSV, 'pacientes_importacao.csv');
      toast.success('Arquivo de pacientes baixado!');
    }
  }, [transformedData]);

  const handleDownloadRecords = useCallback(() => {
    if (transformedData?.medicalRecordsCSV) {
      downloadCSV(transformedData.medicalRecordsCSV, 'prontuarios_importacao.csv');
      toast.success('Arquivo de prontuários baixado!');
    }
  }, [transformedData]);

  const reset = useCallback(() => {
    setPessoaFile(null);
    setProntuarioFile(null);
    setTransformedData(null);
    setStats(null);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Converter Dados Legados
        </CardTitle>
        <CardDescription>
          Transforme arquivos PESSOA.csv e PRONTUARIO.csv para o formato de importação do sistema.
          Os prontuários serão vinculados automaticamente aos pacientes existentes por CPF ou nome.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* File Upload Section */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* PESSOA.csv */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Arquivo PESSOA.csv
            </label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => document.getElementById('pessoa-file-input')?.click()}
                disabled={processing}
              >
                <Upload className="mr-2 h-4 w-4" />
                {pessoaFile ? pessoaFile.name : 'Selecionar PESSOA.csv'}
              </Button>
              <input
                id="pessoa-file-input"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handlePessoaFile}
              />
              {pessoaFile && (
                <Badge variant="secondary" className="shrink-0">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  OK
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Contém dados de pacientes e profissionais (id, nome, cpf, telefone, etc.)
            </p>
          </div>

          {/* PRONTUARIO.csv */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Arquivo PRONTUARIO.csv
            </label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => document.getElementById('prontuario-file-input')?.click()}
                disabled={processing}
              >
                <Upload className="mr-2 h-4 w-4" />
                {prontuarioFile ? prontuarioFile.name : 'Selecionar PRONTUARIO.csv'}
              </Button>
              <input
                id="prontuario-file-input"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleProntuarioFile}
              />
              {prontuarioFile && (
                <Badge variant="secondary" className="shrink-0">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  OK
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Contém prontuários com referência ao id_cliente (data, descrição, etc.)
            </p>
          </div>
        </div>

        {/* Process Button */}
        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={processFiles}
            disabled={!pessoaFile || !prontuarioFile || processing}
          >
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <ArrowRight className="mr-2 h-4 w-4" />
                Processar e Converter
              </>
            )}
          </Button>
        </div>

        {/* Results Section */}
        {stats && (
          <div className="space-y-4">
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Resultado do Processamento</h4>
              
              {/* Stats Grid */}
              <div className="grid gap-3 md:grid-cols-5">
                <div className="rounded-lg border bg-card p-3 text-center">
                  <div className="text-2xl font-bold">{stats.totalPessoas}</div>
                  <div className="text-xs text-muted-foreground">Total de Registros</div>
                </div>
                <div className="rounded-lg border bg-card p-3 text-center">
                  <div className="text-2xl font-bold text-primary">{stats.totalPacientes}</div>
                  <div className="text-xs text-muted-foreground">Pacientes</div>
                </div>
                <div className="rounded-lg border bg-card p-3 text-center">
                  <div className="text-2xl font-bold text-muted-foreground">{stats.totalProfissionais}</div>
                  <div className="text-xs text-muted-foreground">Profissionais (ignorados)</div>
                </div>
                <div className="rounded-lg border bg-card p-3 text-center">
                  <div className="text-2xl font-bold">{stats.totalProntuarios}</div>
                  <div className="text-xs text-muted-foreground">Prontuários Originais</div>
                </div>
                <div className="rounded-lg border bg-card p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">{stats.prontuariosVinculados}</div>
                  <div className="text-xs text-muted-foreground">Prontuários Vinculados</div>
                </div>
              </div>

              {/* Warning if some records weren't linked */}
              {stats.prontuariosVinculados < stats.totalProntuarios && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0 text-yellow-600 mt-0.5" />
                  <div>
                    <strong>{stats.totalProntuarios - stats.prontuariosVinculados} prontuários</strong> não foram vinculados 
                    (paciente não encontrado ou data inválida).
                  </div>
                </div>
              )}

              {/* Download Buttons */}
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={handleDownloadPatients}
                  disabled={!transformedData?.patientsCSV}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Baixar Pacientes ({stats.totalPacientes})
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadRecords}
                  disabled={!transformedData?.medicalRecordsCSV}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Baixar Prontuários ({stats.prontuariosVinculados})
                </Button>
                <Button
                  variant="ghost"
                  onClick={reset}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Limpar e Recomeçar
                </Button>
              </div>

              {/* Instructions */}
              <div className="mt-4 rounded-lg border bg-muted/30 p-4 text-sm">
                <h5 className="font-medium mb-2">Próximos Passos:</h5>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Baixe os arquivos convertidos acima</li>
                  <li>Primeiro, importe o arquivo de <strong>Pacientes</strong> na aba "Importação Inteligente"</li>
                  <li>Depois, importe o arquivo de <strong>Prontuários</strong> - eles serão vinculados automaticamente aos pacientes pelo CPF ou nome</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
