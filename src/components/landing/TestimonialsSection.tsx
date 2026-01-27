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
    quote: "Com o Eclini, a gente realmente conseguiu melhorar os processos internos. O sistema tem 'travas' boas, que conseguem garantir que as coisas não saiam do padrão, não saiam do combinado e também mantenham tudo mais organizado."
  },
  {
    name: "Daniela Sales",
    role: "Terapeuta Holística",
    image: danielaSales,
    quote: "Sem sombra de dúvidas, o Eclini é um dos pontos principais para a organização da nossa empresa e até para o próprio crescimento dela."
  },
  {
    name: "Dr. José Alcides",
    role: "Clínico Geral",
    image: joseAlcides,
    quote: "Hoje, o Eclini nos ajuda em tudo, principalmente na gestão. Depois de alguns anos de sistema, conseguimos melhorar, principalmente, o controle financeiro e os relatórios de agendamento."
  },
  {
    name: "Juliane Leite",
    role: "Dentista",
    image: julianeLeite,
    quote: "Com o Eclini, conseguimos ter controle dos retornos de consultas e facilidade na busca por atendimentos recentes. Hoje, os profissionais agradecem pelas ferramentas disponibilizadas."
  }
];

export const TestimonialsSection = () => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "center" });
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

  // Auto-play
  useEffect(() => {
    if (!emblaApi) return;
    const interval = setInterval(() => {
      emblaApi.scrollNext();
    }, 5000);
    return () => clearInterval(interval);
  }, [emblaApi]);

  return (
    <section className="py-20 md:py-28 bg-muted/30 relative overflow-hidden">
      <div className="container relative z-10">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Opiniões reais de quem usa{" "}
            <span className="gradient-text">nosso software médico</span>
          </h2>
        </div>

        {/* Carousel */}
        <div className="relative max-w-4xl mx-auto">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex">
              {testimonials.map((testimonial, index) => (
                <div
                  key={index}
                  className="flex-[0_0_100%] min-w-0 px-4"
                >
                  <div className="bg-card border border-border rounded-3xl p-8 md:p-12 shadow-lg">
                    {/* Stars */}
                    <div className="flex gap-1 mb-6 justify-center">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-5 w-5 fill-warning text-warning" />
                      ))}
                    </div>
                    
                    {/* Quote */}
                    <p className="text-lg md:text-xl text-foreground leading-relaxed mb-8 text-center">
                      "{testimonial.quote}"
                    </p>
                    
                    {/* Author */}
                    <div className="flex flex-col items-center gap-4">
                      <img
                        src={testimonial.image}
                        alt={testimonial.name}
                        className="w-16 h-16 rounded-full object-cover border-4 border-primary/20"
                      />
                      <div className="text-center">
                        <h4 className="font-bold text-foreground">
                          {testimonial.name}
                        </h4>
                        <p className="text-muted-foreground text-sm">
                          {testimonial.role}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation Arrows */}
          <Button
            variant="outline"
            size="icon"
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 rounded-full hidden md:flex"
            onClick={scrollPrev}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 rounded-full hidden md:flex"
            onClick={scrollNext}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2 mt-8">
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => emblaApi?.scrollTo(index)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === selectedIndex 
                  ? "bg-primary w-6" 
                  : "bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
