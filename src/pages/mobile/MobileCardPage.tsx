import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  CreditCard,
  Download,
  Share2,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  User,
  Calendar,
  Hash,
  Building,
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { QRCodeSVG } from "qrcode.react";
import { useMobileAuth } from "@/contexts/MobileAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { parseDateOnlyToLocalNoon } from "@/lib/date";

interface PatientData {
  id: string;
  name: string;
  cpf: string | null;
  photo_url: string | null;
  registration_number: string | null;
  tag: string | null;
  clinic_id: string;
}

interface CardData {
  id: string;
  card_number: string;
  qr_code_token: string;
  issued_at: string;
  expires_at: string | null;
  is_active: boolean;
  notes: string | null;
}

interface ExtraData {
  birth_date: string | null;
  employer_name: string | null;
  employer_cnpj: string | null;
  union_affiliation_date: string | null;
  insurance_plan: { name: string } | null;
}

interface ClinicData {
  name: string;
  logo_url: string | null;
}

/**
 * MOBILE CARD PAGE - Arquitetura Bootstrap Imperativo
 * 
 * ❌ PROIBIDO: restoreSession, getSessionSync, navigate("/app/login")
 * ✅ PERMITIDO: useMobileAuth() para consumir dados já validados
 */
export default function MobileCardPage() {
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [cardData, setCardData] = useState<CardData | null>(null);
  const [clinic, setClinic] = useState<ClinicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [extra, setExtra] = useState<ExtraData | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Consumir dados do contexto de autenticação (já validado pelo bootstrap)
  const { patientId } = useMobileAuth();

  useEffect(() => {
    if (patientId) {
      loadData(patientId);
      loadExtra(patientId);
    } else {
      setLoading(false);
    }
  }, [patientId]);

  const loadData = async (pid: string) => {
    try {
      // Use edge function to bypass RLS (mobile JWT may be expired)
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mobile-patient-card`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patientId: pid }),
        }
      );

      if (!response.ok) {
        toast({
          title: "Erro",
          description: "Não foi possível carregar seus dados.",
          variant: "destructive",
        });
        return;
      }

      const data = await response.json();

      if (data.patient) {
        setPatient(data.patient);
      }

      if (data.card) {
        setCardData(data.card);
      }

      if (data.clinic) {
        setClinic(data.clinic);
      }
    } catch (err) {
      console.error("Error loading data:", err);
      toast({
        title: "Erro",
        description: "Erro ao carregar os dados da carteirinha.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Dados complementares (somente leitura; falha silenciosa não afeta a carteirinha)
  const loadExtra = async (pid: string) => {
    try {
      const { data } = await supabase
        .from("patients")
        .select("birth_date, employer_name, employer_cnpj, union_affiliation_date, insurance_plan:insurance_plans(name)")
        .eq("id", pid)
        .maybeSingle();
      if (data) setExtra(data as any);
    } catch {
      /* opcional */
    }
  };

  const getCardStatus = () => {
    if (!cardData) {
      return { status: "not_issued", label: "Não emitida", color: "bg-muted-foreground" };
    }
    if (!cardData.is_active) {
      return { status: "inactive", label: "Inativa", color: "bg-muted-foreground" };
    }
    if (cardData.expires_at) {
      const expiresAt = parseISO(cardData.expires_at);
      const daysUntilExpiry = differenceInDays(expiresAt, new Date());

      if (daysUntilExpiry < 0) {
        return { status: "expired", label: "Vencida", color: "bg-destructive" };
      }
      if (daysUntilExpiry <= 30) {
        return { status: "expiring_soon", label: "Vence em breve", color: "bg-warning" };
      }
    }
    return { status: "active", label: "Ativa", color: "bg-success" };
  };

  const formatCPF = (cpf: string | null): string => {
    if (!cpf) return "Não informado";
    const digits = cpf.replace(/\D/g, "");
    if (digits.length !== 11) return cpf;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const handleShare = async () => {
    if (!patient || !cardData) return;

    const shareData = {
      title: "Carteirinha Digital SECMI",
      text: `Carteirinha de ${patient.name} - Matrícula: ${patient.registration_number || cardData.card_number}`,
      url: `${window.location.origin}/card/${cardData.qr_code_token}`,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
        toast({
          title: "Link copiado!",
          description: "O link da carteirinha foi copiado para a área de transferência.",
        });
      }
    } catch (err) {
      console.error("Error sharing:", err);
    }
  };

  const handleDownload = () => {
    toast({
      title: "Em breve",
      description: "A função de download estará disponível em breve.",
    });
  };

  const cardStatus = getCardStatus();

  const fmtDate = (d: string | null | undefined) =>
    d ? format(parseDateOnlyToLocalNoon(d.slice(0, 10)), "dd/MM/yyyy") : "—";
  const fmtCnpj = (c: string | null | undefined) => {
    const v = (c || "").replace(/\D/g, "");
    return v.length === 14 ? v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : c || "";
  };
  // Nome longo: mantém primeiro e último nome por extenso e abrevia os do meio
  const shortName = (n: string | undefined, max = 26) => {
    if (!n) return "";
    const name = n.trim().replace(/\s+/g, " ").toUpperCase();
    if (name.length <= max) return name;
    const parts = name.split(" ");
    if (parts.length <= 2) return name;
    const keep = new Set(["DA", "DE", "DO", "DAS", "DOS", "E"]);
    const mid = parts.slice(1, -1).filter((p) => !keep.has(p)).map((p) => `${p[0]}.`);
    return [parts[0], ...mid, parts[parts.length - 1]].join(" ");
  };
  const daysLeft = cardData?.expires_at
    ? differenceInDays(parseDateOnlyToLocalNoon(cardData.expires_at.slice(0, 10)), new Date())
    : null;
  const qrUrl = `${window.location.origin}/card/${cardData?.qr_code_token}`;
  const statusText =
    cardStatus.status === "active" ? "text-success" :
    cardStatus.status === "expiring_soon" ? "text-warning" :
    cardStatus.status === "expired" ? "text-destructive" : "text-muted-foreground";

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="mx-auto mt-16 h-[420px] max-w-[420px] animate-pulse rounded-3xl bg-muted" />
      </div>
    );
  }

  const Field = ({ label, value, mono, wide }: { label: string; value: string; mono?: boolean; wide?: boolean }) => (
    <div className={`min-w-0 ${wide ? "col-span-2" : ""}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`truncate text-[13px] font-semibold text-foreground ${mono ? "font-mono tracking-tight" : ""}`} title={value}>
        {value}
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/40 pb-10">
      {/* Cabeçalho */}
      <div className="sticky top-0 z-20 flex items-center gap-3 bg-mobile px-3 py-3 text-mobile-foreground shadow-sm" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <button onClick={() => navigate("/app/home")} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-mobile-foreground/10" aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold leading-tight">Carteirinha Digital</h1>
          <p className="text-xs opacity-80">Identificação oficial do associado</p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[440px] space-y-4 px-4 pt-5">
        {cardData && (
          <>
            {/* CARTÃO */}
            <div ref={cardRef} className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_18px_40px_-18px_hsl(var(--foreground)/0.35)]">
              {/* Faixa institucional */}
              <div className="relative overflow-hidden bg-mobile px-4 py-3.5 text-mobile-foreground">
                <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-mobile-foreground/10" aria-hidden="true" />
                <div className="pointer-events-none absolute -bottom-16 right-16 h-28 w-28 rounded-full bg-mobile-foreground/5" aria-hidden="true" />
                <div className="relative flex items-center gap-3">
                  <img src="/sindicato/logo.png?v=20260428" alt="SECMI" className="h-11 w-11 shrink-0 rounded-full bg-card object-contain p-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-extrabold leading-none tracking-wide">SECMI</p>
                    <p className="mt-1 truncate text-[10.5px] opacity-90">Sindicato dos Comerciários de Ilhéus e Região</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-mobile-foreground/15 px-2 py-1 text-[9px] font-bold uppercase tracking-widest">Associado</span>
                </div>
              </div>

              {/* Identificação */}
              <div className="flex gap-3.5 p-4">
                <div className="h-[104px] w-[82px] shrink-0 overflow-hidden rounded-xl border-2 border-mobile/25 bg-mobile-soft">
                  {patient?.photo_url ? (
                    <img src={patient.photo_url} alt={patient.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center"><User className="h-9 w-9 text-mobile/50" /></div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Nome</p>
                  <h2 className="line-clamp-2 text-[15px] font-bold leading-snug text-foreground break-words" title={patient?.name}>
                    {shortName(patient?.name, 34)}
                  </h2>
                  <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold ${statusText}`}>
                    {cardStatus.status === "active" && <CheckCircle2 className="h-3.5 w-3.5" />}
                    {cardStatus.status === "expired" && <AlertCircle className="h-3.5 w-3.5" />}
                    {cardStatus.status === "expiring_soon" && <Clock className="h-3.5 w-3.5" />}
                    {cardStatus.label}
                  </div>
                  {patient?.tag && <p className="mt-1.5 truncate text-[11px] font-medium text-mobile">{patient.tag}</p>}
                </div>
              </div>

              {/* Dados */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-dashed border-border px-4 py-3.5">
                <Field label="Matrícula" value={patient?.registration_number || cardData.card_number || "—"} mono />
                <Field label="CPF" value={formatCPF(patient?.cpf || null)} mono />
                <Field label="Nascimento" value={fmtDate(extra?.birth_date)} />
                <Field label="Filiado desde" value={fmtDate(extra?.union_affiliation_date)} />
                {extra?.employer_name && (
                  <Field label="Empresa" value={extra.employer_name.toUpperCase()} wide />
                )}
                {extra?.employer_cnpj && <Field label="CNPJ" value={fmtCnpj(extra.employer_cnpj)} mono />}
                {extra?.insurance_plan?.name && <Field label="Categoria" value={extra.insurance_plan.name} />}
                <Field label="Emissão" value={fmtDate(cardData.issued_at)} />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Validade</p>
                  <p className={`text-[13px] font-bold ${statusText}`}>{fmtDate(cardData.expires_at)}</p>
                </div>
              </div>

              {/* QR */}
              <div className="flex items-center gap-4 border-t border-border bg-muted/40 px-4 py-4">
                <div className="shrink-0 rounded-xl border border-border bg-card p-2 shadow-sm">
                  <QRCodeSVG value={qrUrl} size={104} level="H" includeMargin={false} />
                </div>
                <div className="min-w-0 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">Validação digital</p>
                  <p className="mt-0.5 leading-snug">Apresente este QR Code no sindicato ou em conveniados para confirmar sua situação.</p>
                  <p className="mt-1.5 font-mono text-[10px]">Nº {cardData.card_number}</p>
                </div>
              </div>
            </div>

            {/* Alerta de vencimento */}
            {(cardStatus.status === "expired" || cardStatus.status === "expiring_soon") && (
              <div className={`flex items-center gap-3 rounded-2xl border p-3.5 ${cardStatus.status === "expired" ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5"}`}>
                <AlertCircle className={`h-5 w-5 shrink-0 ${statusText}`} />
                <p className="flex-1 text-sm text-foreground">
                  {cardStatus.status === "expired"
                    ? "Sua carteirinha está vencida."
                    : `Sua carteirinha vence em ${daysLeft} dia${daysLeft === 1 ? "" : "s"}.`}
                </p>
                <Button size="sm" className="bg-mobile text-mobile-foreground hover:bg-mobile/90" onClick={() => navigate("/app/atualizar-carteirinha")}>
                  Renovar
                </Button>
              </div>
            )}

            {cardStatus.status !== "not_issued" && (
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="h-12 rounded-xl" onClick={handleDownload}>
                  <Download className="mr-2 h-4 w-4" /> Baixar
                </Button>
                <Button variant="outline" className="h-12 rounded-xl" onClick={handleShare}>
                  <Share2 className="mr-2 h-4 w-4" /> Compartilhar
                </Button>
              </div>
            )}
          </>
        )}

        {!cardData && (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-warning/10">
                <AlertCircle className="h-8 w-8 text-warning" />
              </div>
              <h4 className="mb-2 font-medium text-foreground">Carteirinha não emitida</h4>
              <p className="mb-4 text-sm text-muted-foreground">
                Sua carteirinha digital ainda não foi emitida. Entre em contato com o sindicato para solicitar a emissão.
              </p>
              <Button size="sm" className="bg-mobile text-mobile-foreground hover:bg-mobile/90" onClick={() => window.open("https://wa.me/557332239980", "_blank")}>
                Solicitar pelo WhatsApp
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3 rounded-2xl border border-border bg-card p-4">
          <QrCode className="h-5 w-5 shrink-0 text-mobile" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            A carteirinha é pessoal e intransferível. Mantenha seus dados atualizados para evitar bloqueios em agendamentos e convênios.
          </p>
        </div>
      </div>
    </div>
  );
}
