import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoreHorizontal, Phone, ChevronLeft, ChevronRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  trade_name?: string;
  registration_number?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  state?: string | null;
  is_active?: boolean;
}

interface SindSystemEmployersTableProps {
  employers: Employer[];
  onViewContributions: (employerId: string) => void;
  onViewDetails?: (employer: Employer) => void;
}

export function SindSystemEmployersTable({
  employers,
  onViewContributions,
  onViewDetails,
}: SindSystemEmployersTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [perPage, setPerPage] = useState("5");
  const [currentPage, setCurrentPage] = useState(1);

  const formatCNPJ = (cnpj: string) => {
    if (!cnpj) return "";
    const cleaned = cnpj.replace(/\D/g, "");
    return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  };

  const formatPhone = (phone: string | null | undefined) => {
    if (!phone) return null;
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return cleaned.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
    }
    if (cleaned.length === 10) {
      return cleaned.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
    }
    return phone;
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .slice(0, 2)
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase();
  };

  const getInitialColor = (name: string) => {
    const colors = [
      "bg-blue-500",
      "bg-purple-500",
      "bg-green-500",
      "bg-amber-500",
      "bg-red-500",
      "bg-cyan-500",
      "bg-pink-500",
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const filteredEmployers = useMemo(() => {
    if (!searchTerm) return employers;
    const term = searchTerm.toLowerCase();
    return employers.filter(
      (emp) =>
        emp.name.toLowerCase().includes(term) ||
        emp.cnpj.includes(term.replace(/\D/g, "")) ||
        emp.trade_name?.toLowerCase().includes(term) ||
        emp.registration_number?.includes(term)
    );
  }, [employers, searchTerm]);

  const totalPages = Math.ceil(filteredEmployers.length / parseInt(perPage));
  const startIndex = (currentPage - 1) * parseInt(perPage);
  const endIndex = startIndex + parseInt(perPage);
  const paginatedEmployers = filteredEmployers.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const openWhatsApp = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    const fullNumber = cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
    window.open(`https://wa.me/${fullNumber}`, "_blank");
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Select value={perPage} onValueChange={(val) => { setPerPage(val); setCurrentPage(1); }}>
            <SelectTrigger className="w-20 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-slate-500">resultados por página</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Pesquisar</span>
          <Input
            placeholder=""
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-48 h-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left p-4 text-sm font-medium text-slate-600">Nome</th>
              <th className="text-left p-4 text-sm font-medium text-slate-600">Fantasia</th>
              <th className="text-left p-4 text-sm font-medium text-slate-600">CNPJ</th>
              <th className="text-left p-4 text-sm font-medium text-slate-600">Situação</th>
              <th className="text-left p-4 text-sm font-medium text-slate-600">Cidade</th>
              <th className="text-left p-4 text-sm font-medium text-slate-600">UF</th>
              <th className="text-left p-4 text-sm font-medium text-slate-600">Contato</th>
              <th className="text-center p-4 text-sm font-medium text-slate-600">Ações</th>
            </tr>
          </thead>
          <tbody>
            {paginatedEmployers.map((employer) => (
              <tr
                key={employer.id}
                className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
              >
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-9 w-9 rounded-md ${getInitialColor(employer.name)} flex items-center justify-center text-white text-xs font-bold`}
                    >
                      {getInitials(employer.name)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-blue-600 hover:underline cursor-pointer">
                        {employer.name}
                      </p>
                      {employer.registration_number && (
                        <p className="text-xs text-slate-400">ID: {employer.registration_number}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-4 text-sm text-slate-700">
                  {employer.trade_name || "-"}
                </td>
                <td className="p-4 text-sm text-slate-700 font-mono">
                  {formatCNPJ(employer.cnpj)}
                </td>
                <td className="p-4">
                  <Badge
                    variant="outline"
                    className={`${
                      employer.is_active !== false
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-red-50 text-red-700 border-red-200"
                    }`}
                  >
                    {employer.is_active !== false ? "Ativa" : "Inativa"}
                  </Badge>
                </td>
                <td className="p-4 text-sm text-slate-700">
                  {employer.city || "-"}
                </td>
                <td className="p-4 text-sm text-slate-700">
                  {employer.state || "-"}
                </td>
                <td className="p-4">
                  {employer.phone ? (
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-[#25d366] hover:bg-[#20bd5a] text-white text-xs gap-1"
                      onClick={() => openWhatsApp(employer.phone!)}
                    >
                      <Phone className="h-3 w-3" />
                      {formatPhone(employer.phone)}
                    </Button>
                  ) : (
                    <span className="text-slate-400 text-sm">-</span>
                  )}
                </td>
                <td className="p-4 text-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4 text-slate-500" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => onViewContributions(employer.id)}
                        className="cursor-pointer"
                      >
                        Ver Boletos
                      </DropdownMenuItem>
                      {onViewDetails && (
                        <DropdownMenuItem
                          onClick={() => onViewDetails(employer)}
                          className="cursor-pointer"
                        >
                          Ver Detalhes
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="p-4 flex items-center justify-between border-t border-slate-100">
        <p className="text-sm text-slate-500">
          Mostrando de {startIndex + 1} até {Math.min(endIndex, filteredEmployers.length)} de{" "}
          {filteredEmployers.length} registros
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="text-slate-600"
          >
            Anterior
          </Button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            const pageNum = i + 1;
            return (
              <Button
                key={pageNum}
                variant={currentPage === pageNum ? "default" : "ghost"}
                size="sm"
                onClick={() => handlePageChange(pageNum)}
                className={
                  currentPage === pageNum
                    ? "bg-blue-500 hover:bg-blue-600 text-white"
                    : "text-slate-600"
                }
              >
                {pageNum}
              </Button>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="text-slate-600"
          >
            Próximo
          </Button>
        </div>
      </div>
    </div>
  );
}
