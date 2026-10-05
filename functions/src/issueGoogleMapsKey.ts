import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getFirestore } from "firebase-admin/firestore";

const googleMapsApiKey = defineSecret("GOOGLE_MAPS_API_KEY");

export const issueGoogleMapsKey = onCall({
  region: "europe-west3",
  secrets: [googleMapsApiKey],
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

  // Subscription prüfen
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) {
    throw new HttpsError("permission-denied", "User not found.");
  }
  
  const userData = userDoc.data();
  if (userData?.subscriptionStatus !== 'active') {
    throw new HttpsError("permission-denied", "Active subscription required.");
  }

  // Rate-Limit prüfen
  const rateLimitRef = db.collection("keyRequests").doc(uid);
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
    key: googleMapsApiKey.value()
  };
});
