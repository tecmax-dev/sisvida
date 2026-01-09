import { format, isPast, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { QRCodeSVG } from 'qrcode.react';
import { 
  RefreshCw,
  Printer,
  User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PatientCardViewProps {
  card: {
    id: string;
    card_number: string;
    qr_code_token: string;
    issued_at: string;
    expires_at: string;
    is_active: boolean;
    notes: string | null;
  };
  patientName: string;
  patientCpf?: string | null;
  patientPhotoUrl?: string | null;
  patientTag?: string | null;
  clinicName: string;
  clinicLogo?: string | null;
  insurancePlanName?: string | null;
  onRenew?: () => void;
  onPrint?: () => void;
  showActions?: boolean;
}

// Format CPF: 000.000.000-00
const formatCpf = (cpf: string | null | undefined): string => {
  if (!cpf) return '---';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
};

export function PatientCardView({
  card,
  patientName,
  patientCpf,
  patientPhotoUrl,
  patientTag,
  clinicName,
  clinicLogo,
  insurancePlanName,
  onRenew,
  onPrint,
  showActions = true,
}: PatientCardViewProps) {
  const expiresAt = new Date(card.expires_at);
  const isExpired = isPast(expiresAt);
  const daysUntilExpiry = differenceInDays(expiresAt, new Date());
  const isExpiringSoon = !isExpired && daysUntilExpiry <= 30;

  const getExpirationStatus = () => {
    if (!card.is_active) return { label: 'INATIVA', color: 'bg-muted text-muted-foreground' };
    if (isExpired) return { label: 'VENCIDA', color: 'bg-destructive text-destructive-foreground' };
    if (isExpiringSoon) return { label: `VENCE EM ${daysUntilExpiry} DIAS`, color: 'bg-yellow-500 text-white' };
    return { label: 'VÁLIDA', color: 'bg-green-600 text-white' };
  };

  const status = getExpirationStatus();
  const qrCodeUrl = `${window.location.origin}/card/${card.qr_code_token}`;

  return (
    <div className="flex flex-col items-center w-full">
      {/* Card Container - Mobile proportional (9:16 aspect ratio) */}
      <div className="w-full max-w-[360px] bg-card rounded-2xl shadow-xl overflow-hidden border">
        
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-primary to-primary/80 px-5 py-4">
          <div className="flex items-center gap-3">
            {clinicLogo ? (
              <img 
                src={clinicLogo} 
                alt={clinicName} 
                className="h-10 w-10 rounded-lg object-contain bg-white p-1"
              />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                <span className="text-white font-bold text-lg">
                  {clinicName.charAt(0)}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white truncate">{clinicName}</h3>
              <p className="text-xs text-white/80">Carteirinha Digital</p>
            </div>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-5 space-y-4">
          {/* Info Row: CPF, Tag, Card Number + Photo */}
          <div className="flex gap-4">
            {/* Left: CPF, Tag, Card Number */}
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">CPF</p>
                <p className="font-mono text-sm font-medium text-primary">{formatCpf(patientCpf)}</p>
              </div>
              
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Situação</p>
                <p className="text-sm font-medium">{patientTag || insurancePlanName || 'Associado'}</p>
              </div>
              
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Matrícula</p>
                <p className="font-mono text-sm font-semibold">{card.card_number}</p>
              </div>
            </div>

            {/* Right: Photo */}
            <div className="flex-shrink-0">
              <div className="w-24 h-32 rounded-lg border-2 border-muted overflow-hidden bg-muted/30">
                {patientPhotoUrl ? (
                  <img 
                    src={patientPhotoUrl} 
                    alt={patientName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="h-10 w-10 text-muted-foreground/50" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Separator */}
          <div className="border-t border-dashed border-muted-foreground/30" />

          {/* Patient Name */}
          <div className="text-center py-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Nome</p>
            <h2 className="text-lg font-bold text-foreground uppercase tracking-wide leading-tight">
              {patientName}
            </h2>
          </div>

          {/* Expiration Badge */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Validade</p>
            <div className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm",
              status.color
            )}>
              <span>{format(expiresAt, 'dd/MM/yyyy', { locale: ptBR })}</span>
              <span className="text-xs opacity-90">•</span>
              <span className="text-xs">{status.label}</span>
            </div>
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center pt-2">
            <div className="bg-white p-3 rounded-xl shadow-sm">
              <QRCodeSVG
                value={qrCodeUrl}
                size={180}
                level="H"
                includeMargin={false}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Escaneie para validar
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-muted/50 px-5 py-3 border-t">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            {clinicLogo && (
              <img src={clinicLogo} alt="" className="h-4 w-4 object-contain opacity-60" />
            )}
            <span>{clinicName}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons - Outside the card */}
      {showActions && (
        <div className="flex gap-3 mt-4">
          {(isExpired || isExpiringSoon || !card.is_active) && onRenew && (
            <Button onClick={onRenew} size="sm" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Renovar
            </Button>
          )}
          {onPrint && (
            <Button variant="outline" size="sm" onClick={onPrint} className="gap-2">
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
