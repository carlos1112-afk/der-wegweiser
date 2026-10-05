import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = getFirestore();

// Server-side source of truth for shop items
const SHOP_ITEMS: Record<string, { cost: number; code: string; category: string }> = {
  'coffee-pass': {
    cost: 40,
    category: 'voucher',
    code: 'WEGWEISER-KAFFEE-2026',
  },
  'cyber-skin': {
    cost: 75,
    category: 'style',
    code: 'SKIN-HOLO-CYBER',
  },
  'service-discount': {
    cost: 100,
    category: 'voucher',
    code: 'WERKSTATT-15-PRO',
  },
  'super-cloud-pass': {
    cost: 25,
    category: 'perk',
    code: 'VERTEX-VIP-BURST',
  },
};

export const redeemVoucher = onCall({ region: "europe-west3" }, async (request) => {
  const { data, auth } = request;

  // Ensure user is authenticated
  if (!auth) {
    throw new HttpsError(
      "unauthenticated",
      "User must be authenticated to redeem an item."
    );
  }

  const { itemId } = data;

  if (!itemId || !SHOP_ITEMS[itemId]) {
    throw new HttpsError(
      "invalid-argument",
      "Invalid item ID."
    );
  }

  const item = SHOP_ITEMS[itemId];
  const userId = auth.uid;

  const redemptionId = `${itemId}_${userId}`;
  const redemptionRef = db.collection("voucher_redemptions").doc(redemptionId);
  const tokenAccountRef = db.collection("user_tokens").doc(userId);

  try {
    const result = await db.runTransaction(async (transaction) => {
      // 1. Check double redemption
      const redemptionDoc = await transaction.get(redemptionRef);
      if (redemptionDoc.exists) {
        throw new HttpsError(
          "already-exists",
          "You have already redeemed this item."
        );
      }

      // 2. Check user's token balance
      const tokenDoc = await transaction.get(tokenAccountRef);
      if (!tokenDoc.exists) {
        throw new HttpsError(
          "not-found",
          "Token account not found."
        );
      }

      const tokenData = tokenDoc.data();
      const currentBalance = tokenData?.balance || 0;
      const unlimited = tokenData?.unlimitedOnDemand || false;

      if (!unlimited && currentBalance < item.cost) {
        throw new HttpsError(
          "failed-precondition",
          "Insufficient tokens."
        );
      }

      // 3. Deduct tokens and record redemption atomically
      if (!unlimited) {
        transaction.update(tokenAccountRef, {
          balance: currentBalance - item.cost
        });
      }

      transaction.set(redemptionRef, {
        itemId,
        userId,
        cost: item.cost,
        redeemedAt: FieldValue.serverTimestamp(),
      });

      return { success: true, code: item.code, message: "Item redeemed successfully." };
    });

    return result;
  } catch (error: any) {
    if (error.code && error.code !== 'internal') {
        throw error;
    }
    throw new HttpsError(
      "internal",
      `Error redeeming item: ${error.message}`
    );
  }
});

export * from "./issueGoogleMapsKey";
export * from "./vertexRouting";
