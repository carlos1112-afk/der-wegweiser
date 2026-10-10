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
   * Generates a deterministic, opaque external ID using SHA-256 to protect the internal
   * Firebase UID when communicating with third-party offerwalls.
   * This hash can be used by the backend webhook to look up the user by querying a
   * 'surveyWallId' field or by computing the same hash on the backend, thus avoiding
   * plaintext UID exposure in third-party postbacks.
   */
  public static async generateExternalId(userId: string = UserIdentity.getUserId()): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(userId + 'surveywall-salt-v1');

    try {
      // Use Web Crypto API if available (Secure Contexts)
      if (typeof crypto !== 'undefined' && crypto.subtle) {
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return `ext-${hashHex.substring(0, 32)}`;
      }
    } catch(e) {
      // Fallback handled below
    }

    // Synchronous fallback for non-secure contexts or testing environments without crypto
    let hash = 0;
    const str = userId + 'surveywall-salt-v1';
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    const hex = (hash >>> 0).toString(16).padStart(8, '0');
    return `ext-fallback-${hex}`;
  }

  /**
   * Builds the direct web Offerwall URL for BitLabs
   */
  public static async getOfferwallUrl(userId: string = UserIdentity.getUserId()): Promise<string> {
    const extId = await this.generateExternalId(userId);
    return `https://web.bitlabs.ai/?token=${this.bitlabsToken}&uid=${encodeURIComponent(extId)}`;
  }

  /**
   * Builds the direct web Offerwall URL for CPX Research
   */
  public static async getCpxOfferwallUrl(userId: string = UserIdentity.getUserId()): Promise<string> {
    const extId = await this.generateExternalId(userId);
    return `https://offers.cpx-research.com/index.php?app_id=${this.cpxAppId}&ext_user_id=${encodeURIComponent(extId)}`;
  }
}
