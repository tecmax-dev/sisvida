import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Monitor, Volume2, VolumeX, Stethoscope, Heart, Baby, Brain, Eye, Bone, Activity } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { PanelBannerCarousel } from "@/components/panel/PanelBannerCarousel";
import { PanelBanner } from "@/hooks/usePanelBanners";

const ToothIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 5.6C10.4 4 8.2 3.4 6.4 4.1 4.3 4.9 3 6.9 3 9.3c0 4.1 2.1 5.6 2.6 9.2.3 2 1.4 3.1 2.4 3.1 1.2 0 1.6-1.1 2-3 .3-1.3.8-2.1 2-2.1s1.7.8 2 2.1c.4 1.9.8 3 2 3 1 0 2.1-1.1 2.4-3.1.5-3.6 2.6-5.1 2.6-9.2 0-2.4-1.3-4.4-3.4-5.2-1.8-.7-4-.1-5.6 1.5z" />
  </svg>
);

const getSpecialtyIcon = (specialty?: string | null) => {
  const s = (specialty || "").toLowerCase();
  if (s.includes("cardio")) return Heart;
  if (s.includes("pediat")) return Baby;
  if (s.includes("neuro") || s.includes("psic")) return Brain;
  if (s.includes("oftalmo")) return Eye;
  if (s.includes("ortoped") || s.includes("reumato")) return Bone;
  if (s.includes("odonto") || s.includes("dent")) return ToothIcon;
  if (s.includes("fisio") || s.includes("nutri")) return Activity;
  return Stethoscope;
};

// Play a notification chime using Web Audio API
const playNotificationChime = (): Promise<void> => {
  return new Promise((resolve) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioCtx.currentTime;

      // "Ding-dong" hospital-style bell
      const playBell = (freq: number, start: number, dur: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = freq;
        osc.type = 'triangle';
        gain.gain.setValueAtTime(0.5, start);
        gain.gain.exponentialRampToValueAtTime(0.005, start + dur);
        osc.start(start);
        osc.stop(start + dur);
      };

      // Classic two-tone "ding-dong"
      playBell(950, now, 0.5);
      playBell(630, now + 0.5, 0.7);

      setTimeout(() => {
        resolve();
      }, 800);
    } catch {
      resolve();
    }
  });
};

// Text-to-speech function for call announcements
const speakCallAnnouncement = async (text: string) => {
  // Play chime first
  await playNotificationChime();

  if ('speechSynthesis' in window) {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    // Try to use a Portuguese voice if available
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find(voice => voice.lang.startsWith('pt'));
    if (ptVoice) {
      utterance.voice = ptVoice;
    }
    
    window.speechSynthesis.speak(utterance);
  }
};

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
  professional_name?: string | null;
  professional_specialty?: string | null;
  room_name?: string | null;
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

  const lastCallIdRef = useRef<string | null>(null);
  const hasInitializedRef = useRef(false);

  const audioUnlockedRef = useRef(false);

  // Unlock audio context on first user interaction
  const unlockAudio = useCallback(() => {
    if (audioUnlockedRef.current) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      ctx.resume().then(() => ctx.close());
      audioUnlockedRef.current = true;
    } catch {}
  }, []);

  // Load voices for TTS
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Play sound and announce when new call arrives
  const announceCall = useCallback((call: QueueCall) => {
    if (!soundEnabled) return;
    
    const displayMode = call.queue?.display_mode || "ticket";
    const destination = call.room_name || call.professional_name || call.queue?.name || "atendimento";
    let announcement = "";
    
    switch (displayMode) {
      case "name":
        announcement = `Chamando ${call.patient_name}. Por favor, dirija-se ao ${destination}.`;
        break;
      case "initials":
        const initials = call.patient_name
          .split(" ")
          .map((n) => n[0])
          .join(" ")
          .toUpperCase()
          .slice(0, 5);
        announcement = `Chamando ${initials}. Por favor, dirija-se ao ${destination}.`;
        break;
      case "ticket":
      default:
        announcement = `Senha ${call.ticket_number}. Por favor, dirija-se ao ${destination}.`;
        break;
    }
    
    speakCallAnnouncement(announcement);
  }, [soundEnabled]);

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

        const newCurrentCall = (data.currentCall ?? null) as QueueCall | null;
        
        // Check if there's a new call to announce
        if (newCurrentCall && newCurrentCall.id !== lastCallIdRef.current) {
          // Only announce if we've already initialized (not on first load)
          if (hasInitializedRef.current) {
            announceCall(newCurrentCall);
          }
          lastCallIdRef.current = newCurrentCall.id;
        }
        
        hasInitializedRef.current = true;

        setPanel(data.panel as Panel);
        setClinic((data.clinic ?? null) as Clinic | null);
        setCurrentCall(newCurrentCall);
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
  }, [token, announceCall]);

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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600 text-xl">Carregando painel...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <Monitor className="h-16 w-16 text-slate-400" />
        <div className="text-slate-800 text-2xl font-medium">{error}</div>
        <p className="text-slate-500">Verifique se o link está correto</p>
      </div>
    );
  }

  return (
    <div
      className="h-screen flex flex-col bg-slate-50 overflow-hidden"
      style={{ height: "100dvh" }}
    >
      {/* Header */}
      <div className="shrink-0 px-4 sm:px-8 py-2 sm:py-5 flex items-center justify-between bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          {clinic?.logo_url ? (
            <img
              src={clinic.logo_url}
              alt={clinic.name}
              className="h-8 sm:h-12 object-contain max-w-[40vw]"
            />
          ) : (
            <Logo size="md" />
          )}
          <div className="text-slate-800 text-base sm:text-xl font-semibold truncate">
            {clinic?.name || "Painel de Chamadas"}
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-6 shrink-0">
          <button
            onClick={() => { unlockAudio(); setSoundEnabled(!soundEnabled); }}
            className="text-slate-400 hover:text-slate-700 transition-colors p-1.5 sm:p-2 rounded-full hover:bg-slate-100"
            title={soundEnabled ? "Desativar som" : "Ativar som"}
          >
            {soundEnabled ? <Volume2 className="h-5 w-5 sm:h-6 sm:w-6" /> : <VolumeX className="h-5 w-5 sm:h-6 sm:w-6" />}
          </button>
          <div className="text-slate-800 text-2xl sm:text-3xl font-semibold tabular-nums">
            {currentTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 flex flex-col xl:flex-row">
        {/* Current Call or Banner Carousel - Main Area */}
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-4 sm:p-8 xl:p-12 relative overflow-hidden">
          {currentCall ? (
            <>
              <div className="text-primary text-base sm:text-2xl font-semibold tracking-wide uppercase mb-2 sm:mb-4 shrink-0">
                Chamando agora
              </div>
              <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-slate-200 px-5 sm:px-16 py-5 sm:py-10 flex flex-col items-center max-w-full min-h-0">
                <div className="text-slate-900 font-bold leading-none animate-pulse text-[clamp(2.5rem,16vmin,11rem)]">
                  {formatDisplayName(currentCall)}
                </div>
                {currentCall.queue?.display_mode !== "name" && currentCall.patient_name && (
                  <div className="text-slate-700 text-xl sm:text-3xl xl:text-5xl font-semibold mt-3 sm:mt-6 text-center break-words max-w-full">
                    {currentCall.patient_name}
                  </div>
                )}
                {currentCall.professional_name && (
                  <div className="mt-3 sm:mt-6 flex items-center justify-center gap-2 sm:gap-3 bg-primary/10 border border-primary/20 rounded-xl sm:rounded-2xl px-4 sm:px-8 py-2 sm:py-4 max-w-full">
                    {(() => {
                      const Icon = getSpecialtyIcon(currentCall.professional_specialty);
                      return <Icon className="h-6 w-6 sm:h-10 sm:w-10 text-primary shrink-0" />;
                    })()}
                    <div className="text-left min-w-0">
                      <div className="text-primary text-lg sm:text-3xl xl:text-4xl font-bold leading-tight truncate max-w-full">
                        {currentCall.professional_name}
                      </div>
                      {currentCall.professional_specialty && (
                        <div className="text-slate-500 text-xs sm:text-lg xl:text-xl font-medium truncate max-w-full">
                          {currentCall.professional_specialty}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="mt-4 sm:mt-8 flex flex-wrap items-center justify-center gap-2 sm:gap-4">
                  {currentCall.room_name && (
                    <div className="bg-emerald-100 text-emerald-700 text-lg sm:text-2xl xl:text-3xl font-bold px-4 sm:px-8 py-1.5 sm:py-3 rounded-full">
                      {currentCall.room_name}
                    </div>
                  )}
                  {!currentCall.professional_name && !currentCall.room_name && (
                    <div className="bg-primary/10 text-primary text-lg sm:text-2xl xl:text-3xl font-semibold px-4 sm:px-8 py-1.5 sm:py-3 rounded-full">
                      {currentCall.queue?.name || "Atendimento"}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : banners.length > 0 ? (
            <PanelBannerCarousel banners={banners} className="absolute inset-0" />
          ) : (
            <div className="text-center">
              <div className="bg-white rounded-full p-4 sm:p-8 shadow-md border border-slate-200 inline-block mb-4 sm:mb-6">
                <Monitor className="h-10 w-10 sm:h-20 sm:w-20 text-primary/60" />
              </div>
              <div className="text-slate-500 text-xl sm:text-3xl">Aguardando chamadas...</div>
            </div>
          )}
        </div>

        {/* Recent Calls - Sidebar */}
        {recentCalls.length > 0 && (
          <div className="w-full xl:w-96 shrink-0 max-h-[32vh] xl:max-h-none border-t xl:border-t-0 xl:border-l border-slate-200 bg-white p-4 sm:p-6 overflow-y-auto">
            <div className="text-slate-500 text-base sm:text-lg font-medium mb-3 sm:mb-4">Chamadas anteriores</div>
            <div className="space-y-2 sm:space-y-3">
              {recentCalls.map((call) => (
                <div
                  key={call.id}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-slate-800 text-lg sm:text-xl font-bold truncate">{formatDisplayName(call)}</div>
                    <div className="text-slate-500 text-xs sm:text-sm truncate">
                      {call.professional_name || call.room_name || call.queue?.name}
                    </div>
                  </div>
                  <div className="text-slate-400 text-xs sm:text-sm tabular-nums shrink-0">
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
      <div className="shrink-0 px-4 py-1.5 sm:py-3 text-center text-slate-400 text-xs sm:text-sm bg-white border-t border-slate-200 capitalize">
        {currentTime.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </div>
    </div>
  );
}
