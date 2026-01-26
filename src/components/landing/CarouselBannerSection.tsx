import { useState, useEffect, useCallback } from "react";
import { useCarouselBanners } from "@/hooks/useCarouselBanners";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CarouselBannerSection() {
  const { data: banners, isLoading } = useCarouselBanners();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const nextSlide = useCallback(() => {
    if (!banners?.length) return;
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  }, [banners?.length]);

  const prevSlide = useCallback(() => {
    if (!banners?.length) return;
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  }, [banners?.length]);

  useEffect(() => {
    if (!isAutoPlaying || !banners?.length) return;
    
    const interval = setInterval(nextSlide, 5000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, nextSlide, banners?.length]);

  if (isLoading) {
    return (
      <section className="relative h-[500px] md:h-[600px] bg-muted animate-pulse" />
    );
  }

  if (!banners?.length) {
    return null;
  }

  const currentBanner = banners[currentIndex];

  return (
    <section 
      className="relative h-[500px] md:h-[600px] overflow-hidden"
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
    >
      {/* Slides */}
      <div className="relative h-full">
        {banners.map((banner, index) => {
          const isActive = index === currentIndex;
          return (
            <div
              key={banner.id}
              className={cn(
                "absolute inset-0 transition-all duration-1000 ease-out",
                isActive 
                  ? "opacity-100 z-10 scale-100" 
                  : "opacity-0 z-0 scale-105"
              )}
            >
              {/* Background Image with Ken Burns effect */}
              <div 
                className={cn(
                  "absolute inset-0 bg-cover bg-center transition-transform duration-[8000ms] ease-out",
                  isActive ? "scale-110" : "scale-100"
                )}
                style={{ backgroundImage: `url(${banner.image_url})` }}
              />
              
              {/* Overlay with gradient */}
              <div 
                className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent"
                style={{ 
                  backgroundColor: banner.background_color || 'transparent',
                  opacity: banner.overlay_opacity ?? 0.6
                }}
              />

              {/* Content with staggered animation */}
              <div className="relative h-full flex items-center z-20">
                <div className="container mx-auto px-4 md:px-8">
                  <div 
                    className={cn(
                      "max-w-2xl space-y-6 transition-all duration-700 delay-200",
                      isActive 
                        ? "opacity-100 translate-y-0" 
                        : "opacity-0 translate-y-8"
                    )}
                  >
                    {banner.subtitle && (
                      <p 
                        className={cn(
                          "text-sm md:text-base font-medium tracking-wide uppercase transition-all duration-500 delay-300",
                          isActive ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
                        )}
                        style={{ color: banner.text_color || '#ffffff' }}
                      >
                        {banner.subtitle}
                      </p>
                    )}
                    
                    {banner.title && (
                      <h2 
                        className={cn(
                          "text-3xl md:text-5xl lg:text-6xl font-bold leading-tight transition-all duration-500 delay-400",
                          isActive ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
                        )}
                        style={{ color: banner.text_color || '#ffffff' }}
                      >
                        {banner.title}
                      </h2>
                    )}
                    
                    {banner.description && (
                      <p 
                        className={cn(
                          "text-base md:text-lg max-w-xl transition-all duration-500 delay-500",
                          isActive ? "opacity-90 translate-x-0" : "opacity-0 -translate-x-4"
                        )}
                        style={{ color: banner.text_color || '#ffffff' }}
                      >
                        {banner.description}
                      </p>
                    )}
                    
                    {banner.button_text && banner.button_link && (
                      <div 
                        className={cn(
                          "pt-4 transition-all duration-500 delay-600",
                          isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                        )}
                      >
                        <Button
                          size="lg"
                          className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 shadow-lg hover:shadow-xl transition-shadow"
                          asChild
                        >
                          <a href={banner.button_link}>{banner.button_text}</a>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation Arrows */}
      {banners.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-background/20 backdrop-blur-sm hover:bg-background/40 transition-colors"
            aria-label="Slide anterior"
          >
            <ChevronLeft className="h-6 w-6 text-white" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-background/20 backdrop-blur-sm hover:bg-background/40 transition-colors"
            aria-label="Próximo slide"
          >
            <ChevronRight className="h-6 w-6 text-white" />
          </button>
        </>
      )}

      {/* Dots Indicator */}
      {banners.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex gap-2">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={cn(
                "w-3 h-3 rounded-full transition-all duration-300",
                index === currentIndex 
                  ? "bg-white w-8" 
                  : "bg-white/50 hover:bg-white/70"
              )}
              aria-label={`Ir para slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
