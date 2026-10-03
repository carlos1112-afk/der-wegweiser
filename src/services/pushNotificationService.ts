import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export class PushNotificationService {
  private static isInitialized = false;

  public static async initialize() {
    if (this.isInitialized || Capacitor.getPlatform() === 'web') {
      return;
    }

    try {
      const { receive } = await PushNotifications.requestPermissions();

      if (receive === 'granted') {
        await PushNotifications.register();
      }

      await LocalNotifications.requestPermissions();

      PushNotifications.addListener('registration', (token) => {
        console.log('[FCM] Push registration success, token: ' + token.value);
        // We could send this token to our backend here
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('[FCM] Error on registration: ' + JSON.stringify(error));
      });

      PushNotifications.addListener(
        'pushNotificationReceived',
        (notification) => {
          console.log('[FCM] Push received: ' + JSON.stringify(notification));
        }
      );

      PushNotifications.addListener(
        'pushNotificationActionPerformed',
        (notification) => {
          console.log('[FCM] Push action performed: ' + JSON.stringify(notification));
        }
      );

      this.isInitialized = true;
    } catch (error) {
      console.error('[PushNotificationService] Initialization failed:', error);
    }
  }

  public static async sendEmergencyBatteryWarning(batteryPercent: number, dropRateMsg: string) {
    if (Capacitor.getPlatform() === 'web') {
      console.log(`[Web Fallback] FCM Emergency Warning: Battery dropped to ${batteryPercent}%. ${dropRateMsg}`);
      return;
    }

    try {
      // Mocking a backend call to an FCM Cloud Function or Endpoint for the pipeline
      // We will perform a fetch to simulate triggering the remote FCM function
      const backendTriggerUrl = 'https://us-central1-der-wegweiser.cloudfunctions.net/triggerFCMBackgroundWarning';

      const payload = {
        title: '⚠️ Extrem schneller Akkuverlust!',
        body: `Akkustand ist rapide auf ${batteryPercent}% gefallen. ${dropRateMsg} Bitte Reichweite prüfen!`,
        batteryPercent: batteryPercent,
      };

      // In a real app we'd await this, but since it's a mock we'll catch the network error gracefully
      fetch(backendTriggerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {
        console.log('[PushNotificationService] FCM backend trigger mock: Cloud Function unreachable, fallback to local pipeline.');
      });

      // Still simulate the immediate visual reception on client side without a real backend response
      await LocalNotifications.schedule({
        notifications: [
          {
            title: payload.title,
            body: payload.body,
            id: new Date().getTime(),
            schedule: { at: new Date(Date.now() + 1000) },
            sound: 'beep.wav',
            actionTypeId: '',
            extra: null,
          },
        ],
      });
      console.log('[PushNotificationService] FCM background emergency battery warning pipeline triggered.');
    } catch (error) {
      console.error('[PushNotificationService] Failed to send emergency battery warning:', error);
    }
  }
}
