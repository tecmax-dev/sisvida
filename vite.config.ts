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
        name: "SECMI - Sindicato dos Comerciários de Ilhéus e Região",
        short_name: "SECMI",
        description: "Aplicativo do associado para acesso a serviços, carteirinha digital, boletos e muito mais.",
        theme_color: "#16a394",
        background_color: "#16a394",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/app",
        id: "/app",
        icons: [
          {
            src: "/icon-72x72.png",
            sizes: "72x72",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-96x96.png",
            sizes: "96x96",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-128x128.png",
            sizes: "128x128",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-144x144.png",
            sizes: "144x144",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-152x152.png",
            sizes: "152x152",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-384x384.png",
            sizes: "384x384",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        screenshots: [
          {
            src: "/screenshots/screenshot-1.png",
            sizes: "1080x1920",
            type: "image/png",
            form_factor: "narrow",
            label: "Tela inicial do app",
          },
          {
            src: "/screenshots/screenshot-2.png",
            sizes: "1080x1920",
            type: "image/png",
            form_factor: "narrow",
            label: "Carteirinha digital do associado",
          },
          {
            src: "/screenshots/screenshot-3.png",
            sizes: "1080x1920",
            type: "image/png",
            form_factor: "narrow",
            label: "Agendamento de consultas",
          },
          {
            src: "/screenshots/screenshot-wide-1.png",
            sizes: "1920x1080",
            type: "image/png",
            form_factor: "wide",
            label: "Carteirinha digital em tela ampla",
          },
        ],
        related_applications: [
          {
            platform: "play",
            url: "https://play.google.com/store/apps/details?id=br.org.secmi.app",
            id: "br.org.secmi.app",
          },
        ],
        prefer_related_applications: false,
        categories: ["business", "utilities"],
        lang: "pt-BR",
        dir: "ltr",
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,jpg,jpeg,webp,svg,woff2,webmanifest}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, // 6 MB limit
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        // CRÍTICO: Nunca cachear rotas de OAuth ou redirecionamentos especiais
        navigateFallbackDenylist: [
          /^\/~oauth/,
          /^\/auth\/callback/,
          /^\/sindicato\/instalar/,
        ],
        // Force cache invalidation with version timestamp
        additionalManifestEntries: [
          { url: '/cache-bust-v20260428-icon-renewal', revision: null },
          { url: '/manifest-sindicato.webmanifest', revision: '20260428-icon-renewal' },
        ],
        runtimeCaching: [
          // Disponibilidade/agendamento mobile - nunca usar cache para evitar slots fantasmas
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/functions\/v1\/(mobile-slot-availability|mobile-booking-init)(\?.*)?$/i,
            handler: "NetworkOnly",
          },
          // Manifests - sempre da rede (crítico para instalação do PWA)
          {
            urlPattern: /\.webmanifest$/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "manifest-cache",
              networkTimeoutSeconds: 3,
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Popup notices - SEMPRE buscar da rede (sem cache)
          {
            urlPattern: /popup_notices/i,
            handler: "NetworkOnly",
          },
          // Imagens de popup do storage - Network First com cache curto
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*popup.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "popup-images-cache",
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Outras requisições Supabase
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-cache-v2",
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Let Pusher Beams requests bypass cache
          {
            urlPattern: /^https:\/\/.*\.pusher\.com\/.*/i,
            handler: "NetworkOnly",
          },
          {
            urlPattern: /^https:\/\/.*\.pushnotifications\.pusher\.com\/.*/i,
            handler: "NetworkOnly",
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
  optimizeDeps: {
    esbuildOptions: {
      target: "es2022",
    },
    exclude: ["pdfjs-dist"],
  },
  build: {
    target: "es2022",
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
