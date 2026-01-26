import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: [
        "pwa-192x192.png",
        "pwa-512x512.png",
        "favicon.ico",
      ],
      manifest: {
        name: "Sindicato - App do Associado",
        short_name: "Sindicato",
        description: "Aplicativo do associado para acesso a serviços, carteirinha digital, boletos e muito mais.",
        theme_color: "#16a394",
        background_color: "#16a394",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/app",
        icons: [
          {
            src: "https://eahhszmbyxapxzilfdlo.supabase.co/storage/v1/object/public/clinic-assets/89e7585e-7bce-4e58-91fa-c37080d1170d/logo.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "https://eahhszmbyxapxzilfdlo.supabase.co/storage/v1/object/public/clinic-assets/89e7585e-7bce-4e58-91fa-c37080d1170d/logo.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "https://eahhszmbyxapxzilfdlo.supabase.co/storage/v1/object/public/clinic-assets/89e7585e-7bce-4e58-91fa-c37080d1170d/logo.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        categories: ["business", "utilities"],
        lang: "pt-BR",
        dir: "ltr"
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,jpg,jpeg,webp,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB limit
        cleanupOutdatedCaches: true, // Limpar caches antigos automaticamente
        skipWaiting: true, // Ativar novo SW imediatamente
        clientsClaim: true, // Tomar controle imediatamente - atualizações mais rápidas
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5, // 5 minutos (reduzido de 24h)
              },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core
          "vendor-react": ["react", "react-dom"],
          // Router
          "vendor-router": ["react-router-dom"],
          // UI Framework - Radix primitives
          "vendor-radix": [
            "@radix-ui/react-accordion",
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-avatar",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-collapsible",
            "@radix-ui/react-context-menu",
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-hover-card",
            "@radix-ui/react-label",
            "@radix-ui/react-menubar",
            "@radix-ui/react-navigation-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-progress",
            "@radix-ui/react-radio-group",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-select",
            "@radix-ui/react-separator",
            "@radix-ui/react-slider",
            "@radix-ui/react-slot",
            "@radix-ui/react-switch",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
            "@radix-ui/react-toggle",
            "@radix-ui/react-toggle-group",
            "@radix-ui/react-tooltip",
          ],
          // Charts
          "vendor-charts": ["recharts"],
          // Forms
          "vendor-forms": ["react-hook-form", "@hookform/resolvers", "zod"],
          // Date handling
          "vendor-date": ["date-fns", "react-day-picker"],
          // PDF generation
          "vendor-pdf": ["jspdf", "jspdf-autotable"],
          // Drag and drop
          "vendor-dnd": ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
          // Supabase
          "vendor-supabase": ["@supabase/supabase-js"],
          // Query
          "vendor-query": ["@tanstack/react-query"],
          // Icons
          "vendor-icons": ["lucide-react"],
        },
      },
    },
  },
}));
