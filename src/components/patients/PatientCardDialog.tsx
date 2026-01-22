import { useState } from 'react';
import { format, addMonths, addYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CreditCard, Calendar, Loader2 } from 'lucide-react';
import { PopupBase, PopupHeader, PopupTitle, PopupFooter } from '@/components/ui/popup-base';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PatientCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
  onSubmit: (data: { patient_id: string; expires_at: string; notes?: string }) => void;
  isLoading?: boolean;
  mode?: 'create' | 'renew';
  currentExpiresAt?: string;
}

export function PatientCardDialog({
  open,
  onOpenChange,
  patientId,
  patientName,
  onSubmit,
  isLoading,
  mode = 'create',
  currentExpiresAt,
}: PatientCardDialogProps) {
  const [validityType, setValidityType] = useState<string>('1year');
  const [customDate, setCustomDate] = useState('');
  const [notes, setNotes] = useState('');

  const calculateExpiryDate = (): string => {
    const now = new Date();
    switch (validityType) {
      case '3months':
        return addMonths(now, 3).toISOString();
      case '6months':
        return addMonths(now, 6).toISOString();
      case '1year':
        return addYears(now, 1).toISOString();
      case '2years':
        return addYears(now, 2).toISOString();
      case 'custom':
        return new Date(customDate).toISOString();
      default:
        return addYears(now, 1).toISOString();
    }
  };

  const handleSubmit = () => {
    if (validityType === 'custom' && !customDate) return;
    
    onSubmit({
      patient_id: patientId,
      expires_at: calculateExpiryDate(),
      notes: notes.trim() || undefined,
    });
  };

  const handleClose = () => {
    setValidityType('1year');
    setCustomDate('');
    setNotes('');
    onOpenChange(false);
  };

  return (
    <PopupBase open={open} onClose={handleClose} maxWidth="md">
      <PopupHeader>
        <PopupTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          {mode === 'create' ? 'Emitir Carteirinha Digital' : 'Renovar Carteirinha'}
        </PopupTitle>
      </PopupHeader>

      <div className="space-y-4 py-4">
        <div>
          <Label className="text-muted-foreground">Paciente</Label>
          <p className="font-medium">{patientName}</p>
        </div>

        {mode === 'renew' && currentExpiresAt && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">Validade atual</p>
            <p className="font-medium">
              {format(new Date(currentExpiresAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label>Validade</Label>
          <Select value={validityType} onValueChange={setValidityType}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a validade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3months">3 meses</SelectItem>
              <SelectItem value="6months">6 meses</SelectItem>
              <SelectItem value="1year">1 ano</SelectItem>
              <SelectItem value="2years">2 anos</SelectItem>
              <SelectItem value="custom">Data personalizada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {validityType === 'custom' && (
          <div className="space-y-2">
            <Label>Data de expiração</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
                className="pl-10"
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>Observações (opcional)</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Informações adicionais sobre a carteirinha..."
            rows={3}
          />
        </div>

        {validityType !== 'custom' && (
          <div className="p-3 bg-primary/10 rounded-lg">
            <p className="text-sm text-muted-foreground">Nova validade</p>
            <p className="font-medium text-primary">
              {format(new Date(calculateExpiryDate()), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
        )}
      </div>

      <PopupFooter>
        <Button variant="outline" onClick={handleClose} disabled={isLoading}>
          Cancelar
        </Button>
        <Button 
          onClick={handleSubmit} 
          disabled={isLoading || (validityType === 'custom' && !customDate)}
        >
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {mode === 'create' ? 'Emitir Carteirinha' : 'Renovar'}
        </Button>
      </PopupFooter>
    </PopupBase>
  );
}
