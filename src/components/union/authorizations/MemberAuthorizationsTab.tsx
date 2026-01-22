import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, FileText, QrCode, Eye, ExternalLink, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { useUnionPermissions } from "@/hooks/useUnionPermissions";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CreateAuthorizationDialog } from "./CreateAuthorizationDialog";
import { AuthorizationViewDialog } from "./AuthorizationViewDialog";

interface Props {
  patientId: string;
}

interface Authorization {
  id: string;
  authorization_number: string;
  validation_hash: string;
  valid_from: string;
  valid_until: string;
  status: string;
  is_for_dependent: boolean;
  issued_at: string;
  patient: {
    id: string;
    name: string;
    cpf: string | null;
  };
  dependent?: {
    id: string;
    name: string;
  } | null;
  benefit: {
    id: string;
    name: string;
    partner_name: string | null;
  };
}

export function MemberAuthorizationsTab({ patientId }: Props) {
  const { currentClinic } = useAuth();
  const { canManageMembers } = useUnionPermissions();
  const { toast } = useToast();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedAuthorization, setSelectedAuthorization] = useState<Authorization | null>(null);

  const { data: authorizations = [], isLoading } = useQuery({
    queryKey: ["member-authorizations", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("union_authorizations")
        .select(`
          id,
          authorization_number,
          validation_hash,
          valid_from,
          valid_until,
          status,
          is_for_dependent,
          issued_at,
          patient:patient_id (id, name, cpf),
          dependent:dependent_id (id, name),
          benefit:benefit_id (id, name, partner_name)
        `)
        .eq("patient_id", patientId)
        .order("issued_at", { ascending: false });
      
      if (error) throw error;
      return data as Authorization[];
    },
    enabled: !!patientId,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Ativa</Badge>;
      case "expired":
        return <Badge variant="secondary">Expirada</Badge>;
      case "revoked":
        return <Badge variant="destructive">Revogada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleView = (auth: Authorization) => {
    setSelectedAuthorization(auth);
    setViewDialogOpen(true);
  };

  const handleCopyLink = async (hash: string) => {
    const entitySlug = currentClinic?.slug || "validar";
    const url = `${window.location.origin}/autorizacao/${entitySlug}/${hash}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copiado!" });
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const getAuthorizationUrl = (hash: string) => {
    const entitySlug = currentClinic?.slug || "validar";
    return `${window.location.origin}/autorizacao/${entitySlug}/${hash}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 text-violet-500" />
          Autorizações de Benefícios
        </h3>
        {canManageMembers() && (
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Autorização
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Carregando...</p>
            </div>
          ) : authorizations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <FileText className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">Nenhuma autorização emitida</p>
              {canManageMembers() && (
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Gerar primeira autorização
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Beneficiário</TableHead>
                  <TableHead>Benefício</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {authorizations.map((auth) => (
                  <TableRow key={auth.id}>
                    <TableCell className="font-mono text-sm">
                      {auth.authorization_number}
                    </TableCell>
                    <TableCell>
                      {auth.is_for_dependent ? (
                        <div>
                          <p>{auth.dependent?.name}</p>
                          <p className="text-xs text-muted-foreground">(Dependente)</p>
                        </div>
                      ) : (
                        <span>Titular</span>
                      )}
                    </TableCell>
                    <TableCell>{auth.benefit?.name}</TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(auth.valid_until), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(auth.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleView(auth)}
                          title="Visualizar"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopyLink(auth.validation_hash)}
                          title="Copiar Link"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          title="Abrir Link"
                        >
                          <a 
                            href={getAuthorizationUrl(auth.validation_hash)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateAuthorizationDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        preselectedPatientId={patientId}
      />

      <AuthorizationViewDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        authorization={selectedAuthorization}
      />
    </div>
  );
}
