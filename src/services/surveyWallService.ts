/**
 * Survey Wall Integration for Der Wegweiser
 * Connects with BitLabs (bitlabs.ai) and CPX Research (cpx-research.com)
 * for high-payout market research surveys during e-bike charging stops.
 */

export interface AvailableSurvey {
  id: string;
  title: string;
  topic: string;
  durationMinutes: number;
  tokenReward: number;
  rating: number; // 1-5 stars
  payoutEurEst: string;
}

export class SurveyWallService {
  private static bitlabsToken = import.meta.env.VITE_BITLABS_APP_TOKEN || 'demo-bitlabs-token';
  private static cpxAppId = import.meta.env.VITE_CPX_APP_ID || 'demo-cpx-id';

  /**
   * Generates sample/live survey list for immediate UI interaction
   */
  public static getAvailableSurveys(): AvailableSurvey[] {
    return [
      {
        id: 'survey-mobility-2026',
        title: 'Mobilität & E-Bike Trends 2026',
        topic: 'Verkehr, Pendeln & E-Bikes',
        durationMinutes: 3,
        tokenReward: 60,
        rating: 4.8,
        payoutEurEst: '0,80 €',
      },
      {
        id: 'survey-outdoor-gear',
        title: 'Outdoor-Navigation & Sport-Equipment',
        topic: 'Freizeit & Fahrrad-Zubehör',
        durationMinutes: 5,
        tokenReward: 110,
        rating: 4.9,
        payoutEurEst: '1,40 €',
      },
      {
        id: 'survey-charging-infra',
        title: 'Ladeinfrastruktur im ländlichen Raum',
        topic: 'Energie & Grüne Mobilität',
        durationMinutes: 2,
        tokenReward: 45,
        rating: 4.6,
        payoutEurEst: '0,55 €',
      },
      {
        id: 'survey-smart-living',
        title: 'Smart Tech & Smartphone-Nutzung',
        topic: 'Technologie & Apps',
        durationMinutes: 7,
        tokenReward: 160,
        rating: 5.0,
        payoutEurEst: '2,10 €',
      },
    ];
  }

  /**
   * Builds the direct web Offerwall URL for BitLabs
   */
  public static getOfferwallUrl(userId: string = 'user-1'): string {
    return `https://web.bitlabs.ai/?token=${this.bitlabsToken}&uid=${encodeURIComponent(userId)}`;
  }

  /**
   * Builds the direct web Offerwall URL for CPX Research
   */
  public static getCpxOfferwallUrl(userId: string = 'user-1'): string {
    return `https://offers.cpx-research.com/index.php?app_id=${this.cpxAppId}&ext_user_id=${encodeURIComponent(userId)}`;
  }
}
