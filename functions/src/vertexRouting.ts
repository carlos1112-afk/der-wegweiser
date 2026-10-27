import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { VertexAI } from "@google-cloud/vertexai";

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

async function enforceUserRateLimit(uid: string): Promise<void> {
  const db = getFirestore();
  const ref = db.collection("vertexRouteRequests").doc(uid);
  const now = Date.now();
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const timestamps = snapshot.exists ? snapshot.data()?.timestamps : [];
    const recent = Array.isArray(timestamps)
      ? timestamps.filter((timestamp: unknown) => typeof timestamp === "number" && Number.isFinite(timestamp) && now - timestamp < RATE_LIMIT_WINDOW_MS)
      : [];
    if (recent.length >= RATE_LIMIT_MAX) {
      throw new HttpsError("resource-exhausted", "Route request limit exceeded. Try again later.");
    }
    transaction.set(ref, { timestamps: [...recent, now] });
  });
}

export const computeRoute = onCall({
  region: "europe-west3"
}, async (request) => {
  const { auth, app } = request;

  if (!app) {
    throw new HttpsError("unauthenticated", "Invalid App Check token.");
  }

  if (!auth || !auth.uid) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }

  await enforceUserRateLimit(auth.uid);

  const { startLat, startLng, destLat, destLng, batteryPercent, rangeKm } = request.data;
  if (![startLat, startLng, destLat, destLng, batteryPercent, rangeKm].every(Number.isFinite)
    || startLat < -90 || startLat > 90 || destLat < -90 || destLat > 90
    || startLng < -180 || startLng > 180 || destLng < -180 || destLng > 180
    || batteryPercent < 0 || batteryPercent > 100 || rangeKm < 0 || rangeKm > 1000) {
    throw new HttpsError("invalid-argument", "Invalid route parameters.");
  }
  
  try {
    const vertex_ai = new VertexAI({project: 'der-wegweiser', location: 'europe-west3'});
    const model = vertex_ai.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: "Battery-aware routing assistant für E-Bikes — gibt Waypoints + Ladestation-Empfehlungen zurück"
    });

    const prompt = `Plan a route from [${startLat}, ${startLng}] to [${destLat}, ${destLng}]. Battery: ${batteryPercent}%, Range: ${rangeKm}km.`;
    
    // Call the Vertex AI API
    await model.generateContent(prompt);
    
    // Returning stub data as requested
    return {
      waypoints: [
        { lat: startLat, lng: startLng },
        { lat: destLat, lng: destLng }
      ],
      chargingStops: [],
      estimatedRangeLeft: rangeKm > 5 ? rangeKm - 5 : 0
    };
  } catch (error: any) {
    throw new HttpsError('internal', `Vertex AI Error: ${error.message}`);
  }
});
