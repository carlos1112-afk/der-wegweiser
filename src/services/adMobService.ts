// AdMob integration for Capacitor with privacy consent checks (DSGVO / § 25 TDDDG)
import { ConsentService } from './consentService';

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
const TEST_REWARDED_ID = 'ca-app-pub-3940256099942544/5224354917';

let isInitialized = false;

export const AdMobService = {
  initialize: async () => {
    if (isInitialized) return;
    if (!ConsentService.hasValidConsent()) {
      console.log('[AdMobService] Deferred initialization: user consent not yet granted.');
      return;
    }

    try {
      const plugin = await import(/* @vite-ignore */ '@capacitor-community/admob' as any).catch(() => null);
      if (plugin?.AdMob) {
        await plugin.AdMob.initialize({ initializeForTesting: true });
        isInitialized = true;
        console.log('[AdMobService] AdMob initialized successfully.');
      } else {
        console.log('[AdMobService] Running in web/mock mode.');
      }
    } catch (error) {
      console.warn('[AdMobService] AdMob initialization failed:', error);
    }
  },

  showBanner: async (adId: string = TEST_BANNER_ID) => {
    if (!ConsentService.hasValidConsent()) return;

    try {
      const plugin = await import(/* @vite-ignore */ '@capacitor-community/admob' as any).catch(() => null);
      if (plugin?.AdMob) {
        if (!isInitialized) await AdMobService.initialize();
        const options: BannerAdOptions = {
          adId,
          adSize: plugin.BannerAdSize?.BANNER ?? 'BANNER',
          position: plugin.BannerAdPosition?.BOTTOM_CENTER ?? 'BOTTOM_CENTER',
          margin: 60, // Keep above bottom navigation bar
          isTesting: true,
        };
        await plugin.AdMob.showBanner(options);
        console.log('[AdMobService] Banner ad shown at bottom.');
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
        console.log('[AdMobService] Banner ad hidden.');
      }
    } catch (error) {
      console.warn('[AdMobService] Hide banner failed:', error);
    }
  },

  showInterstitial: async (adId: string = TEST_INTERSTITIAL_ID) => {
    if (!ConsentService.hasValidConsent()) return;

    try {
      const plugin = await import(/* @vite-ignore */ '@capacitor-community/admob' as any).catch(() => null);
      if (plugin?.AdMob) {
        if (!isInitialized) await AdMobService.initialize();
        const options: AdOptions = { adId, isTesting: true };
        await plugin.AdMob.prepareInterstitial(options);
        await plugin.AdMob.showInterstitial();
        console.log('[AdMobService] Interstitial ad presented.');
      }
    } catch (error) {
      console.warn('[AdMobService] Interstitial ad failed:', error);
    }
  },

  showRewardVideo: async (adId: string = TEST_REWARDED_ID, onReward: () => void): Promise<boolean> => {
    if (!ConsentService.hasValidConsent()) return false;

    try {
      const plugin = await import(/* @vite-ignore */ '@capacitor-community/admob' as any).catch(() => null);
      if (plugin?.AdMob) {
        if (!isInitialized) await AdMobService.initialize();
        const options: AdOptions = { adId, isTesting: true };
        await plugin.AdMob.prepareRewardVideoAd(options);
        await plugin.AdMob.showRewardVideoAd();
        onReward();
        console.log('[AdMobService] Rewarded video ad completed.');
        return true;
      }
    } catch (error) {
      console.warn('[AdMobService] Rewarded video ad failed:', error);
    }
    return false;
  },
};
