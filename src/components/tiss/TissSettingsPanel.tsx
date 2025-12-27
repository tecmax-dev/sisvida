import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Settings, Save } from "lucide-react";

interface TissSettingsPanelProps {
  clinicId: string;
}

interface TissSettings {
  id: string;
  clinic_id: string;
  ans_provider_code: string | null;
  cnes_code: string | null;
  tiss_version: string | null;
  auto_generate_guide_number: boolean;
}

export function TissSettingsPanel({ clinicId }: TissSettingsPanelProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    ans_provider_code: "",
    cnes_code: "",
    tiss_version: "4.01.00",
    auto_generate_guide_number: true,
  });

  // Fetch settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["tiss-settings", clinicId],
    queryFn: async () => {
      if (!clinicId) return null;

      const { data, error } = await (supabase as any)
        .from("tiss_settings")
        .select("*")
        .eq("clinic_id", clinicId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching TISS settings:", error);
        throw error;
      }
      return data as TissSettings | null;
    },
    enabled: !!clinicId,
  });

  // Update form when settings load
  useEffect(() => {
    if (settings) {
      setFormData({
        ans_provider_code: settings.ans_provider_code || "",
        cnes_code: settings.cnes_code || "",
        tiss_version: settings.tiss_version || "4.01.00",
        auto_generate_guide_number: settings.auto_generate_guide_number ?? true,
      });
    }
  }, [settings]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (settings) {
        // Update
        const { error } = await (supabase as any)
          .from("tiss_settings")
          .update({
            ans_provider_code: data.ans_provider_code || null,
            cnes_code: data.cnes_code || null,
            tiss_version: data.tiss_version,
            auto_generate_guide_number: data.auto_generate_guide_number,
          })
          .eq("id", settings.id);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await (supabase as any).from("tiss_settings").insert({
          clinic_id: clinicId,
          ans_provider_code: data.ans_provider_code || null,
          cnes_code: data.cnes_code || null,
          tiss_version: data.tiss_version,
          auto_generate_guide_number: data.auto_generate_guide_number,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tiss-settings", clinicId] });
      toast.success("Configurações salvas");
    },
    onError: () => {
      toast.error("Erro ao salvar configurações");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Carregando...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Configurações TISS
        </CardTitle>
        <CardDescription>Configure dados do prestador e padrão TISS</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Código do Prestador ANS</Label>
              <Input
                value={formData.ans_provider_code}
                onChange={(e) =>
                  setFormData({ ...formData, ans_provider_code: e.target.value })
                }
                placeholder="Ex: 123456"
              />
              <p className="text-xs text-muted-foreground">
                Código de registro do prestador na ANS
              </p>
            </div>

            <div className="space-y-2">
              <Label>Código CNES</Label>
              <Input
                value={formData.cnes_code}
                onChange={(e) => setFormData({ ...formData, cnes_code: e.target.value })}
                placeholder="Ex: 1234567"
              />
              <p className="text-xs text-muted-foreground">
                Cadastro Nacional de Estabelecimentos de Saúde
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Versão do Padrão TISS</Label>
            <Input
              value={formData.tiss_version}
              onChange={(e) => setFormData({ ...formData, tiss_version: e.target.value })}
              placeholder="Ex: 4.01.00"
            />
            <p className="text-xs text-muted-foreground">
              Versão do padrão TISS utilizada para geração de XML
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="auto_generate"
              checked={formData.auto_generate_guide_number}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, auto_generate_guide_number: checked })
              }
            />
            <Label htmlFor="auto_generate">Gerar número de guia automaticamente</Label>
          </div>

          <Button type="submit" disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            Salvar Configurações
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
