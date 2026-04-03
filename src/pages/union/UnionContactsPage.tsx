import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import {
  Users,
  Search,
  RefreshCw,
  Phone,
  User,
  Download,
  Inbox,
} from "lucide-react";

interface EvolutionContact {
  id?: string;
  remoteJid?: string;
  pushName?: string;
  profilePicUrl?: string;
  owner?: string;
}

function extractPhone(remoteJid: string | undefined): string {
  if (!remoteJid) return "";
  return remoteJid.replace(/@.*$/, "");
}

function formatPhone(phone: string) {
  const clean = phone.replace(/\D/g, "");
  if (clean.length === 13 && clean.startsWith("55")) {
    const ddd = clean.slice(2, 4);
    const num = clean.slice(4);
    return `(${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`;
  }
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  return phone;
}

async function fetchEvolutionContacts(): Promise<EvolutionContact[]> {
  const { data, error } = await supabase.functions.invoke("evolution-contacts");
  if (error) throw new Error(error.message || "Erro ao buscar contatos");
  return Array.isArray(data) ? data : [];
}

export default function UnionContactsPage() {
  const [search, setSearch] = useState("");

  const { data: contacts, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["evolution-contacts"],
    queryFn: fetchEvolutionContacts,
    staleTime: 5 * 60 * 1000,
  });

  const filtered = (contacts || [])
    .filter((c) => {
      // Only show real WhatsApp contacts (not groups, status, etc.)
      const jid = c.remoteJid || "";
      if (!jid.endsWith("@s.whatsapp.net")) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      const phone = extractPhone(jid);
      const name = (c.pushName || "").toLowerCase();
      return name.includes(s) || phone.includes(s);
    })
    .sort((a, b) => (a.pushName || "").localeCompare(b.pushName || ""));

  const handleExportCSV = () => {
    if (!filtered.length) return;
    const rows = filtered.map((c) => ({
      Nome: c.pushName || "",
      Telefone: formatPhone(extractPhone(c.remoteJid)),
      JID: c.remoteJid || "",
    }));
    const header = Object.keys(rows[0]).join(",");
    const csv = [header, ...rows.map((r) => Object.values(r).map(v => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contatos_whatsapp.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Contatos WhatsApp
          </h1>
          <p className="text-muted-foreground text-sm">
            Contatos importados da instância Evolution API
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!filtered.length}>
            <Download className="h-4 w-4 mr-1" />
            Exportar CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total de Contatos</p>
                <p className="text-2xl font-bold">{isLoading ? "-" : filtered.length}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-lg">Contatos</CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Inbox className="h-12 w-12 mb-3 opacity-30" />
              <p className="font-medium">Nenhum contato encontrado</p>
              <p className="text-sm">
                {search
                  ? "Tente alterar o termo de busca"
                  : "Clique em Atualizar para importar os contatos da Evolution API"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((contact, idx) => {
                    const phone = extractPhone(contact.remoteJid);
                    return (
                      <TableRow key={contact.remoteJid || idx}>
                        <TableCell className="text-xs text-muted-foreground">
                          {idx + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {contact.profilePicUrl ? (
                              <img
                                src={contact.profilePicUrl}
                                alt=""
                                className="h-8 w-8 rounded-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                                <User className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <span className="font-medium text-sm">
                              {contact.pushName || "Sem nome"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3.5 w-3.5" />
                            {formatPhone(phone)}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
