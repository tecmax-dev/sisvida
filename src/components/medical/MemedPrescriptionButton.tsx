import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, FileSignature } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/**
 * Botão de prescrição digital via Memed.
 *
 * Restrito a usuários PROFISSIONAIS: este componente só deve ser renderizado
 * dentro de telas de atendimento acessadas pelo próprio profissional
 * (ex.: AppointmentPanel dentro do ProfessionalDashboard), nunca em telas
 * de paciente, admin de clínica ou sindicato.
 *
 * Pré-requisitos para funcionar:
 * 1. O profissional precisa ter uma conta ativa na Memed (CRM/CRO validado).
 * 2. O profissional precisa ter um `memed_token` pessoal cadastrado em
 *    `professionals.memed_token` (obtido em memed.com.br/parceiros).
 * 3. `professionals.memed_enabled` precisa estar true.
 *
 * Enquanto o token não existir, o botão fica oculto (ver uso em
 * AppointmentPanel.tsx) — não quebra o fluxo de prescrição interna já
 * existente no sistema.
 */

interface MemedPatient {
  external_id: string;
  nome: string;
  cpf?: string;
  data_nascimento?: string;
  telefone?: string;
}

interface MemedPrescriptionButtonProps {
  memedToken: string;
  patient: MemedPatient;
  disabled?: boolean;
  onPrescriptionCreated?: (prescriptionUrl: string) => void;
}

declare global {
  interface Window {
    MdHub?: {
      event: {
        add: (eventName: string, callback: (data: unknown) => void) => void;
      };
      module: {
        show: (moduleName: string) => void;
      };
      command: {
        send: (moduleName: string, commandName: string, data?: unknown) => void;
      };
    };
  }
}

const MEMED_SCRIPT_SRC =
  "https://integrations.memed.com.br/modulos/plataforma.sinapse-prescricao/build/sinapse-prescricao.min.js";

export function MemedPrescriptionButton({
  memedToken,
  patient,
  disabled,
  onPrescriptionCreated,
}: MemedPrescriptionButtonProps) {
  const { toast } = useToast();
  const [loadingScript, setLoadingScript] = useState(false);
  const [ready, setReady] = useState(false);
  const listenersBound = useRef(false);

  const loadMemedScript = () =>
    new Promise<void>((resolve, reject) => {
      const existing = document.getElementById("sinapse-prescricao") as HTMLScriptElement | null;
      if (existing) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.id = "sinapse-prescricao";
      script.src = MEMED_SCRIPT_SRC;
      script.setAttribute("data-token", memedToken);
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Falha ao carregar o widget da Memed."));
      document.body.appendChild(script);
    });

  const bindMemedEvents = () => {
    if (listenersBound.current || !window.MdHub) return;
    listenersBound.current = true;

    window.MdHub.event.add("prescricaoModal.close", () => {
      // Modal de prescrição fechado pelo profissional
    });

    window.MdHub.event.add("prescricaoImpressa", (data: unknown) => {
      const url = (data as { prescricaoURL?: string } | undefined)?.prescricaoURL;
      if (url) {
        onPrescriptionCreated?.(url);
        toast({
          title: "Prescrição Memed emitida",
          description: "A receita digital foi gerada e assinada com sucesso.",
        });
      }
    });
  };

  const handleOpenMemed = async () => {
    if (!memedToken) {
      toast({
        title: "Memed não configurado",
        description: "Cadastre seu token pessoal Memed no seu perfil para habilitar a prescrição digital.",
        variant: "destructive",
      });
      return;
    }

    setLoadingScript(true);
    try {
      await loadMemedScript();

      // Aguarda o objeto global MdHub ficar disponível (script assíncrono)
      let attempts = 0;
      while (!window.MdHub && attempts < 40) {
        await new Promise((r) => setTimeout(r, 150));
        attempts += 1;
      }

      if (!window.MdHub) {
        throw new Error("Widget da Memed não respondeu.");
      }

      bindMemedEvents();
      setReady(true);

      window.MdHub.command.send("plataforma.prescricao", "setPaciente", {
        idExterno: patient.external_id,
        nome: patient.nome,
        cpf: patient.cpf,
        data_nascimento: patient.data_nascimento,
        telefone: patient.telefone,
      });

      window.MdHub.module.show("plataforma.prescricao");
    } catch (error) {
      toast({
        title: "Erro ao abrir Memed",
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setLoadingScript(false);
    }
  };

  useEffect(() => {
    return () => {
      listenersBound.current = false;
    };
  }, []);

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleOpenMemed}
      disabled={disabled || loadingScript}
      className="min-w-[180px] border-primary/40 text-primary hover:bg-primary/10"
      title="Emitir receita digital assinada pela Memed"
    >
      {loadingScript ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <FileSignature className="h-4 w-4 mr-2" />
      )}
      Prescrever pela Memed
    </Button>
  );
}
