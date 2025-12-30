import { useState, useEffect } from "react";
import { Settings, FileText, Award, ClipboardCheck, Loader2, FileIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useDocumentSettings, DocumentSettings } from "@/hooks/useDocumentSettings";

interface DocumentSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
}

export function DocumentSettingsDialog({
  open,
  onOpenChange,
  clinicId,
}: DocumentSettingsDialogProps) {
  const { settings, loading, saveSettings } = useDocumentSettings(clinicId);
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<DocumentSettings>>({});

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await saveSettings(formData);
    
    if (error) {
      toast({ 
        title: "Erro ao salvar", 
        description: error.message, 
        variant: "destructive" 
      });
    } else {
      toast({ title: "Configurações salvas com sucesso!" });
      onOpenChange(false);
    }
    setSaving(false);
  };

  const updateField = <K extends keyof DocumentSettings>(
    field: K, 
    value: DocumentSettings[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações de Documentos
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="cabecalho" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="cabecalho">Cabeçalho</TabsTrigger>
            <TabsTrigger value="receituario">
              <FileText className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Receituário</span>
            </TabsTrigger>
            <TabsTrigger value="atestado">
              <Award className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Atestado</span>
            </TabsTrigger>
            <TabsTrigger value="comparecimento">
              <ClipboardCheck className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Comparec.</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cabecalho" className="mt-4 space-y-4">
            <div className="space-y-4">
              <h3 className="font-medium text-foreground">Tamanho do Papel</h3>
              
              <RadioGroup
                value={formData.paper_size || 'A4'}
                onValueChange={(value) => updateField('paper_size', value as 'A4' | 'A5')}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="A4" id="paper_a4" />
                  <Label htmlFor="paper_a4" className="flex items-center gap-2 cursor-pointer">
                    <FileIcon className="h-4 w-4" />
                    A4 (210 x 297 mm)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="A5" id="paper_a5" />
                  <Label htmlFor="paper_a5" className="flex items-center gap-2 cursor-pointer">
                    <FileIcon className="h-4 w-4" />
                    A5 (148 x 210 mm)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-4 pt-4 border-t border-border">
              <h3 className="font-medium text-foreground">Exibir no Cabeçalho</h3>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="show_logo">Logo da Clínica</Label>
                <Switch
                  id="show_logo"
                  checked={formData.show_logo ?? true}
                  onCheckedChange={(checked) => updateField('show_logo', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="show_address">Endereço</Label>
                <Switch
                  id="show_address"
                  checked={formData.show_address ?? true}
                  onCheckedChange={(checked) => updateField('show_address', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="show_phone">Telefone</Label>
                <Switch
                  id="show_phone"
                  checked={formData.show_phone ?? true}
                  onCheckedChange={(checked) => updateField('show_phone', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="show_cnpj">CNPJ</Label>
                <Switch
                  id="show_cnpj"
                  checked={formData.show_cnpj ?? true}
                  onCheckedChange={(checked) => updateField('show_cnpj', checked)}
                />
              </div>

              <div>
                <Label>Texto Adicional no Cabeçalho</Label>
                <Textarea
                  value={formData.custom_header_text || ""}
                  onChange={(e) => updateField('custom_header_text', e.target.value || null)}
                  placeholder="Ex: Especialista em Cardiologia | CRM 12345"
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-border">
              <h3 className="font-medium text-foreground">Rodapé</h3>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="show_footer">Exibir Rodapé</Label>
                <Switch
                  id="show_footer"
                  checked={formData.show_footer ?? true}
                  onCheckedChange={(checked) => updateField('show_footer', checked)}
                />
              </div>

              <div>
                <Label>Texto do Rodapé</Label>
                <Input
                  value={formData.footer_text || ""}
                  onChange={(e) => updateField('footer_text', e.target.value)}
                  placeholder="Texto do rodapé..."
                  className="mt-1.5"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="receituario" className="mt-4 space-y-4">
            <div>
              <Label>Título do Documento</Label>
              <Input
                value={formData.prescription_title || "RECEITUÁRIO"}
                onChange={(e) => updateField('prescription_title', e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>Modelo de Prescrição (opcional)</Label>
              <Textarea
                value={formData.prescription_template || ""}
                onChange={(e) => updateField('prescription_template', e.target.value || null)}
                placeholder="Digite um modelo padrão que será sugerido ao criar uma prescrição..."
                className="mt-1.5 min-h-[150px] font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Este texto será sugerido como modelo inicial ao criar uma nova prescrição.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="atestado" className="mt-4 space-y-4">
            <div>
              <Label>Título do Documento</Label>
              <Input
                value={formData.certificate_title || "ATESTADO MÉDICO"}
                onChange={(e) => updateField('certificate_title', e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>Modelo do Atestado</Label>
              <Textarea
                value={formData.certificate_template || ""}
                onChange={(e) => updateField('certificate_template', e.target.value)}
                className="mt-1.5 min-h-[150px]"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Variáveis disponíveis: {"{patient_name}"}, {"{date}"}, {"{days}"}, {"{end_date}"}, {"{cid}"}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="comparecimento" className="mt-4 space-y-4">
            <div>
              <Label>Título do Documento</Label>
              <Input
                value={formData.attendance_title || "DECLARAÇÃO DE COMPARECIMENTO"}
                onChange={(e) => updateField('attendance_title', e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>Modelo da Declaração</Label>
              <Textarea
                value={formData.attendance_template || ""}
                onChange={(e) => updateField('attendance_template', e.target.value)}
                className="mt-1.5 min-h-[150px]"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Variáveis disponíveis: {"{patient_name}"}, {"{date}"}, {"{start_time}"}, {"{end_time}"}
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Configurações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
