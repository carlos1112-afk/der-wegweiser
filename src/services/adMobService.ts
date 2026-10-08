// Optional AdMob integration for Capacitor
// Provides graceful no-op fallback when @capacitor-community/admob is not installed
export interface BannerAdOptions {
  adId: string;
  adSize?: string;
  position?: string;
  margin?: number;
  isTesting?: boolean;
}

export interface AdOptions {
  adId: string;
  isTesting?: boolean;
}

const TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';
const TEST_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712';

export const AdMobService = {
  initialize: async () => {
    try {
      const plugin = await import(/* @vite-ignore */ '@capacitor-community/admob' as any).catch(() => null);
      if (plugin?.AdMob) {
        await plugin.AdMob.initialize({ initializeForTesting: true });
        console.log('[AdMobService] AdMob initialized.');
      } else {
        console.log('[AdMobService] Running in mock/stub mode (plugin not installed).');
      }
    } catch (error) {
      console.warn('[AdMobService] AdMob initialization failed:', error);
    }
  },

  showBanner: async (adId: string = TEST_BANNER_ID) => {
    try {
      const plugin = await import(/* @vite-ignore */ '@capacitor-community/admob' as any).catch(() => null);
      if (plugin?.AdMob) {
        const options: BannerAdOptions = {
          adId,
          adSize: plugin.BannerAdSize?.BANNER ?? 'BANNER',
          position: plugin.BannerAdPosition?.BOTTOM_CENTER ?? 'BOTTOM_CENTER',
          margin: 0,
          isTesting: true,
        };
        await plugin.AdMob.showBanner(options);
        console.log('[AdMobService] Banner shown.');
      }
    } catch (error) {
      console.warn('[AdMobService] Show banner failed:', error);
    }
  },

  hideBanner: async () => {
    try {
      const plugin = await import(/* @vite-ignore */ '@capacitor-community/admob' as any).catch(() => null);
      if (plugin?.AdMob) {
        await plugin.AdMob.hideBanner();
      }
    } catch (error) {
      console.warn('[AdMobService] Hide banner failed:', error);
    }
  },

  showInterstitial: async (adId: string = TEST_INTERSTITIAL_ID) => {
    try {
      const plugin = await import(/* @vite-ignore */ '@capacitor-community/admob' as any).catch(() => null);
      if (plugin?.AdMob) {
        const options: AdOptions = { adId, isTesting: true };
        await plugin.AdMob.prepareInterstitial(options);
        await plugin.AdMob.showInterstitial();
        console.log('[AdMobService] Interstitial shown.');
      }
    } catch (error) {
      console.warn('[AdMobService] Interstitial failed:', error);
    }
  },
};
