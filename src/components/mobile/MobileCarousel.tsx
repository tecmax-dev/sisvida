import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export function MobileCarousel() {
  const { data: banners } = useQuery({
    queryKey: ["union-app-banners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("union_app_content")
        .select("id, title, description, image_url, external_link, order_index")
        .eq("content_type", "banner")
        .eq("is_active", true)
        .order("order_index", { ascending: true });

      if (error) {
        console.error("Error fetching union banners:", error);
        return [];
      }
      return data || [];
    },
  });
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const intervalRef = useRef<number | null>(null);

  const bannersCount = banners?.length || 0;

  const nextSlide = useCallback(() => {
    if (!bannersCount) return;
    setCurrentIndex((prev) => (prev + 1) % bannersCount);
  }, [bannersCount]);

  const prevSlide = useCallback(() => {
    if (!bannersCount) return;
    setCurrentIndex((prev) => (prev - 1 + bannersCount) % bannersCount);
  }, [bannersCount]);

  // Auto-play carousel
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (!isAutoPlaying || bannersCount <= 1) return;
    
    intervalRef.current = window.setInterval(nextSlide, 5000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAutoPlaying, nextSlide, bannersCount]);

  // Reset index when banners change
  useEffect(() => {
    if (currentIndex >= bannersCount && bannersCount > 0) {
      setCurrentIndex(0);
    }
  }, [bannersCount, currentIndex]);

  if (!banners?.length) return null;

  return (
    <section 
      className="px-4 py-3"
      onTouchStart={() => setIsAutoPlaying(false)}
      onTouchEnd={() => setIsAutoPlaying(true)}
    >
      <div className="relative rounded-3xl overflow-hidden h-48 shadow-xl shadow-black/10">
        {/* All slides layered */}
        {banners.map((banner, index) => {
          const isActive = index === currentIndex;
          return (
            <div
              key={banner.id}
              className={cn(
                "absolute inset-0 transition-opacity duration-700 ease-out",
                isActive ? "opacity-100 z-10" : "opacity-0 z-0"
              )}
            >
              {/* Background image with Ken Burns effect */}
              <div
                className={cn(
                  "absolute inset-0 bg-cover bg-center transition-transform duration-[6000ms] ease-out",
                  isActive ? "scale-110" : "scale-100"
                )}
                style={{ backgroundImage: `url(${banner.image_url})` }}
              />
              
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
              
              {/* Content with staggered animation */}
              <div className="absolute inset-0 flex flex-col justify-end p-5">
                {banner.title && (
                  <h3 
                    className={cn(
                      "text-white font-bold text-xl drop-shadow-lg leading-tight mb-1 transition-all duration-500",
                      isActive 
                        ? "opacity-100 translate-y-0 delay-200" 
                        : "opacity-0 translate-y-4"
                    )}
                  >
                    {banner.title}
                  </h3>
                )}
                {banner.description && (
                  <p 
                    className={cn(
                      "text-white/90 text-sm drop-shadow-md line-clamp-2 transition-all duration-500",
                      isActive 
                        ? "opacity-100 translate-y-0 delay-300" 
                        : "opacity-0 translate-y-4"
                    )}
                  >
                    {banner.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {/* Navigation arrows */}
        {banners.length > 1 && (
          <>
            <button 
              onClick={prevSlide}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button 
              onClick={nextSlide}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Pagination dots */}
        {banners.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === currentIndex 
                    ? "w-6 bg-white" 
                    : "w-1.5 bg-white/50 hover:bg-white/70"
                )}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
