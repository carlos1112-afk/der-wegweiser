import { HttpsError } from "firebase-functions/v2/https";
import type { Firestore } from "firebase-admin/firestore";

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  now?: number;
}

export async function consumeRateLimit(
  db: Firestore,
  collection: string,
  uid: string,
  options: RateLimitOptions
): Promise<void> {
  const ref = db.collection(collection).doc(uid);
  const now = options.now ?? Date.now();

  try {
    await db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      const stored: unknown = snap.exists ? snap.data()?.timestamps : [];
      const recent = (Array.isArray(stored) ? stored : []).filter(
        (ts): ts is number => typeof ts === "number" && now - ts < options.windowMs
      );

      if (recent.length >= options.max) {
        throw new HttpsError("resource-exhausted", "Rate limit exceeded. Try again later.");
      }

      recent.push(now);
      t.set(ref, { timestamps: recent });
    });
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "Rate limiting error");
  }
}
