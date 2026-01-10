import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PreviewTableProps {
  headers: string[];
  rows: Record<string, unknown>[];
  maxRows?: number;
  highlightedColumns?: string[];
  errorRows?: number[];
  warningRows?: number[];
}

export function PreviewTable({
  headers,
  rows,
  maxRows = 10,
  highlightedColumns = [],
  errorRows = [],
  warningRows = [],
}: PreviewTableProps) {
  const displayRows = rows.slice(0, maxRows);
  const remainingRows = rows.length - maxRows;

  if (headers.length === 0 || rows.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum dado para exibir
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Exibindo {displayRows.length} de {rows.length} linhas
        </span>
        <span>{headers.length} colunas detectadas</span>
      </div>

      <ScrollArea className="h-[400px] rounded-md border">
        <Table>
          <TableHeader className="sticky top-0 bg-muted/90 backdrop-blur-sm z-10">
            <TableRow>
              <TableHead className="w-12 text-center">#</TableHead>
              {headers.map((header, index) => (
                <TableHead
                  key={index}
                  className={cn(
                    "min-w-[120px]",
                    highlightedColumns.includes(header) && "bg-primary/10 font-semibold"
                  )}
                >
                  {header}
                  {highlightedColumns.includes(header) && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      Mapeado
                    </Badge>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.map((row, rowIndex) => (
              <TableRow
                key={rowIndex}
                className={cn(
                  errorRows.includes(rowIndex + 1) && "bg-destructive/10",
                  warningRows.includes(rowIndex + 1) && "bg-yellow-500/10"
                )}
              >
                <TableCell className="text-center text-muted-foreground font-mono text-xs">
                  {rowIndex + 1}
                </TableCell>
                {headers.map((header, colIndex) => (
                  <TableCell
                    key={colIndex}
                    className={cn(
                      "max-w-[200px] truncate",
                      highlightedColumns.includes(header) && "bg-primary/5"
                    )}
                    title={String(row[header] ?? '')}
                  >
                    {formatCellValue(row[header])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>

      {remainingRows > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          + {remainingRows} linhas adicionais não exibidas
        </p>
      )}
    </div>
  );
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  const str = String(value).trim();
  if (str.length > 50) return str.slice(0, 47) + '...';
  return str || '-';
}
