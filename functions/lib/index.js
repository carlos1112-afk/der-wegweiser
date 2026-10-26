"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redeemVoucher = exports.deleteAccountData = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const storage_1 = require("firebase-admin/storage");
const admin = require("firebase-admin");
admin.initializeApp();
const db = (0, firestore_1.getFirestore)();
// Server-side source of truth for shop items
const SHOP_ITEMS = {
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
];
async function deleteAccountDocuments(uid) {
    const documentRefs = new Map();
    for (const path of ['users', 'user_tokens', 'user_preferences', 'user_memory_patterns']) {
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
exports.deleteAccountData = (0, https_1.onCall)({ region: "europe-west3" }, async (request) => {
    var _a;
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "User must be authenticated to delete an account.");
    }
    const uid = request.auth.uid;
    const jobRef = db.collection('account_deletion_jobs').doc(uid);
    const existingJob = await jobRef.get();
    if (((_a = existingJob.data()) === null || _a === void 0 ? void 0 : _a.status) === 'completed') {
        return { success: true, status: 'completed', jobId: uid };
    }
    await jobRef.set({
        uid,
        status: 'running',
        startedAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
    try {
        await deleteAccountDocuments(uid);
        const bucket = (0, storage_1.getStorage)().bucket();
        const [files] = await bucket.getFiles({ prefix: `users/${uid}/` });
        await Promise.all(files.map((file) => file.delete()));
        try {
            await (0, auth_1.getAuth)().deleteUser(uid);
        }
        catch (error) {
            if ((error === null || error === void 0 ? void 0 : error.code) !== 'auth/user-not-found')
                throw error;
        }
        await jobRef.set({
            uid,
            status: 'completed',
            completedAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
        return { success: true, status: 'completed', jobId: uid };
    }
    catch (error) {
        await jobRef.set({
            uid,
            status: 'failed',
            error: String((error === null || error === void 0 ? void 0 : error.message) || error),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
        throw new https_1.HttpsError('failed-precondition', 'Account cleanup did not complete; retry the deletion.', { jobId: uid });
    }
});
exports.redeemVoucher = (0, https_1.onCall)({ region: "europe-west3" }, async (request) => {
    const { data, auth } = request;
    // Ensure user is authenticated
    if (!auth) {
        throw new https_1.HttpsError("unauthenticated", "User must be authenticated to redeem an item.");
    }
    const { itemId } = data;
    if (!itemId || !SHOP_ITEMS[itemId]) {
        throw new https_1.HttpsError("invalid-argument", "Invalid item ID.");
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
                throw new https_1.HttpsError("already-exists", "You have already redeemed this item.");
            }
            // 2. Check user's token balance
            const tokenDoc = await transaction.get(tokenAccountRef);
            if (!tokenDoc.exists) {
                throw new https_1.HttpsError("not-found", "Token account not found.");
            }
            const tokenData = tokenDoc.data();
            const currentBalance = (tokenData === null || tokenData === void 0 ? void 0 : tokenData.balance) || 0;
            const unlimited = (tokenData === null || tokenData === void 0 ? void 0 : tokenData.unlimitedOnDemand) || false;
            if (!unlimited && currentBalance < item.cost) {
                throw new https_1.HttpsError("failed-precondition", "Insufficient tokens.");
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
                redeemedAt: firestore_1.FieldValue.serverTimestamp(),
            });
            return { success: true, code: item.code, message: "Item redeemed successfully." };
        });
        return result;
    }
    catch (error) {
        if (error.code && error.code !== 'internal') {
            throw error;
        }
        throw new https_1.HttpsError("internal", `Error redeeming item: ${error.message}`);
    }
});
__exportStar(require("./issueGoogleMapsKey"), exports);
__exportStar(require("./issueCesiumIonToken"), exports);
__exportStar(require("./vertexRouting"), exports);
__exportStar(require("./aiProxy"), exports);
//# sourceMappingURL=index.js.map