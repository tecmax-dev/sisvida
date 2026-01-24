import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  MessageCircle,
  Save,
  Loader2,
  Building2,
  LifeBuoy,
  Map,
  Home,
} from "lucide-react";

interface HelpContent {
  id?: string;
  // Home card section
  home_card_title: string;
  home_card_subtitle: string;
  home_card_button_text: string;
  // Street View
  street_view_url: string;
  // Location
  organization_name: string;
  address: string;
  city_state: string;
  cep: string;
  // Contacts
  phone: string;
  whatsapp: string;
  email: string;
  // Hours
  weekday_hours: string;
  saturday_hours: string;
  sunday_holiday: string;
}

const defaultContent: HelpContent = {
  home_card_title: "Como chegar até nós?",
  home_card_subtitle: "Veja nossa localização no mapa",
  home_card_button_text: "Ver no mapa",
  street_view_url: "",
  organization_name: "Sindicato SECMI",
  address: "Rua do Sindicato, 123 - Centro",
  city_state: "São Paulo - SP",
  cep: "01310-000",
  phone: "(11) 3333-4444",
  whatsapp: "(11) 99999-8888",
  email: "contato@sindicato.org.br",
  weekday_hours: "08:00 - 17:00",
  saturday_hours: "08:00 - 12:00",
  sunday_holiday: "Fechado",
};

export function HelpContentManagement() {
  const { currentClinic } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [content, setContent] = useState<HelpContent>(defaultContent);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    loadContent();
  }, [currentClinic?.id]);

  const loadContent = async () => {
    if (!currentClinic?.id) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("union_app_content")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .eq("content_type", "ajuda")
        .maybeSingle();

      if (error) throw error;

      if (data && data.metadata) {
        const metadata = data.metadata as Record<string, unknown>;
        setExistingId(data.id);
        setContent({
          home_card_title: (metadata.home_card_title as string) || defaultContent.home_card_title,
          home_card_subtitle: (metadata.home_card_subtitle as string) || defaultContent.home_card_subtitle,
          home_card_button_text: (metadata.home_card_button_text as string) || defaultContent.home_card_button_text,
          street_view_url: (metadata.street_view_url as string) || defaultContent.street_view_url,
          organization_name: (metadata.organization_name as string) || defaultContent.organization_name,
          address: (metadata.address as string) || defaultContent.address,
          city_state: (metadata.city_state as string) || defaultContent.city_state,
          cep: (metadata.cep as string) || defaultContent.cep,
          phone: (metadata.phone as string) || defaultContent.phone,
          whatsapp: (metadata.whatsapp as string) || defaultContent.whatsapp,
          email: (metadata.email as string) || defaultContent.email,
          weekday_hours: (metadata.weekday_hours as string) || defaultContent.weekday_hours,
          saturday_hours: (metadata.saturday_hours as string) || defaultContent.saturday_hours,
          sunday_holiday: (metadata.sunday_holiday as string) || defaultContent.sunday_holiday,
        });
      }
    } catch (error) {
      console.error("Error loading help content:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentClinic?.id) return;

    setIsSaving(true);
    try {
      const metadata = {
        home_card_title: content.home_card_title,
        home_card_subtitle: content.home_card_subtitle,
        home_card_button_text: content.home_card_button_text,
        street_view_url: content.street_view_url,
        organization_name: content.organization_name,
        address: content.address,
        city_state: content.city_state,
        cep: content.cep,
        phone: content.phone,
        whatsapp: content.whatsapp,
        email: content.email,
        weekday_hours: content.weekday_hours,
        saturday_hours: content.saturday_hours,
        sunday_holiday: content.sunday_holiday,
      };

      if (existingId) {
        const { error } = await supabase
          .from("union_app_content")
          .update({
            title: "Precisa de Ajuda",
            metadata,
            is_active: true,
          })
          .eq("id", existingId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("union_app_content")
          .insert({
            clinic_id: currentClinic.id,
            content_type: "ajuda",
            title: "Precisa de Ajuda",
            metadata,
            is_active: true,
            order_index: 0,
          })
          .select()
          .single();

        if (error) throw error;
        setExistingId(data.id);
      }

      toast({
        title: "Sucesso",
        description: "Informações de ajuda salvas com sucesso!",
      });
    } catch (error) {
      console.error("Error saving help content:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar informações de ajuda.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LifeBuoy className="h-5 w-5 text-primary" />
            Configurações de Ajuda
          </CardTitle>
          <CardDescription>
            Configure as informações exibidas na tela "Precisa de Ajuda?" do aplicativo móvel
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Badge variant={existingId ? "default" : "secondary"}>
              {existingId ? "Configurado" : "Não configurado"}
            </Badge>
          </div>

          <Separator />

          {/* Home Card Section */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Home className="h-4 w-4" />
              Card "Como chegar até nós" (Tela Inicial)
            </h3>
            <p className="text-sm text-muted-foreground">
              Configure o card que aparece na tela inicial do app com acesso ao mapa
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Título do Card</Label>
                <Input
                  value={content.home_card_title}
                  onChange={(e) => setContent({ ...content, home_card_title: e.target.value })}
                  placeholder="Ex: Como chegar até nós?"
                />
              </div>
              <div className="space-y-2">
                <Label>Subtítulo (opcional)</Label>
                <Input
                  value={content.home_card_subtitle}
                  onChange={(e) => setContent({ ...content, home_card_subtitle: e.target.value })}
                  placeholder="Ex: Veja nossa localização"
                />
              </div>
              <div className="space-y-2">
                <Label>Texto do Botão</Label>
                <Input
                  value={content.home_card_button_text}
                  onChange={(e) => setContent({ ...content, home_card_button_text: e.target.value })}
                  placeholder="Ex: Ver no mapa"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Street View Configuration */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Map className="h-4 w-4" />
              Embed do Mapa/Street View
            </h3>
            <p className="text-sm text-muted-foreground">
              Cole a URL de incorporação do Google Maps ou o código iframe completo
            </p>
            <div className="space-y-2">
              <Label>URL do Iframe (src)</Label>
              <Textarea
                value={content.street_view_url}
                onChange={(e) => {
                  const value = e.target.value;
                  // Extract src from iframe if user pastes full iframe code
                  const srcMatch = value.match(/src=["']([^"']+)["']/);
                  const cleanUrl = srcMatch ? srcMatch[1] : value;
                  setContent({ ...content, street_view_url: cleanUrl });
                }}
                placeholder="Ex: https://www.google.com/maps/embed?pb=!1m18... ou https://www.google.com/maps?q=endereco&output=embed"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                <strong>Como obter:</strong> Google Maps → Compartilhar → Incorporar um mapa → Copie o código e cole aqui
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (content.street_view_url) {
                    // Convert to embeddable URL if needed
                    let embedUrl = content.street_view_url;
                    if (!embedUrl.includes('output=embed') && !embedUrl.includes('/embed')) {
                      // Add output=embed for standard Google Maps URLs
                      embedUrl = embedUrl.includes('?') 
                        ? `${embedUrl}&output=embed`
                        : `${embedUrl}?output=embed`;
                    }
                    setPreviewUrl(embedUrl);
                    setShowPreview(true);
                  }
                }}
                disabled={!content.street_view_url}
              >
                <Map className="h-4 w-4 mr-2" />
                Pré-visualizar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (content.street_view_url) {
                    window.open(content.street_view_url, '_blank');
                  }
                }}
                disabled={!content.street_view_url}
              >
                Abrir em Nova Aba
              </Button>
              {showPreview && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(false)}
                >
                  Ocultar
                </Button>
              )}
            </div>
            {showPreview && previewUrl && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Pré-visualização:</p>
                <div className="rounded-lg border overflow-hidden h-48">
                  <iframe
                    src={previewUrl}
                    className="w-full h-full border-0"
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Pré-visualização do Mapa"
                  />
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Organization & Location */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Organização e Localização
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome da Organização</Label>
                <Input
                  value={content.organization_name}
                  onChange={(e) => setContent({ ...content, organization_name: e.target.value })}
                  placeholder="Ex: Sindicato SECMI"
                />
              </div>
              <div className="space-y-2">
                <Label>Endereço</Label>
                <Input
                  value={content.address}
                  onChange={(e) => setContent({ ...content, address: e.target.value })}
                  placeholder="Ex: Rua do Sindicato, 123 - Centro"
                />
              </div>
              <div className="space-y-2">
                <Label>Cidade - Estado</Label>
                <Input
                  value={content.city_state}
                  onChange={(e) => setContent({ ...content, city_state: e.target.value })}
                  placeholder="Ex: São Paulo - SP"
                />
              </div>
              <div className="space-y-2">
                <Label>CEP</Label>
                <Input
                  value={content.cep}
                  onChange={(e) => setContent({ ...content, cep: e.target.value })}
                  placeholder="Ex: 01310-000"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Informações de Contato
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Phone className="h-3 w-3" />
                  Telefone
                </Label>
                <Input
                  value={content.phone}
                  onChange={(e) => setContent({ ...content, phone: e.target.value })}
                  placeholder="Ex: (11) 3333-4444"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MessageCircle className="h-3 w-3" />
                  WhatsApp
                </Label>
                <Input
                  value={content.whatsapp}
                  onChange={(e) => setContent({ ...content, whatsapp: e.target.value })}
                  placeholder="Ex: (11) 99999-8888"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Mail className="h-3 w-3" />
                  E-mail
                </Label>
                <Input
                  value={content.email}
                  onChange={(e) => setContent({ ...content, email: e.target.value })}
                  placeholder="Ex: contato@sindicato.org.br"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Operating Hours */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Horário de Atendimento
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Segunda a Sexta</Label>
                <Input
                  value={content.weekday_hours}
                  onChange={(e) => setContent({ ...content, weekday_hours: e.target.value })}
                  placeholder="Ex: 08:00 - 17:00"
                />
              </div>
              <div className="space-y-2">
                <Label>Sábado</Label>
                <Input
                  value={content.saturday_hours}
                  onChange={(e) => setContent({ ...content, saturday_hours: e.target.value })}
                  placeholder="Ex: 08:00 - 12:00"
                />
              </div>
              <div className="space-y-2">
                <Label>Domingo e Feriados</Label>
                <Input
                  value={content.sunday_holiday}
                  onChange={(e) => setContent({ ...content, sunday_holiday: e.target.value })}
                  placeholder="Ex: Fechado"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Configurações
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
