import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Copy, MessageCircle, ExternalLink } from "lucide-react";
import { openWhatsApp } from "@/lib/whatsapp";

interface HomologacaoShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professional: {
    name: string;
    slug: string;
    function: string | null;
  };
  clinicName?: string;
}

export function HomologacaoShareDialog({ 
  open, 
  onOpenChange, 
  professional,
  clinicName
}: HomologacaoShareDialogProps) {
  const [phone, setPhone] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  
  const bookingUrl = `${window.location.origin}/agendamento/profissional/${professional.slug}`;
  
  const defaultMessage = `Olá! 👋

Compartilho com você o link para agendamento online com ${professional.name}${professional.function ? ` (${professional.function})` : ''}${clinicName ? ` - ${clinicName}` : ''}.

📅 Acesse o link abaixo para verificar datas e horários disponíveis:

${bookingUrl}

Atenciosamente.`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(bookingUrl);
    toast.success("Link copiado para a área de transferência!");
  };

  const handleShareWhatsApp = () => {
    if (!phone.trim()) {
      toast.error("Informe o número de telefone");
      return;
    }

    const message = customMessage.trim() || defaultMessage;
    openWhatsApp(phone, message);
    onOpenChange(false);
  };

  const handleOpenLink = () => {
    window.open(bookingUrl, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Compartilhar Link de Agendamento</DialogTitle>
          <DialogDescription>
            Compartilhe o link da página pública de agendamento do profissional
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Link display */}
          <div className="space-y-2">
            <Label>Link de Agendamento</Label>
            <div className="flex items-center gap-2">
              <Input 
                value={bookingUrl} 
                readOnly 
                className="font-mono text-sm"
              />
              <Button variant="outline" size="icon" onClick={handleCopyLink}>
                <Copy className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleOpenLink}>
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                ou envie via WhatsApp
              </span>
            </div>
          </div>

          {/* WhatsApp share */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone de Destino</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Mensagem (opcional)</Label>
              <Textarea
                id="message"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder={defaultMessage}
                rows={6}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Deixe em branco para usar a mensagem padrão
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleShareWhatsApp} className="bg-emerald-600 hover:bg-emerald-700">
            <MessageCircle className="w-4 h-4 mr-2" />
            Enviar via WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}