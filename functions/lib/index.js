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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.redeemVoucher = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const admin = __importStar(require("firebase-admin"));
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
//# sourceMappingURL=index.js.map