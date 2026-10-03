import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export class EmergencyNotificationService {
  private static isInitialized = false;

  public static async initialize() {
    if (this.isInitialized || Capacitor.getPlatform() === 'web') {
      return;
    }

    try {
      await LocalNotifications.requestPermissions();
      this.isInitialized = true;
    } catch (error) {
      console.error('[EmergencyNotificationService] Initialization failed:', error);
    }
  }

  public static async sendEmergencyBatteryWarning(batteryPercent: number, dropRateMsg: string) {
    if (Capacitor.getPlatform() === 'web') {
      console.log(`[Web Fallback] Emergency Warning: Battery dropped to ${batteryPercent}%. ${dropRateMsg}`);
      return;
    }

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title: '⚠️ Extrem schneller Akkuverlust!',
            body: `Akkustand ist rapide auf ${batteryPercent}% gefallen. ${dropRateMsg} Bitte Reichweite prüfen!`,
            id: new Date().getTime(),
            schedule: { at: new Date(Date.now() + 1000) },
            sound: 'beep.wav',
            actionTypeId: '',
            extra: null,
          },
        ],
      });
      console.log('[EmergencyNotificationService] Local emergency battery warning scheduled.');
    } catch (error) {
      console.error('[EmergencyNotificationService] Failed to send emergency battery warning:', error);
    }
  }
}
