import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUnionEntity } from "@/hooks/useUnionEntity";
import { supabase } from "@/integrations/supabase/client";
import { openWhatsApp } from "@/lib/whatsapp";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Share2, MessageCircle, Copy, Check, Link2 } from "lucide-react";

interface UnionShareFiliacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UnionShareFiliacaoDialog({
  open,
  onOpenChange,
}: UnionShareFiliacaoDialogProps) {
  const { toast } = useToast();
  const { user, currentClinic } = useAuth();
  const { entity } = useUnionEntity();
  
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  // Gerar link dinâmico de filiação baseado no sindicato
  const filiacaoLink = entity 
    ? `${window.location.origin}/sindical/filiacao/${entity.id}`
    : "";

  // Mensagem padrão
  const defaultMessage = entity
    ? `Olá! Faça sua filiação ao ${entity.razao_social} de forma rápida e segura:\n\n${filiacaoLink}\n\nAtenciosamente,\n${entity.nome_fantasia || entity.razao_social}`
    : "";

  // Formatar telefone
  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 11);
    if (numbers.length <= 10) {
      return numbers
        .replace(/(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
    return numbers
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2");
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  // Copiar link para área de transferência
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(filiacaoLink);
      setCopied(true);
      toast({ title: "Link copiado!" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  // Enviar via WhatsApp
  const handleSendWhatsApp = async () => {
    if (!entity || !phone) {
      toast({ title: "Informe o número de WhatsApp", variant: "destructive" });
      return;
    }

    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      toast({ title: "Número de telefone inválido", variant: "destructive" });
      return;
    }

    setSending(true);

    try {
      const finalMessage = message || defaultMessage;

      // Registrar log do envio
      await supabase.from("union_share_logs").insert({
        union_entity_id: entity.id,
        clinic_id: entity.clinic_id,
        user_id: user?.id,
        phone_number: phoneDigits,
        message_sent: finalMessage,
        status: "sent",
      });

      // Abrir WhatsApp com a mensagem
      openWhatsApp(phoneDigits, finalMessage);

      toast({ 
        title: "WhatsApp aberto!", 
        description: "O link de filiação foi preparado para envio." 
      });

      // Limpar e fechar
      setPhone("");
      setMessage("");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao enviar:", error);
      toast({ 
        title: "Erro ao enviar", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setSending(false);
    }
  };

  if (!entity) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-emerald-600" />
            Compartilhar Link de Filiação
          </DialogTitle>
          <DialogDescription>
            Envie o link de filiação do {entity.razao_social} via WhatsApp
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Link de Filiação */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Link da Página de Filiação
            </Label>
            <div className="flex gap-2">
              <Input 
                value={filiacaoLink} 
                readOnly 
                className="bg-muted text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopyLink}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <Badge variant="secondary" className="text-xs">
              {entity.entity_type === "sindicato" ? "Sindicato" : 
               entity.entity_type === "federacao" ? "Federação" : "Confederação"}
            </Badge>
          </div>

          {/* Número de WhatsApp */}
          <div className="space-y-2">
            <Label htmlFor="phone">Número de WhatsApp *</Label>
            <Input
              id="phone"
              placeholder="(00) 00000-0000"
              value={phone}
              onChange={handlePhoneChange}
              maxLength={15}
            />
            <p className="text-xs text-muted-foreground">
              Informe o número com DDD
            </p>
          </div>

          {/* Mensagem Personalizada */}
          <div className="space-y-2">
            <Label htmlFor="message">Mensagem (opcional)</Label>
            <Textarea
              id="message"
              placeholder={defaultMessage}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Deixe em branco para usar a mensagem padrão
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSendWhatsApp}
            disabled={sending || !phone}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <MessageCircle className="h-4 w-4 mr-2" />
            )}
            Enviar via WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
