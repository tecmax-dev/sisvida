import { 
  Stethoscope, 
  Heart, 
  Eye, 
  Brain, 
  Bone, 
  Sparkles,
  Baby,
  SmilePlus
} from "lucide-react";

const specialties = [
  { icon: Stethoscope, name: "Clínica Geral", color: "bg-blue-500/10 text-blue-600" },
  { icon: SmilePlus, name: "Odontologia", color: "bg-cyan-500/10 text-cyan-600" },
  { icon: Heart, name: "Cardiologia", color: "bg-red-500/10 text-red-600" },
  { icon: Eye, name: "Oftalmologia", color: "bg-purple-500/10 text-purple-600" },
  { icon: Brain, name: "Psicologia", color: "bg-pink-500/10 text-pink-600" },
  { icon: Bone, name: "Fisioterapia", color: "bg-orange-500/10 text-orange-600" },
  { icon: Sparkles, name: "Estética", color: "bg-rose-500/10 text-rose-600" },
  { icon: Baby, name: "Pediatria", color: "bg-green-500/10 text-green-600" },
];

export function SpecialtiesSection() {
  return (
    <section id="specialties" className="py-20 lg:py-28 bg-muted/30">
      <div className="container">
        <div className="text-center mb-12">
          <span className="text-primary font-medium text-sm uppercase tracking-wider mb-3 block">
            Multi-especialidades
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Para todas as áreas da saúde
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Sistema flexível que se adapta às necessidades de cada especialidade
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 lg:gap-6">
          {specialties.map((specialty, index) => (
            <div
              key={index}
              className="group flex flex-col items-center p-6 bg-card rounded-2xl border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
            >
              <div className={`w-14 h-14 rounded-xl ${specialty.color} flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110`}>
                <specialty.icon className="h-7 w-7" />
              </div>
              <span className="text-sm font-medium text-foreground text-center">
                {specialty.name}
              </span>
            </div>
          ))}
        </div>

        <p className="text-center text-muted-foreground mt-8">
          E mais de <span className="font-semibold text-foreground">50 outras especialidades</span> suportadas
        </p>
      </div>
    </section>
  );
}
