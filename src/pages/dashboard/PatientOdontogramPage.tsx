import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { RealisticOdontogram } from "@/components/medical/RealisticOdontogram";

interface Patient {
  id: string;
  name: string;
}

export default function PatientOdontogramPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentClinic } = useAuth();
  const { hasPermission } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<Patient | null>(null);

  const isAdmin = hasPermission('manage_patients');

  useEffect(() => {
    if (!isAdmin) {
      navigate('/dashboard/patients');
      return;
    }
    
    if (currentClinic && id) {
      fetchPatient();
    }
  }, [currentClinic, id, isAdmin]);

  const fetchPatient = async () => {
    if (!currentClinic || !id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('id, name')
        .eq('id', id)
        .eq('clinic_id', currentClinic.id)
        .single();

      if (error) throw error;
      setPatient(data);
    } catch (error) {
      console.error("Error fetching patient:", error);
      navigate('/dashboard/patients');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!patient || !currentClinic) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center gap-4 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/dashboard/patients/${id}`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Odontograma</h1>
            <p className="text-sm text-muted-foreground">{patient.name}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <RealisticOdontogram
          patientId={patient.id}
          clinicId={currentClinic.id}
          readOnly={false}
        />
      </div>
    </div>
  );
}
