import { PopupBase, PopupHeader, PopupTitle } from "@/components/ui/popup-base";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, Mail, Smartphone, Calendar, Users, Send, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  segment_id: string | null;
  channel: string;
  message_template: string;
  scheduled_at: string | null;
  status: string;
  sent_count: number | null;
  delivered_count: number | null;
  failed_count: number | null;
  created_at: string;
  segment?: {
    id: string;
    name: string;
    patient_count: number | null;
  } | null;
}

interface CampaignPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: Campaign | null;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Rascunho", variant: "secondary" },
  scheduled: { label: "Agendada", variant: "outline" },
  sending: { label: "Enviando", variant: "default" },
  completed: { label: "Concluída", variant: "default" },
  paused: { label: "Pausada", variant: "secondary" },
  cancelled: { label: "Cancelada", variant: "destructive" },
};

const channelIcons: Record<string, React.ReactNode> = {
  whatsapp: <MessageSquare className="h-5 w-5 text-green-500" />,
  email: <Mail className="h-5 w-5 text-blue-500" />,
  sms: <Smartphone className="h-5 w-5 text-purple-500" />,
};

const channelLabels: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  sms: "SMS",
};

export default function CampaignPreview({
  open,
  onOpenChange,
  campaign,
}: CampaignPreviewProps) {
  if (!campaign) return null;

  const sentCount = campaign.sent_count || 0;
  const deliveredCount = campaign.delivered_count || 0;
  const failedCount = campaign.failed_count || 0;
  const deliveryRate = sentCount > 0 ? Math.round((deliveredCount / sentCount) * 100) : 0;

  const previewMessage = campaign.message_template
    .replace("{nome}", "Maria Silva")
    .replace("{primeiro_nome}", "Maria")
    .replace("{clinica}", "Sua Clínica")
    .replace("{data}", format(new Date(), "dd/MM/yyyy"))
    .replace("{telefone}", "(11) 99999-9999");

  return (
    <PopupBase open={open} onClose={() => onOpenChange(false)} maxWidth="2xl">
      <PopupHeader>
        <PopupTitle className="flex items-center gap-3">
          {channelIcons[campaign.channel]}
          {campaign.name}
        </PopupTitle>
      </PopupHeader>

      <div className="space-y-6">
        {/* Status e Info */}
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={statusConfig[campaign.status]?.variant || "secondary"}>
            {statusConfig[campaign.status]?.label || campaign.status}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Criada em {format(new Date(campaign.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </span>
        </div>

        {campaign.description && (
          <p className="text-muted-foreground">{campaign.description}</p>
        )}

        <Separator />

        {/* Detalhes */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                {channelIcons[campaign.channel]}
                <div>
                  <div className="text-sm text-muted-foreground">Canal</div>
                  <div className="font-medium">{channelLabels[campaign.channel]}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-sm text-muted-foreground">Segmento</div>
                  <div className="font-medium">
                    {campaign.segment?.name || "Não definido"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {campaign.scheduled_at && (
            <Card className="col-span-2">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-primary" />
                  <div>
                    <div className="text-sm text-muted-foreground">Agendada para</div>
                    <div className="font-medium">
                      {format(new Date(campaign.scheduled_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Métricas de Envio */}
        {sentCount > 0 && (
          <>
            <Separator />
            <div>
              <h3 className="font-medium mb-3">Métricas de Envio</h3>
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4 text-center">
                    <Send className="h-6 w-6 mx-auto mb-2 text-blue-500" />
                    <div className="text-2xl font-bold">{sentCount}</div>
                    <div className="text-sm text-muted-foreground">Enviados</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <CheckCircle className="h-6 w-6 mx-auto mb-2 text-green-500" />
                    <div className="text-2xl font-bold text-green-600">{deliveredCount}</div>
                    <div className="text-sm text-muted-foreground">Entregues ({deliveryRate}%)</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <XCircle className="h-6 w-6 mx-auto mb-2 text-red-500" />
                    <div className="text-2xl font-bold text-destructive">{failedCount}</div>
                    <div className="text-sm text-muted-foreground">Falhas</div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}

        <Separator />

        {/* Preview da Mensagem */}
        <div>
          <h3 className="font-medium mb-3">Prévia da Mensagem</h3>
          <Card className={
            campaign.channel === "whatsapp" 
              ? "bg-[#e5ddd5]" 
              : campaign.channel === "email"
              ? "bg-muted/50"
              : "bg-slate-100 dark:bg-slate-800"
          }>
            <CardContent className="pt-4">
              {campaign.channel === "whatsapp" && (
                <div className="max-w-[80%] bg-[#dcf8c6] dark:bg-green-800 rounded-lg p-3 shadow-sm">
                  <div className="whitespace-pre-wrap text-sm">{previewMessage}</div>
                  <div className="text-[10px] text-right text-muted-foreground mt-1">
                    {format(new Date(), "HH:mm")}
                  </div>
                </div>
              )}
              {campaign.channel === "email" && (
                <div className="bg-background rounded-lg p-4 border">
                  <div className="border-b pb-2 mb-3">
                    <div className="text-sm text-muted-foreground">De: Sua Clínica &lt;contato@clinica.com&gt;</div>
                    <div className="text-sm text-muted-foreground">Para: maria.silva@email.com</div>
                    <div className="text-sm font-medium mt-1">Assunto: {campaign.name}</div>
                  </div>
                  <div className="whitespace-pre-wrap text-sm">{previewMessage}</div>
                </div>
              )}
              {campaign.channel === "sms" && (
                <div className="bg-background rounded-lg p-3 border max-w-[280px] mx-auto">
                  <div className="text-xs text-center text-muted-foreground mb-2">Mensagem SMS</div>
                  <div className="whitespace-pre-wrap text-sm">{previewMessage}</div>
                  <div className="text-xs text-muted-foreground mt-2">
                    {previewMessage.length}/160 caracteres
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PopupBase>
  );
}
