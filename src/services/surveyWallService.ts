/**
 * Survey Wall Integration for Der Wegweiser
 * Connects with BitLabs (bitlabs.ai) and CPX Research (cpx-research.com)
 * for high-payout market research surveys during e-bike charging stops.
 */

import { UserIdentity } from './userIdentity';

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
  private static bitlabsToken = import.meta.env.VITE_BITLABS_APP_TOKEN;
  private static cpxAppId = import.meta.env.VITE_CPX_APP_ID;

  /** Returns only data obtained from a real offerwall integration. */
  public static getAvailableSurveys(): AvailableSurvey[] {
    return [];
  }

  /**
   * Builds the direct web Offerwall URL for BitLabs
   */
  public static getOfferwallUrl(userId: string = UserIdentity.getUserId()): string {
    return `https://web.bitlabs.ai/?token=${this.bitlabsToken}&uid=${encodeURIComponent(userId)}`;
  }

  /**
   * Builds the direct web Offerwall URL for CPX Research
   */
  public static getCpxOfferwallUrl(userId: string = UserIdentity.getUserId()): string {
    return `https://offers.cpx-research.com/index.php?app_id=${this.cpxAppId}&ext_user_id=${encodeURIComponent(userId)}`;
  }
}
