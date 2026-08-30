import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Printer, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { SINDICATO_CLINIC_ID } from "@/constants/sindicato";

interface DependentRow {
  id: string;
  name: string;
  cpf: string | null;
  birth_date: string | null;
  relationship: string | null;
  patient_id: string;
}

interface TitularInfo {
  id: string;
  name: string;
  cpf: string | null;
  phone: string | null;
  registration_number: string | null;
}

const formatCPF = (cpf: string | null) => {
  if (!cpf) return "-";
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

export default function UnionDependentsMissingGenderPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["dependents-missing-gender"],
    queryFn: async () => {
      // Busca todos os dependentes ativos sem sexo (loop com range para bypass do limite de 1000)
      const deps: DependentRow[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data: chunk, error } = await supabase
          .from("patient_dependents")
          .select("id, name, cpf, birth_date, relationship, patient_id")
          .eq("clinic_id", SINDICATO_CLINIC_ID)
          .eq("is_active", true)
          .or("gender.is.null,gender.eq.")
          .order("id")
          .range(from, from + pageSize - 1);
        if (error) throw error;
        deps.push(...((chunk || []) as DependentRow[]));
        if (!chunk || chunk.length < pageSize) break;
      }

      if (deps.length === 0) return { deps, titulares: new Map<string, TitularInfo>() };

      // Busca titulares em lotes
      const titularIds = [...new Set(deps.map((d) => d.patient_id))];
      const titulares = new Map<string, TitularInfo>();
      for (let i = 0; i < titularIds.length; i += 200) {
        const batch = titularIds.slice(i, i + 200);
        const { data: pts, error } = await supabase
          .from("patients")
          .select("id, name, cpf, phone, registration_number")
          .in("id", batch);
        if (error) throw error;
        (pts || []).forEach((p) => titulares.set(p.id, p as TitularInfo));
      }

      return { deps, titulares };
    },
  });

  const rows = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    const termDigits = search.replace(/\D/g, "");
    return data.deps
      .map((dep) => ({ dep, titular: data.titulares.get(dep.patient_id) }))
      .filter(({ dep, titular }) => {
        if (!term) return true;
        const inName =
          dep.name.toLowerCase().includes(term) ||
          (titular?.name || "").toLowerCase().includes(term);
        const inCpf =
          termDigits.length > 0 &&
          ((dep.cpf || "").includes(termDigits) ||
            (titular?.cpf || "").replace(/\D/g, "").includes(termDigits));
        return inName || inCpf;
      });
  }, [data, search]);

  const handlePrint = () => {
    if (rows.length === 0) {
      toast.error("Nenhum registro para imprimir.");
      return;
    }
    const escape = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const body = rows
      .map(({ dep, titular }) => {
        const nasc = dep.birth_date
          ? format(new Date(dep.birth_date + "T12:00:00"), "dd/MM/yyyy")
          : "-";
        return `<tr>
          <td>${escape(dep.name)}</td>
          <td>${escape(formatCPF(dep.cpf))}</td>
          <td>${nasc}</td>
          <td>${escape(dep.relationship || "-")}</td>
          <td>${escape(titular?.name || "-")}</td>
          <td>${escape(formatCPF(titular?.cpf || null))}</td>
          <td>${escape(titular?.phone || "-")}</td>
        </tr>`;
      })
      .join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Dependentes sem sexo cadastrado</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#111}
        h1{font-size:18px;margin-bottom:4px}
        p{font-size:12px;color:#555;margin-top:0}
        table{width:100%;border-collapse:collapse;font-size:12px;margin-top:12px}
        th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
        th{background:#f0f0f0}
      </style></head><body>
      <h1>Dependentes sem sexo cadastrado</h1>
      <p>Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")} — Total: ${rows.length} registro(s)</p>
      <table><thead><tr>
        <th>Dependente</th><th>CPF</th><th>Nascimento</th><th>Parentesco</th>
        <th>Titular</th><th>CPF Titular</th><th>Telefone</th>
      </tr></thead><tbody>${body}</tbody></table>
      <script>window.onload=function(){window.print();}</script>
      </body></html>`;

    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Permita pop-ups para imprimir.");
      return;
    }
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            <div>
              <CardTitle className="text-xl">
                Dependentes sem sexo cadastrado
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Estes dependentes estão com agendamentos bloqueados no app até o
                sexo ser informado.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" />
              Imprimir
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Input
              placeholder="Buscar por nome ou CPF (dependente ou titular)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
            <Badge variant="secondary" className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {rows.length} registro(s)
            </Badge>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              Nenhum dependente pendente de sexo. Tudo certo!
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dependente</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Nascimento</TableHead>
                    <TableHead>Parentesco</TableHead>
                    <TableHead>Titular</TableHead>
                    <TableHead>CPF Titular</TableHead>
                    <TableHead>Telefone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(({ dep, titular }) => (
                    <TableRow key={dep.id}>
                      <TableCell className="font-medium">{dep.name}</TableCell>
                      <TableCell>{formatCPF(dep.cpf)}</TableCell>
                      <TableCell>
                        {dep.birth_date
                          ? format(new Date(dep.birth_date + "T12:00:00"), "dd/MM/yyyy")
                          : "-"}
                      </TableCell>
                      <TableCell>{dep.relationship || "-"}</TableCell>
                      <TableCell>{titular?.name || "-"}</TableCell>
                      <TableCell>{formatCPF(titular?.cpf || null)}</TableCell>
                      <TableCell>{titular?.phone || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
