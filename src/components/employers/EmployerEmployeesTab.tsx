import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Users, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Props {
  employerId: string;
  employerCnpj?: string | null;
  clinicId?: string;
}

interface Collaborator {
  id: string;
  name: string;
  cpf: string | null;
  phone: string | null;
  email: string | null;
  registration_number: string | null;
  is_active: boolean | null;
}

const formatCpf = (cpf?: string | null) => {
  const d = (cpf || "").replace(/\D/g, "");
  if (d.length !== 11) return cpf || "-";
  return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
};

export default function EmployerEmployeesTab({ employerId, employerCnpj, clinicId }: Props) {
  const [rows, setRows] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const cnpjDigits = (employerCnpj || "").replace(/\D/g, "");
      const orParts = [`employer_id.eq.${employerId}`];
      if (cnpjDigits.length >= 11) {
        orParts.push(`employer_cnpj.eq.${cnpjDigits}`);
        orParts.push(`employer_cnpj.ilike.%${cnpjDigits}%`);
      }

      let query = supabase
        .from("patients")
        .select("id, name, cpf, phone, email, registration_number, is_active")
        .or(orParts.join(","))
        .order("name");

      if (clinicId) query = query.eq("clinic_id", clinicId);

      const { data, error } = await query.limit(1000);
      if (error) throw error;
      setRows((data || []) as Collaborator[]);
    } catch (e) {
      console.error("Erro ao carregar colaboradores:", e);
      toast.error("Erro ao carregar colaboradores");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (employerId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employerId, employerCnpj, clinicId]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    const digits = term.replace(/\D/g, "");
    return rows.filter(
      (r) =>
        r.name?.toLowerCase().includes(term) ||
        (digits.length >= 3 && (r.cpf || "").replace(/\D/g, "").includes(digits)) ||
        (r.registration_number || "").toLowerCase().includes(term)
    );
  }, [rows, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-teal-600" />
          <h3 className="font-semibold text-slate-800">Colaboradores</h3>
          <Badge variant="outline">{filtered.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por nome, CPF ou matrícula..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 w-64"
            />
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Carregando colaboradores...</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          Nenhum colaborador vinculado a esta empresa.
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-slate-600">
                <th className="p-3 font-medium">Nome</th>
                <th className="p-3 font-medium">CPF</th>
                <th className="p-3 font-medium">Matrícula</th>
                <th className="p-3 font-medium">Telefone</th>
                <th className="p-3 font-medium">Situação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t hover:bg-slate-50/60">
                  <td className="p-3 font-medium text-slate-800">{r.name}</td>
                  <td className="p-3 font-mono text-xs">{formatCpf(r.cpf)}</td>
                  <td className="p-3 text-xs">{r.registration_number || "-"}</td>
                  <td className="p-3 text-xs">{r.phone || "-"}</td>
                  <td className="p-3">
                    <Badge variant="outline" className={r.is_active === false ? "text-red-600 border-red-200" : "text-emerald-700 border-emerald-200"}>
                      {r.is_active === false ? "Inativo" : "Ativo"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
