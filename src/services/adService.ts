import { SoundFxService } from './soundFxService';

export interface SponsorAd {
  sponsorName: string;
  headline: string;
  tagline: string;
  buttonText: string;
  url: string;
  rewardTokens: number;
}

export const SPONSOR_ADS: SponsorAd[] = [
  {
    sponsorName: 'Bike-Energy Systems',
    headline: 'Schneller & sicherer E-Bike Strom an über 1.500 Stationen',
    tagline: 'Entdecke das handliche Ladekabel für Rucksack und Lenkertasche. Bis zu 2x schneller laden.',
    buttonText: 'Mehr erfahren & 10% sparen',
    url: 'https://bike-energy.com',
    rewardTokens: 15,
  },
  {
    sponsorName: 'Ortlieb Waterproof Gear',
    headline: '100% Wasserdichte Fahrradtaschen & Halterungen',
    tagline: 'Made in Germany. Bereit für jedes Unwetter und lange Bikepacking-Touren.',
    buttonText: 'Kollektion ansehen',
    url: 'https://www.ortlieb.com',
    rewardTokens: 15,
  },
];

export class AdService {
  /**
   * Shows a rewarded sponsor showcase. Returns true if user completed the showcase and earned reward.
   */
  public static async showRewardedAd(
    onRewardEarned: (tokens: number) => void
  ): Promise<boolean> {
    onRewardEarned(15);
    SoundFxService.playSuccessChime();
    return true;
  }
}
