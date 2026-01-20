import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText,
  Download,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Users,
  FileArchive,
} from "lucide-react";
import { generateFiliacaoPDFBlob } from "@/lib/filiacao-pdf-generator";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
}

interface MemberStatus {
  id: string;
  name: string;
  cpf: string | null;
  status: "pending" | "generating" | "success" | "error" | "no_filiacao";
  error?: string;
}

export function BulkFiliacaoGeneratorDialog({ open, onOpenChange, clinicId }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [members, setMembers] = useState<MemberStatus[]>([]);
  const [progress, setProgress] = useState(0);
  const [generatedPDFs, setGeneratedPDFs] = useState<{ name: string; blob: Blob }[]>([]);
  const [sindicato, setSindicato] = useState<{ razao_social: string; logo_url?: string | null } | null>(null);

  useEffect(() => {
    if (open) {
      loadMembers();
      loadSindicato();
    }
  }, [open, clinicId]);

  const loadSindicato = async () => {
    const { data } = await supabase
      .from("union_entities")
      .select("razao_social, clinic_id")
      .eq("clinic_id", clinicId)
      .maybeSingle();

    if (data) {
      const { data: clinic } = await supabase
        .from("clinics")
        .select("logo_url")
        .eq("id", clinicId)
        .maybeSingle();

      setSindicato({ razao_social: data.razao_social, logo_url: clinic?.logo_url });
    }
  };

  const loadMembers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("patients")
        .select("id, name, cpf")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;

      setMembers(
        (data || []).map((m) => ({
          id: m.id,
          name: m.name,
          cpf: m.cpf,
          status: "pending" as const,
        }))
      );
    } catch (error) {
      console.error("Error loading members:", error);
      toast({ title: "Erro ao carregar sócios", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const normalizeCPF = (cpf: string): string => {
    return cpf.replace(/\D/g, "");
  };

  const generatePDFForMember = async (cpf: string): Promise<Blob | null> => {
    const normalizedCPF = normalizeCPF(cpf);
    
    // Fetch filiacao data - search by normalized CPF
    const { data: filiacao, error: filiacaoError } = await supabase
      .from("sindical_associados")
      .select("*")
      .or(`cpf.eq.${normalizedCPF},cpf.eq.${cpf}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (filiacaoError) {
      console.error("Error fetching filiacao:", filiacaoError);
      return null;
    }

    if (!filiacao) {
      return null;
    }

    // Fetch dependents
    const { data: dependents } = await supabase
      .from("sindical_associado_dependentes")
      .select("*")
      .eq("associado_id", filiacao.id);

    // Generate PDF using the dedicated function
    return generateFiliacaoPDFBlob(
      filiacao,
      dependents || [],
      sindicato
    );
  };

  const handleGenerateAll = async () => {
    setGenerating(true);
    setProgress(0);
    setGeneratedPDFs([]);

    const pdfs: { name: string; blob: Blob }[] = [];
    const total = members.length;

    for (let i = 0; i < members.length; i++) {
      const member = members[i];

      setMembers((prev) =>
        prev.map((m) =>
          m.id === member.id ? { ...m, status: "generating" } : m
        )
      );

      try {
        if (!member.cpf) {
          setMembers((prev) =>
            prev.map((m) =>
              m.id === member.id
                ? { ...m, status: "error", error: "CPF não cadastrado" }
                : m
            )
          );
          continue;
        }

        const pdfBlob = await generatePDFForMember(member.cpf);

        if (pdfBlob) {
          pdfs.push({
            name: `ficha-filiacao-${member.name.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30)}.pdf`,
            blob: pdfBlob,
          });
          setMembers((prev) =>
            prev.map((m) =>
              m.id === member.id ? { ...m, status: "success" } : m
            )
          );
        } else {
          setMembers((prev) =>
            prev.map((m) =>
              m.id === member.id ? { ...m, status: "no_filiacao" } : m
            )
          );
        }
      } catch (error: any) {
        console.error(`Error generating PDF for ${member.name}:`, error);
        setMembers((prev) =>
          prev.map((m) =>
            m.id === member.id
              ? { ...m, status: "error", error: error.message }
              : m
          )
        );
      }

      setProgress(Math.round(((i + 1) / total) * 100));
      
      // Small delay to prevent UI freeze
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    setGeneratedPDFs(pdfs);
    setGenerating(false);

    if (pdfs.length > 0) {
      toast({
        title: `${pdfs.length} fichas geradas com sucesso!`,
        description: "Clique em baixar para salvar os PDFs.",
      });
    } else {
      toast({
        title: "Nenhuma ficha gerada",
        description: "Nenhum sócio possui ficha de filiação cadastrada.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadAll = () => {
    generatedPDFs.forEach((pdf, index) => {
      // Stagger downloads to prevent browser blocking
      setTimeout(() => {
        const url = URL.createObjectURL(pdf.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = pdf.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, index * 200);
    });

    toast({ title: `${generatedPDFs.length} PDFs sendo baixados!` });
  };

  const stats = {
    total: members.length,
    success: members.filter((m) => m.status === "success").length,
    noFiliacao: members.filter((m) => m.status === "no_filiacao").length,
    error: members.filter((m) => m.status === "error").length,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileArchive className="h-5 w-5 text-purple-500" />
            Gerar Fichas de Filiação em Lote
          </DialogTitle>
          <DialogDescription>
            Gere fichas de filiação em PDF para todos os sócios cadastrados que possuem ficha de filiação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-2">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/10 text-center">
              <p className="text-2xl font-bold text-emerald-600">{stats.success}</p>
              <p className="text-xs text-muted-foreground">Geradas</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/10 text-center">
              <p className="text-2xl font-bold text-amber-600">{stats.noFiliacao}</p>
              <p className="text-xs text-muted-foreground">Sem ficha</p>
            </div>
            <div className="p-3 rounded-lg bg-red-500/10 text-center">
              <p className="text-2xl font-bold text-red-600">{stats.error}</p>
              <p className="text-xs text-muted-foreground">Erros</p>
            </div>
          </div>

          {/* Progress */}
          {generating && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Gerando fichas...</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Members list */}
          <ScrollArea className="h-[300px] border rounded-lg">
            <div className="p-2 space-y-1">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : members.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Users className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum sócio cadastrado</p>
                </div>
              ) : (
                members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      {member.status === "pending" && (
                        <div className="h-4 w-4 rounded-full bg-muted" />
                      )}
                      {member.status === "generating" && (
                        <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                      )}
                      {member.status === "success" && (
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                      )}
                      {member.status === "no_filiacao" && (
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                      )}
                      {member.status === "error" && (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-sm font-medium">{member.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {member.status === "no_filiacao" && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                          Sem ficha
                        </Badge>
                      )}
                      {member.status === "error" && (
                        <Badge variant="outline" className="text-red-600 border-red-300">
                          {member.error || "Erro"}
                        </Badge>
                      )}
                      {member.status === "success" && (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                          Gerada
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            {generatedPDFs.length > 0 && (
              <Button onClick={handleDownloadAll} className="gap-2">
                <Download className="h-4 w-4" />
                Baixar {generatedPDFs.length} PDFs
              </Button>
            )}
            <Button
              onClick={handleGenerateAll}
              disabled={generating || loading || members.length === 0}
              className="gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Gerar Fichas
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
