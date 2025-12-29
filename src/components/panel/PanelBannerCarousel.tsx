import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PanelBanner } from "@/hooks/usePanelBanners";

interface PanelBannerCarouselProps {
  banners: PanelBanner[];
  className?: string;
}

export function PanelBannerCarousel({ banners, className }: PanelBannerCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  }, [banners.length]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  }, [banners.length]);

  // Auto-play carousel
  useEffect(() => {
    if (!isAutoPlaying || banners.length <= 1) return;
    
    const currentBanner = banners[currentIndex];
    const duration = (currentBanner?.duration_seconds || 5) * 1000;
    
    const interval = setInterval(nextSlide, duration);
    return () => clearInterval(interval);
  }, [isAutoPlaying, nextSlide, banners.length, currentIndex, banners]);

  if (!banners || banners.length === 0) {
    return null;
  }

  const currentBanner = banners[currentIndex];

  return (
    <div 
      className={cn("relative w-full h-full overflow-hidden", className)}
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
    >
      {/* Slides */}
      {banners.map((banner, index) => (
        <div
          key={banner.id}
          className={cn(
            "absolute inset-0 transition-opacity duration-700",
            index === currentIndex ? "opacity-100 z-10" : "opacity-0 z-0"
          )}
        >
          {/* Background Image */}
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ 
              backgroundImage: `url(${banner.image_url})`,
              backgroundColor: banner.background_color || "#1e293b"
            }}
          />
          
          {/* Overlay */}
          <div 
            className="absolute inset-0 bg-black"
            style={{ opacity: banner.overlay_opacity || 0.4 }}
          />
          
          {/* Content */}
          <div 
            className="absolute inset-0 flex flex-col items-center justify-center text-center p-8"
            style={{ color: banner.text_color || "#ffffff" }}
          >
            {banner.title && (
              <h2 className="text-5xl font-bold mb-4 drop-shadow-lg">
                {banner.title}
              </h2>
            )}
            {banner.subtitle && (
              <p className="text-3xl font-medium mb-4 drop-shadow-md">
                {banner.subtitle}
              </p>
            )}
            {banner.description && (
              <p className="text-xl max-w-3xl mb-6 drop-shadow">
                {banner.description}
              </p>
            )}
            {banner.button_text && banner.button_link && (
              <a
                href={banner.button_link}
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-3 bg-primary text-primary-foreground rounded-lg text-lg font-medium hover:bg-primary/90 transition-colors"
              >
                {banner.button_text}
              </a>
            )}
          </div>
        </div>
      ))}

      {/* Navigation Arrows */}
      {banners.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 bg-black/30 hover:bg-black/50 rounded-full text-white transition-colors"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-8 w-8" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 bg-black/30 hover:bg-black/50 rounded-full text-white transition-colors"
            aria-label="Próximo"
          >
            <ChevronRight className="h-8 w-8" />
          </button>
        </>
      )}

      {/* Dots Indicator */}
      {banners.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={cn(
                "w-3 h-3 rounded-full transition-all",
                index === currentIndex 
                  ? "bg-white w-8" 
                  : "bg-white/50 hover:bg-white/75"
              )}
              aria-label={`Ir para slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
