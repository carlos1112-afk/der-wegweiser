import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getFirestore } from "firebase-admin/firestore";

const cesiumIonToken = defineSecret("CESIUM_ION_TOKEN");

export const issueCesiumIonToken = onCall({
  region: "europe-west3",
  secrets: [cesiumIonToken],
  cors: ["https://der-wegweiser.web.app", "http://localhost:5173"]
}, async (request) => {
  const { auth, app } = request;

  // App Check verifizieren
  if (!app) {
    throw new HttpsError("unauthenticated", "Invalid App Check token.");
  }

  // Auth prüfen
  if (!auth || !auth.uid) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }

  const uid = auth.uid;
  const db = getFirestore();

  // Subscription prüfen (Server-controlled record in subscriptions/{uid})
  const subDoc = await db.collection("subscriptions").doc(uid).get();
  if (!subDoc.exists) {
    throw new HttpsError("permission-denied", "Subscription not found.");
  }

  const subData = subDoc.data();
  if (subData?.status !== 'active') {
    throw new HttpsError("permission-denied", "Active subscription required.");
  }

  // Rate-Limit prüfen (eigene Collection, getrennt von keyRequests/issueGoogleMapsKey,
  // damit beide Broker unabhängig voneinander begrenzen)
  const rateLimitRef = db.collection("cesiumKeyRequests").doc(uid);
  const now = Date.now();
  const windowMs = 60 * 1000;

  try {
    await db.runTransaction(async (t) => {
      const doc = await t.get(rateLimitRef);
      let requests: number[] = [];

      if (doc.exists) {
        const data = doc.data();
        requests = data?.timestamps || [];
      }

      // Filter out old requests
      requests = requests.filter((ts: number) => now - ts < windowMs);

      if (requests.length >= 5) {
        throw new HttpsError("resource-exhausted", "Rate limit exceeded. Try again later."); // 429
      }

      requests.push(now);
      t.set(rateLimitRef, { timestamps: requests });
    });
  } catch (error: any) {
    if (error instanceof HttpsError || error.code === "resource-exhausted") {
        throw new HttpsError("resource-exhausted", "Rate limit exceeded. Try again later.");
    }
    throw new HttpsError("internal", "Rate limiting error");
  }

  return {
    token: cesiumIonToken.value()
  };
});
