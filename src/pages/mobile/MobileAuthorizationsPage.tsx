import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  FileCheck,
  Calendar,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
  Plus,
} from "lucide-react";
import { format, isPast, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { QRCodeSVG } from "qrcode.react";
import { MobileCreateDeclarationDialog } from "@/components/mobile/MobileCreateDeclarationDialog";

interface Authorization {
  id: string;
  authorization_number: string;
  status: string;
  valid_from: string;
  valid_until: string;
  issued_at: string;
  is_for_dependent: boolean;
  notes: string | null;
  validation_hash: string;
  benefit: {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    partner_name: string | null;
  } | null;
  dependent: {
    id: string;
    name: string;
  } | null;
  clinic: {
    id: string;
    slug: string;
  } | null;
}

export default function MobileAuthorizationsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [authorizations, setAuthorizations] = useState<Authorization[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAuth, setSelectedAuth] = useState<Authorization | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [clinicId, setClinicId] = useState<string | null>(null);

  useEffect(() => {
    const storedPatientId = localStorage.getItem('mobile_patient_id');
    const storedClinicId = localStorage.getItem('mobile_clinic_id');
    setPatientId(storedPatientId);
    setClinicId(storedClinicId);
    loadAuthorizations();
  }, []);

  const loadAuthorizations = async () => {
    try {
      const patientId = localStorage.getItem('mobile_patient_id');
      
      if (!patientId) {
        navigate("/app/login");
        return;
      }

      // Fetch authorizations for the patient (as holder)
      const { data, error } = await supabase
        .from("union_authorizations")
        .select(`
          id,
          authorization_number,
          status,
          valid_from,
          valid_until,
          issued_at,
          is_for_dependent,
          notes,
          validation_hash,
          benefit:union_benefits(
            id,
            name,
            description,
            category,
            partner_name
          ),
          dependent:patient_dependents(
            id,
            name
          ),
          clinic:clinics(
            id,
            slug
          )
        `)
        .eq("patient_id", patientId)
        .order("issued_at", { ascending: false });

      if (error) {
        console.error("Error fetching authorizations:", error);
        throw error;
      }

      setAuthorizations(data || []);
    } catch (err) {
      console.error("Error loading authorizations:", err);
      toast({
        title: "Erro",
        description: "Não foi possível carregar suas autorizações.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getAuthStatus = (auth: Authorization) => {
    const validUntil = parseISO(auth.valid_until);
    
    if (auth.status === "revoked") {
      return { label: "Revogada", variant: "destructive" as const, icon: XCircle };
    }
    
    if (isPast(validUntil)) {
      return { label: "Expirada", variant: "secondary" as const, icon: Clock };
    }
    
    return { label: "Válida", variant: "default" as const, icon: CheckCircle2 };
  };

  const isExpiredOrRevoked = (auth: Authorization) => {
    const status = getAuthStatus(auth);
    return status.label !== "Válida";
  };

  const activeAuthorizations = authorizations.filter(a => !isExpiredOrRevoked(a));
  const expiredAuthorizations = authorizations.filter(a => isExpiredOrRevoked(a));

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <p className="text-sm font-medium text-gray-500">Carregando autorizações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="mr-2"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Declarações</h1>
              <p className="text-xs text-gray-500">Seus benefícios autorizados</p>
            </div>
          </div>
          
          {/* New Declaration Button */}
          {patientId && clinicId && (
            <Button
              size="sm"
              onClick={() => setCreateDialogOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4 mr-1" />
              Nova
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-64px)]">
        <div className="p-4 space-y-6">
          {/* Active Authorizations */}
          {activeAuthorizations.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                AUTORIZAÇÕES ATIVAS
              </h2>
              <div className="space-y-3">
                {activeAuthorizations.map((auth) => (
                  <AuthorizationCard
                    key={auth.id}
                    authorization={auth}
                    onClick={() => setSelectedAuth(auth)}
                    disabled={false}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Expired/Revoked Authorizations */}
          {expiredAuthorizations.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-gray-500 mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                AUTORIZAÇÕES EXPIRADAS/REVOGADAS
              </h2>
              <div className="space-y-3 opacity-60">
                {expiredAuthorizations.map((auth) => (
                  <AuthorizationCard
                    key={auth.id}
                    authorization={auth}
                    onClick={() => setSelectedAuth(auth)}
                    disabled={true}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Empty state */}
          {authorizations.length === 0 && (
            <div className="text-center py-12">
              <FileCheck className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">
                Nenhuma autorização encontrada
              </h3>
              <p className="text-sm text-gray-500">
                Você ainda não possui autorizações de benefícios.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Authorization Detail Dialog */}
      <Dialog open={!!selectedAuth} onOpenChange={(open) => !open && setSelectedAuth(null)}>
        <DialogContent className="max-w-md mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-emerald-600" />
              Detalhes da Declaração
            </DialogTitle>
          </DialogHeader>
          {selectedAuth && (
            <AuthorizationDetail
              authorization={selectedAuth}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Create Declaration Dialog */}
      {patientId && clinicId && (
        <MobileCreateDeclarationDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          patientId={patientId}
          clinicId={clinicId}
          onSuccess={loadAuthorizations}
        />
      )}
    </div>
  );
}

interface AuthorizationCardProps {
  authorization: Authorization;
  onClick: () => void;
  disabled: boolean;
}

function AuthorizationCard({ authorization, onClick, disabled }: AuthorizationCardProps) {
  const status = getStatusInfo(authorization);
  const StatusIcon = status.icon;

  return (
    <Card 
      className={`border shadow-sm transition-all ${disabled ? 'bg-gray-50' : 'bg-white hover:shadow-md cursor-pointer active:scale-[0.98]'}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge 
                variant={status.variant}
                className={`text-xs ${status.variant === 'default' ? 'bg-emerald-100 text-emerald-700' : ''}`}
              >
                <StatusIcon className="h-3 w-3 mr-1" />
                {status.label}
              </Badge>
              {authorization.is_for_dependent && (
                <Badge variant="outline" className="text-xs">
                  <User className="h-3 w-3 mr-1" />
                  Dependente
                </Badge>
              )}
            </div>
            
            <h4 className="font-semibold text-sm text-gray-900 truncate">
              {authorization.benefit?.name || "Benefício"}
            </h4>
            
            {authorization.is_for_dependent && authorization.dependent && (
              <p className="text-xs text-gray-500 mt-0.5">
                Para: {authorization.dependent.name}
              </p>
            )}
            
            {authorization.benefit?.partner_name && (
              <p className="text-xs text-gray-500 mt-0.5">
                Parceiro: {authorization.benefit.partner_name}
              </p>
            )}
            
            <div className="flex items-center gap-2 mt-2">
              <Calendar className="h-3 w-3 text-gray-400" />
              <span className="text-xs text-gray-500">
                Válida até: {format(parseISO(authorization.valid_until), "dd/MM/yyyy", { locale: ptBR })}
              </span>
            </div>
          </div>
          
          <div className="text-gray-400 ml-2">
            <ExternalLink className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface AuthorizationDetailProps {
  authorization: Authorization;
}

function AuthorizationDetail({ authorization }: AuthorizationDetailProps) {
  const status = getStatusInfo(authorization);
  const StatusIcon = status.icon;
  const validationUrl = getValidationUrlForAuth(authorization);

  return (
    <div className="space-y-4">
      {/* Status Badge */}
      <div className="flex justify-center">
        <Badge 
          variant={status.variant}
          className={`text-sm px-4 py-1.5 ${status.variant === 'default' ? 'bg-emerald-100 text-emerald-700' : ''}`}
        >
          <StatusIcon className="h-4 w-4 mr-2" />
          {status.label}
        </Badge>
      </div>

      {/* Authorization Number */}
      <div className="text-center">
        <p className="text-xs text-gray-500">Número da Autorização</p>
        <p className="text-lg font-mono font-bold text-gray-900">
          {authorization.authorization_number}
        </p>
      </div>

      {/* QR Code */}
      <div className="flex justify-center p-4 bg-gray-50 rounded-lg">
        <QRCodeSVG 
          value={validationUrl}
          size={150}
          level="M"
          marginSize={4}
        />
      </div>

      {/* Details */}
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Benefício:</span>
          <span className="font-medium text-gray-900">{authorization.benefit?.name}</span>
        </div>
        
        {authorization.benefit?.category && (
          <div className="flex justify-between">
            <span className="text-gray-500">Categoria:</span>
            <span className="text-gray-700">{authorization.benefit.category}</span>
          </div>
        )}
        
        {authorization.benefit?.partner_name && (
          <div className="flex justify-between">
            <span className="text-gray-500">Parceiro:</span>
            <span className="text-gray-700">{authorization.benefit.partner_name}</span>
          </div>
        )}
        
        {authorization.is_for_dependent && authorization.dependent && (
          <div className="flex justify-between">
            <span className="text-gray-500">Beneficiário:</span>
            <span className="text-gray-700">{authorization.dependent.name}</span>
          </div>
        )}
        
        <div className="flex justify-between">
          <span className="text-gray-500">Emitida em:</span>
          <span className="text-gray-700">
            {format(parseISO(authorization.issued_at), "dd/MM/yyyy", { locale: ptBR })}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-500">Válida de:</span>
          <span className="text-gray-700">
            {format(parseISO(authorization.valid_from), "dd/MM/yyyy", { locale: ptBR })}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-500">Válida até:</span>
          <span className={`font-medium ${status.label === 'Válida' ? 'text-emerald-600' : 'text-red-600'}`}>
            {format(parseISO(authorization.valid_until), "dd/MM/yyyy", { locale: ptBR })}
          </span>
        </div>
        
        {authorization.notes && (
          <div className="pt-2 border-t">
            <p className="text-gray-500 mb-1">Observações:</p>
            <p className="text-gray-700 text-sm">{authorization.notes}</p>
          </div>
        )}
      </div>

      {/* Validation Link */}
      <Button
        variant="outline"
        className="w-full"
        onClick={() => window.open(validationUrl, '_blank')}
      >
        <ExternalLink className="h-4 w-4 mr-2" />
        Validar Autorização
      </Button>
    </div>
  );
}

function getStatusInfo(authorization: Authorization) {
  const validUntil = parseISO(authorization.valid_until);
  
  if (authorization.status === "revoked") {
    return { label: "Revogada", variant: "destructive" as const, icon: XCircle };
  }
  
  if (isPast(validUntil)) {
    return { label: "Expirada", variant: "secondary" as const, icon: Clock };
  }
  
  return { label: "Válida", variant: "default" as const, icon: CheckCircle2 };
}

function getValidationUrlForAuth(auth: Authorization) {
  const slug = auth.clinic?.slug || 'sindicato';
  return `${window.location.origin}/autorizacao/${slug}/${auth.validation_hash}`;
}
