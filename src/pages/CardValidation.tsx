import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { format, isPast, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Loader2,
  User
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface CardData {
  id: string;
  card_number: string;
  qr_code_token: string;
  expires_at: string;
  issued_at: string;
  is_active: boolean;
  patient: {
    name: string;
    cpf: string | null;
    photo_url: string | null;
    tag: string | null;
    registration_number: string | null;
    insurance_plan: {
      name: string;
    } | null;
  };
  clinic: {
    name: string;
    logo_url: string | null;
  };
}

// Format CPF: 000.000.000-00
const formatCpf = (cpf: string | null | undefined): string => {
  if (!cpf) return '---';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
};

export default function CardValidation() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<CardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetchCard();
    }
  }, [token]);

  const fetchCard = async () => {
    try {
      const { data, error } = await supabase
        .from('patient_cards')
        .select(`
          id,
          card_number,
          qr_code_token,
          expires_at,
          issued_at,
          is_active,
          patient:patients(name, cpf, photo_url, tag, registration_number, insurance_plan:insurance_plans(name)),
          clinic:clinics(name, logo_url)
        `)
        .eq('qr_code_token', token)
        .maybeSingle();

      if (error) {
        setError('Erro ao validar carteirinha. Tente novamente.');
        return;
      }
      
      if (!data) {
        setError('Carteirinha não encontrada ou token inválido.');
        return;
      }
      
      if (!data.patient || !data.clinic) {
        setError('Dados da carteirinha incompletos.');
        return;
      }
      
      setCard(data as unknown as CardData);
    } catch (err) {
      setError('Erro ao validar carteirinha.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
        <div className="w-full max-w-[360px] bg-card rounded-2xl shadow-xl overflow-hidden border">
          <div className="bg-destructive p-6 text-center">
            <XCircle className="h-16 w-16 mx-auto text-white mb-3" />
            <h1 className="text-xl font-bold text-white">Carteirinha Inválida</h1>
          </div>
          <div className="p-6 text-center">
            <p className="text-muted-foreground">
              {error || 'Não foi possível validar esta carteirinha.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const expiresAt = parseISO(card.expires_at);
  const isExpired = isPast(expiresAt);
  const daysUntilExpiry = differenceInDays(expiresAt, new Date());
  const isExpiringSoon = !isExpired && daysUntilExpiry <= 30;
  const isValid = card.is_active && !isExpired;

  const getExpirationStatus = () => {
    if (!card.is_active) return { label: 'INATIVA', color: 'bg-muted text-muted-foreground' };
    if (isExpired) return { label: 'VENCIDA', color: 'bg-destructive text-destructive-foreground' };
    if (isExpiringSoon) return { label: `VENCE EM ${daysUntilExpiry} DIAS`, color: 'bg-yellow-500 text-white' };
    return { label: 'VÁLIDA', color: 'bg-green-600 text-white' };
  };

  const status = getExpirationStatus();
  const qrCodeUrl = `${window.location.origin}/card/${card.qr_code_token}`;

  return (
    <div className={cn(
      "min-h-screen flex items-center justify-center p-4",
      isValid 
        ? "bg-gradient-to-b from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20" 
        : "bg-gradient-to-b from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/20"
    )}>
      {/* Status Banner */}
      <div className={cn(
        "fixed top-0 left-0 right-0 py-3 px-4 text-center text-white font-semibold z-10",
        isValid ? "bg-green-600" : "bg-destructive"
      )}>
        <div className="flex items-center justify-center gap-2">
          {isValid ? (
            <>
              <CheckCircle className="h-5 w-5" />
              <span>CARTEIRINHA VÁLIDA</span>
            </>
          ) : (
            <>
              <XCircle className="h-5 w-5" />
              <span>{!card.is_active ? 'CARTEIRINHA INATIVA' : 'CARTEIRINHA VENCIDA'}</span>
            </>
          )}
        </div>
        {isExpiringSoon && isValid && (
          <p className="text-xs text-white/80 mt-1 flex items-center justify-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Expira em {daysUntilExpiry} dias
          </p>
        )}
      </div>

      {/* Card Container */}
      <div className="w-full max-w-[360px] bg-card rounded-2xl shadow-xl overflow-hidden border mt-16">
        
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-primary to-primary/80 px-5 py-4">
          <div className="flex items-center gap-3">
            {card.clinic.logo_url ? (
              <img 
                src={card.clinic.logo_url} 
                alt={card.clinic.name} 
                className="h-10 w-10 rounded-lg object-contain bg-white p-1"
              />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                <span className="text-white font-bold text-lg">
                  {card.clinic.name.charAt(0)}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white truncate">{card.clinic.name}</h3>
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
                <p className="font-mono text-sm font-medium text-primary">{formatCpf(card.patient.cpf)}</p>
              </div>
              
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Situação</p>
                <p className="text-sm font-medium">
                  {card.patient.tag || card.patient.insurance_plan?.name || 'Associado'}
                </p>
              </div>
              
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Matrícula</p>
                <p className="font-mono text-sm font-semibold">{card.card_number}</p>
              </div>
            </div>

            {/* Right: Photo */}
            <div className="flex-shrink-0">
              <div className="w-24 h-32 rounded-lg border-2 border-muted overflow-hidden bg-muted/30">
                {card.patient.photo_url ? (
                  <img 
                    src={card.patient.photo_url} 
                    alt={card.patient.name}
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
              {card.patient.name}
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
            {card.clinic.logo_url && (
              <img src={card.clinic.logo_url} alt="" className="h-4 w-4 object-contain opacity-60" />
            )}
            <span>{card.clinic.name}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
