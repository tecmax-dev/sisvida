import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText,
  Download,
  Mail,
  MessageCircle,
  Loader2,
  CheckCircle,
  XCircle,
  Users,
  CreditCard,
  RefreshCw,
} from "lucide-react";
import { generateFiliacaoPDFBlob } from "@/lib/filiacao-pdf-generator";
import { sendWhatsAppDocument } from "@/lib/whatsapp";

interface MemberWithCard {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  birth_date: string | null;
  gender: string | null;
  // Address fields (DB columns)
  address: string | null;
  street: string | null;
  street_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  cep: string | null;
  registration_number: string | null;
  card_expires_at: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
}

type SendMethod = "download" | "whatsapp" | "email";

interface ProcessResult {
  memberId: string;
  memberName: string;
  success: boolean;
  error?: string;
}

export function BatchFiliacaoDialog({ open, onOpenChange, clinicId }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [members, setMembers] = useState<MemberWithCard[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [sendMethod, setSendMethod] = useState<SendMethod>("download");
  const [progress, setProgress] = useState(0);
  const [currentMember, setCurrentMember] = useState("");
  const [results, setResults] = useState<ProcessResult[]>([]);
  const [sindicato, setSindicato] = useState<any>(null);

  // Fetch members with valid cards
  useEffect(() => {
    if (open && clinicId) {
      fetchMembers();
      fetchSindicato();
    }
  }, [open, clinicId]);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      // expires_at is timestamptz; compare using current timestamp
      const nowIso = new Date().toISOString();

      const { data, error } = await supabase
        .from("patients")
        .select(`
          id,
          name,
          email,
          phone,
          cpf,
          birth_date,
          gender,
          address,
          street,
          street_number,
          complement,
          neighborhood,
          city,
          state,
          cep,
          registration_number,
          patient_cards!inner(expires_at, is_active)
        `)
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .eq("patient_cards.is_active", true)
        .gte("patient_cards.expires_at", nowIso)
        .order("name");

      if (error) throw error;

      const membersWithCards = (data || []).map((m: any) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        phone: m.phone,
        cpf: m.cpf,
        birth_date: m.birth_date,
        gender: m.gender,
        address: m.address,
        street: m.street,
        street_number: m.street_number,
        complement: m.complement,
        neighborhood: m.neighborhood,
        city: m.city,
        state: m.state,
        cep: m.cep,
        registration_number: m.registration_number,
        card_expires_at: m.patient_cards?.[0]?.expires_at || null,
      }));

      setMembers(membersWithCards);
      // Select all by default
      setSelectedMembers(new Set(membersWithCards.map((m: MemberWithCard) => m.id)));
    } catch (error: any) {
      console.error("Error fetching members:", error);
      toast({
        title: "Erro ao carregar associados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSindicato = async () => {
    try {
      const { data: sind } = await supabase
        .from("union_entities")
        .select("razao_social, clinic_id, logo_url, cnpj")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sind) {
        const { data: clinic } = await supabase
          .from("clinics")
          .select("logo_url, city, state_code")
          .eq("id", clinicId)
          .maybeSingle();

        setSindicato({
          razao_social: sind.razao_social,
          logo_url: sind.logo_url || clinic?.logo_url,
          cnpj: sind.cnpj,
          cidade: clinic?.city,
          uf: clinic?.state_code,
        });
      }
    } catch (error) {
      console.error("Error fetching sindicato:", error);
    }
  };

  const toggleMember = (memberId: string) => {
    const newSelected = new Set(selectedMembers);
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId);
    } else {
      newSelected.add(memberId);
    }
    setSelectedMembers(newSelected);
  };

  const toggleAll = () => {
    if (selectedMembers.size === members.length) {
      setSelectedMembers(new Set());
    } else {
      setSelectedMembers(new Set(members.map((m) => m.id)));
    }
  };

  const buildFiliacaoData = async (member: MemberWithCard) => {
    // Try to find sindical_associados record
    let filiacaoData: any = null;
    let dependents: any[] = [];

    if (member.cpf) {
      const { data: filiacao } = await supabase
        .from("sindical_associados")
        .select("*")
        .eq("cpf", member.cpf)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (filiacao) {
        filiacaoData = filiacao;

        const { data: deps } = await supabase
          .from("sindical_associado_dependentes")
          .select("*")
          .eq("associado_id", filiacao.id);
        dependents = deps || [];
      }
    }

    if (!filiacaoData) {
      // Build from patient data
      const { data: patientDeps } = await supabase
        .from("patient_dependents")
        .select("id, name, relationship, birth_date, cpf")
        .eq("patient_id", member.id)
        .eq("is_active", true);

      dependents = (patientDeps || []).map((d) => ({
        id: d.id,
        nome: d.name,
        grau_parentesco: d.relationship || "Dependente",
        data_nascimento: d.birth_date,
        cpf: d.cpf,
      }));

      filiacaoData = {
        id: member.id,
        nome: member.name,
        cpf: member.cpf || "",
        data_nascimento: member.birth_date || "",
        sexo: member.gender,
        email: member.email || "",
        telefone: member.phone || "",
        cep: member.cep,
        logradouro: member.street || member.address,
        numero: member.street_number || member.complement,
        bairro: member.neighborhood,
        cidade: member.city,
        uf: member.state,
        matricula: member.registration_number,
        created_at: new Date().toISOString(),
        aprovado_at: new Date().toISOString(),
      };
    }

    return { filiacaoData, dependents };
  };

  const handleProcess = async () => {
    const selectedList = members.filter((m) => selectedMembers.has(m.id));

    if (selectedList.length === 0) {
      toast({ title: "Selecione pelo menos um associado", variant: "destructive" });
      return;
    }

    // Validate for WhatsApp/Email
    if (sendMethod === "whatsapp") {
      const withoutPhone = selectedList.filter((m) => !m.phone);
      if (withoutPhone.length > 0) {
        toast({
          title: "Alguns associados não têm telefone",
          description: `${withoutPhone.length} associado(s) serão ignorados.`,
          variant: "destructive",
        });
      }
    }

    if (sendMethod === "email") {
      const withoutEmail = selectedList.filter((m) => !m.email);
      if (withoutEmail.length > 0) {
        toast({
          title: "Alguns associados não têm e-mail",
          description: `${withoutEmail.length} associado(s) serão ignorados.`,
          variant: "destructive",
        });
      }
    }

    setProcessing(true);
    setProgress(0);
    setResults([]);

    const processResults: ProcessResult[] = [];

    if (sendMethod === "download") {
      // Generate all PDFs and create a ZIP file
      try {
        // Dynamic import to avoid build issues
        const JSZip = (await import("jszip")).default;
        const zip = new JSZip();

        for (let i = 0; i < selectedList.length; i++) {
          const member = selectedList[i];
          setCurrentMember(member.name);
          setProgress(((i + 1) / selectedList.length) * 100);

          try {
            const { filiacaoData, dependents } = await buildFiliacaoData(member);
            const blob = await generateFiliacaoPDFBlob(filiacaoData, dependents, sindicato);
            const fileName = `ficha-filiacao-${member.name.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30)}.pdf`;
            zip.file(fileName, blob);

            processResults.push({
              memberId: member.id,
              memberName: member.name,
              success: true,
            });
          } catch (error: any) {
            processResults.push({
              memberId: member.id,
              memberName: member.name,
              success: false,
              error: error.message,
            });
          }
        }

        // Generate and download ZIP
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `fichas-filiacao-${new Date().toISOString().split("T")[0]}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({ title: "Fichas geradas com sucesso!", description: `${processResults.filter((r) => r.success).length} PDFs baixados.` });
      } catch (error: any) {
        toast({ title: "Erro ao gerar fichas", description: error.message, variant: "destructive" });
      }
    } else if (sendMethod === "whatsapp") {
      // Send via WhatsApp
      for (let i = 0; i < selectedList.length; i++) {
        const member = selectedList[i];

        if (!member.phone) {
          processResults.push({
            memberId: member.id,
            memberName: member.name,
            success: false,
            error: "Telefone não cadastrado",
          });
          continue;
        }

        setCurrentMember(member.name);
        setProgress(((i + 1) / selectedList.length) * 100);

        try {
          const { filiacaoData, dependents } = await buildFiliacaoData(member);
          const blob = await generateFiliacaoPDFBlob(filiacaoData, dependents, sindicato);

          // Convert to base64
          const pdfBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(",")[1];
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          const result = await sendWhatsAppDocument({
            phone: member.phone,
            clinicId,
            pdfBase64,
            fileName: `ficha-filiacao-${member.name.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30)}.pdf`,
            caption: `📋 *Ficha de Filiação*\n\n${member.name}\n\nDocumento com todos os dados cadastrais e autorização de desconto em folha.`,
          });

          if (!result.success) {
            throw new Error(result.error || "Erro ao enviar WhatsApp");
          }

          processResults.push({
            memberId: member.id,
            memberName: member.name,
            success: true,
          });

          // Rate limit delay
          await new Promise((resolve) => setTimeout(resolve, 1500));
        } catch (error: any) {
          processResults.push({
            memberId: member.id,
            memberName: member.name,
            success: false,
            error: error.message,
          });
        }
      }

      const successCount = processResults.filter((r) => r.success).length;
      toast({
        title: "Envio concluído",
        description: `${successCount} de ${selectedList.length} fichas enviadas por WhatsApp.`,
      });
    } else if (sendMethod === "email") {
      // Send via Email
      for (let i = 0; i < selectedList.length; i++) {
        const member = selectedList[i];

        if (!member.email) {
          processResults.push({
            memberId: member.id,
            memberName: member.name,
            success: false,
            error: "E-mail não cadastrado",
          });
          continue;
        }

        setCurrentMember(member.name);
        setProgress(((i + 1) / selectedList.length) * 100);

        try {
          const { filiacaoData, dependents } = await buildFiliacaoData(member);
          const blob = await generateFiliacaoPDFBlob(filiacaoData, dependents, sindicato);

          // Convert to base64
          const pdfBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(",")[1];
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          const { error } = await supabase.functions.invoke("send-filiacao-pdf-email", {
            body: {
              email: member.email,
              memberName: member.name,
              pdfBase64,
              sindicatoName: sindicato?.razao_social || "Sindicato",
            },
          });

          if (error) throw error;

          processResults.push({
            memberId: member.id,
            memberName: member.name,
            success: true,
          });

          // Rate limit delay
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error: any) {
          processResults.push({
            memberId: member.id,
            memberName: member.name,
            success: false,
            error: error.message,
          });
        }
      }

      const successCount = processResults.filter((r) => r.success).length;
      toast({
        title: "Envio concluído",
        description: `${successCount} de ${selectedList.length} fichas enviadas por e-mail.`,
      });
    }

    setResults(processResults);
    setProcessing(false);
    setCurrentMember("");
  };

  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.filter((r) => !r.success).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Gerar Fichas de Filiação em Lote
          </DialogTitle>
          <DialogDescription>
            Gere e envie fichas de filiação para associados com carteirinha válida
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : processing ? (
          <div className="space-y-4 py-8">
            <div className="text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
              <p className="font-medium">Processando...</p>
              <p className="text-sm text-muted-foreground">{currentMember}</p>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-center text-sm text-muted-foreground">
              {Math.round(progress)}% concluído
            </p>
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">{successCount} sucesso</span>
              </div>
              {failedCount > 0 && (
                <div className="flex items-center gap-2 text-red-600">
                  <XCircle className="h-5 w-5" />
                  <span className="font-medium">{failedCount} erro(s)</span>
                </div>
              )}
            </div>

            {failedCount > 0 && (
              <ScrollArea className="h-[200px] border rounded-lg p-2">
                <div className="space-y-2">
                  {results
                    .filter((r) => !r.success)
                    .map((r) => (
                      <div key={r.memberId} className="flex items-center gap-2 text-sm p-2 bg-red-50 rounded">
                        <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                        <span className="font-medium">{r.memberName}</span>
                        <span className="text-red-600">{r.error}</span>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setResults([]);
                  setProgress(0);
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Gerar Novamente
              </Button>
              <Button onClick={() => onOpenChange(false)}>Fechar</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-4 flex-1 overflow-hidden">
              {/* Summary */}
              <div className="flex items-center gap-4 p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-900">
                <CreditCard className="h-8 w-8 text-emerald-600" />
                <div>
                  <p className="font-medium text-emerald-700 dark:text-emerald-400">
                    {members.length} associados com carteirinha válida
                  </p>
                  <p className="text-sm text-emerald-600 dark:text-emerald-500">
                    {selectedMembers.size} selecionados para geração
                  </p>
                </div>
              </div>

              {/* Send Method */}
              <div className="space-y-2">
                <Label className="font-medium">Método de envio:</Label>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={sendMethod === "download" ? "default" : "outline"}
                    onClick={() => setSendMethod("download")}
                    size="sm"
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Baixar ZIP
                  </Button>
                  <Button
                    variant={sendMethod === "whatsapp" ? "default" : "outline"}
                    onClick={() => setSendMethod("whatsapp")}
                    size="sm"
                    className="gap-2"
                  >
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </Button>
                  <Button
                    variant={sendMethod === "email" ? "default" : "outline"}
                    onClick={() => setSendMethod("email")}
                    size="sm"
                    className="gap-2"
                  >
                    <Mail className="h-4 w-4" />
                    E-mail
                  </Button>
                </div>
              </div>

              {/* Member Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">Selecionar associados:</Label>
                  <Button variant="ghost" size="sm" onClick={toggleAll}>
                    {selectedMembers.size === members.length ? "Desmarcar todos" : "Selecionar todos"}
                  </Button>
                </div>

                <ScrollArea className="h-[250px] border rounded-lg p-2">
                  <div className="space-y-1">
                    {members.map((member) => (
                      <div
                        key={member.id}
                        className={`flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer ${
                          selectedMembers.has(member.id) ? "bg-primary/5" : ""
                        }`}
                        onClick={() => toggleMember(member.id)}
                      >
                        <Checkbox
                          checked={selectedMembers.has(member.id)}
                          onCheckedChange={() => toggleMember(member.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{member.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {member.cpf && <span>{member.cpf}</span>}
                            {sendMethod === "whatsapp" && !member.phone && (
                              <span className="text-red-500">Sem telefone</span>
                            )}
                            {sendMethod === "email" && !member.email && (
                              <span className="text-red-500">Sem e-mail</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleProcess}
                disabled={selectedMembers.size === 0}
                className="gap-2"
              >
                {sendMethod === "download" && <Download className="h-4 w-4" />}
                {sendMethod === "whatsapp" && <MessageCircle className="h-4 w-4" />}
                {sendMethod === "email" && <Mail className="h-4 w-4" />}
                {sendMethod === "download"
                  ? `Baixar ${selectedMembers.size} Fichas`
                  : sendMethod === "whatsapp"
                  ? `Enviar ${selectedMembers.size} por WhatsApp`
                  : `Enviar ${selectedMembers.size} por E-mail`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
