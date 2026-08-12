import { useState, useCallback, useEffect } from "react";
import { Star, ChevronLeft, ChevronRight, Quote } from "lucide-react";
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
    quote: "O Prosinge transformou a gestão do nosso sindicato. Antes perdíamos tempo com controles manuais, agora tudo é automatizado. A carteirinha digital foi um sucesso entre os associados.",
  },
  {
    name: "Dr. Ricardo Oliveira",
    role: "Diretor Administrativo",
    image: ricardoOliveira,
    quote: "Depois que adotamos o Prosinge, nossa arrecadação melhorou 40%. O controle financeiro é impecável e a gestão de boletos ficou muito mais simples.",
  },
  {
    name: "Fernanda Lima",
    role: "Secretária Executiva",
    image: fernandaLima,
    quote: "A praticidade do sistema é incrível. Consigo acessar o cadastro completo dos associados de qualquer lugar e enviar notificações automáticas pelo WhatsApp.",
  },
  {
    name: "Marcos Silva",
    role: "Tesoureiro",
    image: marcosSilva,
    quote: "O que mais me impressiona é a segurança dos dados. Trabalhamos com informações sensíveis e tudo está protegido. O módulo financeiro facilita muito o dia a dia.",
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
    const interval = setInterval(() => emblaApi.scrollNext(), 6000);
    return () => clearInterval(interval);
  }, [emblaApi]);

  return (
    <section id="testimonials" className="py-20 lg:py-28 bg-muted/20 relative overflow-hidden">
      <div className="container relative z-10">
        <div className="text-center mb-16">
          <span className="text-primary font-semibold text-sm uppercase tracking-widest mb-3 block">
            Depoimentos
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground tracking-tight mb-4">
            O que nossos clientes dizem
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Veja como o Prosinge está transformando a gestão sindical
          </p>
        </div>

        <div className="relative max-w-3xl mx-auto">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex">
              {testimonials.map((t, index) => (
                <div key={index} className="flex-[0_0_100%] min-w-0 px-4">
                  <div className="bg-card border border-border/50 rounded-2xl p-8 md:p-12 shadow-lg relative">
                    <Quote className="absolute top-6 right-8 h-12 w-12 text-primary/8" />
                    
                    <div className="flex gap-1 mb-6">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-warning text-warning" />
                      ))}
                    </div>
                    
                    <p className="text-lg text-foreground/90 leading-relaxed mb-8">
                      "{t.quote}"
                    </p>
                    
                    <div className="flex items-center gap-4">
                      <img
                        src={t.image}
                        alt={t.name}
                        className="w-12 h-12 rounded-full object-cover ring-2 ring-primary/15"
                      />
                      <div>
                        <h4 className="font-bold text-foreground text-sm">{t.name}</h4>
                        <p className="text-muted-foreground text-xs">{t.role}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 mt-8">
            <Button variant="outline" size="icon" className="rounded-full h-10 w-10" onClick={scrollPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex gap-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => emblaApi?.scrollTo(index)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === selectedIndex ? "bg-primary w-6" : "bg-muted-foreground/20 w-2"
                  }`}
                />
              ))}
            </div>
            <Button variant="outline" size="icon" className="rounded-full h-10 w-10" onClick={scrollNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
