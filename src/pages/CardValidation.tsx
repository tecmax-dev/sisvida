import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { format, isPast, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  CreditCard,
  Loader2,
  Building2,
  User,
  Calendar
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CardData {
  id: string;
  card_number: string;
  expires_at: string;
  issued_at: string;
  is_active: boolean;
  patient: {
    name: string;
    insurance_plan: {
      name: string;
    } | null;
  };
  clinic: {
    name: string;
    logo_url: string | null;
  };
}

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
      console.log('Buscando carteirinha com token:', token);
      
      const { data, error } = await supabase
        .from('patient_cards')
        .select(`
          id,
          card_number,
          expires_at,
          issued_at,
          is_active,
          patient:patients(name, insurance_plan:insurance_plans(name)),
          clinic:clinics(name, logo_url)
        `)
        .eq('qr_code_token', token)
        .maybeSingle();

      console.log('Resultado da busca:', { data, error });

      if (error) {
        console.error('Erro ao buscar carteirinha:', error);
        setError('Erro ao validar carteirinha. Tente novamente.');
        return;
      }
      
      if (!data) {
        setError('Carteirinha não encontrada ou token inválido.');
        return;
      }
      
      // Validar que os relacionamentos retornaram dados
      if (!data.patient || !data.clinic) {
        console.error('Dados incompletos:', data);
        setError('Dados da carteirinha incompletos.');
        return;
      }
      
      setCard(data as unknown as CardData);
    } catch (err: any) {
      console.error('Erro inesperado:', err);
      setError('Erro ao validar carteirinha.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <XCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
            <h1 className="text-2xl font-bold mb-2">Carteirinha Inválida</h1>
            <p className="text-muted-foreground">
              {error || 'Não foi possível validar esta carteirinha.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const expiresAt = new Date(card.expires_at);
  const isExpired = isPast(expiresAt);
  const daysUntilExpiry = differenceInDays(expiresAt, new Date());
  const isExpiringSoon = !isExpired && daysUntilExpiry <= 30;
  const isValid = card.is_active && !isExpired;

  return (
    <div className={cn(
      "min-h-screen flex items-center justify-center p-4",
      isValid ? "bg-green-50 dark:bg-green-950/20" : "bg-destructive/10"
    )}>
      <Card className="max-w-lg w-full overflow-hidden">
        {/* Status Header */}
        <div className={cn(
          "p-6 text-center text-white",
          isValid ? "bg-green-600" : "bg-destructive"
        )}>
          {isValid ? (
            <>
              <CheckCircle className="h-16 w-16 mx-auto mb-3" />
              <h1 className="text-2xl font-bold">Carteirinha Válida</h1>
              {isExpiringSoon && (
                <p className="text-green-100 mt-2 flex items-center justify-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Expira em {daysUntilExpiry} dias
                </p>
              )}
            </>
          ) : (
            <>
              <XCircle className="h-16 w-16 mx-auto mb-3" />
              <h1 className="text-2xl font-bold">
                {!card.is_active ? 'Carteirinha Inativa' : 'Carteirinha Vencida'}
              </h1>
              {isExpired && (
                <p className="text-red-100 mt-2">
                  Venceu em {format(expiresAt, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              )}
            </>
          )}
        </div>

        {/* Card Details */}
        <CardContent className="p-6 space-y-6">
          {/* Clinic Info */}
          <div className="flex items-center gap-4">
            {card.clinic.logo_url ? (
              <img 
                src={card.clinic.logo_url} 
                alt={card.clinic.name}
                className="h-12 w-12 object-contain"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Clínica</p>
              <p className="font-semibold text-lg">{card.clinic.name}</p>
            </div>
          </div>

          {/* Patient Info */}
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-sm text-muted-foreground">Paciente</p>
              <p className="font-semibold text-lg">{card.patient.name}</p>
              {card.patient.insurance_plan?.name && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mt-1">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-sm font-medium text-primary">{card.patient.insurance_plan.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Card Details Grid */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Número</p>
                <p className="font-mono font-semibold">{card.card_number}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Emissão</p>
                <p className="font-medium">
                  {format(new Date(card.issued_at), 'dd/MM/yyyy', { locale: ptBR })}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 col-span-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Validade</p>
                <p className={cn(
                  "font-semibold",
                  isExpired && "text-destructive",
                  isExpiringSoon && !isExpired && "text-yellow-600"
                )}>
                  {format(expiresAt, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex justify-center pt-4">
            <Badge 
              variant={isValid ? "default" : "destructive"}
              className={cn(
                "text-base px-6 py-2",
                isValid && "bg-green-600"
              )}
            >
              {isValid ? 'CARTEIRINHA VÁLIDA' : (isExpired ? 'CARTEIRINHA VENCIDA' : 'CARTEIRINHA INATIVA')}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
