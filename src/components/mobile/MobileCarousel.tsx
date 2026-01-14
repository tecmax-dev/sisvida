import { useCarouselBanners } from "@/hooks/useCarouselBanners";
import { useState, useEffect } from "react";

export function MobileCarousel() {
  const { data: banners } = useCarouselBanners();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!banners?.length) return;
    const timer = setInterval(() => setCurrent((c) => (c + 1) % banners.length), 5000);
    return () => clearInterval(timer);
  }, [banners?.length]);

  if (!banners?.length) return null;

  const banner = banners[current];

  return (
    <section className="px-4 py-2">
      <div className="relative rounded-2xl overflow-hidden h-44">
        <img src={banner.image_url} alt={banner.title || ""} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40 flex flex-col justify-end p-4">
          {banner.title && <h3 className="text-white font-bold text-lg">{banner.title}</h3>}
          {banner.description && <p className="text-white/90 text-sm">{banner.description}</p>}
        </div>
        {banners.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {banners.map((_, i) => (
              <span key={i} className={`w-2 h-2 rounded-full ${i === current ? "bg-white" : "bg-white/50"}`} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
