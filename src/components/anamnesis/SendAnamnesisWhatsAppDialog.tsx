import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { PopupBase, PopupHeader, PopupTitle, PopupDescription, PopupFooter } from "@/components/ui/popup-base";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageCircle, Search, User } from "lucide-react";

type PatientLite = {
  id: string;
  name: string;
  phone: string;
};

interface SendAnamnesisWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
  clinicName: string;
  templateId: string;
  templateTitle: string;
}

export function SendAnamnesisWhatsAppDialog({
  open,
  onOpenChange,
  clinicId,
  clinicName,
  templateId,
  templateTitle,
}: SendAnamnesisWhatsAppDialogProps) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<PatientLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");

  const handleClose = () => onOpenChange(false);

  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId) || null,
    [patients, selectedPatientId]
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
      setPatients([]);
      setSelectedPatientId("");
      setLoading(false);
      setSending(false);
      return;
    }

    const run = async () => {
      setLoading(true);
      try {
        const q = query.trim();

        let req = supabase
          .from("patients")
          .select("id, name, phone")
          .eq("clinic_id", clinicId)
          .order("name")
          .limit(50);

        if (q) {
          req = req.ilike("name", `%${q}%`);
        }

        const { data, error } = await req;
        if (error) throw error;

        setPatients((data || []) as PatientLite[]);
      } catch (error: any) {
        console.error("Error fetching patients:", error);
        toast({
          title: "Erro ao carregar pacientes",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    const t = window.setTimeout(run, 250);
    return () => window.clearTimeout(t);
  }, [open, query, clinicId, toast]);

  const handleSend = async () => {
    if (!selectedPatient || sending) return;

    if (!selectedPatient.phone) {
      toast({
        title: "Paciente sem WhatsApp",
        description: "Cadastre um telefone válido para este paciente antes de enviar.",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const { data: response, error } = await supabase
        .from("anamnese_responses")
        .insert({
          clinic_id: clinicId,
          patient_id: selectedPatient.id,
          template_id: templateId,
        })
        .select("public_token")
        .single();

      if (error) throw error;

      const anamnesisUrl = `${window.location.origin}/anamnese/${response.public_token}`;
      const message =
        `Olá ${selectedPatient.name}! 👋\n\n` +
        `Por favor, preencha seu formulário de anamnese ("${templateTitle}") através do link abaixo:\n\n` +
        `${anamnesisUrl}\n\n` +
        `Atenciosamente,\n${clinicName}`;

      const result = await sendWhatsAppMessage({
        phone: selectedPatient.phone,
        message,
        clinicId,
        type: "custom",
      });

      if (!result.success) {
        throw new Error(result.error || "Falha ao enviar WhatsApp");
      }

      toast({
        title: "Link enviado!",
        description: "A anamnese foi enviada via WhatsApp.",
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao enviar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <PopupBase open={open} onClose={handleClose} maxWidth="lg">
      <PopupHeader>
        <PopupTitle>Enviar anamnese por WhatsApp</PopupTitle>
        <PopupDescription>
          Template: <span className="font-medium">{templateTitle}</span>
        </PopupDescription>
      </PopupHeader>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="patientSearch">Paciente</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="patientSearch"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar paciente pelo nome..."
              className="pl-9"
            />
          </div>
        </div>

        <div className="rounded-lg border">
          <ScrollArea className="h-64">
            {loading ? (
              <div className="p-4 flex items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Carregando...
              </div>
            ) : patients.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">Nenhum paciente encontrado.</div>
            ) : (
              <div className="divide-y divide-border">
                {patients.map((p) => {
                  const active = p.id === selectedPatientId;
                  return (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => setSelectedPatientId(p.id)}
                      className={
                        "w-full text-left px-4 py-3 transition-colors hover:bg-accent/50 " +
                        (active ? "bg-primary/10" : "")
                      }
                    >
                      <div className="flex items-center gap-3">
                        <div className={"p-2 rounded-lg " + (active ? "bg-primary/15" : "bg-muted")}
                        >
                          <User className="h-4 w-4 text-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{p.phone}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      <PopupFooter>
        <Button variant="outline" onClick={handleClose}>
          Cancelar
        </Button>
        <Button onClick={handleSend} disabled={!selectedPatientId || sending}>
          {sending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <MessageCircle className="h-4 w-4 mr-2" />
          )}
          Enviar
        </Button>
      </PopupFooter>
    </PopupBase>
  );
}
