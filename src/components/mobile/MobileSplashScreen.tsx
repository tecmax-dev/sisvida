import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

interface ClinicData {
  name: string;
  logo_url: string | null;
}

interface MobileSplashScreenProps {
  onComplete: () => void;
  duration?: number;
}

export function MobileSplashScreen({ onComplete, duration = 2500 }: MobileSplashScreenProps) {
  const [clinic, setClinic] = useState<ClinicData | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const loadClinic = async () => {
      const clinicId = localStorage.getItem('mobile_clinic_id');
      if (!clinicId) return;

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
    }, duration - 500); // Start fade out 500ms before completion

    const completeTimer = setTimeout(() => {
      onComplete();
    }, duration);

    return () => {
      clearTimeout(timer);
      clearTimeout(completeTimer);
    };
  }, [duration, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="fixed inset-0 z-[100] bg-emerald-600 flex flex-col items-center justify-center overflow-hidden"
        >
          {/* Decorative circles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Large circle top-right */}
            <motion.div 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.3 }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              className="absolute -top-32 -right-32 w-80 h-80 bg-emerald-500 rounded-full"
            />
            
            {/* Medium circle bottom-left */}
            <motion.div 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.4 }}
              transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
              className="absolute -bottom-20 -left-20 w-56 h-56 bg-emerald-500 rounded-full"
            />
            
            {/* Small circle center-left */}
            <motion.div 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.5 }}
              transition={{ duration: 0.6, delay: 0.6, ease: "easeOut" }}
              className="absolute top-1/3 left-8 w-16 h-16 bg-emerald-400 rounded-full"
            />
            
            {/* Small circle center-right */}
            <motion.div 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.3 }}
              transition={{ duration: 0.5, delay: 0.8, ease: "easeOut" }}
              className="absolute bottom-1/3 right-12 w-12 h-12 bg-emerald-400 rounded-full"
            />
          </div>

          {/* Logo and content */}
          <div className="relative z-10 flex flex-col items-center">
            {/* Logo */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ 
                duration: 0.6, 
                delay: 0.3,
                ease: [0.34, 1.56, 0.64, 1] // Spring-like bounce
              }}
              className="mb-6"
            >
              {clinic?.logo_url ? (
                <div className="w-28 h-28 rounded-full bg-white shadow-2xl flex items-center justify-center p-3 ring-4 ring-white/30">
                  <img 
                    src={clinic.logo_url} 
                    alt={clinic.name}
                    className="w-full h-full object-contain rounded-full"
                  />
                </div>
              ) : (
                <div className="w-28 h-28 rounded-full bg-white shadow-2xl flex items-center justify-center ring-4 ring-white/30">
                  <span className="text-4xl font-bold text-emerald-600">S</span>
                </div>
              )}
            </motion.div>

            {/* App name */}
            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.6, ease: "easeOut" }}
              className="text-2xl font-bold text-white tracking-wide mb-2"
            >
              {clinic?.name || "SECMI"}
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.8, ease: "easeOut" }}
              className="text-white/80 text-sm"
            >
              App do Associado
            </motion.p>

            {/* Loading indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 1.2 }}
              className="mt-12"
            >
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{
                      scale: [1, 1.3, 1],
                      opacity: [0.5, 1, 0.5],
                    }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                      delay: i * 0.15,
                      ease: "easeInOut",
                    }}
                    className="w-2.5 h-2.5 rounded-full bg-white"
                  />
                ))}
              </div>
            </motion.div>
          </div>

          {/* Bottom branding */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1 }}
            className="absolute bottom-8 text-center"
          >
            <p className="text-white/60 text-xs">
              Tecmax Tecnologia
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
