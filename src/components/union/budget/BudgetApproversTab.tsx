import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, UserCheck, Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BudgetApprover, ApproverRole, ApprovalStatus } from "@/types/unionBudget";

interface BudgetApproversTabProps {
  approvers: BudgetApprover[];
  exerciseId?: string;
  clinicId?: string;
  isEditable: boolean;
}

const approverStatusLabels: Record<ApprovalStatus, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  abstained: 'Abstenção',
};

const approverStatusColors: Record<ApprovalStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  abstained: 'bg-gray-100 text-gray-800',
};

const roleLabels: Record<ApproverRole, string> = {
  elaborator: 'Elaborador',
  reviewer: 'Revisor',
  approver: 'Aprovador',
};

export function BudgetApproversTab({
  approvers,
  exerciseId,
  clinicId,
  isEditable,
}: BudgetApproversTabProps) {
  // Sort approvers - required first, then by role
  const sortedApprovers = [...approvers].sort((a, b) => {
    if (a.is_required !== b.is_required) return a.is_required ? -1 : 1;
    return 0;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Fluxo de Aprovação</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie os responsáveis pela aprovação do orçamento
          </p>
        </div>
        {isEditable && (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Aprovador
          </Button>
        )}
      </div>

      {/* Approval Flow Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fluxo Colegiado</CardTitle>
          <CardDescription>
            O orçamento será aprovado quando todos os aprovadores obrigatórios confirmarem
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sortedApprovers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum aprovador configurado</p>
              <p className="text-sm">Adicione aprovadores para habilitar o fluxo de aprovação</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedApprovers.map((approver, index) => (
                <div 
                  key={approver.id}
                  className="flex items-center gap-4 p-4 rounded-lg border"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-medium">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{approver.user_name || approver.user_email || approver.user_id}</p>
                    <p className="text-sm text-muted-foreground">
                      {roleLabels[approver.role]}
                      {approver.is_required && <span className="text-red-500 ml-1">*</span>}
                    </p>
                  </div>
                  <Badge className={approverStatusColors[approver.approval_status]}>
                    {approver.approval_status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                    {approver.approval_status === 'approved' && <CheckCircle className="h-3 w-3 mr-1" />}
                    {approver.approval_status === 'rejected' && <XCircle className="h-3 w-3 mr-1" />}
                    {approverStatusLabels[approver.approval_status]}
                  </Badge>
                  {approver.approved_at && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(approver.approved_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approvers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lista de Aprovadores</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Obrigatório</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                {isEditable && <TableHead className="w-24">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedApprovers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isEditable ? 6 : 5} className="text-center text-muted-foreground py-8">
                    Nenhum aprovador cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                sortedApprovers.map((approver) => (
                  <TableRow key={approver.id}>
                    <TableCell className="font-medium">
                      {approver.user_name || approver.user_email || approver.user_id}
                    </TableCell>
                    <TableCell>{roleLabels[approver.role]}</TableCell>
                    <TableCell>
                      {approver.is_required ? (
                        <Badge variant="destructive" className="text-xs">Sim</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Não</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={approverStatusColors[approver.approval_status]}>
                        {approverStatusLabels[approver.approval_status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {approver.approved_at 
                        ? format(new Date(approver.approved_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                        : '-'
                      }
                    </TableCell>
                    {isEditable && (
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          Editar
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
