import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.8431f322a2204cd0b9204d4e96cf05c6',
  appName: 'SECMI',
  webDir: 'dist',
  server: {
    // Use the published web app so the native wrapper always shows the latest version
    url: 'https://sisvida.lovable.app?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
