import { supabase } from "@/integrations/supabase/client";

export async function sendOfficialSignatureLink(associadoId: string, clinicId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("send-signature-request", {
    body: { associadoId, clinicId, sendOfficial: true },
  });
  if (error) throw error;
  if (data?.success) return;
  const reasons: Record<string, string> = {
    TEMPLATE_NOT_APPROVED: "O modelo de assinatura ainda não foi aprovado pela Meta. Nenhuma mensagem foi enviada.",
    NO_CONSENT: "O associado precisa autorizar o recebimento de mensagens neste número antes do envio.",
    OPT_OUT: "Este número não aceita mensagens do sindicato.",
    INVALID_PHONE: "O telefone do associado não é válido para WhatsApp.",
    FORBIDDEN: "Você não tem acesso a este sindicato.",
    ASSOCIADO_NAO_ENCONTRADO: "Sócio não encontrado neste sindicato.",
    META_TOKEN_NOT_CONFIGURED: "WhatsApp oficial não está configurado.",
    SEND_FAILED: "A Meta não confirmou o envio. Consulte a auditoria antes de tentar novamente.",
  };
  throw new Error(reasons[data?.reason] || data?.error || "Não foi possível enviar o link de assinatura.");
}
