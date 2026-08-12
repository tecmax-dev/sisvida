
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Clock, AlertCircle, XCircle, ArrowRight, Filter } from 'lucide-react';

interface AuditFlowItem {
  id: string;
  stage: string;
  status: 'completed' | 'current' | 'pending' | 'rejected';
  timestamp?: Date;
  description: string;
  details?: string;
  reviewer?: string;
  comments?: string;
}

export const HomologacaoFluxoAudit: React.FC = () => {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const flowData: AuditFlowItem[] = [
    {
      id: '1',
      stage: 'Submissão de Documentos',
      status: 'completed',
      timestamp: new Date('2024-01-15'),
      description: 'Documentação inicial enviada para análise',
      details: 'Todos os documentos obrigatórios foram recebidos',
      reviewer: 'Sistema',
    },
    {
      id: '2',
      stage: 'Análise Preliminar',
      status: 'completed',
      timestamp: new Date('2024-01-16'),
      description: 'Verificação de conformidade básica',
      details: 'Documentação está completa e legível',
      reviewer: 'Ana Silva',
    },
    {
      id: '3',
      stage: 'Análise Técnica',
      status: 'current',
      description: 'Validação de requisitos técnicos e operacionais',
      details: 'Em progresso - Última atualização 2 horas atrás',
      reviewer: 'Carlos Santos',
    },
    {
      id: '4',
      stage: 'Análise de Conformidade',
      status: 'pending',
      description: 'Verificação de conformidade regulatória',
      reviewer: 'Mariana Costa',
    },
    {
      id: '5',
      stage: 'Aprovação Final',
      status: 'pending',
      description: 'Decisão final da homologação',
      reviewer: 'Gerência',
    },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-6 h-6 text-green-500" />;
      case 'current':
        return <Clock className="w-6 h-6 text-blue-500 animate-spin" />;
      case 'pending':
        return <AlertCircle className="w-6 h-6 text-yellow-500" />;
      case 'rejected':
        return <XCircle className="w-6 h-6 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return 'status-approved';
      case 'current':
        return 'status-in-review';
      case 'pending':
        return 'status-pending';
      case 'rejected':
        return 'status-rejected';
      default:
        return '';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Concluído';
      case 'current':
        return 'Em Andamento';
      case 'pending':
        return 'Aguardando';
      case 'rejected':
        return 'Rejeitado';
      default:
        return '';
    }
  };

  const filteredData = flowData.filter((item) => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'pending' && (item.status === 'pending' || item.status === 'current')) return true;
    if (selectedFilter === 'approved' && item.status === 'completed') return true;
    if (selectedFilter === 'rejected' && item.status === 'rejected') return true;
    return false;
  });

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Auditoria de Fluxo de Homologação</h1>
          <p className="text-muted-foreground mt-2">Acompanhe o progresso da homologação em tempo real</p>
        </div>
        
        <div className="section-badge-homologacao">
          <span className="w-2 h-2 rounded-full bg-current"></span>
          Em Processamento
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-homologacao p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Etapas Concluídas</p>
              <p className="stat-value-homologacao">2/5</p>
            </div>
            <div className="stat-decoration-homologacao"></div>
          </div>
        </Card>

        <Card className="card-homologacao p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Em Análise</p>
              <p className="stat-value-homologacao">1</p>
            </div>
            <Clock className="w-8 h-8 text-[hsl(var(--homologacao-info))]" />
          </div>
        </Card>

        <Card className="card-homologacao p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Aguardando</p>
              <p className="stat-value-homologacao">2</p>
            </div>
            <AlertCircle className="w-8 h-8 text-[hsl(var(--homologacao-warning))]" />
          </div>
        </Card>

        <Card className="card-homologacao p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Tempo Decorrido</p>
              <p className="stat-value-homologacao">3d</p>
            </div>
            <Clock className="w-8 h-8 text-[hsl(var(--homologacao-primary))]" />
          </div>
        </Card>
      </div>

      {/* Filter Section */}
      <div className="flex gap-2">
        <Button
          variant={selectedFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedFilter('all')}
          className={selectedFilter === 'all' ? 'bg-[hsl(var(--homologacao-primary))]' : ''}
        >
          <Filter className="w-4 h-4 mr-2" />
          Todos
        </Button>
        <Button
          variant={selectedFilter === 'approved' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedFilter('approved')}
        >
          Aprovados
        </Button>
        <Button
          variant={selectedFilter === 'pending' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedFilter('pending')}
        >
          Pendentes
        </Button>
        <Button
          variant={selectedFilter === 'rejected' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedFilter('rejected')}
        >
          Rejeitados
        </Button>
      </div>

      {/* Timeline Flow */}
      <div className="space-y-2">
        {filteredData.map((item, index) => (
          <div key={item.id} className="relative">
            <Card className="card-homologacao overflow-hidden">
              <div className="p-6">
                <div className="flex items-start gap-4">
                  {/* Status Icon */}
                  <div className="flex-shrink-0 mt-1">
                    {getStatusIcon(item.status)}
                  </div>

                  {/* Content */}
                  <div className="flex-grow">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-foreground">
                        {item.stage}
                      </h3>
                      <Badge className={`badge-homologacao ${getStatusBadge(item.status)}`}>
                        {getStatusLabel(item.status)}
                      </Badge>
                    </div>

                    <p className="text-sm text-muted-foreground mb-3">
                      {item.description}
                    </p>

                    {item.details && (
                      <div className="alert-homologacao info mb-3">
                        <AlertDescription className="text-sm text-[hsl(var(--homologacao-info))]">
                          {item.details}
                        </AlertDescription>
                      </div>
                    )}

                    {item.comments && (
                      <div className="bg-card/50 rounded p-3 mb-3 border-l-4 border-[hsl(var(--homologacao-primary))]">
                        <p className="text-sm text-muted-foreground">
                          <span className="font-semibold">Comentário: </span>
                          {item.comments}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {item.reviewer && (
                          <span>Revisor: <span className="font-semibold">{item.reviewer}</span></span>
                        )}
                        {item.timestamp && (
                          <span>
                            {item.timestamp.toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}
                          </span>
                        )}
                      </div>

                      {item.status === 'completed' && (
                        <ArrowRight className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Timeline Connector */}
            {index < filteredData.length - 1 && (
              <div className="timeline-line"></div>
            )}
          </div>
        ))}
      </div>

      {/* Actions Section */}
      <div className="flex gap-3 pt-6">
        <Button className="btn-homologacao">
          Enviar Documentação Adicional
        </Button>
        <Button className="btn-homologacao-secondary">
          Contato com Revisor
        </Button>
        <Button variant="outline">
          Exportar Relatório
        </Button>
      </div>
    </div>
  );
};
