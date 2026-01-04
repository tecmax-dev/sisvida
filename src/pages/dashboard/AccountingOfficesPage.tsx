import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Building2,
  Plus,
  Search,
  Mail,
  Phone,
  Edit,
  Trash2,
  Key,
  Copy,
  RefreshCw,
  Building,
  Link2,
  ExternalLink,
  Loader2
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AccountingOffice {
  id: string;
  clinic_id: string;
  name: string;
  email: string;
  phone?: string;
  contact_name?: string;
  access_code?: string;
  access_code_expires_at?: string;
  portal_last_access_at?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
}

interface Employer {
  id: string;
  name: string;
  cnpj: string;
}

interface OfficeEmployerLink {
  id: string;
  accounting_office_id: string;
  employer_id: string;
}

export default function AccountingOfficesPage() {
  const { currentClinic } = useAuth();
  const [offices, setOffices] = useState<AccountingOffice[]>([]);
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [officeEmployerLinks, setOfficeEmployerLinks] = useState<OfficeEmployerLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [selectedOffice, setSelectedOffice] = useState<AccountingOffice | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    contact_name: "",
    notes: "",
    is_active: true,
  });
  
  const [selectedEmployerIds, setSelectedEmployerIds] = useState<string[]>([]);

  useEffect(() => {
    if (currentClinic?.id) {
      loadData();
    }
  }, [currentClinic?.id]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Carregar escritórios
      const { data: officesData, error: officesError } = await supabase
        .from("accounting_offices")
        .select("*")
        .eq("clinic_id", currentClinic!.id)
        .order("name");

      if (officesError) throw officesError;
      setOffices(officesData || []);

      // Carregar empresas
      const { data: employersData, error: employersError } = await supabase
        .from("employers")
        .select("id, name, cnpj")
        .eq("clinic_id", currentClinic!.id)
        .order("name");

      if (employersError) throw employersError;
      setEmployers(employersData || []);

      // Carregar vínculos
      const { data: linksData, error: linksError } = await supabase
        .from("accounting_office_employers")
        .select("*");

      if (linksError) throw linksError;
      setOfficeEmployerLinks(linksData || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setIsLoading(false);
    }
  };

  const generateAccessCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleOpenDialog = (office?: AccountingOffice) => {
    if (office) {
      setSelectedOffice(office);
      setFormData({
        name: office.name,
        email: office.email,
        phone: office.phone || "",
        contact_name: office.contact_name || "",
        notes: office.notes || "",
        is_active: office.is_active,
      });
    } else {
      setSelectedOffice(null);
      setFormData({
        name: "",
        email: "",
        phone: "",
        contact_name: "",
        notes: "",
        is_active: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.email) {
      toast.error("Nome e e-mail são obrigatórios");
      return;
    }

    setIsSaving(true);
    try {
      if (selectedOffice) {
        // Atualizar
        const { error } = await supabase
          .from("accounting_offices")
          .update({
            name: formData.name,
            email: formData.email.toLowerCase().trim(),
            phone: formData.phone || null,
            contact_name: formData.contact_name || null,
            notes: formData.notes || null,
            is_active: formData.is_active,
          })
          .eq("id", selectedOffice.id);

        if (error) throw error;
        toast.success("Escritório atualizado com sucesso!");
      } else {
        // Criar
        const accessCode = generateAccessCode();
        const { error } = await supabase
          .from("accounting_offices")
          .insert({
            clinic_id: currentClinic!.id,
            name: formData.name,
            email: formData.email.toLowerCase().trim(),
            phone: formData.phone || null,
            contact_name: formData.contact_name || null,
            notes: formData.notes || null,
            is_active: formData.is_active,
            access_code: accessCode,
          });

        if (error) throw error;
        toast.success("Escritório cadastrado com sucesso!");
      }

      setIsDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error("Error saving:", error);
      if (error.code === "23505") {
        toast.error("Já existe um escritório com este e-mail");
      } else {
        toast.error("Erro ao salvar escritório");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedOffice) return;

    try {
      const { error } = await supabase
        .from("accounting_offices")
        .delete()
        .eq("id", selectedOffice.id);

      if (error) throw error;
      toast.success("Escritório excluído com sucesso!");
      setIsDeleteDialogOpen(false);
      loadData();
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Erro ao excluir escritório");
    }
  };

  const handleGenerateNewCode = async (office: AccountingOffice) => {
    const newCode = generateAccessCode();
    
    try {
      const { error } = await supabase
        .from("accounting_offices")
        .update({
          access_code: newCode,
          access_code_expires_at: null,
        })
        .eq("id", office.id);

      if (error) throw error;
      toast.success(`Novo código gerado: ${newCode}`);
      loadData();
    } catch (error) {
      console.error("Error generating code:", error);
      toast.error("Erro ao gerar novo código");
    }
  };

  const copyAccessCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado!");
  };

  const handleOpenLinkDialog = (office: AccountingOffice) => {
    setSelectedOffice(office);
    const currentLinks = officeEmployerLinks
      .filter(l => l.accounting_office_id === office.id)
      .map(l => l.employer_id);
    setSelectedEmployerIds(currentLinks);
    setIsLinkDialogOpen(true);
  };

  const handleSaveLinks = async () => {
    if (!selectedOffice) return;

    setIsSaving(true);
    try {
      // Remover vínculos antigos
      await supabase
        .from("accounting_office_employers")
        .delete()
        .eq("accounting_office_id", selectedOffice.id);

      // Criar novos vínculos
      if (selectedEmployerIds.length > 0) {
        const links = selectedEmployerIds.map(employerId => ({
          accounting_office_id: selectedOffice.id,
          employer_id: employerId,
        }));

        const { error } = await supabase
          .from("accounting_office_employers")
          .insert(links);

        if (error) throw error;
      }

      toast.success("Vínculos atualizados com sucesso!");
      setIsLinkDialogOpen(false);
      loadData();
    } catch (error) {
      console.error("Error saving links:", error);
      toast.error("Erro ao salvar vínculos");
    } finally {
      setIsSaving(false);
    }
  };

  const getLinkedEmployersCount = (officeId: string) => {
    return officeEmployerLinks.filter(l => l.accounting_office_id === officeId).length;
  };

  const filteredOffices = offices.filter(office =>
    office.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    office.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    office.contact_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const portalUrl = currentClinic?.slug 
    ? `${window.location.origin}/portal-contador/${currentClinic.slug}`
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Escritórios de Contabilidade
          </h1>
          <p className="text-muted-foreground">
            Gerencie escritórios contábeis e seus acessos ao portal
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Escritório
        </Button>
      </div>

      {portalUrl && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <ExternalLink className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Portal do Contador</p>
                  <p className="text-sm text-muted-foreground">{portalUrl}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(portalUrl);
                  toast.success("Link copiado!");
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copiar Link
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, e-mail ou contato..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Badge variant="secondary">{offices.length} escritórios</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredOffices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum escritório cadastrado</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => handleOpenDialog()}
              >
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Escritório
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Escritório</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Código de Acesso</TableHead>
                    <TableHead>Empresas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOffices.map((office) => (
                    <TableRow key={office.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{office.name}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {office.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {office.contact_name && (
                          <p className="text-sm">{office.contact_name}</p>
                        )}
                        {office.phone && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {office.phone}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {office.access_code ? (
                          <div className="flex items-center gap-2">
                            <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                              {office.access_code}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => copyAccessCode(office.access_code!)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleGenerateNewCode(office)}
                            >
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleGenerateNewCode(office)}
                          >
                            <Key className="h-3 w-3 mr-1" />
                            Gerar Código
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenLinkDialog(office)}
                        >
                          <Building className="h-4 w-4 mr-1" />
                          {getLinkedEmployersCount(office.id)} empresas
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Badge variant={office.is_active ? "default" : "secondary"}>
                          {office.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(office)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedOffice(office);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Cadastro/Edição */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedOffice ? "Editar Escritório" : "Novo Escritório"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Escritório *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome do escritório"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@escritorio.com.br"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_name">Nome do Contato</Label>
                <Input
                  id="contact_name"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  placeholder="Nome do responsável"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Observações sobre o escritório..."
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Escritório ativo</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Vincular Empresas */}
      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Vincular Empresas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecione as empresas que este escritório poderá visualizar no portal.
            </p>
            <ScrollArea className="h-[300px] border rounded-md p-4">
              <div className="space-y-3">
                {employers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    Nenhuma empresa cadastrada
                  </p>
                ) : (
                  employers.map((employer) => (
                    <div
                      key={employer.id}
                      className="flex items-center space-x-3 p-2 rounded hover:bg-muted"
                    >
                      <Checkbox
                        id={employer.id}
                        checked={selectedEmployerIds.includes(employer.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedEmployerIds([...selectedEmployerIds, employer.id]);
                          } else {
                            setSelectedEmployerIds(
                              selectedEmployerIds.filter((id) => id !== employer.id)
                            );
                          }
                        }}
                      />
                      <label
                        htmlFor={employer.id}
                        className="flex-1 cursor-pointer"
                      >
                        <p className="font-medium text-sm">{employer.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {employer.cnpj?.replace(
                            /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
                            "$1.$2.$3/$4-$5"
                          )}
                        </p>
                      </label>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
            <div className="text-sm text-muted-foreground">
              {selectedEmployerIds.length} empresa(s) selecionada(s)
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLinkDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveLinks} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Vínculos"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Escritório</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o escritório "{selectedOffice?.name}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
