import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  LogOut, 
  Pencil, 
  Trash2,
  HelpCircle,
  Loader2,
  Bell,
  BellOff,
  CheckCircle2,
} from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { PushDiagnostics } from "@/components/push/PushDiagnostics";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useMobileAuth } from "@/contexts/MobileAuthContext";
import { clearBootstrapCache } from "@/mobileBootstrap";
import { clearSession } from "@/hooks/useMobileSession";

interface PatientData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  registration_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  complement: string | null;
}

/**
 * PROFILE PAGE - SEM VERIFICAÇÃO DE SESSÃO
 * 
 * A SplashScreen já decidiu que o usuário está logado.
 * Esta página apenas carrega e exibe os dados.
 * O logout é o ÚNICO local que encerra sessão.
 */
export default function MobileProfilePage() {
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [dependentsCount, setDependentsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Hook de autenticação - usado para obter IDs e logout
  const { patientId, clinicId, logout } = useMobileAuth();

  // Hook de notificações push
  const {
    isNative,
    effectiveClinicId,
    isWebPushSupported,
    isWebPushSubscribed,
    isWebPushLoading,
    subscribeToWebPush,
  } = usePushNotifications({ patientId, clinicId });

  const APP_VERSION = "2.0.4";

  // Carregar dados quando patientId estiver disponível
  useEffect(() => {
    if (patientId) {
      loadPatientData(patientId);
    }
  }, [patientId]);

  const loadPatientData = async (id: string) => {
    try {
      const { data: patientData, error } = await supabase
        .from("patients")
        .select("id, name, email, phone, photo_url, registration_number, address, city, state, neighborhood, complement")
        .eq("id", id)
        .single();

      if (error || !patientData) {
        console.error("[MobileProfile] Erro ao carregar paciente:", error);
        return;
      }

      setPatient(patientData);

      // Fetch dependents count
      const { count } = await supabase
        .from("patient_dependents")
        .select("*", { count: "exact", head: true })
        .eq("patient_id", id)
        .eq("is_active", true);

      setDependentsCount(count || 0);
    } catch (err) {
      console.error("Error loading patient data:", err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * LOGOUT EXPLÍCITO - Único ponto de encerramento de sessão
   * Limpa Supabase JWT + localStorage + IndexedDB + bootstrap cache
   * Faz HARD RELOAD para garantir estado limpo
   * 
   * INSTRUMENTADO: Log detalhado com stack trace
   */
  const handleSignOut = async () => {
    // AUDITORIA: Este é o ÚNICO logout legítimo do app mobile
    console.warn("[MobileProfile] LOGOUT EXPLÍCITO INICIADO", {
      timestamp: new Date().toISOString(),
      patientId,
      trigger: "Botão 'Sair da conta' clicado pelo usuário",
    });
    
    try {
      // 1. Limpar sessão Supabase
      await supabase.auth.signOut({ scope: 'local' });
      console.warn("[MobileProfile] supabase.auth.signOut() executado");
    } catch (err) {
      console.warn("[MobileProfile] Erro no signOut Supabase:", err);
    }
    
    // 2. Limpar localStorage/IndexedDB
    await clearSession();
    console.warn("[MobileProfile] clearSession() executado");
    
    // 3. Limpar cache do bootstrap
    clearBootstrapCache();
    console.warn("[MobileProfile] clearBootstrapCache() executado");
    
    // 4. Hard reload para login - garante estado completamente limpo
    console.warn("[MobileProfile] Redirecionando para login com hard reload...");
    window.location.href = "/app/login";
  };

  const handleDeleteAccountRequest = () => {
    toast({
      title: "Solicitação enviada",
      description: "Sua solicitação de exclusão foi enviada. O sindicato entrará em contato.",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const firstName = patient?.name?.split(" ")[0] || "";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-emerald-600 text-white px-4 py-4 flex items-center justify-between">
        <button onClick={() => navigate("/app")} className="p-1">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-semibold">Perfil</h1>
        <button className="p-1">
          <HelpCircle className="h-6 w-6" />
        </button>
      </div>

      {/* Profile Section */}
      <div className="bg-emerald-600 text-white pb-8 pt-4 text-center">
        <div className="w-24 h-24 rounded-full overflow-hidden mx-auto border-4 border-white/30 mb-4">
          {patient?.photo_url ? (
            <img 
              src={patient.photo_url} 
              alt={patient.name} 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-emerald-400 flex items-center justify-center text-white font-bold text-3xl">
              {firstName.charAt(0)}
            </div>
          )}
        </div>
        <h2 className="text-xl font-bold">{patient?.name?.toUpperCase()}</h2>
        <p className="text-sm opacity-90">{patient?.email}</p>
      </div>

      {/* Actions and Stats */}
      <div className="bg-white rounded-t-3xl -mt-4 p-6">
        <div className="flex items-center justify-center gap-4 mb-6">
          <Button 
            variant="outline" 
            className="flex items-center gap-2 border-emerald-600 text-emerald-600"
            onClick={() => {
              toast({
                title: "Editar perfil",
                description: "Funcionalidade em desenvolvimento.",
              });
            }}
          >
            <Pencil className="h-4 w-4" />
            Editar perfil
          </Button>
          <Button 
            variant="ghost" 
            className="flex items-center gap-2 text-red-600"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sair da conta
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{dependentsCount}</p>
            <p className="text-xs text-muted-foreground">Dependentes</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">
              {patient?.registration_number || "-"}
            </p>
            <p className="text-xs text-muted-foreground">Minha matrícula</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{APP_VERSION}</p>
            <p className="text-xs text-muted-foreground">Versão do app</p>
          </div>
        </div>

        <Separator className="mb-6" />

        {/* Push Notifications Section */}
        {!isNative && isWebPushSupported && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Notificações</h3>
            {isWebPushSubscribed ? (
              <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-emerald-900">Notificações ativas</p>
                  <p className="text-sm text-emerald-700">Você receberá avisos importantes do sindicato</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 border-emerald-600 text-emerald-700"
                    onClick={subscribeToWebPush}
                    disabled={isWebPushLoading}
                  >
                    {isWebPushLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Reconfigurando...
                      </>
                    ) : (
                      'Reconfigurar notificações'
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <BellOff className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-amber-900">Notificações desativadas</p>
                  <p className="text-sm text-amber-700 mb-2">Ative para receber avisos importantes</p>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={subscribeToWebPush}
                    disabled={isWebPushLoading}
                  >
                    {isWebPushLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Ativando...
                      </>
                    ) : (
                      <>
                        <Bell className="h-4 w-4 mr-2" />
                        Ativar Notificações
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
            
            {/* Diagnostic Tool */}
            <PushDiagnostics patientId={patientId} clinicId={effectiveClinicId} />
          </div>
        )}

        {/* User Data */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Meus dados</h3>
          
          {patient?.address && (
            <div>
              <p className="text-xs text-muted-foreground">Endereço</p>
              <p className="font-medium text-foreground">{patient.address}</p>
            </div>
          )}

          {patient?.neighborhood && (
            <div>
              <p className="text-xs text-muted-foreground">Bairro</p>
              <p className="font-medium text-foreground">{patient.neighborhood}</p>
            </div>
          )}

          {(patient?.city || patient?.state) && (
            <div>
              <p className="text-xs text-muted-foreground">Cidade - UF</p>
              <p className="font-medium text-foreground">
                {[patient.city, patient.state].filter(Boolean).join(" - ")}
              </p>
            </div>
          )}

          {patient?.complement && (
            <div>
              <p className="text-xs text-muted-foreground">Complemento</p>
              <p className="font-medium text-foreground">{patient.complement}</p>
            </div>
          )}
        </div>

        <Separator className="my-6" />

        {/* Delete Account */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              variant="ghost" 
              className="w-full flex items-center justify-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Solicitar exclusão da conta
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Solicitar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Ao solicitar a exclusão, todos os seus dados serão removidos permanentemente. 
                Esta ação não pode ser desfeita. O sindicato entrará em contato para confirmar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteAccountRequest}
                className="bg-red-600 hover:bg-red-700"
              >
                Solicitar exclusão
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
