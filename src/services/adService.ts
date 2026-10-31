export interface SponsorAd {
  sponsorName: string;
  headline: string;
  tagline: string;
  buttonText: string;
  url: string;
  rewardTokens: number;
}

/** No rewarded-ad provider or server-side reward verification is configured yet. */
export const SPONSOR_ADS: SponsorAd[] = [];

export class AdService {
  /**
   * Fail-closed until a real rewarded-ad provider and server-verifiable callback are configured.
   */
  public static async showRewardedAd(
    _onRewardEarned: (tokens: number) => void
  ): Promise<boolean> {
    return false;
  }
}
