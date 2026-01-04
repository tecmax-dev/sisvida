import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Printer,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Users,
  FileText,
  AlertTriangle,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface LytexSyncResult {
  syncedAt: Date;
  clientsImported: number;
  clientsUpdated: number;
  invoicesImported: number;
  invoicesUpdated: number;
  errors: string[];
  details?: {
    clients?: Array<{
      name: string;
      cnpj: string;
      action: "imported" | "updated";
    }>;
    invoices?: Array<{
      employerName: string;
      competence: string;
      value: number;
      status: string;
      action: "imported" | "updated";
    }>;
  };
}

interface LytexSyncResultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: LytexSyncResult | null;
}

export function LytexSyncResultsDialog({
  open,
  onOpenChange,
  result,
}: LytexSyncResultsDialogProps) {
  if (!result) return null;

  const totalImported = result.clientsImported + result.invoicesImported;
  const totalUpdated = result.clientsUpdated + result.invoicesUpdated;
  const hasErrors = result.errors.length > 0;

  const handlePrint = () => {
    const printContent = document.getElementById("sync-results-print");
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Resultado da Sincronização Lytex</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              max-width: 800px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
              padding-bottom: 10px;
              border-bottom: 2px solid #333;
            }
            .header h1 {
              margin: 0 0 5px 0;
              font-size: 20px;
            }
            .header p {
              margin: 0;
              color: #666;
              font-size: 12px;
            }
            .summary {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 10px;
              margin-bottom: 20px;
            }
            .summary-item {
              background: #f5f5f5;
              padding: 10px;
              border-radius: 4px;
            }
            .summary-item h3 {
              margin: 0 0 5px 0;
              font-size: 14px;
              color: #666;
            }
            .summary-item p {
              margin: 0;
              font-size: 18px;
              font-weight: bold;
            }
            .section {
              margin-bottom: 20px;
            }
            .section h2 {
              font-size: 16px;
              margin-bottom: 10px;
              padding-bottom: 5px;
              border-bottom: 1px solid #ddd;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
            }
            th {
              background: #f5f5f5;
            }
            .badge {
              display: inline-block;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 11px;
              font-weight: bold;
            }
            .badge-success { background: #d4edda; color: #155724; }
            .badge-info { background: #cce5ff; color: #004085; }
            .badge-warning { background: #fff3cd; color: #856404; }
            .badge-danger { background: #f8d7da; color: #721c24; }
            .errors {
              background: #fff3cd;
              padding: 10px;
              border-radius: 4px;
              margin-top: 10px;
            }
            .errors h3 {
              margin: 0 0 10px 0;
              color: #856404;
            }
            .errors ul {
              margin: 0;
              padding-left: 20px;
            }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Resultado da Sincronização Lytex</h1>
            <p>Data: ${format(result.syncedAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
          </div>
          
          <div class="summary">
            <div class="summary-item">
              <h3>Empresas Importadas</h3>
              <p>${result.clientsImported}</p>
            </div>
            <div class="summary-item">
              <h3>Empresas Atualizadas</h3>
              <p>${result.clientsUpdated}</p>
            </div>
            <div class="summary-item">
              <h3>Boletos Importados</h3>
              <p>${result.invoicesImported}</p>
            </div>
            <div class="summary-item">
              <h3>Boletos Atualizados</h3>
              <p>${result.invoicesUpdated}</p>
            </div>
          </div>

          ${result.details?.clients && result.details.clients.length > 0 ? `
            <div class="section">
              <h2>Empresas Processadas (${result.details.clients.length})</h2>
              <table>
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>CNPJ</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  ${result.details.clients.map(client => `
                    <tr>
                      <td>${client.name}</td>
                      <td>${client.cnpj}</td>
                      <td>
                        <span class="badge ${client.action === 'imported' ? 'badge-success' : 'badge-info'}">
                          ${client.action === 'imported' ? 'Importado' : 'Atualizado'}
                        </span>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}

          ${result.details?.invoices && result.details.invoices.length > 0 ? `
            <div class="section">
              <h2>Boletos Processados (${result.details.invoices.length})</h2>
              <table>
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Competência</th>
                    <th>Valor</th>
                    <th>Status</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  ${result.details.invoices.map(invoice => `
                    <tr>
                      <td>${invoice.employerName}</td>
                      <td>${invoice.competence}</td>
                      <td>R$ ${invoice.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td>
                        <span class="badge ${
                          invoice.status === 'paid' ? 'badge-success' :
                          invoice.status === 'overdue' ? 'badge-danger' :
                          'badge-warning'
                        }">
                          ${
                            invoice.status === 'paid' ? 'Pago' :
                            invoice.status === 'overdue' ? 'Vencido' :
                            invoice.status === 'pending' ? 'Pendente' :
                            invoice.status
                          }
                        </span>
                      </td>
                      <td>
                        <span class="badge ${invoice.action === 'imported' ? 'badge-success' : 'badge-info'}">
                          ${invoice.action === 'imported' ? 'Importado' : 'Atualizado'}
                        </span>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}

          ${hasErrors ? `
            <div class="errors">
              <h3>Erros Durante a Sincronização (${result.errors.length})</h3>
              <ul>
                ${result.errors.map(err => `<li>${err}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Resultado da Sincronização Lytex
          </DialogTitle>
        </DialogHeader>

        <div id="sync-results-print" className="space-y-4">
          {/* Summary Cards */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {format(result.syncedAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </div>
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <Users className="h-5 w-5 mx-auto mb-1 text-blue-500" />
              <p className="text-2xl font-bold">{result.clientsImported}</p>
              <p className="text-xs text-muted-foreground">Empresas Importadas</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <Users className="h-5 w-5 mx-auto mb-1 text-green-500" />
              <p className="text-2xl font-bold">{result.clientsUpdated}</p>
              <p className="text-xs text-muted-foreground">Empresas Atualizadas</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <FileText className="h-5 w-5 mx-auto mb-1 text-purple-500" />
              <p className="text-2xl font-bold">{result.invoicesImported}</p>
              <p className="text-xs text-muted-foreground">Boletos Importados</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <FileText className="h-5 w-5 mx-auto mb-1 text-amber-500" />
              <p className="text-2xl font-bold">{result.invoicesUpdated}</p>
              <p className="text-xs text-muted-foreground">Boletos Atualizados</p>
            </div>
          </div>

          {/* Status Summary */}
          <div className="flex items-center gap-4 text-sm">
            {totalImported > 0 && (
              <Badge variant="default" className="gap-1 bg-green-500">
                <CheckCircle2 className="h-3 w-3" />
                {totalImported} importados
              </Badge>
            )}
            {totalUpdated > 0 && (
              <Badge variant="secondary" className="gap-1">
                <RefreshCw className="h-3 w-3" />
                {totalUpdated} atualizados
              </Badge>
            )}
            {hasErrors && (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3 w-3" />
                {result.errors.length} erros
              </Badge>
            )}
          </div>

          <Separator />

          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {/* Clients Details */}
              {result.details?.clients && result.details.clients.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Empresas Processadas ({result.details.clients.length})
                  </h3>
                  <div className="space-y-2">
                    {result.details.clients.map((client, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-muted/30 rounded-lg text-sm"
                      >
                        <div>
                          <p className="font-medium">{client.name}</p>
                          <p className="text-xs text-muted-foreground">{client.cnpj}</p>
                        </div>
                        <Badge
                          variant={client.action === "imported" ? "default" : "secondary"}
                          className={client.action === "imported" ? "bg-green-500" : ""}
                        >
                          {client.action === "imported" ? "Importado" : "Atualizado"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Invoices Details */}
              {result.details?.invoices && result.details.invoices.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Boletos Processados ({result.details.invoices.length})
                  </h3>
                  <div className="space-y-2">
                    {result.details.invoices.map((invoice, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-muted/30 rounded-lg text-sm"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{invoice.employerName}</p>
                          <p className="text-xs text-muted-foreground">
                            Competência: {invoice.competence} • R${" "}
                            {invoice.value.toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              invoice.status === "paid"
                                ? "default"
                                : invoice.status === "overdue"
                                ? "destructive"
                                : "secondary"
                            }
                            className={invoice.status === "paid" ? "bg-green-500" : ""}
                          >
                            {invoice.status === "paid"
                              ? "Pago"
                              : invoice.status === "overdue"
                              ? "Vencido"
                              : invoice.status === "pending"
                              ? "Pendente"
                              : invoice.status}
                          </Badge>
                          <Badge
                            variant={invoice.action === "imported" ? "default" : "outline"}
                            className={invoice.action === "imported" ? "bg-blue-500" : ""}
                          >
                            {invoice.action === "imported" ? "Novo" : "Atualizado"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Errors */}
              {hasErrors && (
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Erros ({result.errors.length})
                  </h3>
                  <div className="space-y-1">
                    {result.errors.map((err, idx) => (
                      <div
                        key={idx}
                        className="p-2 bg-destructive/10 rounded-lg text-sm text-destructive"
                      >
                        {err}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {totalImported === 0 &&
                totalUpdated === 0 &&
                !hasErrors && (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    <p>Nenhum dado novo encontrado na Lytex</p>
                    <p className="text-sm">Todos os registros estão atualizados</p>
                  </div>
                )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
