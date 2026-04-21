import { useCountUp } from "@/hooks/useCountUp";

function StatItem({ value, suffix, label, index }: { value: number; suffix: string; label: string; index: number }) {
  const { ref, formattedValue } = useCountUp({ end: value, duration: 2000 + index * 200, suffix });
  return (
    <div ref={ref} className="text-center relative">
      <div className="text-4xl md:text-5xl font-bold text-primary mb-2 tabular-nums tracking-tight">{formattedValue}</div>
      <div className="text-sm text-muted-foreground font-medium">{label}</div>
    </div>
  );
}

const stats = [
  { value: 500, suffix: "+", label: "Clínicas atendidas" },
  { value: 2, suffix: "M+", label: "Atendimentos realizados" },
  { value: 15, suffix: "+", label: "Especialidades médicas" },
  { value: 99, suffix: "%", label: "Uptime garantido" },
];

export function ClinicaStatsSection() {
  return (
    <section className="py-16 lg:py-20 border-y border-border/50 bg-muted/30">
      <div className="container">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-16 max-w-4xl mx-auto">
          {stats.map((s, i) => (
            <StatItem key={i} value={s.value} suffix={s.suffix} label={s.label} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}