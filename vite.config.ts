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
        "icon-72x72.png",
        "icon-96x96.png",
        "icon-128x128.png",
        "icon-144x144.png",
        "icon-152x152.png",
        "icon-192x192.png",
        "icon-384x384.png",
        "icon-512x512.png",
      ],
      manifest: {
        name: "Eclini - Gestão para Clínicas",
        short_name: "Eclini",
        description: "Sistema completo para gestão de clínicas e consultórios",
        theme_color: "#16a394",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/auth",
        icons: [
          {
            src: "icon-72x72.png",
            sizes: "72x72",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-96x96.png",
            sizes: "96x96",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-128x128.png",
            sizes: "128x128",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-144x144.png",
            sizes: "144x144",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-152x152.png",
            sizes: "152x152",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-384x384.png",
            sizes: "384x384",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,jpg,jpeg,webp,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB limit
        cleanupOutdatedCaches: true, // Limpar caches antigos automaticamente
        skipWaiting: false, // NÃO ativar novo SW imediatamente - evita reload inesperado
        clientsClaim: false, // NÃO tomar controle imediatamente - evita remount do App
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24,
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
