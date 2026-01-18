import { useEffect } from "react";

/**
 * Hook to dynamically update the favicon and apple-touch-icon
 * based on the clinic's logo URL
 */
export function useDynamicFavicon(logoUrl: string | null | undefined) {
  useEffect(() => {
    if (!logoUrl) return;

    // Update favicon
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (favicon) {
      favicon.href = logoUrl;
    } else {
      const newFavicon = document.createElement('link');
      newFavicon.rel = 'icon';
      newFavicon.type = 'image/png';
      newFavicon.href = logoUrl;
      document.head.appendChild(newFavicon);
    }

    // Update apple-touch-icon
    const appleTouchIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (appleTouchIcon) {
      appleTouchIcon.href = logoUrl;
    } else {
      const newAppleTouchIcon = document.createElement('link');
      newAppleTouchIcon.rel = 'apple-touch-icon';
      newAppleTouchIcon.href = logoUrl;
      document.head.appendChild(newAppleTouchIcon);
    }

    // Update PWA manifest icons dynamically (for browsers that support it)
    // This creates a dynamic manifest blob URL
    const updateManifest = async () => {
      try {
        const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
        if (!manifestLink) return;

        // Fetch the current manifest
        const response = await fetch(manifestLink.href);
        const manifest = await response.json();

        // Update all icon sources to use the clinic logo
        if (manifest.icons) {
          manifest.icons = manifest.icons.map((icon: { sizes: string; type: string }) => ({
            ...icon,
            src: logoUrl,
          }));
        }

        // Create a new blob URL for the updated manifest
        const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
        const newManifestUrl = URL.createObjectURL(blob);

        // Replace the manifest link
        manifestLink.href = newManifestUrl;
      } catch (error) {
        console.log('Could not update manifest dynamically:', error);
      }
    };

    updateManifest();

    // Cleanup function
    return () => {
      // Restore original favicon if needed (optional)
    };
  }, [logoUrl]);
}
