import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  FileText,
  FileSpreadsheet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

interface LytexReportDataTableProps<T> {
  title?: string;
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
  searchPlaceholder?: string;
  searchFields?: (keyof T)[];
  emptyMessage?: string;
  summary?: { label: string; value: string; color?: string }[];
  onExportPDF?: () => void;
  onExportExcel?: () => void;
  maxHeight?: string;
}

type SortDirection = 'asc' | 'desc' | null;

export function LytexReportDataTable<T extends Record<string, any>>({
  title,
  columns,
  data,
  keyField,
  searchPlaceholder = "Buscar...",
  searchFields = [],
  emptyMessage = "Nenhum registro encontrado",
  summary,
  onExportPDF,
  onExportExcel,
  maxHeight = "500px",
}: LytexReportDataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortKey(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // Search filter
    if (search && searchFields.length > 0) {
      const searchLower = search.toLowerCase();
      result = result.filter((row) =>
        searchFields.some((field) => {
          const value = row[field];
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(searchLower);
        })
      );
    }

    // Sort
    if (sortKey && sortDirection) {
      result.sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];

        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        let comparison = 0;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else {
          comparison = String(aVal).localeCompare(String(bVal), 'pt-BR');
        }

        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [data, search, searchFields, sortKey, sortDirection]);

  const getSortIcon = (key: string) => {
    if (sortKey !== key) return <ArrowUpDown className="h-3.5 w-3.5" />;
    if (sortDirection === 'asc') return <ArrowUp className="h-3.5 w-3.5" />;
    if (sortDirection === 'desc') return <ArrowDown className="h-3.5 w-3.5" />;
    return <ArrowUpDown className="h-3.5 w-3.5" />;
  };

  return (
    <Card>
      {(title || searchFields.length > 0 || onExportPDF || onExportExcel) && (
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {title && <CardTitle className="text-lg">{title}</CardTitle>}
            
            <div className="flex items-center gap-2">
              {searchFields.length > 0 && (
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={searchPlaceholder}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 pr-8"
                  />
                  {search && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-2"
                      onClick={() => setSearch("")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
              
              {onExportPDF && (
                <Button variant="outline" size="sm" onClick={onExportPDF}>
                  <FileText className="h-4 w-4 mr-1.5 text-rose-500" />
                  PDF
                </Button>
              )}
              
              {onExportExcel && (
                <Button variant="outline" size="sm" onClick={onExportExcel}>
                  <FileSpreadsheet className="h-4 w-4 mr-1.5 text-emerald-500" />
                  Excel
                </Button>
              )}
            </div>
          </div>

          {/* Summary Cards */}
          {summary && summary.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-4">
              {summary.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg"
                >
                  <span className="text-xs text-muted-foreground">{item.label}:</span>
                  <span className={cn(
                    "text-sm font-semibold",
                    item.color || "text-foreground"
                  )}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardHeader>
      )}

      <CardContent className="p-0">
        <div className="overflow-auto" style={{ maxHeight }}>
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                {columns.map((column) => (
                  <TableHead
                    key={String(column.key)}
                    className={cn(
                      column.align === 'center' && 'text-center',
                      column.align === 'right' && 'text-right',
                      column.className
                    )}
                  >
                    {column.sortable ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 h-8 hover:bg-transparent"
                        onClick={() => handleSort(String(column.key))}
                      >
                        {column.header}
                        <span className="ml-1">{getSortIcon(String(column.key))}</span>
                      </Button>
                    ) : (
                      column.header
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedData.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="text-center py-8 text-muted-foreground"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedData.map((row) => (
                  <TableRow key={String(row[keyField])}>
                    {columns.map((column) => (
                      <TableCell
                        key={`${String(row[keyField])}-${String(column.key)}`}
                        className={cn(
                          column.align === 'center' && 'text-center',
                          column.align === 'right' && 'text-right',
                          column.className
                        )}
                      >
                        {column.render
                          ? column.render(row)
                          : row[column.key as keyof T] ?? '—'}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        <div className="px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
          {filteredAndSortedData.length} registro(s) {search && `(filtrado de ${data.length})`}
        </div>
      </CardContent>
    </Card>
  );
}
