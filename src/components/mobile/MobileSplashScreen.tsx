import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { SINDICATO_CLINIC_ID } from "@/constants/sindicato";

interface ClinicData {
  name: string;
  logo_url: string | null;
}

interface MobileSplashScreenProps {
  onComplete: () => void;
  duration?: number;
}

// Logo padrão do sindicato
const SINDICATO_LOGO_URL = `https://eahhszmbyxapxzilfdlo.supabase.co/storage/v1/object/public/clinic-assets/${SINDICATO_CLINIC_ID}/logo.png`;

export function MobileSplashScreen({ onComplete, duration = 5000 }: MobileSplashScreenProps) {
  const [clinic, setClinic] = useState<ClinicData | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const loadClinic = async () => {
      const clinicId = localStorage.getItem('mobile_clinic_id') || SINDICATO_CLINIC_ID;

      const { data } = await supabase
        .from("clinics")
        .select("name, logo_url")
        .eq("id", clinicId)
        .single();

      if (data) setClinic(data);
    };
    loadClinic();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, duration - 800); // Start fade out 800ms before completion

    const completeTimer = setTimeout(() => {
      onComplete();
    }, duration);

    return () => {
      clearTimeout(timer);
      clearTimeout(completeTimer);
    };
  }, [duration, onComplete]);

  const logoUrl = clinic?.logo_url || SINDICATO_LOGO_URL;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="fixed inset-0 z-[100] bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-600 flex flex-col items-center justify-center overflow-hidden"
        >
          {/* Animated background particles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Floating circles with staggered animations */}
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ 
                  scale: 0, 
                  opacity: 0,
                  x: Math.random() * 100 - 50,
                  y: Math.random() * 100 - 50
                }}
                animate={{ 
                  scale: [0, 1, 1.1, 1],
                  opacity: [0, 0.2 + Math.random() * 0.3, 0.2 + Math.random() * 0.2],
                  y: [0, -20, 0, 20, 0],
                }}
                transition={{ 
                  duration: 3 + Math.random() * 2,
                  delay: i * 0.2,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeInOut"
                }}
                className="absolute rounded-full"
                style={{
                  width: 40 + Math.random() * 120,
                  height: 40 + Math.random() * 120,
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  background: `radial-gradient(circle, rgba(255,255,255,${0.1 + Math.random() * 0.2}) 0%, transparent 70%)`,
                }}
              />
            ))}

            {/* Large decorative circle top-right */}
            <motion.div 
              initial={{ scale: 0, opacity: 0, rotate: -45 }}
              animate={{ scale: 1, opacity: 0.25, rotate: 0 }}
              transition={{ duration: 1.2, delay: 0.3, ease: "easeOut" }}
              className="absolute -top-32 -right-32 w-96 h-96 bg-gradient-to-br from-emerald-400 to-transparent rounded-full"
            />
            
            {/* Large decorative circle bottom-left */}
            <motion.div 
              initial={{ scale: 0, opacity: 0, rotate: 45 }}
              animate={{ scale: 1, opacity: 0.3, rotate: 0 }}
              transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
              className="absolute -bottom-24 -left-24 w-72 h-72 bg-gradient-to-tr from-teal-400 to-transparent rounded-full"
            />

            {/* Pulsing ring around logo area */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ 
                scale: [1, 1.3, 1],
                opacity: [0.3, 0, 0.3]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1
              }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-white/30 rounded-full"
            />
          </div>

          {/* Logo and content */}
          <div className="relative z-10 flex flex-col items-center">
            {/* Glow effect behind logo */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.5 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="absolute top-0 w-40 h-40 bg-white/20 rounded-full blur-3xl"
            />

            {/* Logo container with spring animation */}
            <motion.div
              initial={{ scale: 0, opacity: 0, rotateY: -90 }}
              animate={{ scale: 1, opacity: 1, rotateY: 0 }}
              transition={{ 
                duration: 0.8, 
                delay: 0.4,
                type: "spring",
                stiffness: 200,
                damping: 15
              }}
              className="mb-8 relative"
            >
              {/* Rotating ring around logo */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="absolute -inset-3 rounded-full border-2 border-dashed border-white/20"
              />
              
              <div className="w-32 h-32 rounded-full bg-white shadow-2xl flex items-center justify-center p-3 ring-4 ring-white/40 relative overflow-hidden">
                {/* Shine effect */}
                <motion.div
                  initial={{ x: "-100%", opacity: 0 }}
                  animate={{ x: "200%", opacity: [0, 0.5, 0] }}
                  transition={{ duration: 1.5, delay: 1, ease: "easeInOut" }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12"
                />
                <img 
                  src={logoUrl} 
                  alt={clinic?.name || "Logo"}
                  className="w-full h-full object-contain rounded-full"
                />
              </div>
            </motion.div>

            {/* App name with typewriter effect */}
            <motion.h1
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.8, ease: "easeOut" }}
              className="text-3xl font-bold text-white tracking-wide mb-3 drop-shadow-lg"
            >
              {clinic?.name || "Sindicato"}
            </motion.h1>

            {/* Subtitle with fade in */}
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 1.1, ease: "easeOut" }}
              className="text-white/90 text-lg font-medium mb-2"
            >
              App do Associado
            </motion.p>

            {/* Tagline */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 1.4 }}
              className="text-white/70 text-sm"
            >
              Seus benefícios na palma da mão
            </motion.p>

            {/* Progress bar */}
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "100%" }}
              transition={{ duration: 0.3, delay: 1.8 }}
              className="mt-12 w-48 h-1.5 bg-white/20 rounded-full overflow-hidden"
            >
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: duration / 1000 - 2, delay: 2, ease: "linear" }}
                className="h-full bg-white rounded-full"
              />
            </motion.div>

            {/* Loading text */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 2 }}
              className="mt-4 flex items-center gap-2"
            >
              <motion.span
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-white/80 text-sm"
              >
                Carregando
              </motion.span>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{
                      y: [0, -4, 0],
                      opacity: [0.5, 1, 0.5],
                    }}
                    transition={{
                      duration: 0.6,
                      repeat: Infinity,
                      delay: i * 0.15,
                      ease: "easeInOut",
                    }}
                    className="w-1.5 h-1.5 rounded-full bg-white"
                  />
                ))}
              </div>
            </motion.div>
          </div>

          {/* Bottom branding */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 2.5 }}
            className="absolute bottom-8 text-center"
          >
            <p className="text-white/50 text-xs font-medium tracking-wider">
              TECMAX TECNOLOGIA
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
