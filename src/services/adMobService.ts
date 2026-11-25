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
      return;
    }

    try {
      const plugin = await import(/* @vite-ignore */ '@capacitor-community/admob' as any).catch(() => null);
      if (plugin?.AdMob && typeof plugin.AdMob.initialize === 'function') {
        await plugin.AdMob.initialize({ initializeForTesting: true }).catch(() => {});
        isInitialized = true;
      }
    } catch {
      // Fail-safe non-blocking
    }
  },

  showBanner: async (adId: string = TEST_BANNER_ID) => {
    if (!ConsentService.hasValidConsent()) return;

    try {
      const plugin = await import(/* @vite-ignore */ '@capacitor-community/admob' as any).catch(() => null);
      if (plugin?.AdMob && typeof plugin.AdMob.showBanner === 'function') {
        if (!isInitialized) await AdMobService.initialize();
        const options: BannerAdOptions = {
          adId,
          adSize: plugin.BannerAdSize?.BANNER ?? 'BANNER',
          position: plugin.BannerAdPosition?.BOTTOM_CENTER ?? 'BOTTOM_CENTER',
          margin: 60,
          isTesting: true,
        };
        await plugin.AdMob.showBanner(options).catch(() => {});
      }
    } catch {
      // Fail-safe non-blocking
    }
  },

  hideBanner: async () => {
    try {
      const plugin = await import(/* @vite-ignore */ '@capacitor-community/admob' as any).catch(() => null);
      if (plugin?.AdMob && typeof plugin.AdMob.hideBanner === 'function') {
        await plugin.AdMob.hideBanner().catch(() => {});
      }
    } catch {
      // Fail-safe non-blocking
    }
  },

  showInterstitial: async (adId: string = TEST_INTERSTITIAL_ID) => {
    if (!ConsentService.hasValidConsent()) return;

    try {
      const plugin = await import(/* @vite-ignore */ '@capacitor-community/admob' as any).catch(() => null);
      if (plugin?.AdMob && typeof plugin.AdMob.showInterstitial === 'function') {
        if (!isInitialized) await AdMobService.initialize();
        const options: AdOptions = { adId, isTesting: true };
        await plugin.AdMob.prepareInterstitial(options).catch(() => {});
        await plugin.AdMob.showInterstitial().catch(() => {});
      }
    } catch {
      // Fail-safe non-blocking
    }
  },

  showRewardVideo: async (adId: string = TEST_REWARDED_ID, onReward: () => void): Promise<boolean> => {
    if (!ConsentService.hasValidConsent()) return false;

    try {
      const plugin = await import(/* @vite-ignore */ '@capacitor-community/admob' as any).catch(() => null);
      if (plugin?.AdMob && typeof plugin.AdMob.showRewardVideoAd === 'function') {
        if (!isInitialized) await AdMobService.initialize();
        const options: AdOptions = { adId, isTesting: true };
        await plugin.AdMob.prepareRewardVideoAd(options).catch(() => {});
        await plugin.AdMob.showRewardVideoAd().catch(() => {});
        onReward();
        return true;
      }
    } catch {
      // Fail-safe non-blocking
    }
    return false;
  },
};
