import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  ArrowRight, 
  FileSpreadsheet,
  Wand2,
} from "lucide-react";
import { UploadStep } from "./UploadStep";
import { ConversionTypeStep, ConversionType, ConversionSubType } from "./ConversionTypeStep";
import { MappingStep } from "./MappingStep";
import { ValidationStep } from "./ValidationStep";
import { ResultStep } from "./ResultStep";
import { LytexConverterTab } from "./LytexConverterTab";
import { LytexLayout } from "@/lib/spreadsheet-converter/lytex-layouts";

interface FieldMapping {
  sourceColumn: string;
  targetField: string;
  transform?: string;
}

type WizardStep = 'upload' | 'type' | 'mapping' | 'validation' | 'result';

const STEPS: { key: WizardStep; label: string }[] = [
  { key: 'upload', label: 'Upload' },
  { key: 'type', label: 'Tipo' },
  { key: 'mapping', label: 'Mapeamento' },
  { key: 'validation', label: 'Validação' },
  { key: 'result', label: 'Resultado' },
];

export function SpreadsheetConverter() {
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
  const [activeTab, setActiveTab] = useState<'wizard' | 'lytex'>('wizard');
  
  // Data state
  const [fileData, setFileData] = useState<{
    headers: string[];
    rows: Record<string, unknown>[];
    fileName: string;
    sheetNames: string[];
  } | null>(null);
  
  const [conversionType, setConversionType] = useState<ConversionType | null>(null);
  const [conversionSubType, setConversionSubType] = useState<ConversionSubType | null>(null);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [validRows, setValidRows] = useState<Record<string, unknown>[]>([]);
  const [invalidRowsCount, setInvalidRowsCount] = useState(0);

  const handleFileLoaded = useCallback((data: typeof fileData) => {
    setFileData(data);
  }, []);

  const handleTypeSelect = useCallback((type: ConversionType, subType?: ConversionSubType) => {
    setConversionType(type);
    setConversionSubType(subType || null);
  }, []);

  const handleValidationComplete = useCallback((valid: Record<string, unknown>[], invalid: number) => {
    setValidRows(valid);
    setInvalidRowsCount(invalid);
  }, []);

  const handleLytexConvert = useCallback((converted: Record<string, unknown>[], layout: LytexLayout) => {
    setValidRows(converted);
    setInvalidRowsCount(0);
    setConversionType('lytex');
    setMappings(layout.fields.map(f => ({
      sourceColumn: f.sourceColumns[0],
      targetField: f.targetField,
      transform: f.transform,
    })));
    setCurrentStep('result');
    setActiveTab('wizard');
  }, []);

  const handleReset = useCallback(() => {
    setCurrentStep('upload');
    setFileData(null);
    setConversionType(null);
    setConversionSubType(null);
    setMappings([]);
    setValidRows([]);
    setInvalidRowsCount(0);
  }, []);

  const currentStepIndex = STEPS.findIndex(s => s.key === currentStep);
  
  const canGoNext = () => {
    switch (currentStep) {
      case 'upload': return fileData !== null;
      case 'type': return conversionType !== null;
      case 'mapping': return mappings.length > 0;
      case 'validation': return validRows.length > 0;
      default: return false;
    }
  };

  const goNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].key);
    }
  };

  const goPrev = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].key);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Conversor de Planilhas
          </CardTitle>
          <CardDescription>
            Converta planilhas de sistemas externos para o formato interno do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'wizard' | 'lytex')}>
            <TabsList className="mb-6">
              <TabsTrigger value="wizard">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Conversão Guiada
              </TabsTrigger>
              <TabsTrigger value="lytex">
                <Wand2 className="h-4 w-4 mr-2" />
                Relatórios Lytex
              </TabsTrigger>
            </TabsList>

            <TabsContent value="wizard">
              {/* Step Indicator */}
              <div className="flex items-center justify-center gap-2 mb-8">
                {STEPS.map((step, index) => (
                  <div key={step.key} className="flex items-center">
                    <div
                      className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                        index < currentStepIndex
                          ? 'bg-primary text-primary-foreground'
                          : index === currentStepIndex
                          ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <span className={`ml-2 text-sm hidden sm:inline ${
                      index === currentStepIndex ? 'font-medium' : 'text-muted-foreground'
                    }`}>
                      {step.label}
                    </span>
                    {index < STEPS.length - 1 && (
                      <div className="w-8 h-px bg-border mx-2" />
                    )}
                  </div>
                ))}
              </div>

              {/* Step Content */}
              <div className="min-h-[400px]">
                {currentStep === 'upload' && (
                  <UploadStep 
                    onFileLoaded={handleFileLoaded}
                    currentFile={fileData?.fileName}
                  />
                )}
                
                {currentStep === 'type' && (
                  <ConversionTypeStep
                    selectedType={conversionType}
                    selectedSubType={conversionSubType}
                    onTypeSelect={handleTypeSelect}
                  />
                )}
                
                {currentStep === 'mapping' && fileData && conversionType && (
                  <MappingStep
                    headers={fileData.headers}
                    conversionType={conversionType}
                    conversionSubType={conversionSubType}
                    mappings={mappings}
                    onMappingsChange={setMappings}
                  />
                )}
                
                {currentStep === 'validation' && fileData && conversionType && (
                  <ValidationStep
                    rows={fileData.rows}
                    mappings={mappings}
                    conversionType={conversionType}
                    onValidationComplete={handleValidationComplete}
                  />
                )}
                
                {currentStep === 'result' && (
                  <ResultStep
                    validRows={validRows}
                    invalidRowsCount={invalidRowsCount}
                    mappings={mappings}
                    conversionType={conversionType || 'lytex'}
                    fileName={fileData?.fileName || 'arquivo'}
                    onReset={handleReset}
                  />
                )}
              </div>

              {/* Navigation */}
              {currentStep !== 'result' && (
                <div className="flex justify-between mt-8 pt-6 border-t">
                  <Button
                    variant="outline"
                    onClick={goPrev}
                    disabled={currentStepIndex === 0}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Anterior
                  </Button>
                  
                  <Button
                    onClick={goNext}
                    disabled={!canGoNext()}
                  >
                    Próximo
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="lytex">
              <LytexConverterTab
                headers={fileData?.headers || []}
                rows={fileData?.rows || []}
                onConvert={handleLytexConvert}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
