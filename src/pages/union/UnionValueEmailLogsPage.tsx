import { useEffect, useState } from "react";
import { Mail, Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SINDICATO_CLINIC_ID } from "@/constants/sindicato";

interface LogRow {
  id: string;
  created_at: string;
  employer_name: string | null;
  portal_type: string | null;
  document_number: string | null;
  invoice_url: string | null;
  recipient: string | null;
  status: string;
  error_message: string | null;
}

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  sent: { label: "Enviado", variant: "default" },
  pending: { label: "Enviando", variant: "secondary" },
  failed: { label: "Falhou", variant: "destructive" },
};

const ORIGEM: Record<string, string> = {
  employer: "Portal da Empresa",
  accounting_office: "Portal do Contador",
  public_token: "Link público",
};

export default function UnionValueEmailLogsPage() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("contribution_value_email_logs")
      .select("id, created_at, employer_name, portal_type, document_number, invoice_url, recipient, status, error_message")
      .eq("clinic_id", SINDICATO_CLINIC_ID)
      .order("created_at", { ascending: false })
      .limit(500);
    setRows((data as LogRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? rows.filter((r) => `${r.employer_name ?? ""} ${r.document_number ?? ""}`.toLowerCase().includes(q))
    : rows;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" /> E-mails de alteração de boleto
          </h1>
          <p className="text-muted-foreground">Avisos enviados ao sindicato quando uma empresa ou contador informa o valor de uma contribuição.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Histórico</CardTitle>
          <Input placeholder="Buscar por empresa ou n° do documento" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">Nenhum e-mail registrado ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>N° documento</TableHead>
                  <TableHead>Enviado para</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Boleto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const st = STATUS[r.status] ?? { label: r.status, variant: "outline" as const };
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell>{r.employer_name ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{ORIGEM[r.portal_type ?? ""] ?? "—"}</TableCell>
                      <TableCell>{r.document_number ?? "—"}</TableCell>
                      <TableCell className="text-sm">{r.recipient ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={st.variant}>{st.label}</Badge>
                        {r.status === "failed" && r.error_message && (
                          <p className="mt-1 text-xs text-destructive max-w-[220px]">{r.error_message}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.invoice_url ? (
                          <Button asChild size="sm" variant="ghost">
                            <a href={r.invoice_url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-1" />Abrir</a>
                          </Button>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
