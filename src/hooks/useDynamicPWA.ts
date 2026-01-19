import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ClinicBranding {
  name: string;
  logo_url: string | null;
  entity_nomenclature: string | null;
}

/**
 * Hook to dynamically update the PWA branding (favicon, manifest, meta tags)
 * based on the clinic's data for the mobile app
 */
export function useDynamicPWA() {
  const [clinic, setClinic] = useState<ClinicBranding | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadClinicBranding = async () => {
      const clinicId = localStorage.getItem("mobile_clinic_id");
      if (!clinicId) {
        setIsLoading(false);
        return;
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

    loadClinicBranding();
  }, []);

  const applyBranding = (clinicData: ClinicBranding) => {
    const { name, logo_url } = clinicData;

    // Update document title
    document.title = name;

    // Update favicon
    updateLinkElement("icon", logo_url);
    updateLinkElement("apple-touch-icon", logo_url);
    updateLinkElement("apple-touch-icon-precomposed", logo_url);

    // Update meta tags
    updateMetaTag("apple-mobile-web-app-title", name);
    updateMetaTag("application-name", name);
    updateMetaTag("description", `App oficial do ${name}`);

    // Update Open Graph tags
    updateMetaProperty("og:title", name);
    updateMetaProperty("og:site_name", name);
    if (logo_url) {
      updateMetaProperty("og:image", logo_url);
    }

    // Update Twitter tags
    updateMetaProperty("twitter:title", name);
    if (logo_url) {
      updateMetaProperty("twitter:image", logo_url);
    }

    // Update PWA manifest
    updateManifest(name, logo_url);
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

  const updateManifest = async (name: string, logoUrl: string | null) => {
    try {
      const manifestLink =
        document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
      if (!manifestLink) return;

      // Fetch the current manifest
      const response = await fetch(manifestLink.href);
      const manifest = await response.json();

      // Update the name
      manifest.name = name;
      manifest.short_name = name.length > 12 ? name.substring(0, 12) : name;
      manifest.description = `App oficial do ${name}`;

      // Update all icon sources if we have a logo
      if (logoUrl && manifest.icons) {
        manifest.icons = manifest.icons.map(
          (icon: { sizes: string; type: string; purpose?: string }) => ({
            ...icon,
            src: logoUrl,
          })
        );
      }

      // Create a new blob URL for the updated manifest
      const blob = new Blob([JSON.stringify(manifest)], {
        type: "application/json",
      });
      const newManifestUrl = URL.createObjectURL(blob);

      // Create a new manifest link to replace the old one
      const newManifestLink = document.createElement("link");
      newManifestLink.rel = "manifest";
      newManifestLink.href = newManifestUrl;

      // Remove old and add new
      manifestLink.remove();
      document.head.appendChild(newManifestLink);
    } catch (error) {
      console.log("Could not update manifest dynamically:", error);
    }
  };

  return { clinic, isLoading };
}
