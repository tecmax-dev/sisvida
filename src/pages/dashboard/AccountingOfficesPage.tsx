import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCnpjLookup } from "@/hooks/useCnpjLookup";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllEmployers } from "@/lib/supabase-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
  Loader2,
  FileSearch,
  Printer,
  Upload,
  Send
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import AccountingOfficeImportPanel from "@/components/admin/AccountingOfficeImportPanel";
import { CnpjInputCard } from "@/components/ui/cnpj-input-card";
import { SendAccessCodeDialog } from "@/components/portals/SendAccessCodeDialog";
import { BulkSendAccessCodeDialog } from "@/components/portals/BulkSendAccessCodeDialog";
import { MessageCircle } from "lucide-react";

interface AccountingOffice {
  id: string;
  clinic_id: string;
  name: string;
  email: string;
  phone?: string;
  contact_name?: string;
  cnpj?: string;
  trade_name?: string;
  address?: string;
  city?: string;
  state?: string;
  access_code?: string;
  access_code_expires_at?: string;
  portal_last_access_at?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
  legacy_id?: string;
}

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  registration_number?: string | null;
}

interface OfficeEmployerLink {
  id: string;
  accounting_office_id: string;
  employer_id: string;
}

export default function AccountingOfficesPage() {
  const { currentClinic } = useAuth();
  const { lookupCnpj, cnpjLoading } = useCnpjLookup();
  const [offices, setOffices] = useState<AccountingOffice[]>([]);
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [officeEmployerLinks, setOfficeEmployerLinks] = useState<OfficeEmployerLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isSendCodeDialogOpen, setIsSendCodeDialogOpen] = useState(false);
  const [isBulkSendDialogOpen, setIsBulkSendDialogOpen] = useState(false);
  const [selectedOffice, setSelectedOffice] = useState<AccountingOffice | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    contact_name: "",
    cnpj: "",
    trade_name: "",
    address: "",
    city: "",
    state: "",
    notes: "",
    is_active: true,
  });
  
  const [selectedEmployerIds, setSelectedEmployerIds] = useState<string[]>([]);
  const [linkSearchTerm, setLinkSearchTerm] = useState("");

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

      // Carregar empresas - using pagination to avoid 1000 limit
      const employersResult = await fetchAllEmployers<Employer>(currentClinic!.id, {
        select: "id, name, cnpj, registration_number",
        activeOnly: false
      });
      if (employersResult.error) throw employersResult.error;
      setEmployers(employersResult.data);

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
        cnpj: office.cnpj || "",
        trade_name: office.trade_name || "",
        address: office.address || "",
        city: office.city || "",
        state: office.state || "",
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
        cnpj: "",
        trade_name: "",
        address: "",
        city: "",
        state: "",
        notes: "",
        is_active: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCnpjLookup = async () => {
    if (!formData.cnpj) {
      toast.error("Digite um CNPJ para consultar");
      return;
    }

    const data = await lookupCnpj(formData.cnpj);
    if (data) {
      setFormData(prev => ({
        ...prev,
        name: data.razao_social || prev.name,
        trade_name: data.nome_fantasia || "",
        email: data.email || prev.email,
        phone: data.telefone || prev.phone,
        address: data.logradouro ? `${data.logradouro}, ${data.numero} - ${data.bairro}` : "",
        city: data.municipio || "",
        state: data.uf || "",
      }));
    }
  };

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .substring(0, 18);
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
            cnpj: formData.cnpj?.replace(/\D/g, "") || null,
            trade_name: formData.trade_name || null,
            address: formData.address || null,
            city: formData.city || null,
            state: formData.state || null,
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
            cnpj: formData.cnpj?.replace(/\D/g, "") || null,
            trade_name: formData.trade_name || null,
            address: formData.address || null,
            city: formData.city || null,
            state: formData.state || null,
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
    setLinkSearchTerm("");
    setIsLinkDialogOpen(true);
  };

  const filteredEmployersForLink = employers.filter(employer =>
    employer.name.toLowerCase().includes(linkSearchTerm.toLowerCase()) ||
    employer.cnpj?.includes(linkSearchTerm.replace(/\D/g, "")) ||
    employer.registration_number?.includes(linkSearchTerm)
  );

  const handleSelectAllEmployers = () => {
    const filteredIds = filteredEmployersForLink.map(e => e.id);
    const allSelected = filteredIds.every(id => selectedEmployerIds.includes(id));
    
    if (allSelected) {
      setSelectedEmployerIds(selectedEmployerIds.filter(id => !filteredIds.includes(id)));
    } else {
      const newIds = [...new Set([...selectedEmployerIds, ...filteredIds])];
      setSelectedEmployerIds(newIds);
    }
  };

  const handleClearSelection = () => {
    setSelectedEmployerIds([]);
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

  const getLinkedEmployers = (officeId: string) => {
    const linkedIds = officeEmployerLinks
      .filter(l => l.accounting_office_id === officeId)
      .map(l => l.employer_id);
    return employers.filter(e => linkedIds.includes(e.id));
  };

  const formatCNPJForPrint = (cnpj: string) => {
    if (!cnpj) return "-";
    const clean = cnpj.replace(/\D/g, "");
    if (clean.length !== 14) return cnpj;
    return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  };

  const handlePrintEmployersList = (office: AccountingOffice) => {
    const linkedEmployers = getLinkedEmployers(office.id);
    
    if (linkedEmployers.length === 0) {
      toast.error("Nenhuma empresa vinculada a este escritório");
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header com cor
    doc.setFillColor(0, 128, 128);
    doc.rect(0, 0, pageWidth, 40, "F");
    
    // Título
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text("Relatório de Empresas Vinculadas", pageWidth / 2, 18, { align: "center" });
    
    // Subtítulo
    doc.setFontSize(11);
    doc.text(office.name, pageWidth / 2, 28, { align: "center" });
    doc.setFontSize(9);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR", { 
      day: "2-digit", 
      month: "long", 
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })}`, pageWidth / 2, 35, { align: "center" });

    // Resumo
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("Resumo", 14, 52);
    
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Total de empresas vinculadas: ${linkedEmployers.length}`, 14, 60);
    if (office.email) {
      doc.text(`E-mail do escritório: ${office.email}`, 14, 66);
    }

    // Tabela de empresas
    const tableData = linkedEmployers.map((emp, index) => [
      (index + 1).toString(),
      emp.name,
      formatCNPJForPrint(emp.cnpj)
    ]);

    autoTable(doc, {
      startY: 75,
      head: [["#", "Razão Social", "CNPJ"]],
      body: tableData,
      theme: "striped",
      headStyles: { 
        fillColor: [0, 128, 128],
        fontSize: 10,
        fontStyle: "bold"
      },
      bodyStyles: {
        fontSize: 9
      },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: 120 },
        2: { cellWidth: 50 }
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      styles: {
        cellPadding: 3,
        overflow: "linebreak"
      }
    });

    // Footer em todas as páginas
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Página ${i} de ${pageCount} • ${currentClinic?.name || "Eclini"}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
    }

    // Download
    const fileName = `empresas-${office.name.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.pdf`;
    doc.save(fileName);
    toast.success("Relatório gerado com sucesso!");
  };

  const filteredOffices = offices.filter(office => {
    const search = searchTerm.toLowerCase();
    const searchNumbers = searchTerm.replace(/\D/g, ""); // Remove formatação para CNPJ/telefone
    return (
      office.name.toLowerCase().includes(search) ||
      office.email.toLowerCase().includes(search) ||
      office.contact_name?.toLowerCase().includes(search) ||
      office.trade_name?.toLowerCase().includes(search) ||
      (searchNumbers && office.cnpj?.includes(searchNumbers)) ||
      (searchNumbers && office.phone?.includes(searchNumbers))
    );
  });

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
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => setIsBulkSendDialogOpen(true)}
            disabled={offices.filter(o => o.is_active && o.access_code).length === 0}
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Enviar Códigos
          </Button>
          <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Importar
          </Button>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Escritório
          </Button>
        </div>
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
                    <TableHead>Matrícula</TableHead>
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
                        {office.legacy_id ? (
                          <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                            {office.legacy_id}
                          </code>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
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
                        <TooltipProvider>
                          <div className="flex items-center justify-end gap-1">
                            {office.access_code && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-primary hover:text-primary/80 hover:bg-primary/10"
                                    onClick={() => {
                                      setSelectedOffice(office);
                                      setIsSendCodeDialogOpen(true);
                                    }}
                                  >
                                    <Send className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Enviar código por e-mail</TooltipContent>
                              </Tooltip>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handlePrintEmployersList(office)}
                                >
                                  <Printer className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Imprimir lista de empresas</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleOpenDialog(office)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Editar</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => {
                                    setSelectedOffice(office);
                                    setIsDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Excluir</TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
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
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {/* CNPJ com busca automática - Destacado */}
            <CnpjInputCard
              value={formData.cnpj}
              onChange={(value) => setFormData({ ...formData, cnpj: value })}
              onLookup={handleCnpjLookup}
              loading={cnpjLoading}
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Razão Social *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Razão social do escritório"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trade_name">Nome Fantasia</Label>
                <Input
                  id="trade_name"
                  value={formData.trade_name}
                  onChange={(e) => setFormData({ ...formData, trade_name: e.target.value })}
                  placeholder="Nome fantasia"
                />
              </div>
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
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Rua, número - Bairro"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Cidade"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">Estado</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="UF"
                  maxLength={2}
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

      {/* Dialog de Vincular Empresas - Profissional */}
      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent className="w-[min(56rem,calc(100vw-2rem))] max-w-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Vincular Empresas ao Escritório
            </DialogTitle>
            {selectedOffice && (
              <p className="text-sm text-muted-foreground mt-1 truncate">
                {selectedOffice.name}
              </p>
            )}
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Barra de busca e ações */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-start">
              <div className="relative min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, CNPJ ou matrícula..."
                  value={linkSearchTerm}
                  onChange={(e) => setLinkSearchTerm(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>
              <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAllEmployers}
                  className="whitespace-nowrap"
                >
                  {filteredEmployersForLink.length > 0 && 
                   filteredEmployersForLink.every(e => selectedEmployerIds.includes(e.id))
                    ? "Desmarcar Todos"
                    : "Selecionar Todos"}
                </Button>
                {selectedEmployerIds.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearSelection}
                    className="text-destructive hover:text-destructive"
                  >
                    Limpar
                  </Button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  {selectedEmployerIds.length} de {employers.length} empresas selecionadas
                </span>
              </div>
              {linkSearchTerm && (
                <Badge variant="secondary" className="text-xs">
                  {filteredEmployersForLink.length} resultados
                </Badge>
              )}
            </div>

            {/* Lista de empresas */}
            <ScrollArea className="h-[350px] border rounded-lg">
              <div className="p-2">
                {employers.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Building className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="font-medium">Nenhuma empresa cadastrada</p>
                    <p className="text-sm mt-1">Cadastre empresas para poder vinculá-las</p>
                  </div>
                ) : filteredEmployersForLink.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p>Nenhuma empresa encontrada</p>
                    <p className="text-sm mt-1">Tente outro termo de busca</p>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {filteredEmployersForLink.map((employer) => {
                      const isSelected = selectedEmployerIds.includes(employer.id);
                      return (
                        <div
                          key={employer.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedEmployerIds(selectedEmployerIds.filter(id => id !== employer.id));
                            } else {
                              setSelectedEmployerIds([...selectedEmployerIds, employer.id]);
                            }
                          }}
                          className={`
                            flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-all
                            border-2 
                            ${isSelected 
                              ? "border-primary bg-primary/5 shadow-sm" 
                              : "border-transparent bg-muted/30 hover:bg-muted/60 hover:border-muted-foreground/20"
                            }
                          `}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => {}}
                            className="pointer-events-none"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`font-medium truncate ${isSelected ? "text-primary" : ""}`}>
                                {employer.name}
                              </p>
                              {employer.registration_number && (
                                <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                                  {employer.registration_number}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              CNPJ: {employer.cnpj?.replace(
                                /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
                                "$1.$2.$3/$4-$5"
                              ) || "Não informado"}
                            </p>
                          </div>
                          {isSelected && (
                            <Badge variant="default" className="shrink-0">
                              Vinculada
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Resumo das seleções */}
            {selectedEmployerIds.length > 0 && (
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <p className="text-sm font-medium text-primary mb-2">
                  Empresas que serão vinculadas:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedEmployerIds.slice(0, 5).map(id => {
                    const emp = employers.find(e => e.id === id);
                    return emp ? (
                      <Badge key={id} variant="secondary" className="text-xs">
                        {emp.name.length > 20 ? emp.name.substring(0, 20) + "..." : emp.name}
                      </Badge>
                    ) : null;
                  })}
                  {selectedEmployerIds.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{selectedEmployerIds.length - 5} mais
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
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
                <>
                  <Link2 className="h-4 w-4 mr-2" />
                  Salvar Vínculos ({selectedEmployerIds.length})
                </>
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

      {/* Painel de Importação */}
      <AccountingOfficeImportPanel
        clinicId={currentClinic?.id || ""}
        employers={employers}
        existingOffices={offices.map(o => ({ id: o.id, email: o.email, name: o.name }))}
        onImportComplete={loadData}
        isOpen={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
      />

      {/* Dialog de Envio de Código de Acesso */}
      {selectedOffice && (
        <SendAccessCodeDialog
          open={isSendCodeDialogOpen}
          onOpenChange={setIsSendCodeDialogOpen}
          type="accounting_office"
          entityId={selectedOffice.id}
          entityName={selectedOffice.name}
          currentEmail={selectedOffice.email}
          currentPhone={selectedOffice.phone || ""}
        />
      )}

      {/* Dialog de Envio em Lote */}
      <BulkSendAccessCodeDialog
        open={isBulkSendDialogOpen}
        onOpenChange={setIsBulkSendDialogOpen}
        offices={offices}
      />
    </div>
  );
}
