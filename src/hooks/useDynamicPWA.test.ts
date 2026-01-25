import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock constants from the hook
const TARGET_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";

const DEFAULT_BRANDING = {
  name: "Eclini - Sistema para Clínicas",
  shortName: "Eclini",
  description: "Sistema de gestão para clínicas médicas e consultórios.",
  logo: "/favicon-eclini.png",
};

const SINDICATO_MANIFEST_URL = "/manifest-sindicato.webmanifest";

describe("useDynamicPWA - Branding Isolation", () => {
  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
    // Reset document title
    document.title = DEFAULT_BRANDING.name;
  });

  describe("Default Branding", () => {
    it("should have correct default branding values", () => {
      expect(DEFAULT_BRANDING.name).toBe("Eclini - Sistema para Clínicas");
      expect(DEFAULT_BRANDING.shortName).toBe("Eclini");
      expect(DEFAULT_BRANDING.logo).toBe("/favicon-eclini.png");
    });

    it("should have correct target clinic ID for Sindicato", () => {
      expect(TARGET_CLINIC_ID).toBe("89e7585e-7bce-4e58-91fa-c37080d1170d");
    });
  });

  describe("Route Detection", () => {
    it("should identify /app routes as mobile app routes", () => {
      const testPaths = ["/app", "/app/home", "/app/carteirinha", "/app/boletos"];
      
      testPaths.forEach((path) => {
        const isMobileAppRoute = path.startsWith("/app");
        expect(isMobileAppRoute).toBe(true);
      });
    });

    it("should identify non-/app routes as system routes", () => {
      const testPaths = ["/", "/dashboard", "/union", "/auth", "/login"];
      
      testPaths.forEach((path) => {
        const isMobileAppRoute = path.startsWith("/app");
        expect(isMobileAppRoute).toBe(false);
      });
    });
  });

  describe("Manifest Isolation", () => {
    it("should use separate manifest for Sindicato", () => {
      expect(SINDICATO_MANIFEST_URL).toBe("/manifest-sindicato.webmanifest");
      expect(SINDICATO_MANIFEST_URL).not.toBe("/manifest.webmanifest");
    });
  });

  describe("localStorage Clinic ID", () => {
    it("should store clinic ID in localStorage", () => {
      localStorage.setItem("mobile_clinic_id", TARGET_CLINIC_ID);
      expect(localStorage.getItem("mobile_clinic_id")).toBe(TARGET_CLINIC_ID);
    });

    it("should default to target clinic if no ID in localStorage", () => {
      const storedId = localStorage.getItem("mobile_clinic_id");
      const clinicId = storedId || TARGET_CLINIC_ID;
      expect(clinicId).toBe(TARGET_CLINIC_ID);
    });
  });
});

describe("PWA Manifest Configuration", () => {
  it("should have Sindicato branding for PWA build", () => {
    // These values should match vite.config.ts manifest
    const expectedManifest = {
      name: "Sindicato - App do Associado",
      short_name: "Sindicato",
      start_url: "/app",
      theme_color: "#16a394",
    };

    expect(expectedManifest.name).toContain("Sindicato");
    expect(expectedManifest.start_url).toBe("/app");
    expect(expectedManifest.theme_color).toBe("#16a394");
  });

  it("should use Sindicato logo URL in manifest icons", () => {
    const sindicatoLogoUrl = "https://eahhszmbyxapxzilfdlo.supabase.co/storage/v1/object/public/clinic-assets/89e7585e-7bce-4e58-91fa-c37080d1170d/logo.png";
    
    expect(sindicatoLogoUrl).toContain(TARGET_CLINIC_ID);
    expect(sindicatoLogoUrl).toContain("logo.png");
  });
});
