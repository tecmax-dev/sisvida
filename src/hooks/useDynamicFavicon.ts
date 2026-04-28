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

    // Do not rewrite the manifest at runtime. PWABuilder and Google Play must
    // always see the static manifest with the official Android Package ID.

    // Cleanup function
    return () => {
      // Revoke any created blob URLs if needed
    };
  }, [logoUrl, clinicName]);
}
