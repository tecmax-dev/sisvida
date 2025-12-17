import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  TrendingUp, 
  TrendingDown,
  Calendar,
  Users,
  XCircle,
} from "lucide-react";

const metrics = [
  {
    title: "Total de Consultas",
    value: "486",
    change: "+12%",
    trend: "up",
    period: "vs. mês anterior",
    icon: Calendar,
  },
  {
    title: "Novos Pacientes",
    value: "48",
    change: "+8%",
    trend: "up",
    period: "vs. mês anterior",
    icon: Users,
  },
  {
    title: "Taxa de No-show",
    value: "8%",
    change: "-3%",
    trend: "down",
    period: "vs. mês anterior",
    icon: XCircle,
  },
];

const byInsurance = [
  { name: "Particular", value: 125, percentage: 51 },
  { name: "Unimed", value: 45, percentage: 18 },
  { name: "Bradesco", value: 32, percentage: 13 },
  { name: "SulAmérica", value: 28, percentage: 11 },
  { name: "Outros", value: 18, percentage: 7 },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
        <p className="text-muted-foreground">
          Acompanhe as métricas da sua clínica
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {metrics.map((metric, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{metric.title}</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {metric.value}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    {metric.trend === "up" ? (
                      <TrendingUp className="h-4 w-4 text-success" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-success" />
                    )}
                    <span className={`text-sm font-medium ${
                      metric.trend === "up" ? "text-success" : "text-success"
                    }`}>
                      {metric.change}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {metric.period}
                    </span>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <metric.icon className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* By Insurance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Atendimentos por Convênio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {byInsurance.map((item, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">
                    {item.name}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {item.value} ({item.percentage}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
