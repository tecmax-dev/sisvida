import { CheckCircle2 } from "lucide-react";

const specialties = [
  "Clínicos Gerais",
  "Odontologia",
  "Cardiologia",
  "Oftalmologia",
  "Psicologia",
  "Fisioterapia",
  "Estética e saúde",
  "e mais 50 outras especialidades",
];

export function SpecialtiesSection() {
  return (
    <section className="py-16 bg-white">
      <div className="container">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary text-center mb-10">
          O sistema ideal para sua especialidade:
        </h2>

        <div className="flex flex-wrap justify-center gap-x-6 gap-y-3">
          {specialties.map((specialty, i) => (
            <div 
              key={i}
              className="flex items-center gap-2 text-muted-foreground"
            >
              <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
              <span className="text-sm sm:text-base">{specialty}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
