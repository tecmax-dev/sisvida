import { useState, useCallback, useEffect } from "react";
import { Quote, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import useEmblaCarousel from "embla-carousel-react";
import carlaMendes from "@/assets/testimonials/carla-mendes.jpg";
import ricardoOliveira from "@/assets/testimonials/ricardo-oliveira.jpg";
import fernandaLima from "@/assets/testimonials/fernanda-lima.jpg";
import marcosSilva from "@/assets/testimonials/marcos-silva.jpg";

const testimonials = [
  {
    name: "Dra. Carla Mendes",
    role: "Presidente de Sindicato",
    image: carlaMendes,
    quote:
      "O ProsindWeb transformou a gestão do nosso sindicato. Antes perdíamos tempo com controles manuais, agora tudo é automatizado. A carteirinha digital foi um sucesso entre os associados.",
  },
  {
    name: "Dr. Ricardo Oliveira",
    role: "Diretor Administrativo",
    image: ricardoOliveira,
    quote:
      "Depois que adotamos o ProsindWeb, nossa arrecadação melhorou 40%. O controle financeiro é impecável e a gestão de boletos ficou muito mais simples.",
  },
  {
    name: "Fernanda Lima",
    role: "Secretária Executiva",
    image: fernandaLima,
    quote:
      "A praticidade do sistema é incrível. Consigo acessar o cadastro completo dos associados de qualquer lugar e enviar notificações automáticas pelo WhatsApp.",
  },
  {
    name: "Marcos Silva",
    role: "Tesoureiro",
    image: marcosSilva,
    quote:
      "O que mais me impressiona é a segurança dos dados. Trabalhamos com informações sensíveis e tudo está protegido. O módulo financeiro facilita muito o dia a dia.",
  },
];

export const TestimonialsSection = () => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "center" });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi, onSelect]);

  useEffect(() => {
    if (!emblaApi) return;
    const interval = setInterval(() => emblaApi.scrollNext(), 5000);
    return () => clearInterval(interval);
  }, [emblaApi]);

  return (
    <section className="py-20 md:py-28 bg-card relative overflow-hidden">
      <div className="container relative z-10">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            O que nossos clientes dizem
          </h2>
          <p className="text-muted-foreground text-lg">
            Veja como o ProsindWeb está impulsionando a eficiência de sindicatos em todo o Brasil
          </p>
        </div>

        <div className="relative max-w-4xl mx-auto">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex">
              {testimonials.map((t, index) => (
                <div key={index} className="flex-[0_0_100%] min-w-0 px-4">
                  <div className="bg-background border border-border rounded-3xl p-8 md:p-12 shadow-lg">
                    <div className="flex justify-center mb-6">
                      <Quote className="h-10 w-10 text-primary/20" />
                    </div>
                    <div className="flex gap-1 mb-6 justify-center">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-5 w-5 fill-warning text-warning" />
                      ))}
                    </div>
                    <p className="text-lg md:text-xl text-foreground leading-relaxed mb-8 text-center italic">
                      "{t.quote}"
                    </p>
                    <div className="flex flex-col items-center gap-4">
                      <img
                        src={t.image}
                        alt={t.name}
                        className="w-16 h-16 rounded-full object-cover border-4 border-primary/20"
                      />
                      <div className="text-center">
                        <h4 className="font-bold text-foreground">{t.name}</h4>
                        <p className="text-muted-foreground text-sm">{t.role}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

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

        <div className="flex justify-center gap-2 mt-8">
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => emblaApi?.scrollTo(index)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === selectedIndex ? "bg-primary w-6" : "bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
