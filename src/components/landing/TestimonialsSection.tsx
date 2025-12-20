import { useState, useCallback, useEffect } from "react";
import { Quote, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import useEmblaCarousel from "embla-carousel-react";
import andreaMatos from "@/assets/testimonials/andrea-matos.jpg";
import danielaSales from "@/assets/testimonials/daniela-sales.png";
import joseAlcides from "@/assets/testimonials/jose-alcides.png";
import julianeLeite from "@/assets/testimonials/juliane-leite.png";

const testimonials = [
  {
    name: "Andrea Matos",
    role: "Enfermeira Esteta",
    image: andreaMatos,
    quote: "O Eclini transformou completamente a gestão da minha clínica de estética. Os lembretes automáticos reduziram minhas faltas em 80%! Agora consigo focar no que realmente importa: atender bem meus pacientes."
  },
  {
    name: "Daniela Sales",
    role: "Terapeuta Holística",
    image: danielaSales,
    quote: "A anamnese personalizável é perfeita para minhas consultas terapêuticas. Consigo criar formulários específicos para cada tipo de atendimento. O suporte também é excelente!"
  },
  {
    name: "Dr. José Alcides",
    role: "Clínico Geral",
    image: joseAlcides,
    quote: "Finalmente um sistema completo que atende todas as necessidades do meu consultório. O prontuário eletrônico e gestão financeira são excelentes! Recomendo para todos os colegas."
  },
  {
    name: "Juliane Leite",
    role: "Dentista",
    image: julianeLeite,
    quote: "O odontograma e a prescrição digital facilitaram muito meu dia a dia. Meus pacientes adoram receber tudo pelo WhatsApp! A integração é perfeita."
  }
];

export const TestimonialsSection = () => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start" });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  return (
    <section className="py-20 md:py-28 bg-muted/30 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-10 right-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
      
      <div className="container relative z-10">
        <div className="text-center mb-16">
          <span className="text-primary font-medium text-sm uppercase tracking-wider mb-3 block">
            Depoimentos
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            O que dizem nossos clientes
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Profissionais de diversas áreas que já transformaram sua gestão
          </p>
        </div>

        {/* Featured Testimonial */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="bg-card border border-border rounded-3xl p-8 md:p-12 shadow-lg relative">
            <Quote className="absolute top-6 left-6 h-12 w-12 text-primary/10" />
            
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <img
                src={testimonials[0].image}
                alt={testimonials[0].name}
                className="w-24 h-24 md:w-32 md:h-32 rounded-2xl object-cover border-4 border-primary/20"
              />
              <div>
                <p className="text-lg md:text-xl text-foreground leading-relaxed mb-6">
                  "{testimonials[0].quote}"
                </p>
                <div className="flex items-center gap-4">
                  <div>
                    <h4 className="font-bold text-foreground">
                      {testimonials[0].name}
                    </h4>
                    <p className="text-muted-foreground text-sm">
                      {testimonials[0].role}
                    </p>
                  </div>
                  <div className="flex gap-1 ml-auto">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-warning text-warning" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Carousel */}
        <div className="relative">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex gap-6">
              {testimonials.slice(1).map((testimonial, index) => (
                <div
                  key={index}
                  className="flex-[0_0_100%] min-w-0 sm:flex-[0_0_50%] lg:flex-[0_0_33.333%]"
                >
                  <div className="bg-card border border-border rounded-2xl p-6 h-full hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                    <Quote className="h-8 w-8 text-primary/20 mb-4" />
                    
                    <p className="text-muted-foreground mb-6 leading-relaxed text-sm">
                      "{testimonial.quote}"
                    </p>
                    
                    <div className="flex gap-1 mb-4">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-warning text-warning" />
                      ))}
                    </div>
                    
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
                </div>
              ))}
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-center gap-4 mt-8">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full"
              onClick={scrollPrev}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="rounded-full"
              onClick={scrollNext}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
