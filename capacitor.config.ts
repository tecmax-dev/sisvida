import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.org.secmi.comerciariosilheus.app',
  appName: 'Comerciários',
  webDir: 'dist',
  server: {
    // Use the published web app so the native wrapper always shows the latest version
    url: 'https://sindexa.com.br?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
