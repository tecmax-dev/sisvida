import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Monitor, Volume2, VolumeX } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { PanelBannerCarousel } from "@/components/panel/PanelBannerCarousel";
import { PanelBanner } from "@/hooks/usePanelBanners";

interface Panel {
  id: string;
  clinic_id: string;
  name: string;
  token: string;
  is_active: boolean;
}

interface Clinic {
  id: string;
  name: string;
  logo_url: string | null;
}

interface QueueCall {
  id: string;
  queue_id: string;
  patient_name: string;
  ticket_number: string;
  called_at: string;
  status: string;
  queue?: {
    name: string;
    display_mode: string;
  };
}

export default function PublicPanel() {
  const { token } = useParams<{ token: string }>();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [currentCall, setCurrentCall] = useState<QueueCall | null>(null);
  const [recentCalls, setRecentCalls] = useState<QueueCall[]>([]);
  const [banners, setBanners] = useState<PanelBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch panel, clinic and calls via backend function (bypasses public DB restrictions)
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!token) {
        setError("Token inválido");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data, error: fnError } = await supabase.functions.invoke("public-panel-data", {
          body: { token },
        });

        if (fnError) throw fnError;

        if (!data?.panel) {
          setError(data?.error || "Painel não encontrado ou inativo");
          return;
        }

        if (cancelled) return;

        setPanel(data.panel as Panel);
        setClinic((data.clinic ?? null) as Clinic | null);
        setCurrentCall((data.currentCall ?? null) as QueueCall | null);
        setRecentCalls((data.recentCalls ?? []) as QueueCall[]);
        setBanners((data.banners ?? []) as PanelBanner[]);
      } catch (err) {
        console.error("Erro ao carregar painel:", err);
        if (!cancelled) setError("Erro ao carregar painel");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    // Simple polling for updates (TV mode) - avoids realtime/RLS issues
    const interval = setInterval(load, 8000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token]);

  const formatDisplayName = (call: QueueCall) => {
    const displayMode = call.queue?.display_mode || "ticket";
    
    switch (displayMode) {
      case "name":
        return call.patient_name;
      case "initials":
        return call.patient_name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 3);
      case "ticket":
      default:
        return call.ticket_number;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-white text-xl">Carregando painel...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center justify-center gap-4">
        <Monitor className="h-16 w-16 text-slate-500" />
        <div className="text-white text-2xl">{error}</div>
        <p className="text-slate-400">Verifique se o link está correto</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col">
      {/* Header */}
      <div className="p-6 flex items-center justify-between border-b border-slate-700">
        <div className="flex items-center gap-4">
          {clinic?.logo_url ? (
            <img src={clinic.logo_url} alt={clinic.name} className="h-12 object-contain" />
          ) : (
            <Logo size="md" />
          )}
          <div className="text-white text-xl font-medium">{clinic?.name || "Painel de Chamadas"}</div>
        </div>
        <div className="flex items-center gap-6">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="text-slate-400 hover:text-white transition-colors p-2"
            title={soundEnabled ? "Desativar som" : "Ativar som"}
          >
            {soundEnabled ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
          </button>
          <div className="text-white text-3xl font-mono">
            {currentTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Current Call or Banner Carousel - Main Area */}
        <div className="flex-1 flex flex-col items-center justify-center p-12 relative">
          {currentCall ? (
            <>
              <div className="text-slate-400 text-2xl mb-4">Chamando agora</div>
              <div className="text-white text-[12rem] font-bold leading-none animate-pulse">
                {formatDisplayName(currentCall)}
              </div>
              {currentCall.queue?.display_mode !== "name" && (
                <div className="text-slate-300 text-4xl mt-6">{currentCall.patient_name}</div>
              )}
              <div className="text-primary text-3xl mt-4 font-medium">
                {currentCall.queue?.name || "Atendimento"}
              </div>
            </>
          ) : banners.length > 0 ? (
            <PanelBannerCarousel banners={banners} className="absolute inset-0" />
          ) : (
            <div className="text-center">
              <Monitor className="h-24 w-24 text-slate-600 mx-auto mb-6" />
              <div className="text-slate-400 text-3xl">Aguardando chamadas...</div>
            </div>
          )}
        </div>

        {/* Recent Calls - Sidebar */}
        {recentCalls.length > 0 && (
          <div className="w-96 border-l border-slate-700 bg-slate-800/50 p-6">
            <div className="text-slate-400 text-lg mb-4">Chamadas anteriores</div>
            <div className="space-y-3">
              {recentCalls.map((call) => (
                <div
                  key={call.id}
                  className="bg-slate-700/50 rounded-lg p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="text-white text-xl font-bold">{formatDisplayName(call)}</div>
                    <div className="text-slate-400 text-sm">{call.queue?.name}</div>
                  </div>
                  <div className="text-slate-500 text-sm">
                    {new Date(call.called_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 text-center text-slate-500 text-sm border-t border-slate-700">
        {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </div>
    </div>
  );
}
