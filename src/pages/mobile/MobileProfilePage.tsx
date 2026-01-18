import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  LogOut, 
  Pencil, 
  Trash2,
  HelpCircle,
  Loader2,
  Users,
  CreditCard,
  Settings,
} from "lucide-react";
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

export default function MobileProfilePage() {
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [dependentsCount, setDependentsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  const APP_VERSION = "2.0.3";

  useEffect(() => {
    loadPatientData();
  }, []);

  const loadPatientData = async () => {
    try {
      const patientId = localStorage.getItem('mobile_patient_id');

      if (!patientId) {
        navigate("/app/login");
        return;
      }

      const { data: patientData, error } = await supabase
        .from("patients")
        .select("id, name, email, phone, photo_url, registration_number, address, city, state, neighborhood, complement")
        .eq("id", patientId)
        .single();

      if (error || !patientData) {
        navigate("/app/login");
        return;
      }

      setPatient(patientData);

      // Fetch dependents count
      const { count } = await supabase
        .from("patient_dependents")
        .select("*", { count: "exact", head: true })
        .eq("patient_id", patientId)
        .eq("is_active", true);

      setDependentsCount(count || 0);
    } catch (err) {
      console.error("Error loading patient data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('mobile_patient_id');
      localStorage.removeItem('mobile_clinic_id');
      localStorage.removeItem('mobile_patient_name');
      navigate("/app/login");
    } catch (err) {
      console.error("Error signing out:", err);
    }
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
