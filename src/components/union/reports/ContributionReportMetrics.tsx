import { Card, CardContent } from "@/components/ui/card";
import { 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Percent,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReportSummary {
  totalValue: number;
  paidValue: number;
  pendingValue: number;
  overdueValue: number;
  totalCount: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  employerCount: number;
  paymentRate: number;
  defaultRate: number;
}

interface ContributionReportMetricsProps {
  summary: ReportSummary;
  isLoading?: boolean;
}

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
};

const formatPercent = (value: number) => {
  return `${value.toFixed(1)}%`;
};

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color: 'slate' | 'emerald' | 'amber' | 'rose' | 'blue' | 'indigo';
  className?: string;
}

function MetricCard({ title, value, subtitle, icon, trend, trendValue, color, className }: MetricCardProps) {
  const colorClasses = {
    slate: {
      border: 'border-l-slate-600',
      icon: 'bg-slate-100 text-slate-600',
      value: 'text-slate-900',
    },
    emerald: {
      border: 'border-l-emerald-500',
      icon: 'bg-emerald-100 text-emerald-600',
      value: 'text-emerald-600',
    },
    amber: {
      border: 'border-l-amber-500',
      icon: 'bg-amber-100 text-amber-600',
      value: 'text-amber-600',
    },
    rose: {
      border: 'border-l-rose-500',
      icon: 'bg-rose-100 text-rose-600',
      value: 'text-rose-600',
    },
    blue: {
      border: 'border-l-blue-500',
      icon: 'bg-blue-100 text-blue-600',
      value: 'text-blue-600',
    },
    indigo: {
      border: 'border-l-indigo-500',
      icon: 'bg-indigo-100 text-indigo-600',
      value: 'text-indigo-600',
    },
  };

  const colors = colorClasses[color];

  return (
    <Card className={cn("border-l-4 hover:shadow-md transition-shadow", colors.border, className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {title}
            </p>
            <p className={cn("text-xl font-bold", colors.value)}>
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
          <div className={cn("p-2 rounded-lg", colors.icon)}>
            {icon}
          </div>
        </div>
        {trend && trendValue && (
          <div className="flex items-center gap-1 mt-2">
            {trend === 'up' ? (
              <TrendingUp className="h-3 w-3 text-emerald-500" />
            ) : trend === 'down' ? (
              <TrendingDown className="h-3 w-3 text-rose-500" />
            ) : null}
            <span className={cn(
              "text-xs font-medium",
              trend === 'up' && 'text-emerald-600',
              trend === 'down' && 'text-rose-600',
              trend === 'neutral' && 'text-muted-foreground'
            )}>
              {trendValue}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ContributionReportMetrics({ summary, isLoading }: ContributionReportMetricsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="border-l-4 border-l-gray-200">
            <CardContent className="p-4">
              <div className="animate-pulse space-y-2">
                <div className="h-3 w-20 bg-gray-200 rounded" />
                <div className="h-6 w-24 bg-gray-200 rounded" />
                <div className="h-2 w-16 bg-gray-200 rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard
          title="Total Geral"
          value={formatCurrency(summary.totalValue)}
          subtitle={`${summary.totalCount} contribuições`}
          icon={<DollarSign className="h-5 w-5" />}
          color="slate"
        />
        
        <MetricCard
          title="Total Recebido"
          value={formatCurrency(summary.paidValue)}
          subtitle={`${summary.paidCount} pagos`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          color="emerald"
          trend={summary.paymentRate >= 70 ? 'up' : summary.paymentRate >= 50 ? 'neutral' : 'down'}
          trendValue={formatPercent(summary.paymentRate)}
        />

        <MetricCard
          title="Total Pendente"
          value={formatCurrency(summary.pendingValue)}
          subtitle={`${summary.pendingCount} pendentes`}
          icon={<Clock className="h-5 w-5" />}
          color="amber"
        />

        <MetricCard
          title="Total Vencido"
          value={formatCurrency(summary.overdueValue)}
          subtitle={`${summary.overdueCount} vencidos`}
          icon={<AlertTriangle className="h-5 w-5" />}
          color="rose"
          trend={summary.defaultRate > 30 ? 'down' : summary.defaultRate > 15 ? 'neutral' : 'up'}
          trendValue={`${formatPercent(summary.defaultRate)} inadimpl.`}
        />

        <MetricCard
          title="Taxa de Recebimento"
          value={formatPercent(summary.paymentRate)}
          subtitle="do valor total"
          icon={<Percent className="h-5 w-5" />}
          color="blue"
        />

        <MetricCard
          title="Empresas"
          value={summary.employerCount.toString()}
          subtitle="com contribuições"
          icon={<Building2 className="h-5 w-5" />}
          color="indigo"
        />
      </div>
    </div>
  );
}
