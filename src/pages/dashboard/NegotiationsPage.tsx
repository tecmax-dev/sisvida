import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { FeatureGate } from "@/components/features/FeatureGate";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Settings, List, Handshake } from "lucide-react";
import { toast } from "sonner";

import NegotiationsListTab from "@/components/negotiations/NegotiationsListTab";
import NegotiationSettingsTab from "@/components/negotiations/NegotiationSettingsTab";
import NewNegotiationDialog from "@/components/negotiations/NewNegotiationDialog";

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  trade_name: string | null;
}

interface Negotiation {
  id: string;
  negotiation_code: string;
  status: string;
  employer_id: string;
  total_original_value: number;
  total_interest: number;
  total_monetary_correction: number;
  total_late_fee: number;
  total_negotiated_value: number;
  down_payment_value: number;
  down_payment_due_date: string | null;
  installments_count: number;
  installment_value: number;
  first_due_date: string;
  applied_interest_rate: number;
  applied_correction_rate: number;
  applied_late_fee_rate: number;
  approved_at: string | null;
  approved_by: string | null;
  approval_method: string | null;
  approval_notes: string | null;
  finalized_at: string | null;
  finalized_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  created_at: string;
  employers?: Employer;
}

function NegotiationsContent() {
  const { currentClinic, user } = useAuth();
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("list");
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [selectedNegotiation, setSelectedNegotiation] = useState<Negotiation | null>(null);

  useEffect(() => {
    if (currentClinic?.id) {
      fetchData();
    }
  }, [currentClinic?.id]);

  const fetchData = async () => {
    if (!currentClinic?.id) return;
    setLoading(true);
    
    try {
      // Fetch negotiations
      const { data: negotiationsData, error: negotiationsError } = await supabase
        .from("debt_negotiations")
        .select(`
          *,
          employers (id, name, cnpj, trade_name)
        `)
        .eq("clinic_id", currentClinic.id)
        .order("created_at", { ascending: false });

      if (negotiationsError) throw negotiationsError;
      setNegotiations((negotiationsData || []) as unknown as Negotiation[]);

      // Fetch employers
      const { data: employersData, error: employersError } = await supabase
        .from("employers")
        .select("id, name, cnpj, trade_name")
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true)
        .order("name");

      if (employersError) throw employersError;
      setEmployers(employersData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleViewNegotiation = (negotiation: Negotiation) => {
    setSelectedNegotiation(negotiation);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
            <Handshake className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Negociações de Débitos
            </h1>
            <p className="text-sm text-muted-foreground">
              Gerencie acordos de parcelamento de contribuições em atraso
            </p>
          </div>
        </div>
        <RoleGuard permission="manage_financials">
          <Button onClick={() => setIsNewDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Negociação
          </Button>
        </RoleGuard>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="list" className="gap-2 data-[state=active]:bg-background">
            <List className="h-4 w-4" />
            Negociações
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2 data-[state=active]:bg-background">
            <Settings className="h-4 w-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-6">
          <NegotiationsListTab
            negotiations={negotiations}
            onViewNegotiation={handleViewNegotiation}
            onRefresh={fetchData}
          />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <RoleGuard permission="manage_settings">
            <NegotiationSettingsTab clinicId={currentClinic?.id || ""} />
          </RoleGuard>
        </TabsContent>
      </Tabs>

      <NewNegotiationDialog
        open={isNewDialogOpen}
        onOpenChange={setIsNewDialogOpen}
        employers={employers}
        clinicId={currentClinic?.id || ""}
        userId={user?.id || ""}
        onSuccess={() => {
          fetchData();
          setIsNewDialogOpen(false);
        }}
      />
    </div>
  );
}

export default function NegotiationsPage() {
  return (
    <FeatureGate feature="employer_contributions">
      <NegotiationsContent />
    </FeatureGate>
  );
}