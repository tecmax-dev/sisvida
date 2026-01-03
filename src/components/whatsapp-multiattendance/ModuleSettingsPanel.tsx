import { useEffect, useState } from 'react';
import { useWhatsAppModuleSettings } from '@/hooks/useWhatsAppMultiattendance';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';

interface ModuleSettingsPanelProps {
  clinicId: string | undefined;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
];

export function ModuleSettingsPanel({ clinicId }: ModuleSettingsPanelProps) {
  const { settings, isLoading, updateSettings } = useWhatsAppModuleSettings(clinicId);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    is_enabled: true,
    working_hours_enabled: true,
    working_hours_start: '08:00',
    working_hours_end: '18:00',
    working_days: [1, 2, 3, 4, 5],
    offline_message: 'Nosso atendimento está fora do horário. Deixe sua mensagem que retornaremos em breve.',
    welcome_message: 'Olá! Bem-vindo ao nosso atendimento. Em que podemos ajudar?',
    transfer_message: 'Você está sendo transferido para outro atendente. Por favor, aguarde.',
    close_message: 'Atendimento finalizado. Obrigado por entrar em contato!',
    auto_close_hours: 24,
    bot_overrides_human: false,
    show_operator_name: true,
    show_operator_avatar: true,
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        is_enabled: settings.is_enabled,
        working_hours_enabled: settings.working_hours_enabled,
        working_hours_start: settings.working_hours_start,
        working_hours_end: settings.working_hours_end,
        working_days: settings.working_days,
        offline_message: settings.offline_message,
        welcome_message: settings.welcome_message,
        transfer_message: settings.transfer_message,
        close_message: settings.close_message,
        auto_close_hours: settings.auto_close_hours,
        bot_overrides_human: settings.bot_overrides_human,
        show_operator_name: settings.show_operator_name,
        show_operator_avatar: settings.show_operator_avatar,
      });
    }
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings(formData);
    } catch (error) {
      // Error handled in hook
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDay = (day: number) => {
    setFormData(prev => ({
      ...prev,
      working_days: prev.working_days.includes(day)
        ? prev.working_days.filter(d => d !== day)
        : [...prev.working_days, day].sort(),
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Geral */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações Gerais</CardTitle>
          <CardDescription>
            Configure o comportamento geral do módulo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Módulo Ativo</Label>
              <p className="text-sm text-muted-foreground">
                Ativar ou desativar o multiatendimento
              </p>
            </div>
            <Switch
              checked={formData.is_enabled}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_enabled: checked }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>IA Sobrepõe Humano</Label>
              <p className="text-sm text-muted-foreground">
                Se ativo, a IA continua respondendo mesmo com operador atribuído
              </p>
            </div>
            <Switch
              checked={formData.bot_overrides_human}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, bot_overrides_human: checked }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Mostrar Nome do Operador</Label>
              </div>
              <Switch
                checked={formData.show_operator_name}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, show_operator_name: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Mostrar Avatar do Operador</Label>
              </div>
              <Switch
                checked={formData.show_operator_avatar}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, show_operator_avatar: checked }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Fechar Tickets Automaticamente (horas)</Label>
            <Input
              type="number"
              min={1}
              max={168}
              value={formData.auto_close_hours}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                auto_close_hours: parseInt(e.target.value) || 24 
              }))}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              Tickets inativos serão fechados após este período
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Horário de Atendimento */}
      <Card>
        <CardHeader>
          <CardTitle>Horário de Atendimento</CardTitle>
          <CardDescription>
            Configure os dias e horários de funcionamento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Usar Horário de Atendimento</Label>
              <p className="text-sm text-muted-foreground">
                Mostrar mensagem offline fora do expediente
              </p>
            </div>
            <Switch
              checked={formData.working_hours_enabled}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, working_hours_enabled: checked }))}
            />
          </div>

          {formData.working_hours_enabled && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Início</Label>
                  <Input
                    type="time"
                    value={formData.working_hours_start}
                    onChange={(e) => setFormData(prev => ({ ...prev, working_hours_start: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fim</Label>
                  <Input
                    type="time"
                    value={formData.working_hours_end}
                    onChange={(e) => setFormData(prev => ({ ...prev, working_hours_end: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Dias de Atendimento</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <Button
                      key={day.value}
                      type="button"
                      variant={formData.working_days.includes(day.value) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleDay(day.value)}
                    >
                      {day.label.slice(0, 3)}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Mensagens Automáticas */}
      <Card>
        <CardHeader>
          <CardTitle>Mensagens Automáticas</CardTitle>
          <CardDescription>
            Configure as mensagens enviadas automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Mensagem de Boas-vindas</Label>
            <Textarea
              value={formData.welcome_message}
              onChange={(e) => setFormData(prev => ({ ...prev, welcome_message: e.target.value }))}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Mensagem Fora do Horário</Label>
            <Textarea
              value={formData.offline_message}
              onChange={(e) => setFormData(prev => ({ ...prev, offline_message: e.target.value }))}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Mensagem de Transferência</Label>
            <Textarea
              value={formData.transfer_message}
              onChange={(e) => setFormData(prev => ({ ...prev, transfer_message: e.target.value }))}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Mensagem de Encerramento</Label>
            <Textarea
              value={formData.close_message}
              onChange={(e) => setFormData(prev => ({ ...prev, close_message: e.target.value }))}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Salvar */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
