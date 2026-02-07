import { motion } from "framer-motion";
import { WifiOff, Clock, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileAppUnavailableProps {
  message?: string | null;
  clinicName?: string;
  clinicPhone?: string | null;
}

export function MobileAppUnavailable({ 
  message, 
  clinicName = "Sindicato",
  clinicPhone 
}: MobileAppUnavailableProps) {
  const defaultMessage = "O aplicativo está temporariamente indisponível. Estamos trabalhando para restabelecer o acesso o mais breve possível.";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-gray-50 flex flex-col items-center justify-center p-6">
      {/* Animated Icon */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ 
          duration: 0.5, 
          type: "spring",
          stiffness: 200,
          damping: 15
        }}
        className="mb-8"
      >
        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-2xl shadow-amber-500/30">
          <motion.div
            animate={{ 
              rotate: [0, -10, 10, -10, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatDelay: 3
            }}
          >
            <WifiOff className="h-16 w-16 text-white" />
          </motion.div>
        </div>
      </motion.div>

      {/* Title */}
      <motion.h1
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="text-2xl font-bold text-gray-800 text-center mb-2"
      >
        App Temporariamente Indisponível
      </motion.h1>

      {/* Clinic name */}
      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="text-sm text-gray-500 mb-6"
      >
        {clinicName}
      </motion.p>

      {/* Message */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="bg-amber-50 border border-amber-200 rounded-2xl p-5 max-w-sm"
      >
        <div className="flex items-start gap-3">
          <Clock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 leading-relaxed">
            {message || defaultMessage}
          </p>
        </div>
      </motion.div>

      {/* Contact Button */}
      {clinicPhone && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-8"
        >
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => window.open(`tel:${clinicPhone}`, "_self")}
          >
            <Phone className="h-4 w-4" />
            Entrar em contato
          </Button>
        </motion.div>
      )}

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.8 }}
        className="absolute bottom-8 text-center"
      >
        <p className="text-xs text-gray-400">
          Tente novamente mais tarde
        </p>
      </motion.div>
    </div>
  );
}
