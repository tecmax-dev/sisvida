import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
  issued_at: string;
  expires_at: string | null;
  is_active: boolean;
  notes: string | null;
}

interface ClinicData {
  name: string;
  logo_url: string | null;
}

export default function MobileCardPage() {
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [cardData, setCardData] = useState<CardData | null>(null);
  const [clinic, setClinic] = useState<ClinicData | null>(null);
  const [loading, setLoading] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const patientId = localStorage.getItem("mobile_patient_id");

      if (!patientId) {
        navigate("/app/login");
        return;
      }

      // Fetch patient data
      const { data: patientData, error: patientError } = await supabase
        .from("patients")
        .select("id, name, cpf, photo_url, registration_number, tag, clinic_id")
        .eq("id", patientId)
        .single();

      if (patientError || !patientData) {
        toast({
          title: "Erro",
          description: "Não foi possível carregar seus dados.",
          variant: "destructive",
        });
        navigate("/app/login");
        return;
      }

      setPatient(patientData);

      // Fetch card data
      const { data: cardInfo, error: cardError } = await supabase
        .from("patient_cards")
        .select("*")
        .eq("patient_id", patientId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!cardError && cardInfo) {
        setCardData(cardInfo);
      }

      // Fetch clinic data
      const { data: clinicData } = await supabase
        .from("clinics")
        .select("name, logo_url")
        .eq("id", patientData.clinic_id)
        .single();

      if (clinicData) {
        setClinic(clinicData);
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
        return { status: "expired", label: "Vencida", color: "bg-red-500" };
      }
      if (daysUntilExpiry <= 30) {
        return { status: "expiring_soon", label: "Vence em breve", color: "bg-amber-500" };
      }
    }
    return { status: "active", label: "Ativa", color: "bg-emerald-500" };
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
      url: `${window.location.origin}/card/${patient.id}`,
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-emerald-600 text-white px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate("/app/home")} className="p-1">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Carteirinha Digital</h1>
          <p className="text-xs text-white/80">Sua identificação de associado</p>
        </div>
        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
          <CreditCard className="h-5 w-5" />
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Status Badge */}
        <div className="flex justify-center">
          <Badge className={`${cardStatus.color} text-white px-4 py-1`}>
            {cardStatus.status === "active" && <CheckCircle2 className="h-3 w-3 mr-1" />}
            {cardStatus.status === "expired" && <AlertCircle className="h-3 w-3 mr-1" />}
            {cardStatus.status === "expiring_soon" && <Clock className="h-3 w-3 mr-1" />}
            {cardStatus.label}
          </Badge>
        </div>

        {/* Digital Card */}
        <div ref={cardRef} className="relative mx-auto max-w-[360px]">
          <Card className="overflow-hidden shadow-xl">
            {/* Card Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 p-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {clinic?.logo_url ? (
                    <img
                      src={clinic.logo_url}
                      alt={clinic.name}
                      className="w-12 h-12 rounded-full bg-white object-contain"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                      <Building className="h-6 w-6" />
                    </div>
                  )}
                  <div>
                    <h2 className="font-bold text-lg">SECMI</h2>
                    <p className="text-xs opacity-90">Sindicato dos Comerciários</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Card Body */}
            <CardContent className="p-4 space-y-4">
              {/* Photo and Name */}
              <div className="flex items-center gap-4">
                <div className="w-20 h-24 bg-muted rounded-lg overflow-hidden flex-shrink-0 border-2 border-emerald-200 dark:border-emerald-800">
                  {patient?.photo_url ? (
                    <img
                      src={patient.photo_url}
                      alt={patient.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-emerald-50">
                      <User className="h-10 w-10 text-emerald-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg text-foreground truncate">{patient?.name}</h3>
                  <div className="space-y-1 mt-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Hash className="h-3.5 w-3.5" />
                      <span className="font-mono">
                        {patient?.registration_number || cardData?.card_number || "-"}
                      </span>
                    </div>
                    {patient?.tag && (
                      <Badge variant="outline" className="text-xs">
                        {patient.tag}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* CPF */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">CPF</span>
                <span className="font-mono text-emerald-700 font-medium">
                  {formatCPF(patient?.cpf || null)}
                </span>
              </div>

              {/* Validity */}
              {cardData?.expires_at && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Validade</span>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span
                      className={`font-medium ${
                        cardStatus.status === "expired"
                          ? "text-red-600"
                          : cardStatus.status === "expiring_soon"
                            ? "text-amber-600"
                            : "text-emerald-600"
                      }`}
                    >
                      {format(parseISO(cardData.expires_at), "dd/MM/yyyy")}
                    </span>
                  </div>
                </div>
              )}

              <Separator />

              {/* QR Code */}
              <div className="flex flex-col items-center py-4">
                <div className="bg-white p-3 rounded-xl border shadow-sm">
                  <QRCodeSVG
                    value={`${window.location.origin}/card/${patient?.id}`}
                    size={140}
                    level="H"
                    includeMargin={false}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Apresente este QR Code para validação
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        {cardData && cardStatus.status !== "not_issued" && (
          <div className="flex gap-3 max-w-[360px] mx-auto">
            <Button variant="outline" className="flex-1 h-12" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Baixar
            </Button>
            <Button variant="outline" className="flex-1 h-12" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" />
              Compartilhar
            </Button>
          </div>
        )}

        {/* No Card State */}
        {!cardData && (
          <Card className="border-dashed max-w-[360px] mx-auto">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-8 w-8 text-amber-600" />
              </div>
              <h4 className="font-medium text-foreground mb-2">Carteirinha não emitida</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Sua carteirinha digital ainda não foi emitida. Entre em contato com o sindicato para
                solicitar a emissão.
              </p>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => window.open("https://wa.me/5573999999999", "_blank")}
              >
                Solicitar pelo WhatsApp
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900 max-w-[360px] mx-auto">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <QrCode className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-100 text-sm mb-1">Como usar</h4>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Apresente o QR Code da sua carteirinha digital em estabelecimentos conveniados ou
                  no próprio sindicato para validação do seu status de associado.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
