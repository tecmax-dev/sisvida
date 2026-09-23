import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateOnlyToLocalNoon } from "@/lib/date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { AlertTriangle, FileDown, Printer, RefreshCw, X, Plus } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { SINDICATO_CLINIC_ID } from "@/constants/sindicato";

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    (cents || 0) / 100
  );

interface Row {
  id: string;
  value: number;
  due_date: string;
  competence_month: number;
  competence_year: number;
  status: string;
  employers: {
    id: string;
    name: string;
    cnpj: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  contribution_types: { name: string } | null;
}

interface EmployerContact {
  email: string | null;
  phone: string | null;
  office: string | null;
}

interface OfficeInfo {
  name: string;
  phone: string | null;
  email: string | null;
  contact_name: string | null;
}

export default function UnionOverdueReportPage() {
  const { currentClinic, userRoles } = useAuth();
  const resolvedClinic = useMemo(
    () =>
      userRoles.find((r) => r.clinic_id === SINDICATO_CLINIC_ID)?.clinic ||
      currentClinic,
    [currentClinic, userRoles]
  );
  const clinicId = resolvedClinic?.id;

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [hideZero, setHideZero] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [hideDuplicates, setHideDuplicates] = useState<boolean>(false);
  const FILTERS_KEY = "overdue-report-saved-filters";
  const [savedTerms, setSavedTerms] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(FILTERS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((t) => typeof t === "string") : [];
    } catch {
      return [];
    }
  });

  const persistTerms = (terms: string[]) => {
    setSavedTerms(terms);
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify(terms));
    } catch {
      /* ignore */
    }
  };

  const addTermsFromInput = () => {
    const parts = search
      .split(/[,;\n|]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const next = Array.from(new Set([...savedTerms, ...parts]));
    persistTerms(next);
    setSearch("");
  };

  const EXCLUDE_KEY = "overdue-report-excluded-cnpjs";
  const [excludeInput, setExcludeInput] = useState<string>("");
  const [excludedCnpjs, setExcludedCnpjs] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(EXCLUDE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((t) => typeof t === "string") : [];
    } catch {
      return [];
    }
  });

  const persistExcluded = (list: string[]) => {
    setExcludedCnpjs(list);
    try {
      localStorage.setItem(EXCLUDE_KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  };

  const addExcludedFromInput = () => {
    const parts = excludeInput
      .split(/[,;\n|]+/)
      .map((p) => p.replace(/\D/g, ""))
      .filter((p) => p.length >= 8);
    if (!parts.length) {
      toast.error("Informe ao menos um CNPJ válido");
      return;
    }
    persistExcluded(Array.from(new Set([...excludedCnpjs, ...parts])));
    setExcludeInput("");
  };

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["overdue-report", clinicId, startDate, endDate],
    queryFn: async (): Promise<Row[]> => {
      if (!clinicId) return [];
      const today = format(new Date(), "yyyy-MM-dd");
      const upper = endDate || today;

      let query = supabase
        .from("employer_contributions")
        .select(
          `id, value, due_date, competence_month, competence_year, status,
           employers:employer_id(id, name, cnpj, email, phone),
           contribution_types:contribution_type_id(name)`
        )
        .eq("clinic_id", clinicId)
        .in("status", ["overdue", "pending"])
        .lt("due_date", today)
        .lte("due_date", upper)
        .order("due_date", { ascending: true });

      if (startDate) query = query.gte("due_date", startDate);

      // paginate to bypass 1000-row limit
      const all: Row[] = [];
      const pageSize = 1000;
      let from = 0;
      // We already applied order + filters above; clone for pagination
      // Note: supabase-js does not chain range on existing builder if reused; recreate per page
      const runPage = async (offset: number) => {
        let q = supabase
          .from("employer_contributions")
          .select(
            `id, value, due_date, competence_month, competence_year, status,
             employers:employer_id(id, name, cnpj, email, phone),
             contribution_types:contribution_type_id(name)`
          )
          .eq("clinic_id", clinicId)
          .in("status", ["overdue", "pending"])
          .lt("due_date", today)
          .lte("due_date", upper)
          .order("due_date", { ascending: true })
          .order("id", { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (startDate) q = q.gte("due_date", startDate);
        const { data, error } = await q;
        if (error) throw error;
        return (data || []) as unknown as Row[];
      };

      while (true) {
        const chunk = await runPage(from);
        all.push(...chunk);
        if (chunk.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
    enabled: !!clinicId,
  });

  // Load accounting office linkage for the employers in the report
  const employerIds = useMemo(() => {
    const ids = new Set<string>();
    (data || []).forEach((r) => r.employers?.id && ids.add(r.employers.id));
    return Array.from(ids);
  }, [data]);

  const { data: officeMap } = useQuery({
    queryKey: ["overdue-report-offices", clinicId, employerIds.length],
    enabled: !!clinicId && employerIds.length > 0,
    queryFn: async (): Promise<Record<string, OfficeInfo>> => {
      const map: Record<string, OfficeInfo> = {};
      const chunkSize = 200;
      for (let i = 0; i < employerIds.length; i += chunkSize) {
        const chunk = employerIds.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from("accounting_office_employers")
          .select(
            "employer_id, accounting_offices:accounting_office_id(name, phone, email, contact_name)"
          )
          .in("employer_id", chunk);
        if (error) throw error;
        (data || []).forEach((row: any) => {
          const o = row.accounting_offices;
          if (o?.name) {
            map[row.employer_id] = {
              name: o.name,
              phone: o.phone ?? null,
              email: o.email ?? null,
              contact_name: o.contact_name ?? null,
            };
          }
        });
      }
      return map;
    },
  });

  const rows = useMemo(() => {
    let list = data || [];
    if (hideZero) {
      list = list.filter((r) => (r.value || 0) > 0);
    }

    if (hideDuplicates) {
      // Duplicidade = mesma empresa + mesmo tipo de contribuição + mesma
      // competência (mês/ano) + mesmo valor. Mantém apenas o registro mais
      // recente (último conforme a ordenação por vencimento).
      const seen = new Set<string>();
      const result: Row[] = [];
      for (let i = list.length - 1; i >= 0; i--) {
        const r = list[i];
        const key = [
          r.employers?.id ?? "",
          r.contribution_types?.name ?? "",
          r.competence_year,
          r.competence_month,
          r.value,
        ].join("|");
        if (!seen.has(key)) {
          seen.add(key);
          result.unshift(r);
        }
      }
      list = result;
    }


    return list;
  }, [data, hideZero, hideDuplicates]);

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        cnpj: string;
        email: string;
        phone: string;
        office: string;
        office_phone: string;
        office_email: string;
        office_contact: string;
        items: Row[];
        total: number;
      }
    >();
    for (const r of rows) {
      const key = r.employers?.name || "—";
      const off = r.employers?.id ? officeMap?.[r.employers.id] : undefined;
      const g = map.get(key) || {
        name: r.employers?.name || "—",
        cnpj: r.employers?.cnpj || "",
        email: r.employers?.email || "",
        phone: r.employers?.phone || "",
        office: off?.name || "",
        office_phone: off?.phone || "",
        office_email: off?.email || "",
        office_contact: off?.contact_name || "",
        items: [],
        total: 0,
      };
      g.items.push(r);
      g.total += r.value || 0;
      map.set(key, g);
    }
    let list = Array.from(map.values()).sort((a, b) => b.total - a.total);

    const excluded = excludedCnpjs
      .map((c) => c.replace(/\D/g, ""))
      .filter(Boolean);
    if (excluded.length) {
      list = list.filter((g) => {
        const cnpj = (g.cnpj || "").replace(/\D/g, "");
        if (!cnpj) return true;
        return !excluded.some((e) => cnpj === e || cnpj.includes(e));
      });
    }

    const terms = [
      ...savedTerms,
      ...search.split(/[,;\n|]+/),
    ]
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .filter((t) => t !== "todos" && t !== "todas");

    if (!terms.length) return list;

    return list.filter((g) => {
      const name = g.name.toLowerCase();
      const cnpj = (g.cnpj || "").replace(/\D/g, "");
      return terms.some((term) => {
        const digits = term.replace(/\D/g, "");
        if (digits.length >= 2 && cnpj.includes(digits)) return true;
        return name.includes(term);
      });
    });
  }, [rows, search, savedTerms, officeMap, excludedCnpjs]);

  const totals = useMemo(() => {
    const flat = grouped.flatMap((g) => g.items);
    const total = flat.reduce((s, r) => s + (r.value || 0), 0);
    return { total, count: flat.length, employers: grouped.length };
  }, [grouped]);

  const buildPDF = (
    groups: {
      name: string;
      cnpj: string;
      email: string;
      phone: string;
      office: string;
      office_phone: string;
      office_email: string;
      office_contact: string;
      items: Row[];
      total: number;
    }[],
    opts: { singleCompany?: boolean } = {}
  ) => {
    if (!groups.length) {
      toast.error("Nenhum registro para gerar o relatório");
      return;
    }
    const doc = new jsPDF({ orientation: "landscape" });
    const clinicName = resolvedClinic?.name || "Entidade Sindical";

    doc.setFontSize(14);
    doc.text(clinicName, 14, 15);
    doc.setFontSize(11);
    doc.text(
      opts.singleCompany
        ? `Contribuições Vencidas — ${groups[0].name}`
        : "Relatório de Empresas com Contribuições Vencidas",
      14,
      22
    );

    doc.setFontSize(9);
    const periodo =
      (startDate ? `De ${format(parseDateOnlyToLocalNoon(startDate), "dd/MM/yyyy")}` : "Até") +
      ` ${format(parseDateOnlyToLocalNoon(endDate), "dd/MM/yyyy")}`;
    doc.text(`Período de vencimento: ${periodo}`, 14, 28);
    const gCount = groups.length;
    const gItems = groups.reduce((s, g) => s + g.items.length, 0);
    const gTotal = groups.reduce((s, g) => s + g.total, 0);
    doc.text(
      `Empresas: ${gCount}  •  Contribuições: ${gItems}  •  Total vencido: ${formatCurrency(
        gTotal
      )}`,
      14,
      33
    );
    doc.text(
      `Emitido em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
      14,
      38
    );

    const body: any[] = [];
    groups.forEach((g) => {
      const contactParts: string[] = [];
      if (g.cnpj) contactParts.push(`CNPJ: ${g.cnpj}`);
      if (g.phone) contactParts.push(`Tel: ${g.phone}`);
      if (g.email) contactParts.push(`Email: ${g.email}`);
      if (g.office) {
        const offBits: string[] = [g.office];
        if (g.office_contact) offBits.push(`Contato: ${g.office_contact}`);
        if (g.office_phone) offBits.push(`Tel: ${g.office_phone}`);
        if (g.office_email) offBits.push(`Email: ${g.office_email}`);
        contactParts.push(`Escritório: ${offBits.join(" / ")}`);
      }
      body.push([
        {
          content:
            `${g.name}` +
            (contactParts.length ? `\n${contactParts.join("  •  ")}` : "") +
            `\nTotal: ${formatCurrency(g.total)}  (${g.items.length} contribuição(ões))`,
          colSpan: 5,
          styles: {
            fillColor: [30, 64, 175],
            textColor: 255,
            fontStyle: "bold",
          },
        },
      ]);
      g.items.forEach((r) => {
        body.push([
          r.contribution_types?.name || "—",
          `${String(r.competence_month).padStart(2, "0")}/${r.competence_year}`,
          format(parseDateOnlyToLocalNoon(r.due_date), "dd/MM/yyyy"),
          r.status === "overdue" ? "Vencida" : "Pendente",
          { content: formatCurrency(r.value || 0), styles: { halign: "right" } },
        ]);
      });
    });

    autoTable(doc, {
      startY: 44,
      head: [["Tipo", "Competência", "Vencimento", "Status", "Valor"]],
      body,
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      columnStyles: {
        4: { halign: "right" },
      },
      didDrawPage: (data) => {
        const pageCount = (doc as any).internal.getNumberOfPages();
        const pageNumber = data.pageNumber;
        doc.setFontSize(8);
        doc.text(
          `Página ${pageNumber} de ${pageCount}`,
          doc.internal.pageSize.getWidth() - 30,
          doc.internal.pageSize.getHeight() - 6
        );
      },
    });

    const safeName = opts.singleCompany
      ? "_" + groups[0].name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)
      : "";
    doc.save(`inadimplencia${safeName}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
    toast.success("Relatório gerado com sucesso");
  };

  const handleExportPDF = () => buildPDF(grouped);
  const handleExportCompany = (
    g: {
      name: string;
      cnpj: string;
      email: string;
      phone: string;
      office: string;
      office_phone: string;
      office_email: string;
      office_contact: string;
      items: Row[];
      total: number;
    }
  ) => buildPDF([g], { singleCompany: true });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-rose-500" />
            Empresas com Contribuições Vencidas
          </h1>
          <p className="text-muted-foreground text-sm">
            Gere em um clique o relatório em PDF de todas as empresas inadimplentes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button onClick={handleExportPDF} disabled={isLoading || !rows.length}>
            <FileDown className="h-4 w-4 mr-2" />
            Gerar PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
            <Label htmlFor="search" className="text-xs">
              Buscar empresas (nome ou vários CNPJs separados por vírgula)
            </Label>
            <div className="flex gap-2">
              <Input
                id="search"
                placeholder="Ex.: 03025212000111, 12345678000199 ou Todos"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTermsFromInput();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addTermsFromInput}>
                <Plus className="h-4 w-4 mr-1" />
                Salvar
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Digite "Todos" (ou deixe vazio) para listar todas as empresas. Pressione Enter
              para gravar os CNPJs — eles ficam salvos neste navegador.
            </p>
            {savedTerms.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {savedTerms.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1 font-normal">
                    {t}
                    <button
                      type="button"
                      aria-label={`Remover ${t}`}
                      onClick={() => persistTerms(savedTerms.filter((x) => x !== t))}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => persistTerms([])}
                >
                  Limpar todos
                </Button>
              </div>
            )}
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
            <Label htmlFor="excludeCnpj" className="text-xs">
              Excluir CNPJs do relatório (separe por vírgula)
            </Label>
            <div className="flex gap-2">
              <Input
                id="excludeCnpj"
                placeholder="Ex.: 03025212000111, 12.345.678/0001-99"
                value={excludeInput}
                onChange={(e) => setExcludeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addExcludedFromInput();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addExcludedFromInput}>
                <Plus className="h-4 w-4 mr-1" />
                Excluir
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              As empresas com estes CNPJs não aparecem na lista nem no PDF.
            </p>
            {excludedCnpjs.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {excludedCnpjs.map((c) => (
                  <Badge key={c} variant="destructive" className="gap-1 font-normal">
                    {c}
                    <button
                      type="button"
                      aria-label={`Remover ${c}`}
                      onClick={() => persistExcluded(excludedCnpjs.filter((x) => x !== c))}
                      className="hover:opacity-70"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => persistExcluded([])}
                >
                  Limpar exclusões
                </Button>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="startDate" className="text-xs">
              Vencimento a partir de
            </Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="endDate" className="text-xs">
              Vencimento até
            </Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <Checkbox
                checked={hideZero}
                onCheckedChange={(v) => setHideZero(!!v)}
              />
              Ocultar contribuições com valor zerado
            </label>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <Checkbox
                checked={hideDuplicates}
                onCheckedChange={(v) => setHideDuplicates(!!v)}
              />
              Ocultar boletos em duplicidade (mesmo tipo, competência e valor)
            </label>
          </div>
          <div className="flex items-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStartDate("");
                setEndDate(format(new Date(), "yyyy-MM-dd"));
                setHideZero(true);
                setHideDuplicates(false);
                setSearch("");
              }}
            >
              Limpar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Empresas inadimplentes</p>
            <p className="text-2xl font-bold">{totals.employers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Contribuições vencidas</p>
            <p className="text-2xl font-bold">{totals.count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Valor total vencido</p>
            <p className="text-2xl font-bold text-rose-600">
              {formatCurrency(totals.total)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Prévia ({grouped.length} empresa(s))</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : grouped.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhuma contribuição vencida no período.
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-auto">
              <Table className="text-xs">
                <TableHeader className="sticky top-0 bg-muted/60 backdrop-blur z-10">
                  <TableRow>
                    <TableHead className="h-8">Empresa / Contribuição</TableHead>
                    <TableHead className="h-8 w-24">Compet.</TableHead>
                    <TableHead className="h-8 w-28">Vencim.</TableHead>
                    <TableHead className="h-8 w-24">Status</TableHead>
                    <TableHead className="h-8 w-28 text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grouped.map((g) => (
                    <Fragment key={`g-${g.name}`}>
                      <TableRow className="bg-primary/5">
                        <TableCell colSpan={4} className="font-semibold py-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{g.name}</span>
                            {g.cnpj && (
                              <span className="text-muted-foreground font-normal">
                                — CNPJ: {g.cnpj}
                              </span>
                            )}
                            <Badge variant="outline" className="h-5">
                              {g.items.length}
                            </Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs ml-auto"
                              onClick={() => handleExportCompany(g)}
                            >
                              <Printer className="h-3.5 w-3.5 mr-1" />
                              Imprimir empresa
                            </Button>
                          </div>
                          {(g.phone || g.email || g.office) && (
                            <div className="text-[11px] font-normal text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                              {g.phone && <span>📞 {g.phone}</span>}
                              {g.email && <span>✉️ {g.email}</span>}
                              {g.office && (
                                <span>
                                  🏢 {g.office}
                                  {g.office_contact ? ` — ${g.office_contact}` : ""}
                                  {g.office_phone ? ` • ${g.office_phone}` : ""}
                                  {g.office_email ? ` • ${g.office_email}` : ""}
                                </span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-bold text-rose-600 py-1.5">
                          {formatCurrency(g.total)}
                        </TableCell>
                      </TableRow>
                      {g.items.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="py-1 pl-6">
                            {r.contribution_types?.name || "—"}
                          </TableCell>
                          <TableCell className="py-1">
                            {String(r.competence_month).padStart(2, "0")}/{r.competence_year}
                          </TableCell>
                          <TableCell className="py-1 text-rose-600">
                            {format(parseDateOnlyToLocalNoon(r.due_date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="py-1">
                            <Badge
                              variant="outline"
                              className={
                                r.status === "overdue"
                                  ? "border-rose-300 text-rose-700"
                                  : "border-amber-300 text-amber-700"
                              }
                            >
                              {r.status === "overdue" ? "Vencida" : "Pendente"}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-1 text-right tabular-nums">
                            {formatCurrency(r.value || 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
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
