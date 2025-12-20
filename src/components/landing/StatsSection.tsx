import { Users, Calendar, Building2, Award } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";

interface StatItemProps {
  icon: React.ElementType;
  value: number;
  suffix: string;
  label: string;
  index: number;
}

function StatItem({ icon: Icon, value, suffix, label, index }: StatItemProps) {
  const { ref, formattedValue } = useCountUp({
    end: value,
    duration: 2000 + index * 200, // Stagger the animations slightly
    suffix,
  });

  return (
    <div 
      ref={ref}
      className="relative text-center lg:text-left group"
    >
      {/* Separator line (not on first item) */}
      {index > 0 && (
        <div className="hidden lg:block absolute left-0 top-1/2 -translate-y-1/2 w-px h-16 bg-primary-foreground/20" />
      )}

      <div className="lg:pl-8 first:lg:pl-0">
        <div className="flex items-center justify-center lg:justify-start gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-primary-foreground/10 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
            <Icon className="h-5 w-5 text-primary-foreground" />
          </div>
        </div>
        <div className="text-3xl lg:text-4xl font-bold text-primary-foreground mb-1 tabular-nums">
          {formattedValue}
        </div>
        <div className="text-sm text-primary-foreground/70">
          {label}
        </div>
      </div>
    </div>
  );
}

const stats = [
  {
    icon: Calendar,
    value: 12,
    suffix: "M+",
    label: "Agendamentos realizados",
  },
  {
    icon: Users,
    value: 3,
    suffix: "M+",
    label: "Pacientes cadastrados",
  },
  {
    icon: Building2,
    value: 10,
    suffix: "K+",
    label: "Clínicas ativas",
  },
  {
    icon: Award,
    value: 500,
    suffix: "+",
    label: "Cidades atendidas",
  },
];

export function StatsSection() {
  return (
    <section className="relative py-12 lg:py-16 bg-primary-dark overflow-hidden">
      {/* Decorative Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(90deg, hsl(var(--primary-foreground)) 1px, transparent 1px),
              linear-gradient(hsl(var(--primary-foreground)) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary-dark via-transparent to-primary-dark" />

      <div className="container relative z-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-4">
          {stats.map((stat, index) => (
            <StatItem
              key={index}
              icon={stat.icon}
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
