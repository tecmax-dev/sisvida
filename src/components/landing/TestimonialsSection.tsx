import { Quote, Star } from "lucide-react";
import andreaMatos from "@/assets/testimonials/andrea-matos.jpg";
import danielaSales from "@/assets/testimonials/daniela-sales.png";
import joseAlcides from "@/assets/testimonials/jose-alcides.png";
import julianeLeite from "@/assets/testimonials/juliane-leite.png";

const testimonials = [
  {
    name: "Andrea Matos",
    role: "Enfermeira Esteta",
    image: andreaMatos,
    quote: "O Eclini transformou completamente a gestão da minha clínica de estética. Os lembretes automáticos reduziram minhas faltas em 80%!"
  },
  {
    name: "Daniela Sales",
    role: "Terapeuta Holística",
    image: danielaSales,
    quote: "A anamnese personalizável é perfeita para minhas consultas terapêuticas. Consigo criar formulários específicos para cada tipo de atendimento."
  },
  {
    name: "Dr. José Alcides",
    role: "Clínico Geral",
    image: joseAlcides,
    quote: "Finalmente um sistema completo que atende todas as necessidades do meu consultório. O prontuário eletrônico e gestão financeira são excelentes!"
  },
  {
    name: "Juliane Leite",
    role: "Dentista",
    image: julianeLeite,
    quote: "O odontograma e a prescrição digital facilitaram muito meu dia a dia. Meus pacientes adoram receber tudo pelo WhatsApp!"
  }
];

export const TestimonialsSection = () => {
  return (
    <section className="py-20 md:py-28 bg-muted/30 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-10 right-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-16">
          <span className="text-primary font-medium text-sm uppercase tracking-wider mb-3 block">
            Depoimentos
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            O que nossos clientes dizem
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Profissionais de diversas áreas que já transformaram sua gestão com o Eclini
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-card border border-border rounded-2xl p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group"
            >
              {/* Quote icon */}
              <Quote className="h-8 w-8 text-primary/20 mb-4 group-hover:text-primary/40 transition-colors" />
              
              {/* Quote text */}
              <p className="text-muted-foreground mb-6 leading-relaxed text-sm">
                "{testimonial.quote}"
              </p>
              
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                ))}
              </div>
              
              {/* Author */}
              <div className="flex items-center gap-3">
                <img
                  src={testimonial.image}
                  alt={testimonial.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-primary/20"
                />
                <div>
                  <h4 className="font-semibold text-foreground text-sm">
                    {testimonial.name}
                  </h4>
                  <p className="text-muted-foreground text-xs">
                    {testimonial.role}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
