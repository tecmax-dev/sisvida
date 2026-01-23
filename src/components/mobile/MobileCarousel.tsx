import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

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
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!banners?.length) return;
    const timer = setInterval(() => setCurrent((c) => (c + 1) % banners.length), 5000);
    return () => clearInterval(timer);
  }, [banners?.length]);

  if (!banners?.length) return null;

  const banner = banners[current];

  const goTo = (index: number) => {
    if (index < 0) index = banners.length - 1;
    if (index >= banners.length) index = 0;
    setCurrent(index);
  };

  return (
    <section className="px-4 py-3">
      <div className="relative rounded-3xl overflow-hidden h-48 shadow-xl shadow-black/10">
        {/* Background image */}
        <img 
          src={banner.image_url} 
          alt={banner.title || ""} 
          className="w-full h-full object-cover transition-transform duration-700 scale-105"
        />
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        
        {/* Content */}
        <div className="absolute inset-0 flex flex-col justify-end p-5">
          {banner.title && (
            <h3 className="text-white font-bold text-xl drop-shadow-lg leading-tight mb-1">
              {banner.title}
            </h3>
          )}
          {banner.description && (
            <p className="text-white/90 text-sm drop-shadow-md line-clamp-2">
              {banner.description}
            </p>
          )}
        </div>

        {/* Navigation arrows */}
        {banners.length > 1 && (
          <>
            <button 
              onClick={() => goTo(current - 1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button 
              onClick={() => goTo(current + 1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Pagination dots */}
        {banners.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === current 
                    ? "w-6 bg-white" 
                    : "w-1.5 bg-white/50 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
