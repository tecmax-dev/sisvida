import { supabase } from "@/integrations/supabase/client";

/**
 * Notifica o associado por WhatsApp (conexão oficial Meta) que a carteirinha
 * foi atualizada com nova validade.
 *
 * Nunca lança erro: a notificação é acessória à atualização da carteirinha.
 * As travas (consentimento, opt-out, template aprovado, auditoria) ficam na
 * edge function card-renewal-notify.
 */
export async function notifyCardRenewal(params: {
  patientId: string;
  newExpiresAt: string;
  clinicId?: string;
}): Promise<void> {
  try {
    await supabase.functions.invoke("card-renewal-notify", {
      body: {
        patientId: params.patientId,
        newExpiresAt: params.newExpiresAt,
        clinicId: params.clinicId,
      },
    });
  } catch (err) {
    console.error("notifyCardRenewal failed:", err);
  }
}
