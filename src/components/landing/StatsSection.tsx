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
    <div ref={ref} className="text-center">
      <div className="font-display text-4xl font-bold tabular-nums tracking-tight text-prosinge-cream md:text-5xl">
        {formattedValue}
      </div>
      <div className="mt-2 text-sm font-medium text-prosinge-cream/70">{label}</div>
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
    <section className="bg-prosinge-emerald-mid py-10 font-body">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
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
