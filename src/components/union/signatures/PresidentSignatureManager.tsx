import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pen, Save, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function PresidentSignatureManager() {
  const { currentClinic, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const [presidentName, setPresidentName] = useState("");
  const [presidentTitle, setPresidentTitle] = useState("Presidente");
  const [presidentCpf, setPresidentCpf] = useState("");

  // Fetch existing signature
  const { data: signature, isLoading } = useQuery({
    queryKey: ["president-signature", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return null;
      const { data } = await supabase
        .from("union_president_signatures")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true)
        .single();
      return data;
    },
    enabled: !!currentClinic?.id,
  });

  // Load signature data into form
  useEffect(() => {
    if (signature) {
      setPresidentName(signature.president_name || "");
      setPresidentTitle(signature.president_title || "Presidente");
      setPresidentCpf(signature.president_cpf || "");

      // Draw existing signature on canvas
      if (signature.signature_data && canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        const img = new Image();
        img.onload = () => {
          if (ctx && canvasRef.current) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            ctx.drawImage(img, 0, 0);
            setHasSignature(true);
          }
        };
        img.src = signature.signature_data;
      }
    }
  }, [signature]);

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = 150;
    }

    ctx.strokeStyle = "#1e40af";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentClinic?.id || !user?.id) throw new Error("Contexto inválido");
      if (!presidentName.trim()) throw new Error("Nome do presidente é obrigatório");

      const canvas = canvasRef.current;
      const signatureData = hasSignature && canvas ? canvas.toDataURL("image/png") : null;

      // Deactivate existing signatures
      await supabase
        .from("union_president_signatures")
        .update({ is_active: false })
        .eq("clinic_id", currentClinic.id);

      // Create new signature
      const { error } = await supabase
        .from("union_president_signatures")
        .insert({
          clinic_id: currentClinic.id,
          president_name: presidentName,
          president_title: presidentTitle,
          president_cpf: presidentCpf || null,
          signature_data: signatureData,
          is_active: true,
          created_by: user.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["president-signature"] });
      toast({ title: "Assinatura salva com sucesso!" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!signature?.id) return;
      const { error } = await supabase
        .from("union_president_signatures")
        .delete()
        .eq("id", signature.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["president-signature"] });
      toast({ title: "Assinatura removida!" });
      setPresidentName("");
      setPresidentTitle("Presidente");
      setPresidentCpf("");
      clearCanvas();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Pen className="h-5 w-5 text-violet-500" />
          Assinatura da Presidência
        </CardTitle>
        <CardDescription>
          Configure a assinatura que será exibida nas autorizações de benefícios
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* President Info */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="presidentName">Nome *</Label>
            <Input
              id="presidentName"
              value={presidentName}
              onChange={(e) => setPresidentName(e.target.value)}
              placeholder="Nome do presidente"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="presidentTitle">Cargo</Label>
            <Input
              id="presidentTitle"
              value={presidentTitle}
              onChange={(e) => setPresidentTitle(e.target.value)}
              placeholder="Ex: Presidente"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="presidentCpf">CPF</Label>
            <Input
              id="presidentCpf"
              value={presidentCpf}
              onChange={(e) => setPresidentCpf(e.target.value)}
              placeholder="000.000.000-00"
            />
          </div>
        </div>

        {/* Signature Canvas */}
        <div className="space-y-2">
          <Label>Assinatura Digital</Label>
          <div className="border rounded-lg p-2 bg-white dark:bg-slate-950">
            <canvas
              ref={canvasRef}
              className="w-full cursor-crosshair touch-none"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={clearCanvas}>
              <Trash2 className="h-4 w-4 mr-2" />
              Limpar
            </Button>
          </div>
        </div>

        {/* Preview */}
        {(hasSignature || signature?.signature_data) && presidentName && (
          <div className="border rounded-lg p-4 bg-muted/30">
            <p className="text-sm text-muted-foreground mb-2">Prévia:</p>
            <div className="text-center">
              {hasSignature && canvasRef.current && (
                <img 
                  src={canvasRef.current.toDataURL()} 
                  alt="Assinatura" 
                  className="h-12 mx-auto mb-1"
                />
              )}
              <div className="border-t border-foreground w-48 mx-auto pt-1">
                <p className="font-medium">{presidentName}</p>
                <p className="text-sm text-muted-foreground">{presidentTitle}</p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between">
          {signature && (
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remover Assinatura
            </Button>
          )}
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !presidentName.trim()}
            className="ml-auto"
          >
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
