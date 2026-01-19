import { useEffect } from "react";

/**
 * Hook to dynamically update the favicon, apple-touch-icon, and PWA manifest
 * based on the clinic's logo URL and name
 */
export function useDynamicFavicon(
  logoUrl: string | null | undefined,
  clinicName?: string | null
) {
  useEffect(() => {
    if (!logoUrl) return;

    // Update favicon
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (favicon) {
      favicon.href = logoUrl;
    } else {
      const newFavicon = document.createElement("link");
      newFavicon.rel = "icon";
      newFavicon.type = "image/png";
      newFavicon.href = logoUrl;
      document.head.appendChild(newFavicon);
    }

    // Update apple-touch-icon
    const appleTouchIcon = document.querySelector<HTMLLinkElement>(
      'link[rel="apple-touch-icon"]'
    );
    if (appleTouchIcon) {
      appleTouchIcon.href = logoUrl;
    } else {
      const newAppleTouchIcon = document.createElement("link");
      newAppleTouchIcon.rel = "apple-touch-icon";
      newAppleTouchIcon.href = logoUrl;
      document.head.appendChild(newAppleTouchIcon);
    }

    // Update apple-touch-icon-precomposed for older iOS
    let appleTouchIconPrecomposed = document.querySelector<HTMLLinkElement>(
      'link[rel="apple-touch-icon-precomposed"]'
    );
    if (!appleTouchIconPrecomposed) {
      appleTouchIconPrecomposed = document.createElement("link");
      appleTouchIconPrecomposed.rel = "apple-touch-icon-precomposed";
      document.head.appendChild(appleTouchIconPrecomposed);
    }
    appleTouchIconPrecomposed.href = logoUrl;

    // Update PWA app title meta tags
    if (clinicName) {
      // Update apple-mobile-web-app-title
      let appTitle = document.querySelector<HTMLMetaElement>(
        'meta[name="apple-mobile-web-app-title"]'
      );
      if (appTitle) {
        appTitle.content = clinicName;
      } else {
        appTitle = document.createElement("meta");
        appTitle.name = "apple-mobile-web-app-title";
        appTitle.content = clinicName;
        document.head.appendChild(appTitle);
      }

      // Update application-name
      let appName = document.querySelector<HTMLMetaElement>(
        'meta[name="application-name"]'
      );
      if (appName) {
        appName.content = clinicName;
      } else {
        appName = document.createElement("meta");
        appName.name = "application-name";
        appName.content = clinicName;
        document.head.appendChild(appName);
      }
    }

    // Update PWA manifest icons dynamically
    const updateManifest = async () => {
      try {
        const manifestLink =
          document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
        if (!manifestLink) return;

        // Fetch the current manifest
        const response = await fetch(manifestLink.href);
        const manifest = await response.json();

        // Update the name if provided
        if (clinicName) {
          manifest.name = clinicName;
          manifest.short_name = clinicName.substring(0, 12);
        }

        // Update all icon sources to use the clinic logo
        if (manifest.icons) {
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

    updateManifest();

    // Cleanup function
    return () => {
      // Revoke any created blob URLs if needed
    };
  }, [logoUrl, clinicName]);
}
