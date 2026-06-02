import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lalaquiz.app',
  appName: 'Lala Quiz',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    allowNavigation: ['*'],
  },
  plugins: {
    Camera: {
      permissions: ['camera', 'photos'],
    },
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
