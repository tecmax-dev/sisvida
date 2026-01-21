import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, FileText, QrCode, Eye, Ban, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useUnionPermissions } from "@/hooks/useUnionPermissions";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CreateAuthorizationDialog } from "./CreateAuthorizationDialog";
import { AuthorizationViewDialog } from "./AuthorizationViewDialog";
import { RevokeAuthorizationDialog } from "./RevokeAuthorizationDialog";

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

export function UnionAuthorizationsPage() {
  const { currentClinic } = useAuth();
  const { canManageMembers } = useUnionPermissions();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [selectedAuthorization, setSelectedAuthorization] = useState<Authorization | null>(null);

  const { data: authorizations = [], isLoading } = useQuery({
    queryKey: ["union-authorizations", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
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
        .eq("clinic_id", currentClinic.id)
        .order("issued_at", { ascending: false });
      
      if (error) throw error;
      return data as Authorization[];
    },
    enabled: !!currentClinic?.id,
  });

  const filteredAuthorizations = authorizations.filter(auth => {
    const matchesSearch = 
      auth.authorization_number.toLowerCase().includes(search.toLowerCase()) ||
      auth.patient?.name?.toLowerCase().includes(search.toLowerCase()) ||
      auth.dependent?.name?.toLowerCase().includes(search.toLowerCase()) ||
      auth.benefit?.name?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || auth.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Ativa</Badge>;
      case "expired":
        return <Badge variant="secondary">Expirada</Badge>;
      case "revoked":
        return <Badge variant="destructive">Revogada</Badge>;
      case "used":
        return <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">Utilizada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleView = (auth: Authorization) => {
    setSelectedAuthorization(auth);
    setViewDialogOpen(true);
  };

  const handleRevoke = (auth: Authorization) => {
    setSelectedAuthorization(auth);
    setRevokeDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-violet-500" />
          <h1 className="text-2xl font-bold">Autorizações</h1>
        </div>
        {canManageMembers() && (
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Autorização
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar autorizações..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativas</SelectItem>
                <SelectItem value="expired">Expiradas</SelectItem>
                <SelectItem value="revoked">Revogadas</SelectItem>
                <SelectItem value="used">Utilizadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Carregando...</p>
            </div>
          ) : filteredAuthorizations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhuma autorização encontrada</p>
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
                {filteredAuthorizations.map((auth) => (
                  <TableRow key={auth.id}>
                    <TableCell className="font-mono text-sm">
                      {auth.authorization_number}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {auth.is_for_dependent ? auth.dependent?.name : auth.patient?.name}
                        </p>
                        {auth.is_for_dependent && (
                          <p className="text-xs text-muted-foreground">
                            Titular: {auth.patient?.name}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p>{auth.benefit?.name}</p>
                        {auth.benefit?.partner_name && (
                          <p className="text-xs text-muted-foreground">{auth.benefit.partner_name}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">
                        {format(new Date(auth.valid_from), "dd/MM/yyyy", { locale: ptBR })} 
                        {" - "}
                        {format(new Date(auth.valid_until), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
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
                          onClick={() => handleView(auth)}
                          title="QR Code"
                        >
                          <QrCode className="h-4 w-4" />
                        </Button>
                        {auth.status === "active" && canManageMembers() && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRevoke(auth)}
                            title="Revogar"
                          >
                            <Ban className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
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
      />

      <AuthorizationViewDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        authorization={selectedAuthorization}
      />

      <RevokeAuthorizationDialog
        open={revokeDialogOpen}
        onOpenChange={setRevokeDialogOpen}
        authorization={selectedAuthorization}
      />
    </div>
  );
}
