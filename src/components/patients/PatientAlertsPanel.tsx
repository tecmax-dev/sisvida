import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  Ban, 
  CreditCard, 
  CalendarX, 
  Loader2, 
  Phone, 
  RefreshCw,
  AlertTriangle,
  ChevronRight,
  ChevronDown
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface BlockedPatient {
  id: string;
  name: string;
  phone: string;
  no_show_blocked_until: string;
  no_show_blocked_at: string;
  professional_name: string;
}

interface ExpiredCardPatient {
  id: string;
  name: string;
  phone: string;
  card_number: string;
  expires_at: string;
  days_expired: number;
}

interface LimitReachedPatient {
  id: string;
  name: string;
  phone: string;
  professional_name: string;
  appointment_count: number;
  max_appointments: number;
}

export function PatientAlertsPanel() {
  const { currentClinic } = useAuth();
  const navigate = useNavigate();
  
  const [blockedPatients, setBlockedPatients] = useState<BlockedPatient[]>([]);
  const [expiredCardPatients, setExpiredCardPatients] = useState<ExpiredCardPatient[]>([]);
  const [limitPatients, setLimitPatients] = useState<LimitReachedPatient[]>([]);
  
  const [loadingBlocked, setLoadingBlocked] = useState(true);
  const [loadingExpired, setLoadingExpired] = useState(true);
  const [loadingLimit, setLoadingLimit] = useState(true);
  
  const [activeTab, setActiveTab] = useState("blocked");
  const [isOpen, setIsOpen] = useState(false);

  const fetchBlockedPatients = useCallback(async () => {
    if (!currentClinic) return;
    setLoadingBlocked(true);
    
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('patients')
        .select(`
          id,
          name,
          phone,
          no_show_blocked_until,
          no_show_blocked_at,
          no_show_blocked_professional_id,
          professionals:no_show_blocked_professional_id (name)
        `)
        .eq('clinic_id', currentClinic.id)
        .eq('is_active', true)
        .not('no_show_blocked_until', 'is', null)
        .is('no_show_unblocked_at', null)
        .gte('no_show_blocked_until', today);

      if (error) throw error;

      const mapped = (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        phone: p.phone || '',
        no_show_blocked_until: p.no_show_blocked_until,
        no_show_blocked_at: p.no_show_blocked_at,
        professional_name: p.professionals?.name || 'Profissional não identificado'
      }));

      setBlockedPatients(mapped);
    } catch (error) {
      console.error('Error fetching blocked patients:', error);
    } finally {
      setLoadingBlocked(false);
    }
  }, [currentClinic]);

  const fetchExpiredCardPatients = useCallback(async () => {
    if (!currentClinic) return;
    setLoadingExpired(true);
    
    try {
      const today = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('patient_cards')
        .select(`
          id,
          card_number,
          expires_at,
          patient:patients!inner (
            id,
            name,
            phone,
            is_active
          )
        `)
        .eq('clinic_id', currentClinic.id)
        .eq('is_active', true)
        .eq('patient.is_active', true)
        .lt('expires_at', today)
        .order('expires_at', { ascending: true });

      if (error) throw error;

      const mapped = (data || []).map((c: any) => {
        const expiresDate = parseISO(c.expires_at);
        const todayDate = new Date();
        const diffTime = todayDate.getTime() - expiresDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return {
          id: c.patient.id,
          name: c.patient.name,
          phone: c.patient.phone || '',
          card_number: c.card_number,
          expires_at: c.expires_at,
          days_expired: diffDays
        };
      });

      setExpiredCardPatients(mapped);
    } catch (error) {
      console.error('Error fetching expired card patients:', error);
    } finally {
      setLoadingExpired(false);
    }
  }, [currentClinic]);

  const fetchLimitReachedPatients = useCallback(async () => {
    if (!currentClinic) return;
    setLoadingLimit(true);
    
    try {
      // Get clinic's max appointments per CPF
      const { data: clinicData } = await supabase
        .from('clinics')
        .select('max_appointments_per_cpf_month')
        .eq('id', currentClinic.id)
        .single();

      const maxAppointments = clinicData?.max_appointments_per_cpf_month || 0;
      
      if (maxAppointments === 0) {
        setLimitPatients([]);
        setLoadingLimit(false);
        return;
      }

      // Get current month boundaries
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      // Get appointments grouped by patient and professional
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select(`
          patient_id,
          professional_id,
          patients!inner (id, name, phone, is_active),
          professionals!inner (name)
        `)
        .eq('clinic_id', currentClinic.id)
        .eq('patients.is_active', true)
        .is('dependent_id', null)
        .gte('appointment_date', monthStart)
        .lte('appointment_date', monthEnd)
        .not('status', 'in', '("cancelled","no_show")');

      if (error) throw error;

      // Group by patient + professional
      const countMap = new Map<string, {
        patient_id: string;
        patient_name: string;
        patient_phone: string;
        professional_name: string;
        count: number;
      }>();

      (appointments || []).forEach((apt: any) => {
        const key = `${apt.patient_id}:${apt.professional_id}`;
        if (!countMap.has(key)) {
          countMap.set(key, {
            patient_id: apt.patient_id,
            patient_name: apt.patients.name,
            patient_phone: apt.patients.phone || '',
            professional_name: apt.professionals.name,
            count: 0
          });
        }
        const entry = countMap.get(key)!;
        entry.count++;
      });

      // Filter only those who reached the limit
      const limitReached = Array.from(countMap.values())
        .filter(entry => entry.count >= maxAppointments)
        .map(entry => ({
          id: entry.patient_id,
          name: entry.patient_name,
          phone: entry.patient_phone,
          professional_name: entry.professional_name,
          appointment_count: entry.count,
          max_appointments: maxAppointments
        }));

      setLimitPatients(limitReached);
    } catch (error) {
      console.error('Error fetching limit reached patients:', error);
    } finally {
      setLoadingLimit(false);
    }
  }, [currentClinic]);

  useEffect(() => {
    if (currentClinic) {
      fetchBlockedPatients();
      fetchExpiredCardPatients();
      fetchLimitReachedPatients();
    }
  }, [currentClinic, fetchBlockedPatients, fetchExpiredCardPatients, fetchLimitReachedPatients]);

  const handleRefresh = () => {
    fetchBlockedPatients();
    fetchExpiredCardPatients();
    fetchLimitReachedPatients();
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const renderPatientRow = (patient: { id: string; name: string; phone: string }, extraContent: React.ReactNode) => (
    <div 
      key={patient.id}
      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
      onClick={() => navigate(`/dashboard/patients/${patient.id}`)}
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{patient.name}</p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Phone className="h-3 w-3" />
          <span>{formatPhone(patient.phone)}</span>
        </div>
        {extraContent}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    </div>
  );

  const totalAlerts = blockedPatients.length + expiredCardPatients.length + limitPatients.length;

  // Don't show panel if no alerts
  if (!loadingBlocked && !loadingExpired && !loadingLimit && totalAlerts === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-muted bg-muted/30">
        <CollapsibleTrigger asChild>
          <CardHeader className="py-2 px-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium text-muted-foreground">Alertas de Pacientes</span>
                </div>
                
                {/* Compact badges when collapsed */}
                <div className="flex items-center gap-1.5">
                  {blockedPatients.length > 0 && (
                    <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                      <Ban className="h-3 w-3 mr-1" />
                      {blockedPatients.length}
                    </Badge>
                  )}
                  {expiredCardPatients.length > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-amber-500/20 text-amber-700 border-amber-200">
                      <CreditCard className="h-3 w-3 mr-1" />
                      {expiredCardPatients.length}
                    </Badge>
                  )}
                  {limitPatients.length > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                      <CalendarX className="h-3 w-3 mr-1" />
                      {limitPatients.length}
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 w-7 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRefresh();
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 pb-3 px-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3 mb-3 h-8">
                <TabsTrigger value="blocked" className="flex items-center gap-1.5 text-xs h-7">
                  <Ban className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Bloqueados</span>
                  {blockedPatients.length > 0 && (
                    <Badge variant="destructive" className="ml-1 h-4 px-1 text-xs">
                      {blockedPatients.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="expired" className="flex items-center gap-1.5 text-xs h-7">
                  <CreditCard className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Carteira</span>
                  {expiredCardPatients.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs bg-amber-500/20 text-amber-700">
                      {expiredCardPatients.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="limit" className="flex items-center gap-1.5 text-xs h-7">
                  <CalendarX className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Limite</span>
                  {limitPatients.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                      {limitPatients.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="blocked" className="space-y-1.5 mt-0">
                {loadingBlocked ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : blockedPatients.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    <Ban className="h-8 w-8 mx-auto mb-1 opacity-30" />
                    <p>Nenhum paciente bloqueado</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                    {blockedPatients.map((patient) => 
                      renderPatientRow(patient, (
                        <div className="mt-0.5">
                          <p className="text-xs text-destructive">
                            Bloqueado até {format(new Date(patient.no_show_blocked_until), "dd/MM/yyyy", { locale: ptBR })} • {patient.professional_name}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="expired" className="space-y-1.5 mt-0">
                {loadingExpired ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : expiredCardPatients.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    <CreditCard className="h-8 w-8 mx-auto mb-1 opacity-30" />
                    <p>Nenhuma carteirinha vencida</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                    {expiredCardPatients.map((patient) => 
                      renderPatientRow(patient, (
                        <div className="mt-0.5">
                          <p className="text-xs text-amber-600">
                            Vencida há {patient.days_expired} dia{patient.days_expired !== 1 ? 's' : ''} • {patient.card_number}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="limit" className="space-y-1.5 mt-0">
                {loadingLimit ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : limitPatients.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    <CalendarX className="h-8 w-8 mx-auto mb-1 opacity-30" />
                    <p>Nenhum paciente atingiu o limite</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                    {limitPatients.map((patient, idx) => 
                      renderPatientRow({ ...patient, id: `${patient.id}-${idx}` }, (
                        <div className="mt-0.5">
                          <p className="text-xs text-blue-600">
                            {patient.appointment_count}/{patient.max_appointments} este mês • {patient.professional_name}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
