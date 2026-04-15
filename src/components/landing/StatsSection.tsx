import { useCountUp } from "@/hooks/useCountUp";

interface StatItemProps {
  value: number;
  suffix: string;
  label: string;
  index: number;
}

function StatItem({ value, suffix, label, index }: StatItemProps) {
  const { ref, formattedValue } = useCountUp({
    end: value,
    duration: 2000 + index * 200,
    suffix,
  });

  return (
    <div ref={ref} className="text-center relative">
      <div className="text-4xl md:text-5xl font-bold text-primary mb-2 tabular-nums tracking-tight">
        {formattedValue}
      </div>
      <div className="text-sm text-muted-foreground font-medium">{label}</div>
    </div>
  );
}

const stats = [
  { value: 200, suffix: "+", label: "Sindicatos Atendidos" },
  { value: 1, suffix: "M+", label: "Vidas Gerenciadas" },
  { value: 27, suffix: "", label: "Estados do Brasil" },
  { value: 10, suffix: "+", label: "Anos de Experiência" },
];

export function StatsSection() {
  return (
    <section className="py-16 lg:py-20 border-y border-border/50 bg-muted/30">
      <div className="container">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-16 max-w-4xl mx-auto">
          {stats.map((stat, index) => (
            <StatItem
              key={index}
              value={stat.value}
              suffix={stat.suffix}
              label={stat.label}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
