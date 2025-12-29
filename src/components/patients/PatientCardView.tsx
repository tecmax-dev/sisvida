import { format, isPast, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { QRCodeSVG } from 'qrcode.react';
import { 
  CreditCard, 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  Printer,
  Download
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  clinicName: string;
  clinicLogo?: string | null;
  onRenew?: () => void;
  onPrint?: () => void;
  showActions?: boolean;
}

export function PatientCardView({
  card,
  patientName,
  clinicName,
  clinicLogo,
  onRenew,
  onPrint,
  showActions = true,
}: PatientCardViewProps) {
  const expiresAt = new Date(card.expires_at);
  const isExpired = isPast(expiresAt);
  const daysUntilExpiry = differenceInDays(expiresAt, new Date());
  const isExpiringSoon = !isExpired && daysUntilExpiry <= 30;

  const getStatusBadge = () => {
    if (!card.is_active) {
      return <Badge variant="secondary" className="gap-1"><XCircle className="h-3 w-3" /> Inativa</Badge>;
    }
    if (isExpired) {
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Vencida</Badge>;
    }
    if (isExpiringSoon) {
      return <Badge className="gap-1 bg-yellow-500 text-white hover:bg-yellow-500/90"><AlertTriangle className="h-3 w-3" /> Vence em {daysUntilExpiry} dias</Badge>;
    }
    return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle className="h-3 w-3" /> Válida</Badge>;
  };

  const qrCodeUrl = `${window.location.origin}/card/${card.qr_code_token}`;

  return (
    <Card className={cn(
      "relative overflow-hidden",
      isExpired && "border-destructive/50 bg-destructive/5",
      isExpiringSoon && !isExpired && "border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20"
    )}>
      {/* Decorative gradient bar */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-2",
        isExpired ? "bg-destructive" : isExpiringSoon ? "bg-yellow-500" : "bg-primary"
      )} />
      
      <CardContent className="p-6 pt-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left side - Card info */}
          <div className="flex-1 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {clinicLogo ? (
                  <img src={clinicLogo} alt={clinicName} className="h-10 w-10 object-contain" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-lg">{clinicName}</h3>
                  <p className="text-sm text-muted-foreground">Carteirinha Digital</p>
                </div>
              </div>
              {getStatusBadge()}
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Paciente</p>
                <p className="font-semibold text-lg">{patientName}</p>
              </div>
              
              <div className="flex gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Número</p>
                  <p className="font-mono font-semibold">{card.card_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Emissão</p>
                  <p className="font-medium">
                    {format(new Date(card.issued_at), 'dd/MM/yyyy', { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Validade</p>
                  <p className={cn(
                    "font-medium",
                    isExpired && "text-destructive",
                    isExpiringSoon && !isExpired && "text-yellow-600 dark:text-yellow-500"
                  )}>
                    {format(expiresAt, 'dd/MM/yyyy', { locale: ptBR })}
                  </p>
                </div>
              </div>

              {card.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Observações</p>
                  <p className="text-sm">{card.notes}</p>
                </div>
              )}
            </div>

            {showActions && (
              <div className="flex gap-2 pt-2">
                {(isExpired || isExpiringSoon) && onRenew && (
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

          {/* Right side - QR Code */}
          <div className="flex flex-col items-center justify-center gap-2 p-4 bg-white rounded-lg">
            <QRCodeSVG
              value={qrCodeUrl}
              size={140}
              level="H"
              includeMargin
              className="rounded"
            />
            <p className="text-xs text-muted-foreground text-center">
              Escaneie para validar
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
