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
    <div ref={ref} className="text-center group">
      <div className="text-4xl md:text-5xl font-bold text-primary mb-2 tabular-nums">
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
    <section className="py-16 lg:py-20 bg-background">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Números que falam por nós
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Resultados reais de sindicatos que confiam no ProsindWeb
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 max-w-4xl mx-auto">
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
