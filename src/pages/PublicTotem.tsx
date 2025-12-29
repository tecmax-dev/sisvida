import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/Logo";
import { CheckCircle2, Loader2, Smartphone, User } from "lucide-react";
import { toast } from "sonner";

interface Totem {
  id: string;
  clinic_id: string;
  name: string;
  location: string | null;
  queue_id: string | null;
  token: string;
  is_active: boolean;
}

interface Queue {
  id: string;
  name: string;
  queue_type: string;
  display_mode: string;
  ticket_prefix: string;
  current_ticket: number;
}

interface Clinic {
  id: string;
  name: string;
  logo_url: string | null;
}

export default function PublicTotem() {
  const { token } = useParams<{ token: string }>();
  const [totem, setTotem] = useState<Totem | null>(null);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [ticketIssued, setTicketIssued] = useState<{ number: string; queue: string } | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch totem data
  useEffect(() => {
    const fetchTotem = async () => {
      if (!token) {
        setError("Token inválido");
        setLoading(false);
        return;
      }

      try {
        const { data: totemData, error: totemError } = await supabase
          .from("totems")
          .select("*")
          .eq("token", token)
          .eq("is_active", true)
          .maybeSingle();

        if (totemError) throw totemError;

        if (!totemData) {
          setError("Totem não encontrado ou inativo");
          setLoading(false);
          return;
        }

        setTotem(totemData as Totem);

        // Fetch clinic info
        const { data: clinicData } = await supabase
          .from("clinics")
          .select("id, name, logo_url")
          .eq("id", totemData.clinic_id)
          .maybeSingle();

        if (clinicData) {
          setClinic(clinicData as Clinic);
        }

        // Fetch queues
        const { data: queuesData } = await supabase
          .from("queues")
          .select("*")
          .eq("clinic_id", totemData.clinic_id)
          .eq("is_active", true)
          .is("deleted_at", null)
          .order("name");

        if (queuesData) {
          setQueues(queuesData as Queue[]);
        }

        setLoading(false);
      } catch (err) {
        console.error("Erro ao carregar totem:", err);
        setError("Erro ao carregar totem");
        setLoading(false);
      }
    };

    fetchTotem();
  }, [token]);

  const handleCheckIn = async (queue: Queue) => {
    if (checkingIn) return;
    
    setCheckingIn(true);

    try {
      // Get next ticket number
      const nextTicket = (queue.current_ticket || 0) + 1;
      const ticketNumber = `${queue.ticket_prefix}${nextTicket}`;

      // Update queue ticket counter
      const { error: updateError } = await supabase
        .from("queues")
        .update({ current_ticket: nextTicket })
        .eq("id", queue.id);

      if (updateError) throw updateError;

      // Create queue call entry (waiting status)
      const { error: entryError } = await supabase
        .from("queue_calls")
        .insert({
          clinic_id: totem!.clinic_id,
          queue_id: queue.id,
          ticket_number: nextTicket,
          ticket_prefix: queue.ticket_prefix,
          status: "waiting",
          checked_in_at: new Date().toISOString(),
        });

      if (entryError) throw entryError;

      // Show ticket
      setTicketIssued({ number: ticketNumber, queue: queue.name });

      // Reset after 5 seconds
      setTimeout(() => {
        setTicketIssued(null);
      }, 5000);
    } catch (err) {
      console.error("Erro ao fazer check-in:", err);
      toast.error("Erro ao emitir senha. Tente novamente.");
    } finally {
      setCheckingIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary to-primary/80 flex items-center justify-center">
        <div className="text-white text-xl flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin" />
          Carregando...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary to-primary/80 flex flex-col items-center justify-center gap-4">
        <Smartphone className="h-16 w-16 text-white/50" />
        <div className="text-white text-2xl">{error}</div>
        <p className="text-white/70">Verifique se o link está correto</p>
      </div>
    );
  }

  // Ticket issued confirmation screen
  if (ticketIssued) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-600 to-green-500 flex flex-col items-center justify-center gap-8 p-8">
        <CheckCircle2 className="h-24 w-24 text-white" />
        <div className="text-center">
          <div className="text-white/80 text-2xl mb-2">Sua senha é</div>
          <div className="text-white text-[8rem] font-bold leading-none">{ticketIssued.number}</div>
          <div className="text-white/80 text-xl mt-4">{ticketIssued.queue}</div>
        </div>
        <div className="text-white/70 text-lg">Aguarde ser chamado no painel</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary to-primary/80 flex flex-col">
      {/* Header */}
      <div className="p-8 text-center border-b border-white/10">
        {clinic?.logo_url ? (
          <img src={clinic.logo_url} alt={clinic.name} className="h-16 mx-auto object-contain" />
        ) : (
          <div className="flex justify-center">
            <Logo size="lg" />
          </div>
        )}
        <h1 className="text-white text-3xl font-bold mt-4">{clinic?.name || "Bem-vindo"}</h1>
        <p className="text-white/80 text-lg mt-2">Selecione o tipo de atendimento</p>
      </div>

      {/* Queue Selection */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {queues.length === 0 ? (
          <div className="text-center">
            <User className="h-16 w-16 text-white/50 mx-auto mb-4" />
            <div className="text-white/80 text-xl">Nenhuma fila disponível no momento</div>
          </div>
        ) : (
          <div className="grid gap-6 max-w-2xl w-full">
            {queues.map((queue) => (
              <Button
                key={queue.id}
                onClick={() => handleCheckIn(queue)}
                disabled={checkingIn}
                className="h-24 text-2xl bg-white hover:bg-white/90 text-primary font-bold rounded-2xl shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {checkingIn ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : (
                  queue.name
                )}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 text-center text-white/60 text-sm border-t border-white/10">
        <div className="text-white text-2xl font-mono mb-2">
          {currentTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </div>
        {totem?.location && <div>{totem.location}</div>}
      </div>
    </div>
  );
}
