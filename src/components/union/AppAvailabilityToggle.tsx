import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Smartphone, Loader2, Save, WifiOff } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function AppAvailabilityToggle() {
  const { currentClinic, user } = useAuth();
  const { toast } = useToast();
  
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingUnavailable, setPendingUnavailable] = useState(false);

  // Load current settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!currentClinic?.id) return;
      
      try {
        const { data, error } = await supabase
          .from("clinics")
          .select("app_unavailable, app_unavailable_message")
          .eq("id", currentClinic.id)
          .single();

        if (error) throw error;
        
        setIsUnavailable(data?.app_unavailable || false);
        setMessage(data?.app_unavailable_message || "");
      } catch (err) {
        console.error("Error loading app availability settings:", err);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [currentClinic?.id]);

  const handleToggleChange = (checked: boolean) => {
    if (checked) {
      // Indisponibilizando - mostrar confirmação
      setPendingUnavailable(true);
      setShowConfirmDialog(true);
    } else {
      // Disponibilizando - aplicar direto
      saveSettings(false, message);
    }
  };

  const confirmUnavailable = () => {
    setShowConfirmDialog(false);
    saveSettings(true, message);
  };

  const saveSettings = async (unavailable: boolean, customMessage: string) => {
    if (!currentClinic?.id) return;
    
    setSaving(true);
    try {
      const updateData: Record<string, unknown> = {
        app_unavailable: unavailable,
        app_unavailable_message: customMessage || null,
      };

      if (unavailable) {
        updateData.app_unavailable_at = new Date().toISOString();
        updateData.app_unavailable_by = user?.id || null;
      } else {
        updateData.app_unavailable_at = null;
        updateData.app_unavailable_by = null;
      }

      const { error } = await supabase
        .from("clinics")
        .update(updateData)
        .eq("id", currentClinic.id);

      if (error) throw error;

      setIsUnavailable(unavailable);
      
      toast({
        title: unavailable ? "App indisponibilizado" : "App disponibilizado",
        description: unavailable 
          ? "Os usuários verão a mensagem de indisponibilidade ao abrir o app."
          : "O app está novamente disponível para os usuários.",
      });
    } catch (err) {
      console.error("Error updating app availability:", err);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a disponibilidade do app.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMessage = () => {
    saveSettings(isUnavailable, message);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={isUnavailable ? "border-amber-500/50 bg-amber-50/30" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isUnavailable ? (
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <WifiOff className="h-5 w-5 text-amber-600" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Smartphone className="h-5 w-5 text-emerald-600" />
                </div>
              )}
              <div>
                <CardTitle className="text-lg">Disponibilidade do App</CardTitle>
                <CardDescription>
                  {isUnavailable 
                    ? "O app está indisponível para os usuários"
                    : "O app está disponível normalmente"
                  }
                </CardDescription>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Label htmlFor="app-availability" className="text-sm text-muted-foreground">
                {isUnavailable ? "Indisponível" : "Disponível"}
              </Label>
              <Switch
                id="app-availability"
                checked={isUnavailable}
                onCheckedChange={handleToggleChange}
                disabled={saving}
              />
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {isUnavailable && (
            <div className="flex items-start gap-2 p-3 bg-amber-100 rounded-lg border border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
              <p className="text-sm text-amber-800">
                Os usuários que abrirem o app verão uma tela de indisponibilidade 
                com a mensagem configurada abaixo.
              </p>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="unavailable-message">
              Mensagem de indisponibilidade
            </Label>
            <Textarea
              id="unavailable-message"
              placeholder="O aplicativo está temporariamente indisponível. Estamos trabalhando para restabelecer o acesso o mais breve possível."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Esta mensagem será exibida aos usuários quando o app estiver indisponível.
              Deixe em branco para usar a mensagem padrão.
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSaveMessage}
              disabled={saving}
              size="sm"
              variant="outline"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar mensagem
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Indisponibilizar App?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ao confirmar, todos os usuários que abrirem o app verão uma tela 
              de indisponibilidade e não poderão acessar nenhum serviço.
              <br /><br />
              Você pode reverter esta ação a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingUnavailable(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmUnavailable}
              className="bg-amber-500 hover:bg-amber-600"
            >
              Indisponibilizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
