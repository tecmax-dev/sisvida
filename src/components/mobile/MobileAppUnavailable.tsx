 import { motion } from "motion/react";
import { Clock, Phone } from "lucide-react";
import maintenanceBanner from "@/assets/prosinge-manutencao.png.asset.json";
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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <motion.img
        src={maintenanceBanner.url}
        alt="Sistema em manutenção"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md h-auto rounded-2xl shadow-xl mb-6"
      />


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
