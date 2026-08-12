
import { 
  Users, 
  ShieldCheck, 
  Zap, 
  LayoutDashboard, 
  Smartphone, 
  FileText,
  CreditCard,
  MessageCircle,
  BarChart3,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
  {
    title: "Dashboard 360º",
    description: "Visão em tempo real da saúde financeira e administrativa da sua entidade com KPIs inteligentes.",
    icon: LayoutDashboard,
    className: "lg:col-span-2 lg:row-span-2 bg-slate-900 text-white overflow-hidden",
    visual: (
      <div className="absolute bottom-0 right-0 w-3/4 h-2/3 bg-slate-800 rounded-tl-3xl border-t border-l border-white/10 p-4 transform translate-y-4 translate-x-4 transition-transform group-hover:translate-y-2 group-hover:translate-x-2">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <div className="text-[10px] font-medium text-slate-400">STATUS DA ARRECADAÇÃO</div>
        </div>
        <div className="space-y-3">
          <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 w-[78%]" />
          </div>
          <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 w-[62%]" />
          </div>
          <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 w-[45%]" />
          </div>
        </div>
      </div>
    )
  },
  {
    title: "App do Associado",
    description: "Carteirinha digital e autoatendimento completo no celular.",
    icon: Smartphone,
    className: "lg:col-span-1 lg:row-span-1 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30",
    color: "text-emerald-600"
  },
  {
    title: "Segurança de Dados",
    description: "Conformidade total com a LGPD e criptografia de ponta.",
    icon: ShieldCheck,
    className: "lg:col-span-1 lg:row-span-1 bg-blue-50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/30",
    color: "text-blue-600"
  },
  {
    title: "Financeiro Automatizado",
    description: "Emissão de boletos, cobrança via WhatsApp e conciliação bancária em segundos.",
    icon: CreditCard,
    className: "lg:col-span-1 lg:row-span-2 bg-indigo-50 border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/30",
    visual: (
      <div className="mt-6 flex flex-col gap-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/50 border border-indigo-100/50 dark:bg-indigo-950/40">
            <div className="w-6 h-6 rounded bg-indigo-100 dark:bg-indigo-900/50" />
            <div className="h-1.5 w-12 bg-indigo-200 dark:bg-indigo-800 rounded-full" />
            <div className="h-1.5 w-8 bg-emerald-200 dark:bg-emerald-800 rounded-full" />
          </div>
        ))}
      </div>
    )
  },
  {
    title: "Inteligência Artificial",
    description: "Predição de evasão e automação de rotinas via IA especializada.",
    icon: Zap,
    className: "lg:col-span-2 lg:row-span-1 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20",
    color: "text-primary"
  }
];

export function BentoFeaturesSection() {
  return (
    <section className="py-24 lg:py-32 bg-background relative overflow-hidden">
      <div className="container">
        <div className="text-center mb-20">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-6">
            Gestão inteligente, <span className="text-primary italic">resultados reais.</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Combinamos tecnologia de ponta com a experiência de décadas no setor sindical para entregar a solução definitiva.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 lg:grid-rows-3 gap-6 auto-rows-[160px]">
          {features.map((feature, i) => (
            <div
              key={i}
              className={cn(
                "group relative rounded-[2rem] border p-8 transition-all duration-500 hover:shadow-2xl hover:-translate-y-1",
                feature.className
              )}
            >
              <div className="relative z-10 flex flex-col h-full">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-6 bg-white/10 backdrop-blur-md shadow-sm", feature.color)}>
                  <feature.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-sm opacity-80 leading-relaxed font-medium">
                    {feature.description}
                  </p>
                </div>
                
                <div className="mt-auto pt-6 flex items-center gap-2 text-xs font-bold uppercase tracking-wider group-hover:gap-3 transition-all cursor-pointer">
                  Explorar
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

              {feature.visual && feature.visual}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
