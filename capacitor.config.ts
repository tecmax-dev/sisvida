import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.8431f322a2204cd0b9204d4e96cf05c6',
  appName: 'SECMI',
  webDir: 'dist',
  server: {
    url: 'https://8431f322-a220-4cd0-b920-4d4e96cf05c6.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
