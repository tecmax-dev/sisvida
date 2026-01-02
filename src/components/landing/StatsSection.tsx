import { Users, Calendar, Building2, Star, ThumbsUp } from "lucide-react";
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
    <div 
      ref={ref}
      className="text-center group"
    >
      <div className="stat-value mb-1 tabular-nums">
        {formattedValue}
      </div>
      <div className="stat-label">
        {label}
      </div>
    </div>
  );
}

const stats = [
  {
    value: 70,
    suffix: " mil+",
    label: "Profissionais",
  },
  {
    value: 51,
    suffix: " mi+",
    label: "Pacientes",
  },
  {
    value: 99,
    suffix: "%",
    label: "Redução das glosas",
  },
  {
    value: 1.9,
    suffix: "mi+",
    label: "Agendamentos",
  },
  {
    value: 99,
    suffix: "%",
    label: "Satisfação com o suporte",
  },
];

export function StatsSection() {
  return (
    <section className="py-12 lg:py-16 bg-card border-y border-border">
      <div className="container">
        <div className="flex flex-wrap justify-center items-center gap-8 lg:gap-16">
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
