import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Target clinic for the mobile app
const TARGET_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";

// Default system branding (ProSindWeb)
const DEFAULT_BRANDING = {
  name: "Prosinge - Gestão Sindical e Clínica",
  shortName: "ProsindWeb",
  description: "Sistema completo de gestão para sindicatos e clínicas.",
  logo: "/favicon.png?v=prosindweb-final-20260517c",
  appleIcon: "/prosindweb-apple-touch-icon.png?v=prosindweb-final-20260517c",
  manifest: "/manifest-prosindweb.webmanifest?v=prosindweb-final-20260517c",
};

interface ClinicBranding {
  name: string;
  logo_url: string | null;
  entity_nomenclature: string | null;
}

/**
 * Hook to dynamically update the PWA branding (favicon, manifest, meta tags)
 * based on the clinic's data for the mobile app.
 * 
 * IMPORTANT: This hook applies custom branding on /app/*, /m/*, and /sindicato/* routes.
 * On all other routes, it restores the default ProsindWeb branding.
 */
export function useDynamicPWA() {
  const [clinic, setClinic] = useState<ClinicBranding | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();

  // Check if current route is a mobile/sindicato app route that needs custom branding
  const isBrandedRoute = 
    location.pathname.startsWith("/app") || 
    location.pathname.startsWith("/m") || 
    location.pathname.startsWith("/sindicato");

  useEffect(() => {
    if (isBrandedRoute) {
      loadClinicBranding();
    } else {
      // Restore default branding when NOT on branded routes
      restoreDefaultBranding();
      setIsLoading(false);
    }
  }, [isBrandedRoute]);

  const loadClinicBranding = async () => {
    // Get clinic ID from localStorage or use target clinic
    let clinicId = localStorage.getItem("mobile_clinic_id");

    // If no clinic ID in localStorage, set the target clinic
    if (!clinicId) {
      clinicId = TARGET_CLINIC_ID;
      localStorage.setItem("mobile_clinic_id", clinicId);
    }

    try {
      const { data } = await supabase
        .from("clinics")
        .select("name, logo_url, entity_nomenclature")
        .eq("id", clinicId)
        .single();

      if (data) {
        setClinic(data);
        applyBranding(data);
      }
    } catch (error) {
      console.error("Error loading clinic branding:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const restoreDefaultBranding = () => {
    // Restore document title
    document.title = DEFAULT_BRANDING.name;

    // Restore favicon
    updateLinkElement("icon", DEFAULT_BRANDING.logo);
    updateLinkElement("shortcut icon", "/favicon.ico?v=prosindweb-final-20260517c");
    updateLinkElement("apple-touch-icon", DEFAULT_BRANDING.appleIcon);

    // Restore meta tags
    updateMetaTag("apple-mobile-web-app-title", DEFAULT_BRANDING.shortName);
    updateMetaTag("application-name", DEFAULT_BRANDING.shortName);
    updateMetaTag("description", DEFAULT_BRANDING.description);

    // Restore Open Graph tags
    updateMetaProperty("og:title", DEFAULT_BRANDING.name);
    updateMetaProperty("og:site_name", DEFAULT_BRANDING.shortName);
    updateMetaProperty("og:description", DEFAULT_BRANDING.description);

    // Restore Twitter tags
    updateMetaProperty("twitter:title", DEFAULT_BRANDING.name);
    updateMetaProperty("twitter:description", DEFAULT_BRANDING.description);

    // Restore default manifest (ProsindWeb)
    restoreDefaultManifest();

    setClinic(null);
  };

  const restoreDefaultManifest = () => {
    const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (manifestLink) {
      manifestLink.href = DEFAULT_BRANDING.manifest;
    } else {
      const newManifestLink = document.createElement("link");
      newManifestLink.rel = "manifest";
      newManifestLink.href = DEFAULT_BRANDING.manifest;
      document.head.appendChild(newManifestLink);
    }
  };

  const applyBranding = (clinicData: ClinicBranding) => {
    const { name, logo_url, entity_nomenclature } = clinicData;
    const displayName = entity_nomenclature 
      ? `${name} | ${entity_nomenclature}` 
      : name;

    // Update document title
    document.title = displayName;

    // Update favicon
    if (logo_url) {
      updateLinkElement("icon", logo_url);
      updateLinkElement("apple-touch-icon", logo_url);
      updateLinkElement("apple-touch-icon-precomposed", logo_url);
    }

    // Update meta tags
    updateMetaTag("apple-mobile-web-app-title", name);
    updateMetaTag("application-name", name);
    updateMetaTag("description", `App oficial do ${name}`);

    // Update Open Graph tags
    updateMetaProperty("og:title", displayName);
    updateMetaProperty("og:site_name", name);
    if (logo_url) {
      updateMetaProperty("og:image", logo_url);
    }

    // Update Twitter tags
    updateMetaProperty("twitter:title", displayName);
    if (logo_url) {
      updateMetaProperty("twitter:image", logo_url);
    }

    // Keep the static manifest URL stable so PWABuilder and Google Play always
    // read the Package ID from /manifest.json instead of a runtime blob.
  };

  const updateLinkElement = (rel: string, href: string | null) => {
    if (!href) return;

    let element = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (element) {
      element.href = href;
    } else {
      element = document.createElement("link");
      element.rel = rel;
      element.href = href;
      if (rel === "icon") {
        element.type = "image/png";
      }
      document.head.appendChild(element);
    }
  };

  const updateMetaTag = (name: string, content: string) => {
    let element = document.querySelector<HTMLMetaElement>(
      `meta[name="${name}"]`
    );
    if (element) {
      element.content = content;
    } else {
      element = document.createElement("meta");
      element.name = name;
      element.content = content;
      document.head.appendChild(element);
    }
  };

  const updateMetaProperty = (property: string, content: string) => {
    let element = document.querySelector<HTMLMetaElement>(
      `meta[property="${property}"]`
    );
    if (element) {
      element.content = content;
    } else {
      element = document.createElement("meta");
      element.setAttribute("property", property);
      element.content = content;
      document.head.appendChild(element);
    }
  };

  return { clinic, isLoading };
}
