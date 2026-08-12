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
    <div ref={ref} className="text-center relative group">
      <div className="text-5xl md:text-6xl font-extrabold text-primary mb-3 tabular-nums tracking-tighter transition-transform group-hover:scale-110 duration-500">
        {formattedValue}
      </div>
      <div className="text-xs text-muted-foreground font-bold uppercase tracking-[0.2em]">{label}</div>
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
    <section className="py-24 lg:py-32 border-y border-border/40 bg-muted/20 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(var(--primary-rgb),0.03),transparent_70%)]" />
      <div className="container relative z-10">
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
