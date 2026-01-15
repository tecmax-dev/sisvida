import { useState } from "react";
import { useMobileAppTabs, MobileAppTab } from "@/hooks/useMobileAppTabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Smartphone, Grid3X3, Users, MessageCircle, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CATEGORY_LABELS: Record<string, { label: string; icon: React.ReactNode; description: string }> = {
  featured: { 
    label: "Serviços em Destaque", 
    icon: <Users className="h-5 w-5" />,
    description: "Cards de acesso rápido no topo da home"
  },
  services: { 
    label: "Nossos Serviços", 
    icon: <Grid3X3 className="h-5 w-5" />,
    description: "Grid principal de serviços do app"
  },
  communication: { 
    label: "Comunicação", 
    icon: <MessageCircle className="h-5 w-5" />,
    description: "Seção de mídias e comunicação"
  },
};

export function MobileAppTabsManagement() {
  const { tabs, loading, updateTabStatus, refetch } = useMobileAppTabs();
  const { toast } = useToast();
  const [updating, setUpdating] = useState<string | null>(null);

  const handleToggle = async (tab: MobileAppTab) => {
    setUpdating(tab.tab_key);
    const success = await updateTabStatus(tab.tab_key, !tab.is_active);
    
    if (success) {
      toast({
        title: tab.is_active ? "Aba desativada" : "Aba ativada",
        description: `"${tab.tab_name}" foi ${tab.is_active ? "ocultada" : "exibida"} no app.`,
      });
    } else {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status da aba.",
        variant: "destructive",
      });
    }
    setUpdating(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const groupedTabs = tabs.reduce((acc, tab) => {
    if (!acc[tab.tab_category]) {
      acc[tab.tab_category] = [];
    }
    acc[tab.tab_category].push(tab);
    return acc;
  }, {} as Record<string, MobileAppTab[]>);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Smartphone className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Gerenciar Abas do App</CardTitle>
              <CardDescription>
                Ative ou desative as seções que aparecem no aplicativo mobile dos associados
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {Object.entries(CATEGORY_LABELS).map(([category, { label, icon, description }]) => (
        <Card key={category}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                {icon}
              </div>
              <div>
                <CardTitle className="text-base">{label}</CardTitle>
                <CardDescription className="text-sm">{description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {groupedTabs[category]?.map((tab) => (
                <div
                  key={tab.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{tab.tab_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Chave: <code className="bg-slate-200 px-1 rounded">{tab.tab_key}</code>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={tab.is_active ? "default" : "secondary"}>
                      {tab.is_active ? "Visível" : "Oculto"}
                    </Badge>
                    {updating === tab.tab_key ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Switch
                        checked={tab.is_active}
                        onCheckedChange={() => handleToggle(tab)}
                      />
                    )}
                  </div>
                </div>
              ))}
              {!groupedTabs[category]?.length && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma aba nesta categoria
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
