import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Building2,
  Search,
  FileText,
  Phone,
  Mail,
  MapPin,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Printer,
  Calendar,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  trade_name?: string;
  registration_number?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
}

interface PortalLinkedEmployersListProps {
  employers: Employer[];
  accountingOfficeName: string;
  clinicName?: string;
  onViewContributions?: (employerId: string) => void;
  onScheduleHomologacao?: (employer: Employer) => void;
}

export function PortalLinkedEmployersList({
  employers,
  accountingOfficeName,
  clinicName,
  onViewContributions,
  onScheduleHomologacao,
}: PortalLinkedEmployersListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const formatCNPJ = (cnpj: string) => {
    if (!cnpj) return "";
    const clean = cnpj.replace(/\D/g, "");
    if (clean.length !== 14) return cnpj;
    return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  };

  const filteredEmployers = useMemo(() => {
    if (!searchTerm.trim()) return employers;
    
    const term = searchTerm.toLowerCase().replace(/[.\-\/]/g, "");
    return employers.filter((emp) => {
      const cnpjClean = emp.cnpj?.replace(/\D/g, "") || "";
      const name = emp.name?.toLowerCase() || "";
      const tradeName = emp.trade_name?.toLowerCase() || "";
      
      return (
        cnpjClean.includes(term) ||
        name.includes(term) ||
        tradeName.includes(term)
      );
    });
  }, [employers, searchTerm]);

  const handlePrintList = () => {
    if (employers.length === 0) {
      toast.error("Nenhuma empresa para imprimir");
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 40, "F");

    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text("Relatório de Empresas Vinculadas", pageWidth / 2, 18, { align: "center" });

    doc.setFontSize(11);
    doc.text(accountingOfficeName, pageWidth / 2, 28, { align: "center" });
    doc.setFontSize(9);
    doc.text(
      `Gerado em: ${new Date().toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}`,
      pageWidth / 2,
      35,
      { align: "center" }
    );

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("Resumo", 14, 52);

    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Total de empresas vinculadas: ${employers.length}`, 14, 60);

    const tableData = employers.map((emp, index) => [
      (index + 1).toString(),
      emp.name,
      formatCNPJ(emp.cnpj),
      emp.trade_name || "-",
    ]);

    autoTable(doc, {
      startY: 70,
      head: [["#", "Razão Social", "CNPJ", "Nome Fantasia"]],
      body: tableData,
      theme: "striped",
      headStyles: {
        fillColor: [15, 23, 42],
        fontSize: 10,
        fontStyle: "bold",
      },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: 75 },
        2: { cellWidth: 45 },
        3: { cellWidth: 55 },
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { cellPadding: 3, overflow: "linebreak" },
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Página ${i} de ${pageCount} • ${clinicName || "Portal do Contador"}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
    }

    const fileName = `empresas-${accountingOfficeName.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.pdf`;
    doc.save(fileName);
    toast.success("Relatório gerado com sucesso!");
  };

  return (
    <div className="space-y-4">
      {/* Header with search and print */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por nome ou CNPJ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 border-slate-200"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrintList}
          className="border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          <Printer className="h-4 w-4 mr-2" />
          Imprimir Lista
        </Button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-slate-500">
        <span>
          {filteredEmployers.length} de {employers.length} empresa(s)
        </span>
      </div>

      {/* Employers list */}
      <ScrollArea className="h-[500px]">
        <div className="space-y-2 pr-4">
          {filteredEmployers.length === 0 ? (
            <Card className="border-dashed border-slate-300">
              <CardContent className="py-8 text-center text-slate-500">
                <Building2 className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                <p>Nenhuma empresa encontrada</p>
                {searchTerm && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setSearchTerm("")}
                    className="mt-2"
                  >
                    Limpar busca
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredEmployers.map((employer) => {
              const isExpanded = expandedId === employer.id;
              
              return (
                <Card
                  key={employer.id}
                  className={`border transition-all duration-200 ${
                    isExpanded
                      ? "border-teal-200 bg-teal-50/30 shadow-sm"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <CardContent className="p-4">
                    {/* Main row */}
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isExpanded ? "bg-teal-100" : "bg-slate-100"
                        }`}
                      >
                        <Building2
                          className={`h-5 w-5 ${
                            isExpanded ? "text-teal-600" : "text-slate-500"
                          }`}
                        />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-slate-900 truncate">
                            {employer.trade_name || employer.name}
                          </h3>
                          {employer.registration_number && (
                            <Badge variant="outline" className="text-xs border-slate-300 text-slate-500">
                              Mat. {employer.registration_number}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 truncate">
                          {formatCNPJ(employer.cnpj)}
                          {employer.trade_name && ` • ${employer.name}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 sm:gap-2">
                        {onScheduleHomologacao && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              onScheduleHomologacao(employer);
                            }}
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          >
                            <Calendar className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">Homologação</span>
                          </Button>
                        )}
                        {onViewContributions && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onViewContributions(employer.id)}
                            className="text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                          >
                            <FileText className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">Contribuições</span>
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setExpandedId(isExpanded ? null : employer.id)}
                          className="text-slate-500 hover:text-slate-700"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {employer.phone && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Phone className="h-4 w-4 text-slate-400" />
                            <span>{employer.phone}</span>
                          </div>
                        )}
                        {employer.email && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Mail className="h-4 w-4 text-slate-400" />
                            <span className="truncate">{employer.email}</span>
                          </div>
                        )}
                        {(employer.address || employer.city) && (
                          <div className="flex items-start gap-2 text-sm text-slate-600 sm:col-span-2">
                            <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                            <span>
                              {[employer.address, employer.city, employer.state]
                                .filter(Boolean)
                                .join(", ")}
                            </span>
                          </div>
                        )}
                        {!employer.phone && !employer.email && !employer.address && !employer.city && (
                          <p className="text-sm text-slate-400 italic">
                            Nenhuma informação adicional disponível
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
