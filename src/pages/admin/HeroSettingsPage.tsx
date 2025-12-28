import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useHeroSettings, useUpdateHeroSettings, useUploadHeroImage, HeroSettings } from "@/hooks/useHeroSettings";
import { Loader2, Upload, Plus, Trash2, Eye, Sparkles, Image, Type, MousePointer, LayoutGrid, Users, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/layout/Logo";

const backgroundEffects = [
  { value: "gradient", label: "Gradiente Animado", description: "Fundo com gradiente suave e animação" },
  { value: "particles", label: "Partículas", description: "Efeito de partículas flutuantes" },
  { value: "waves", label: "Ondas", description: "Animação de ondas suaves" },
  { value: "minimal", label: "Minimalista", description: "Fundo limpo sem efeitos" },
  { value: "dots", label: "Pontos", description: "Grade de pontos animados" },
];

export default function HeroSettingsPage() {
  const { isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const { data: settings, isLoading } = useHeroSettings();
  const updateSettings = useUpdateHeroSettings();
  const uploadImage = useUploadHeroImage();

  const [formData, setFormData] = useState<Partial<HeroSettings>>({
    title: "",
    subtitle: "",
    description: "",
    primary_button_text: "",
    primary_button_link: "",
    secondary_button_text: "",
    secondary_button_link: "",
    highlights: [],
    hero_image_url: "",
    background_effect: "gradient",
    show_floating_badges: true,
    show_social_proof: true,
    social_proof_users: 2500,
    social_proof_rating: 4.9,
    badge_1_text: "Online 24h",
    badge_2_text: "100% Seguro",
  });

  const [newHighlight, setNewHighlight] = useState("");

  useEffect(() => {
    if (!isSuperAdmin) {
      navigate("/admin");
    }
  }, [isSuperAdmin, navigate]);

  useEffect(() => {
    if (settings) {
      setFormData({
        title: settings.title || "",
        subtitle: settings.subtitle || "",
        description: settings.description || "",
        primary_button_text: settings.primary_button_text || "",
        primary_button_link: settings.primary_button_link || "",
        secondary_button_text: settings.secondary_button_text || "",
        secondary_button_link: settings.secondary_button_link || "",
        highlights: settings.highlights || [],
        hero_image_url: settings.hero_image_url || "",
        background_effect: settings.background_effect || "gradient",
        show_floating_badges: settings.show_floating_badges ?? true,
        show_social_proof: settings.show_social_proof ?? true,
        social_proof_users: settings.social_proof_users || 2500,
        social_proof_rating: settings.social_proof_rating || 4.9,
        badge_1_text: settings.badge_1_text || "Online 24h",
        badge_2_text: settings.badge_2_text || "100% Seguro",
      });
    }
  }, [settings]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const url = await uploadImage.mutateAsync(file);
      setFormData(prev => ({ ...prev, hero_image_url: url }));
      await updateSettings.mutateAsync({ hero_image_url: url });
    } catch (error) {
      console.error("Error uploading image:", error);
    }
  };

  const handleSave = async () => {
    await updateSettings.mutateAsync(formData);
  };

  const addHighlight = () => {
    if (!newHighlight.trim()) return;
    const updated = [...(formData.highlights || []), newHighlight.trim()];
    setFormData(prev => ({ ...prev, highlights: updated }));
    setNewHighlight("");
  };

  const removeHighlight = (index: number) => {
    const updated = (formData.highlights || []).filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, highlights: updated }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Logo size="sm" />
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">Configurações da Hero</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <a href="/" target="_blank" rel="noopener noreferrer">
                <Eye className="h-4 w-4 mr-2" />
                Visualizar
              </a>
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={updateSettings.isPending}
            >
              {updateSettings.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar Alterações
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Configurações da Hero</h1>
          <p className="text-muted-foreground mt-1">
            Personalize a seção principal da landing page
          </p>
        </div>

        <Tabs defaultValue="content" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
            <TabsTrigger value="content" className="flex items-center gap-2">
              <Type className="h-4 w-4" />
              Conteúdo
            </TabsTrigger>
            <TabsTrigger value="buttons" className="flex items-center gap-2">
              <MousePointer className="h-4 w-4" />
              Botões
            </TabsTrigger>
            <TabsTrigger value="visual" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Visual
            </TabsTrigger>
            <TabsTrigger value="social" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Prova Social
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Type className="h-5 w-5" />
                  Textos Principais
                </CardTitle>
                <CardDescription>
                  Configure o título, subtítulo e descrição da hero
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título Principal</Label>
                  <Textarea
                    id="title"
                    value={formData.title || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Simplifique a gestão&#10;da sua clínica"
                    rows={2}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">Use Enter para quebra de linha. A segunda linha terá destaque colorido.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subtitle">Subtítulo</Label>
                  <Input
                    id="subtitle"
                    value={formData.subtitle || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, subtitle: e.target.value }))}
                    placeholder="A plataforma completa para gestão da sua clínica"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Organize agendamentos, automatize lembretes..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LayoutGrid className="h-5 w-5" />
                  Destaques
                </CardTitle>
                <CardDescription>
                  Lista de funcionalidades destacadas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {(formData.highlights || []).map((highlight, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1 py-1 px-3">
                      {highlight}
                      <button
                        onClick={() => removeHighlight(index)}
                        className="ml-1 hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newHighlight}
                    onChange={(e) => setNewHighlight(e.target.value)}
                    placeholder="Adicionar destaque..."
                    onKeyDown={(e) => e.key === "Enter" && addHighlight()}
                  />
                  <Button onClick={addHighlight} size="icon" variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="buttons" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Botão Principal (CTA)</CardTitle>
                <CardDescription>
                  Configuração do botão de call-to-action
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="primary_button_text">Texto do Botão</Label>
                  <Input
                    id="primary_button_text"
                    value={formData.primary_button_text || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, primary_button_text: e.target.value }))}
                    placeholder="Começar Grátis"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="primary_button_link">Link</Label>
                  <Input
                    id="primary_button_link"
                    value={formData.primary_button_link || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, primary_button_link: e.target.value }))}
                    placeholder="/cadastro"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Botão Secundário</CardTitle>
                <CardDescription>
                  Configuração do botão secundário
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="secondary_button_text">Texto do Botão</Label>
                  <Input
                    id="secondary_button_text"
                    value={formData.secondary_button_text || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, secondary_button_text: e.target.value }))}
                    placeholder="Ver Preços"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondary_button_link">Link</Label>
                  <Input
                    id="secondary_button_link"
                    value={formData.secondary_button_link || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, secondary_button_link: e.target.value }))}
                    placeholder="#pricing"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="visual" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Image className="h-5 w-5" />
                  Imagem da Hero
                </CardTitle>
                <CardDescription>
                  Upload da imagem principal (mockup do sistema)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {formData.hero_image_url && (
                  <div className="relative w-full max-w-lg rounded-lg overflow-hidden border">
                    <img
                      src={formData.hero_image_url}
                      alt="Hero preview"
                      className="w-full h-auto"
                    />
                  </div>
                )}
                <div className="flex items-center gap-4">
                  <Label htmlFor="hero-image" className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors">
                      <Upload className="h-4 w-4" />
                      <span>Upload Imagem</span>
                    </div>
                    <input
                      id="hero-image"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </Label>
                  {uploadImage.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hero_image_url">Ou cole uma URL</Label>
                  <Input
                    id="hero_image_url"
                    value={formData.hero_image_url || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, hero_image_url: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Efeito de Fundo
                </CardTitle>
                <CardDescription>
                  Escolha o estilo visual do background
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  value={formData.background_effect || "gradient"}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, background_effect: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {backgroundEffects.map((effect) => (
                      <SelectItem key={effect.value} value={effect.value}>
                        <div className="flex flex-col">
                          <span>{effect.label}</span>
                          <span className="text-xs text-muted-foreground">{effect.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Mostrar Badges Flutuantes</Label>
                    <p className="text-sm text-muted-foreground">
                      Badges que aparecem sobre a imagem da hero
                    </p>
                  </div>
                  <Switch
                    checked={formData.show_floating_badges ?? true}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, show_floating_badges: checked }))}
                  />
                </div>

                {formData.show_floating_badges && (
                  <div className="grid gap-4 sm:grid-cols-2 pt-4 border-t">
                    <div className="space-y-2">
                      <Label htmlFor="badge_1_text">Texto do Badge 1</Label>
                      <Input
                        id="badge_1_text"
                        value={formData.badge_1_text || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, badge_1_text: e.target.value }))}
                        placeholder="Online 24h"
                      />
                      <p className="text-xs text-muted-foreground">Badge superior direito (com indicador verde)</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="badge_2_text">Texto do Badge 2</Label>
                      <Input
                        id="badge_2_text"
                        value={formData.badge_2_text || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, badge_2_text: e.target.value }))}
                        placeholder="100% Seguro"
                      />
                      <p className="text-xs text-muted-foreground">Badge inferior esquerdo (com ícone de check)</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="social" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Prova Social
                </CardTitle>
                <CardDescription>
                  Números e estatísticas exibidos na hero
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Mostrar Prova Social</Label>
                    <p className="text-sm text-muted-foreground">
                      Exibir contagem de clínicas e avaliação
                    </p>
                  </div>
                  <Switch
                    checked={formData.show_social_proof ?? true}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, show_social_proof: checked }))}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="social_proof_users">Número de Clínicas/Usuários</Label>
                    <Input
                      id="social_proof_users"
                      type="number"
                      value={formData.social_proof_users || 0}
                      onChange={(e) => setFormData(prev => ({ ...prev, social_proof_users: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="social_proof_rating">Avaliação (0-5)</Label>
                    <Input
                      id="social_proof_rating"
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      value={formData.social_proof_rating || 0}
                      onChange={(e) => setFormData(prev => ({ ...prev, social_proof_rating: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
