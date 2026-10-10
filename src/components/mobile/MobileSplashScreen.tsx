import { useEffect, useState } from "react";
import { SINDICATO_CLINIC_ID } from "@/constants/sindicato";

interface MobileSplashScreenProps {
  onComplete: () => void;
  duration?: number;
}

const SINDICATO_LOGO_URL = `/sindicato/logo.png?v=20260428`;

/**
 * Abertura leve do app: só CSS, curta, respeita "reduzir movimento".
 * Exibida uma vez por sessão (controle em MobileAppLayout).
 */
export function MobileSplashScreen({ onComplete, duration = 1600 }: MobileSplashScreenProps) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const total = reduce ? 600 : duration;
    const t1 = setTimeout(() => setLeaving(true), total - 350);
    const t2 = setTimeout(onComplete, total);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [duration, onComplete]);

  const clinicId = localStorage.getItem("mobile_clinic_id") || SINDICATO_CLINIC_ID;
  const name = clinicId === SINDICATO_CLINIC_ID ? "SECMI" : "Sindicato";

  return (
    <div
      role="status"
      aria-label={`Abrindo ${name}`}
      className={`secmi-splash fixed inset-0 z-[100] flex flex-col items-center justify-center bg-mobile text-mobile-foreground transition-opacity duration-300 ${leaving ? "opacity-0" : "opacity-100"}`}
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="secmi-splash-glow absolute h-72 w-72 rounded-full" aria-hidden="true" />
      <div className="secmi-splash-logo relative flex h-28 w-28 items-center justify-center rounded-full bg-card p-2.5 shadow-2xl ring-4 ring-mobile-foreground/25">
        <img
          src={SINDICATO_LOGO_URL}
          alt={`Logomarca ${name}`}
          className="h-full w-full rounded-full object-contain"
          fetchPriority="high"
        />
      </div>
      <h1 className="secmi-splash-text mt-6 text-3xl font-bold tracking-wide">{name}</h1>
      <p className="secmi-splash-text secmi-splash-delay mt-1.5 text-sm opacity-85">
        Seu sindicato mais perto de você
      </p>

      <style>{`
        .secmi-splash-glow { background: radial-gradient(circle, hsl(var(--mobile-primary-foreground) / 0.18), transparent 70%); animation: secmiGlow 1.4s ease-out both; }
        .secmi-splash-logo { animation: secmiPop .6s cubic-bezier(.2,.9,.3,1.2) both; }
        .secmi-splash-text { animation: secmiUp .5s ease-out .25s both; }
        .secmi-splash-delay { animation-delay: .4s; }
        @keyframes secmiPop { from { opacity: 0; transform: scale(.7); } to { opacity: 1; transform: scale(1); } }
        @keyframes secmiUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes secmiGlow { from { opacity: 0; transform: scale(.6); } to { opacity: 1; transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) {
          .secmi-splash *, .secmi-splash { animation: none !important; transition: none !important; }
        }
      `}</style>
    </div>
  );
}
