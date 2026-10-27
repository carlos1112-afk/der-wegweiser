import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue, type DocumentReference } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
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

const ACCOUNT_DATA_COLLECTIONS = [
  'routes',
  'charging_stations',
  'charging_stations_v2',
  'points_of_interest',
  'scout_reports',
  'station_reviews',
  'voucher_redemptions',
];

async function deleteAccountDocuments(uid: string): Promise<void> {
  const documentRefs = new Map<string, DocumentReference>();
  for (const path of ['users', 'user_tokens', 'user_preferences', 'user_memory_patterns', 'cesiumKeyRequests', 'keyRequests', 'account_deletion_jobs']) {
    documentRefs.set(`${path}/${uid}`, db.collection(path).doc(uid));
  }

  for (const collectionName of ACCOUNT_DATA_COLLECTIONS) {
    for (const ownerField of ['createdByUserId', 'userId']) {
      const snapshot = await db.collection(collectionName).where(ownerField, '==', uid).get();
      snapshot.docs.forEach((document) => documentRefs.set(document.ref.path, document.ref));
    }
  }

  const refs = [...documentRefs.values()];
  for (let offset = 0; offset < refs.length; offset += 400) {
    const batch = db.batch();
    refs.slice(offset, offset + 400).forEach((documentRef) => batch.delete(documentRef));
    await batch.commit();
  }
}

export const deleteAccountData = onCall({ region: "europe-west3" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated to delete an account.");
  }

  const uid = request.auth.uid;
  const jobRef = db.collection('account_deletion_jobs').doc(uid);
  const existingJob = await jobRef.get();
  if (existingJob.data()?.status === 'completed') {
    return { success: true, status: 'completed', jobId: uid };
  }

  await jobRef.set({
    uid,
    status: 'running',
    startedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  try {
    await deleteAccountDocuments(uid);
    const bucket = getStorage().bucket();
    const [files] = await bucket.getFiles({ prefix: `users/${uid}/` });
    await Promise.all(files.map((file) => file.delete()));

    try {
      await getAuth().deleteUser(uid);
    } catch (error: any) {
      if (error?.code !== 'auth/user-not-found') throw error;
    }

    await jobRef.delete();
    return { success: true, status: 'completed', jobId: uid };
  } catch (error: any) {
    await jobRef.set({
      uid,
      status: 'failed',
      error: String(error?.message || error),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    throw new HttpsError('failed-precondition', 'Account cleanup did not complete; retry the deletion.', { jobId: uid });
  }
});

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
export * from "./issueCesiumIonToken";
export * from "./vertexRouting";
export * from "./aiProxy";
